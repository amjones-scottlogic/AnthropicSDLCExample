// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { collect, rowKey, rowsFromPr, toStreams, ROW_JOB } from './collect-metrics.mjs'

const HEADER = '| captured_at | stage | metric | kind | change | value | unit | source | notes |\n|---|---|---|---|---|---|---|---|---|'
const comment = (...rows) => ({ id: 1, body: `<!-- ai-sdlc-metrics -->\n### AI-SDLC metrics\n\n${HEADER}\n${rows.join('\n')}` })
const row = (at, metric, value, notes, stage = 'Build') => `| ${at} | ${stage} | ${metric} | leading | PR 7 | ${value} | invocations | session | ${notes} |`

const T1 = '2026-10-01T18:00:00.000Z'
const T2 = '2026-10-02T18:00:00.000Z'

/** A fake `gh`: PR list plus one comments array per PR. */
const fakeGh = (prs, commentsByPr) => (args) => {
  if (args[0] === 'repo') return 'o/r\n'
  if (args[0] === 'pr') return JSON.stringify(prs)
  const n = /issues\/(\d+)\/comments/.exec(args[1])[1]
  return JSON.stringify([commentsByPr[n] ?? []])
}

/** A fake Loki holding what was pushed, answering query_range from it. */
function fakeLoki({ down = false } = {}) {
  const store = []
  const fetch = async (url, init) => {
    if (down) throw new Error('connect ECONNREFUSED')
    if (url.includes('/push')) {
      for (const s of JSON.parse(init.body).streams) for (const v of s.values) store.push({ job: s.stream.job, ts: v[0], line: v[1] })
      return { ok: true, status: 204, text: async () => '' }
    }
    const values = store.filter((e) => e.job === ROW_JOB).map((e) => [e.ts, e.line])
    return { ok: true, status: 200, json: async () => ({ data: { result: [{ stream: {}, values }] } }), text: async () => '' }
  }
  return { fetch, store, rows: () => store.filter((e) => e.job === ROW_JOB).map((e) => JSON.parse(e.line)) }
}

const run = (loki, gh, extra = {}) => {
  const out = []
  const errs = []
  return collect({ gh, fetch: loki.fetch, now: new Date('2026-10-03T00:00:00Z'), log: (m) => out.push(m), err: (m) => errs.push(m), ...extra }).then((code) => ({ code, out, errs }))
}

describe('rowsFromPr', () => {
  it('parses a comment into rows carrying the PR number and state', () => {
    const r = rowsFromPr({ number: 7, state: 'MERGED' }, [comment(row(T1, 'Skill invocations', 3, 'amy; skill: plan; counted by branch'))])
    expect(r.status).toBe('ok')
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0]).toMatchObject({ metric: 'Skill invocations', value: '3', pr_number: 7, pr_state: 'merged' })
  })

  it('reports a PR without a metrics comment and contributes no rows', () => {
    expect(rowsFromPr({ number: 8, state: 'OPEN' }, [{ id: 2, body: 'LGTM' }])).toMatchObject({ status: 'none', rows: [] })
  })

  it('reports a marked comment with no readable table as unparsable', () => {
    expect(rowsFromPr({ number: 9, state: 'OPEN' }, [{ id: 3, body: '<!-- ai-sdlc-metrics -->\nnot a table' }]).status).toBe('unparsable')
  })

  it('keeps an empty value empty and a real 0 as 0', () => {
    const r = rowsFromPr({ number: 7, state: 'OPEN' }, [comment(row(T1, 'Skill invocations', '', 'amy; no session data captured'), row(T1, 'Skill invocations', 0, 'bob; none used; counted by branch'))])
    expect(r.rows.map((x) => x.value)).toEqual(['', '0'])
  })

  it('keeps two contributors\' skill rows on one PR', () => {
    const r = rowsFromPr({ number: 7, state: 'OPEN' }, [comment(row(T1, 'Skill invocations', 2, 'amy; skill: plan; counted by branch'), row(T1, 'Skill invocations', 1, 'bob; skill: plan; counted by branch'))])
    expect(r.rows.map((x) => x.notes)).toEqual(['amy; skill: plan; counted by branch', 'bob; skill: plan; counted by branch'])
  })

  it('does not send a row whose captured_at cannot be read', () => {
    const r = rowsFromPr({ number: 7, state: 'OPEN' }, [comment(row('yesterday', 'Tokens', 5, 'amy; m; input; counted by branch'))])
    expect(r.rows).toEqual([])
    expect(r.skipped).toHaveLength(1)
  })
})

