import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import type { TrackerState, Workstream, WorkstreamColour } from '../../models/tracker/types'
import { counts, defaultColour } from '../../models/tracker/selectors'
import DeleteWorkstreamDialog from './DeleteWorkstreamDialog'
import WorkstreamForm from './WorkstreamForm'

export type WorkstreamDialog =
  | { kind: 'create' }
  | { kind: 'edit'; id: string }
  | { kind: 'delete'; id: string }
  | null

type WorkstreamDialogsProps = {
  dialog: WorkstreamDialog
  state: TrackerState
  onClose: () => void
  onCreate: (name: string, color: WorkstreamColour) => void
  onEdit: (id: string, name: string, color: WorkstreamColour) => void
  onDelete: (id: string) => void
}

// MUI removes the top padding of a DialogContent that follows a DialogTitle, which clips the text
// field's floating label. The doubled selector restores the padding.
const FORM_CONTENT_SX = { '&&': { pt: 3 } }

export default function WorkstreamDialogs({
  dialog,
  state,
  onClose,
  onCreate,
  onEdit,
  onDelete,
}: WorkstreamDialogsProps) {
  const target: Workstream | null =
    dialog && dialog.kind !== 'create' ? (state.workstreams.find((w) => w.id === dialog.id) ?? null) : null

  function handleCreate(name: string, color: WorkstreamColour) {
    onCreate(name, color)
    onClose()
  }

  function handleEdit(name: string, color: WorkstreamColour) {
    if (target) {
      onEdit(target.id, name, color)
    }
    onClose()
  }

  function handleDelete() {
    if (target) {
      onDelete(target.id)
    }
    onClose()
  }

  return (
    <>
      <Dialog open={dialog?.kind === 'create'} onClose={onClose} fullWidth maxWidth="xs" aria-labelledby="create-title">
        <DialogTitle id="create-title">New workstream</DialogTitle>
        <DialogContent sx={FORM_CONTENT_SX}>
          <WorkstreamForm
            initialColor={defaultColour(state.workstreams)}
            submitLabel="Create workstream"
            onCancel={onClose}
            onSubmit={handleCreate}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialog?.kind === 'edit' && target !== null}
        onClose={onClose}
        fullWidth
        maxWidth="xs"
        aria-labelledby="edit-title"
      >
        <DialogTitle id="edit-title">Edit workstream</DialogTitle>
        <DialogContent sx={FORM_CONTENT_SX}>
          {target && dialog?.kind === 'edit' && (
            <WorkstreamForm
              initialName={target.name}
              initialColor={target.color}
              submitLabel="Save"
              onCancel={onClose}
              onSubmit={handleEdit}
            />
          )}
        </DialogContent>
      </Dialog>

      <DeleteWorkstreamDialog
        workstream={dialog?.kind === 'delete' ? target : null}
        actionCount={target ? counts(state, target.id).total : 0}
        onCancel={onClose}
        onConfirm={handleDelete}
      />
    </>
  )
}
