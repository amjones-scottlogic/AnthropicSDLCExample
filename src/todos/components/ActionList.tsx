import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import type { Action, Workstream } from '../../models/tracker/types'
import ActionRow from './ActionRow'

type ActionListProps = {
  /** Open actions, in order. */
  actions: Action[]
  /** All workstreams, for the chip shown in the All view. */
  workstreams: Workstream[]
  showWorkstream: boolean
  /** Reordering is only offered inside a single workstream. */
  sortable: boolean
  onToggle: (id: string) => void
  onEdit: (id: string, text: string) => void
  onDelete: (id: string) => void
  onReorder: (id: string, overId: string) => void
}

const LIST_SX = { listStyle: 'none', m: 0, p: 0, display: 'grid', gap: '10px' }

type RowProps = Pick<ActionListProps, 'onToggle' | 'onEdit' | 'onDelete'> & {
  action: Action
  workstream?: Workstream
}

function SortableRow({ action, ...rest }: RowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: action.id })
  return (
    <Box
      component="li"
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      sx={{ position: 'relative', zIndex: isDragging ? 1 : 'auto' }}
    >
      <ActionRow
        action={action}
        {...rest}
        handle={
          <IconButton
            ref={setActivatorNodeRef}
            aria-label={`Reorder: ${action.text}`}
            sx={{ touchAction: 'none', cursor: 'grab' }}
            {...attributes}
            {...listeners}
          >
            <DragIndicatorIcon />
          </IconButton>
        }
      />
    </Box>
  )
}

export default function ActionList({
  actions,
  workstreams,
  showWorkstream,
  sortable,
  onToggle,
  onEdit,
  onDelete,
  onReorder,
}: ActionListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const workstreamOf = (action: Action) =>
    showWorkstream ? workstreams.find((w) => w.id === action.workstreamId) : undefined

  if (!sortable) {
    return (
      <Box component="ul" aria-label="Open actions" sx={LIST_SX}>
        {actions.map((action) => (
          <li key={action.id}>
            <ActionRow
              action={action}
              workstream={workstreamOf(action)}
              onToggle={onToggle}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </li>
        ))}
      </Box>
    )
  }

  // Announce by the action's text and position, not by its id.
  const textOf = (id: string | number) => actions.find((a) => a.id === id)?.text ?? 'action'
  const position = (id: string | number) => actions.findIndex((a) => a.id === id) + 1
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${textOf(active.id)}. Position ${position(active.id)} of ${actions.length}.`,
    onDragOver: ({ active, over }) =>
      over ? `${textOf(active.id)} is over position ${position(over.id)} of ${actions.length}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? `Dropped ${textOf(active.id)} at position ${position(over.id)} of ${actions.length}.`
        : `Dropped ${textOf(active.id)}. It was not moved.`,
    onDragCancel: ({ active }) => `Cancelled. ${textOf(active.id)} was not moved.`,
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (over && active.id !== over.id) {
      onReorder(String(active.id), String(over.id))
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      accessibility={{ announcements }}
    >
      <SortableContext items={actions.map((a) => a.id)} strategy={verticalListSortingStrategy}>
        <Box component="ul" aria-label="Open actions" sx={LIST_SX}>
          {actions.map((action) => (
            <SortableRow
              key={action.id}
              action={action}
              workstream={workstreamOf(action)}
              onToggle={onToggle}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </Box>
      </SortableContext>
    </DndContext>
  )
}
