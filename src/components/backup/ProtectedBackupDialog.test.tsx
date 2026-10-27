import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { sealedKind } from '../../lib/backupFile'
import { saveTextFile } from '../../lib/download'
import {
  openSealedBackup,
  readSealedBackup,
  sealBackup,
  type SealOutcome,
} from '../../lib/sealedBackup'
import { shareTextFile } from '../../lib/shareFile'
import { ProtectedBackupDialog } from './ProtectedBackupDialog'

// The real lock, at a count that keeps each case quick. That the dialog asks
// for no count of its own, and so gets 600,000, is checked below; that the
// count cannot be lowered outside tests, in lib/sealedBackup's tests.
vi.mock('../../lib/sealedBackup', async (original) => {
  const actual = await original<typeof import('../../lib/sealedBackup')>()
  return {
    ...actual,
    sealBackup: vi.fn((text: string, passphrase: string, options: Parameters<typeof actual.sealBackup>[2]) =>
      actual.sealBackup(text, passphrase, { ...options, iterations: 1_000 }),
    ),
  }
})
vi.mock('../../lib/download', async (original) => ({
  ...(await original<typeof import('../../lib/download')>()),
  saveTextFile: vi.fn(),
}))
vi.mock('../../lib/shareFile', () => ({ shareTextFile: vi.fn() }))

const PASSPHRASE = 'quiet meadow lantern'
const PLAIN = '{"format":"the-butterfly-garden","garden":{"note":"A line only the file keeps"}}'
const save = vi.mocked(saveTextFile)
const share = vi.mocked(shareTextFile)

function renderDialog(
  options: { share?: boolean; exported?: string | undefined } = {},
) {
  const onClose = vi.fn()
  const onExportGarden = vi.fn(() => {
    const text = 'exported' in options ? options.exported : PLAIN
    return Promise.resolve(text === undefined ? undefined : { text })
  })
  render(
    <ProtectedBackupDialog share={options.share} onExportGarden={onExportGarden} onClose={onClose} />,
  )
  return { onClose, onExportGarden, user: userEvent.setup() }
}

async function choose(user: ReturnType<typeof userEvent.setup>, first: string, second = first) {
  await user.type(screen.getByLabelText('Passphrase'), first)
  await user.type(screen.getByLabelText('Passphrase again'), second)
  await user.click(screen.getByRole('button', { name: 'Lock the backup' }))
}

/** The text handed to the save path, checked to be a protected backup. */
function savedText(): string {
  const [, , text] = save.mock.calls[0]
  expect(sealedKind(text)).toBe('backup')
  return text
}

afterEach(() => {
  save.mockReset()
  share.mockReset()
  vi.mocked(sealBackup).mockClear()
  vi.unstubAllEnvs()
})

describe('choosing a passphrase', () => {
  it('opens on its heading, and says plainly that a forgotten passphrase cannot be got round', () => {
    renderDialog()
    const dialog = screen.getByRole('dialog', { name: 'Download a protected backup' })
    expect(screen.getByRole('heading', { name: 'Download a protected backup' })).toHaveFocus()
    expect(dialog).toHaveAccessibleDescription(
      /nobody can open the file: not this app, not us, and not you if it is forgotten\. It is never stored/,
    )
    for (const label of ['Passphrase', 'Passphrase again']) {
      expect(screen.getByLabelText(label)).toHaveAttribute('type', 'password')
      expect(screen.getByLabelText(label)).toHaveAttribute('autocomplete', 'new-password')
    }
  })

  it('says how strong it looks as it is typed', async () => {
    const { user } = renderDialog()
    const field = screen.getByLabelText('Passphrase')
    expect(field).toHaveAccessibleDescription(/^At least 8 characters\./)
    await user.type(field, 'pass')
    expect(field).toHaveAccessibleDescription('Too short: at least 8 characters.')
    await user.type(field, 'word')
    expect(field).toHaveAccessibleDescription(/^Weak: /)
    await user.clear(field)
    await user.type(field, 'butterflygarden1')
    expect(field).toHaveAccessibleDescription(/^Weak: /)
    await user.clear(field)
    await user.type(field, PASSPHRASE)
    expect(field).toHaveAccessibleDescription(
      'Good: long, with no pattern this check can see. Longer and less guessable is stronger still.',
    )
  })

  it('asks for at least eight characters before doing anything', async () => {
    const { onExportGarden, user } = renderDialog()
    await choose(user, 'short')
    expect(screen.getByRole('alert')).toHaveTextContent('Use at least 8 characters for the passphrase.')
    expect(screen.getByLabelText('Passphrase')).toHaveFocus()
    expect(screen.getByLabelText('Passphrase')).toHaveAttribute('aria-invalid', 'true')
    expect(onExportGarden).not.toHaveBeenCalled()
  })

  it('asks for the same passphrase twice', async () => {
    const { onExportGarden, user } = renderDialog()
    await choose(user, PASSPHRASE, 'quiet meadow lanterns')
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The two passphrases are not the same. Type the second one again.',
    )
    expect(screen.getByLabelText('Passphrase again')).toHaveFocus()
    expect(screen.getByLabelText('Passphrase again')).toHaveAttribute('aria-invalid', 'true')
    expect(onExportGarden).not.toHaveBeenCalled()
  })

  it('shows both passphrases when asked', async () => {
    const { user } = renderDialog()
    await user.click(screen.getByRole('checkbox', { name: 'Show passphrases' }))
    expect(screen.getByLabelText('Passphrase')).toHaveAttribute('type', 'text')
    expect(screen.getByLabelText('Passphrase again')).toHaveAttribute('type', 'text')
  })
})

