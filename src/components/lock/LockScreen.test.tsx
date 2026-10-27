import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { openDB } from 'idb'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { openLock, type LockRecord } from '../../lib/gardenLock'
import { contrastRatio } from '../../lib/contrast'
import { addPasskey, lockGarden, turnLockOn, unlockGarden } from '../../lib/gardenLockActions'
import { createInitialState } from '../../lib/progression'
import { newRecoveryCode } from '../../lib/recoveryCode'
import { randomBytes } from '../../lib/sealing'
import { gardenRepository } from '../../repository/gardenRepository'
import { openValue } from '../../repository/sealedStores'
import { applyStylesheets, paintOf } from '../../test/stylesheets'
import { LockScreen } from './LockScreen'

/** Quick key derivations: the count is the app's business, not these tests'. */
vi.mock('../../lib/sealing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/sealing')>()
  return {
    ...actual,
    deriveKey: (secret: string, salt: Uint8Array) => actual.deriveKey(secret, salt, 1_000),
  }
})

/** Android's back gesture, as the lock screen registers for it, and its system bars. */
const android = vi.hoisted(() => ({
  back: undefined as (() => void) | undefined,
  left: 0,
  /** Each style asked of the system bars: true for night's light icons. */
  bars: [] as boolean[],
}))
vi.mock('../../lib/native', async (original) => ({
  ...(await original<typeof import('../../lib/native')>()),
  setSystemBarsForTheme: (night: boolean) => {
    android.bars.push(night)
    return Promise.resolve()
  },
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

/** The device's own dark setting, which can be changed while the screen is up. */
function deviceDark(dark: boolean): (dark: boolean) => void {
  const device = { dark }
  const listeners = new Set<() => void>()
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return query === '(prefers-color-scheme: dark)' && device.dark
    },
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  }))
  return (next) => {
    device.dark = next
    act(() => listeners.forEach((listener) => listener()))
  }
}

afterEach(async () => {
  cleanup()
  vi.unstubAllGlobals()
  android.bars = []
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

  it('opens with the recovery code, then lets a new passcode be chosen, sealing the garden under a new key', async () => {
    const words = await lockedGarden()
    const before = (await gardenRepository.readLock()) as LockRecord
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
    // Opened under the new lock, which an old copy of the lock, with the
    // forgotten passcode, does not reach.
    expect((await gardenRepository.readLock())?.id).not.toBe(before.id)
    expect((await gardenRepository.load()).status).toBe('loaded')
    const oldKey = await openLock(before, { slot: 'passcode', passcode: PASSCODE })
    const db = await openDB('butterfly-garden')
    try {
      await expect(openValue(oldKey, 'moods', await db.get('moods', 'current'))).rejects.toThrow()
    } finally {
      db.close()
    }

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
    deviceDark(true)
    render(<LockScreen />)
    expect(screen.getByRole('main')).toHaveClass('theme-night')
  })

  it('sets the Android app’s system bars for the device’s light or dark, as it changes', async () => {
    await lockedGarden()
    const turn = deviceDark(true)
    render(<LockScreen />)
    // Light icons over the dark screen.
    expect(android.bars).toEqual([true])
    turn(false)
    expect(screen.getByRole('main')).not.toHaveClass('theme-night')
    expect(android.bars).toEqual([true, false])
  })

  it('draws its delete button legibly by day and by night', async () => {
    await lockedGarden()
    const removeStylesheets = applyStylesheets('components/lock/lock.css')
    try {
      for (const dark of [false, true]) {
        deviceDark(dark)
        const user = userEvent.setup()
        const { unmount } = render(<LockScreen />)
        await user.click(screen.getByText('I can’t open my garden'))
        await user.click(screen.getByRole('button', { name: 'Delete this garden…' }))
        const { text, fill } = paintOf(screen.getByRole('button', { name: 'Delete it and start again' }))
        // WCAG AA for its 16px, 800-weight words: 4.5:1.
        expect({ dark, contrast: contrastRatio(text, fill) >= 4.5 }).toEqual({ dark, contrast: true })
        unmount()
      }
    } finally {
      removeStylesheets()
    }
  })

  it('explains what to do when it cannot be opened, and deletes the garden only when asked twice', async () => {
    await lockedGarden()
    const user = userEvent.setup()
    render(<LockScreen />)
    await user.click(screen.getByText('I can’t open my garden'))
    expect(screen.getByText(/nobody can open this garden, not even the people who made the app/)).toBeVisible()
    // Each button pressed here is taken away; focus goes to what replaces
    // it, never to nothing: the safe choice first, then the way back in.
    await user.click(screen.getByRole('button', { name: 'Delete this garden…' }))
    expect(screen.getByRole('button', { name: 'Keep it' })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Keep it' }))
    expect(screen.getByRole('button', { name: 'Delete this garden…' })).toHaveFocus()
    expect(gardenRepository.lockState()).toBe('locked')
    await user.keyboard('{Enter}')
    expect(screen.getByRole('button', { name: 'Keep it' })).toHaveFocus()
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
