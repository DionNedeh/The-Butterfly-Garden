import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RECOVERY_WORDS } from '../../data/recoveryWords'
import { codeHoldsTogether, newMoveCode } from '../../lib/moveCode'
import { readSealedBackup, sealBackup } from '../../lib/sealedBackup'
import { ArriveDialog } from './ArriveDialog'

/** Text entered all at once, as a paste: twelve words key by key are slow on a busy machine. */
async function enter(user: ReturnType<typeof userEvent.setup>, field: HTMLElement, text: string) {
  await user.click(field)
  await user.paste(text)
}

const PLAIN = '{"format":"the-butterfly-garden","garden":{"note":"Brought across"}}'

/** A move file and its words, as the old device makes them (at a quick count). */
async function moveFile(text = PLAIN): Promise<{ file: File; words: string[] }> {
  const words = await newMoveCode()
  const outcome = await sealBackup(text, words.join(' '), { iterations: 1_000, opensWith: 'move-code' })
  if (!outcome.ok) throw new Error('Not sealed')
  return { file: new File([outcome.text], 'butterfly-garden-move-2026-10-27.json'), words }
}

/** Twelve words that carry their check but are not the file's code. */
async function anotherCode(): Promise<string[]> {
  return newMoveCode()
}

function renderDialog(props: Partial<Parameters<typeof ArriveDialog>[0]> = {}) {
  const onOpened = vi.fn()
  const onPassphrase = vi.fn()
  const onClose = vi.fn()
  const opener = document.createElement('button')
  opener.textContent = 'Arrive from another device'
  document.body.append(opener)
  opener.focus()
  const view = render(
    <ArriveDialog onOpened={onOpened} onPassphrase={onPassphrase} onClose={onClose} {...props} />,
  )
  return { ...view, onOpened, onPassphrase, onClose, opener, user: userEvent.setup() }
}

async function chooseFile(user: ReturnType<typeof userEvent.setup>, file: File) {
  await user.upload(screen.getByLabelText('Choose the move file'), file)
}


afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  Reflect.deleteProperty(navigator, 'mediaDevices')
  document.body.replaceChildren()
})

// A busy machine (a CI runner, other suites at once) is given time for whole flows.
describe('choosing the file', { timeout: 20_000 }, () => {
  it('ignores an earlier slow file read after another file is chosen', async () => {
    let finish: (text: string) => void = () => undefined
    const slow = new File(['slow'], 'slow.json')
    vi.spyOn(slow, 'text').mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    const { file } = await moveFile()
    const { user, onOpened } = renderDialog()
    await chooseFile(user, slow)
    await chooseFile(user, file)
    await screen.findByLabelText('The 12 words')
    await act(async () => { finish(PLAIN); await Promise.resolve() })
    expect(screen.getByLabelText('The 12 words')).toBeInTheDocument()
    expect(onOpened).not.toHaveBeenCalled()
  })
  it('ignores a file input cancel that bubbles through the dialog', () => {
    const { onClose } = renderDialog()
    fireEvent(screen.getByLabelText('Choose the move file'), new Event('cancel', { bubbles: true, cancelable: true }))
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toHaveAttribute('open')
  })
  it('never offers or opens a camera, even when the device can scan QR codes', async () => {
    const camera = vi.fn()
    const detector = vi.fn()
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: camera } })
    vi.stubGlobal('BarcodeDetector', detector)
    const { file } = await moveFile()
    const { user } = renderDialog()
    await chooseFile(user, file)
    await screen.findByLabelText('The 12 words')
    expect(screen.queryByRole('button', { name: /Scan/ })).toBeNull()
    expect(camera).not.toHaveBeenCalled()
    expect(detector).not.toHaveBeenCalled()
  })
  it('opens on its heading and asks for the file first', () => {
    renderDialog()
    const dialog = screen.getByRole('dialog', { name: 'Arrive from another device' })
    expect(screen.getByRole('heading', { name: 'Arrive from another device' })).toHaveFocus()
    expect(dialog).toHaveAccessibleDescription(/makes a move file and shows a 12-word code/)
    expect(screen.getByLabelText('Choose the move file')).toHaveAttribute('type', 'file')
  })

  it('hands a plain backup straight on: it needs no code', async () => {
    const { onOpened, user } = renderDialog()
    await chooseFile(user, new File([PLAIN], 'butterfly-garden-2026-10-27.json'))
    await waitFor(() => expect(onOpened).toHaveBeenCalledWith(PLAIN, 'plain'))
  })

  it('hands a passphrase-protected backup to the passphrase prompt', async () => {
    const outcome = await sealBackup(PLAIN, 'quiet meadow lantern', { iterations: 1_000 })
    if (!outcome.ok) throw new Error('Not sealed')
    const { onPassphrase, onOpened, user } = renderDialog()
    await chooseFile(user, new File([outcome.text], 'protected.json'))
    await waitFor(() => expect(onPassphrase).toHaveBeenCalledWith(outcome.text))
    expect(onOpened).not.toHaveBeenCalled()
  })

  it('says where a passphrase backup goes when nothing here can ask for one', async () => {
    const outcome = await sealBackup(PLAIN, 'quiet meadow lantern', { iterations: 1_000 })
    if (!outcome.ok) throw new Error('Not sealed')
    const { user } = renderDialog({ onPassphrase: undefined })
    await chooseFile(user, new File([outcome.text], 'protected.json'))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(
      'That is a protected backup, which opens with its passphrase. Choose it with Restore from a backup.',
    ))
  })

  it('says why a damaged, newer or unreadable file cannot open, before any code', async () => {
    const { file } = await moveFile()
    const text = await file.text()
    const { user, onOpened } = renderDialog()
    await chooseFile(user, new File([text.slice(0, 300)], 'cut.json'))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(
      'That file is damaged or incomplete, so no code can open it. Nothing has been changed.',
    ))
    await chooseFile(user, new File([text.replace('"formatVersion": 1', '"formatVersion": 2')], 'newer.json'))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'That file was made by a newer version of the garden. Update the app, then choose it again.',
      ),
    )
    const huge = new File(['{}'], 'huge.json')
    Object.defineProperty(huge, 'size', { value: 65 * 1024 * 1024 })
    await chooseFile(user, huge)
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('That file is too large to be a garden backup.'),
    )
    expect(onOpened).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: 'Arrive from another device' })).toBeInTheDocument()
  })
})

