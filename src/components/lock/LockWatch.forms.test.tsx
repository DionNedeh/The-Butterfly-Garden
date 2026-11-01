import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeBroadcastChannel } from '../../test/fakeBroadcastChannel'
import { LAZY_PAGE_MS } from '../../test/lazyPage'
import { getDraft, loadDrafts, resetDrafts } from '../../lib/drafts'
import { chooseAutoLock, lockGarden, turnLockOn, unlockGarden } from '../../lib/gardenLockActions'
import { createInitialState } from '../../lib/progression'
import { newRecoveryCode } from '../../lib/recoveryCode'
import { gardenRepository } from '../../repository/gardenRepository'
import type { AppState } from '../../types'
import { LockGate } from '../LockGate'
import { MonthPlanner } from '../MonthPlanner'
import { SettingsView } from '../SettingsView'
import { TodayView } from '../TodayView'
import { LockWatch } from './LockWatch'

vi.mock('../../lib/sealing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/sealing')>()
  return {
    ...actual,
    deriveKey: (secret: string, salt: Uint8Array) => actual.deriveKey(secret, salt, 1_000),
  }
})

const PASSCODE = 'wrens in the hedge'
const TODAY = '2026-09-05'

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
  document.dispatchEvent(new Event('visibilitychange'))
}

const garden = (): AppState => ({
  ...createInitialState('Robin', 'Quiet Corner'),
  goals: [{ id: 'a', title: 'Alpha', schedule: 'daily', weekdays: [], createdDate: '2026-09-01', archived: false }],
})

async function lockedAndOpen() {
  await gardenRepository.save(garden())
  await turnLockOn(PASSCODE, newRecoveryCode())
  expect(gardenRepository.lockState()).toBe('unlocked')
}

function Today() {
  const handlers = Object.fromEntries(
    [
      'onSaveMood', 'onSaveReflection', 'onAddGoal', 'onUpdateGoal', 'onDeleteGoal', 'onCompleteGoal',
      'onSkipGoal', 'onSnoozeGoal', 'onWakeGoal', 'onPlanGoal', 'onSetGoalArchived', 'onUncompleteGoal',
      'onRestoreGoal', 'onAdoptGoal', 'onOpenRecap',
    ].map((name) => [name, () => undefined]),
  ) as unknown as Omit<Parameters<typeof TodayView>[0], 'state' | 'today' | 'moonlightCollected'>
  return <TodayView state={garden()} today={TODAY} moonlightCollected={false} {...handlers} />
}

beforeEach(() => {
  vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel)
})

afterEach(async () => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  setVisibility('visible')
  resetDrafts()
  await gardenRepository.clear().catch(() => undefined)
})

describe('3.2 the auto-lock with a goal being added on Today', { timeout: 30_000 }, () => {
  it('goes ahead in its time, and the goal comes back once the garden is opened', async () => {
    await lockedAndOpen()
    await chooseAutoLock(1)
    render(
      <>
        <Today />
        <LockWatch />
      </>,
    )
    const user = userEvent.setup()
    await user.type(screen.getByRole('combobox', { name: 'Add a goal' }), 'Water the fern')
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    setVisibility('hidden')
    await act(() => vi.advanceTimersByTimeAsync(60_000))
    vi.useRealTimers()
    await waitFor(() => expect(gardenRepository.lockState()).toBe('locked'))
    expect(getDraft('goal-new:title')).toBeUndefined()

    cleanup()
    setVisibility('visible')
    await unlockGarden({ slot: 'passcode', passcode: PASSCODE })
    await loadDrafts()
    render(<Today />)
    expect(screen.getByRole('combobox', { name: 'Add a goal' })).toHaveValue('Water the fern')
  })
})

describe('3.2 what a lock could not keep', { timeout: 30_000 }, () => {
  const lockScreen = () =>
    screen.findByRole('heading', { name: 'Your garden is resting' }, { timeout: LAZY_PAGE_MS })

  it('is said on the lock screen, beside the passcode, and only after the lock that lost it', async () => {
    await lockedAndOpen()
    const page = (open: boolean) => (
      <LockGate>
        <main id="main-content">
          <h1>The garden</h1>
          {open && (
            <>
              <div data-lock-loses="the sighting you were writing" />
              <div data-lock-loses="the garden image you were framing" />
            </>
          )}
        </main>
      </LockGate>
    )
    const { rerender } = render(page(true))
    await act(() => lockGarden(false))
    await lockScreen()
    const said =
      'The sighting you were writing and the garden image you were framing were not saved when the garden locked.'
    expect(screen.getByText(said)).toBeInTheDocument()
    expect(screen.getByLabelText('Passcode', { exact: true })).toHaveAccessibleDescription(said)

    await act(() => unlockGarden({ slot: 'passcode', passcode: PASSCODE }))
    rerender(page(false))
    await screen.findByRole('heading', { name: 'The garden' })
    await act(() => lockGarden(false))
    await lockScreen()
    expect(screen.queryByText(/not saved when the garden locked/)).toBeNull()
  })

  it('names one thing on its own', async () => {
    await lockedAndOpen()
    render(
      <LockGate>
        <main id="main-content">
          <h1>The garden</h1>
          <div data-lock-loses="the change you were making to a sighting" />
        </main>
      </LockGate>,
    )
    await act(() => lockGarden(false))
    await lockScreen()
    expect(
      screen.getByText('The change you were making to a sighting was not saved when the garden locked.'),
    ).toBeInTheDocument()
  })
})

