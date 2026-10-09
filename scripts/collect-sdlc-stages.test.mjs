// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { builtItems, classify, collectStages, STAGES_JOB } from './collect-sdlc-stages.mjs'

const D = (day) => `2026-10-${String(day).padStart(2, '0')}T12:00:00+01:00`

describe('builtItems', () => {
  const commit = (subject, day = 1) => ({ hash: 'h', date: D(day), subject })

  it('recognises each form of a build commit and its date', () => {
    const built = builtItems([
      commit('Build 010: document how to run the metrics dashboard in the README (#24)', 8),
      commit('Build the todo tracker (spec 001)', 3),
      commit('Merge pull request #9 from amjones-scottlogic/build/004-app-theme', 6),
    ])
    expect([...built.entries()]).toEqual([
      ['010', D(8)],
      ['001', D(3)],
      ['004', D(6)],
    ])
  })

  it('ignores merges of spec and intent branches and unrelated commits', () => {
    const built = builtItems([
      commit('Merge pull request #8 from amjones-scottlogic/spec/004-app-theme'),
      commit('Merge pull request #7 from amjones-scottlogic/intent/004-app-theme'),
      commit('Spec 011: SDLC progress in the Grafana dashboard (#26)'),
      commit('Build tooling tidy-up'),
    ])
    expect(built.size).toBe(0)
  })

  it('keeps the earliest build commit when several match', () => {
    const built = builtItems([commit('Build 002: later fix', 9), commit('Build 002: capture metrics', 7)])
    expect(built.get('002')).toBe(D(7))
  })
})

describe('classify', () => {
  const input = (over = {}) => ({
    files: { intent: [], spec: [], plan: [] },
    statuses: {},
    added: {},
    built: new Map(),
    ...over,
  })

  it('awaiting spec: only an intent exists, dated from when the intent landed', () => {
    const { rows } = classify(
      input({ files: { intent: ['009-continuous-evals.md'], spec: [], plan: [] }, statuses: { 'intent/009-continuous-evals.md': 'accepted' }, added: { 'intent/009-continuous-evals.md': D(7) } }),
    )
    expect(rows).toEqual([
      { number: '009', slug: 'continuous-evals', stage: 'awaiting-spec', stage_since: D(7), intent_status: 'accepted', spec_status: '', plan_status: '' },
    ])
  })

  it('awaiting plan: a spec exists and no plan, dated from the spec', () => {
    const { rows } = classify(
      input({
        files: { intent: ['011-x.md'], spec: ['011-x.md'], plan: [] },
        statuses: { 'intent/011-x.md': 'accepted', 'spec/011-x.md': 'approved' },
        added: { 'intent/011-x.md': D(1), 'spec/011-x.md': D(2) },
      }),
    )
    expect(rows[0]).toMatchObject({ stage: 'awaiting-plan', stage_since: D(2), spec_status: 'approved' })
  })

  it('in build: a plan exists and no build commit, dated from the plan', () => {
    const { rows } = classify(
      input({
        files: { intent: ['011-x.md'], spec: ['011-x.md'], plan: ['011-x.md'] },
        statuses: { 'plan/011-x.md': 'approved' },
        added: { 'intent/011-x.md': D(1), 'spec/011-x.md': D(2), 'plan/011-x.md': D(3) },
      }),
    )
    expect(rows[0]).toMatchObject({ stage: 'in-build', stage_since: D(3), plan_status: 'approved' })
  })

  it('built: a build commit wins, dated from that commit, with or without a plan', () => {
    const { rows } = classify(
      input({
        files: { intent: ['011-x.md', '012-y.md'], spec: ['011-x.md', '012-y.md'], plan: ['011-x.md'] },
        added: { 'plan/011-x.md': D(3) },
        built: new Map([
          ['011', D(5)],
          ['012', D(6)],
        ]),
      }),
    )
    expect(rows.map((r) => [r.number, r.stage, r.stage_since])).toEqual([
      ['011', 'built', D(5)],
      ['012', 'built', D(6)],
    ])
  })

  it('still makes one row for a spec with no intent file, and sorts by number', () => {
    const { rows } = classify(input({ files: { intent: ['002-b.md'], spec: ['001-a.md'], plan: [] } }))
    expect(rows.map((r) => [r.number, r.slug, r.stage])).toEqual([
      ['001', 'a', 'awaiting-plan'],
      ['002', 'b', 'awaiting-spec'],
    ])
  })

  it('lists files it cannot place instead of dropping them silently', () => {
    const { rows, unplaced } = classify(input({ files: { intent: ['notes.md', '001-a.md'], spec: ['TEMPLATE.txt'], plan: [] } }))
    expect(rows).toHaveLength(1)
    expect(unplaced).toEqual(['intent/notes.md', 'spec/TEMPLATE.txt'])
  })
})

