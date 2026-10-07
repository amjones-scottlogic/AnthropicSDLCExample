#!/usr/bin/env node
// Captures the AI-SDLC metrics defined in AI-SDLC.md and posts them as one comment on a pull request.
// Calculations are pure functions over data passed in; the CLI at the bottom gathers real data
// from git, gh and the Claude session transcripts. No dependencies.
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const MARKER = '<!-- ai-sdlc-metrics -->'
export const PENDING = 'awaiting merge'
export const FIELDS = ['captured_at', 'stage', 'metric', 'kind', 'change', 'value', 'unit', 'source', 'notes']

const HOUR = 3_600_000

// ---------------------------------------------------------------- rows

/** One measurement. An unknown value is left empty and must carry the reason in notes; it is never 0. */
export function makeRow({ capturedAt, stage, metric, kind, change = '', value, unit = '', source, notes = '' }) {
  const unknown = value === null || value === undefined || value === '' || Number.isNaN(value)
  if (unknown && !notes) throw new Error(`metric "${metric}" has no value and no note`)
  return {
    captured_at: capturedAt,
    stage,
    metric,
    kind,
    change,
    value: unknown ? '' : String(value),
    unit,
    source,
    notes,
  }
}

const cell = (text) => String(text).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')

/** The PR comment: a hidden marker, then one table row per measurement. */
export function formatComment(rows) {
  const lines = [
    MARKER,
    '### AI-SDLC metrics',
    '',
    `| ${FIELDS.join(' | ')} |`,
    `|${FIELDS.map(() => '---').join('|')}|`,
    ...rows.map((r) => `| ${FIELDS.map((f) => cell(r[f])).join(' | ')} |`),
  ]
  return lines.join('\n') + '\n'
}

const hoursBetween = (from, to) => Math.round(((to - from) / HOUR) * 10) / 10

// ---------------------------------------------------------------- stages

export function stagesFor(files) {
  const stages = []
  const add = (s) => stages.includes(s) || stages.push(s)
  for (const f of files) {
    if (f.startsWith('intent/')) add('Plan')
    else if (f.startsWith('spec/')) add('Design')
    else if (f.startsWith('plan/') || f.startsWith('src/')) add('Build')
  }
  return stages
}

export function changeNumbers(files) {
  const nums = new Set()
  for (const f of files) {
    const m = /^(?:intent|spec|plan)\/(\d{3})-/.exec(f)
    if (m) nums.add(m[1])
  }
  return [...nums].sort()
}

// ---------------------------------------------------------------- git-derived metrics
// A commit is { sha, date: Date, subject }, oldest first.

const first = (commits) => commits[0]

export function intentToSpecHours(intentCommits, specCommits) {
  if (!first(intentCommits) || !first(specCommits)) return null
  return hoursBetween(first(intentCommits).date, first(specCommits).date)
}

export function intentEditsAfterSpec(intentCommits, specCommits) {
  if (!first(specCommits)) return null
  return intentCommits.filter((c) => c.date > first(specCommits).date).length
}

export function specCommitsAfterPlan(specCommits, planCommits) {
  if (!first(planCommits)) return null
  return specCommits.filter((c) => c.date > first(planCommits).date).length
}

export function shareAccepted(statuses) {
  if (statuses.length === 0) return null
  return Math.round((statuses.filter((s) => s === 'accepted').length / statuses.length) * 100) / 100
}

