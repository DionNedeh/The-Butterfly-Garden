import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { feelings } from '../../data/feelings'
import { MAX_FEELINGS } from '../../lib/feelings'
import type { EnergyLevel } from '../../types'
import { CheckInExtras } from './CheckInExtras'

/** The extras with their answers held, as Today holds them. */
function Harness({
  initialFeelings = [],
  initialEnergy,
}: {
  initialFeelings?: readonly string[]
  initialEnergy?: EnergyLevel
}) {
  const [chosen, setChosen] = useState(initialFeelings)
  const [energy, setEnergy] = useState(initialEnergy)
  return (
    <CheckInExtras
      feelings={chosen}
      energy={energy}
      onFeelingsChange={setChosen}
      onEnergyChange={setEnergy}
    />
  )
}

async function openExtras() {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Add feelings or energy' }))
  return user
}

describe('the check-in’s extras', () => {
  it('welcomes every weather, and starts folded with nothing chosen', () => {
    render(<Harness />)
    expect(screen.getByText('All weather is welcome.')).toBeInTheDocument()
    const toggle = screen.getByRole('button', { name: 'Add feelings or energy' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('group', { name: 'Feelings' })).toBeNull()
    expect(screen.queryByRole('group', { name: 'Energy' })).toBeNull()
  })

  it('unfolds to every feeling word, each a toggle, none pressed', async () => {
    render(<Harness />)
    await openExtras()
    expect(screen.getByRole('button', { name: 'Add feelings or energy' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    const group = screen.getByRole('group', { name: 'Feelings' })
    const chips = within(group).getAllByRole('button')
    expect(chips.map((chip) => chip.textContent)).toEqual(feelings.map((feeling) => feeling.name))
    for (const chip of chips) expect(chip).toHaveAttribute('aria-pressed', 'false')
    expect(within(group).getByText('Choose up to five words, or none.')).toBeInTheDocument()
  })

  it('chooses and unchooses a feeling', async () => {
    render(<Harness />)
    const user = await openExtras()
    const tired = screen.getByRole('button', { name: 'tired' })
    await user.click(tired)
    expect(tired).toHaveAttribute('aria-pressed', 'true')
    await user.click(tired)
    expect(tired).toHaveAttribute('aria-pressed', 'false')
  })

  it('says so at the limit, rather than silently refusing another', async () => {
    const full = feelings.slice(0, MAX_FEELINGS).map((feeling) => feeling.id)
    const onFeelingsChange = vi.fn()
    render(<CheckInExtras feelings={full} onFeelingsChange={onFeelingsChange} onEnergyChange={vi.fn()} />)
    const user = await openExtras()

    expect(
      screen.getByText(
        'That’s five words, as many as one check-in holds. Unchoose one to choose another.',
      ),
    ).toBeInTheDocument()
    const another = screen.getByRole('button', { name: 'tired' })
    expect(another).toHaveAttribute('aria-disabled', 'true')
    await user.click(another)
    expect(onFeelingsChange).not.toHaveBeenCalled()
    // One already chosen can still be unchosen.
    const first = screen.getByRole('button', { name: feelings[0].name })
    expect(first).not.toHaveAttribute('aria-disabled')
    await user.click(first)
    expect(onFeelingsChange).toHaveBeenCalledWith(full.slice(1))
  })

  it('takes one energy, and can be cleared again with focus kept in the question', async () => {
    render(<Harness />)
    const user = await openExtras()
    const energy = screen.getByRole('group', { name: 'Energy' })
    const radios = within(energy).getAllByRole('radio')
    expect(radios.map((radio) => radio.getAttribute('value'))).toEqual(['low', 'steady', 'bright'])
    for (const radio of radios) expect(radio).not.toBeChecked()
    expect(screen.queryByRole('button', { name: 'Clear energy' })).toBeNull()

    await user.click(screen.getByRole('radio', { name: 'steady' }))
    expect(screen.getByRole('radio', { name: 'steady' })).toBeChecked()

    await user.click(screen.getByRole('button', { name: 'Clear energy' }))
    for (const radio of radios) expect(radio).not.toBeChecked()
    expect(screen.queryByRole('button', { name: 'Clear energy' })).toBeNull()
    expect(screen.getByRole('radio', { name: 'low' })).toHaveFocus()
  })

  it('says what was chosen while folded', async () => {
    render(<Harness initialFeelings={['hopeful', 'tired']} initialEnergy="low" />)
    expect(screen.getByText('Feeling hopeful, tired · Energy low')).toBeInTheDocument()
    await openExtras()
    // Unfolded, the chips say it themselves.
    expect(screen.queryByText('Feeling hopeful, tired · Energy low')).toBeNull()
    expect(screen.getByRole('button', { name: 'hopeful' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('radio', { name: 'low' })).toBeChecked()
  })
})