describe('toStreams', () => {
  it('stamps each row with its captured_at and keeps empty values as empty in the body', () => {
    const rows = rowsFromPr({ number: 7, state: 'OPEN' }, [comment(row(T1, 'Skill invocations', '', 'amy; no session data captured'))]).rows
    const [stream] = toStreams(rows)
    expect(stream.stream).toEqual({ job: ROW_JOB, stage: 'Build', kind: 'leading', metric: 'Skill invocations' })
    expect(stream.values[0][0]).toBe((BigInt(Date.parse(T1)) * 1000000n).toString())
    expect(JSON.parse(stream.values[0][1]).value).toBe('')
  })
})

describe('collect', () => {
  const prs = [{ number: 7, state: 'MERGED' }, { number: 8, state: 'OPEN' }]
  const gh = (second = []) => fakeGh(prs, { 7: [comment(row(T1, 'Skill invocations', 3, 'amy; skill: plan; counted by branch'), ...second)] })

  it('loads rows, and reports PRs without a comment', async () => {
    const loki = fakeLoki()
    const { code, out } = await run(loki, gh())
    expect(code).toBe(0)
    expect(loki.rows()).toHaveLength(1)
    expect(out.join('\n')).toContain('1 rows sent')
    expect(out.join('\n')).toContain('1 PRs had no metrics comment (#8)')
  })

  it('sends nothing new when Loki already has the rows', async () => {
    const loki = fakeLoki()
    await run(loki, gh())
    const { out } = await run(loki, gh())
    expect(loki.rows()).toHaveLength(1)
    expect(out.join('\n')).toContain('0 rows sent, 1 already in Loki')
  })

  it('sends only the new snapshot when a comment is refreshed', async () => {
    const loki = fakeLoki()
    await run(loki, gh())
    await run(loki, gh([row(T2, 'Skill invocations', 4, 'amy; skill: plan; counted by branch')]))
    expect(loki.rows().map((r) => r.captured_at)).toEqual([T1, T2])
  })

  it('does not treat a merged PR as new rows', async () => {
    const loki = fakeLoki()
    await run(loki, fakeGh([{ number: 7, state: 'OPEN' }], { 7: [comment(row(T1, 'Tokens', 5, 'amy; m; input; counted by branch'))] }))
    await run(loki, fakeGh([{ number: 7, state: 'MERGED' }], { 7: [comment(row(T1, 'Tokens', 5, 'amy; m; input; counted by branch'))] }))
    expect(loki.rows()).toHaveLength(1)
  })

  it('lists an unparsable comment with its PR number and still succeeds', async () => {
    const loki = fakeLoki()
    const g = fakeGh(prs, { 7: [{ id: 1, body: '<!-- ai-sdlc-metrics -->\nbroken' }], 8: [comment(row(T1, 'Tokens', 5, 'amy; m; input; counted by branch'))] })
    const { code, out } = await run(loki, g)
    expect(code).toBe(0)
    expect(out.join('\n')).toContain('Skipped: PR 7')
    expect(loki.rows()).toHaveLength(1)
  })

  it('fails visibly with a non-zero code when Loki cannot be reached', async () => {
    const { code, errs } = await run(fakeLoki({ down: true }), gh())
    expect(code).toBe(1)
    expect(errs.join('\n')).toMatch(/cannot reach Loki/)
  })
})

describe('rowKey', () => {
  it('identifies a row by PR, metric, change, notes and captured_at', () => {
    const a = { pr_number: 7, metric: 'm', change: 'PR 7', notes: 'n', captured_at: T1, value: '1' }
    expect(rowKey(a)).toBe(rowKey({ ...a, value: '2', pr_state: 'merged' }))
    expect(rowKey(a)).not.toBe(rowKey({ ...a, captured_at: T2 }))
  })
})