/** Bullet lines under "## Common mistakes" in CLAUDE.md, not counting the "(none yet)" placeholder. */
export function mistakesListed(claudeMd) {
  const lines = (claudeMd ?? '').split('\n')
  const start = lines.findIndex((l) => /^## Common mistakes\s*$/.test(l))
  if (start === -1) return 0
  let count = 0
  for (const l of lines.slice(start + 1)) {
    if (/^## /.test(l)) break
    if (/^- /.test(l) && !/\(none yet\)/i.test(l)) count++
  }
  return count
}

export function planApprovalCommit(planCommits, number) {
  const re = new RegExp(`^approve plan ${number}\\b`, 'i')
  return planCommits.find((c) => re.test(c.subject)) ?? null
}

// ---------------------------------------------------------------- PR-derived metrics
// A pr is { number, author, state, createdAt, mergedAt, reviews: [{state, submittedAt}], commits: [{committedDate}] }.

export function reviewRounds(pr) {
  const commits = (pr.commits ?? []).map((c) => new Date(c.committedDate))
  return (pr.reviews ?? []).filter(
    (r) => r.state === 'CHANGES_REQUESTED' && commits.some((c) => c > new Date(r.submittedAt)),
  ).length
}

export function firstImplementationShare(prs) {
  const merged = prs.filter((p) => p.mergedAt)
  if (merged.length === 0) return null
  return Math.round((merged.filter((p) => reviewRounds(p) === 0).length / merged.length) * 100) / 100
}

export function planApprovalToMergeHours(approvalCommit, pr) {
  if (!approvalCommit || !pr.mergedAt) return null
  return hoursBetween(approvalCommit.date, new Date(pr.mergedAt))
}

export function isoWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d - yearStart) / 86_400_000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

export function mergedPerWeek(prs, author, week) {
  return prs.filter((p) => p.mergedAt && p.author === author && isoWeek(new Date(p.mergedAt)) === week).length
}

/** An author's first merged PR minus their earliest commit across the PRs we can see. Never negative. */
export function timeToFirstMergedPrHours(prs, author) {
  const authors = new Set(prs.map((p) => p.author))
  if (authors.size < 2) return { value: null, note: 'sole user: no new team member to measure' }
  const mine = prs.filter((p) => p.author === author)
  const merged = mine.filter((p) => p.mergedAt).sort((a, b) => a.mergedAt.localeCompare(b.mergedAt))[0]
  const commitDates = mine.flatMap((p) => p.commits.map((c) => new Date(c.committedDate)))
  if (!merged) return { value: null, note: 'no merged PR yet for this author' }
  if (commitDates.length === 0) return { value: null, note: 'no commits visible for this author' }
  const hours = hoursBetween(new Date(Math.min(...commitDates)), new Date(merged.mergedAt))
  if (hours < 0) return { value: null, note: 'earliest visible commit is after the first merge' }
  return { value: hours, note: '' }
}

// ---------------------------------------------------------------- session metrics

/** Reads one Claude Code transcript (.jsonl). Tolerates malformed lines and missing fields. */
export function parseSession(text, fallbackId = '') {
  let id = fallbackId
  let firstTs = null
  let lastTs = null
  let firstHuman = null
  const written = new Set()
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    let e
    try {
      e = JSON.parse(line)
    } catch {
      continue
    }
    if (e.sessionId) id = e.sessionId
    const ts = e.timestamp ? new Date(e.timestamp) : null
    if (ts && !Number.isNaN(ts.getTime())) {
      if (!firstTs || ts < firstTs) firstTs = ts
      if (!lastTs || ts > lastTs) lastTs = ts
      if (e.type === 'user' && e.origin?.kind === 'human' && (!firstHuman || ts < firstHuman)) firstHuman = ts
    }
    const content = e.message?.content
    if (Array.isArray(content)) {
      for (const part of content) {
        if (part?.type === 'tool_use' && (part.name === 'Write' || part.name === 'Edit') && part.input?.file_path) {
          written.add(String(part.input.file_path).replace(/\\/g, '/'))
        }
      }
    }
  }
  if (!firstTs) return null
  return { id, first: firstTs, last: lastTs, firstHuman: firstHuman ?? firstTs, written: [...written] }
}

export function timeToIntentHours(sessions, number, intentCommit) {
  if (!intentCommit) return { value: null, note: 'intent not committed yet' }
  const marker = `intent/${number}-`
  // Only a session that started before the intent was committed can have created it; later ones just edited it.
  const found = sessions
    .filter((s) => s.written.some((f) => f.includes(marker)) && s.firstHuman <= intentCommit.date)
    .sort((a, b) => a.first - b.first)[0]
  if (!found) return { value: null, note: `no readable session wrote intent/${number}-* before it was first committed` }
  return { value: hoursBetween(found.firstHuman, intentCommit.date), note: '' }
}

