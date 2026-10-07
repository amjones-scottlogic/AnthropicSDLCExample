// @vitest-environment node
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, afterEach, describe, expect, it } from 'vitest'
import {
  addMissingAuthors,
  buildRows,
  changeNumbers,
  FIELDS,
  firstImplementationShare,
  formatComment,
  gatherContext,
  intentEditsAfterSpec,
  intentToSpecHours,
  isoWeek,
  loadSessions,
  makeRow,
  MARKER,
  mergeContributorRows,
  mistakesListed,
  NO_DATA,
  parseComment,
  parseSession,
  peakConcurrentSessions,
  PENDING,
  planApprovalCommit,
  PLAN_MATCH_METRIC,
  planMatchFrom,
  planApprovalToMergeHours,
  repoSkills,
  reviewRounds,
  runCli,
  runForPr,
  sessionsDirFor,
  shareAccepted,
  SKILL_METRIC,
  specCommitsAfterPlan,
  stagesFor,
  timeToFirstMergedPrHours,
  timeToIntentHours,
  TOKEN_METRIC,
  upsertComment,
} from './capture.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..', '..', '..')
const d = (iso) => new Date(iso)
const commit = (iso, subject = 's') => ({ sha: iso, date: d(iso), subject })

// ------------------------------------------------------------ Req 1: every metric is listed

describe('skill coverage (Req 1)', () => {
  const strip = (s) => s.toLowerCase().replace(/`/g, '')
  const table = readFileSync(path.join(repoRoot, 'AI-SDLC.md'), 'utf8')
  const skill = strip(readFileSync(path.join(here, 'SKILL.md'), 'utf8'))
  const metrics = table
    .split('\n')
    .filter((l) => /^\| (Plan|Design|Build) /.test(l))
    .flatMap((l) => l.split('|').slice(2, 4))
    .flatMap((c) => c.split(';'))
    .map((m) => strip(m.trim()))
    .filter(Boolean)

  it('finds the metrics in AI-SDLC.md', () => {
    expect(metrics.length).toBeGreaterThanOrEqual(13)
  })

  it.each(metrics)('SKILL.md names: %s', (metric) => {
    expect(skill).toContain(metric)
  })
})

// ------------------------------------------------------------ Req 2: raw rows

describe('rows and comment (Req 2)', () => {
  const base = { capturedAt: 'now', stage: 'Plan', metric: 'm', kind: 'leading', source: 'git' }

  it('has all nine fields', () => {
    expect(Object.keys(makeRow({ ...base, value: 3 }))).toEqual(FIELDS)
  })

  it('leaves an unknown value empty with its note, never 0', () => {
    for (const value of [null, undefined, NaN]) {
      const r = makeRow({ ...base, value, notes: 'why' })
      expect(r.value).toBe('')
      expect(r.notes).toBe('why')
    }
    expect(makeRow({ ...base, value: 0 }).value).toBe('0')
  })

  it('refuses an unknown value with no reason', () => {
    expect(() => makeRow({ ...base, value: null })).toThrow()
  })

  it('renders a marker, a header and one line per row, escaping pipes', () => {
    const body = formatComment([makeRow({ ...base, value: 1, notes: 'a|b' }), makeRow({ ...base, value: 2 })])
    const lines = body.trim().split('\n')
    expect(lines[0]).toBe(MARKER)
    expect(lines).toContain(`| ${FIELDS.join(' | ')} |`)
    expect(lines.filter((l) => l.startsWith('| now'))).toHaveLength(2)
    expect(body).toContain('a\\|b')
  })
})

// ------------------------------------------------------------ stages

describe('stage detection (Req 5)', () => {
  it('maps each prefix to its stage', () => {
    expect(stagesFor(['intent/002-x.md'])).toEqual(['Plan'])
    expect(stagesFor(['spec/002-x.md'])).toEqual(['Design'])
    expect(stagesFor(['plan/002-x.md'])).toEqual(['Build'])
    expect(stagesFor(['src/App.tsx'])).toEqual(['Build'])
    expect(stagesFor(['README.md'])).toEqual([])
  })

  it('records a PR touching several stages under each', () => {
    expect(stagesFor(['spec/1-a.md', 'src/a.ts', 'intent/1-a.md'])).toEqual(['Design', 'Build', 'Plan'])
  })

  it('finds change numbers', () => {
    expect(changeNumbers(['intent/002-a.md', 'spec/002-a.md', 'plan/010-b.md', 'src/x.ts'])).toEqual(['002', '010'])
  })
})

// ------------------------------------------------------------ git-derived calculations

describe('git calculations (Req 3)', () => {
  const intent = [commit('2026-10-01T09:00:00Z'), commit('2026-10-03T09:00:00Z')]
  const spec = [commit('2026-10-02T09:00:00Z'), commit('2026-10-05T09:00:00Z')]
  const plan = [commit('2026-10-04T09:00:00Z', 'Approve plan 002'), commit('2026-10-06T09:00:00Z')]

  it('intent to spec time in hours', () => {
    expect(intentToSpecHours(intent, spec)).toBe(24)
    expect(intentToSpecHours(intent, [])).toBeNull()
  })

  it('intent edits after the spec', () => {
    expect(intentEditsAfterSpec(intent, spec)).toBe(1)
    expect(intentEditsAfterSpec(intent, [])).toBeNull()
  })

  it('spec commits after the first plan commit', () => {
    expect(specCommitsAfterPlan(spec, plan)).toBe(1)
    expect(specCommitsAfterPlan(spec, [])).toBeNull()
  })

  it('share of intents accepted', () => {
    expect(shareAccepted(['accepted', 'draft', 'accepted', 'accepted'])).toBe(0.75)
    expect(shareAccepted([])).toBeNull()
  })

  it('counts Common mistakes lines, ignoring the placeholder', () => {
    const md = (body) => `# C\n\n- a command\n\n## Common mistakes\n\n${body}\n\n## Other\n\n- not counted\n`
    expect(mistakesListed(md('- (none yet)'))).toBe(0)
    expect(mistakesListed(md('- one\n- two'))).toBe(2)
    expect(mistakesListed('# nothing')).toBe(0)
  })

  it('finds the approval commit for a plan number', () => {
    expect(planApprovalCommit(plan, '002')).toBe(plan[0])
    expect(planApprovalCommit(plan, '003')).toBeNull()
  })

  it('numbers the ISO week', () => {
    expect(isoWeek(d('2026-10-07T12:00:00Z'))).toBe('2026-W41')
  })
})

