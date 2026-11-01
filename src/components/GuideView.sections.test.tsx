import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../lib/progression'
import { GuideView } from './GuideView'

function renderGuide() {
  const onOpenSection = vi.fn()
  render(
    <GuideView
      state={createInitialState('Tester', 'Test Garden')}
      onShowSeed={vi.fn()}
      onOpenSection={onOpenSection}
    />,
  )
  return { onOpenSection, contents: within(screen.getByRole('navigation', { name: 'In this guide' })) }
}

/** A section's card, found by its heading. */
function card(title: string) {
  return screen.getByRole('heading', { level: 2, name: title }).closest('section')!
}

afterEach(() => {
  vi.unstubAllEnvs()
})

// The whole Guide drawn and clicked through: about 2.7 s on CI, and past
// the default 5 s on a busy machine, like the Guide's other long tests.
describe('5.11 Guide sections for what the garden gained', { timeout: 20_000 }, () => {
  const added: ReadonlyArray<readonly [string, string, string]> = [
    ['Letters and your year', 'letters-and-year', 'Letters from Marigold, and your garden’s year'],
    ['Field book', 'field-book', 'Your field book'],
    ['Calendar reminders', 'reminders', 'Reminders in your calendar'],
    ['Comfort plan', 'comfort-plan', 'Your comfort plan'],
    ['Night and seasons', 'night-and-seasons', 'The night garden and the seasons'],
    ['Backups and moving', 'backups', 'Backups, earlier copies, and moving to a new device'],
    ['Lock and protected backups', 'lock', 'Locking your garden, and protected backups'],
  ]

  it('reaches each from the contents, at its own address', async () => {
    const user = userEvent.setup()
    const { contents, onOpenSection } = renderGuide()
    for (const [short, id, title] of added) {
      const link = contents.getByRole('link', { name: short })
      expect(link).toHaveAttribute('href', `#/guide/${id}`)
      await user.click(link)
      expect(onOpenSection).toHaveBeenLastCalledWith(id)
      expect(screen.getByRole('heading', { level: 2, name: title })).toHaveFocus()
    }
  })

  it('says what letters quote, and that the postcard leaves only by a tap', () => {
    renderGuide()
    const letters = within(card('Letters from Marigold, and your garden’s year'))
    expect(letters.getByText(/quotes only lines you star/)).toBeInTheDocument()
    expect(letters.getByText(/Choose Never in Settings/)).toBeInTheDocument()
    expect(letters.getByText(/goes nowhere unless you tap to share or save it/)).toBeInTheDocument()
  })

  it('gives the field book’s limits, and keeps where a photo was taken out of it', () => {
    renderGuide()
    const book = within(card('Your field book'))
    expect(book.getByText(/up to 2,000 sightings and 50 photos/)).toBeInTheDocument()
    expect(book.getByText(/nothing about where it was taken is kept/)).toBeInTheDocument()
    expect(book.getByText(/Sightings earn nothing/)).toBeInTheDocument()
  })

  it('says the comfort plan is private, never quoted, and no medical plan', () => {
    renderGuide()
    const plan = within(card('Your comfort plan'))
    expect(plan.getByText(/never quotes it or shows it anywhere else/)).toBeInTheDocument()
    expect(plan.getByText(/not a medical or crisis plan/)).toBeInTheDocument()
  })

  it('names the 12 words, earlier copies and, in a browser, the backup file kept up to date', () => {
    renderGuide()
    const backups = within(card('Backups, earlier copies, and moving to a new device'))
    expect(backups.getByText(/shown as 12 words/)).toBeInTheDocument()
    expect(backups.getByText(/up to seven, and the two from before a restore/)).toBeInTheDocument()
    expect(backups.getByText(/choose a backup file once/)).toBeInTheDocument()
    expect(backups.getByText(/if the site’s storage is cleared/)).toBeInTheDocument()
  })

  it('says what the lock does not do, and offers a passkey only in a browser', () => {
    renderGuide()
    const lock = within(card('Locking your garden, and protected backups'))
    expect(lock.getByText(/stores in this browser sealed with a passcode/)).toBeInTheDocument()
    expect(lock.getByText(/a passkey can open it too/)).toBeInTheDocument()
    expect(lock.getByText(/The lock cannot protect the garden while it is open/)).toBeInTheDocument()
    expect(lock.getByText(/Backups you download are not locked/)).toBeInTheDocument()
    expect(lock.getByText(/A protected backup is the usual backup file/)).toBeInTheDocument()
    // The privacy section points to it.
    expect(within(card('Privacy, backdrops, and starting over')).getByText(/Lock my garden/)).toBeInTheDocument()
  })

  it('speaks of the app on the phone in the Android build', () => {
    vi.stubEnv('VITE_PLATFORM', 'android')
    renderGuide()
    const lock = within(card('Locking your garden, and protected backups'))
    expect(lock.getByText(/stores on this phone sealed with a passcode/)).toBeInTheDocument()
    expect(lock.queryByText(/passkey/)).toBeNull()
    expect(lock.getByText(/Backups you save are not locked/)).toBeInTheDocument()
    const backups = within(card('Backups, earlier copies, and moving to a new device'))
    // The app keeps no file up to date; its copies live in the app.
    expect(backups.queryByText(/choose a backup file once/)).toBeNull()
    expect(backups.getByText(/if the app is uninstalled or its storage cleared/)).toBeInTheDocument()
    expect(within(card('Reminders in your calendar')).getByText(/The app saves a calendar file/)).toBeInTheDocument()
  })

  it('finds the new sections by their words', async () => {
    const user = userEvent.setup()
    renderGuide()
    await user.type(screen.getByRole('searchbox', { name: 'Search the guide' }), 'recovery code')
    expect(screen.getByRole('heading', { level: 2, name: 'Locking your garden, and protected backups' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 2, name: 'Letter jars' })).toBeNull()
  })
})
