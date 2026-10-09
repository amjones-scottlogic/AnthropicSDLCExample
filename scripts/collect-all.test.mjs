// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { collectAll } from './collect-all.mjs'

const stub = (code, calls, name) => async () => {
  calls.push(name)
  return code
}

describe('collectAll', () => {
  it('runs both collectors and exits 0 when both succeed', async () => {
    const calls = []
    expect(await collectAll({ collect: stub(0, calls, 'metrics'), collectStages: stub(0, calls, 'stages') })).toBe(0)
    expect(calls).toEqual(['metrics', 'stages'])
  })

  it('still runs the stages when the PR metrics fail, and exits non-zero', async () => {
    const calls = []
    expect(await collectAll({ collect: stub(1, calls, 'metrics'), collectStages: stub(0, calls, 'stages') })).toBe(1)
    expect(calls).toEqual(['metrics', 'stages'])
  })

  it('still runs the PR metrics when the stages fail, and exits non-zero', async () => {
    const calls = []
    expect(await collectAll({ collect: stub(0, calls, 'metrics'), collectStages: stub(1, calls, 'stages') })).toBe(1)
    expect(calls).toEqual(['metrics', 'stages'])
  })

  it('treats a collector that throws as a failure and still runs the other', async () => {
    const calls = []
    const boom = async () => {
      throw new Error('boom')
    }
    expect(await collectAll({ collect: boom, collectStages: stub(0, calls, 'stages'), err: () => {} })).toBe(1)
    expect(calls).toEqual(['stages'])
  })
})
