import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { openSealedBackup, sealBackup } from '../../lib/sealedBackup'
import { ProtectedRestore, type ProtectedRestoreProps } from './ProtectedRestore'

// The real lock and open, watched, so a test can hold one mid-way.
vi.mock('../../lib/sealedBackup', async (original) => {
  const actual = await original<typeof import('../../lib/sealedBackup')>()
  return { ...actual, openSealedBackup: vi.fn(actual.openSealedBackup) }
})

// The prompt's code is fetched when a sealed file is chosen; fetched once
// here, so no test's first wait is spent compiling it on a busy machine.
beforeAll(async () => {
  await import('./SealedBackupPrompt')
})

const PASSPHRASE = 'quiet meadow lantern'
const PLAIN = '{"format":"the-butterfly-garden","garden":{"note":"kept"}}'

async function sealedFile(text = PLAIN): Promise<string> {
  const outcome = await sealBackup(text, PASSPHRASE, { iterations: 1_000 })
  if (!outcome.ok) throw new Error('Not sealed')
  return outcome.text
}

async function renderPrompt(text: string, next: ProtectedRestoreProps['next'] = 'preview') {
  const onOpened = vi.fn()
  const onClose = vi.fn()
  const opener = document.createElement('button')
  opener.textContent = 'Restore a backup'
  document.body.append(opener)
  opener.focus()
  render(<ProtectedRestore text={text} next={next} onOpened={onOpened} onClose={onClose} />)
  const dialog = await screen.findByRole('dialog', { name: /protected/ })
  return { dialog, onOpened, onClose, opener, user: userEvent.setup() }
}

afterEach(() => {
  vi.mocked(openSealedBackup).mockClear()
  document.body.replaceChildren()
})

