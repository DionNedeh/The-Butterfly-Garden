import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { openDB } from 'idb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeBroadcastChannel } from '../../test/fakeBroadcastChannel'
import { LAZY_PAGE_MS } from '../../test/lazyPage'
import { NO_WAY_BACK, openLock } from '../../lib/gardenLock'
import { lockGarden, turnLockOn, unlockGarden } from '../../lib/gardenLockActions'
import { createInitialState } from '../../lib/progression'
import { newRecoveryCode } from '../../lib/recoveryCode'
import { randomBytes } from '../../lib/sealing'
import { gardenRepository, isSealed } from '../../repository/gardenRepository'
import { LockSettings } from './LockSettings'

vi.mock('../../lib/sealing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/sealing')>()
  return {
    ...actual,
    deriveKey: (secret: string, salt: Uint8Array) => actual.deriveKey(secret, salt, 1_000),
  }
})

const saved = vi.hoisted(() => ({ files: [] as Array<{ name: string; type: string; text: string }> }))
vi.mock('../../lib/download', async (original) => ({
  ...(await original<typeof import('../../lib/download')>()),
  saveTextFile: (name: string, type: string, text: string) => {
    saved.files.push({ name, type, text })
    return Promise.resolve('started' as const)
  },
}))

const passkeys = vi.hoisted(() => ({
  offered: false,
  made: undefined as
    | { ok: true; credentialId: Uint8Array; prfSalt: Uint8Array; prfOutput: Uint8Array }
    | { ok: false; reason: 'dismissed' | 'no-prf' }
    | undefined,
}))
vi.mock('../../lib/passkey', () => ({
  passkeysOffered: () => Promise.resolve(passkeys.offered),
  makePasskey: () => Promise.resolve(passkeys.made ?? { ok: false, reason: 'dismissed' }),
}))

const PASSCODE = 'a robin on the gate'

beforeEach(() => {
  vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel)
})

afterEach(async () => {
  cleanup()
  vi.unstubAllGlobals()
  saved.files = []
  passkeys.offered = false
  passkeys.made = undefined
  await gardenRepository.clear().catch(() => undefined)
})

async function storedGarden() {
  await gardenRepository.save(createInitialState('Robin', 'Quiet Corner'))
}

async function lockedAndOpen() {
  await storedGarden()
  const words = newRecoveryCode()
  await turnLockOn(PASSCODE, words)
  return words
}

function dialog() {
  return within(screen.getByRole('dialog'))
}

/** The words shown on the sheet, in order. */
function shownWords(): string[] {
  return within(screen.getByRole('list', { name: 'Your recovery code, 24 words' }))
    .getAllByRole('listitem')
    .map((item) => item.textContent ?? '')
}

/** Type the two words asked for, from `words` (or wrong ones). */
async function confirmTwo(user: UserEvent, words: readonly string[], wrong = false) {
  const fields = dialog().getAllByRole('textbox', { name: /^Word \d+$/ })
  expect(fields).toHaveLength(2)
  for (const field of fields) {
    const position = Number(/\d+/.exec(field.getAttribute('aria-label') ?? field.closest('label')?.textContent ?? '')?.[0])
    await user.clear(field)
    await user.type(field, wrong ? 'zzz' : words[position - 1])
  }
}

