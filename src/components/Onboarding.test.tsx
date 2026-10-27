import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MAX_BACKUP_BYTES } from '../lib/backupFile'
import { STARTER_COMPANION_NAME } from '../lib/progression'
import { Onboarding } from './Onboarding'

describe('meeting the garden', () => {
  it('walks from the welcome, through naming, to the guide, and plants the garden', async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn()
    render(<Onboarding onComplete={onComplete} />)
    expect(screen.getByRole('heading', { name: 'Welcome to your butterfly garden' })).toBeInTheDocument()
    // No restore is offered where nothing could take one.
    expect(screen.queryByRole('button', { name: 'I have a backup' })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Enter the garden' }))
    expect(screen.getByRole('heading', { name: 'What shall we call this place?' })).toBeInTheDocument()
    expect(screen.getByLabelText('Garden name')).toHaveValue('Sunlit Sanctuary')
    await user.type(screen.getByLabelText('Your name'), 'Robin')
    await user.clear(screen.getByLabelText('Garden name'))
    await user.type(screen.getByLabelText('Garden name'), 'Quiet Corner')
    await user.click(screen.getByRole('button', { name: 'Meet your garden guide' }))

    expect(screen.getByRole('heading', { name: 'Here is how your sanctuary grows' })).toBeInTheDocument()
    expect(screen.getByText(/Welcome, Robin! I will help you tend Quiet Corner/)).toBeInTheDocument()
    expect(screen.getByText(new RegExp(`${STARTER_COMPANION_NAME}, your monarch caterpillar`))).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Plant my first seeds' }))
    expect(onComplete).toHaveBeenCalledWith('Robin', 'Quiet Corner')
  })

  it('calls a gardener with no name a Gardener, without inventing one for them', async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn()
    render(<Onboarding onComplete={onComplete} />)
    await user.click(screen.getByRole('button', { name: 'Enter the garden' }))
    await user.type(screen.getByLabelText('Your name'), '   ')
    await user.click(screen.getByRole('button', { name: 'Meet your garden guide' }))
    expect(screen.getByText(/Welcome, Gardener!/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Plant my first seeds' }))
    expect(onComplete).toHaveBeenCalledWith('   ', 'Sunlit Sanctuary')
  })

  it('will not go on without a garden name', async () => {
    const user = userEvent.setup()
    render(<Onboarding onComplete={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Enter the garden' }))
    await user.clear(screen.getByLabelText('Garden name'))
    await user.click(screen.getByRole('button', { name: 'Meet your garden guide' }))
    expect(screen.getByRole('heading', { name: 'What shall we call this place?' })).toBeInTheDocument()
  })
})

describe('bringing a garden from a backup', () => {
  async function openRestore() {
    const user = userEvent.setup()
    const onRestore = vi.fn(() => Promise.resolve({ ok: true, message: 'Restored.' }))
    render(<Onboarding onComplete={vi.fn()} onRestore={onRestore} />)
    await user.click(screen.getByRole('button', { name: 'I have a backup' }))
    expect(screen.getByText(/from another device or another browser/)).toBeInTheDocument()
    return { user, onRestore }
  }

  it('refuses a file too large to be a backup without reading it', async () => {
    const { user, onRestore } = await openRestore()
    const huge = new File(['{}'], 'huge.json', { type: 'application/json' })
    Object.defineProperty(huge, 'size', { value: MAX_BACKUP_BYTES + 1 })
    await user.upload(screen.getByLabelText('Choose a backup'), huge)
    expect(await screen.findByRole('status')).toHaveTextContent('That file is too large to be a garden backup.')
    expect(onRestore).not.toHaveBeenCalled()
  })

  it('says so when the chosen file can no longer be read', async () => {
    const { user, onRestore } = await openRestore()
    const gone = new File(['{}'], 'gone.json', { type: 'application/json' })
    gone.text = () => Promise.reject(new DOMException('gone', 'NotReadableError'))
    await user.upload(screen.getByLabelText('Choose a backup'), gone)
    expect(await screen.findByRole('status')).toHaveTextContent(/could not be read/)
    expect(onRestore).not.toHaveBeenCalled()
  })

  it('leaves an address that never said "arrive" alone after a restore', async () => {
    window.history.replaceState(null, '', '/garden/#/journal')
    const { user, onRestore } = await openRestore()
    await user.upload(
      screen.getByLabelText('Choose a backup'),
      new File(['{}'], 'garden.json', { type: 'application/json' }),
    )
    expect(onRestore).toHaveBeenCalledOnce()
    expect(window.location.hash).toBe('#/journal')
    expect(screen.queryByRole('status')).toBeNull()
    window.history.replaceState(null, '', '/')
  })
})
