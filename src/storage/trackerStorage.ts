import {
  emptyTracker,
  workstreamColourNames,
  type TrackerState,
} from '../models/tracker/types/tracker'

const key = 'todo-tracker'
const version = 1

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isValid(value: unknown): value is { version: number } & TrackerState {
  if (!isRecord(value) || value.version !== version) return false
  const { workstreams, actions } = value
  if (!Array.isArray(workstreams) || !Array.isArray(actions)) return false
  return (
    workstreams.every(
      (w) =>
        isRecord(w) &&
        typeof w.id === 'string' &&
        typeof w.name === 'string' &&
        (workstreamColourNames as readonly unknown[]).includes(w.color),
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
    const raw = localStorage.getItem(key)
    if (raw === null) return emptyTracker
    const parsed: unknown = JSON.parse(raw)
    if (!isValid(parsed)) return emptyTracker
    return { workstreams: parsed.workstreams, actions: parsed.actions }
  } catch {
    return emptyTracker
  }
}

export function saveTracker(state: TrackerState): void {
  localStorage.setItem(
    key,
    JSON.stringify({ version, workstreams: state.workstreams, actions: state.actions }),
  )
}
