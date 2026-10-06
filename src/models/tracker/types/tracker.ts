// The colours a user can give a workstream. Names match keys of `workstreamColours` in the theme;
// lavender is reserved for the All view and is not offered.
export const workstreamColourNames = ['yellow', 'green', 'sky', 'pink'] as const

export type WorkstreamColour = (typeof workstreamColourNames)[number]

export type Workstream = {
  id: string
  name: string
  color: WorkstreamColour
}

export type Action = {
  id: string
  workstreamId: string
  text: string
  done: boolean
  createdAt: number
}

// The order of `actions` is the display order.
export type TrackerState = {
  workstreams: Workstream[]
  actions: Action[]
}

export const emptyTracker: TrackerState = { workstreams: [], actions: [] }