/** A fake `git`: answers the few commands the collector makes from a fixture of origin/main. */
function fakeGit({ fail } = {}) {
  const log = []
  const git = (args) => {
    log.push(args)
    const cmd = args[0]
    if (cmd === 'fetch') {
      if (fail === 'fetch') throw new Error('fatal: unable to access origin')
      return ''
    }
    if (cmd === 'rev-parse') return 'abc1234\n'
    if (cmd === 'ls-tree') return ['intent/001-a.md', 'spec/001-a.md', 'plan/001-a.md', 'intent/002-b.md', 'intent/README.md'].join('\n') + '\n'
    if (cmd === 'show') {
      return `# t\nStatus: approved.\nStatus: draft.\n`
    }
    if (cmd === 'log' && args.includes('--diff-filter=A')) return `${D(5)}\n${D(2)}\n`
    if (cmd === 'log') return `h1\t${D(9)}\tBuild 001: do it (#3)\n`
    throw new Error(`unexpected git ${args.join(' ')}`)
  }
  return { git, log }
}

/** A fake Loki that records what is pushed. */
function fakeLoki({ down = false } = {}) {
  const pushed = []
  const fetch = async (url, init) => {
    if (down) throw new Error('connect ECONNREFUSED')
    for (const s of JSON.parse(init.body).streams) for (const v of s.values) pushed.push({ labels: s.stream, line: JSON.parse(v[1]), ts: v[0] })
    return { ok: true, status: 204, text: async () => '' }
  }
  return { fetch, pushed }
}

const run = (git, loki) => {
  const out = []
  const errs = []
  return collectStages({ git, fetch: loki.fetch, now: new Date('2026-10-10T00:00:00Z'), log: (m) => out.push(m), err: (m) => errs.push(m) }).then((code) => ({ code, out, errs }))
}

describe('collectStages', () => {
  it('fetches origin/main, reads only origin/main, and pushes one line per item under its own job', async () => {
    const { git, log } = fakeGit()
    const loki = fakeLoki()
    const { code, out } = await run(git, loki)
    expect(code).toBe(0)
    expect(log[0]).toEqual(['fetch', 'origin', 'main'])
    for (const args of log.filter((a) => ['show', 'ls-tree', 'log'].includes(a[0]))) expect(args.join(' ')).toMatch(/origin\/main/)
    expect(loki.pushed).toHaveLength(2)
    expect(loki.pushed.every((p) => p.labels.job === STAGES_JOB)).toBe(true)
    const byNumber = Object.fromEntries(loki.pushed.map((p) => [p.line.number, p]))
    expect(byNumber['001'].labels.stage).toBe('built')
    expect(byNumber['001'].line).toMatchObject({ main_commit: 'abc1234', plan_status: 'approved', stage_since: D(9) })
    expect(byNumber['002'].labels.stage).toBe('awaiting-spec')
    expect(new Set(loki.pushed.map((p) => p.line.run_id)).size).toBe(1)
    expect(out.join('\n')).toMatch(/Skipped: intent\/README\.md/)
  })

  it('exits non-zero and names the cause when the fetch fails, sending nothing', async () => {
    const loki = fakeLoki()
    const { code, errs } = await run(fakeGit({ fail: 'fetch' }).git, loki)
    expect(code).toBe(1)
    expect(errs.join('\n')).toMatch(/git fetch failed: .*unable to access origin/)
    expect(loki.pushed).toHaveLength(0)
  })

  it('exits non-zero and names Loki when it cannot be reached', async () => {
    const { code, errs } = await run(fakeGit().git, fakeLoki({ down: true }))
    expect(code).toBe(1)
    expect(errs.join('\n')).toMatch(/cannot reach Loki/)
  })
})
