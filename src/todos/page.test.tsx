import { beforeEach, describe, expect, test } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material/styles'
import theme from '../theme/theme'
import TodosPage from './page'

type User = ReturnType<typeof userEvent.setup>

function renderPage() {
  return render(
    <ThemeProvider theme={theme}>
      <TodosPage />
    </ThemeProvider>,
  )
}

beforeEach(() => localStorage.clear())

async function createFirstWorkstream(user: User, name: string) {
  await user.type(screen.getByRole('textbox', { name: 'Workstream name' }), name)
  await user.click(screen.getByRole('button', { name: 'Create workstream' }))
}

async function addWorkstream(user: User, name: string, colour?: string) {
  await user.click(screen.getByRole('button', { name: 'Add workstream' }))
  const dialog = await screen.findByRole('dialog', { name: 'New workstream' })
  await user.type(within(dialog).getByRole('textbox', { name: 'Workstream name' }), name)
  if (colour) await user.click(within(dialog).getByRole('radio', { name: colour }))
  await user.click(within(dialog).getByRole('button', { name: 'Create workstream' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
}

async function addAction(user: User, text: string) {
  await user.type(screen.getByRole('textbox', { name: 'New action' }), text)
  await user.click(screen.getByRole('button', { name: 'Add action' }))
}

// A workstream's drawer button also names its open count, so match the start of the name.
const viewButton = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) })

const openActions = () =>
  within(screen.getByRole('list', { name: 'Open actions' }))
    .getAllByRole('listitem')
    .map((li) => within(li).getByRole('checkbox').getAttribute('aria-label')!.replace('Mark done: ', ''))

describe('empty state (Req 6)', () => {
  test('invites the user to create the first workstream and shows no add bar', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: 'Create your first workstream' })).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'New action' })).not.toBeInTheDocument()
  })

  test('creating a workstream replaces it with the normal view', async () => {
    const user = userEvent.setup()
    renderPage()
    await createFirstWorkstream(user, 'Work')
    expect(screen.getByRole('heading', { level: 1, name: 'Work' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'New action' })).toBeInTheDocument()
  })

  test('can be completed with the keyboard alone', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.keyboard('Work{Enter}')
    expect(screen.getByRole('heading', { level: 1, name: 'Work' })).toBeInTheDocument()
  })
})

describe('workstreams (Req 1, 2)', () => {
  test('rejects an empty or whitespace-only name', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByRole('textbox', { name: 'Workstream name' }), '   ')
    await user.click(screen.getByRole('button', { name: 'Create workstream' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a name')
    expect(screen.getByRole('heading', { name: 'Create your first workstream' })).toBeInTheDocument()
  })

  test('offers exactly four colours, each named, and defaults to the first unused', async () => {
    const user = userEvent.setup()
    renderPage()
    await createFirstWorkstream(user, 'Work')
    await user.click(screen.getByRole('button', { name: 'Add workstream' }))
    const dialog = await screen.findByRole('dialog')
    const radios = within(dialog).getAllByRole('radio')
    expect(radios.map((r) => r.getAttribute('value'))).toEqual(['yellow', 'green', 'sky', 'pink'])
    expect(within(dialog).getByRole('radio', { name: 'Green' })).toBeChecked()
  })

  test('renames and recolours a workstream everywhere it is shown', async () => {
    const user = userEvent.setup()
    renderPage()
    await createFirstWorkstream(user, 'Work')
    await user.click(screen.getByRole('button', { name: 'Rename Work' }))
    const dialog = await screen.findByRole('dialog', { name: 'Edit workstream' })
    const field = within(dialog).getByRole('textbox', { name: 'Workstream name' })
    await user.clear(field)
    await user.type(field, 'Job')
    await user.click(within(dialog).getByRole('radio', { name: 'Pink' }))
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('heading', { level: 1, name: 'Job' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rename Job' })).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('todo-tracker')!).workstreams[0]).toMatchObject({
      name: 'Job',
      color: 'pink',
    })
  })

  test('delete asks first, names the workstream and the action count; Cancel changes nothing', async () => {
    const user = userEvent.setup()
    renderPage()
    await createFirstWorkstream(user, 'Work')
    await addAction(user, 'one')
    await addAction(user, 'two')
    await user.click(screen.getByRole('checkbox', { name: 'Mark done: two' }))
    await user.click(screen.getByRole('button', { name: 'Delete Work' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Delete “Work”?')
    expect(dialog).toHaveTextContent('2 actions')
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('heading', { level: 1, name: 'Work' })).toBeInTheDocument()
    expect(screen.getByText('one')).toBeInTheDocument()
  })

  test('confirming deletes the workstream and all its actions, and shows the previous one', async () => {
    const user = userEvent.setup()
    renderPage()
    await createFirstWorkstream(user, 'Work')
    await addWorkstream(user, 'Home')
    await addAction(user, 'home action')
    await user.click(screen.getByRole('button', { name: 'Delete Home' }))
    await user.click(await screen.findByRole('button', { name: 'Delete workstream' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('heading', { level: 1, name: 'Work' })).toBeInTheDocument()
    expect(screen.queryByText('home action')).not.toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('todo-tracker')!).actions).toEqual([])
  })

  test('deleting the first workstream shows the next; deleting the last shows the empty state', async () => {
    const user = userEvent.setup()
    renderPage()
    await createFirstWorkstream(user, 'Work')
    await addWorkstream(user, 'Home')
    await user.click(viewButton('Work'))
    await user.click(screen.getByRole('button', { name: 'Delete Work' }))
    await user.click(await screen.findByRole('button', { name: 'Delete workstream' }))
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Home' })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Delete Home' }))
    await user.click(await screen.findByRole('button', { name: 'Delete workstream' }))
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Create your first workstream' })).toBeInTheDocument(),
    )
  })
})