/** Peak number of sessions open at the same moment inside [from, to]. An approximation: a session is "open" from its first to its last message. */
export function peakConcurrentSessions(sessions, from, to) {
  const events = []
  for (const s of sessions) {
    const start = s.first < from ? from : s.first
    const end = s.last > to ? to : s.last
    if (start > end) continue
    events.push([start.getTime(), 1], [end.getTime(), -1])
  }
  events.sort((a, b) => a[0] - b[0] || b[1] - a[1])
  let open = 0
  let peak = 0
  for (const [, d] of events) {
    open += d
    peak = Math.max(peak, open)
  }
  return peak
}

export function loadSessions(dir) {
  if (!dir || !existsSync(dir)) return null
  const sessions = []
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.jsonl')) continue
    try {
      const s = parseSession(readFileSync(path.join(dir, f), 'utf8'), f.replace(/\.jsonl$/, ''))
      if (s) sessions.push(s)
    } catch {
      // unreadable file: skip it
    }
  }
  return sessions
}

export function sessionsDirFor(repoPath, env = process.env) {
  const root = env.CLAUDE_PROJECTS_DIR ?? path.join(homedir(), '.claude', 'projects')
  return path.join(root, repoPath.replace(/[^A-Za-z0-9]/g, '-'))
}

// ---------------------------------------------------------------- assembling rows

/**
 * ctx: {
 *   capturedAt, files, intentStatuses, changes: { NNN: { intent, spec, plan } (commit lists) },
 *   pr (current PR or null), prs (all PRs), claudeMd: { base, head },
 *   sessions (array or null), window: { from, to }, planMatch (string or undefined)
 * }
 */
export function buildRows(ctx) {
  const rows = []
  const stages = stagesFor(ctx.files)
  const add = (r) => rows.push(makeRow({ capturedAt: ctx.capturedAt, ...r }))
  const num = (stage, metric, kind, change, value, unit, source, note) =>
    add({ stage, metric, kind, change, value, unit, source, notes: value === null ? note : '' })

  if (stages.includes('Plan')) {
    num('Plan', 'Share of intents accepted into Design', 'lagging', 'all', shareAccepted(ctx.intentStatuses), 'ratio', 'git', 'no intents found')
  }
  for (const n of changeNumbers(ctx.files)) {
    const c = ctx.changes[n] ?? { intent: [], spec: [], plan: [] }
    if (stages.includes('Plan')) {
      num('Plan', 'Edits to an intent after its spec is committed', 'lagging', n, intentEditsAfterSpec(c.intent, c.spec), 'commits', 'git', 'no spec committed yet')
      if (ctx.sessions) {
        const t = timeToIntentHours(ctx.sessions, n, first(c.intent))
        num('Plan', 'Time from first conversation to the intent being committed', 'leading', n, t.value, 'hours', 'session', t.note)
      } else {
        num('Plan', 'Time from first conversation to the intent being committed', 'leading', n, null, 'hours', 'session', 'session transcripts not found on this machine')
      }
    }
    if (stages.includes('Design')) {
      num('Design', 'Time from the intent commit to the spec commit', 'leading', n, intentToSpecHours(c.intent, c.spec), 'hours', 'git', 'intent or spec not committed yet')
      num('Design', 'Spec commits after the first plan commit for the same change', 'lagging', n, specCommitsAfterPlan(c.spec, c.plan), 'commits', 'git', 'no plan committed yet')
    }
    if (stages.includes('Build') && ctx.pr) {
      const approval = planApprovalCommit(c.plan, n)
      const hours = planApprovalToMergeHours(approval, ctx.pr)
      num('Build', 'Time from plan approval to merged PR', 'leading', n, hours, 'hours', 'git', !approval ? `no "Approve plan ${n}" commit found` : PENDING)
    }
  }
  if (stages.includes('Build') && ctx.pr) {
    const pr = ctx.pr
    const rounds = reviewRounds(pr)
    const reviewNote = 'review rounds are read from GitHub reviews only'
    add({ stage: 'Build', metric: 'Rework cycles per change', kind: 'lagging', change: `PR ${pr.number}`, value: rounds, unit: 'review rounds', source: 'git', notes: pr.mergedAt ? reviewNote : `${reviewNote}; ${PENDING}` })
    const share = firstImplementationShare(ctx.prs)
    add({ stage: 'Build', metric: 'Share of changes that merge on the first implementation', kind: 'leading', change: 'all', value: share, unit: 'ratio', source: 'git', notes: share === null ? 'no merged PRs yet' : `over the latest ${PR_WINDOW} PRs` })
    const week = isoWeek(pr.mergedAt ? new Date(pr.mergedAt) : new Date(ctx.capturedAt))
    add({ stage: 'Build', metric: 'Changes merged per week per engineer, read against rework rate', kind: 'lagging', change: `${pr.author} ${week}`, value: mergedPerWeek(ctx.prs, pr.author, week), unit: 'PRs', source: 'git', notes: 'read against the rework rows' })
    const t = timeToFirstMergedPrHours(ctx.prs, pr.author)
    num('Build', 'Time to first merged PR for a new team member', 'leading', pr.author, t.value, 'hours', 'git', t.note)
    const mistakes = mistakesListed(ctx.claudeMd.head) - mistakesListed(ctx.claudeMd.base)
    add({ stage: 'Build', metric: 'How often Claude repeats a mistake already listed in `CLAUDE.md`', kind: 'lagging', change: `PR ${pr.number}`, value: Math.max(mistakes, 0), unit: 'lines added', source: 'git', notes: '' })
    if (ctx.sessions) {
      add({ stage: 'Build', metric: 'Concurrent sessions per engineer while review quality holds', kind: 'leading', change: `PR ${pr.number}`, value: peakConcurrentSessions(ctx.sessions, ctx.window.from, ctx.window.to), unit: 'sessions', source: 'session', notes: 'peak overlap of session first-to-last message spans; an approximation' })
    } else {
      num('Build', 'Concurrent sessions per engineer while review quality holds', 'leading', `PR ${pr.number}`, null, 'sessions', 'session', 'session transcripts not found on this machine')
    }
    num('Build', 'How often the merged diff still matches the committed plan', 'lagging', `PR ${pr.number}`, ctx.planMatch ?? null, 'verdict', 'session', 'not yet judged: run /capture-metrics and ask plan-reviewer')
  }
  return rows
}

