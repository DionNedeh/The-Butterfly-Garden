import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { turnLockOn } from '../../lib/gardenLockActions'
import { openLockedCopy } from '../../lib/lockedCopy'
import { createInitialState } from '../../lib/progression'
import { newRecoveryCode } from '../../lib/recoveryCode'
import { storedCopy } from '../../lib/storedCopy'
import { gardenRepository, readImportedState } from '../../repository/gardenRepository'
import { ProtectedRestore, type ProtectedRestoreProps } from './ProtectedRestore'

// The real lock, quick: the count is the tests' only change.
vi.mock('../../lib/sealing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/sealing')>()
  return {
    ...actual,
    deriveKey: (secret: string, salt: Uint8Array) => actual.deriveKey(secret, salt, 1_000),
  }
})
// The real open, watched, so a test can hold one mid-way.
vi.mock('../../lib/lockedCopy', async (original) => {
  const actual = await original<typeof import('../../lib/lockedCopy')>()
  return { ...actual, openLockedCopy: vi.fn(actual.openLockedCopy) }
})

// The prompt's code is fetched when a sealed file is chosen; fetched once
// here, so no test's first wait is spent compiling it on a busy machine.
beforeAll(async () => {
  await import('./SealedBackupPrompt')
})

const PASSCODE = 'kingfisher at dawn'
const NOTE = 'Lavender tea at the window'

/** Safe mode's copy of a garden with the lock on, made once for every test. */
let COPY = ''
let WORDS: string[] = []
beforeAll(async () => {
  WORDS = newRecoveryCode()
  const garden = createInitialState('Robin', 'Quiet Corner')
  await gardenRepository.save({
    ...garden,
    moods: [
      {
        id: 'mood-1',
        localDate: '2026-10-20',
        level: 3,
        note: NOTE,
        createdAt: '2026-10-20T09:00:00.000Z',
        updatedAt: '2026-10-20T09:00:00.000Z',
      },
    ],
  })
  await turnLockOn(PASSCODE, WORDS)
  COPY = (await storedCopy()).text
  await gardenRepository.clear()
})

afterEach(() => {
  vi.mocked(openLockedCopy).mockClear()
  document.body.replaceChildren()
})

afterAll(() => {
  vi.restoreAllMocks()
})

async function renderPrompt(text = COPY, next: ProtectedRestoreProps['next'] = 'arrive') {
  const onOpened = vi.fn()
  const onClose = vi.fn()
  render(<ProtectedRestore text={text} next={next} onOpened={onOpened} onClose={onClose} />)
  const dialog = await screen.findByRole('dialog', { name: /copy/ })
  return { dialog, onOpened, onClose, user: userEvent.setup() }
}

/** The garden in what the prompt handed over. */
function gardenIn(plain: string) {
  return readImportedState(JSON.parse(plain))
}

