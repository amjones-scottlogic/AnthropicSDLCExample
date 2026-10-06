import { useRef } from 'react'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import type { Workstream } from '../../models/tracker/types/tracker'

type DeleteWorkstreamDialogProps = {
  workstream: Workstream | null
  actionCount: number
  onConfirm: () => void
  onCancel: () => void
}

// Cancel takes focus first, so a stray Enter does not delete.
export default function DeleteWorkstreamDialog({
  workstream,
  actionCount,
  onConfirm,
  onCancel,
}: DeleteWorkstreamDialogProps) {
  const cancel = useRef<HTMLButtonElement>(null)
  return (
    <Dialog
      open={workstream !== null}
      onClose={onCancel}
      aria-labelledby="delete-workstream-title"
      slotProps={{ transition: { onEntered: () => cancel.current?.focus() } }}
    >
      <DialogTitle id="delete-workstream-title">Delete “{workstream?.name}”?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          This deletes the workstream and {actionCount === 1 ? '1 action' : `${actionCount} actions`}{' '}
          in it, open and done. It cannot be undone.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button ref={cancel} onClick={onCancel}>
          Cancel
        </Button>
        <Button color="error" variant="contained" onClick={onConfirm}>
          Delete workstream
        </Button>
      </DialogActions>
    </Dialog>
  )
}
