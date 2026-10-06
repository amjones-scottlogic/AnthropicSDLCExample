import { describe, expect, test } from 'vitest'
import { workstreamColours } from '../../../theme/theme'
import { workstreamColourNames, type TrackerState, type Workstream } from '../types/tracker'
import { actionsFor, allView, counts, defaultColour, selectionAfterDelete } from './selectors'

const ws = (id: string, color: Workstream['color']): Workstream => ({ id, name: id, color })

const state: TrackerState = {
  workstreams: [ws('w1', 'yellow'), ws('w2', 'green')],
  actions: [
    { id: 'a1', workstreamId: 'w1', text: 'one', done: false, createdAt: 1 },
    { id: 'a2', workstreamId: 'w2', text: 'two', done: true, createdAt: 2 },
    { id: 'a3', workstreamId: 'w1', text: 'three', done: true, createdAt: 3 },
    { id: 'a4', workstreamId: 'w1', text: 'four', done: false, createdAt: 4 },
  ],
}

test('every offered colour exists in the theme, and lavender is not offered', () => {
  for (const name of workstreamColourNames) expect(workstreamColours).toHaveProperty(name)
  expect(workstreamColourNames).not.toContain('lavender')
  expect(workstreamColourNames).toHaveLength(4)
})

describe('actionsFor', () => {
  test('one workstream shows only its actions, split into open and done, in list order', () => {
    const { open, done } = actionsFor(state, 'w1')
    expect(open.map((a) => a.id)).toEqual(['a1', 'a4'])
    expect(done.map((a) => a.id)).toEqual(['a3'])
  })

  test('the All view shows every workstream', () => {
    const { open, done } = actionsFor(state, allView)
    expect(open.map((a) => a.id)).toEqual(['a1', 'a4'])
    expect(done.map((a) => a.id)).toEqual(['a2', 'a3'])
  })
})

test('counts', () => {
  expect(counts(state, 'w1')).toEqual({ open: 2, done: 1, total: 3 })
  expect(counts(state, allView)).toEqual({ open: 2, done: 2, total: 4 })
})

describe('selectionAfterDelete', () => {
  const list = [ws('a', 'yellow'), ws('b', 'green'), ws('c', 'sky')]

  test('selects the previous workstream', () => {
    expect(selectionAfterDelete(list, 'b')).toBe('a')
    expect(selectionAfterDelete(list, 'c')).toBe('b')
  })

  test('selects the next one when the first is deleted', () => {
    expect(selectionAfterDelete(list, 'a')).toBe('b')
  })

  test('selects nothing when none are left', () => {
    expect(selectionAfterDelete([ws('a', 'yellow')], 'a')).toBeNull()
  })
})

describe('defaultColour', () => {
  test('is the first colour when there are no workstreams', () => {
    expect(defaultColour([])).toBe('yellow')
  })

  test('is the first colour no workstream uses', () => {
    expect(defaultColour([ws('a', 'yellow'), ws('b', 'sky')])).toBe('green')
  })

  test('is yellow when all are used', () => {
    expect(
      defaultColour([ws('a', 'yellow'), ws('b', 'green'), ws('c', 'sky'), ws('d', 'pink')]),
    ).toBe('yellow')
  })
})