describe('PR calculations', () => {
  const pr = (over) => ({
    number: 1,
    author: 'a',
    createdAt: '2026-10-01T00:00:00Z',
    mergedAt: '2026-10-03T00:00:00Z',
    reviews: [],
    commits: [{ committedDate: '2026-10-01T00:00:00Z' }],
    ...over,
  })

  it('counts only change requests that a later commit answers', () => {
    const answered = pr({
      reviews: [{ state: 'CHANGES_REQUESTED', submittedAt: '2026-10-01T12:00:00Z' }, { state: 'APPROVED', submittedAt: '2026-10-02T00:00:00Z' }],
      commits: [{ committedDate: '2026-10-01T00:00:00Z' }, { committedDate: '2026-10-02T00:00:00Z' }],
    })
    expect(reviewRounds(answered)).toBe(1)
    expect(reviewRounds(pr({}))).toBe(0)
  })

  it('share merged first time', () => {
    const rework = pr({ reviews: [{ state: 'CHANGES_REQUESTED', submittedAt: '2026-10-01T12:00:00Z' }], commits: [{ committedDate: '2026-10-02T00:00:00Z' }] })
    expect(firstImplementationShare([pr({}), rework, pr({ mergedAt: null })])).toBe(0.5)
    expect(firstImplementationShare([pr({ mergedAt: null })])).toBeNull()
  })

  it('plan approval to merge', () => {
    expect(planApprovalToMergeHours(commit('2026-10-01T00:00:00Z'), pr({}))).toBe(48)
    expect(planApprovalToMergeHours(commit('2026-10-01T00:00:00Z'), pr({ mergedAt: null }))).toBeNull()
  })

  it('time to first merged PR is empty for a sole user', () => {
    expect(timeToFirstMergedPrHours([pr({})], 'a').value).toBeNull()
    const two = [pr({}), pr({ number: 2, author: 'b', mergedAt: '2026-10-04T00:00:00Z', commits: [{ committedDate: '2026-10-02T00:00:00Z' }] })]
    expect(timeToFirstMergedPrHours(two, 'b').value).toBe(48)
    // a merge dated before the author's visible commits must not give a negative number
    const odd = [pr({}), pr({ number: 3, author: 'c', mergedAt: '2026-10-01T00:00:00Z', commits: [{ committedDate: '2026-10-02T00:00:00Z' }] })]
    expect(timeToFirstMergedPrHours(odd, 'c').value).toBeNull()
  })
})