describe('asking for a locked copy’s passcode', () => {
  it('opens calmly, heading first, and hands over the garden inside as a plain backup', async () => {
    const { dialog, onOpened, onClose, user } = await renderPrompt()
    await waitFor(() => expect(screen.getByRole('heading', { name: 'This copy is locked' })).toHaveFocus())
    expect(dialog).toHaveAccessibleDescription(
      /^It is a sealed copy of everything a locked garden had stored\. It opens with the passcode or recovery code that garden had when the copy was made, used only here and not kept\./,
    )
    const field = screen.getByLabelText('Passcode')
    expect(field).toHaveAttribute('type', 'password')
    expect(field).toHaveAttribute('autocomplete', 'current-password')

    await user.type(field, PASSCODE)
    await user.click(screen.getByRole('button', { name: 'Open the copy' }))
    await waitFor(() => expect(onOpened).toHaveBeenCalledOnce())
    const [plain, openedWith] = onOpened.mock.calls[0] as [string, string]
    expect(openedWith).toBe('lock')
    expect(gardenIn(plain)?.profile?.gardenName).toBe('Quiet Corner')
    expect(gardenIn(plain)?.moods[0].note).toBe(NOTE)
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
    // Nothing of the passcode is kept anywhere the page could find again.
    expect(window.localStorage.length).toBe(0)
    expect(window.sessionStorage.length).toBe(0)
  })

  it('says what follows as each screen does it, the lock included', async () => {
    const said = {
      preview:
        'Nothing is replaced until you have seen what the copy holds. The garden comes back without its old lock, under this garden’s lock if it has one.',
      replace:
        'Once it opens, it is restored straight away, in place of what is stored here. The garden comes back without its old lock, under this garden’s lock if it has one.',
      arrive:
        'Once it opens, the garden it holds is restored here straight away. The garden comes back without its lock; turn the lock on again in Settings if you want it.',
    }
    for (const next of ['preview', 'replace', 'arrive'] as const) {
      const { dialog } = await renderPrompt(COPY, next)
      const words = said[next].replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')
      expect(dialog).toHaveAccessibleDescription(new RegExp(`not kept\\. ${words}$`))
      cleanup()
      document.body.replaceChildren()
    }
  })

  it('asks for the passcode before trying anything', async () => {
    const { user } = await renderPrompt()
    await user.click(screen.getByRole('button', { name: 'Open the copy' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Enter the passcode of the garden this copy was made from.')
    expect(screen.getByLabelText('Passcode')).toHaveFocus()
    expect(openLockedCopy).not.toHaveBeenCalled()
  })

  it('says a wrong passcode is wrong, and nothing of how near, each time it is tried', async () => {
    const { onOpened, user } = await renderPrompt()
    const field = screen.getByLabelText('Passcode')
    await user.type(field, 'kingfisher at dusk')
    await user.click(screen.getByRole('button', { name: 'Open the copy' }))
    const wrong = 'That passcode does not open this copy. It needs the passcode the garden had when the copy was made.'
    const alert = await screen.findByText(wrong)
    expect(alert).toHaveAttribute('role', 'alert')
    expect(field).toHaveFocus()
    expect(field).toHaveAttribute('aria-invalid', 'true')

    // Tried again, said again in a new alert, once the slow open has finished.
    await user.click(screen.getByRole('button', { name: 'Open the copy' }))
    await waitFor(() => expect(openLockedCopy).toHaveBeenCalledTimes(2))
    await waitFor(() => {
      const again = screen.getByRole('alert')
      expect(again).not.toBe(alert)
      expect(again).toHaveTextContent(wrong)
    })
    expect(onOpened).not.toHaveBeenCalled()
  })

  it('shows the passcode when asked', async () => {
    const { user } = await renderPrompt()
    await user.click(screen.getByRole('checkbox', { name: 'Show passcode' }))
    expect(screen.getByLabelText('Passcode')).toHaveAttribute('type', 'text')
  })
})

describe('opening a locked copy with its recovery code', () => {
  it('takes the 24 words however they are pasted, and says plainly what is wrong with them', async () => {
    const { onOpened, user } = await renderPrompt()
    await user.click(screen.getByRole('button', { name: 'Use the recovery code instead' }))
    const field = screen.getByLabelText('Recovery code')
    await waitFor(() => expect(field).toHaveFocus())
    expect(field).toHaveAccessibleDescription('The 24 words from the recovery sheet, in order.')

    await user.click(screen.getByRole('button', { name: 'Open the copy' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Type the 24 words of your recovery code.')
    expect(openLockedCopy).not.toHaveBeenCalled()

    await user.paste(WORDS.slice(0, 23).join(' '))
    await user.click(screen.getByRole('button', { name: 'Open the copy' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('That is 23 words. A recovery code has 24.'))

    // Real words, but another code's.
    await user.clear(field)
    await user.paste(newRecoveryCode().join(' '))
    await user.click(screen.getByRole('button', { name: 'Open the copy' }))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Those words do not open this copy. Check them against your recovery sheet, in order.',
      ),
    )
    expect(onOpened).not.toHaveBeenCalled()

    // The sheet's own layout: numbered, a word a line.
    await user.clear(field)
    await user.paste(WORDS.map((word, index) => `${index + 1}. ${word}`).join('\n'))
    await user.click(screen.getByRole('button', { name: 'Open the copy' }))
    await waitFor(() => expect(onOpened).toHaveBeenCalledOnce())
    expect(onOpened.mock.calls[0][1]).toBe('lock')
    expect(gardenIn(onOpened.mock.calls[0][0] as string)?.moods[0].note).toBe(NOTE)
  })

  it('goes back to the passcode, its field taking focus', async () => {
    const { user } = await renderPrompt()
    await user.click(screen.getByRole('button', { name: 'Use the recovery code instead' }))
    await user.click(screen.getByRole('button', { name: 'Use the passcode instead' }))
    await waitFor(() => expect(screen.getByLabelText('Passcode')).toHaveFocus())
    expect(screen.queryByLabelText('Recovery code')).toBeNull()
  })
})

describe('while a locked copy opens, and when it cannot', () => {
  it('says it is working, and cannot be put away or switched meanwhile', async () => {
    let finish: (value: Awaited<ReturnType<typeof openLockedCopy>>) => void = () => undefined
    vi.mocked(openLockedCopy).mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)))
    const { dialog, onOpened, onClose, user } = await renderPrompt()
    await user.type(screen.getByLabelText('Passcode'), PASSCODE)
    await user.click(screen.getByRole('button', { name: 'Open the copy' }))
    expect(screen.getByRole('status')).toHaveTextContent('Opening the copy… this can take a few seconds.')
    expect(screen.getByRole('button', { name: 'Open the copy' })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByLabelText('Passcode')).toHaveAttribute('readonly')

    fireEvent(dialog, new Event('cancel', { cancelable: true }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await user.click(screen.getByRole('button', { name: 'Use the recovery code instead' }))
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Passcode')).toBeInTheDocument()

    await act(async () => {
      finish({ ok: true, text: '{"format":"the-butterfly-garden"}' })
      await Promise.resolve()
    })
    expect(onOpened).toHaveBeenCalledWith('{"format":"the-butterfly-garden"}', 'lock')
  })

  it('says so when the browser cannot open it at all', async () => {
    vi.mocked(openLockedCopy).mockRejectedValueOnce(new Error('No WebCrypto'))
    const { onOpened, user } = await renderPrompt()
    await user.type(screen.getByLabelText('Passcode'), PASSCODE)
    await user.click(screen.getByRole('button', { name: 'Open the copy' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This browser could not open the copy just now. Please try again.',
    )
    expect(onOpened).not.toHaveBeenCalled()
  })

  it('goes away saying why when the passcode opens the lock but the copy is damaged inside', async () => {
    vi.mocked(openLockedCopy).mockResolvedValueOnce({ ok: false, problem: 'damaged' })
    const { onOpened, onClose, user } = await renderPrompt()
    await user.type(screen.getByLabelText('Passcode'), PASSCODE)
    await user.click(screen.getByRole('button', { name: 'Open the copy' }))
    await waitFor(() =>
      expect(onClose).toHaveBeenCalledWith(
        'That opened the copy’s lock, but part of the copy is damaged, so it cannot be restored. Nothing has been changed.',
      ),
    )
    expect(onOpened).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('is put away by Cancel, or Escape, once', async () => {
    const { dialog, onClose, user } = await renderPrompt()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledWith()
    fireEvent(dialog, new Event('cancel', { cancelable: true }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('says a copy that could never open cannot, before any passcode, and why', async () => {
    const copy = JSON.parse(COPY) as { stores: { lock: { current: { version: number } } } }
    copy.stores.lock.current.version = 2
    const newer = await renderPrompt(JSON.stringify(copy, null, 2))
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'This locked copy cannot be opened' })).toHaveFocus(),
    )
    expect(newer.dialog).toHaveAccessibleDescription(
      'Its lock was made by a newer version of the garden, in a form this version cannot open. Update the app, then choose it again.',
    )
    expect(screen.queryByLabelText('Passcode')).toBeNull()
    await newer.user.click(screen.getByRole('button', { name: 'Close' }))
    expect(newer.onClose).toHaveBeenCalledWith()
    cleanup()

    const damaged = await renderPrompt(COPY.replace('"meta": {', '"metadata": {'))
    expect(damaged.dialog).toHaveAccessibleDescription(
      'It is damaged or incomplete, so it cannot be opened with any passcode or recovery code. Nothing has been changed.',
    )
    expect(openLockedCopy).not.toHaveBeenCalled()
  })
})
