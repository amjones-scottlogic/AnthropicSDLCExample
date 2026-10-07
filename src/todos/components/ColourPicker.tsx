import Box from '@mui/material/Box'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormLabel from '@mui/material/FormLabel'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import { WORKSTREAM_COLOUR_NAMES, type WorkstreamColour } from '../../models/tracker/types'
import { ink, workstreamColours } from '../../theme/theme'

type ColourPickerProps = {
  value: WorkstreamColour
  onChange: (colour: WorkstreamColour) => void
}

const label = (name: string) => name.charAt(0).toUpperCase() + name.slice(1)

// Each colour is named in text, so a pastel is never the only way to tell the options apart.
export default function ColourPicker({ value, onChange }: ColourPickerProps) {
  return (
    <FormControl>
      <FormLabel id="colour-picker-label" sx={{ color: 'text.primary' }}>
        Colour
      </FormLabel>
      <RadioGroup
        row
        aria-labelledby="colour-picker-label"
        value={value}
        onChange={(event) => onChange(event.target.value as WorkstreamColour)}
      >
        {WORKSTREAM_COLOUR_NAMES.map((name) => (
          <FormControlLabel
            key={name}
            value={name}
            control={<Radio />}
            label={
              <Box
                component="span"
                sx={{
                  display: 'inline-block',
                  px: 1,
                  borderRadius: 1,
                  backgroundColor: workstreamColours[name],
                  color: ink,
                  fontWeight: 600,
                }}
              >
                {label(name)}
              </Box>
            }
          />
        ))}
      </RadioGroup>
    </FormControl>
  )
}