// ------------------------------------------------------------ Req 4: session stats

describe('session transcripts (Req 4)', () => {
  const line = (o) => JSON.stringify(o)
  const text = [
    line({ type: 'user', sessionId: 's1', timestamp: '2026-10-01T08:00:00Z', origin: { kind: 'human' } }),
    'not json at all',
    line({ type: 'assistant', sessionId: 's1', timestamp: '2026-10-01T08:05:00Z', message: { content: [{ type: 'tool_use', name: 'Write', input: { file_path: 'C:\\repo\\intent\\002-x.md' } }] } }),
    line({ type: 'assistant', timestamp: '2026-10-01T09:00:00Z' }),
  ].join('\n')

  it('reads span, first human prompt and written files, skipping bad lines', () => {
    const s = parseSession(text)
    expect(s.id).toBe('s1')
    expect(s.first).toEqual(d('2026-10-01T08:00:00Z'))
    expect(s.last).toEqual(d('2026-10-01T09:00:00Z'))
    expect(s.firstHuman).toEqual(d('2026-10-01T08:00:00Z'))
    expect(s.written).toEqual(['C:/repo/intent/002-x.md'])
  })

  it('returns nothing for an empty transcript', () => {
    expect(parseSession('')).toBeNull()
  })

  it('time from first conversation to the intent commit', () => {
    const s = parseSession(text)
    expect(timeToIntentHours([s], '002', commit('2026-10-01T10:00:00Z')).value).toBe(2)
    expect(timeToIntentHours([s], '009', commit('2026-10-01T10:00:00Z')).value).toBeNull()
    expect(timeToIntentHours([s], '002', undefined).value).toBeNull()
  })

  it('ignores a session that only edited the intent after it was committed (never negative)', () => {
    const s = parseSession(text)
    const t = timeToIntentHours([s], '002', commit('2026-09-30T10:00:00Z'))
    expect(t.value).toBeNull()
    expect(t.note).toMatch(/before it was first committed/)
  })

  it('peak concurrent sessions', () => {
    const s = (a, b) => ({ first: d(a), last: d(b) })
    const all = [s('2026-10-01T08:00:00Z', '2026-10-01T10:00:00Z'), s('2026-10-01T09:00:00Z', '2026-10-01T11:00:00Z'), s('2026-10-01T09:30:00Z', '2026-10-01T09:45:00Z'), s('2026-10-02T00:00:00Z', '2026-10-02T01:00:00Z')]
    expect(peakConcurrentSessions(all, d('2026-10-01T00:00:00Z'), d('2026-10-03T00:00:00Z'))).toBe(3)
    expect(peakConcurrentSessions(all, d('2026-10-01T10:30:00Z'), d('2026-10-01T10:40:00Z'))).toBe(1)
  })

  it('gives null for a missing folder and skips unreadable files', () => {
    expect(loadSessions(path.join(tmpdir(), 'no-such-folder-xyz'))).toBeNull()
  })
})

// ------------------------------------------------------------ comment upsert

