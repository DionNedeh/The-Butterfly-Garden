import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../lib/progression'
import type { CreatureInstance } from '../types'
import { NameArrival } from './NameArrival'

const starter = createInitialState('Tester', 'Test Garden').creatures[0]
const egg: CreatureInstance = {
  ...starter,
  id: 'egg',
  speciesId: 'monarch',
  name: 'Clover',
  stage: 'egg',
  awaitingName: true,
}

function renderOffer(creatures: CreatureInstance[] = [starter, egg], arrival = egg) {
  const onName = vi.fn()
  render(<NameArrival arrival={arrival} creatures={creatures} onName={onName} />)
  return { onName, field: screen.getByRole('textbox', { name: 'Name' }) }
}

describe('NameArrival', () => {
  it('offers to name the egg, filled in with the name it already has', () => {
    const { field } = renderOffer()
    expect(
      screen.getByRole('region', { name: 'Would you like to name your monarch egg?' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/For now it is called Clover/)).toBeInTheDocument()
    expect(field).toHaveValue('Clover')
  })

  it('saves the name the gardener chooses, trimmed', async () => {
    const user = userEvent.setup()
    const { onName, field } = renderOffer()
    await user.clear(field)
    await user.type(field, '  Pip  ')
    await user.click(screen.getByRole('button', { name: 'Save name' }))
    expect(onName).toHaveBeenCalledWith('Pip')
  })

  it('keeps the name the egg came with, from its button or an emptied field', async () => {
    const user = userEvent.setup()
    const { onName, field } = renderOffer()
    await user.click(screen.getByRole('button', { name: 'Keep Clover' }))
    expect(onName).toHaveBeenLastCalledWith('Clover')

    await user.clear(field)
    await user.keyboard('{Enter}')
    expect(onName).toHaveBeenLastCalledWith('Clover')
    expect(onName).toHaveBeenCalledTimes(2)
  })

  it('says so, without stopping the gardener, when another companion has the name', async () => {
    const user = userEvent.setup()
    const { onName, field } = renderOffer()
    expect(screen.queryByText(/already called/)).not.toBeInTheDocument()
    expect(field).not.toHaveAttribute('aria-describedby')

    await user.clear(field)
    await user.type(field, ' sol')
    const note = screen.getByText('Another companion is already called sol. Two can share a name if you like.')
    expect(field).toHaveAttribute('aria-describedby', note.id)

    await user.click(screen.getByRole('button', { name: 'Save name' }))
    expect(onName).toHaveBeenCalledWith('sol')
  })

  it('suggests a free name when its own is now shared with another companion', () => {
    const twin = { ...egg, name: 'Sol' }
    const { field } = renderOffer([starter, twin], twin)
    expect(field).not.toHaveValue('Sol')
    expect(screen.queryByText(/already called/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Keep Sol' })).toBeInTheDocument()
  })
})
