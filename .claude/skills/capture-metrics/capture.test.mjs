// @vitest-environment node
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it, vi } from 'vitest'
import {
  buildRows,
  catchUp,
  changeNumbers,
  FIELDS,
  findPendingPrs,
  firstImplementationShare,
  formatComment,
  gatherContext,
  intentEditsAfterSpec,
  intentToSpecHours,
  isoWeek,
  loadSessions,
  makeRow,
  MARKER,
  mistakesListed,
  parseSession,
  peakConcurrentSessions,
  PENDING,
  planApprovalCommit,
  PLAN_MATCH_METRIC,
  planMatchFrom,
  planApprovalToMergeHours,
  reviewRounds,
  runCli,
  runForPr,
  shareAccepted,
  specCommitsAfterPlan,
  stagesFor,
  timeToFirstMergedPrHours,
  timeToIntentHours,
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

// ------------------------------------------------------------ comment upsert and catch-up

/** A stand-in for the gh CLI that records writes and serves canned JSON. */
function fakeGh({ comments = {}, pr = {}, prs = [], merged = [], failPr = [] } = {}) {
  const calls = []
  const gh = (args) => {
    calls.push(args)
    const joined = args.join(' ')
    if (joined.startsWith('repo view')) return 'o/r\n'
    if (args[0] === 'pr' && args[1] === 'view') {
      if (failPr.includes(Number(args[2]))) throw new Error(`gh failed for PR ${args[2]}`)
      return JSON.stringify(pr[args[2]])
    }
    if (args[0] === 'pr' && args[1] === 'list') return JSON.stringify(args.includes('merged') ? merged : prs)
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
  const pending = [{ id: 1, body: `${MARKER}\n| x | ${PENDING} |` }]

  it('catch-up refreshes the other PRs when one fails', () => {
    const cwd = makeRepo()
    const mergedPr = (n) => prView(['plan/002-x.md', 'src/a.ts'], { number: n, state: 'MERGED', mergedAt: '2026-10-05T09:00:00Z' })
    const { gh, writes } = fakeGh({
      pr: { 7: mergedPr(7), 8: mergedPr(8) },
      prs: [mergedPr(7)],
      merged: [{ number: 7, mergedAt: '2026-10-05T09:00:00Z' }, { number: 8, mergedAt: '2026-10-05T09:00:00Z' }],
      comments: { 7: pending, 8: [{ id: 2, body: `${MARKER}\n| x | ${PENDING} |` }] },
      failPr: [7],
    })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(catchUp({ cwd, gh })).toEqual([8])
    expect(writes()).toHaveLength(1)
    expect(writes()[0].join(' ')).toContain('issues/comments/2')
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('PR 7 not refreshed'))
    spy.mockRestore()
  })

  it('skips a PR whose comments cannot be read instead of stopping', () => {
    const gh = (args) => {
      if (args[1]?.includes('issues/7/')) throw new Error('boom')
      return JSON.stringify([[{ id: 2, body: `${MARKER}\n| x | ${PENDING} |` }]])
    }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const prs = [{ number: 7, mergedAt: 'x' }, { number: 8, mergedAt: 'x' }]
    expect(findPendingPrs(gh, 'o/r', prs)).toEqual([8])
    spy.mockRestore()
  })

  it('still runs catch-up when --pr fails, and exits non-zero', () => {
    const cwd = makeRepo()
    const merged = prView(['plan/002-x.md', 'src/a.ts'], { number: 8, state: 'MERGED', mergedAt: '2026-10-05T09:00:00Z' })
    const { gh, writes } = fakeGh({
      pr: { 8: merged },
      prs: [merged],
      merged: [{ number: 8, mergedAt: merged.mergedAt }],
      comments: { 8: [{ id: 2, body: `${MARKER}\n| x | ${PENDING} |` }] },
      failPr: [7],
    })
    const logs = []
    const errs = []
    const code = runCli(['--pr', '7', '--catch-up'], { cwd, gh, log: (m) => logs.push(m), err: (m) => errs.push(m) })
    expect(code).toBe(1)
    expect(errs.join('\n')).toMatch(/PR 7 failed/)
    expect(logs.join('\n')).toMatch(/updated 1 merged PR/)
    expect(writes()).toHaveLength(1)
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

describe('catch-up (Req 6)', () => {
  it('refreshes only merged PRs whose comment is still awaiting merge', () => {
    const cwd = makeRepo()
    const mergedPr = prView(['plan/002-x.md', 'src/a.ts'], { number: 7, state: 'MERGED', mergedAt: '2026-10-05T09:00:00Z' })
    const stale = [{ id: 9, body: `${MARKER}\n| x | ${PENDING} |` }]
    const fresh = [{ id: 10, body: `${MARKER}\n| x | done |` }]
    const { gh, writes } = fakeGh({
      pr: { 7: mergedPr, 8: { ...mergedPr, number: 8 } },
      prs: [mergedPr],
      merged: [{ number: 7, mergedAt: mergedPr.mergedAt }, { number: 8, mergedAt: mergedPr.mergedAt }],
      comments: { 7: stale, 8: fresh },
    })
    expect(catchUp({ cwd, gh })).toEqual([7])
    expect(writes()).toHaveLength(1)
    expect(writes()[0].join(' ')).toContain('issues/comments/9')
  })
})