/** A stand-in for the gh CLI that records writes and serves canned JSON. */
function fakeGh({ comments = {}, pr = {}, prs = [], failPr = [] } = {}) {
  const calls = []
  const gh = (args) => {
    calls.push(args)
    const joined = args.join(' ')
    if (joined.startsWith('repo view')) return 'o/r\n'
    if (args[0] === 'pr' && args[1] === 'view') {
      if (failPr.includes(Number(args[2]))) throw new Error(`gh failed for PR ${args[2]}`)
      return JSON.stringify(pr[args[2]])
    }
    if (args[0] === 'pr' && args[1] === 'list') return JSON.stringify(prs)
    if (args[0] === 'api' && args[1].endsWith('/comments') && !args.includes('-X')) {
      const list = comments[args[1].split('/').at(-2)] ?? []
      // Like gh: with --slurp every page is its own array (two comments per page here); without it the pages are
      // printed one after another, which is not valid JSON once there is more than one.
      const pages = []
      for (let i = 0; i < list.length; i += 2) pages.push(list.slice(i, i + 2))
      return args.includes('--slurp') ? JSON.stringify(pages) : pages.map((p) => JSON.stringify(p)).join('')
    }
    return ''
  }
  return { gh, calls, writes: () => calls.filter((c) => c.includes('-X')) }
}

describe('upsertComment (Req 5)', () => {
  it('creates a comment when there is none', () => {
    const { gh, writes } = fakeGh()
    expect(upsertComment(gh, 'o/r', 5, 'body')).toBe('created')
    expect(writes()).toHaveLength(1)
    expect(writes()[0]).toContain('POST')
  })

  it('updates the marker comment and leaves other comments alone', () => {
    const { gh, writes } = fakeGh({ comments: { 5: [{ id: 1, body: 'a human wrote this' }, { id: 2, body: `${MARKER}\nold` }] } })
    expect(upsertComment(gh, 'o/r', 5, 'new')).toBe('updated')
    expect(writes()).toHaveLength(1)
    expect(writes()[0]).toContain('PATCH')
    expect(writes()[0].join(' ')).toContain('issues/comments/2')
  })
})

describe('comment pagination (Req 5)', () => {
  it('finds the metrics comment on a later page of comments', () => {
    const many = [1, 2, 3, 4, 5].map((id) => ({ id, body: `human ${id}` }))
    many.push({ id: 6, body: `${MARKER}\nold` })
    const { gh, writes } = fakeGh({ comments: { 5: many } })
    expect(upsertComment(gh, 'o/r', 5, 'new')).toBe('updated')
    expect(writes()[0].join(' ')).toContain('issues/comments/6')
  })

  it('does not post a second comment when there are several pages', () => {
    const many = [1, 2, 3].map((id) => ({ id, body: `human ${id}` }))
    many.push({ id: 4, body: `${MARKER}\nold` })
    const { gh, writes } = fakeGh({ comments: { 5: many } })
    upsertComment(gh, 'o/r', 5, 'new')
    expect(writes().filter((c) => c.includes('POST'))).toHaveLength(0)
  })
})

describe('plan-match verdict survives a refresh', () => {
  const existing = (verdict) =>
    formatComment([
      makeRow({ capturedAt: 'then', stage: 'Build', metric: PLAN_MATCH_METRIC, kind: 'lagging', change: 'PR 7', value: verdict, unit: 'verdict', source: 'session' }),
    ])

  it('reads the verdict out of a comment, and ignores an empty one', () => {
    expect(planMatchFrom(existing('minor drift'))).toBe('minor drift')
    expect(planMatchFrom(formatComment([makeRow({ capturedAt: 't', stage: 'Build', metric: PLAN_MATCH_METRIC, kind: 'lagging', value: null, notes: 'not yet judged', source: 'session' })]))).toBeUndefined()
    expect(planMatchFrom(undefined)).toBeUndefined()
  })

  const refresh = (planMatch) => {
    const cwd = makeRepo()
    const view = prView(['plan/002-x.md', 'src/a.ts'])
    const { gh, writes } = fakeGh({ pr: { 7: view }, prs: [view], comments: { 7: [{ id: 9, body: existing('minor drift') }] } })
    runForPr(7, { cwd, gh, planMatch })
    return writes()[0].join(' ')
  }

  it('keeps the recorded verdict when a later push refreshes the comment', () => {
    expect(refresh(undefined)).toMatch(/\| minor drift \| verdict \| session/)
  })

  it('lets an explicit verdict replace it', () => {
    const body = refresh('major drift')
    expect(body).toMatch(/\| major drift \| verdict \| session/)
    expect(body).not.toMatch(/minor drift/)
  })
})

