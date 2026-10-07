import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material/styles'
import type { Action, Workstream } from '../../models/tracker/types'
import theme from '../../theme/theme'
import ActionList from './ActionList'

const workstreams: Workstream[] = [{ id: 'w1', name: 'Work', color: 'sky' }]
const actions: Action[] = ['first', 'second', 'third'].map((text, i) => ({
  id: `a${i + 1}`,
  workstreamId: 'w1',
  text,
  done: false,
  createdAt: i,
}))

// jsdom has no layout, so every box is 0x0 and dnd-kit finds nothing to move over. Give each list
// item a 50px-high box at its position in the list so keyboard dragging has somewhere to go.
beforeEach(() => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const item = this.closest('li')
    const index = item ? Array.from(item.parentElement!.children).indexOf(item) : 0
    return new DOMRect(0, index * 50, 400, 50)
  })
})
afterEach(() => vi.restoreAllMocks())

function renderList(props: { sortable: boolean; onReorder?: (id: string, overId: string) => void }) {
  return render(
    <ThemeProvider theme={theme}>
      <ActionList
        actions={actions}
        workstreams={workstreams}
        showWorkstream={!props.sortable}
        sortable={props.sortable}
        onToggle={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
        onReorder={props.onReorder ?? (() => {})}
      />
    </ThemeProvider>,
  )
}

test('keyboard dragging reorders an action and announces it', async () => {
  const onReorder = vi.fn()
  const user = userEvent.setup()
  renderList({ sortable: true, onReorder })

  screen.getByRole('button', { name: 'Reorder: first' }).focus()
  await user.keyboard(' ')
  await user.keyboard('{ArrowDown}')
  await user.keyboard(' ')

  await waitFor(() => expect(onReorder).toHaveBeenCalledWith('a1', 'a2'))
  expect(document.querySelector('[role="status"]')).toHaveTextContent('Dropped first at position 2 of 3.')
})

test('Escape cancels a keyboard drag without reordering', async () => {
  const onReorder = vi.fn()
  const user = userEvent.setup()
  renderList({ sortable: true, onReorder })

  screen.getByRole('button', { name: 'Reorder: first' }).focus()
  await user.keyboard(' ')
  await user.keyboard('{ArrowDown}')
  await user.keyboard('{Escape}')

  expect(onReorder).not.toHaveBeenCalled()
})

test('the All view has no drag handles', () => {
  renderList({ sortable: false })
  const items = within(screen.getByRole('list', { name: 'Open actions' })).getAllByRole('listitem')
  expect(items).toHaveLength(3)
  expect(screen.queryByRole('button', { name: /Reorder/ })).not.toBeInTheDocument()
})
