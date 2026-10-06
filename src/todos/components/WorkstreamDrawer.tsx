import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Drawer from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import type { TrackerState, Workstream, WorkstreamColour } from '../../models/tracker/types/tracker'
import { allView, counts, defaultColour, type View } from '../../models/tracker/utils/selectors'
import ProgressRing from '../../components/ProgressRing'
import { workstreamColours } from '../../theme/theme'
import DeleteWorkstreamDialog from './DeleteWorkstreamDialog'
import WorkstreamForm from './WorkstreamForm'

type WorkstreamDrawerProps = {
  state: TrackerState
  view: View
  onSelect: (view: View) => void
  onCreate: (name: string, color: WorkstreamColour) => void
  onEdit: (id: string, name: string, color: WorkstreamColour) => void
  onDelete: (id: string) => void
}

type Dialogs = { kind: 'create' } | { kind: 'edit'; id: string } | { kind: 'delete'; id: string } | null

export default function WorkstreamDrawer({
  state,
  view,
  onSelect,
  onCreate,
  onEdit,
  onDelete,
}: WorkstreamDrawerProps) {
  const [dialog, setDialog] = useState<Dialogs>(null)
  const close = () => setDialog(null)
  const target: Workstream | null =
    dialog && dialog.kind !== 'create' ? (state.workstreams.find((w) => w.id === dialog.id) ?? null) : null

  const all = counts(state, allView)

  return (
    <Drawer variant="permanent" sx={{ width: 300, flexShrink: 0, '& .MuiDrawer-paper': { width: 300 } }}>
      <Box component="nav" aria-label="Workstreams" sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Typography variant="h4" component="p" sx={{ p: 2 }}>
          Workstreams
        </Typography>
        <List sx={{ flex: 1, overflow: 'auto' }}>
          <ListItem disablePadding>
            <ListItemButton
              selected={view === allView}
              aria-current={view === allView ? 'page' : undefined}
              onClick={() => onSelect(allView)}
              sx={{ gap: 1.5 }}
            >
              <ProgressRing
                size={36}
                value={all.total === 0 ? 0 : (all.done / all.total) * 100}
                count={all.open}
                colour={workstreamColours.lavender}
              />
              <Box>
                <Typography sx={{ fontWeight: 600 }}>All actions</Typography>
                <Typography variant="body2" color="text.secondary">
                  {all.open} open
                </Typography>
              </Box>
            </ListItemButton>
          </ListItem>
          {state.workstreams.map((workstream) => {
            const c = counts(state, workstream.id)
            return (
              <ListItem key={workstream.id} disablePadding sx={{ pr: 1 }}>
                <ListItemButton
                  selected={view === workstream.id}
                  aria-current={view === workstream.id ? 'page' : undefined}
                  onClick={() => onSelect(workstream.id)}
                  sx={{ gap: 1.5, flex: 1 }}
                >
                  <ProgressRing
                    size={36}
                    value={c.total === 0 ? 0 : (c.done / c.total) * 100}
                    count={c.open}
                    colour={workstreamColours[workstream.color]}
                  />
                  <Box>
                    <Typography sx={{ fontWeight: 600 }}>{workstream.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {c.open} open
                    </Typography>
                  </Box>
                </ListItemButton>
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
              </ListItem>
            )
          })}
        </List>
        <Box sx={{ p: 2 }}>
          <Button fullWidth variant="outlined" startIcon={<AddIcon />} onClick={() => setDialog({ kind: 'create' })}>
            Add workstream
          </Button>
        </Box>
      </Box>

      <Dialog open={dialog?.kind === 'create'} onClose={close} fullWidth maxWidth="xs" aria-labelledby="create-title">
        <DialogTitle id="create-title">New workstream</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <WorkstreamForm
            initialColor={defaultColour(state.workstreams)}
            submitLabel="Create workstream"
            onCancel={close}
            onSubmit={(name, color) => {
              onCreate(name, color)
              close()
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialog?.kind === 'edit' && target !== null}
        onClose={close}
        fullWidth
        maxWidth="xs"
        aria-labelledby="edit-title"
      >
        <DialogTitle id="edit-title">Edit workstream</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {target && dialog?.kind === 'edit' && (
            <WorkstreamForm
              initialName={target.name}
              initialColor={target.color}
              submitLabel="Save"
              onCancel={close}
              onSubmit={(name, color) => {
                onEdit(target.id, name, color)
                close()
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <DeleteWorkstreamDialog
        workstream={dialog?.kind === 'delete' ? target : null}
        actionCount={target ? counts(state, target.id).total : 0}
        onCancel={close}
        onConfirm={() => {
          if (target) onDelete(target.id)
          close()
        }}
      />
    </Drawer>
  )
}
