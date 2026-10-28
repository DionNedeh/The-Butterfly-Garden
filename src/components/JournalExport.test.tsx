import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { saveTextFile, type SaveOutcome } from '../lib/download'
import { createInitialState } from '../lib/progression'
import type { AppState, MoodEntry, ReflectionEntry } from '../types'
import { JournalExport } from './JournalExport'

vi.mock('../lib/download', () => ({
  saveTextFile: vi.fn(),
  datedFileName: (what: string, extension: string) => `${what}.${extension}`,
}))

const save = vi.mocked(saveTextFile)

afterEach(() => {
  save.mockReset()
})

const MOOD: MoodEntry = {
  id: 'mood-2026-01-01',
  localDate: '2026-01-01',
  level: 4,
  note: 'Felt calm after the walk.',
  createdAt: '2026-01-01T09:00:00.000Z',
  updatedAt: '2026-01-01T09:00:00.000Z',
}

const REFLECTION: ReflectionEntry = {
  id: 'reflection-2026-01-01',
  localDate: '2026-01-01',
  promptId: 'notice',
  body: 'The light on the kitchen wall.',
  createdAt: '2026-01-01T21:00:00.000Z',
  updatedAt: '2026-01-01T21:00:00.000Z',
}

function garden(
  entries: Partial<Pick<AppState, 'moods' | 'reflections' | 'recaps'>> = {},
): AppState {
  return { ...createInitialState('Tester', 'Test Garden'), ...entries }
}

function renderExport(state = garden({ moods: [MOOD], reflections: [REFLECTION] })) {
  render(<JournalExport state={state} />)
  return userEvent.setup()
}

/** A save that stays open until the test settles it. */
function pendingSave() {
  let settle!: (outcome: SaveOutcome) => void
  save.mockReturnValueOnce(
    new Promise<SaveOutcome>((resolve) => {
      settle = resolve
    }),
  )
  return (outcome: SaveOutcome) => settle(outcome)
}

const status = () => screen.getByRole('status')

describe('JournalExport', () => {
  it('says the journal is empty rather than offering empty files', () => {
    renderExport(garden())

    expect(screen.getByRole('heading', { name: 'Take your words with you' })).toBeInTheDocument()
    expect(screen.getByText(/There is nothing in your journal yet/)).toBeInTheDocument()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it.each([
    {
      button: 'Journal as Markdown',
      file: 'journal.md',
      mimeType: 'text/markdown',
      start: /^# Test Garden journal\n/,
      outcome: 'started' as const,
      said: 'Your download has started.',
    },
    {
      button: 'Printable journal (HTML)',
      file: 'journal.html',
      mimeType: 'text/html',
      start: /^<!doctype html>\n/,
      outcome: 'saved' as const,
      said: 'Saved.',
    },
    {
      button: 'Check-ins as CSV',
      file: 'check-ins.csv',
      mimeType: 'text/csv',
      start: /^\uFEFF"date","weather","note","feelings","energy","written later"\r\n/,
      outcome: 'cancelled' as const,
      said: 'Nothing was saved.',
    },
  ])('saves $button and says only what is known of it', async (format) => {
    const user = renderExport()
    save.mockResolvedValueOnce(format.outcome)

    await user.click(screen.getByRole('button', { name: format.button }))

    // The builders load with the first copy asked for, so the save follows a beat later.
    await waitFor(() => expect(status()).toHaveTextContent(format.said))
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith(format.file, format.mimeType, expect.stringMatching(format.start))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('holds every button while a save is open, keeping focus where it was', async () => {
    const user = renderExport()
    const markdown = screen.getByRole('button', { name: 'Journal as Markdown' })
    save.mockResolvedValueOnce('started')
    await user.click(markdown)
    await waitFor(() => expect(status()).toHaveTextContent('Your download has started.'))

    const settle = pendingSave()
    await user.click(markdown)

    for (const button of screen.getAllByRole('button')) {
      expect(button).toHaveAttribute('aria-disabled', 'true')
    }
    expect(markdown).toHaveFocus()
    // The earlier outcome is cleared, so the same words again are announced again.
    expect(status()).toBeEmptyDOMElement()

    await user.click(screen.getByRole('button', { name: 'Check-ins as CSV' }))
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2))

    settle('started')
    expect(await screen.findByText('Your download has started.')).toBe(status())
    for (const button of screen.getAllByRole('button')) {
      expect(button).not.toHaveAttribute('aria-disabled')
    }
  })

  it('says so out loud when a file cannot be saved, and lets the gardener try again', async () => {
    const user = renderExport()
    save.mockRejectedValueOnce(new Error('No space left'))

    await user.click(screen.getByRole('button', { name: 'Printable journal (HTML)' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('That file could not be saved.')
    expect(status()).toBeEmptyDOMElement()
    expect(screen.getByRole('button', { name: 'Printable journal (HTML)' })).not.toHaveAttribute(
      'aria-disabled',
    )

    save.mockResolvedValueOnce('saved')
    await user.click(screen.getByRole('button', { name: 'Printable journal (HTML)' }))
    await waitFor(() => expect(status()).toHaveTextContent('Saved.'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('leaves out the spreadsheet until there is a check-in to put in it', () => {
    renderExport(garden({ reflections: [REFLECTION] }))

    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Journal as Markdown',
      'Printable journal (HTML)',
    ])
    expect(screen.getByText(/as a spreadsheet once you have made one/)).toBeInTheDocument()
  })
})
