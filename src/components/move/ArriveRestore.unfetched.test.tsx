import { render, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { newMoveCode } from '../../lib/moveCode'
import { sealBackup } from '../../lib/sealedBackup'
import { ProtectedRestore } from '../backup/ProtectedRestore'
import { ArriveRestore } from './ArriveRestore'

// The dialog's chunk could not be fetched: offline with a stale cache, or a
// deploy that removed it from under an open page.
vi.mock('./ArriveDialog', () => {
  throw new Error('Failed to fetch dynamically imported module')
})

describe('an arriving dialog that cannot be fetched', () => {
  it('says so, and leaves the screen that asked for it standing', async () => {
    const onClose = vi.fn()
    const onOpened = vi.fn()
    const { container } = render(<ArriveRestore onOpened={onOpened} onClose={onClose} />)
    await waitFor(() =>
      expect(onClose).toHaveBeenCalledWith(
        'Arriving from another device could not start just now. Please try again.',
      ),
    )
    expect(onOpened).not.toHaveBeenCalled()
    expect(container).toBeEmptyDOMElement()
  })

  it('says so for a move file chosen through Restore too', async () => {
    const words = await newMoveCode()
    const outcome = await sealBackup('{}', words.join(' '), { iterations: 1_000, opensWith: 'move-code' })
    if (!outcome.ok) throw new Error('Not sealed')
    const onClose = vi.fn()
    const onOpened = vi.fn()
    const { container } = render(<ProtectedRestore next="preview" text={outcome.text} onOpened={onOpened} onClose={onClose} />)
    await waitFor(() =>
      expect(onClose).toHaveBeenCalledWith('This move file could not be opened just now. Please try again.'),
    )
    expect(onOpened).not.toHaveBeenCalled()
    expect(container).toBeEmptyDOMElement()
  })
})