describe('typing the code', { timeout: 20_000 }, () => {
  it('opens the file with its 12 words, typed any old way, and hands on the garden inside', async () => {
    const { file, words } = await moveFile()
    const { onOpened, onClose, user } = renderDialog()
    await chooseFile(user, file)
    const heading = await screen.findByRole('heading', { name: 'Open the move file' })
    await waitFor(() => expect(heading).toHaveFocus())
    expect(screen.getByRole('dialog', { name: 'Open the move file' })).toHaveAccessibleDescription(
      /It opens with the 12-word code your other device is showing\. Type the words in order\./,
    )
    const field = screen.getByLabelText('The 12 words')
    expect(field).toHaveAccessibleDescription('Capitals, spaces and line breaks do not matter.')
    await enter(user, field, `1. ${words.slice(0, 6).join('  ').toUpperCase()}\n${words.slice(6).join(' ')} `)
    await user.click(screen.getByRole('button', { name: 'Open the file' }))
    await waitFor(() => expect(onOpened).toHaveBeenCalledWith(PLAIN, 'move'))
    expect(onClose).not.toHaveBeenCalled()
    expect(field).toHaveValue('')
  })

  it('names a misspelt word, with the nearest on the list, and opens nothing', async () => {
    const { file, words } = await moveFile()
    const { onOpened, user } = renderDialog()
    await chooseFile(user, file)
    const field = await screen.findByLabelText('The 12 words')
    const slip = `${words[0].slice(0, -1)}${words[0].endsWith('q') ? 'x' : 'q'}`
    await enter(user, field, [slip, ...words.slice(1)].join(' '))
    await user.click(screen.getByRole('button', { name: 'Open the file' }))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(new RegExp(`^“${slip}” is not one of the code’s words\\.`)),
    )
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(words[0])
    expect(field).toHaveFocus()
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(onOpened).not.toHaveBeenCalled()

    await user.clear(field)
    await enter(user, field, words.slice(0, 11).join(' '))
    await user.click(screen.getByRole('button', { name: 'Open the file' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('That is 11 words. The code has 12.'))
  })

  it('refuses words that do not belong together, before the slow part', async () => {
    const { file, words } = await moveFile()
    const { onOpened, user } = renderDialog()
    await chooseFile(user, file)
    let wrong = [...words]
    for (const other of RECOVERY_WORDS) {
      wrong = [...words.slice(0, 11), other]
      if (!(await codeHoldsTogether(wrong))) break
    }
    const field = await screen.findByLabelText('The 12 words')
    await enter(user, field, wrong.join(' '))
    await user.click(screen.getByRole('button', { name: 'Open the file' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(
      'Those words do not fit together: one may be mistyped as another word, or two may have swapped places.',
    ))
    expect(field).toHaveFocus()
    expect(onOpened).not.toHaveBeenCalled()
  })

  it('says when another code’s words do not open this file', async () => {
    const { file } = await moveFile()
    const other = await anotherCode()
    const { onOpened, user } = renderDialog()
    await chooseFile(user, file)
    await enter(user, await screen.findByLabelText('The 12 words'), other.join(' '))
    await user.click(screen.getByRole('button', { name: 'Open the file' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(
      'Those words do not open this file. Each move file has a code of its own',
    ))
    expect(onOpened).not.toHaveBeenCalled()
  })

  it('goes back for another file, with focus on the first step’s heading', async () => {
    const { file } = await moveFile()
    const { user } = renderDialog()
    await chooseFile(user, file)
    await screen.findByLabelText('The 12 words')
    await user.click(screen.getByRole('button', { name: 'Choose another file' }))
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Arrive from another device' })).toHaveFocus(),
    )
  })

  it('starts at the code for a move file a restore already chose', async () => {
    const { file, words } = await moveFile()
    const read = readSealedBackup(await file.text())
    if (!read.ok) throw new Error('Not read')
    const { onOpened, user } = renderDialog({ backup: read.backup })
    expect(screen.getByText('Restore a backup')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Open the move file' })).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'Choose another file' })).toBeNull()
    await enter(user, screen.getByLabelText('The 12 words'), words.join(' '))
    await user.click(screen.getByRole('button', { name: 'Open the file' }))
    await waitFor(() => expect(onOpened).toHaveBeenCalledWith(PLAIN, 'move'))
  })

  it('is put away by Escape or Cancel, and not while the file is opening', async () => {
    const { file, words } = await moveFile()
    const { onClose, user } = renderDialog()
    await chooseFile(user, file)
    await enter(user, await screen.findByLabelText('The 12 words'), words.join(' '))
    fireEvent.click(screen.getByRole('button', { name: 'Open the file' }))
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))
    expect(onClose).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByText(/This can take a few seconds/)).toBeNull())
  })

  it('closes with Cancel on the first step', async () => {
    const { onClose, user } = renderDialog()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
