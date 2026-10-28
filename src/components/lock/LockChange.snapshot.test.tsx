import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { changePasscode } from '../../lib/gardenLockActions'
import { gardenRepository } from '../../repository/gardenRepository'
import { SnapshotSealedError } from '../../repository/sealedStores'
import { LockChange } from './LockChange'

vi.mock('../../lib/gardenLockActions', async (original) => ({
  ...await original<typeof import('../../lib/gardenLockActions')>(), changePasscode: vi.fn(),
}))
afterEach(() => vi.restoreAllMocks())

it('offers a damaged copy for download or confirmed discard before retrying a lock change', async () => {
  vi.mocked(changePasscode).mockRejectedValueOnce(new SnapshotSealedError('restore-bad')).mockResolvedValueOnce(undefined)
  const discard = vi.spyOn(gardenRepository, 'discardSnapshot').mockResolvedValue()
  vi.spyOn(gardenRepository, 'earlierCopies')
    .mockResolvedValueOnce({ copies: [{ id: 'restore-bad', reason: 'restore', day: '2026-10-27' }], bytes: 10 })
    .mockResolvedValue({ copies: [], bytes: 0 })
  const user = userEvent.setup()
  render(<LockChange kind="passcode" onClose={vi.fn()} />)
  for (const [label, value] of [['Current passcode', 'old passphrase'], ['New passcode', 'a kingfisher at dawn'], ['The new passcode again', 'a kingfisher at dawn']]) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } })
  }
  await user.click(screen.getByRole('button', { name: 'Change my passcode' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('restore-bad')
  expect(await screen.findByRole('button', { name: /Download copy as it is/ })).toBeEnabled()
  await user.click(screen.getByRole('button', { name: /^Discard copy,/ }))
  expect(discard).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Discard this copy' }))
  await waitFor(() => expect(discard).toHaveBeenCalledWith('restore-bad'))
  await user.click(screen.getByRole('button', { name: 'Change my passcode' }))
  expect(await screen.findByRole('heading', { name: 'Your passcode is changed' })).toBeVisible()
})
