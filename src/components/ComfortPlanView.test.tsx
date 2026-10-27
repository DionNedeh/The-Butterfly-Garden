import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { changeComfortPlan, COMFORT_ITEMS } from '../lib/comfortPlan'
import { resetDrafts } from '../lib/drafts'
import { createInitialState } from '../lib/progression'
import type { AppState, AppView, ComfortPlan } from '../types'
import { ComfortPlanView } from './ComfortPlanView'

// Unmounted first, so forgetting the drafts redraws nothing.
afterEach(() => {
  cleanup()
  resetDrafts()
})

const HELPS = 'Things that help me feel a little better'
const PEOPLE = 'People I can reach'

function gardenWith(comfortPlan?: ComfortPlan): AppState {
  const seed = createInitialState('Tester', 'Test Garden')
  return { ...seed, profile: { ...seed.profile!, ...(comfortPlan ? { comfortPlan } : {}) } }
}

/** The page over a garden of its own, changed as the app changes it. */
function Harness({
  plan,
  from,
  onOpenSupport = vi.fn(),
  onBack = vi.fn(),
  onGarden,
}: {
  plan?: ComfortPlan
  from?: AppView
  onOpenSupport?: () => void
  onBack?: () => void
  onGarden?: (garden: AppState) => void
}) {
  const [garden, setGarden] = useState(() => gardenWith(plan))
  return (
    <ComfortPlanView
      plan={garden.profile?.comfortPlan}
      onChange={(change) =>
        setGarden((current) => {
          const next = changeComfortPlan(current, change)
          onGarden?.(next)
          return next
        })
      }
      onOpenSupport={onOpenSupport}
      from={from}
      onBack={onBack}
    />
  )
}

function list(title: string) {
  return within(screen.getByRole('region', { name: title }))
}

/** The page's own polite line, which says what each action did. */
function said(): HTMLElement {
  return document.querySelector<HTMLElement>('.comfort-view > p[role="status"]')!
}

function linesOf(title: string): string[] {
  const lines = list(title).queryAllByRole('listitem')
  return lines.map((line) => line.querySelector('.comfort-words')?.textContent ?? '')
}

const three: ComfortPlan = {
  helps: [
    { id: 'tea', text: 'A cup of tea' },
    { id: 'walk', text: 'A slow walk' },
    { id: 'song', text: 'That one song' },
  ],
}