describe('locking and handing over the file', () => {
  it('says what it is doing, then hands over a file only the passphrase opens', async () => {
    let release: () => void = () => undefined
    const held = new Promise<void>((resolve) => (release = resolve))
    vi.mocked(sealBackup).mockImplementationOnce(async (text, passphrase, options) => {
      options?.onStep?.('deriving')
      await held
      const { sealBackup: real } = await vi.importActual<typeof import('../../lib/sealedBackup')>(
        '../../lib/sealedBackup',
      )
      return real(text, passphrase, { ...options, iterations: 1_000 })
    })
    save.mockResolvedValueOnce('started')
    const { onClose, onExportGarden, user } = renderDialog()
    await choose(user, PASSPHRASE)

    expect(screen.getByRole('status')).toHaveTextContent(
      'Turning your passphrase into a key. This can take a few seconds…',
    )
    expect(screen.getByRole('button', { name: 'Lock the backup' })).toHaveAttribute('aria-disabled', 'true')
    // Not put away while it works, by Escape or by Cancel.
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).not.toHaveBeenCalled()

    await act(async () => {
      release()
      await held
    })
    const download = await screen.findByRole('button', { name: 'Download protected backup' })
    await waitFor(() => expect(download).toHaveFocus())
    expect(screen.getByText(/ready\. It opens only with the passphrase you just chose/)).toBeInTheDocument()
    // The passphrase has gone with its fields.
    expect(screen.queryByLabelText('Passphrase')).toBeNull()
    expect(onExportGarden).toHaveBeenCalledOnce()
    expect(sealBackup).toHaveBeenCalledWith(PLAIN, PASSPHRASE, expect.not.objectContaining({ iterations: expect.anything() }))

    await user.click(download)
    expect(save).toHaveBeenCalledWith(
      expect.stringMatching(/^butterfly-garden-protected-\d{4}-\d{2}-\d{2}\.json$/),
      'application/json',
      expect.any(String),
    )
    const text = savedText()
    expect(text).not.toContain('A line only the file keeps')
    expect(text).not.toContain(PASSPHRASE)
    const read = readSealedBackup(text)
    expect(read.ok && (await openSealedBackup(read.backup, PASSPHRASE))).toBe(PLAIN)

    expect(onClose).toHaveBeenCalledWith({
      note: 'Protected backup started. Check your downloads, and keep its passphrase somewhere safe, apart from the file.',
      madeAt: expect.any(Date),
    })
    expect(window.localStorage.length).toBe(0)
  })

  it('says, with the file, which photos the backup had to leave out', async () => {
    const leftOut = 'One photo in the field book could not be read on this device, so the file keeps its sighting without it.'
    save.mockResolvedValueOnce('started')
    const onClose = vi.fn()
    render(
      <ProtectedBackupDialog
        onExportGarden={() => Promise.resolve({ text: PLAIN, leftOut })}
        onClose={onClose}
      />,
    )
    const user = userEvent.setup()
    await choose(user, PASSPHRASE)
    await user.click(await screen.findByRole('button', { name: 'Download protected backup' }, { timeout: 8000 }))
    await waitFor(() =>
      expect(onClose).toHaveBeenCalledWith({
        note: `Protected backup started. Check your downloads, and keep its passphrase somewhere safe, apart from the file. ${leftOut}`,
        madeAt: expect.any(Date),
      }),
    )
  })

  it('says why when the garden cannot be saved just now', async () => {
    const { onClose, user } = renderDialog({ exported: undefined })
    await choose(user, PASSPHRASE)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Saving a backup is paused while the stored garden cannot be read.',
    )
    expect(sealBackup).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('refuses a garden too large to open again, pointing to the plain backup', async () => {
    vi.mocked(sealBackup).mockResolvedValueOnce({ ok: false, problem: 'too-large' } satisfies SealOutcome)
    const { user } = renderDialog()
    await choose(user, PASSPHRASE)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This garden is too large for a protected backup that could be opened again. Download the plain backup instead.',
    )
    expect(screen.getByLabelText('Passphrase')).toHaveFocus()
  })

  it('says so when the browser cannot lock it', async () => {
    vi.mocked(sealBackup).mockRejectedValueOnce(new Error('No WebCrypto'))
    const { user } = renderDialog()
    await choose(user, PASSPHRASE)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This browser could not lock the backup just now. Please try again.',
    )
  })

  it('says so when the browser will not start the download, and keeps the file for another try', async () => {
    save.mockRejectedValueOnce(new Error('blocked'))
    const { onClose, user } = renderDialog()
    await choose(user, PASSPHRASE)
    await user.click(await screen.findByRole('button', { name: 'Download protected backup' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('This browser would not start the download.')
    save.mockResolvedValueOnce('started')
    await user.click(screen.getByRole('button', { name: 'Download protected backup' }))
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
    expect(sealBackup).toHaveBeenCalledOnce()
  })

  it('is put away by Cancel, keeping nothing', async () => {
    const { onClose, onExportGarden, user } = renderDialog()
    await user.type(screen.getByLabelText('Passphrase'), PASSPHRASE)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledWith()
    expect(onExportGarden).not.toHaveBeenCalled()
  })
})

describe('a close the dialog did not ask for', () => {
  it('is reported once, so the screen never keeps a dialog it cannot show', async () => {
    const { onClose, user } = renderDialog()
    // As Chrome does on a second Escape, whatever the cancel event says.
    screen.getByRole('dialog').dispatchEvent(new Event('close'))
    expect(onClose).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledWith()
    // Its own close afterwards says nothing more.
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})

describe('in the Android app', () => {
  it('saves through the app’s own save screen, and says what happened', async () => {
    vi.stubEnv('VITE_PLATFORM', 'android')
    const { onClose, user } = renderDialog()
    expect(screen.getByRole('heading', { name: 'Save a protected backup' })).toBeInTheDocument()
    await choose(user, PASSPHRASE)
    const button = await screen.findByRole('button', { name: 'Save protected backup' })

    save.mockResolvedValueOnce('cancelled')
    await user.click(button)
    expect(await screen.findByRole('alert')).toHaveTextContent('Nothing was saved. Choose Save again to pick a place.')
    expect(onClose).not.toHaveBeenCalled()

    save.mockRejectedValueOnce(new Error('disk full'))
    await user.click(button)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The protected backup could not be saved there. Try choosing another place.',
    )

    save.mockResolvedValueOnce('saved')
    await user.click(button)
    await waitFor(() =>
      expect(onClose).toHaveBeenCalledWith({
        note: 'Protected backup saved. Keep its passphrase somewhere safe, apart from the file.',
        madeAt: expect.any(Date),
      }),
    )
    savedText()
  })

  it('points to the plain backup by its Android name when the garden is too large', async () => {
    vi.stubEnv('VITE_PLATFORM', 'android')
    vi.mocked(sealBackup).mockResolvedValueOnce({ ok: false, problem: 'too-large' })
    const { user } = renderDialog()
    await choose(user, PASSPHRASE)
    expect(await screen.findByRole('alert')).toHaveTextContent(/Save the plain backup instead\./)
  })
})

describe('sharing', () => {
  it('hands the file to the share sheet, or lets it be downloaded instead', async () => {
    const { onClose, user } = renderDialog({ share: true })
    expect(screen.getByRole('heading', { name: 'Share a protected backup' })).toBeInTheDocument()
    await choose(user, PASSPHRASE)
    const button = await screen.findByRole('button', { name: 'Share protected backup' })
    await waitFor(() => expect(button).toHaveFocus())

    // Closing the share sheet is a choice: nothing is said, and the file waits.
    share.mockResolvedValueOnce('cancelled')
    await user.click(button)
    await waitFor(() => expect(share).toHaveBeenCalledOnce())
    expect(screen.getByRole('alert')).toBeEmptyDOMElement()
    expect(onClose).not.toHaveBeenCalled()

    share.mockRejectedValueOnce(new Error('NotAllowedError'))
    await user.click(button)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This browser would not share the file. Download it instead.',
    )
    expect(screen.getByRole('button', { name: 'Download protected backup' })).toBeInTheDocument()

    share.mockResolvedValueOnce('shared')
    await user.click(button)
    await waitFor(() =>
      expect(onClose).toHaveBeenCalledWith({
        note: 'Protected backup shared. Keep its passphrase somewhere safe, apart from the file.',
        madeAt: expect.any(Date),
      }),
    )
    const [fileName, mimeType, text, title] = share.mock.calls[2]
    expect(fileName).toMatch(/^butterfly-garden-protected-\d{4}-\d{2}-\d{2}\.json$/)
    expect(mimeType).toBe('application/json')
    expect(sealedKind(text)).toBe('backup')
    expect(title).toBe('The Butterfly Garden protected backup')
  })
})
