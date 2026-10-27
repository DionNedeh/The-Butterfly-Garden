import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../lib/progression'
import type { AppState } from '../types'
import { SettingsView } from './SettingsView'

function renderSettings(state: AppState, onSetLetterQuotes?: (quotes: 'starred' | 'never') => void) {
  render(
    <SettingsView
      state={state}
      persistence={{ readOnly: false }}
      onUpdateProfile={vi.fn()}
      onSelectAmbientTrack={vi.fn()}
      onSelectBackdrop={vi.fn()}
      onExportGarden={vi.fn(() => ({ text: '{}' }))}
      onImportGarden={vi.fn(() => Promise.resolve({ ok: true, message: '' }))}
      onDeleteAll={vi.fn(() => Promise.resolve({ ok: true }))}
      onSetLetterQuotes={onSetLetterQuotes}
    />,
  )
}

describe('Settings: letters from Marigold', () => {
  const garden = createInitialState('Tester', 'Test Garden')

  it('quotes only starred lines at first, and can be told never to quote', async () => {
    const user = userEvent.setup()
    const onSetLetterQuotes = vi.fn()
    renderSettings(garden, onSetLetterQuotes)
    expect(screen.getByRole('heading', { name: 'Letters from Marigold' })).toBeInTheDocument()
    const group = screen.getByRole('group', { name: 'Quote my words in letters' })
    expect(within(group).getAllByRole('radio')).toHaveLength(2)
    // Each name starts with the words on screen, for voice control.
    const starred = within(group).getByRole('radio', { name: /^Only lines I star/ })
    expect(starred).toBeChecked()
    await user.click(within(group).getByRole('radio', { name: /^Never/ }))
    expect(onSetLetterQuotes).toHaveBeenLastCalledWith('never')
  })

  it('shows never as chosen, and goes back to starred lines', async () => {
    const user = userEvent.setup()
    const onSetLetterQuotes = vi.fn()
    renderSettings(
      { ...garden, profile: { ...garden.profile!, letterQuotes: 'never' } },
      onSetLetterQuotes,
    )
    const group = screen.getByRole('group', { name: 'Quote my words in letters' })
    expect(within(group).getByRole('radio', { name: /^Never/ })).toBeChecked()
    await user.click(within(group).getByRole('radio', { name: /^Only lines I star/ }))
    expect(onSetLetterQuotes).toHaveBeenLastCalledWith('starred')
  })

  it('has no choice where it cannot be changed', () => {
    renderSettings(garden)
    expect(screen.queryByRole('group', { name: 'Quote my words in letters' })).toBeNull()
  })
})
