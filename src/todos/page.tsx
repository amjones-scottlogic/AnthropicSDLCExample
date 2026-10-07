import { useState } from 'react'
import Box from '@mui/material/Box'
import { defaultColour, actionsFor, ALL_VIEW, counts, selectionAfterDelete, type View } from '../models/tracker/selectors'
import { workstreamColours } from '../theme/theme'
import ActionList from './components/ActionList'
import AddActionBar from './components/AddActionBar'
import DoneSection from './components/DoneSection'
import EmptyState from './components/EmptyState'
import HeaderBand from './components/HeaderBand'
import WorkstreamDrawer from './components/WorkstreamDrawer'
import { useTracker } from './hooks/useTracker'

export default function TodosPage() {
  const tracker = useTracker()
  const { state } = tracker
  const [selected, setSelected] = useState<View>(ALL_VIEW)

  // If the selected workstream no longer exists, fall back to All.
  const selectedWorkstream = state.workstreams.find((w) => w.id === selected)
  const view = selectedWorkstream ? selected : ALL_VIEW

  const { open, done } = actionsFor(state, view)
  const { total } = counts(state, view)

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      <WorkstreamDrawer
        state={state}
        view={view}
        onSelect={setSelected}
        onCreate={(name, color) => setSelected(tracker.addWorkstream(name, color))}
        onEdit={tracker.editWorkstream}
        onDelete={(id) => {
          if (id === view) {
            setSelected(selectionAfterDelete(state.workstreams, id) ?? ALL_VIEW)
          }
          tracker.deleteWorkstream(id)
        }}
      />
      <Box component="main" sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {state.workstreams.length === 0 ? (
          <EmptyState
            initialColor={defaultColour(state.workstreams)}
            onCreate={(name, color) => setSelected(tracker.addWorkstream(name, color))}
          />
        ) : (
          <>
            <HeaderBand
              title={selectedWorkstream ? selectedWorkstream.name : 'All actions'}
              colour={workstreamColours[selectedWorkstream ? selectedWorkstream.color : 'lavender']}
              done={done.length}
              total={total}
            />
            <Box sx={{ flex: 1, overflow: 'auto', p: 2, display: 'grid', gap: 2, alignContent: 'start' }}>
              <ActionList
                actions={open}
                workstreams={state.workstreams}
                showWorkstream={view === ALL_VIEW}
                sortable={view !== ALL_VIEW}
                onToggle={tracker.toggleAction}
                onEdit={tracker.editAction}
                onDelete={tracker.deleteAction}
                onReorder={tracker.reorderAction}
              />
              <DoneSection
                actions={done}
                workstreams={state.workstreams}
                showWorkstream={view === ALL_VIEW}
                onToggle={tracker.toggleAction}
                onEdit={tracker.editAction}
                onDelete={tracker.deleteAction}
              />
            </Box>
            <AddActionBar workstreams={state.workstreams} view={view} onAdd={tracker.addAction} />
          </>
        )}
      </Box>
    </Box>
  )
}
