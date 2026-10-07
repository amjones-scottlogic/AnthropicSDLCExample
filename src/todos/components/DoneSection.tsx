import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import type { Action, Workstream } from '../../models/tracker/types'
import { divider } from '../../theme/theme'
import ActionRow from './ActionRow'

type DoneSectionProps = {
  /** Done actions, in order. */
  actions: Action[]
  workstreams: Workstream[]
  showWorkstream: boolean
  onToggle: (id: string) => void
  onEdit: (id: string, text: string) => void
  onDelete: (id: string) => void
}

// Collapsed by default. The expanded state is not stored.
export default function DoneSection({
  actions,
  workstreams,
  showWorkstream,
  onToggle,
  onEdit,
  onDelete,
}: DoneSectionProps) {
  if (actions.length === 0) {
    return null
  }

  return (
    <Accordion
      disableGutters
      slotProps={{ transition: { unmountOnExit: true } }}
      sx={{ border: `1px solid ${divider}`, borderRadius: 1, '&::before': { display: 'none' } }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />} aria-controls="done-actions" id="done-actions-header">
        <Typography component="h2" sx={{ fontWeight: 700 }}>
          Done ({actions.length})
        </Typography>
      </AccordionSummary>
      <AccordionDetails id="done-actions">
        <Box component="ul" aria-label="Done actions" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: '10px' }}>
          {actions.map((action) => (
            <li key={action.id}>
              <ActionRow
                action={action}
                workstream={showWorkstream ? workstreams.find((w) => w.id === action.workstreamId) : undefined}
                onToggle={onToggle}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            </li>
          ))}
        </Box>
      </AccordionDetails>
    </Accordion>
  )
}