describe('my comfort plan', () => {
  it('opens at its heading, with the way to support first and plain words about what it is', async () => {
    const onOpenSupport = vi.fn()
    render(<Harness onOpenSupport={onOpenSupport} />)
    const heading = screen.getByRole('heading', { level: 1, name: 'My comfort plan' })
    expect(heading).toHaveFocus()
    const support = screen.getByRole('link', { name: 'If you need support now' })
    expect(support).toHaveAttribute('href', '#/support')
    expect(support.closest('p')).toHaveTextContent('It is not a substitute for help')
    // Before any of the lists.
    const firstList = screen.getByRole('heading', { level: 2, name: HELPS })
    expect(support.compareDocumentPosition(firstList) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await userEvent.setup().click(support)
    expect(onOpenSupport).toHaveBeenCalledOnce()
    expect(screen.getByText(/never shows it anywhere else/)).toBeInTheDocument()
  })

  it('shows five lists, each with an example while empty and never a request', () => {
    render(<Harness />)
    const titles = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)
    expect(titles).toEqual([
      HELPS,
      PEOPLE,
      'Places that feel calm',
      'Kind words for myself',
      'What matters to me',
    ])
    for (const title of titles) {
      expect(list(title).getByText(/^For example:/)).toBeInTheDocument()
      expect(list(title).queryByRole('list')).toBeNull()
    }
    // None of the words of a clinical form.
    expect(document.body).not.toHaveTextContent(/safety plan|crisis plan|suicid|warning sign/i)
  })

  it('adds a line, and the field is ready for another', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const field = list(HELPS).getByRole('textbox', { name: 'Something that helps' })
    await user.type(field, 'A warm bath')
    await user.click(list(HELPS).getByRole('button', { name: `Add to ${HELPS}` }))
    expect(linesOf(HELPS)).toEqual(['A warm bath'])
    expect(list(HELPS).queryByText(/^For example:/)).toBeNull()
    expect(field).toHaveValue('')
    expect(field).toHaveFocus()
    expect(said()).toHaveTextContent(`Added to ${HELPS}.`)
  })

  it('adds a person with a number, one tap to call', async () => {
    const user = userEvent.setup()
    const onGarden = vi.fn()
    render(<Harness onGarden={onGarden} />)
    await user.type(list(PEOPLE).getByRole('textbox', { name: 'Name' }), 'Sam')
    await user.type(list(PEOPLE).getByRole('textbox', { name: 'Phone number (optional)' }), '+44 7700-900 123')
    await user.click(list(PEOPLE).getByRole('button', { name: `Add to ${PEOPLE}` }))
    const call = list(PEOPLE).getByRole('link', { name: 'Call Sam' })
    expect(call).toHaveAttribute('href', 'tel:+447700900123')
    expect(list(PEOPLE).getByText('+44 7700-900 123')).toBeInTheDocument()
    expect(onGarden.mock.lastCall?.[0].profile.comfortPlan).toEqual({
      people: [{ id: expect.any(String), text: 'Sam', phone: '+44 7700-900 123' }],
    })

    // Someone to visit needs no number, and has no link.
    await user.type(list(PEOPLE).getByRole('textbox', { name: 'Name' }), 'Nan, next door')
    await user.keyboard('{Enter}')
    expect(linesOf(PEOPLE)).toEqual(['Sam+44 7700-900 123', 'Nan, next door'])
    expect(list(PEOPLE).getAllByRole('link')).toHaveLength(1)
  })

  it('says why it cannot add, with focus on the field to change', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(list(HELPS).getByRole('button', { name: `Add to ${HELPS}` }))
    expect(list(HELPS).getByRole('alert')).toHaveTextContent('There are no words here yet.')
    const field = list(HELPS).getByRole('textbox', { name: 'Something that helps' })
    expect(field).toHaveFocus()
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(field).toHaveAccessibleDescription('There are no words here yet.')
    // Gone as soon as it is being put right.
    await user.type(field, 'T')
    expect(list(HELPS).queryByRole('alert')).toBeNull()
    expect(field).not.toHaveAttribute('aria-invalid')

    const name = list(PEOPLE).getByRole('textbox', { name: 'Name' })
    const phone = list(PEOPLE).getByRole('textbox', { name: 'Phone number (optional)' })
    await user.type(phone, '0161 496 0000')
    await user.click(list(PEOPLE).getByRole('button', { name: `Add to ${PEOPLE}` }))
    expect(list(PEOPLE).getByRole('alert')).toHaveTextContent('Add a name too, so you know who this is.')
    expect(name).toHaveFocus()

    await user.type(name, 'Mum')
    await user.clear(phone)
    await user.type(phone, 'call me')
    await user.click(list(PEOPLE).getByRole('button', { name: `Add to ${PEOPLE}` }))
    expect(list(PEOPLE).getByRole('alert')).toHaveTextContent(
      'A phone number can hold digits, a plus sign, spaces and dashes.',
    )
    expect(phone).toHaveFocus()
    expect(phone).toHaveAttribute('aria-invalid', 'true')
    expect(name).not.toHaveAttribute('aria-invalid')
    // Nothing was added, and nothing typed was lost.
    expect(list(PEOPLE).queryByRole('list')).toBeNull()
    expect(name).toHaveValue('Mum')

    await user.clear(phone)
    await user.type(phone, '(0161) 496.0000')
    await user.click(list(PEOPLE).getByRole('button', { name: `Add to ${PEOPLE}` }))
    expect(list(PEOPLE).queryByRole('alert')).toBeNull()
    expect(list(PEOPLE).getByRole('link', { name: 'Call Mum' })).toHaveAttribute('href', 'tel:01614960000')
  })

  it('changes a line, saved or cancelled, with focus back on its Edit', async () => {
    const user = userEvent.setup()
    render(<Harness plan={three} />)
    await user.click(list(HELPS).getByRole('button', { name: 'Edit A slow walk' }))
    const field = list(HELPS).getByRole('textbox', { name: 'Your words' })
    expect(field).toHaveFocus()
    expect(field).toHaveValue('A slow walk')
    await user.clear(field)
    await user.type(field, 'A walk by the canal')
    await user.click(list(HELPS).getByRole('button', { name: 'Save changes' }))
    expect(linesOf(HELPS)).toEqual(['A cup of tea', 'A walk by the canal', 'That one song'])
    expect(list(HELPS).getByRole('button', { name: 'Edit A walk by the canal' })).toHaveFocus()
    expect(said()).toHaveTextContent('Saved.')

    await user.click(list(HELPS).getByRole('button', { name: 'Edit A cup of tea' }))
    await user.type(list(HELPS).getByRole('textbox', { name: 'Your words' }), ' with honey')
    await user.click(list(HELPS).getByRole('button', { name: 'Cancel' }))
    expect(linesOf(HELPS)[0]).toBe('A cup of tea')
    expect(list(HELPS).getByRole('button', { name: 'Edit A cup of tea' })).toHaveFocus()
  })

  it('will not save a line emptied of words, which Remove is for', async () => {
    const user = userEvent.setup()
    render(<Harness plan={three} />)
    await user.click(list(HELPS).getByRole('button', { name: 'Edit A cup of tea' }))
    const field = list(HELPS).getByRole('textbox', { name: 'Your words' })
    await user.clear(field)
    await user.click(list(HELPS).getByRole('button', { name: 'Save changes' }))
    expect(list(HELPS).getByRole('alert')).toHaveTextContent('There are no words here yet.')
    expect(field).toHaveFocus()
    // Still open, and no line gone.
    expect(list(HELPS).getAllByRole('listitem')).toHaveLength(3)
    expect(field).toHaveValue('')
  })

  it('changes a person’s number, and says why one will not do', async () => {
    const user = userEvent.setup()
    render(<Harness plan={{ people: [{ id: 'sam', text: 'Sam', phone: '999' }] }} />)
    await user.click(list(PEOPLE).getByRole('button', { name: 'Edit Sam' }))
    const editor = within(list(PEOPLE).getByRole('listitem'))
    const phone = editor.getByRole('textbox', { name: 'Phone number (optional)' })
    expect(editor.getByRole('textbox', { name: 'Their name' })).toHaveValue('Sam')
    await user.clear(phone)
    await user.type(phone, '12')
    await user.click(editor.getByRole('button', { name: 'Save changes' }))
    expect(editor.getByRole('alert')).toHaveTextContent('That number looks too short to call.')
    expect(phone).toHaveFocus()
    await user.type(phone, '345')
    await user.click(editor.getByRole('button', { name: 'Save changes' }))
    expect(list(PEOPLE).getByRole('link', { name: 'Call Sam' })).toHaveAttribute('href', 'tel:12345')
  })

  it('moves lines up and down, with focus staying on the button pressed', async () => {
    const user = userEvent.setup()
    render(<Harness plan={three} />)
    const status = said()
    await user.click(list(HELPS).getByRole('button', { name: 'Move down A cup of tea' }))
    expect(linesOf(HELPS)).toEqual(['A slow walk', 'A cup of tea', 'That one song'])
    expect(list(HELPS).getByRole('button', { name: 'Move down A cup of tea' })).toHaveFocus()
    expect(status).toHaveTextContent('Moved down, now 2 of 3.')

    await user.click(list(HELPS).getByRole('button', { name: 'Move down A cup of tea' }))
    expect(linesOf(HELPS)).toEqual(['A slow walk', 'That one song', 'A cup of tea'])
    // At the end, it says it can go no further and does nothing.
    const atEnd = list(HELPS).getByRole('button', { name: 'Move down A cup of tea' })
    expect(atEnd).toHaveFocus()
    expect(atEnd).toHaveAttribute('aria-disabled', 'true')
    await user.click(atEnd)
    expect(linesOf(HELPS)).toEqual(['A slow walk', 'That one song', 'A cup of tea'])
    expect(atEnd).toHaveFocus()

    await user.click(list(HELPS).getByRole('button', { name: 'Move up That one song' }))
    expect(linesOf(HELPS)).toEqual(['That one song', 'A slow walk', 'A cup of tea'])
    expect(list(HELPS).getByRole('button', { name: 'Move up That one song' })).toHaveFocus()
    expect(list(HELPS).getByRole('button', { name: 'Move up That one song' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    expect(status).toHaveTextContent('Moved up, now 1 of 3.')
  })

  it('offers no moving while a list has one line', () => {
    render(<Harness plan={{ helps: [{ id: 'tea', text: 'A cup of tea' }] }} />)
    expect(list(HELPS).queryByRole('button', { name: /^Move/ })).toBeNull()
  })

  it('removes a line at once, with an Undo that puts it back where it was', async () => {
    const user = userEvent.setup()
    render(<Harness plan={three} />)
    await user.click(list(HELPS).getByRole('button', { name: 'Remove A slow walk' }))
    expect(linesOf(HELPS)).toEqual(['A cup of tea', 'That one song'])
    expect(screen.getByRole('heading', { level: 2, name: HELPS })).toHaveFocus()
    expect(screen.getByText('Removed “A slow walk”.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(linesOf(HELPS)).toEqual(['A cup of tea', 'A slow walk', 'That one song'])
    expect(list(HELPS).getByRole('button', { name: 'Edit A slow walk' })).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
  })

  it('quotes only the start of a long line as it offers Undo', async () => {
    const long = 'When it all feels like too much, I can sit with my back to a tree for a while'
    render(<Harness plan={{ kindWords: [{ id: 'long', text: long }] }} />)
    await userEvent.setup().click(screen.getByRole('button', { name: `Remove ${long}` }))
    expect(screen.getByText('Removed “When it all feels like too much, I can…”.')).toBeInTheDocument()
    // The last line gone, the example is back.
    expect(list('Kind words for myself').getByText(/^For example:/)).toBeInTheDocument()
  })

  it('keeps unsaved words through a remount: a new line, and a line being changed', async () => {
    const user = userEvent.setup()
    const first = render(<Harness plan={three} />)
    await user.type(list('Places that feel calm').getByRole('textbox', { name: 'A calm place' }), 'The window seat')
    await user.click(list(HELPS).getByRole('button', { name: 'Edit That one song' }))
    await user.type(list(HELPS).getByRole('textbox', { name: 'Your words' }), ', loud')
    first.unmount()

    render(<Harness plan={three} />)
    expect(list('Places that feel calm').getByRole('textbox', { name: 'A calm place' })).toHaveValue(
      'The window seat',
    )
    expect(list(HELPS).getByRole('textbox', { name: 'Your words' })).toHaveValue('That one song, loud')
    await user.click(list(HELPS).getByRole('button', { name: 'Save changes' }))
    expect(linesOf(HELPS)[2]).toBe('That one song, loud')
  })

  it('says when a list is full, in place of a field to add to it', () => {
    const full = Array.from({ length: COMFORT_ITEMS }, (_, index) => ({ id: `m${index}`, text: `Line ${index}` }))
    render(<Harness plan={{ matters: full }} />)
    const matters = list('What matters to me')
    expect(matters.queryByRole('button', { name: /^Add/ })).toBeNull()
    expect(matters.getByText(`This list keeps ${COMFORT_ITEMS} lines. Remove one to make room for another.`)).toBeInTheDocument()
  })

  it('goes back to the page that opened it', async () => {
    const onBack = vi.fn()
    const { unmount } = render(<Harness from="settings" onBack={onBack} />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Back to Settings' }))
    expect(onBack).toHaveBeenCalledOnce()
    unmount()
    render(<Harness from="today" />)
    expect(screen.getByRole('button', { name: 'Back to Today' })).toBeInTheDocument()
  })

  it('goes back to the garden when opened from a link', () => {
    render(<Harness />)
    expect(screen.getByRole('button', { name: 'Back to the garden' })).toBeInTheDocument()
  })
})
