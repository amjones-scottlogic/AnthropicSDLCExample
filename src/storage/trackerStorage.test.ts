import { beforeEach, describe, expect, test } from 'vitest'
import type { TrackerState } from '../models/tracker/types/tracker'
import { loadTracker, saveTracker } from './trackerStorage'

const state: TrackerState = {
  workstreams: [
    { id: 'w1', name: 'Work', color: 'sky' },
    { id: 'w2', name: 'Home', color: 'pink' },
  ],
  actions: [
    { id: 'a2', workstreamId: 'w2', text: 'second added first', done: true, createdAt: 2 },
    { id: 'a1', workstreamId: 'w1', text: 'first', done: false, createdAt: 1 },
  ],
}

const empty = { workstreams: [], actions: [] }

beforeEach(() => localStorage.clear())

test('a saved state loads back with names, colours, order and done state', () => {
  saveTracker(state)
  expect(loadTracker()).toEqual(state)
})

test('is stored as one versioned value under one key', () => {
  saveTracker(state)
  expect(localStorage).toHaveLength(1)
  expect(JSON.parse(localStorage.getItem('todo-tracker')!)).toMatchObject({ version: 1 })
})

describe('unreadable data starts empty', () => {
  test('missing', () => {
    expect(loadTracker()).toEqual(empty)
  })

  test.each([
    ['invalid JSON', '{nope'],
    ['not an object', '42'],
    ['null', 'null'],
    ['unknown version', JSON.stringify({ version: 2, workstreams: [], actions: [] })],
    ['missing lists', JSON.stringify({ version: 1 })],
    [
      'unknown colour',
      JSON.stringify({ version: 1, workstreams: [{ id: 'w', name: 'n', color: 'lavender' }], actions: [] }),
    ],
    [
      'bad action',
      JSON.stringify({ version: 1, workstreams: [], actions: [{ id: 'a', text: 1 }] }),
    ],
  ])('%s', (_name, raw) => {
    localStorage.setItem('todo-tracker', raw)
    expect(loadTracker()).toEqual(empty)
  })
})
