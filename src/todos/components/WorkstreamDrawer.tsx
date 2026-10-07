import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Drawer from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import type { TrackerState, WorkstreamColour } from '../../models/tracker/types'
import { ALL_VIEW, counts, type View } from '../../models/tracker/selectors'
import { workstreamColours } from '../../theme/theme'
import WorkstreamDialogs, { type WorkstreamDialog } from './WorkstreamDialogs'
import WorkstreamListItem from './WorkstreamListItem'

const DRAWER_WIDTH = 300

type WorkstreamDrawerProps = {
  state: TrackerState
  view: View
  onSelect: (view: View) => void
  onCreate: (name: string, color: WorkstreamColour) => void
  onEdit: (id: string, name: string, color: WorkstreamColour) => void
  onDelete: (id: string) => void
}

function percentDone(done: number, total: number) {
  return total === 0 ? 0 : (done / total) * 100
}

export default function WorkstreamDrawer({
  state,
  view,
  onSelect,
  onCreate,
  onEdit,
  onDelete,
}: WorkstreamDrawerProps) {
  const [dialog, setDialog] = useState<WorkstreamDialog>(null)

  function handleClose() {
    setDialog(null)
  }

  const all = counts(state, ALL_VIEW)

  return (
    <Drawer
      variant="permanent"
      sx={{ width: DRAWER_WIDTH, flexShrink: 0, '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}
    >
      <Box component="nav" aria-label="Workstreams" sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Typography variant="h4" component="p" sx={{ p: 2 }}>
          Workstreams
        </Typography>
        <List sx={{ flex: 1, overflow: 'auto' }}>
          <WorkstreamListItem
            name="All actions"
            openCount={all.open}
            percentDone={percentDone(all.done, all.total)}
            colour={workstreamColours.lavender}
            selected={view === ALL_VIEW}
            onSelect={() => onSelect(ALL_VIEW)}
          />
          {state.workstreams.map((workstream) => {
            const c = counts(state, workstream.id)

            return (
              <WorkstreamListItem
                key={workstream.id}
                name={workstream.name}
                openCount={c.open}
                percentDone={percentDone(c.done, c.total)}
                colour={workstreamColours[workstream.color]}
                selected={view === workstream.id}
                onSelect={() => onSelect(workstream.id)}
                buttons={
                  <>
                    <IconButton
                      aria-label={`Rename ${workstream.name}`}
                      onClick={() => setDialog({ kind: 'edit', id: workstream.id })}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      aria-label={`Delete ${workstream.name}`}
                      onClick={() => setDialog({ kind: 'delete', id: workstream.id })}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </>
                }
              />
            )
          })}
        </List>
        <Box sx={{ p: 2 }}>
          <Button fullWidth variant="outlined" startIcon={<AddIcon />} onClick={() => setDialog({ kind: 'create' })}>
            Add workstream
          </Button>
        </Box>
      </Box>

      <WorkstreamDialogs
        dialog={dialog}
        state={state}
        onClose={handleClose}
        onCreate={onCreate}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </Drawer>
  )
}
