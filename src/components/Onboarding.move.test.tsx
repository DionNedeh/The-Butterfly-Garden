import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { newMoveCode } from '../lib/moveCode'
import { sealBackup } from '../lib/sealedBackup'
import { Onboarding } from './Onboarding'

/** Text entered all at once, as a paste: twelve words key by key are slow on a busy machine. */
async function enter(user: ReturnType<typeof userEvent.setup>, field: HTMLElement, text: string) {
  await user.click(field)
  await user.paste(text)
}

const PLAIN = '{"format":"the-butterfly-garden","garden":{"note":"Brought across"}}'

async function moveFile(): Promise<{ file: File; words: string[] }> {
  const words = await newMoveCode()
  const outcome = await sealBackup(PLAIN, words.join(' '), { iterations: 1_000, opensWith: 'move-code' })
  if (!outcome.ok) throw new Error('Not sealed')
  return { file: new File([outcome.text], 'butterfly-garden-move-2026-10-27.json'), words }
}

// A busy machine (a CI runner, other suites at once) is given time for whole flows.
describe('arriving at the welcome', { timeout: 20_000 }, () => {
  it('is offered beside I have a backup, and brings the garden inside the move file', async () => {
    const { file, words } = await moveFile()
    const user = userEvent.setup()
    const onRestore = vi.fn(() => Promise.resolve({ ok: true, message: 'Restored.' }))
    render(<Onboarding onComplete={vi.fn()} onRestore={onRestore} />)
    expect(screen.getByRole('button', { name: 'I have a backup' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Arrive from another device' }))
    await user.upload(await screen.findByLabelText('Choose the move file'), file)
    await enter(user, await screen.findByLabelText('The 12 words'), words.join(' '))
    await user.click(screen.getByRole('button', { name: 'Open the file' }))
    await waitFor(() => expect(onRestore).toHaveBeenCalledWith(PLAIN))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('says a refusal of what was inside where restores speak', async () => {
    const { file, words } = await moveFile()
    const user = userEvent.setup()
    const onRestore = vi.fn(() => Promise.resolve({ ok: false, message: 'That backup could not be restored.' }))
    render(<Onboarding onComplete={vi.fn()} onRestore={onRestore} />)
    await user.click(screen.getByRole('button', { name: 'Arrive from another device' }))
    await user.upload(await screen.findByLabelText('Choose the move file'), file)
    await enter(user, await screen.findByLabelText('The 12 words'), words.join(' '))
    await user.click(screen.getByRole('button', { name: 'Open the file' }))
    expect(await screen.findByText('That backup could not be restored.')).toHaveAttribute('role', 'status')
    expect(screen.getByLabelText('Choose a backup')).toBeInTheDocument()
  })

  it('brings nothing when put away, and gives focus back to its button', async () => {
    const user = userEvent.setup()
    const onRestore = vi.fn()
    render(<Onboarding onComplete={vi.fn()} onRestore={onRestore} />)
    const arrive = screen.getByRole('button', { name: 'Arrive from another device' })
    await user.click(arrive)
    await user.click(await screen.findByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(onRestore).not.toHaveBeenCalled()
    await waitFor(() => expect(arrive).toHaveFocus())
  })

  it('is not offered where nothing can be restored', () => {
    render(<Onboarding onComplete={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Arrive from another device' })).toBeNull()
  })
})
