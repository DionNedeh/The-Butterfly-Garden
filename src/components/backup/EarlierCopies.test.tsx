import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { gardenRepository } from '../../repository/gardenRepository'
import { saveTextFile } from '../../lib/download'
import { EarlierCopies } from './EarlierCopies'

vi.mock('../../lib/download', async (original) => ({
  ...await original<typeof import('../../lib/download')>(), saveTextFile: vi.fn(),
}))
afterEach(() => vi.restoreAllMocks())

describe('copies reachable after reload', () => {
  it('names a pre-restore copy and requires confirmation before discarding it', async () => {
    const copy = { id: 'restore-1', reason: 'restore' as const, gardenName: 'Before', day: '2026-10-27', held: { checkIns: 1, reflections: 2, goals: 3 } }
    const onList = vi.fn().mockResolvedValueOnce({ copies: [copy], bytes: 10 }).mockResolvedValue({ copies: [], bytes: 0 })
    const discard = vi.spyOn(gardenRepository, 'discardSnapshot').mockResolvedValue()
    const onLook = vi.fn()
    const user = userEvent.setup()
    render(<EarlierCopies onList={onList} onLook={onLook} android={false} />)
    await screen.findByText('Before a restore: Before')
    await user.click(screen.getByRole('button', { name: /Look at this copy/ }))
    expect(onLook).toHaveBeenCalledWith(copy)
    await user.click(screen.getByRole('button', { name: /^Discard copy, from/ }))
    expect(discard).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Keep it' }))
    expect(discard).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /^Discard copy, from/ }))
    await user.click(screen.getByRole('button', { name: 'Discard this copy' }))
    await waitFor(() => expect(discard).toHaveBeenCalledWith('restore-1'))
    expect(await screen.findByRole('status')).toHaveTextContent('Your current garden is unchanged')
    await waitFor(() => expect(onList).toHaveBeenCalledTimes(2))
  })

  it('keeps damaged sealed bytes and their lock in a download, without discarding anything', async () => {
    const record = { id: 'restore-bad', reason: 'restore' as const, takenAt: '2026-10-27T10:00:00Z', garden: { sealed: 1, iv: new Uint8Array([1, 2]), data: new Uint8Array([3, 4]) } }
    vi.spyOn(gardenRepository, 'snapshotForDownload').mockResolvedValue({ snapshot: record, lock: { id: 'original-key' } as never })
    const discard = vi.spyOn(gardenRepository, 'discardSnapshot').mockResolvedValue()
    vi.mocked(saveTextFile).mockResolvedValue('started')
    const user = userEvent.setup()
    render(<EarlierCopies onList={() => Promise.resolve({ copies: [{ id: record.id, reason: 'restore', day: '2026-10-27' }], bytes: 10 })} onLook={vi.fn()} android={false} />)
    const row = (await screen.findByRole('button', { name: /Download copy as it is/ })).closest('li')!
    expect(within(row).getByRole('button', { name: /Look at this copy/ })).toBeDisabled()
    await user.click(within(row).getByRole('button', { name: /Download copy as it is/ }))
    await waitFor(() => expect(saveTextFile).toHaveBeenCalled())
    const exported = JSON.parse(vi.mocked(saveTextFile).mock.calls[0][2])
    expect(exported.snapshot.garden.iv).toEqual({ base64: 'AQI=' })
    expect(exported.snapshot.garden.data).toEqual({ base64: 'AwQ=' })
    expect(exported.lock.id).toBe('original-key')
    expect(discard).not.toHaveBeenCalled()
    expect(await screen.findByRole('status')).toHaveTextContent('Download started')
  })
})
