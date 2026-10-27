import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../lib/progression'
import type { AppState } from '../types'
import { SettingsView } from './SettingsView'

function renderSettings(state: AppState, onOpenComfort?: () => void) {
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
      onOpenSupport={vi.fn()}
      onOpenComfort={onOpenComfort}
    />,
  )
}

/** The About card, which also reaches the support page. */
function about() {
  return within(screen.getByRole('region', { name: /^The Butterfly Garden/ }))
}

describe('Settings: the comfort plan', () => {
  const garden = createInitialState('Tester', 'Test Garden')

  it('is offered beside the support page, to be written', async () => {
    const onOpenComfort = vi.fn()
    renderSettings(garden, onOpenComfort)
    expect(about().getByRole('button', { name: 'If you need support now' })).toBeInTheDocument()
    const link = about().getByRole('link', { name: 'Write a comfort plan' })
    expect(link).toHaveAttribute('href', '#/comfort')
    await userEvent.setup().click(link)
    expect(onOpenComfort).toHaveBeenCalledOnce()
  })

  it('is named as the gardener’s own once something is in it, and never quoted', () => {
    renderSettings(
      {
        ...garden,
        profile: {
          ...garden.profile!,
          comfortPlan: { kindWords: [{ id: 'kind', text: 'I am doing my best' }] },
        },
      },
      vi.fn(),
    )
    expect(about().getByRole('link', { name: 'Your comfort plan' })).toBeInTheDocument()
    expect(screen.queryByText(/I am doing my best/)).toBeNull()
  })

  it('is not offered where it cannot be opened', () => {
    renderSettings(garden)
    expect(screen.queryByRole('link', { name: /comfort plan/ })).toBeNull()
  })
})
