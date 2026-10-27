import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { addPasskey, lockGarden, turnLockOn, unlockGarden } from '../../lib/gardenLockActions'
import { createInitialState } from '../../lib/progression'
import { newRecoveryCode } from '../../lib/recoveryCode'
import { randomBytes } from '../../lib/sealing'
import { gardenRepository } from '../../repository/gardenRepository'
import { LockScreen } from './LockScreen'

/** Quick key derivations: the count is the app's business, not these tests'. */
vi.mock('../../lib/sealing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/sealing')>()
  return {
    ...actual,
    deriveKey: (secret: string, salt: Uint8Array) => actual.deriveKey(secret, salt, 1_000),
  }
})

/** Android's back gesture, as the lock screen registers for it. */
const android = vi.hoisted(() => ({ back: undefined as (() => void) | undefined, left: 0 }))
vi.mock('../../lib/native', async (original) => ({
  ...(await original<typeof import('../../lib/native')>()),
  onBackButton: (handler: () => void) => {
    android.back = handler
    return () => {
      if (android.back === handler) android.back = undefined
    }
  },
  leaveApp: () => {
    android.left += 1
    return Promise.resolve()
  },
}))

const passkeys = vi.hoisted(() => ({
  offered: false,
  answer: undefined as Uint8Array | undefined,
}))
vi.mock('../../lib/passkey', () => ({
  passkeysOffered: () => Promise.resolve(passkeys.offered),
  askPasskey: () =>
    Promise.resolve(
      passkeys.answer
        ? { ok: true, prfOutput: passkeys.answer }
        : { ok: false, reason: 'dismissed' },
    ),
}))

const PASSCODE = 'heron by the weir'

/** A stored garden, locked, with this tab holding no key: what a reload finds. */
async function lockedGarden() {
  await gardenRepository.save(createInitialState('Robin', 'Quiet Corner'))
  const words = newRecoveryCode()
  await turnLockOn(PASSCODE, words)
  await lockGarden(false)
  expect(gardenRepository.lockState()).toBe('locked')
  return words
}

afterEach(async () => {
  cleanup()
  passkeys.offered = false
  passkeys.answer = undefined
  await gardenRepository.clear().catch(() => undefined)
})

