import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { placeJar, removeJarPlacement } from '../../lib/jars'
import { createEmptyState } from '../../lib/progression'
import type { AppState, JarColorId, JarInstance } from '../../types'
import { JarManager } from './JarManager'

const jar = (id: string, character = 'A', colorId: JarColorId = 'blue'): JarInstance => ({
  id,
  character,
  colorId,
  purchasedAt: '2026-10-27T12:00:00.000Z',
})

function garden(overrides: Partial<AppState> = {}): AppState {
  return {
    ...createEmptyState(),
    plants: [
      { id: 'milkweed-1', plantId: 'milkweed', growth: 3, plantedAt: '2026-10-01T12:00:00.000Z' },
      { id: 'aster-1', plantId: 'aster', growth: 3, plantedAt: '2026-10-01T12:00:00.000Z' },
    ],
    ...overrides,
  }
}

/** Milkweed's jar panel over a garden that changes as the real reducers say. */
function renderPanel(initial: AppState, visible = true) {
  const latest = { current: initial }
  function Live() {
    const [state, setState] = useState(initial)
    const run = (reducer: (current: AppState) => AppState) => {
      latest.current = reducer(latest.current)
      setState(latest.current)
    }
    return (
      <JarManager
        state={state}
        plantId="milkweed-1"
        plantName="Milkweed"
        visible={visible}
        onPlaceJar={(jarId, plantId) => run((current) => placeJar(current, jarId, plantId))}
        onRemoveJarPlacement={(plantId) => run((current) => removeJarPlacement(current, plantId))}
      />
    )
  }
  render(<Live />)
  return { garden: latest, user: userEvent.setup() }
}

const available = () => within(screen.getByRole('group', { name: 'Available jars' }))

describe('a plant’s jar panel', () => {
  it('offers alike jars as one button, which places one of them', async () => {
    const { garden: live, user } = renderPanel(
      garden({ jars: [jar('a1'), jar('a2'), jar('a3'), jar('s1', 'S', 'yellow')] }),
    )
    expect(available().getAllByRole('button')).toHaveLength(2)
    const stack = available().getByRole('button', {
      name: 'Place Blue A jar on Milkweed, 3 on the shelf',
    })
    expect(stack).toHaveTextContent('PlaceBlue ×3')
    expect(available().getByRole('button', { name: 'Place Yellow S jar on Milkweed' })).toBeInTheDocument()
    expect(screen.getByText('4 to place')).toBeInTheDocument()

    await user.click(stack)
    // The first of the stack goes onto the plant.
    expect(live.current.jarPlacements).toEqual([{ jarId: 'a1', plantId: 'milkweed-1' }])
    expect(screen.getByText('Blue A jar')).toBeInTheDocument()
    const fewer = available().getByRole('button', {
      name: 'Place Blue A jar on Milkweed, 2 on the shelf',
    })
    // The same button, two left: focus stays where it was.
    expect(fewer).toBe(stack)
    expect(fewer).toHaveFocus()
    expect(screen.getByText('3 to place')).toBeInTheDocument()
  })

  it('names each button by the words it shows first', () => {
    renderPanel(garden({ jars: [jar('a1'), jar('a2')] }))
    for (const button of available().getAllByRole('button')) {
      const shown = button.querySelector('span:not([aria-hidden])')?.textContent ?? '-'
      expect(button.getAttribute('aria-label')?.startsWith(shown)).toBe(true)
    }
  })

  it('moves focus to Return to inventory when the last of a stack is placed, and back after', async () => {
    const { garden: live, user } = renderPanel(garden({ jars: [jar('a1')] }))
    await user.click(available().getByRole('button', { name: 'Place Blue A jar on Milkweed' }))
    const back = screen.getByRole('button', { name: 'Return to inventory' })
    expect(back).toHaveFocus()

    await user.click(back)
    expect(live.current.jarPlacements).toEqual([])
    expect(screen.getByText(/This plant spot is empty/)).toHaveTextContent('1 of your jars is not on a plant yet.')
    expect(available().getByRole('button', { name: 'Place Blue A jar on Milkweed' })).toHaveFocus()
  })

  it('keeps a jar on another plant to a button of its own, saying where it comes from', async () => {
    const { garden: live, user } = renderPanel(
      garden({
        jars: [jar('a1'), jar('a2')],
        jarPlacements: [{ jarId: 'a2', plantId: 'aster-1' }],
      }),
    )
    const move = available().getByRole('button', { name: 'Move from Aster Blue A jar on Milkweed' })
    expect(move).toHaveTextContent('Move from AsterBlue')
    expect(available().getByRole('button', { name: 'Place Blue A jar on Milkweed' })).toBeInTheDocument()

    await user.click(move)
    expect(live.current.jarPlacements).toEqual([{ jarId: 'a2', plantId: 'milkweed-1' }])
    expect(screen.getByRole('button', { name: 'Return to inventory' })).toHaveFocus()
    // Every jar placed in the garden, by where it sits.
    await user.click(screen.getByText('Placed jars (1)'))
    expect(screen.getByText('Blue A on Milkweed')).toBeInTheDocument()
  })

  it('tells a "!" jar from a "?" jar in every name it gives them', async () => {
    const { user } = renderPanel(
      garden({
        jars: [jar('x1', '!'), jar('q1', '?'), jar('q2', '?')],
        jarPlacements: [
          { jarId: 'x1', plantId: 'milkweed-1' },
          { jarId: 'q2', plantId: 'aster-1' },
        ],
      }),
    )
    // The jar on this plant: its glyph shown, its name said.
    const here = screen.getByText('Placed on this plant spot.').previousElementSibling as HTMLElement
    expect(here).toHaveTextContent('Blue !exclamation mark jar')
    expect(within(here).getByText('!')).toHaveAttribute('aria-hidden', 'true')
    expect(within(here).getByText('exclamation mark')).toHaveClass('sr-only')
    expect(
      available().getByRole('button', { name: 'Place Blue question mark jar on Milkweed' }),
    ).toBeInTheDocument()
    expect(
      available().getByRole('button', { name: 'Move from Aster Blue question mark jar on Milkweed' }),
    ).toBeInTheDocument()
    await user.click(screen.getByText('Placed jars (2)'))
    const placed = screen.getAllByRole('listitem')
    expect(placed.map((item) => item.textContent)).toEqual([
      '!Blue !exclamation mark on Milkweed',
      '?Blue ?question mark on Aster',
    ])
    expect(within(placed[1]).getByText('question mark')).toHaveClass('sr-only')
  })

  it('says when there is nothing to place, and why', () => {
    renderPanel(garden())
    expect(
      screen.getByText(
        'No jars are waiting in inventory. Buy letters and numbers in the Shop with Nectar.',
      ),
    ).toBeInTheDocument()
  })

  it('says when every other jar is already here', () => {
    renderPanel(garden({ jars: [jar('a1')], jarPlacements: [{ jarId: 'a1', plantId: 'milkweed-1' }] }))
    expect(screen.getByText('No other jars are ready to place here.')).toBeInTheDocument()
  })

  it('places nothing on a plant beyond the eight the scene shows', () => {
    renderPanel(garden({ jars: [jar('a1')] }), false)
    expect(screen.getByText(/Jars can be placed on the eight visible garden spots/)).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Available jars' })).toBeNull()
  })
})
