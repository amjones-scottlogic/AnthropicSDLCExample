import { describe, expect, test } from 'vitest'
import type { TrackerState } from '../types/tracker'
import { trackerReducer } from './reducer'

const base: TrackerState = {
  workstreams: [
    { id: 'w1', name: 'Work', color: 'yellow' },
    { id: 'w2', name: 'Home', color: 'green' },
  ],
  actions: [
    { id: 'a1', workstreamId: 'w1', text: 'one', done: false, createdAt: 1 },
    { id: 'a2', workstreamId: 'w2', text: 'two', done: false, createdAt: 2 },
    { id: 'a3', workstreamId: 'w1', text: 'three', done: false, createdAt: 3 },
    { id: 'a4', workstreamId: 'w1', text: 'four', done: false, createdAt: 4 },
  ],
}

const ids = (state: TrackerState) => state.actions.map((a) => a.id)

describe('workstreams', () => {
  test('adds a workstream with a trimmed name and colour', () => {
    const next = trackerReducer(base, { type: 'addWorkstream', id: 'w3', name: '  Side  ', color: 'sky' })
    expect(next.workstreams.at(-1)).toEqual({ id: 'w3', name: 'Side', color: 'sky' })
  })

  test.each(['', '   '])('rejects the name %j', (name) => {
    expect(trackerReducer(base, { type: 'addWorkstream', id: 'w3', name, color: 'sky' })).toBe(base)
    expect(trackerReducer(base, { type: 'editWorkstream', id: 'w1', name, color: 'sky' })).toBe(base)
  })

  test('two workstreams may share a colour', () => {
    const next = trackerReducer(base, { type: 'addWorkstream', id: 'w3', name: 'Side', color: 'yellow' })
    expect(next.workstreams.filter((w) => w.color === 'yellow')).toHaveLength(2)
  })

  test('renames and recolours a workstream', () => {
    const next = trackerReducer(base, { type: 'editWorkstream', id: 'w1', name: 'Job', color: 'pink' })
    expect(next.workstreams[0]).toEqual({ id: 'w1', name: 'Job', color: 'pink' })
  })

  test('deleting a workstream removes its actions, open and done', () => {
    const withDone = trackerReducer(base, { type: 'toggleAction', id: 'a1' })
    const next = trackerReducer(withDone, { type: 'deleteWorkstream', id: 'w1' })
    expect(next.workstreams.map((w) => w.id)).toEqual(['w2'])
    expect(ids(next)).toEqual(['a2'])
  })
})

describe('actions', () => {
  test('adds an action at the end, not done', () => {
    const next = trackerReducer(base, {
      type: 'addAction', id: 'a5', workstreamId: 'w2', text: ' new ', createdAt: 5,
    })
    expect(next.actions.at(-1)).toEqual({ id: 'a5', workstreamId: 'w2', text: 'new', done: false, createdAt: 5 })
  })

  test.each(['', '   '])('rejects the description %j', (text) => {
    expect(trackerReducer(base, { type: 'addAction', id: 'a5', workstreamId: 'w1', text, createdAt: 5 })).toBe(base)
  })

  test('ignores an action for a workstream that does not exist', () => {
    expect(trackerReducer(base, { type: 'addAction', id: 'a5', workstreamId: 'nope', text: 'x', createdAt: 5 })).toBe(base)
  })

  test('edits text, and rejects an empty edit', () => {
    expect(trackerReducer(base, { type: 'editAction', id: 'a1', text: ' edited ' }).actions[0].text).toBe('edited')
    expect(trackerReducer(base, { type: 'editAction', id: 'a1', text: '  ' })).toBe(base)
  })

  test('toggles done and back, keeping its position', () => {
    const done = trackerReducer(base, { type: 'toggleAction', id: 'a3' })
    expect(done.actions[2].done).toBe(true)
    const undone = trackerReducer(done, { type: 'toggleAction', id: 'a3' })
    expect(undone).toEqual(base)
  })

  test('deletes an action', () => {
    expect(ids(trackerReducer(base, { type: 'deleteAction', id: 'a2' }))).toEqual(['a1', 'a3', 'a4'])
  })
})

describe('reorderAction', () => {
  test('moves an action down to the position of another', () => {
    const next = trackerReducer(base, { type: 'reorderAction', id: 'a1', overId: 'a4' })
    expect(ids(next)).toEqual(['a2', 'a3', 'a4', 'a1'])
  })

  test('moves an action up', () => {
    const next = trackerReducer(base, { type: 'reorderAction', id: 'a4', overId: 'a1' })
    expect(ids(next)).toEqual(['a4', 'a1', 'a2', 'a3'])
  })

  test("does not change another workstream's relative order", () => {
    const state: TrackerState = {
      ...base,
      actions: [...base.actions, { id: 'a5', workstreamId: 'w2', text: 'five', done: false, createdAt: 5 }],
    }
    const next = trackerReducer(state, { type: 'reorderAction', id: 'a1', overId: 'a4' })
    const home = (s: TrackerState) => s.actions.filter((a) => a.workstreamId === 'w2').map((a) => a.id)
    expect(home(next)).toEqual(home(state))
  })

  test('ignores unknown ids and a move onto itself', () => {
    expect(trackerReducer(base, { type: 'reorderAction', id: 'a1', overId: 'zz' })).toBe(base)
    expect(trackerReducer(base, { type: 'reorderAction', id: 'zz', overId: 'a1' })).toBe(base)
    expect(trackerReducer(base, { type: 'reorderAction', id: 'a1', overId: 'a1' })).toBe(base)
  })
})
