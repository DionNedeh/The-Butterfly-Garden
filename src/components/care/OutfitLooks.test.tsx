import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MAX_OUTFIT_PRESETS } from '../../lib/companionDiary'
import {
  deleteOutfitPreset,
  renameOutfitPreset,
  restoreOutfitPreset,
  saveOutfitPreset,
} from '../../lib/outfitPresets'
import { createInitialState } from '../../lib/progression'
import { equipOutfitItem, wearOutfitPreset } from '../../lib/wardrobe'
import type { AppState, CreatureInstance, OutfitPreset } from '../../types'
import { UNDO_MS } from '../UndoToast'
import { OutfitLooks } from './OutfitLooks'

/**
 * Sol, a caterpillar in a cap, and Fern, an egg, sharing one closet, with
 * these looks kept in the profile, where they are stored.
 */
function garden(looks?: OutfitPreset[]): AppState {
  const base = createInitialState('Tester', 'Test Garden')
  const sol: CreatureInstance = { ...base.creatures[0], id: 'sol', outfit: { headwear: 'sprout-cap' } }
  const fern: CreatureInstance = { ...sol, id: 'fern', name: 'Fern', stage: 'egg', outfit: {} }
  return {
    ...base,
    profile: looks ? { ...base.profile!, outfitPresets: looks } : base.profile,
    creatures: [sol, fern],
    ownedItemIds: ['sprout-cap', 'silk-bow'],
  }
}

/** The saved looks over a garden that really changes, as Care's would. */
function Looks({ initial, creatureId = 'sol' }: { initial: AppState; creatureId?: string }) {
  const [state, setState] = useState(initial)
  const creature = state.creatures.find((entry) => entry.id === creatureId)!
  return (
    <>
      <button onClick={() => setState((current) => equipOutfitItem(current, creatureId, 'silk-bow'))}>
        Put on the bow
      </button>
      <OutfitLooks
        creature={creature}
        presets={state.profile?.outfitPresets ?? []}
        onSave={(id, name) => setState((current) => saveOutfitPreset(current, id, name))}
        onWear={(id, presetId) => {
          const { state: next, ...outcome } = wearOutfitPreset(state, id, presetId)
          setState(next)
          return outcome
        }}
        onRename={(presetId, name) => setState((current) => renameOutfitPreset(current, presetId, name))}
        onDelete={(presetId) => setState((current) => deleteOutfitPreset(current, presetId))}
        onRestore={(preset, index) =>
          setState((current) => restoreOutfitPreset(current, preset, index))
        }
      />
      <output data-testid="outfit">{JSON.stringify(creature.outfit)}</output>
    </>
  )
}

const sunday = { id: 'sunday', name: 'Sunday best', outfit: { headwear: 'sprout-cap', accessory: 'silk-bow' } }
const heading = () => screen.getByRole('heading', { name: 'Saved looks' })
const status = () => document.querySelector('.look-status')

afterEach(() => {
  vi.useRealTimers()
})

