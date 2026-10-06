import { useEffect, useRef, useState, type FormEvent } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import type { WorkstreamColour } from '../../models/tracker/types/tracker'
import { cleanText } from '../../models/tracker/utils/reducer'
import ColourPicker from './ColourPicker'

type WorkstreamFormProps = {
  initialName?: string
  initialColor: WorkstreamColour
  submitLabel: string
  onSubmit: (name: string, color: WorkstreamColour) => void
  onCancel?: () => void
}

// Used to create and to edit a workstream. An empty name is rejected with a message.
export default function WorkstreamForm({
  initialName = '',
  initialColor,
  submitLabel,
  onSubmit,
  onCancel,
}: WorkstreamFormProps) {
  const [name, setName] = useState(initialName)
  const [color, setColor] = useState(initialColor)
  const [error, setError] = useState(false)
  const nameInput = useRef<HTMLInputElement>(null)

  useEffect(() => nameInput.current?.focus(), [])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (cleanText(name) === null) {
      setError(true)
      return
    }
    onSubmit(name, color)
  }

  return (
    <Box component="form" onSubmit={handleSubmit} noValidate sx={{ display: 'grid', gap: 2 }}>
      <TextField
        label="Workstream name"
        value={name}
        onChange={(event) => {
          setName(event.target.value)
          setError(false)
        }}
        error={error}
        helperText={error ? 'Enter a name for the workstream' : undefined}
        slotProps={{ formHelperText: error ? { role: 'alert' } : undefined }}
        inputRef={nameInput}
      />
      <ColourPicker value={color} onChange={setColor} />
      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        {onCancel && (
          <Button type="button" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" variant="contained">
          {submitLabel}
        </Button>
      </Box>
    </Box>
  )
}
