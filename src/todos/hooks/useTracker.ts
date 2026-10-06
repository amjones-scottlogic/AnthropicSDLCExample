import { useEffect, useReducer, useRef } from 'react'
import type { WorkstreamColour } from '../../models/tracker/types/tracker'
import { trackerReducer } from '../../models/tracker/utils/reducer'
import { loadTracker, saveTracker } from '../../storage/trackerStorage'

// Joins the tracker reducer to storage. Components never call storage directly.
export function useTracker() {
  const [state, dispatch] = useReducer(trackerReducer, undefined, loadTracker)

  // Save on every change, but not on load, so unreadable stored data is not overwritten by opening the app.
  const loaded = useRef(state)
  useEffect(() => {
    if (state !== loaded.current) saveTracker(state)
  }, [state])

  return {
    state,
    /** Returns the new workstream's id so the caller can select it. */
    addWorkstream(name: string, color: WorkstreamColour): string {
      const id = crypto.randomUUID()
      dispatch({ type: 'addWorkstream', id, name, color })
      return id
    },
    editWorkstream(id: string, name: string, color: WorkstreamColour) {
      dispatch({ type: 'editWorkstream', id, name, color })
    },
    deleteWorkstream(id: string) {
      dispatch({ type: 'deleteWorkstream', id })
    },
    addAction(workstreamId: string, text: string) {
      dispatch({ type: 'addAction', id: crypto.randomUUID(), workstreamId, text, createdAt: Date.now() })
    },
    editAction(id: string, text: string) {
      dispatch({ type: 'editAction', id, text })
    },
    toggleAction(id: string) {
      dispatch({ type: 'toggleAction', id })
    },
    deleteAction(id: string) {
      dispatch({ type: 'deleteAction', id })
    },
    reorderAction(id: string, overId: string) {
      dispatch({ type: 'reorderAction', id, overId })
    },
  }
}