describe('failures are contained (Req 5)', () => {
  it('exits 1 and reports when the PR cannot be read', () => {
    const cwd = makeRepo()
    const { gh, writes } = fakeGh({ failPr: [7] })
    const errs = []
    expect(runCli(['--pr', '7'], { cwd, gh, log: () => {}, err: (m) => errs.push(m) })).toBe(1)
    expect(errs.join('\n')).toMatch(/PR 7 failed/)
    expect(writes()).toHaveLength(0)
  })

  it('exits 2 with usage when given nothing to do', () => {
    const errs = []
    expect(runCli([], { cwd: '.', gh: () => '', err: (m) => errs.push(m) })).toBe(2)
    expect(errs[0]).toMatch(/usage/)
  })
})

// ------------------------------------------------------------ git end to end on a throwaway repo

const tmp = mkdtempSync(path.join(tmpdir(), 'metrics-'))
afterAll(() => rmSync(tmp, { recursive: true, force: true }))

function git(cwd, args, date) {
  const env = { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date, GIT_CONFIG_GLOBAL: '/dev/null' }
  return execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'core.autocrlf=false', ...args], { cwd, env, encoding: 'utf8' })
}

function makeRepo(withSpec = true) {
  const cwd = mkdtempSync(path.join(tmp, 'repo-'))
  git(cwd, ['init', '-q', '-b', 'main'], '2026-10-01T00:00:00Z')
  const write = (file, text, date, msg) => {
    mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true })
    writeFileSync(path.join(cwd, file), text)
    git(cwd, ['add', '-A'], date)
    git(cwd, ['commit', '-q', '-m', msg], date)
  }
  write('CLAUDE.md', '# C\n\n## Common mistakes\n\n- (none yet)\n', '2026-10-01T00:00:00Z', 'init')
  write('intent/002-x.md', '# Intent: x\nAuthor: a. Status: accepted.\n', '2026-10-01T09:00:00Z', 'Add intent')
  if (withSpec) {
    write('spec/002-x.md', '# Spec\n', '2026-10-02T09:00:00Z', 'Add spec')
    write('plan/002-x.md', '# Plan\n', '2026-10-03T09:00:00Z', 'Approve plan 002')
  }
  return cwd
}

const prView = (files, extra = {}) => ({
  number: 7,
  author: { login: 'a' },
  state: 'OPEN',
  createdAt: '2026-10-03T10:00:00Z',
  mergedAt: null,
  headRefName: 'build/002-x',
  reviews: [],
  commits: [{ committedDate: '2026-10-03T09:00:00Z' }],
  files: files.map((p) => ({ path: p })),
  ...extra,
})

