import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RECOVERY_WORDS } from '../../data/recoveryWords'
import { sealedKind } from '../../lib/backupFile'
import { saveTextFile } from '../../lib/download'
import { codeHoldsTogether } from '../../lib/moveCode'
import { openSealedBackup, readSealedBackup, sealBackup } from '../../lib/sealedBackup'
import { shareTextFile } from '../../lib/shareFile'
import { MoveDialog } from './MoveDialog'

// The real lock, at a count that keeps each case quick: the dialog asks for
// no count of its own, so a gardener's file gets the full 600,000.
vi.mock('../../lib/sealedBackup', async (original) => {
  const actual = await original<typeof import('../../lib/sealedBackup')>()
  return {
    ...actual,
    sealBackup: vi.fn((text: string, secret: string, options: Parameters<typeof actual.sealBackup>[2]) =>
      actual.sealBackup(text, secret, { ...options, iterations: 1_000 }),
    ),
  }
})
vi.mock('../../lib/download', async (original) => ({
  ...(await original<typeof import('../../lib/download')>()),
  saveTextFile: vi.fn(),
}))
vi.mock('../../lib/shareFile', () => ({ shareTextFile: vi.fn() }))

const PLAIN = '{"format":"the-butterfly-garden","garden":{"note":"A line only the file keeps"}}'
const save = vi.mocked(saveTextFile)
const share = vi.mocked(shareTextFile)

function renderDialog(
  options: { share?: boolean; lockOn?: boolean; exported?: string | undefined; leftOut?: string } = {},
) {
  const onClose = vi.fn()
  const onExportGarden = vi.fn(() => {
    const text = 'exported' in options ? options.exported : PLAIN
    return Promise.resolve(text === undefined ? undefined : { text, leftOut: options.leftOut })
  })
  const opener = document.createElement('button')
  opener.textContent = 'Move my garden to another device…'
  document.body.append(opener)
  opener.focus()
  render(
    <MoveDialog
      share={options.share}
      lockOn={options.lockOn}
      onExportGarden={onExportGarden}
      onClose={onClose}
    />,
  )
  return { onClose, onExportGarden, opener, user: userEvent.setup() }
}

/** The words the dialog shows, in order. */
function shownWords(): string[] {
  const list = screen.getByRole('list', { name: 'The one-time code, 12 words' })
  return within(list)
    .getAllByRole('listitem')
    .map((item) => item.textContent ?? '')
}

async function makeAndDownload(user: ReturnType<typeof userEvent.setup>) {
  save.mockResolvedValue('started')
  await user.click(screen.getByRole('button', { name: 'Make the move file' }))
  const download = await screen.findByRole('button', { name: 'Download the move file' })
  await waitFor(() => expect(download).toHaveFocus())
  await user.click(download)
  await screen.findByRole('heading', { name: 'Your one-time code' })
}

afterEach(() => {
  save.mockReset()
  share.mockReset()
  vi.mocked(sealBackup).mockClear()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  document.body.replaceChildren()
})

