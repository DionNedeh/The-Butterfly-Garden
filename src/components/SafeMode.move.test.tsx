import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { newMoveCode, moveSecret } from '../lib/moveCode'
import { sealBackup } from '../lib/sealedBackup'
import { createInitialState } from '../lib/progression'
import { reloadApp } from '../lib/reload'
import { gardenRepository } from '../repository/gardenRepository'
import { SafeMode } from './SafeMode'

vi.mock('../lib/reload', () => ({ reloadApp: vi.fn() }))
afterEach(() => vi.restoreAllMocks())

describe('arriving in safe mode', () => {
  it('opens a move file with its words and uses the snapshot-preserving restore path', async () => {
    const garden = createInitialState('Robin', 'Arrived garden')
    const words = await newMoveCode()
    const file = await sealBackup(JSON.stringify({ format: 'the-butterfly-garden', garden }), moveSecret(words), { iterations: 1_000, opensWith: 'move-code' })
    if (!file.ok) throw new Error('No file')
    const replace = vi.spyOn(gardenRepository, 'replace').mockResolvedValue([])
    const user = userEvent.setup()
    render(<SafeMode error={new Error('Broken view')} />)
    await user.click(screen.getByRole('button', { name: 'Arrive from another device' }))
    await user.upload(await screen.findByLabelText('Choose the move file'), new File([file.text], 'move.json'))
    const field = await screen.findByLabelText('The 12 words')
    expect(screen.getByRole('dialog')).toHaveAccessibleDescription(/restored straight away, in place of what is stored here/)
    expect(screen.queryByRole('button', { name: /Scan/ })).toBeNull()
    fireEvent.change(field, { target: { value: words.join(' ') } })
    await user.click(screen.getByRole('button', { name: 'Open the file' }))
    await waitFor(() => expect(replace).toHaveBeenCalledWith(expect.objectContaining({ profile: expect.objectContaining({ gardenName: 'Arrived garden' }) }), { snapshot: true }))
    expect(reloadApp).toHaveBeenCalled()
  })
})