describe('the lock screen', { timeout: 30_000 }, () => {
  it('opens with the passcode, saying so while the key is made', async () => {
    await lockedGarden()
    const user = userEvent.setup()
    render(<LockScreen />)
    expect(screen.getByRole('main', { name: 'Your garden is resting' })).toBeInTheDocument()
    const field = screen.getByLabelText('Passcode')
    await waitFor(() => expect(field).toHaveFocus())
    await user.type(field, PASSCODE)
    await user.click(screen.getByRole('button', { name: 'Open my garden' }))
    expect(screen.getByRole('status')).toHaveTextContent('Opening your garden… this takes a moment.')
    await waitFor(() => expect(gardenRepository.lockState()).toBe('unlocked'))
    expect((await gardenRepository.load()).state.profile?.gardenName).toBe('Quiet Corner')
  })

  it('says a wrong passcode did not open it, and nothing more', async () => {
    await lockedGarden()
    const user = userEvent.setup()
    render(<LockScreen />)
    await user.click(screen.getByRole('button', { name: 'Open my garden' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Type your passcode.')
    await user.type(screen.getByLabelText('Passcode'), 'heron by the wei')
    await user.click(screen.getByRole('button', { name: 'Open my garden' }))
    expect(await screen.findByText('That passcode didn’t open your garden. Please try again.')).toHaveAttribute(
      'role',
      'alert',
    )
    expect(screen.getByLabelText('Passcode')).toHaveFocus()
    expect(screen.getByLabelText('Passcode')).toHaveAttribute('aria-invalid', 'true')
    expect(gardenRepository.lockState()).toBe('locked')
    // Ready for another try straight away: no lockout timer.
    expect(screen.getByRole('button', { name: 'Open my garden' })).toBeEnabled()
  })

  it('opens with the recovery code, then lets a new passcode be chosen', async () => {
    const words = await lockedGarden()
    const user = userEvent.setup()
    render(<LockScreen />)
    await user.click(screen.getByRole('button', { name: 'Use my recovery code' }))
    const field = screen.getByLabelText('Recovery code')
    await waitFor(() => expect(field).toHaveFocus())

    await user.type(field, `${words.slice(0, 23).join(' ')} notaword`)
    await user.click(screen.getByRole('button', { name: 'Open with my recovery code' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('“notaword” is not one of the recovery words')

    await user.clear(field)
    await user.type(field, newRecoveryCode().join(' '))
    await user.click(screen.getByRole('button', { name: 'Open with my recovery code' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Those words didn’t open your garden. Check them against your sheet, in order.',
    )

    await user.clear(field)
    await user.type(field, words.map((word, index) => `${index + 1}. ${word}`).join('\n'))
    await user.click(screen.getByRole('button', { name: 'Open with my recovery code' }))
    expect(await screen.findByRole('heading', { name: 'Choose a new passcode' })).toBeInTheDocument()
    expect(gardenRepository.lockState()).toBe('locked')
    await waitFor(() => expect(screen.getByLabelText('New passcode')).toHaveFocus())

    await user.type(screen.getByLabelText('New passcode'), 'short')
    await user.type(screen.getByLabelText('The same passcode again'), 'short')
    await user.click(screen.getByRole('button', { name: 'Save it and open my garden' }))
    expect(screen.getByRole('alert')).toHaveTextContent('A passcode needs at least 6 characters.')

    await user.clear(screen.getByLabelText('New passcode'))
    await user.clear(screen.getByLabelText('The same passcode again'))
    await user.type(screen.getByLabelText('New passcode'), 'remembered at last')
    await user.type(screen.getByLabelText('The same passcode again'), 'remembered at last')
    await user.click(screen.getByRole('button', { name: 'Save it and open my garden' }))
    await waitFor(() => expect(gardenRepository.lockState()).toBe('unlocked'))

    // The new passcode opens it from now on, and the old one does not.
    await lockGarden(false)
    await expect(unlockGarden({ slot: 'passcode', passcode: PASSCODE })).rejects.toThrow()
    await unlockGarden({ slot: 'passcode', passcode: 'remembered at last' })
    expect(gardenRepository.lockState()).toBe('unlocked')
  })

  it('opens with the recovery code without changing the passcode, if the gardener says not now', async () => {
    const words = await lockedGarden()
    const user = userEvent.setup()
    render(<LockScreen />)
    await user.click(screen.getByRole('button', { name: 'Use my recovery code' }))
    await user.type(screen.getByLabelText('Recovery code'), words.join(' '))
    await user.click(screen.getByRole('button', { name: 'Open with my recovery code' }))
    await user.click(await screen.findByRole('button', { name: 'Not now, just open my garden' }))
    expect(gardenRepository.lockState()).toBe('unlocked')
    await lockGarden(false)
    await unlockGarden({ slot: 'passcode', passcode: PASSCODE })
    expect(gardenRepository.lockState()).toBe('unlocked')
  })

  it('goes back to the passcode from the recovery code', async () => {
    await lockedGarden()
    const user = userEvent.setup()
    render(<LockScreen />)
    await user.click(screen.getByRole('button', { name: 'Use my recovery code' }))
    await user.click(screen.getByRole('button', { name: 'Open with my recovery code' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Type the 24 words of your recovery code.')
    await user.click(screen.getByRole('button', { name: 'Use my passcode instead' }))
    await waitFor(() => expect(screen.getByLabelText('Passcode')).toHaveFocus())
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('leaves the app on Android’s back gesture', async () => {
    await lockedGarden()
    render(<LockScreen />)
    const before = android.left
    android.back?.()
    expect(android.left).toBe(before + 1)
  })

  it('follows the device’s light or dark, since the garden’s own theme is sealed', async () => {
    await lockedGarden()
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(prefers-color-scheme: dark)',
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }))
    render(<LockScreen />)
    expect(screen.getByRole('main')).toHaveClass('theme-night')
    vi.unstubAllGlobals()
  })

  it('explains what to do when it cannot be opened, and deletes the garden only when asked twice', async () => {
    await lockedGarden()
    const user = userEvent.setup()
    render(<LockScreen />)
    await user.click(screen.getByText('I can’t open my garden'))
    expect(screen.getByText(/nobody can open this garden, not even the people who made the app/)).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Delete this garden…' }))
    await user.click(screen.getByRole('button', { name: 'Keep it' }))
    expect(gardenRepository.lockState()).toBe('locked')
    await user.click(screen.getByRole('button', { name: 'Delete this garden…' }))
    await user.click(screen.getByRole('button', { name: 'Delete it and start again' }))
    await waitFor(() => expect(gardenRepository.lockState()).toBe('none'))
    expect((await gardenRepository.load()).status).toBe('empty')
  })

  it('offers a passkey only where one was added and can be used, and opens with it', async () => {
    await gardenRepository.save(createInitialState('Robin', 'Quiet Corner'))
    await turnLockOn(PASSCODE, newRecoveryCode())
    const prfOutput = randomBytes(32)
    await addPasskey(PASSCODE, { credentialId: randomBytes(16), prfSalt: randomBytes(32), prfOutput })
    await lockGarden(false)

    // Not offered where this browser cannot use one.
    const { unmount } = render(<LockScreen />)
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(screen.queryByRole('button', { name: 'Unlock with a passkey' })).toBeNull()
    unmount()

    passkeys.offered = true
    passkeys.answer = randomBytes(32)
    const user = userEvent.setup()
    render(<LockScreen />)
    await user.click(await screen.findByRole('button', { name: 'Unlock with a passkey' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('That passkey didn’t open your garden.')
    passkeys.answer = prfOutput
    await user.click(screen.getByRole('button', { name: 'Unlock with a passkey' }))
    await waitFor(() => expect(gardenRepository.lockState()).toBe('unlocked'))
  })
})