// A busy machine (a CI runner, other suites at once) is given time for whole flows.
describe('before the file', { timeout: 20_000 }, () => {
  it('opens on its heading and says plainly why the file can travel any way', () => {
    renderDialog()
    const dialog = screen.getByRole('dialog', { name: 'Move my garden to another device' })
    expect(screen.getByRole('heading', { name: 'Move my garden to another device' })).toHaveFocus()
    expect(dialog).toHaveAccessibleDescription(/a copy of your whole garden, locked with a one-time code/)
    expect(dialog).toHaveTextContent(/because the code never travels with it/)
    expect(dialog).not.toHaveTextContent(/garden lock/)
  })

  it('says the lock stays behind, while this garden has one', () => {
    renderDialog({ lockOn: true })
    expect(
      screen.getByText(
        'Your garden lock stays on this device. The garden on your new device will not be locked until you turn the lock on there, in Settings.',
      ),
    ).toBeInTheDocument()
  })

  it('makes nothing while the stored garden cannot be read', async () => {
    const { user } = renderDialog({ exported: undefined })
    await user.click(screen.getByRole('button', { name: 'Make the move file' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(
      'Making a move file is paused while the stored garden cannot be read.',
    ))
    expect(screen.getByRole('button', { name: 'Make the move file' })).toHaveFocus()
    expect(sealBackup).not.toHaveBeenCalled()
  })

  it('says so when the garden is too large to lock, or the browser cannot', async () => {
    const { user } = renderDialog()
    vi.mocked(sealBackup).mockResolvedValueOnce({ ok: false, problem: 'too-large' })
    await user.click(screen.getByRole('button', { name: 'Make the move file' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(
      'This garden is too large for a move file that could be opened again. Download the plain backup instead',
    ))
    vi.mocked(sealBackup).mockRejectedValueOnce(new Error('no crypto'))
    await user.click(screen.getByRole('button', { name: 'Make the move file' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(
      'This browser could not make the move file just now. Please try again.',
    ))
  })

  it('cannot be put away while the file is being made', async () => {
    let finish: (value: { text: string } | undefined) => void = () => undefined
    const onClose = vi.fn()
    const exported = new Promise<{ text: string } | undefined>((resolve) => {
      finish = resolve
    })
    render(<MoveDialog onExportGarden={() => exported} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Make the move file' }))
    expect(await screen.findByText('Making the move file. This can take a few seconds…')).toBeInTheDocument()
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).not.toHaveBeenCalled()
    await act(async () => {
      finish({ text: PLAIN })
      await exported
    })
    expect(await screen.findByRole('button', { name: 'Download the move file' })).toBeInTheDocument()
  })
})

describe('the move file and its code', { timeout: 20_000 }, () => {
  it('makes a protected backup locked with the 12 words, marked as a move file, then shows them once', async () => {
    const { onClose, onExportGarden, user } = renderDialog()
    await makeAndDownload(user)
    expect(onExportGarden).toHaveBeenCalledOnce()

    const [fileName, type, text] = save.mock.calls[0]
    expect(fileName).toMatch(/^butterfly-garden-move-\d{4}-\d{2}-\d{2}\.json$/)
    expect(type).toBe('application/json')
    expect(sealedKind(text)).toBe('backup')
    expect(text).not.toContain('A line only the file keeps')
    // Asked for no count of its own: a gardener's file is locked at the full count.
    expect(vi.mocked(sealBackup).mock.calls[0][2]).toEqual({ opensWith: 'move-code' })

    const words = shownWords()
    expect(words).toHaveLength(12)
    for (const word of words) expect(RECOVERY_WORDS).toContain(word)
    expect(await codeHoldsTogether(words)).toBe(true)
    // The code is not in the file.
    for (const word of new Set(words)) expect(text).not.toMatch(new RegExp(`\\b${word}\\b`))

    // The words open the file, and the file holds exactly the backup.
    const read = readSealedBackup(text)
    expect(read.ok && read.backup.opensWith).toBe('move-code')
    if (!read.ok) return
    expect(await openSealedBackup(read.backup, words.join(' '))).toBe(PLAIN)

    expect(screen.getByRole('heading', { name: 'Your one-time code' })).toHaveFocus()
    expect(screen.getByRole('status')).toHaveTextContent('Move file downloading. Check your downloads.')
    expect(
      screen.getByText(/This code is shown once, only on this screen, and is kept nowhere\./),
    ).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })


  it('stores nothing: the code and the file are gone when it closes', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const openDatabase = vi.spyOn(indexedDB, 'open')
    const onClose = vi.fn()
    // As Settings holds it: closing takes it out of the page.
    function Host() {
      const [open, setOpen] = useState(true)
      return open ? (
        <MoveDialog
          onExportGarden={() => ({ text: PLAIN })}
          onClose={() => {
            onClose()
            setOpen(false)
          }}
        />
      ) : null
    }
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    render(<Host />)
    const user = userEvent.setup()
    await makeAndDownload(user)
    const words = shownWords()
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(onClose).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(setItem).not.toHaveBeenCalled()
    expect(openDatabase).not.toHaveBeenCalled()
    expect(window.localStorage.length).toBe(0)
    expect(window.sessionStorage.length).toBe(0)
    expect(document.body.textContent).not.toContain(words.join(''))
    expect(opener).toHaveFocus()
  })

  it('shares the file where the browser can, and says what a photo left out', async () => {
    share.mockResolvedValue('shared')
    const { user } = renderDialog({ share: true, leftOut: 'One photo could not be read and was left out.' })
    await user.click(screen.getByRole('button', { name: 'Make the move file' }))
    const shareButton = await screen.findByRole('button', { name: 'Share the move file…' })
    await waitFor(() => expect(shareButton).toHaveFocus())
    expect(screen.getByRole('button', { name: 'Download the move file' })).toBeInTheDocument()
    await user.click(shareButton)
    await screen.findByRole('heading', { name: 'Your one-time code' })
    const [fileName, type, text, title] = share.mock.calls[0]
    expect(fileName).toMatch(/^butterfly-garden-move-/)
    expect(type).toBe('application/json')
    expect(sealedKind(text)).toBe('backup')
    expect(title).toBe('The Butterfly Garden move file')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Move file shared. One photo could not be read and was left out.',
    )
  })

  it('waits for another try when the share sheet is closed, and says when sharing fails', async () => {
    const { user } = renderDialog({ share: true })
    await user.click(screen.getByRole('button', { name: 'Make the move file' }))
    const shareButton = await screen.findByRole('button', { name: 'Share the move file…' })
    share.mockResolvedValueOnce('cancelled')
    await user.click(shareButton)
    expect(screen.queryByRole('heading', { name: 'Your one-time code' })).toBeNull()
    expect(screen.getByRole('alert')).toHaveTextContent('')

    share.mockRejectedValueOnce(new Error('no gesture'))
    await user.click(shareButton)
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(
      'This browser would not share the file. Download it instead.',
    ))
    save.mockRejectedValueOnce(new Error('blocked'))
    await user.click(screen.getByRole('button', { name: 'Download the move file' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('This browser would not start the download.'))
    expect(screen.queryByRole('heading', { name: 'Your one-time code' })).toBeNull()
  })

  it('sends the same file another way, with the same code', async () => {
    const { user } = renderDialog()
    await makeAndDownload(user)
    const words = shownWords()
    await user.click(screen.getByRole('button', { name: 'Send the file another way' }))
    const download = screen.getByRole('button', { name: 'Download the move file' })
    expect(download).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Back to the code' }))
    expect(shownWords()).toEqual(words)
    await user.click(screen.getByRole('button', { name: 'Send the file another way' }))
    await user.click(screen.getByRole('button', { name: 'Download the move file' }))
    await screen.findByRole('heading', { name: 'Your one-time code' })
    expect(shownWords()).toEqual(words)
    expect(save.mock.calls[1][2]).toBe(save.mock.calls[0][2])
    expect(sealBackup).toHaveBeenCalledOnce()
  })

  it('reminds a locked garden that the lock does not travel, beside the code', async () => {
    const { user } = renderDialog({ lockOn: true })
    await makeAndDownload(user)
    expect(screen.getByText(/will not be locked until you turn the lock on there/)).toBeInTheDocument()
  })

  it('is put away by Escape or Android’s back with the code forgotten', async () => {
    const { onClose, user } = renderDialog()
    await makeAndDownload(user)
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})

describe('in the Android app', { timeout: 20_000 }, () => {
  it('saves through the app’s own screen, and says when nothing was saved', async () => {
    vi.stubEnv('VITE_PLATFORM', 'android')
    const { user } = renderDialog()
    expect(screen.getByRole('dialog')).toHaveTextContent('Send the file to your new device any way you like')
    await user.click(screen.getByRole('button', { name: 'Make the move file' }))
    const saveButton = await screen.findByRole('button', { name: 'Save the move file' })
    expect(screen.queryByRole('button', { name: /Share/ })).toBeNull()
    expect(screen.getByRole('dialog')).toHaveAccessibleDescription(/Save it somewhere your new device can reach/)

    save.mockResolvedValueOnce('cancelled')
    await user.click(saveButton)
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Nothing was saved. Choose Save again to pick a place.'))

    save.mockRejectedValueOnce(new Error('denied'))
    await user.click(saveButton)
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(
      'The move file could not be saved there. Try choosing another place.',
    ))

    save.mockResolvedValueOnce('saved')
    await user.click(saveButton)
    await screen.findByRole('heading', { name: 'Your one-time code' })
    expect(screen.getByRole('status')).toHaveTextContent('Move file saved.')
  })

  it('says to save the plain backup when the garden is too large', async () => {
    vi.stubEnv('VITE_PLATFORM', 'android')
    const { user } = renderDialog()
    vi.mocked(sealBackup).mockResolvedValueOnce({ ok: false, problem: 'too-large' })
    await user.click(screen.getByRole('button', { name: 'Make the move file' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/Save the plain backup instead/))
  })
})
