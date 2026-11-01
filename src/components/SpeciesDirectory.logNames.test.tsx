import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../lib/progression'
import { GuideView } from './GuideView'

function renderGuide() {
  render(
    <GuideView
      state={createInitialState('Tester', 'Wild Garden')}
      onShowSeed={vi.fn()}
      onChangeSightings={() => false}
    />,
  )
}

function speciesCard(name: string) {
  return screen.getByRole('heading', { level: 3, name }).closest('article')!
}

/** Each "Log" button on a card, by the words it shows. */
function logButtons(card: HTMLElement) {
  return within(card)
    .getAllByRole('button', { name: /^Log / })
    .map((button) => button.textContent)
}

describe('a species card says what each of its sighting buttons logs', () => {
  it('names the host plant beside its seed, and the butterfly below', () => {
    renderGuide()
    const card = speciesCard('Monarch')
    expect(logButtons(card)).toEqual(['Log Milkweed', 'Log a Monarch sighting'])
    // The plant's sits beside the seed it grows from.
    const plant = within(card).getByRole('button', { name: 'Log Milkweed' })
    expect(plant.closest('.species-plant-actions')).toContainElement(
      within(card).getByRole('button', { name: 'Show Milkweed seed' }),
    )
  })

  it('says "an" before a butterfly whose name begins with a vowel', () => {
    renderGuide()
    expect(logButtons(speciesCard('Eastern Tiger Swallowtail'))).toContain(
      'Log an Eastern Tiger Swallowtail sighting',
    )
    expect(logButtons(speciesCard('American Lady'))).toContain('Log an American Lady sighting')
  })

  it('never shows two buttons alike on a card, and is named by what it shows', () => {
    renderGuide()
    for (const card of screen.getAllByRole('article')) {
      const buttons = within(card).queryAllByRole('button', { name: /^Log / })
      const names = buttons.map((button) => button.textContent)
      expect(new Set(names).size).toBe(names.length)
      for (const button of buttons) expect(button).not.toHaveAttribute('aria-label')
    }
  })
})