describe('saving a look', () => {
  it('names it as suggested, saves it, and says so', async () => {
    const user = userEvent.setup()
    render(<Looks initial={garden()} />)
    expect(screen.getByText('A saved look can be put on any companion in one go.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save this look' }))
    const field = screen.getByRole('textbox', { name: 'Name this look' })
    expect(field).toHaveFocus()
    expect(field).toHaveValue('Sol’s look')
    await user.clear(field)
    await user.type(field, 'Little cap')
    await user.click(screen.getByRole('button', { name: 'Save look' }))

    expect(within(screen.getByRole('list', { name: 'Saved looks' })).getByText('Little cap')).toBeInTheDocument()
    expect(screen.getByText('Sprout Cap')).toBeInTheDocument()
    expect(status()).toHaveTextContent('Saved Sol’s outfit as Little cap.')
    // The form went with its button; focus did not fall to the page.
    expect(heading()).toHaveFocus()
    // This very outfit is saved now, so there is nothing more to save.
    expect(screen.getByText('Sol’s outfit is saved as Little cap.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save this look' })).toBeNull()
  })

  it('saves nothing when the outfit came off while the form was open', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const sol = garden().creatures[0]
    const props = {
      presets: [],
      onSave,
      onWear: vi.fn(() => ({ worn: [], skipped: [] })),
      onRename: vi.fn(),
      onDelete: vi.fn(),
      onRestore: vi.fn(),
    }
    const { rerender } = render(<OutfitLooks creature={sol} {...props} />)
    await user.click(screen.getByRole('button', { name: 'Save this look' }))
    rerender(<OutfitLooks creature={{ ...sol, outfit: {} }} {...props} />)
    await user.click(screen.getByRole('button', { name: 'Save look' }))
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByText(/Dress Sol in something/)).toBeInTheDocument()
    expect(heading()).toHaveFocus()
  })

  it('takes the suggested name when the field is emptied', async () => {
    const user = userEvent.setup()
    render(<Looks initial={garden()} />)
    await user.click(screen.getByRole('button', { name: 'Save this look' }))
    await user.clear(screen.getByRole('textbox', { name: 'Name this look' }))
    await user.click(screen.getByRole('button', { name: 'Save look' }))
    expect(status()).toHaveTextContent('Saved Sol’s outfit as Sol’s look.')
  })

  it('cancels back to the button that opened it', async () => {
    const user = userEvent.setup()
    render(<Looks initial={garden()} />)
    await user.click(screen.getByRole('button', { name: 'Save this look' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.getByRole('button', { name: 'Save this look' })).toHaveFocus()
  })

  it('asks for something to be worn first', () => {
    render(<Looks initial={garden()} creatureId="fern" />)
    expect(screen.queryByRole('button', { name: 'Save this look' })).toBeNull()
    expect(screen.getByText(/Dress Fern in something/)).toBeInTheDocument()
  })

  it('says why a full closet saves no more, and saves nothing', async () => {
    const user = userEvent.setup()
    const looks = Array.from({ length: MAX_OUTFIT_PRESETS }, (_, index) => ({
      id: `look-${index}`,
      name: `Look ${index}`,
      outfit: { aura: 'sparkle-aura' },
    }))
    render(<Looks initial={garden(looks)} />)
    const save = screen.getByRole('button', { name: 'Save this look' })
    expect(save).toHaveAttribute('aria-disabled', 'true')
    expect(save).toHaveAccessibleDescription(
      `The closet keeps ${MAX_OUTFIT_PRESETS} looks. Delete one to save another.`,
    )
    await user.click(save)
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('closes a form opened for one companion when another is chosen', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<Looks initial={garden()} />)
    await user.click(screen.getByRole('button', { name: 'Save this look' }))
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    rerender(<Looks initial={garden()} creatureId="fern" />)
    // The form was for Sol's outfit; Fern's wardrobe opens without it.
    expect(screen.queryByRole('textbox', { name: 'Name this look' })).toBeNull()
    // Back on Sol it stays closed, and a fresh one takes focus as it opens.
    rerender(<Looks initial={garden()} />)
    expect(screen.queryByRole('textbox', { name: 'Name this look' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Save this look' }))
    expect(screen.getByRole('textbox', { name: 'Name this look' })).toHaveFocus()
  })
})

describe('wearing a saved look', () => {
  it('puts it on, naming what was left off and why', async () => {
    const user = userEvent.setup()
    render(<Looks initial={garden([sunday])} creatureId="fern" />)
    const wear = screen.getByRole('button', { name: 'Wear Sunday best' })
    expect(wear).toHaveTextContent(/^Wear$/)
    await user.click(wear)
    expect(screen.getByTestId('outfit')).toHaveTextContent('{"accessory":"silk-bow"}')
    expect(status()).toHaveTextContent(
      'Fern is wearing Sunday best, leaving out one piece. Sprout Cap doesn’t fit an egg.',
    )
    expect(wear).toHaveFocus()
  })

  it('says it plainly when every piece goes on', async () => {
    const user = userEvent.setup()
    render(<Looks initial={garden([sunday])} />)
    await user.click(screen.getByRole('button', { name: 'Wear Sunday best' }))
    expect(status()).toHaveTextContent('Sol is wearing Sunday best.')
    expect(screen.getByText('Sol’s outfit is saved as Sunday best.')).toBeInTheDocument()
  })
})

describe('renaming and deleting a look', () => {
  it('renames in place and hands focus back to Rename', async () => {
    const user = userEvent.setup()
    render(<Looks initial={garden([sunday])} />)
    await user.click(screen.getByRole('button', { name: 'Rename Sunday best' }))
    const field = screen.getByRole('textbox', { name: 'New name for Sunday best' })
    expect(field).toHaveFocus()
    expect(field).toHaveValue('Sunday best')
    await user.clear(field)
    await user.type(field, 'Picnic')
    await user.click(screen.getByRole('button', { name: 'Save new name' }))
    expect(screen.getByRole('button', { name: 'Rename Picnic' })).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Rename Picnic' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('button', { name: 'Rename Picnic' })).toHaveFocus()
  })

  it('deletes at once, and Undo puts the look back where it was', async () => {
    const user = userEvent.setup()
    const party = { ...sunday, id: 'party', name: 'Party' }
    render(<Looks initial={garden([sunday, party])} />)
    await user.click(screen.getByRole('button', { name: 'Delete Sunday best' }))
    expect(screen.queryByText('Sunday best')).toBeNull()
    expect(heading()).toHaveFocus()
    expect(screen.getByText('Sunday best deleted.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Undo' }))
    const names = within(screen.getByRole('list', { name: 'Saved looks' }))
      .getAllByRole('listitem')
      .map((item) => item.querySelector('.look-name')?.textContent)
    expect(names).toEqual(['Sunday best', 'Party'])
    expect(screen.getByText('Sunday best', { selector: '.look-name' })).toHaveFocus()
  })

  it('lets the undo pass after a while', () => {
    vi.useFakeTimers()
    render(<Looks initial={garden([sunday])} />)
    act(() => screen.getByRole('button', { name: 'Delete Sunday best' }).click())
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(UNDO_MS)
    })
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
    expect(screen.getByText('A saved look can be put on any companion in one go.')).toBeInTheDocument()
  })
})

describe('a look’s outfit, changed under it', () => {
  it('offers to save again once the outfit differs from every look', async () => {
    const user = userEvent.setup()
    render(<Looks initial={garden([{ ...sunday, outfit: { headwear: 'sprout-cap' } }])} />)
    expect(screen.queryByRole('button', { name: 'Save this look' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Put on the bow' }))
    expect(screen.getByRole('button', { name: 'Save this look' })).toBeInTheDocument()
  })
})
