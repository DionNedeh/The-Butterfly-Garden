import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { MAX_BACKUP_BYTES } from '../lib/backupFile'
import { turnLockOn } from '../lib/gardenLockActions'
import { createInitialState, STARTER_COMPANION_NAME } from '../lib/progression'
import { newRecoveryCode } from '../lib/recoveryCode'
import { storedCopy } from '../lib/storedCopy'
import { gardenRepository, readImportedState } from '../repository/gardenRepository'
import { MAX_STARTER_GOALS, Onboarding } from './Onboarding'

// The real lock, quick: the count is the tests' only change.
vi.mock('../lib/sealing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/sealing')>()
  return {
    ...actual,
    deriveKey: (secret: string, salt: Uint8Array) => actual.deriveKey(secret, salt, 1_000),
  }
})

// The prompt's code is fetched when a sealed file is chosen; fetched once
// here, so no test's first wait is spent compiling it on a busy machine.
beforeAll(async () => {
  await import('./backup/SealedBackupPrompt')
})

/** From the welcome to the starter goals, with the garden's default name. */
async function reachStarterGoals() {
  const user = userEvent.setup()
  const onComplete = vi.fn()
  render(<Onboarding onComplete={onComplete} />)
  await user.click(screen.getByRole('button', { name: 'Enter the garden' }))
  await user.click(screen.getByRole('button', { name: 'Meet your garden guide' }))
  return { user, onComplete }
}

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
    expect(screen.getByRole('heading', { name: 'Anything to care for each day?' })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Skip for now' }))

    expect(screen.getByRole('heading', { name: 'Here is how your sanctuary grows' })).toHaveFocus()
    expect(screen.getByText(/Welcome, Robin! I will help you tend Quiet Corner/)).toBeInTheDocument()
    expect(screen.getByText(new RegExp(`${STARTER_COMPANION_NAME}, your monarch caterpillar`))).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Plant my first seeds' }))
    expect(onComplete).toHaveBeenCalledWith('Robin', 'Quiet Corner', [])
  })

  it('calls a gardener with no name a Gardener, without inventing one for them', async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn()
    render(<Onboarding onComplete={onComplete} />)
    await user.click(screen.getByRole('button', { name: 'Enter the garden' }))
    await user.type(screen.getByLabelText('Your name'), '   ')
    await user.click(screen.getByRole('button', { name: 'Meet your garden guide' }))
    await user.click(screen.getByRole('button', { name: 'Skip for now' }))
    expect(screen.getByText(/Welcome, Gardener!/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Plant my first seeds' }))
    expect(onComplete).toHaveBeenCalledWith('   ', 'Sunlit Sanctuary', [])
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

describe('starter goals', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('offers one idea from each part of wellbeing, with nothing chosen', async () => {
    await reachStarterGoals()
    const offered = screen.getAllByRole('checkbox')
    expect(offered).toHaveLength(6)
    for (const box of offered) expect(box).not.toBeChecked()
    expect(screen.getByRole('group', { name: 'Starter goals' })).toBeInTheDocument()
    // Continuing and skipping are offered alike.
    expect(screen.getByRole('button', { name: 'Continue' })).toHaveClass('primary-button')
    expect(screen.getByRole('button', { name: 'Skip for now' })).toHaveClass('primary-button')
  })

  it('begins the garden with the goals chosen, and their two-minute versions', async () => {
    const { user, onComplete } = await reachStarterGoals()
    await user.click(screen.getByRole('checkbox', { name: /^Drink a glass of water/ }))
    await user.click(screen.getByRole('checkbox', { name: /^Take three slow breaths/ }))
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.click(screen.getByRole('button', { name: 'Plant my first seeds' }))
    expect(onComplete).toHaveBeenCalledWith('', 'Sunlit Sanctuary', [
      { title: 'Drink a glass of water', tinyTitle: 'Take three sips' },
      { title: 'Take three slow breaths', tinyTitle: undefined },
    ])
  })

  it('shows each idea’s two-minute version beside it', async () => {
    await reachStarterGoals()
    expect(
      screen.getByRole('checkbox', { name: 'Drink a glass of water Two minutes: Take three sips' }),
    ).toBeInTheDocument()
  })

  it('takes a choice back when it is unticked', async () => {
    const { user, onComplete } = await reachStarterGoals()
    const water = screen.getByRole('checkbox', { name: /^Drink a glass of water/ })
    await user.click(water)
    await user.click(water)
    expect(water).not.toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.click(screen.getByRole('button', { name: 'Plant my first seeds' }))
    expect(onComplete).toHaveBeenCalledWith('', 'Sunlit Sanctuary', [])
  })

  it('stops at three, and says why the rest wait', async () => {
    const { user, onComplete } = await reachStarterGoals()
    const [first, second, third, fourth] = screen.getAllByRole('checkbox')
    await user.click(first)
    await user.click(second)
    expect(screen.getByRole('status')).toHaveTextContent('')
    await user.click(third)
    expect(screen.getByRole('status')).toHaveTextContent('Three is plenty to begin with.')
    expect(fourth).toBeDisabled()
    expect(first).toBeEnabled()
    // A fourth cannot slip in, even by a click the browser would refuse.
    fourth.removeAttribute('disabled')
    await user.click(fourth)
    expect(fourth).not.toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.click(screen.getByRole('button', { name: 'Plant my first seeds' }))
    expect(onComplete.mock.calls[0][2]).toHaveLength(MAX_STARTER_GOALS)
  })

  it('lets go of anything ticked when the step is skipped', async () => {
    const { user, onComplete } = await reachStarterGoals()
    await user.click(screen.getByRole('checkbox', { name: /^Drink a glass of water/ }))
    await user.click(screen.getByRole('button', { name: 'Skip for now' }))
    await user.click(screen.getByRole('button', { name: 'Plant my first seeds' }))
    expect(onComplete).toHaveBeenCalledWith('', 'Sunlit Sanctuary', [])
  })

  it('says where the garden lives, and the button that keeps a copy', async () => {
    const { user } = await reachStarterGoals()
    await user.click(screen.getByRole('button', { name: 'Skip for now' }))
    expect(
      screen.getByText(/lives only in this browser on this device.*choose Download a backup/),
    ).toBeInTheDocument()
  })

  it('names the Android app’s own backup button there', async () => {
    vi.stubEnv('VITE_PLATFORM', 'android')
    const { user } = await reachStarterGoals()
    await user.click(screen.getByRole('button', { name: 'Skip for now' }))
    expect(
      screen.getByText(/lives only in this app on this phone.*choose Save a backup/),
    ).toBeInTheDocument()
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

describe('bringing a garden from a protected backup', () => {
  it('asks for its passphrase, then brings the backup inside as any other', async () => {
    const user = userEvent.setup()
    const onRestore = vi.fn(() => Promise.resolve({ ok: false, message: 'That backup could not be restored.' }))
    render(<Onboarding onComplete={vi.fn()} onRestore={onRestore} arriving />)
    const { sealBackup } = await import('../lib/sealedBackup')
    const outcome = await sealBackup('{"format":"the-butterfly-garden"}', 'quiet meadow lantern', {
      iterations: 1_000,
    })
    await user.upload(
      screen.getByLabelText('Choose a backup'),
      new File([(outcome as { text: string }).text], 'protected.json', { type: 'application/json' }),
    )
    // Nothing is stored yet to be replaced, and no look at it comes first.
    const dialog = await screen.findByRole('dialog', { name: 'This backup is protected' })
    expect(dialog).toHaveAccessibleDescription(/Once it opens, the garden it holds is restored here straight away\.$/)
    expect(dialog).not.toHaveAccessibleDescription(/Nothing is replaced until/)
    await user.type(await screen.findByLabelText('Passphrase'), 'quiet meadow lantern')
    await user.click(screen.getByRole('button', { name: 'Open the backup' }))
    await waitFor(() => expect(onRestore).toHaveBeenCalledWith('{"format":"the-butterfly-garden"}'))
    // A refusal of what was inside stays to be read, as for any backup.
    expect(await screen.findByRole('status')).toHaveTextContent('That backup could not be restored.')
  })

  it('brings nothing when the prompt is put away', async () => {
    const user = userEvent.setup()
    const onRestore = vi.fn(() => Promise.resolve({ ok: true, message: 'Restored.' }))
    render(<Onboarding onComplete={vi.fn()} onRestore={onRestore} arriving />)
    const { sealBackup } = await import('../lib/sealedBackup')
    const outcome = await sealBackup('{}', 'quiet meadow lantern', { iterations: 1_000 })
    const input = screen.getByLabelText('Choose a backup')
    await user.upload(input, new File([(outcome as { text: string }).text], 'protected.json', { type: 'application/json' }))
    await user.click(await screen.findByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(onRestore).not.toHaveBeenCalled()
    await waitFor(() => expect(input).toHaveFocus())
  })
})

describe('bringing a garden from safe mode’s copy of a locked garden', () => {
  it('asks for the lock’s passcode, then brings the garden inside, saying the lock stays behind', async () => {
    // A garden with the lock on, copied in safe mode, then deleted: this is where it comes back.
    await gardenRepository.save(createInitialState('Robin', 'Quiet Corner'))
    await turnLockOn('kingfisher at dawn', newRecoveryCode())
    const { text } = await storedCopy()
    await gardenRepository.clear()

    const user = userEvent.setup()
    const onRestore = vi.fn(() => Promise.resolve({ ok: true, message: 'Restored.' }))
    render(<Onboarding onComplete={vi.fn()} onRestore={onRestore} arriving />)
    await user.upload(
      screen.getByLabelText('Choose a backup'),
      new File([text], 'butterfly-garden-everything-stored.json', { type: 'application/json' }),
    )
    const dialog = await screen.findByRole('dialog', { name: 'This copy is locked' })
    expect(dialog).toHaveAccessibleDescription(
      /Once it opens, the garden it holds is restored here straight away\. The garden comes back without its lock; turn the lock on again in Settings if you want it\.$/,
    )
    await user.type(screen.getByLabelText('Passcode'), 'kingfisher at dawn')
    await user.click(screen.getByRole('button', { name: 'Open the copy' }))
    await waitFor(() => expect(onRestore).toHaveBeenCalledOnce())
    const [plain] = onRestore.mock.calls[0] as unknown as [string]
    expect(readImportedState(JSON.parse(plain))?.profile?.gardenName).toBe('Quiet Corner')
  })
})