describe('asking for a protected backup’s passphrase', () => {
  it('opens calmly, heading first, and hands over exactly the backup inside', async () => {
    const { dialog, onOpened, onClose, user } = await renderPrompt(await sealedFile())
    await waitFor(() => expect(screen.getByRole('heading', { name: 'This backup is protected' })).toHaveFocus())
    expect(dialog).toHaveAccessibleDescription(/used only here, to open the file, and is not kept/)
    const field = screen.getByLabelText('Passphrase')
    expect(field).toHaveAttribute('type', 'password')
    expect(field).toHaveAttribute('autocomplete', 'current-password')

    await user.type(field, PASSPHRASE)
    await user.click(screen.getByRole('button', { name: 'Open the backup' }))
    await waitFor(() => expect(onOpened).toHaveBeenCalledWith(PLAIN, 'passphrase'))
    expect(onClose).not.toHaveBeenCalled()
    // Nothing of the passphrase is kept anywhere the page could find again.
    expect(window.localStorage.length).toBe(0)
    expect(window.sessionStorage.length).toBe(0)
  })

  it('says a wrong passphrase is wrong, and nothing of how near, each time it is tried', async () => {
    const { onOpened, user } = await renderPrompt(await sealedFile())
    const field = screen.getByLabelText('Passphrase')
    await user.type(field, 'quiet meadow lanterN')
    await user.click(screen.getByRole('button', { name: 'Open the backup' }))
    const alert = await screen.findByText('That passphrase does not open this backup. Check it and try again.')
    expect(alert).toHaveAttribute('role', 'alert')
    expect(field).toHaveFocus()
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(field).toHaveAccessibleDescription('Passphrases are exact: capitals, spaces and punctuation all count.')

    // Tried again, the same words are cleared and said again, so they are
    // heard again: in a new alert, once the slow open has finished, never
    // the empty one put up as it starts.
    await user.click(screen.getByRole('button', { name: 'Open the backup' }))
    await waitFor(() => expect(openSealedBackup).toHaveBeenCalledTimes(2))
    await waitFor(() => {
      const again = screen.getByRole('alert')
      expect(again).not.toBe(alert)
      expect(again).toHaveTextContent('That passphrase does not open this backup. Check it and try again.')
    })
    expect(onOpened).not.toHaveBeenCalled()

    await user.clear(field)
    await user.type(field, PASSPHRASE)
    await user.click(screen.getByRole('button', { name: 'Open the backup' }))
    await waitFor(() => expect(onOpened).toHaveBeenCalledWith(PLAIN, 'passphrase'))
  })

  it('promises a look before anything is replaced only where one follows', async () => {
    const said = {
      preview: 'Nothing is replaced until you have seen what the backup holds.',
      replace: 'Once it opens, it is restored straight away, in place of what is stored here.',
      arrive: 'Once it opens, the garden it holds is restored here straight away.',
    }
    for (const next of ['preview', 'replace', 'arrive'] as const) {
      const { dialog } = await renderPrompt(await sealedFile(), next)
      expect(dialog).toHaveAccessibleDescription(
        `Enter the passphrase it was saved with. It is used only here, to open the file, and is not kept. ${said[next]}`,
      )
      cleanup()
      document.body.replaceChildren()
    }
  })

  it('asks for the passphrase before trying anything', async () => {
    const { user } = await renderPrompt(await sealedFile())
    await user.click(screen.getByRole('button', { name: 'Open the backup' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Enter the passphrase this backup was saved with.')
    expect(screen.getByLabelText('Passphrase')).toHaveFocus()
    expect(openSealedBackup).not.toHaveBeenCalled()
  })

  it('shows the passphrase when asked', async () => {
    const { user } = await renderPrompt(await sealedFile())
    await user.click(screen.getByRole('checkbox', { name: 'Show passphrase' }))
    expect(screen.getByLabelText('Passphrase')).toHaveAttribute('type', 'text')
  })

  it('says it is working while it opens, and cannot be put away meanwhile', async () => {
    let finish: (value: string | undefined) => void = () => undefined
    vi.mocked(openSealedBackup).mockImplementationOnce(
      () => new Promise((resolve) => (finish = resolve)),
    )
    const { dialog, onOpened, onClose, user } = await renderPrompt(await sealedFile())
    await user.type(screen.getByLabelText('Passphrase'), PASSPHRASE)
    await user.click(screen.getByRole('button', { name: 'Open the backup' }))
    expect(screen.getByRole('status')).toHaveTextContent(
      'Opening the backup with your passphrase. This can take a few seconds…',
    )
    expect(screen.getByRole('button', { name: 'Open the backup' })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByLabelText('Passphrase')).toHaveAttribute('readonly')

    fireEvent(dialog, new Event('cancel', { cancelable: true }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).not.toHaveBeenCalled()

    await act(async () => {
      finish(PLAIN)
      await Promise.resolve()
    })
    expect(onOpened).toHaveBeenCalledWith(PLAIN, 'passphrase')
  })

  it('says so when the browser cannot open it at all', async () => {
    vi.mocked(openSealedBackup).mockRejectedValueOnce(new Error('No WebCrypto'))
    const { onOpened, user } = await renderPrompt(await sealedFile())
    await user.type(screen.getByLabelText('Passphrase'), PASSPHRASE)
    await user.click(screen.getByRole('button', { name: 'Open the backup' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This browser could not open the backup just now. Please try again.',
    )
    expect(onOpened).not.toHaveBeenCalled()
  })

  it('is put away by Cancel, once', async () => {
    const { dialog, onClose, user } = await renderPrompt(await sealedFile())
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledWith()
    // Whatever comes after, the screen hears of it only the once.
    fireEvent(dialog, new Event('cancel', { cancelable: true }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('is put away by Escape, or Android’s back gesture', async () => {
    const { dialog, onClose } = await renderPrompt(await sealedFile())
    fireEvent(dialog, new Event('cancel', { cancelable: true }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})

describe('where focus goes as the prompt goes', () => {
  /** A screen that takes the prompt away once it is done, as each one does. */
  function Screen({
    text,
    returnTo,
    onOpened = () => undefined,
  }: {
    text: string
    returnTo?: HTMLElement
    onOpened?: (plain: string) => void
  }) {
    const [open, setOpen] = useState(true)
    return open ? (
      <ProtectedRestore
        text={text}
        next="replace"
        returnFocus={returnTo && (() => returnTo)}
        onOpened={(plain) => {
          setOpen(false)
          onOpened(plain)
        }}
        onClose={() => setOpen(false)}
      />
    ) : null
  }

  it('is gone, and opens nothing, when the browser closes it mid-way', async () => {
    let finish: (value: string | undefined) => void = () => undefined
    vi.mocked(openSealedBackup).mockImplementationOnce(
      () => new Promise((resolve) => (finish = resolve)),
    )
    const onOpened = vi.fn()
    render(<Screen text={await sealedFile()} onOpened={onOpened} />)
    const dialog = await screen.findByRole('dialog')
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Passphrase'), PASSPHRASE)
    await user.click(screen.getByRole('button', { name: 'Open the backup' }))
    act(() => {
      dialog.dispatchEvent(new Event('close'))
    })
    expect(screen.queryByRole('dialog')).toBeNull()
    await act(async () => {
      finish(PLAIN)
      await Promise.resolve()
    })
    expect(onOpened).not.toHaveBeenCalled()
  })

  it('goes back to what had it before', async () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    render(<Screen text={await sealedFile()} />)
    await screen.findByRole('dialog')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(opener).toHaveFocus())
  })

  it('goes to the file field when nothing had it, never to the page itself', async () => {
    const field = document.createElement('input')
    field.type = 'file'
    document.body.append(field)
    render(<Screen text={await sealedFile()} returnTo={field} />)
    await screen.findByRole('dialog')
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Passphrase'), PASSPHRASE)
    await user.click(screen.getByRole('button', { name: 'Open the backup' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(field).toHaveFocus())
  })
})

describe('a protected backup that could never open', () => {
  it('says a newer version’s file needs an update, before any passphrase', async () => {
    const value = JSON.parse(await sealedFile()) as Record<string, unknown>
    const { onClose, user } = await renderPrompt(JSON.stringify({ ...value, formatVersion: 2 }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'This protected backup cannot be opened' })).toHaveFocus())
    expect(screen.getByText(/made by a newer version of the garden.*Update the app/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Passphrase')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledWith()
  })

  it('says a damaged file is damaged, and that nothing changed', async () => {
    const file = await sealedFile()
    await renderPrompt(file.slice(0, file.length - 40))
    expect(screen.getByText(/damaged or incomplete.*Nothing has been changed/)).toBeInTheDocument()
    expect(openSealedBackup).not.toHaveBeenCalled()
  })
})