describe('3.2 the auto-lock with a goal being edited on Today', { timeout: 30_000 }, () => {
  it('goes ahead in its time, though Today was left with the editor open, and the editor comes back as it was', async () => {
    await lockedAndOpen()
    await chooseAutoLock(1)
    const page = (today: boolean) => (
      <>
        {today && <Today />}
        <LockWatch />
      </>
    )
    const { rerender } = render(page(true))
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'More for Alpha' }))
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.type(screen.getByRole('textbox', { name: /^Edit goal/ }), ' by the window')
    // Today left without Cancel, and drawn again: the editor is put back.
    rerender(page(false))
    rerender(page(true))
    expect(screen.getByRole('textbox', { name: /^Edit goal/ })).toHaveValue('Alpha by the window')
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    setVisibility('hidden')
    await act(() => vi.advanceTimersByTimeAsync(60_000))
    vi.useRealTimers()
    await waitFor(() => expect(gardenRepository.lockState()).toBe('locked'))

    cleanup()
    setVisibility('visible')
    await unlockGarden({ slot: 'passcode', passcode: PASSCODE })
    await loadDrafts()
    render(<Today />)
    expect(screen.getByRole('textbox', { name: /^Edit goal/ })).toHaveValue('Alpha by the window')
  })
})

describe('3.2 what a lock could not keep, from the forms that are no draft', { timeout: 30_000 }, () => {
  const lockScreen = () =>
    screen.findByRole('heading', { name: 'Your garden is resting' }, { timeout: LAZY_PAGE_MS })

  it('is a goal being planned on the month, and nothing once it is planned', async () => {
    await lockedAndOpen()
    const user = userEvent.setup()
    const planned = vi.fn()
    render(
      <LockGate>
        <main id="main-content">
          <h1>Today</h1>
          <MonthPlanner state={garden()} today={TODAY} onPlanGoal={planned} />
        </main>
      </LockGate>,
    )
    const field = screen.getByRole('textbox', { name: 'Plan a goal for this day' })
    await user.type(field, '   ')
    expect(document.querySelector('[data-lock-loses]')).toBeNull()
    await user.type(field, 'Sow the poppies')
    await act(() => lockGarden(false))
    await lockScreen()
    expect(
      screen.getByText('The goal you were planning was not saved when the garden locked.'),
    ).toBeInTheDocument()

    await act(() => unlockGarden({ slot: 'passcode', passcode: PASSCODE }))
    await user.type(await screen.findByRole('textbox', { name: 'Plan a goal for this day' }), 'Sow the poppies')
    await user.click(screen.getByRole('button', { name: /^Add to / }))
    expect(planned).toHaveBeenCalledWith('Sow the poppies', TODAY)
    expect(document.querySelector('[data-lock-loses]')).toBeNull()
  })

  it('is a new name being typed in Settings, and nothing once it is saved, or as it was', async () => {
    await lockedAndOpen()
    const user = userEvent.setup()
    const settings = (state: AppState) => (
      <LockGate>
        <main id="main-content">
          <SettingsView
            state={state}
            persistence={{ readOnly: false }}
            onUpdateProfile={() => undefined}
            onSelectAmbientTrack={() => undefined}
            onSelectBackdrop={() => undefined}
            onExportGarden={() => ({ text: '{}' })}
            onImportGarden={() => Promise.resolve({ ok: true, message: '' })}
            onDeleteAll={() => Promise.resolve({ ok: true })}
          />
        </main>
      </LockGate>
    )
    const { rerender } = render(settings(garden()))
    const gardenName = screen.getByRole('textbox', { name: 'Garden name' })
    // Only what Save would change: spaces, or the name it already has, are not.
    await user.type(gardenName, '  ')
    expect(document.querySelector('[data-lock-loses]')).toBeNull()
    await user.clear(gardenName)
    await user.type(gardenName, 'Quiet Corner')
    expect(document.querySelector('[data-lock-loses]')).toBeNull()
    await user.type(gardenName, ' by the Wall')
    await act(() => lockGarden(false))
    await lockScreen()
    expect(
      screen.getByText('The new name you were typing was not saved when the garden locked.'),
    ).toBeInTheDocument()

    await act(() => unlockGarden({ slot: 'passcode', passcode: PASSCODE }))
    const yourName = await screen.findByRole('textbox', { name: 'Your name' })
    await user.type(yourName, 'n')
    expect(document.querySelector('[data-lock-loses]')).not.toBeNull()
    // Saved: the garden now holds it.
    const saved = garden()
    rerender(settings({ ...saved, profile: { ...saved.profile!, name: 'Robinn' } }))
    expect(document.querySelector('[data-lock-loses]')).toBeNull()
  })
})
