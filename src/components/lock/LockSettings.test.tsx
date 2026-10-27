import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { openDB } from 'idb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeBroadcastChannel } from '../../test/fakeBroadcastChannel'
import { LAZY_PAGE_MS } from '../../test/lazyPage'
import { inertOutsideModals } from '../../test/modal'
import { readText } from '../../test/woff2'
import { NO_WAY_BACK, openLock } from '../../lib/gardenLock'
import { lockGarden, turnLockOn, unlockGarden } from '../../lib/gardenLockActions'
import { createInitialState } from '../../lib/progression'
import { newRecoveryCode } from '../../lib/recoveryCode'
import { randomBytes } from '../../lib/sealing'
import { gardenRepository, isSealed } from '../../repository/gardenRepository'
import { LockSettings } from './LockSettings'

/** Quick key derivations, which a test can also hold back while it looks. */
const derive = vi.hoisted(() => ({ held: undefined as Promise<void> | undefined }))
vi.mock('../../lib/sealing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/sealing')>()
  return {
    ...actual,
    deriveKey: async (secret: string, salt: Uint8Array) => {
      await derive.held
      return actual.deriveKey(secret, salt, 1_000)
    },
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

// Through a variable: Vite turns `new URL('…', import.meta.url)` written out
// in full into a served asset's address, and the file is wanted on disk.
const here = import.meta.url

// As in a browser: while a lock dialog is open, the rest of the page refuses
// focus, so focus handed back too soon is seen to land on nothing.
let restoreFocus: () => void

beforeEach(() => {
  vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel)
  restoreFocus = inertOutsideModals()
})