// ---------------------------------------------------------------- GitHub comment

/** gh(args) runs the GitHub CLI and returns stdout. Injected so tests never touch GitHub. */
export function upsertComment(gh, repo, number, body) {
  const listed = JSON.parse(gh(['api', `repos/${repo}/issues/${number}/comments`, '--paginate']) || '[]')
  const existing = listed.find((c) => typeof c.body === 'string' && c.body.includes(MARKER))
  if (existing) {
    gh(['api', '-X', 'PATCH', `repos/${repo}/issues/comments/${existing.id}`, '-f', `body=${body}`])
    return 'updated'
  }
  gh(['api', '-X', 'POST', `repos/${repo}/issues/${number}/comments`, '-f', `body=${body}`])
  return 'created'
}

export function findPendingPrs(gh, repo, prs) {
  const pending = []
  for (const pr of prs.filter((p) => p.mergedAt)) {
    const listed = JSON.parse(gh(['api', `repos/${repo}/issues/${pr.number}/comments`, '--paginate']) || '[]')
    if (listed.some((c) => typeof c.body === 'string' && c.body.includes(MARKER) && c.body.includes(PENDING))) pending.push(pr.number)
  }
  return pending
}

// ---------------------------------------------------------------- gathering real data

const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })

function commitsFor(cwd, pathspec) {
  const out = run('git', ['log', '--reverse', '--format=%H%x09%cI%x09%s', '--', pathspec], cwd)
  return out
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      const [sha, date, ...subject] = l.split('\t')
      return { sha, date: new Date(date), subject: subject.join('\t') }
    })
}

function normalisePr(p) {
  return {
    number: p.number,
    author: p.author?.login ?? '',
    state: p.state,
    createdAt: p.createdAt,
    mergedAt: p.mergedAt ?? null,
    headRefName: p.headRefName,
    reviews: p.reviews ?? [],
    commits: p.commits ?? [],
  }
}

