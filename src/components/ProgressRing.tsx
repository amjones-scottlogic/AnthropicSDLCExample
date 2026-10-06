import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import { ink, progressTrack } from '../theme/theme'

type ProgressRingProps = {
  /** Diameter in px: 36 in the drawer, 56 in the page header. */
  size: number
  /** Progress from 0 to 100. */
  value: number
  /** The figure shown inside the ring. */
  count: number
  /** Arc colour, a pastel from the theme. */
  colour: string
}

// Decorative: hidden from assistive technology. The same figure must appear as text beside it.
export default function ProgressRing({ size, value, count, colour }: ProgressRingProps) {
  return (
    <Box
      aria-hidden="true"
      data-testid="progress-ring"
      sx={{ position: 'relative', display: 'inline-flex', width: size, height: size }}
    >
      <CircularProgress
        variant="determinate"
        value={100}
        size={size}
        thickness={5}
        sx={{ color: progressTrack, position: 'absolute' }}
      />
      <CircularProgress
        variant="determinate"
        value={value}
        size={size}
        thickness={5}
        sx={{ color: colour, position: 'absolute' }}
      />
      <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
        <Typography
          component="span"
          sx={{ color: ink, fontWeight: 800, fontSize: size >= 56 ? '1.25rem' : '0.875rem' }}
        >
          {count}
        </Typography>
      </Box>
    </Box>
  )
}