afterEach(async () => {
  cleanup()
  restoreFocus()
  derive.held = undefined
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
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

/** The dialog element itself, as a browser would close it. */
function dialogElement(): HTMLDialogElement {
  return screen.getByRole<HTMLDialogElement>('dialog')
}

const sectionHeading = () => screen.getByRole('heading', { name: 'The garden lock' })

/** Escape, or Android's back gesture, which sends the same cancel. */
function cancel() {
  act(() => {
    dialogElement().dispatchEvent(new Event('cancel', { cancelable: true }))
  })
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

    expect(dialog().getByText(/It stays open in this tab until you lock it/)).toBeInTheDocument()
    await user.click(dialog().getByRole('button', { name: 'Done' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    // The button that opened it is gone with the lock on: the section has focus.
    expect(sectionHeading()).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Lock now' })).toBeInTheDocument()
    expect(screen.getByText(/It is open in this tab now\./)).toBeInTheDocument()
  })

  it('speaks of the app, not of tabs, in the Android app', async () => {
    vi.stubEnv('VITE_PLATFORM', 'android')
    await storedGarden()
    const user = userEvent.setup()
    render(<LockSettings />)
    await user.click(screen.getByRole('button', { name: 'Lock my garden…' }))
    await user.type(await screen.findByLabelText('Passcode', {}, { timeout: LAZY_PAGE_MS }), PASSCODE)
    await user.type(dialog().getByLabelText('The same passcode again'), PASSCODE)
    await user.click(dialog().getByRole('button', { name: 'Next: your recovery code' }))
    const words = shownWords()
    await user.click(dialog().getByRole('button', { name: 'I have kept the words' }))
    await confirmTwo(user, words)
    await user.click(dialog().getByRole('button', { name: 'Lock my garden' }))
    await screen.findByRole('heading', { name: 'Your garden is locked' })
    expect(dialog().getByText(/It stays open in the app until you lock it/)).toBeInTheDocument()
    await user.click(dialog().getByRole('button', { name: 'Done' }))
    expect(screen.getByText(/It is open on this phone now\./)).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/\btabs?\b/)
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

  it('can be left before anything changes, with focus back on the button that opened it', async () => {
    await storedGarden()
    const user = userEvent.setup()
    render(<LockSettings />)
    const opener = screen.getByRole('button', { name: 'Lock my garden…' })
    await user.click(opener)
    await user.click(await screen.findByRole('button', { name: 'Not now' }, { timeout: LAZY_PAGE_MS }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(opener).toHaveFocus()
    expect(gardenRepository.lockState()).not.toBe('unlocked')
    expect(await gardenRepository.readLock()).toBeUndefined()

    // Escape, a step further on, the same.
    await user.click(opener)
    await user.type(await screen.findByLabelText('Passcode'), PASSCODE)
    await user.type(dialog().getByLabelText('The same passcode again'), PASSCODE)
    await user.click(dialog().getByRole('button', { name: 'Next: your recovery code' }))
    await screen.findByRole('heading', { name: 'Save your recovery code' })
    cancel()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(opener).toHaveFocus()
    expect(await gardenRepository.readLock()).toBeUndefined()
  })

  it('stays in sight while the garden is being sealed, even if the browser closes it', async () => {
    await storedGarden()
    const user = userEvent.setup()
    render(<LockSettings />)
    await user.click(screen.getByRole('button', { name: 'Lock my garden…' }))
    await user.type(await screen.findByLabelText('Passcode', {}, { timeout: LAZY_PAGE_MS }), PASSCODE)
    await user.type(dialog().getByLabelText('The same passcode again'), PASSCODE)
    await user.click(dialog().getByRole('button', { name: 'Next: your recovery code' }))
    const words = shownWords()
    await user.click(dialog().getByRole('button', { name: 'I have kept the words' }))
    await confirmTwo(user, words)

    let release = () => {}
    derive.held = new Promise<void>((resolve) => {
      release = resolve
    })
    await user.click(dialog().getByRole('button', { name: 'Lock my garden' }))
    expect(await dialog().findByText('Locking your garden… this can take a few seconds.')).toBeInTheDocument()
    const element = dialogElement()
    // Escape is refused while sealing; Chrome closes a modal on a second
    // Escape whatever its cancel event says.
    cancel()
    expect(element.open).toBe(true)
    act(() => element.close())
    expect(element.open).toBe(true)
    expect(screen.getByRole('heading', { name: 'Check two words' })).toHaveFocus()

    release()
    expect(await screen.findByRole('heading', { name: 'Your garden is locked' })).toBeInTheDocument()
    expect(dialogElement()).toBe(element)
    expect(element.open).toBe(true)
    await user.click(dialog().getByRole('button', { name: 'Done' }))
    expect(document.querySelector('dialog')).toBeNull()
    expect(sectionHeading()).toHaveFocus()
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

  it('changes the passcode, asking for the current one', async () => {
    const words = await lockedAndOpen()
    const user = userEvent.setup()
    render(<LockSettings />)
    const opener = screen.getByRole('button', { name: 'Change my passcode…' })
    await user.click(opener)
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
    await user.click(dialog().getByRole('button', { name: 'Done' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(opener).toHaveFocus()

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
    const opener = screen.getByRole('button', { name: 'Make a new recovery code…' })
    await user.click(opener)
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
    await user.click(dialog().getByRole('button', { name: 'Done' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(opener).toHaveFocus()

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
    // The button that opened it went with the lock: the section has focus.
    expect(sectionHeading()).toHaveFocus()
  })

  it('adds a passkey where one can open the garden, and removes it', async () => {
    await lockedAndOpen()
    passkeys.offered = true
    passkeys.made = { ok: false, reason: 'no-prf' }
    const user = userEvent.setup()
    render(<LockSettings />)
    const smallPrint = () => document.querySelector('.lock-small-print')?.textContent
    const opener = await screen.findByRole('button', { name: 'Add a passkey…' })
    expect(smallPrint()).toMatch(/can’t be read without your passcode or recovery code\./)
    await user.click(opener)
    await screen.findByRole('heading', { name: 'Add a passkey' }, { timeout: LAZY_PAGE_MS })
    await user.click(dialog().getByRole('button', { name: 'Cancel' }))
    expect(opener).toHaveFocus()

    await user.click(opener)
    await screen.findByRole('heading', { name: 'Add a passkey' })
    await user.type(dialog().getByLabelText('Your passcode'), PASSCODE)
    await user.click(dialog().getByRole('button', { name: 'Add a passkey' }))
    expect(await dialog().findByRole('alert')).toHaveTextContent('This device’s passkeys can’t open the garden, so nothing was added.')
    expect((await gardenRepository.readLock())?.passkey).toBeUndefined()

    passkeys.made = { ok: true, credentialId: randomBytes(16), prfSalt: randomBytes(32), prfOutput: randomBytes(32) }
    await user.click(dialog().getByRole('button', { name: 'Add a passkey' }))
    expect(await screen.findByRole('heading', { name: 'Your passkey can open the garden' })).toBeInTheDocument()
    expect((await gardenRepository.readLock())?.passkey).toBeDefined()
    await user.click(dialog().getByRole('button', { name: 'Done' }))
    // Its button goes once the passkey is found: the section keeps focus.
    const remove = await screen.findByRole('button', { name: 'Remove the passkey' })
    expect(opener).not.toBeInTheDocument()
    expect(sectionHeading()).toHaveFocus()
    // The small print stays true: the passkey is a third way in, behind this
    // device's own unlock.
    expect(smallPrint()).toMatch(
      /can’t be read without your passcode, your recovery code or your passkey, and the passkey opens it for anyone who can unlock this device with its fingerprint, face or screen lock\./,
    )

    await user.click(remove)
    expect(await screen.findByRole('status')).toHaveTextContent('The passkey no longer opens the garden.')
    expect((await gardenRepository.readLock())?.passkey).toBeUndefined()
    expect(sectionHeading()).toHaveFocus()
    expect(smallPrint()).toMatch(/can’t be read without your passcode or recovery code\./)
  })

  it('closes a change on Escape (or Android’s back), focus back on the button that opened it', async () => {
    await lockedAndOpen()
    const user = userEvent.setup()
    render(<LockSettings />)
    const opener = screen.getByRole('button', { name: 'Turn the lock off…' })
    await user.click(opener)
    await screen.findByRole('heading', { name: 'Turn the lock off' }, { timeout: LAZY_PAGE_MS })
    cancel()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(opener).toHaveFocus()
    expect(gardenRepository.lockState()).toBe('unlocked')
  })

  it('hands focus back from every way out of a change left undone', async () => {
    await lockedAndOpen()
    const user = userEvent.setup()
    render(<LockSettings />)
    const ways: Array<[opener: string, title: string, leave: string]> = [
      ['Change my passcode…', 'Change my passcode', 'Cancel'],
      ['Make a new recovery code…', 'Make a new recovery code', 'Cancel'],
      ['Turn the lock off…', 'Turn the lock off', 'Keep it locked'],
    ]
    for (const [name, title, leave] of ways) {
      const opener = screen.getByRole('button', { name })
      await user.click(opener)
      await screen.findByRole('heading', { name: title }, { timeout: LAZY_PAGE_MS })
      await user.click(dialog().getByRole('button', { name: leave }))
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(opener).toHaveFocus()
    }

    // A new recovery code left at its sheet keeps the old one.
    const opener = screen.getByRole('button', { name: 'Make a new recovery code…' })
    await user.click(opener)
    await user.type(await screen.findByLabelText('Your passcode'), PASSCODE)
    await user.click(dialog().getByRole('button', { name: 'Next: the new code' }))
    await screen.findByRole('heading', { name: 'Save your new recovery code' })
    await user.click(dialog().getByRole('button', { name: 'Cancel, keep my old code' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(opener).toHaveFocus()
    expect(gardenRepository.lockState()).toBe('unlocked')
  })

  it('lets go of a dialog the browser closes, so it can be opened again', async () => {
    await lockedAndOpen()
    const user = userEvent.setup()
    render(<LockSettings />)
    const opener = screen.getByRole('button', { name: 'Change my passcode…' })
    await user.click(opener)
    await screen.findByRole('heading', { name: 'Change my passcode' }, { timeout: LAZY_PAGE_MS })
    act(() => dialogElement().close())
    // Not left on the page, closed but still drawn.
    expect(document.querySelector('dialog')).toBeNull()
    expect(opener).toHaveFocus()
    await user.click(opener)
    expect(await screen.findByRole('heading', { name: 'Change my passcode' })).toHaveFocus()
    expect(dialogElement().open).toBe(true)
  })

  it('offers no passkey where this browser cannot use one', async () => {
    await lockedAndOpen()
    render(<LockSettings />)
    await screen.findByRole('combobox', { name: 'Lock by itself' })
    expect(screen.queryByRole('button', { name: 'Add a passkey…' })).toBeNull()
  })
})

describe('the lock dialogs’ stylesheet', () => {
  it('lays a dialog out only while it is open, so a closed one stays hidden', () => {
    const style = document.createElement('style')
    style.textContent = readText(new URL('./lock.css', here))
    document.head.append(style)
    try {
      const rules = [...(style.sheet?.cssRules ?? [])].filter((rule) => rule instanceof CSSStyleRule)
      const shown = rules.flatMap((rule) =>
        rule.style.display
          ? rule.selectorText
              .split(',')
              .map((selector) => selector.trim())
              // A rule for the dialog itself, not for something inside it.
              .filter((selector) => /\.lock-dialog(\[[^\]]*\])*$/.test(selector))
          : [],
      )
      expect(shown).toEqual(['.lock-dialog[open]'])
    } finally {
      style.remove()
    }
  })
})