const PR_FIELDS = 'number,author,state,createdAt,mergedAt,headRefName,reviews,commits,files'
// `gh pr list` with files and 100 PRs exceeds GitHub's GraphQL node limit, so the list asks for less.
const PR_LIST_FIELDS = 'number,author,state,createdAt,mergedAt,headRefName,reviews,commits'
export const PR_WINDOW = 25

export function gatherContext({ cwd, number, gh, planMatch, now = new Date() }) {
  const repo = gh(['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner']).trim()
  const prRaw = JSON.parse(gh(['pr', 'view', String(number), '--json', PR_FIELDS]))
  const files = (prRaw.files ?? []).map((f) => f.path)
  const prs = JSON.parse(gh(['pr', 'list', '--state', 'all', '--limit', String(PR_WINDOW), '--json', PR_LIST_FIELDS])).map(normalisePr)
  const pr = normalisePr(prRaw)
  const changes = {}
  for (const n of changeNumbers(files)) {
    changes[n] = {
      intent: commitsFor(cwd, `intent/${n}-*.md`),
      spec: commitsFor(cwd, `spec/${n}-*.md`),
      plan: commitsFor(cwd, `plan/${n}-*.md`),
    }
  }
  const intentStatuses = []
  const intentDir = path.join(cwd, 'intent')
  if (existsSync(intentDir)) {
    for (const f of readdirSync(intentDir).filter((x) => x.endsWith('.md'))) {
      const m = /Status:\s*(\w+)/.exec(readFileSync(path.join(intentDir, f), 'utf8').split('\n').slice(0, 3).join('\n'))
      if (m) intentStatuses.push(m[1].toLowerCase())
    }
  }
  const readClaude = (ref) => {
    try {
      return run('git', ['show', `${ref}:CLAUDE.md`], cwd)
    } catch {
      return ''
    }
  }
  const claudeMd = {
    base: readClaude('origin/main') || readClaude('main'),
    head: existsSync(path.join(cwd, 'CLAUDE.md')) ? readFileSync(path.join(cwd, 'CLAUDE.md'), 'utf8') : '',
  }
  const sessions = loadSessions(sessionsDirFor(cwd))
  const window = { from: new Date(pr.createdAt ? new Date(pr.createdAt).getTime() - 7 * 24 * HOUR : now.getTime() - 7 * 24 * HOUR), to: now }
  return { repo, capturedAt: now.toISOString(), files, intentStatuses, changes, pr, prs, claudeMd, sessions, window, planMatch }
}

// ---------------------------------------------------------------- CLI

export function runForPr(number, { cwd, gh, planMatch }) {
  const ctx = gatherContext({ cwd, number, gh, planMatch })
  const rows = buildRows(ctx)
  const outcome = upsertComment(gh, ctx.repo, number, formatComment(rows))
  return { outcome, rows: rows.length }
}

export function catchUp({ cwd, gh }) {
  const repo = gh(['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner']).trim()
  const prs = JSON.parse(gh(['pr', 'list', '--state', 'merged', '--limit', '100', '--json', 'number,mergedAt'])).map((p) => ({ number: p.number, mergedAt: p.mergedAt }))
  const done = []
  for (const n of findPendingPrs(gh, repo, prs)) {
    runForPr(n, { cwd, gh })
    done.push(n)
  }
  return done
}

function main(argv) {
  const args = { pr: null, catchUp: false, planMatch: undefined }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--pr') args.pr = argv[++i]
    else if (argv[i] === '--catch-up') args.catchUp = true
    else if (argv[i] === '--plan-match') args.planMatch = argv[++i]
  }
  const cwd = process.cwd()
  const gh = (a) => run('gh', a, cwd)
  if (args.pr) {
    const r = runForPr(args.pr, { cwd, gh, planMatch: args.planMatch })
    console.log(`PR ${args.pr}: comment ${r.outcome} (${r.rows} rows)`)
  }
  if (args.catchUp) {
    const done = catchUp({ cwd, gh })
    console.log(`catch-up: updated ${done.length} merged PR(s)${done.length ? ` (${done.join(', ')})` : ''}`)
  }
  if (!args.pr && !args.catchUp) {
    console.error('usage: capture.mjs --pr <number> [--plan-match <match|minor drift|major drift>] [--catch-up]')
    process.exitCode = 2
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2))
