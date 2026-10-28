import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { newMoveCode } from '../../lib/moveCode'
import { sealBackup } from '../../lib/sealedBackup'
import { ProtectedRestore } from '../backup/ProtectedRestore'
import { ArriveRestore } from './ArriveRestore'

/** Text entered all at once, as a paste: twelve words key by key are slow on a busy machine. */
async function enter(user: ReturnType<typeof userEvent.setup>, field: HTMLElement, text: string) {
  await user.click(field)
  await user.paste(text)
}

const PLAIN = '{"format":"the-butterfly-garden","garden":{"note":"Brought across"}}'
const PASSPHRASE = 'quiet meadow lantern'

/** A screen holding the dialog as the app's do: gone once it closes or opens a file. */
function Screen({ onOpened, onClose }: { onOpened: (plain: string, from: string) => void; onClose: (note?: string) => void }) {
  const [open, setOpen] = useState(true)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Arrive from another device
      </button>
      {open && (
        <ArriveRestore
          onOpened={(plain, from) => {
            setOpen(false)
            onOpened(plain, from)
          }}
          onClose={(note) => {
            setOpen(false)
            onClose(note)
          }}
        />
      )}
    </>
  )
}

afterEach(() => {
  document.body.replaceChildren()
})

// A busy machine (a CI runner, other suites at once) is given time for whole flows.
describe('arriving, wherever a garden can be brought in', { timeout: 20_000 }, () => {
  it('loads the dialog when asked, and hands on a move file’s garden', async () => {
    const words = await newMoveCode()
    const outcome = await sealBackup(PLAIN, words.join(' '), { iterations: 1_000, opensWith: 'move-code' })
    if (!outcome.ok) throw new Error('Not sealed')
    const onOpened = vi.fn()
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<Screen onOpened={onOpened} onClose={onClose} />)
    await user.upload(await screen.findByLabelText('Choose the move file'), new File([outcome.text], 'move.json'))
    await enter(user, await screen.findByLabelText('The 12 words'), words.join(' '))
    await user.click(screen.getByRole('button', { name: 'Open the file' }))
    await waitFor(() => expect(onOpened).toHaveBeenCalledWith(PLAIN, 'move'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('asks for a passphrase backup’s passphrase instead, and says how it was opened', async () => {
    const outcome = await sealBackup(PLAIN, PASSPHRASE, { iterations: 1_000 })
    if (!outcome.ok) throw new Error('Not sealed')
    const onOpened = vi.fn()
    const user = userEvent.setup()
    render(<Screen onOpened={onOpened} onClose={vi.fn()} />)
    await user.upload(await screen.findByLabelText('Choose the move file'), new File([outcome.text], 'protected.json'))
    const field = await screen.findByLabelText('Passphrase')
    await waitFor(() => expect(screen.getByRole('heading', { name: 'This backup is protected' })).toHaveFocus())
    await enter(user, field, PASSPHRASE)
    await user.click(screen.getByRole('button', { name: 'Open the backup' }))
    await waitFor(() => expect(onOpened).toHaveBeenCalledWith(PLAIN, 'passphrase'))
  })

  it('passes on a note when put away', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<Screen onOpened={vi.fn()} onClose={onClose} />)
    await user.click(await screen.findByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledWith(undefined)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('button', { name: 'Arrive from another device' })).toBeInTheDocument()
  })
})

describe('a move file chosen through Restore', { timeout: 20_000 }, () => {
  it('asks for its code, not a passphrase, and says it came as a move file', async () => {
    const words = await newMoveCode()
    const outcome = await sealBackup(PLAIN, words.join(' '), { iterations: 1_000, opensWith: 'move-code' })
    if (!outcome.ok) throw new Error('Not sealed')
    const onOpened = vi.fn()
    const user = userEvent.setup()
    render(<ProtectedRestore next="preview" text={outcome.text} onOpened={onOpened} onClose={vi.fn()} />)
    const heading = await screen.findByRole('heading', { name: 'Open the move file' })
    await waitFor(() => expect(heading).toHaveFocus())
    expect(screen.queryByLabelText('Passphrase')).toBeNull()
    await enter(user, screen.getByLabelText('The 12 words'), words.join(' '))
    await user.click(screen.getByRole('button', { name: 'Open the file' }))
    await waitFor(() => expect(onOpened).toHaveBeenCalledWith(PLAIN, 'move'))
  })

  it('still opens with its words typed exactly as a passphrase, without the mark', async () => {
    // A build that knows no move files sees an ordinary protected backup.
    const words = await newMoveCode()
    const outcome = await sealBackup(PLAIN, words.join(' '), { iterations: 1_000 })
    if (!outcome.ok) throw new Error('Not sealed')
    const onOpened = vi.fn()
    const user = userEvent.setup()
    render(<ProtectedRestore next="preview" text={outcome.text} onOpened={onOpened} onClose={vi.fn()} />)
    await enter(user, await screen.findByLabelText('Passphrase'), words.join(' '))
    await user.click(screen.getByRole('button', { name: 'Open the backup' }))
    await waitFor(() => expect(onOpened).toHaveBeenCalledWith(PLAIN, 'passphrase'))
  })
})