describe('turning the lock on', { timeout: 30_000 }, () => {
  it('asks for a passcode, shows the code, checks two words, and only then locks', async () => {
    await storedGarden()
    const user = userEvent.setup()
    render(<LockSettings />)
    expect(screen.getByText(/other code running at the same web address/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Lock my garden…' }))

    const title = await screen.findByRole('heading', { name: 'Choose a passcode' }, { timeout: LAZY_PAGE_MS })
    await waitFor(() => expect(title).toHaveFocus())
    // Said plainly the first time.
    expect(dialog().getByText(NO_WAY_BACK)).toBeInTheDocument()
    expect(dialog().getByText(/A longer passphrase, a few words only you would put together, is much stronger/)).toBeInTheDocument()

    await user.type(dialog().getByLabelText('Passcode'), 'short')
    await user.type(dialog().getByLabelText('The same passcode again'), 'short')
    await user.click(dialog().getByRole('button', { name: 'Next: your recovery code' }))
    expect(dialog().getByRole('alert')).toHaveTextContent('A passcode needs at least 6 characters.')
    await user.clear(dialog().getByLabelText('Passcode'))
    await user.clear(dialog().getByLabelText('The same passcode again'))
    await user.type(dialog().getByLabelText('Passcode'), PASSCODE)
    await user.type(dialog().getByLabelText('The same passcode again'), `${PASSCODE}!`)
    await user.click(dialog().getByRole('button', { name: 'Next: your recovery code' }))
    expect(dialog().getByRole('alert')).toHaveTextContent('The two passcodes are not the same.')
    await user.clear(dialog().getByLabelText('The same passcode again'))
    await user.type(dialog().getByLabelText('The same passcode again'), PASSCODE)
    await user.click(dialog().getByRole('button', { name: 'Next: your recovery code' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Save your recovery code' })).toHaveFocus())
    const words = shownWords()
    expect(words).toHaveLength(24)
    // Said plainly the second time, beside the code.
    expect(dialog().getByText(`${NO_WAY_BACK} There is no other way in.`)).toBeInTheDocument()

    await user.click(dialog().getByRole('button', { name: 'Download the sheet' }))
    expect(saved.files).toHaveLength(1)
    expect(saved.files[0].name).toMatch(/^butterfly-garden-recovery-code-\d{4}-\d{2}-\d{2}\.txt$/)
    expect(saved.files[0].type).toBe('text/plain')
    for (const word of words) expect(saved.files[0].text).toContain(word)

    const print = vi.fn(() => {
      expect(document.body).toHaveClass('printing-recovery')
    })
    vi.stubGlobal('print', print)
    await user.click(dialog().getByRole('button', { name: 'Print the sheet' }))
    expect(print).toHaveBeenCalledOnce()
    expect(document.body).not.toHaveClass('printing-recovery')
    // What is printed is the sheet itself.
    expect(document.querySelector('.recovery-print')?.textContent).toContain(words[23])

    await user.click(dialog().getByRole('button', { name: 'I have kept the words' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Check two words' })).toHaveFocus())
    await confirmTwo(user, words, true)
    await user.click(dialog().getByRole('button', { name: 'Lock my garden' }))
    expect(dialog().getByRole('alert')).toHaveTextContent(/^That is not word \d+\. Check your sheet and try again\.$/)
    expect(gardenRepository.lockState()).not.toBe('unlocked')

    await confirmTwo(user, words)
    await user.click(dialog().getByRole('button', { name: 'Lock my garden' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Your garden is locked' })).toBeInTheDocument())
    expect(gardenRepository.lockState()).toBe('unlocked')

    const db = await openDB('butterfly-garden')
    try {
      expect(isSealed(await db.get('meta', 'current'))).toBe(true)
      const record = await gardenRepository.readLock()
      await expect(openLock(record!, { slot: 'passcode', passcode: PASSCODE })).resolves.toBeDefined()
      await expect(openLock(record!, { slot: 'recovery', words })).resolves.toBeDefined()
    } finally {
      db.close()
    }

    await user.click(dialog().getByRole('button', { name: 'Done' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('heading', { name: 'The garden lock' })).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Lock now' })).toBeInTheDocument()
  })

  it('tells other tabs the lock is on', async () => {
    await storedGarden()
    const other = new FakeBroadcastChannel('butterfly-garden-sync')
    const heard: unknown[] = []
    other.onmessage = (event) => heard.push(event.data)
    await turnLockOn(PASSCODE, newRecoveryCode())
    expect(heard).toEqual([{ type: 'garden-lock' }])
    other.close()
  })

  it('can be left before anything changes', async () => {
    await storedGarden()
    const user = userEvent.setup()
    render(<LockSettings />)
    await user.click(screen.getByRole('button', { name: 'Lock my garden…' }))
    await user.click(await screen.findByRole('button', { name: 'Not now' }, { timeout: LAZY_PAGE_MS }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(gardenRepository.lockState()).not.toBe('unlocked')
    expect(await gardenRepository.readLock()).toBeUndefined()
  })
})

describe('while the lock is on and open', { timeout: 30_000 }, () => {
  it('locks now, here and in the other tabs', async () => {
    await lockedAndOpen()
    const other = new FakeBroadcastChannel('butterfly-garden-sync')
    const heard: unknown[] = []
    other.onmessage = (event) => heard.push(event.data)
    const user = userEvent.setup()
    render(<LockSettings />)
    await user.click(screen.getByRole('button', { name: 'Lock now' }))
    await waitFor(() => expect(gardenRepository.lockState()).toBe('locked'))
    expect(heard).toEqual([{ type: 'garden-lock', now: true }])
    other.close()
  })

  it('chooses when it locks by itself, off by default', async () => {
    await lockedAndOpen()
    const user = userEvent.setup()
    render(<LockSettings />)
    const choice = await screen.findByRole('combobox', { name: 'Lock by itself' })
    expect(choice).toHaveValue('')
    // What it waits for, said beside the choice (components/lock/LockWatch).
    expect(choice).toHaveAccessibleDescription(
      'It waits while you are choosing a photo or a file, or have a sighting, a goal or a garden image open to edit, so nothing you are part-way through is lost.',
    )
    expect(within(choice).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Never',
      'After 1 minute out of sight',
      'After 5 minutes out of sight',
      'After 15 minutes out of sight',
      'After an hour out of sight',
    ])
    await user.selectOptions(choice, 'After 5 minutes out of sight')
    expect(await screen.findByRole('status')).toHaveTextContent('Saved. The garden will lock itself after that long out of sight.')
    expect((await gardenRepository.readLock())?.autoLockMinutes).toBe(5)
    await user.selectOptions(choice, 'Never')
    await waitFor(async () => expect((await gardenRepository.readLock())?.autoLockMinutes).toBeUndefined())
  })

  it('tells other tabs when it chooses a new time, and nothing else', async () => {
    await lockedAndOpen()
    const other = new FakeBroadcastChannel('butterfly-garden-sync')
    const heard: unknown[] = []
    other.onmessage = (event) => heard.push(event.data)
    const user = userEvent.setup()
    render(<LockSettings />)
    await user.selectOptions(
      await screen.findByRole('combobox', { name: 'Lock by itself' }),
      'After 15 minutes out of sight',
    )
    await waitFor(() => expect(heard).toEqual([{ type: 'garden-auto-lock' }]))
    // Not the lock switched, which would have every tab read the garden again.
    expect((await gardenRepository.readLock())?.autoLockMinutes).toBe(15)
    other.close()
  })

  it('changes the passcode, asking for the current one', async () => {
    const words = await lockedAndOpen()
    const user = userEvent.setup()
    render(<LockSettings />)
    await user.click(screen.getByRole('button', { name: 'Change my passcode…' }))
    await screen.findByRole('heading', { name: 'Change my passcode' }, { timeout: LAZY_PAGE_MS })
    await user.type(dialog().getByLabelText('Current passcode'), 'not the passcode')
    await user.type(dialog().getByLabelText('New passcode'), 'swifts over the roofs')
    await user.type(dialog().getByLabelText('The new passcode again'), 'swifts over the roofs')
    await user.click(dialog().getByRole('button', { name: 'Change my passcode' }))
    expect(await dialog().findByRole('alert')).toHaveTextContent('That isn’t your current passcode.')
    expect(dialog().getByLabelText('Current passcode')).toHaveFocus()

    await user.clear(dialog().getByLabelText('Current passcode'))
    await user.type(dialog().getByLabelText('Current passcode'), PASSCODE)
    await user.click(dialog().getByRole('button', { name: 'Change my passcode' }))
    expect(await screen.findByRole('heading', { name: 'Your passcode is changed' })).toBeInTheDocument()

    await lockGarden(false)
    await expect(unlockGarden({ slot: 'passcode', passcode: PASSCODE })).rejects.toThrow()
    await unlockGarden({ slot: 'passcode', passcode: 'swifts over the roofs' })
    await lockGarden(false)
    await unlockGarden({ slot: 'recovery', words })
    expect(gardenRepository.lockState()).toBe('unlocked')
  })

  it('makes a new recovery code, after which the old one opens nothing', async () => {
    const old = await lockedAndOpen()
    const user = userEvent.setup()
    render(<LockSettings />)
    await user.click(screen.getByRole('button', { name: 'Make a new recovery code…' }))
    await screen.findByRole('heading', { name: 'Make a new recovery code' }, { timeout: LAZY_PAGE_MS })
    expect(dialog().getByText(/your old recovery code stops working/)).toBeInTheDocument()
    await user.type(dialog().getByLabelText('Your passcode'), 'wrong passcode')
    await user.click(dialog().getByRole('button', { name: 'Next: the new code' }))
    expect(await dialog().findByRole('alert')).toHaveTextContent('That isn’t your current passcode.')
    await user.clear(dialog().getByLabelText('Your passcode'))
    await user.type(dialog().getByLabelText('Your passcode'), PASSCODE)
    await user.click(dialog().getByRole('button', { name: 'Next: the new code' }))
    await screen.findByRole('heading', { name: 'Save your new recovery code' })
    const words = shownWords()
    expect(dialog().getByText(NO_WAY_BACK)).toBeInTheDocument()
    await user.click(dialog().getByRole('button', { name: 'I have kept the words' }))
    await confirmTwo(user, words)
    await user.click(dialog().getByRole('button', { name: 'Use the new code' }))
    expect(await screen.findByRole('heading', { name: 'Your new recovery code is in place' })).toBeInTheDocument()

    await lockGarden(false)
    await expect(unlockGarden({ slot: 'recovery', words: old })).rejects.toThrow()
    await unlockGarden({ slot: 'recovery', words })
    expect(gardenRepository.lockState()).toBe('unlocked')
  })

  it('turns the lock off with the passcode, opening everything stored back up', async () => {
    await lockedAndOpen()
    const user = userEvent.setup()
    render(<LockSettings />)
    await user.click(screen.getByRole('button', { name: 'Turn the lock off…' }))
    await screen.findByRole('heading', { name: 'Turn the lock off' }, { timeout: LAZY_PAGE_MS })
    await user.click(dialog().getByRole('button', { name: 'Turn the lock off' }))
    expect(dialog().getByRole('alert')).toHaveTextContent('Type your passcode.')
    await user.type(dialog().getByLabelText('Your passcode'), 'nope nope')
    await user.click(dialog().getByRole('button', { name: 'Turn the lock off' }))
    expect(await dialog().findByRole('alert')).toHaveTextContent('That isn’t your current passcode.')
    expect(gardenRepository.lockState()).toBe('unlocked')
    await user.clear(dialog().getByLabelText('Your passcode'))
    await user.type(dialog().getByLabelText('Your passcode'), PASSCODE)
    await user.click(dialog().getByRole('button', { name: 'Turn the lock off' }))
    expect(await screen.findByRole('heading', { name: 'The lock is off' })).toBeInTheDocument()
    expect(gardenRepository.lockState()).toBe('none')
    expect(await gardenRepository.readLock()).toBeUndefined()
    await user.click(dialog().getByRole('button', { name: 'Done' }))
    expect(screen.getByRole('button', { name: 'Lock my garden…' })).toBeInTheDocument()
  })

  it('adds a passkey where one can open the garden, and removes it', async () => {
    await lockedAndOpen()
    passkeys.offered = true
    passkeys.made = { ok: false, reason: 'no-prf' }
    const user = userEvent.setup()
    render(<LockSettings />)
    await user.click(await screen.findByRole('button', { name: 'Add a passkey…' }))
    await screen.findByRole('heading', { name: 'Add a passkey' }, { timeout: LAZY_PAGE_MS })
    await user.type(dialog().getByLabelText('Your passcode'), PASSCODE)
    await user.click(dialog().getByRole('button', { name: 'Add a passkey' }))
    expect(await dialog().findByRole('alert')).toHaveTextContent('This device’s passkeys can’t open the garden, so nothing was added.')
    expect((await gardenRepository.readLock())?.passkey).toBeUndefined()

    passkeys.made = { ok: true, credentialId: randomBytes(16), prfSalt: randomBytes(32), prfOutput: randomBytes(32) }
    await user.click(dialog().getByRole('button', { name: 'Add a passkey' }))
    expect(await screen.findByRole('heading', { name: 'Your passkey can open the garden' })).toBeInTheDocument()
    expect((await gardenRepository.readLock())?.passkey).toBeDefined()
    await user.click(dialog().getByRole('button', { name: 'Done' }))

    await user.click(await screen.findByRole('button', { name: 'Remove the passkey' }))
    expect(await screen.findByRole('status')).toHaveTextContent('The passkey no longer opens the garden.')
    expect((await gardenRepository.readLock())?.passkey).toBeUndefined()
  })

  it('closes a change on Escape (or Android’s back), focus back on the section', async () => {
    await lockedAndOpen()
    const user = userEvent.setup()
    render(<LockSettings />)
    await user.click(screen.getByRole('button', { name: 'Turn the lock off…' }))
    await screen.findByRole('heading', { name: 'Turn the lock off' }, { timeout: LAZY_PAGE_MS })
    screen.getByRole('dialog').dispatchEvent(new Event('cancel', { cancelable: true }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByRole('heading', { name: 'The garden lock' })).toHaveFocus()
    expect(gardenRepository.lockState()).toBe('unlocked')
  })

  it('offers no passkey where this browser cannot use one', async () => {
    await lockedAndOpen()
    render(<LockSettings />)
    await screen.findByRole('combobox', { name: 'Lock by itself' })
    expect(screen.queryByRole('button', { name: 'Add a passkey…' })).toBeNull()
  })
})
