import { render, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ProtectedRestore } from './ProtectedRestore'

// The prompt's chunk could not be fetched: offline with a stale cache, or a
// deploy that removed it from under an open page.
vi.mock('./SealedBackupPrompt', () => {
  throw new Error('Failed to fetch dynamically imported module')
})

describe('a passphrase prompt that cannot be fetched', () => {
  it('says so, and leaves the screen that asked for it standing', async () => {
    const onClose = vi.fn()
    const onOpened = vi.fn()
    const { container } = render(
      <ProtectedRestore text="{}" onOpened={onOpened} onClose={onClose} />,
    )
    await waitFor(() =>
      expect(onClose).toHaveBeenCalledWith(
        'This protected backup could not be opened just now. Please try again.',
      ),
    )
    expect(onOpened).not.toHaveBeenCalled()
    expect(container).toBeEmptyDOMElement()
  })
})
