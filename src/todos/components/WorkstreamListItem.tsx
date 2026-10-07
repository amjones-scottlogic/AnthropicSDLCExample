import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import Typography from '@mui/material/Typography'
import ProgressRing from '../../components/ProgressRing'

// Width of the rename and delete buttons (two 44px controls). Rows without buttons reserve it so
// every row in the drawer, and its selected highlight, is the same width.
const ROW_BUTTONS_WIDTH = 88

type WorkstreamListItemProps = {
  name: string
  openCount: number
  /** Share of the view's actions that are done, 0 to 100. */
  percentDone: number
  /** The view's pastel, used for the ring's arc. */
  colour: string
  selected: boolean
  onSelect: () => void
  /** Row buttons such as rename and delete. Leave out to keep the space empty. */
  buttons?: ReactNode
}

export default function WorkstreamListItem({
  name,
  openCount,
  percentDone,
  colour,
  selected,
  onSelect,
  buttons,
}: WorkstreamListItemProps) {
  return (
    <ListItem disablePadding sx={{ pr: 1 }}>
      <ListItemButton
        selected={selected}
        aria-current={selected ? 'page' : undefined}
        onClick={onSelect}
        sx={{ gap: 1.5, flex: 1 }}
      >
        <ProgressRing size={36} value={percentDone} count={openCount} colour={colour} />
        <Box>
          <Typography sx={{ fontWeight: 600 }}>{name}</Typography>
          <Typography variant="body2" color="text.secondary">
            {openCount} open
          </Typography>
        </Box>
      </ListItemButton>
      {buttons ?? <Box aria-hidden="true" data-testid="row-buttons-spacer" sx={{ width: ROW_BUTTONS_WIDTH, flexShrink: 0 }} />}
    </ListItem>
  )
}
