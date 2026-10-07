import {
  EMPTY_TRACKER,
  WORKSTREAM_COLOUR_NAMES,
  type TrackerState,
} from '../models/tracker/types'

const TRACKER_STORAGE_KEY = 'todo-tracker'
const STORAGE_VERSION = 1

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isValid(value: unknown): value is { version: number } & TrackerState {
  if (!isRecord(value) || value.version !== STORAGE_VERSION) {
    return false
  }
  const { workstreams, actions } = value
  if (!Array.isArray(workstreams) || !Array.isArray(actions)) {
    return false
  }
  return (
    workstreams.every(
      (w) =>
        isRecord(w) &&
        typeof w.id === 'string' &&
        typeof w.name === 'string' &&
        (WORKSTREAM_COLOUR_NAMES as readonly unknown[]).includes(w.color),
    ) &&
    actions.every(
      (a) =>
        isRecord(a) &&
        typeof a.id === 'string' &&
        typeof a.workstreamId === 'string' &&
        typeof a.text === 'string' &&
        typeof a.done === 'boolean' &&
        typeof a.createdAt === 'number',
    )
  )
}

// Missing or unreadable data starts the app empty rather than failing.
export function loadTracker(): TrackerState {
  try {
    const raw = localStorage.getItem(TRACKER_STORAGE_KEY)
    if (raw === null) {
      return EMPTY_TRACKER
    }
    const parsed: unknown = JSON.parse(raw)
    if (!isValid(parsed)) {
      return EMPTY_TRACKER
    }
    return { workstreams: parsed.workstreams, actions: parsed.actions }
  } catch {
    return EMPTY_TRACKER
  }
}

export function saveTracker(state: TrackerState): void {
  localStorage.setItem(
    TRACKER_STORAGE_KEY,
    JSON.stringify({ version: STORAGE_VERSION, workstreams: state.workstreams, actions: state.actions }),
  )
}
