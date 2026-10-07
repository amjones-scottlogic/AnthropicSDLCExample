import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import ProgressRing from '../../components/ProgressRing'
import { ink } from '../../theme/theme'

type HeaderBandProps = {
  title: string
  /** The view's pastel: the workstream's colour, or lavender for All. */
  colour: string
  done: number
  total: number
}

// The ring is decorative; "N of M done" carries the same figure as text. The arc is ink because a
// pastel arc would disappear on the pastel band.
export default function HeaderBand({ title, colour, done, total }: HeaderBandProps) {
  return (
    <Box
      component="header"
      sx={{ backgroundColor: colour, color: ink, p: 2, display: 'flex', alignItems: 'center', gap: 2 }}
    >
      <ProgressRing size={56} value={total === 0 ? 0 : (done / total) * 100} count={done} colour={ink} />
      <Box>
        <Typography variant="h4" component="h1">
          {title}
        </Typography>
        <Typography sx={{ color: ink }}>
          {done} of {total} done
        </Typography>
      </Box>
    </Box>
  )
}