describe('end to end against a throwaway repo (Req 3)', () => {
  const rowsFor = (cwd, files, extra) => {
    const { gh } = fakeGh({ pr: { 7: prView(files, extra) }, prs: [prView(files, extra)] })
    const ctx = gatherContext({ cwd, number: 7, gh, now: d('2026-10-04T00:00:00Z') })
    ctx.sessions = null
    return buildRows(ctx)
  }
  const find = (rows, metric) => rows.find((r) => r.metric === metric)

  it('computes the Design and Plan rows from real commits', () => {
    const rows = rowsFor(makeRepo(), ['spec/002-x.md', 'intent/002-x.md'])
    expect(find(rows, 'Time from the intent commit to the spec commit').value).toBe('24')
    expect(find(rows, 'Edits to an intent after its spec is committed').value).toBe('0')
    expect(find(rows, 'Spec commits after the first plan commit for the same change').value).toBe('0')
    expect(find(rows, 'Share of intents accepted into Design').value).toBe('1')
  })

  it('leaves values empty, with a note, when the spec does not exist yet', () => {
    const rows = rowsFor(makeRepo(false), ['intent/002-x.md'])
    const r = find(rows, 'Edits to an intent after its spec is committed')
    expect(r.value).toBe('')
    expect(r.notes).toMatch(/no spec/)
  })

  it('gives identical rows when run twice on the same state', () => {
    const cwd = makeRepo()
    expect(rowsFor(cwd, ['spec/002-x.md'])).toEqual(rowsFor(cwd, ['spec/002-x.md']))
  })

  it('marks Build rows as awaiting merge, then fills them in once merged', () => {
    const cwd = makeRepo()
    const open = rowsFor(cwd, ['plan/002-x.md', 'src/a.ts'])
    expect(find(open, 'Time from plan approval to merged PR').notes).toBe(PENDING)
    const merged = rowsFor(cwd, ['plan/002-x.md', 'src/a.ts'], { state: 'MERGED', mergedAt: '2026-10-05T09:00:00Z' })
    expect(find(merged, 'Time from plan approval to merged PR').value).toBe('48')
    expect(find(merged, 'Time from plan approval to merged PR').notes).toBe('')
  })

  it('treats missing session transcripts as empty values with a note', () => {
    const rows = rowsFor(makeRepo(), ['plan/002-x.md', 'src/a.ts'])
    const r = find(rows, 'Concurrent sessions per engineer while review quality holds')
    expect(r.value).toBe('')
    expect(r.notes).toMatch(/not found/)
  })

  it('posts one comment for the PR', () => {
    const cwd = makeRepo()
    const { gh, writes } = fakeGh({ pr: { 7: prView(['spec/002-x.md']) }, prs: [prView(['spec/002-x.md'])] })
    const r = runForPr(7, { cwd, gh })
    expect(r.outcome).toBe('created')
    expect(writes()).toHaveLength(1)
    expect(writes()[0].join(' ')).toContain(MARKER)
  })
})

// ------------------------------------------------------------ skill usage and tokens (spec 008)

