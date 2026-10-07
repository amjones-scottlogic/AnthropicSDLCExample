import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import CheckIcon from '@mui/icons-material/Check'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import type { Action, Workstream } from '../../models/tracker/types'
import { cleanText } from '../../models/tracker/utils/cleanText'
import { divider, doneChip, ink, workstreamColours } from '../../theme/theme'

type ActionRowProps = {
  action: Action
  /** Set in the All view, where each row shows which workstream it belongs to. */
  workstream?: Workstream
  /** Drag handle, set only where the row can be reordered. */
  handle?: ReactNode
  onToggle: (id: string) => void
  onEdit: (id: string, text: string) => void
  onDelete: (id: string) => void
}

export default function ActionRow({ action, workstream, handle, onToggle, onEdit, onDelete }: ActionRowProps) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(action.text)
  const [error, setError] = useState(false)
  const textInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      textInputRef.current?.focus()
    }
  }, [editing])

  function handleEdit() {
    setText(action.text)
    setError(false)
    setEditing(true)
  }

  function handleSave(event: FormEvent) {
    event.preventDefault()
    if (cleanText(text) === null) {
      setError(true)
      return
    }
    onEdit(action.id, text)
    setEditing(false)
  }

  const rowSx = {
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    py: 0.5,
    px: 1,
    backgroundColor: 'background.paper',
    border: `1px ${action.done ? 'dashed' : 'solid'} ${divider}`,
    borderRadius: 1,
  }

  if (editing) {
    return (
      <Box component="form" onSubmit={handleSave} noValidate sx={{ ...rowSx, flexWrap: 'wrap' }}>
        <TextField
          label="Action text"
          value={text}
          onChange={(event) => {
            setText(event.target.value)
            setError(false)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setEditing(false)
            }
          }}
          error={error}
          helperText={error ? 'Enter some text for the action' : undefined}
          slotProps={{ formHelperText: error ? { role: 'alert' } : undefined }}
          inputRef={textInputRef}
          sx={{ flex: 1, minWidth: 200 }}
        />
        <Button type="submit" variant="contained">
          Save
        </Button>
        <Button type="button" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </Box>
    )
  }

  return (
    <Box sx={rowSx}>
      {handle}
      <Checkbox
        checked={action.done}
        onChange={() => onToggle(action.id)}
        slotProps={{
          input: { 'aria-label': `${action.done ? 'Mark not done' : 'Mark done'}: ${action.text}` },
        }}
      />
      <Typography
        sx={{
          flex: 1,
          fontWeight: 600,
          overflowWrap: 'anywhere',
          ...(action.done && { textDecoration: 'line-through', color: 'text.secondary' }),
        }}
      >
        {action.text}
      </Typography>
      {action.done && (
        <Chip
          icon={<CheckIcon />}
          label="Done"
          sx={{ backgroundColor: doneChip.background, color: doneChip.text, '& .MuiChip-icon': { color: doneChip.text } }}
        />
      )}
      {workstream && (
        <Chip
          label={workstream.name}
          sx={{ backgroundColor: workstreamColours[workstream.color], color: ink, fontWeight: 600 }}
        />
      )}
      <IconButton aria-label={`Edit: ${action.text}`} onClick={handleEdit}>
        <EditIcon />
      </IconButton>
      <IconButton aria-label={`Delete: ${action.text}`} onClick={() => onDelete(action.id)}>
        <DeleteIcon />
      </IconButton>
    </Box>
  )
}
