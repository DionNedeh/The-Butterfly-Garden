import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { newMoveCode } from '../lib/moveCode'
import { sealBackup } from '../lib/sealedBackup'
import type { FileCopy } from '../lib/sightingPhotos'
import { RecoveryScreen } from './RecoveryScreen'

/** Text entered all at once, as a paste: twelve words key by key are slow on a busy machine. */
async function enter(user: ReturnType<typeof userEvent.setup>, field: HTMLElement, text: string) {
  await user.click(field)
  await user.paste(text)
}

const PLAIN = '{"format":"the-butterfly-garden","garden":{"note":"Brought across"}}'

function renderRecovery() {
  const handlers = {
    onRestore: vi.fn((text: string) => Promise.resolve({ ok: true, message: `Restored ${text.length} characters.` })),
    onDownloadSetAside: vi.fn<() => Promise<FileCopy | undefined>>(() => Promise.resolve({ text: '{}' })),
    onStartFresh: vi.fn<() => Promise<{ ok: boolean; message?: string }>>(() => Promise.resolve({ ok: true })),
  }
  render(<RecoveryScreen reason="malformed" {...handlers} />)
  return { ...handlers, user: userEvent.setup() }
}

// A busy machine (a CI runner, other suites at once) is given time for whole flows.
describe('arriving on the recovery screen', { timeout: 20_000 }, () => {
  it('brings a garden from another device with its move file and code', async () => {
    const words = await newMoveCode()
    const outcome = await sealBackup(PLAIN, words.join(' '), { iterations: 1_000, opensWith: 'move-code' })
    if (!outcome.ok) throw new Error('Not sealed')
    const { onRestore, user } = renderRecovery()
    await user.click(screen.getByRole('button', { name: 'Arrive from another device' }))
    await user.upload(await screen.findByLabelText('Choose the move file'), new File([outcome.text], 'move.json'))
    await enter(user, await screen.findByLabelText('The 12 words'), words.join(' '))
    await user.click(screen.getByRole('button', { name: 'Open the file' }))
    await waitFor(() => expect(onRestore).toHaveBeenCalledWith(PLAIN))
    expect(await screen.findByText(`Restored ${PLAIN.length} characters.`)).toHaveAttribute('role', 'status')
  })

  it('replaces nothing when put away, with focus back on its button', async () => {
    const { onRestore, user } = renderRecovery()
    const arrive = screen.getByRole('button', { name: 'Arrive from another device' })
    await user.click(arrive)
    await user.click(await screen.findByRole('button', { name: 'Cancel' }))
    expect(onRestore).not.toHaveBeenCalled()
    await waitFor(() => expect(arrive).toHaveFocus())
  })
})