describe('skill usage and tokens (spec 008)', () => {
  afterEach(() => {
    delete process.env.CLAUDE_PROJECTS_DIR
  })

  const BRANCH = 'build/002-x'
  const tl = (o) => JSON.stringify({ sessionId: 's1', timestamp: '2026-10-03T10:00:00Z', gitBranch: BRANCH, ...o })
  const usage = { input_tokens: 1, output_tokens: 2, cache_read_input_tokens: 3, cache_creation_input_tokens: 4 }
  const call = (id, skill, o = {}) =>
    tl({ type: 'assistant', message: { id: `m${id}`, model: 'm1', content: [{ type: 'tool_use', id: `t${id}`, name: 'Skill', input: { skill } }], usage }, ...o })

  /** A throwaway repo with repository skills, a fake transcripts folder and a stub gh. Returns what a run posted. */
  function world({ sessions = {}, comments = [], authors = ['Amy'], runner = 'Amy', skills = ['plan', 'write-spec'], withProjectDir = true } = {}) {
    const cwd = makeRepo()
    for (const s of skills) {
      mkdirSync(path.join(cwd, '.claude', 'skills', s), { recursive: true })
      writeFileSync(path.join(cwd, '.claude', 'skills', s, 'SKILL.md'), '# s\n')
    }
    execFileSync('git', ['config', 'user.name', runner], { cwd })
    process.env.CLAUDE_PROJECTS_DIR = mkdtempSync(path.join(tmp, 'projects-'))
    if (withProjectDir) {
      const dir = sessionsDirFor(cwd)
      for (const [name, text] of Object.entries(sessions)) {
        mkdirSync(path.dirname(path.join(dir, name)), { recursive: true })
        writeFileSync(path.join(dir, name), text)
      }
    }
    const view = prView(['spec/002-x.md'], { commits: authors.map((a) => ({ committedDate: '2026-10-03T09:00:00Z', authors: [{ name: a }, { name: 'Claude Sonnet 5.5' }] })) })
    const { gh, writes } = fakeGh({ pr: { 7: view }, prs: [view], comments: { 7: comments } })
    return {
      run: () => {
        runForPr(7, { cwd, gh })
        const body = writes().at(-1).at(-1).replace(/^body=/, '')
        return { body, rows: parseComment(body) }
      },
    }
  }
  const skillRows = (rows) =>
    Object.fromEntries(rows.filter((r) => r.metric === SKILL_METRIC && r.value !== '').map((r) => [r.notes.split('; skill: ')[1]?.split(';')[0] ?? r.notes, Number(r.value)]))
  const tokenRows = (rows) => Object.fromEntries(rows.filter((r) => r.metric === TOKEN_METRIC).map((r) => [r.notes.split('; ')[2], Number(r.value)]))
  const usageRow = (who, metric, notes, value) =>
    makeRow({ capturedAt: 'then', stage: 'Design', metric, kind: 'leading', change: 'PR 7', value, unit: 'u', source: 'session', notes: `${who}; ${notes}` })

  it('counts repository skills per name across sessions, excluding other branches', () => {
    const w = world({
      sessions: {
        's1.jsonl': [call(1, 'plan'), call(2, 'plan'), call(3, 'write-spec'), call(4, 'plan', { gitBranch: 'main' })].join('\n'),
        's2.jsonl': call(5, 'plan', { sessionId: 's2' }),
      },
    })
    expect(skillRows(w.run().rows)).toEqual({ plan: 3, 'write-spec': 1 })
  })

  it('counts entries made before the first commit on the branch', () => {
    const w = world({ sessions: { 's1.jsonl': call(1, 'plan', { timestamp: '2020-01-01T00:00:00Z' }) } })
    expect(skillRows(w.run().rows)).toEqual({ plan: 1 })
  })

  it('drops personal, plugin and built-in skills before they reach the comment', () => {
    const w = world({ sessions: { 's1.jsonl': [call(1, 'plan'), call(2, 'my-personal-skill'), call(3, 'plugin:thing'), call(4, 'code-review')].join('\n') } })
    const { body, rows } = w.run()
    expect(skillRows(rows)).toEqual({ plan: 1 })
    expect(body).not.toMatch(/my-personal-skill|plugin:thing|code-review/)
  })

  it('only treats a folder with a SKILL.md as a repository skill', () => {
    const cwd = makeRepo()
    mkdirSync(path.join(cwd, '.claude', 'skills', 'real'), { recursive: true })
    writeFileSync(path.join(cwd, '.claude', 'skills', 'real', 'SKILL.md'), '# s\n')
    mkdirSync(path.join(cwd, '.claude', 'skills', 'empty'), { recursive: true })
    expect([...repoSkills(cwd)]).toEqual(['real'])
    expect(repoSkills(path.join(tmp, 'no-such-repo')).size).toBe(0)
  })

  it('counts a repository skill started by a typed slash command', () => {
    const typed = tl({ type: 'user', message: { role: 'user', content: '<command-name>/plan</command-name>\n<command-args>008</command-args>' } })
    expect(skillRows(world({ sessions: { 's1.jsonl': typed } }).run().rows)).toEqual({ plan: 1 })
  })

  it('totals tokens by type, counting a repeated message id once', () => {
    const w = world({ sessions: { 's1.jsonl': [call(1, 'plan'), call(1, 'plan'), call(2, 'write-spec')].join('\n') } })
    const rows = w.run().rows
    expect(tokenRows(rows)).toEqual({ input: 2, output: 4, 'cache read': 6, 'cache write': 8 })
    expect(skillRows(rows)).toEqual({ plan: 1, 'write-spec': 1 })
    expect(rows.find((r) => r.metric === TOKEN_METRIC).notes).toMatch(/^Amy; m1; /)
  })

  it('counts a subagent file with the session that started it', () => {
    const w = world({ sessions: { 's1.jsonl': call(1, 'plan'), 's1/subagents/agent-a.jsonl': [call(2, 'write-spec', { isSidechain: true }), 'not json'].join('\n') } })
    const rows = w.run().rows
    expect(skillRows(rows)).toEqual({ plan: 1, 'write-spec': 1 })
    expect(tokenRows(rows).input).toBe(2)
  })

  it('writes one row with 0 when sessions used no repository skill', () => {
    const w = world({ sessions: { 's1.jsonl': tl({ type: 'user', message: { content: 'hello' } }) } })
    const r = w.run().rows.find((x) => x.metric === SKILL_METRIC)
    expect(r.value).toBe('0')
    expect(r.notes).toMatch(/none used; counted by branch/)
  })

  it('leaves the value empty with a note, never 0, when transcripts are not found', () => {
    const r = world({ withProjectDir: false }).run().rows.find((x) => x.metric === SKILL_METRIC)
    expect(r.value).toBe('')
    expect(r.notes).toMatch(/Amy; no session data captured; transcripts not found/)
  })

  it('gives every skill and token row the nine fields, the contributor and the by-branch note', () => {
    const rows = world({ sessions: { 's1.jsonl': call(1, 'plan') } }).run().rows.filter((r) => r.metric === SKILL_METRIC || r.metric === TOKEN_METRIC)
    expect(rows.length).toBeGreaterThan(1)
    for (const r of rows) {
      expect(Object.keys(r)).toEqual(FIELDS)
      expect(r.source).toBe('session')
      expect(r.change).toBe('PR 7')
      expect(r.notes).toMatch(/^Amy; .*counted by branch$/)
    }
  })

  it('replaces the runner rows on a re-run without duplicates, and keeps another contributor', () => {
    const old = [usageRow('Amy', SKILL_METRIC, 'skill: plan; counted by branch', 99), usageRow('Sam', SKILL_METRIC, 'skill: plan; counted by branch', 5), usageRow('Sam', TOKEN_METRIC, 'm1; input; counted by branch', 50)]
    const w = world({ authors: ['Amy', 'Sam'], comments: [{ id: 9, body: formatComment(old) }], sessions: { 's1.jsonl': call(1, 'plan') } })
    const rows = w.run().rows
    const plan = rows.filter((r) => r.metric === SKILL_METRIC && r.notes.includes('skill: plan'))
    expect(plan.map((r) => [r.notes.split(';')[0], r.value]).sort()).toEqual([['Amy', '1'], ['Sam', '5']])
    expect(rows.find((r) => r.metric === TOKEN_METRIC && r.notes.startsWith('Sam')).value).toBe('50')
  })

  it('gives a git author with no rows a "no session data captured" row, and ignores co-authors', () => {
    const rows = world({ authors: ['Amy', 'Sam'], sessions: { 's1.jsonl': call(1, 'plan') } }).run().rows
    const sam = rows.filter((r) => r.metric === SKILL_METRIC && r.notes.startsWith('Sam'))
    expect(sam).toHaveLength(1)
    expect(sam[0].value).toBe('')
    expect(sam[0].notes).toContain(NO_DATA)
    expect(rows.some((r) => r.notes.startsWith('Claude'))).toBe(false)
  })

  it('drops a placeholder once its contributor has real rows', () => {
    const placeholder = usageRow('Sam', SKILL_METRIC, NO_DATA, null)
    const real = usageRow('Sam', SKILL_METRIC, 'skill: plan; counted by branch', 2)
    expect(mergeContributorRows([placeholder], [real], 'Sam').map((r) => r.value)).toEqual(['2'])
    expect(mergeContributorRows([placeholder], [], 'Amy')).toHaveLength(1)
    expect(addMissingAuthors([real], ['Sam'], { files: ['spec/002-x.md'], capturedAt: 't', pr: { number: 7 } })).toHaveLength(1)
  })

  it('reads a comment back, including a pipe in a cell', () => {
    const rows = [makeRow({ capturedAt: 't', stage: 'Design', metric: 'm', kind: 'leading', change: 'c', value: 3, unit: 'u', source: 'session', notes: 'a | b' })]
    expect(parseComment(formatComment(rows))).toEqual(rows)
    expect(parseComment(undefined)).toEqual([])
  })

  it('never posts transcript text or a skill that is not in the repository', () => {
    const secret = tl({ type: 'user', message: { content: 'ZEBRA-SECRET-PROMPT in my private notes' } })
    const w = world({ sessions: { 's1.jsonl': [secret, call(1, 'plan'), call(2, 'my-personal-skill')].join('\n') } })
    expect(w.run().body).not.toMatch(/ZEBRA-SECRET-PROMPT|private notes|my-personal-skill/)
  })

  it('skips malformed transcript lines without failing', () => {
    const w = world({ sessions: { 's1.jsonl': ['{broken', call(1, 'plan'), '', 'null'].join('\n') } })
    expect(skillRows(w.run().rows)).toEqual({ plan: 1 })
  })
})
