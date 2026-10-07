import { useState, type FormEvent } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import type { Workstream } from '../../models/tracker/types'
import { cleanText } from '../../models/tracker/utils/cleanText'
import { ALL_VIEW, type View } from '../../models/tracker/selectors'
import { ink, workstreamColours } from '../../theme/theme'

type AddActionBarProps = {
  workstreams: Workstream[]
  view: View
  onAdd: (workstreamId: string, text: string) => void
}

const WHITE_INPUT_SX = { backgroundColor: '#FFFFFF', borderRadius: 1 }

// The dark bar at the bottom of the main area. `data-surface="ink"` switches on the yellow focus ring.
export default function AddActionBar({ workstreams, view, onAdd }: AddActionBarProps) {
  const [text, setText] = useState('')
  const [chosen, setChosen] = useState('')
  const [error, setError] = useState(false)

  const inAll = view === ALL_VIEW
  // In the All view the user picks the workstream; fall back to the first if their pick was deleted.
  const target = inAll ? (workstreams.find((w) => w.id === chosen) ?? workstreams[0]).id : view

  function submit(event: FormEvent) {
    event.preventDefault()
    if (cleanText(text) === null) {
      setError(true)
      return
    }
    onAdd(target, text)
    setText('')
  }

  return (
    <Box
      component="form"
      onSubmit={submit}
      noValidate
      data-surface="ink"
      sx={{ backgroundColor: ink, color: '#FFFFFF', p: 2, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'flex-end' }}
    >
      {inAll && (
        <Box sx={{ minWidth: 180 }}>
          <Typography component="label" htmlFor="add-action-workstream" sx={{ display: 'block', fontWeight: 600, mb: 0.5 }}>
            Workstream
          </Typography>
          <TextField
            select
            fullWidth
            size="small"
            id="add-action-workstream"
            value={target}
            onChange={(event) => setChosen(event.target.value)}
            slotProps={{ select: { native: true }, input: { sx: WHITE_INPUT_SX } }}
          >
            {workstreams.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </TextField>
        </Box>
      )}
      <Box sx={{ flex: 1, minWidth: 220 }}>
        <Typography component="label" htmlFor="add-action-text" sx={{ display: 'block', fontWeight: 600, mb: 0.5 }}>
          New action
        </Typography>
        <TextField
          fullWidth
          size="small"
          placeholder="What needs doing?"
          value={text}
          onChange={(event) => {
            setText(event.target.value)
            setError(false)
          }}
          slotProps={{ input: { id: 'add-action-text', sx: WHITE_INPUT_SX }, htmlInput: { 'aria-invalid': error } }}
        />
        {error && (
          <Typography role="alert" sx={{ mt: 0.5, fontWeight: 600 }}>
            Enter a description for the action
          </Typography>
        )}
      </Box>
      <Button
        type="submit"
        variant="contained"
        sx={{ backgroundColor: workstreamColours.yellow, color: ink, '&:hover': { backgroundColor: workstreamColours.yellow } }}
      >
        Add action
      </Button>
    </Box>
  )
}
