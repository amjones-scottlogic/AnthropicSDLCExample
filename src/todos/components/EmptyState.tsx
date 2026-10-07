import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import type { WorkstreamColour } from '../../models/tracker/types'
import WorkstreamForm from './WorkstreamForm'

type EmptyStateProps = {
  initialColor: WorkstreamColour
  onCreate: (name: string, color: WorkstreamColour) => void
}

// Shown in the middle of the main area when there are no workstreams yet.
export default function EmptyState({ initialColor, onCreate }: EmptyStateProps) {
  return (
    <Box sx={{ flex: 1, display: 'grid', placeItems: 'center', p: 3 }}>
      <Box sx={{ width: '100%', maxWidth: 480, display: 'grid', gap: 2 }}>
        <Typography variant="h1" component="h1">
          Create your first workstream
        </Typography>
        <Typography>A workstream groups related actions. Name it and pick a colour to get started.</Typography>
        <WorkstreamForm initialColor={initialColor} submitLabel="Create workstream" onSubmit={onCreate} />
      </Box>
    </Box>
  )
}
