import type { TrackerState, WorkstreamColour } from '../types/tracker'

export type TrackerAction =
  | { type: 'addWorkstream'; id: string; name: string; color: WorkstreamColour }
  | { type: 'editWorkstream'; id: string; name: string; color: WorkstreamColour }
  | { type: 'deleteWorkstream'; id: string }
  | { type: 'addAction'; id: string; workstreamId: string; text: string; createdAt: number }
  | { type: 'editAction'; id: string; text: string }
  | { type: 'toggleAction'; id: string }
  | { type: 'deleteAction'; id: string }
  | { type: 'reorderAction'; id: string; overId: string }

// Returns the trimmed value, or null if it is empty or only whitespace.
export function cleanText(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function move<T>(list: T[], from: number, to: number): T[] {
  const next = list.slice()
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

export function trackerReducer(state: TrackerState, action: TrackerAction): TrackerState {
  switch (action.type) {
    case 'addWorkstream': {
      const name = cleanText(action.name)
      if (name === null) return state
      return {
        ...state,
        workstreams: [...state.workstreams, { id: action.id, name, color: action.color }],
      }
    }
    case 'editWorkstream': {
      const name = cleanText(action.name)
      if (name === null) return state
      return {
        ...state,
        workstreams: state.workstreams.map((w) =>
          w.id === action.id ? { ...w, name, color: action.color } : w,
        ),
      }
    }
    case 'deleteWorkstream':
      return {
        workstreams: state.workstreams.filter((w) => w.id !== action.id),
        actions: state.actions.filter((a) => a.workstreamId !== action.id),
      }
    case 'addAction': {
      const text = cleanText(action.text)
      if (text === null || !state.workstreams.some((w) => w.id === action.workstreamId)) {
        return state
      }
      return {
        ...state,
        actions: [
          ...state.actions,
          {
            id: action.id,
            workstreamId: action.workstreamId,
            text,
            done: false,
            createdAt: action.createdAt,
          },
        ],
      }
    }
    case 'editAction': {
      const text = cleanText(action.text)
      if (text === null) return state
      return {
        ...state,
        actions: state.actions.map((a) => (a.id === action.id ? { ...a, text } : a)),
      }
    }
    case 'toggleAction':
      return {
        ...state,
        actions: state.actions.map((a) => (a.id === action.id ? { ...a, done: !a.done } : a)),
      }
    case 'deleteAction':
      return { ...state, actions: state.actions.filter((a) => a.id !== action.id) }
    case 'reorderAction': {
      const from = state.actions.findIndex((a) => a.id === action.id)
      const to = state.actions.findIndex((a) => a.id === action.overId)
      if (from === -1 || to === -1 || from === to) return state
      // Moving within the full list keeps other workstreams' relative order intact.
      return { ...state, actions: move(state.actions, from, to) }
    }
  }
}