describe('actions (Req 3, 4, 5)', () => {
  test('adds actions in order, not done, and rejects empty text', async () => {
    const user = userEvent.setup()
    renderPage()
    await createFirstWorkstream(user, 'Work')
    await addAction(user, 'first')
    await addAction(user, '   ')
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a description')
    await addAction(user, 'second')
    expect(openActions()).toEqual(['first', 'second'])
    expect(screen.getByRole('checkbox', { name: 'Mark done: first' })).not.toBeChecked()
  })

  test('done actions live in a collapsed section and can be undone', async () => {
    const user = userEvent.setup()
    renderPage()
    await createFirstWorkstream(user, 'Work')
    await addAction(user, 'first')
    await addAction(user, 'second')
    await addAction(user, 'third')
    await user.click(screen.getByRole('checkbox', { name: 'Mark done: second' }))

    expect(openActions()).toEqual(['first', 'third'])
    const toggle = screen.getByRole('button', { name: /Done \(1\)/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('second')).not.toBeInTheDocument()

    toggle.focus()
    await user.keyboard('{Enter}')
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const done = within(await screen.findByRole('list', { name: 'Done actions' }))
    expect(done.getByText('second')).toBeInTheDocument()
    expect(done.getByText('Done')).toBeInTheDocument()

    await user.click(done.getByRole('checkbox', { name: 'Mark not done: second' }))
    expect(openActions()).toEqual(['first', 'second', 'third'])
  })

  test('edits an action, rejects an empty edit, and Escape cancels', async () => {
    const user = userEvent.setup()
    renderPage()
    await createFirstWorkstream(user, 'Work')
    await addAction(user, 'original')

    await user.click(screen.getByRole('button', { name: 'Edit: original' }))
    const field = screen.getByRole('textbox', { name: 'Action text' })
    await waitFor(() => expect(field).toHaveFocus())
    await user.clear(field)
    await user.keyboard('{Enter}')
    expect(screen.getByRole('alert')).toHaveTextContent('Enter some text')

    await user.type(field, 'changed{Enter}')
    expect(screen.getByText('changed')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Edit: changed' }))
    await user.type(screen.getByRole('textbox', { name: 'Action text' }), ' more{Escape}')
    expect(screen.getByText('changed')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Action text' })).not.toBeInTheDocument()
  })

  test('deletes an action without asking', async () => {
    const user = userEvent.setup()
    renderPage()
    await createFirstWorkstream(user, 'Work')
    await addAction(user, 'gone')
    await user.click(screen.getByRole('button', { name: 'Delete: gone' }))
    expect(screen.queryByText('gone')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('views (Req 7)', () => {
  test('one workstream shows only its actions; All shows each with its workstream and cannot be reordered', async () => {
    const user = userEvent.setup()
    renderPage()
    await createFirstWorkstream(user, 'Work')
    await addAction(user, 'work thing')
    await addWorkstream(user, 'Home')
    await addAction(user, 'home thing')

    expect(screen.queryByText('work thing')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reorder: home thing' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /All actions/ }))
    expect(screen.getByRole('heading', { level: 1, name: 'All actions' })).toBeInTheDocument()
    const list = within(screen.getByRole('list', { name: 'Open actions' }))
    expect(list.getAllByRole('listitem')).toHaveLength(2)
    expect(list.getByText('Work')).toBeInTheDocument()
    expect(list.getByText('Home')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Reorder/ })).not.toBeInTheDocument()
  })

  test('in All the user chooses the workstream to add to', async () => {
    const user = userEvent.setup()
    renderPage()
    await createFirstWorkstream(user, 'Work')
    await addWorkstream(user, 'Home')
    await user.click(screen.getByRole('button', { name: /All actions/ }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Workstream' }), 'Work')
    await addAction(user, 'for work')
    await user.click(viewButton('Work'))
    expect(screen.getByText('for work')).toBeInTheDocument()
  })
})

describe('persistence (Req 9)', () => {
  test('a reload shows the same data in the same order', async () => {
    const user = userEvent.setup()
    const first = renderPage()
    await createFirstWorkstream(user, 'Work')
    await addAction(user, 'a')
    await addAction(user, 'b')
    await addAction(user, 'c')
    await user.click(screen.getByRole('checkbox', { name: 'Mark done: b' }))
    first.unmount()

    renderPage()
    await userEvent.setup().click(viewButton('Work'))
    expect(openActions()).toEqual(['a', 'c'])
    expect(screen.getByRole('button', { name: /Done \(1\)/ })).toBeInTheDocument()
  })

  test('opening the app does not overwrite unreadable stored data', () => {
    localStorage.setItem('todo-tracker', '{broken')
    renderPage()
    expect(screen.getByRole('heading', { name: 'Create your first workstream' })).toBeInTheDocument()
    expect(localStorage.getItem('todo-tracker')).toBe('{broken')
  })
})
