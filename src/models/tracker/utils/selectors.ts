import {
  workstreamColourNames,
  type Action,
  type TrackerState,
  type Workstream,
  type WorkstreamColour,
} from '../types/tracker'

// The selected view: one workstream's id, or 'all'.
export type View = string

export const allView = 'all'

export function actionsFor(
  state: TrackerState,
  view: View,
): { open: Action[]; done: Action[] } {
  const inView = view === allView ? state.actions : state.actions.filter((a) => a.workstreamId === view)
  return { open: inView.filter((a) => !a.done), done: inView.filter((a) => a.done) }
}

export function counts(state: TrackerState, view: View): { open: number; done: number; total: number } {
  const { open, done } = actionsFor(state, view)
  return { open: open.length, done: done.length, total: open.length + done.length }
}

// The workstream to show after one is deleted: the one before it, else the one after it, else none.
export function selectionAfterDelete(workstreams: Workstream[], deletedId: string): string | null {
  const index = workstreams.findIndex((w) => w.id === deletedId)
  if (index === -1) return null
  const remaining = workstreams.filter((w) => w.id !== deletedId)
  if (remaining.length === 0) return null
  return remaining[Math.max(index - 1, 0)].id
}

// The first colour no workstream uses yet, or the first colour if all are used.
export function defaultColour(workstreams: Workstream[]): WorkstreamColour {
  const used = new Set(workstreams.map((w) => w.color))
  return workstreamColourNames.find((c) => !used.has(c)) ?? workstreamColourNames[0]
}
