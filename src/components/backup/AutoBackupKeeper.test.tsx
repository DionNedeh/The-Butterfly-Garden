import { act, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BackupFileRecord } from '../../lib/autoBackup'
import { createInitialState } from '../../lib/progression'
import { gardenRepository } from '../../repository/gardenRepository'
import { fakeFile, recordInMemory, type FakeFile } from '../../test/fileSystemAccess'
import type { AppState } from '../../types'
import { AutoBackupKeeper } from './AutoBackupKeeper'

/*
 * The writer that keeps the chosen file up to date while the garden is open:
 * an earlier day's changes when the garden is opened or looked at again,
 * the day's own as the page is hidden, never on every save, and nothing at
 * all while the lock is on or saving is paused.
 */

let visibility: DocumentVisibilityState = 'visible'

beforeEach(() => {
  gardenRepository.forget()
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 9, 27, 9) })
  visibility = 'visible'
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => visibility,
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  Reflect.deleteProperty(document, 'visibilityState')
})

function setVisibility(next: DocumentVisibilityState) {
  visibility = next
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

/** Let the writes already started run their course. */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30))
  })
}

const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute).toISOString()

function keeper(file: FakeFile, record: Omit<BackupFileRecord, 'handle'>, readOnly = false) {
  const kept = recordInMemory({ handle: file.handle, ...record })
  const exportGarden = vi.fn(() => ({ text: `copy ${new Date().toISOString()}` }))
  const onWritten = vi.fn()
  const garden = createInitialState('Robin', 'Quiet Corner')
  const view = render(
    <AutoBackupKeeper
      state={garden}
      readOnly={readOnly}
      onExportGarden={exportGarden}
      onWritten={onWritten}
    />,
  )
  const change = (next: AppState) =>
    view.rerender(
      <AutoBackupKeeper
        state={next}
        readOnly={readOnly}
        onExportGarden={exportGarden}
        onWritten={onWritten}
      />,
    )
  return { kept, exportGarden, onWritten, garden, change, view }
}

describe('keeping the chosen file up to date', () => {
  it('writes an earlier day’s changes when the garden is opened on a later day', async () => {
    const file = fakeFile()
    const { onWritten, kept } = keeper(file, { writtenAt: at(26, 8), changedAt: at(26, 20) })
    await waitFor(() => expect(file.writes).toBe(1))
    expect(onWritten).toHaveBeenCalledWith(new Date(2026, 9, 27, 9))
    await waitFor(() => expect(kept.record?.writtenAt).toBe(at(27, 9)))
    expect(kept.record?.changedAt).toBeUndefined()
  })

  it('never writes on every save: a change waits for the page to be hidden', async () => {
    const file = fakeFile()
    const { kept, garden, change, onWritten } = keeper(file, { writtenAt: at(27, 8) })
    await settle()
    expect(file.writes).toBe(0)

    change({ ...garden, seeds: garden.seeds + 1 })
    await waitFor(() => expect(kept.record?.changedAt).toBe(at(27, 9)))
    change({ ...garden, seeds: garden.seeds + 2 })
    await settle()
    expect(file.writes).toBe(0)

    vi.setSystemTime(new Date(2026, 9, 27, 9, 5))
    setVisibility('hidden')
    await waitFor(() => expect(file.writes).toBe(1))
    expect(onWritten).toHaveBeenCalledTimes(1)
  })

  it('writes on hiding at most every few minutes', async () => {
    const file = fakeFile()
    const { garden, change } = keeper(file, { writtenAt: at(27, 8) })
    await settle()
    change({ ...garden, seeds: 10 })
    setVisibility('hidden')
    await waitFor(() => expect(file.writes).toBe(1))

    setVisibility('visible')
    vi.setSystemTime(new Date(2026, 9, 27, 9, 4))
    change({ ...garden, seeds: 11 })
    await settle()
    setVisibility('hidden')
    await settle()
    expect(file.writes).toBe(1)

    vi.setSystemTime(new Date(2026, 9, 27, 9, 15))
    setVisibility('visible')
    setVisibility('hidden')
    await waitFor(() => expect(file.writes).toBe(2))
  })

  it('writes a day’s changes on the next day while left open, once looked at', async () => {
    const file = fakeFile()
    const { garden, change } = keeper(file, { writtenAt: at(27, 8) })
    await settle()
    change({ ...garden, seeds: 10 })
    await settle()
    setVisibility('visible')
    await settle()
    expect(file.writes).toBe(0)

    vi.setSystemTime(new Date(2026, 9, 28, 0, 5))
    setVisibility('visible')
    await waitFor(() => expect(file.writes).toBe(1))
  })

  it('does not count the backup itself, or the app’s own notes, as a change', async () => {
    const file = fakeFile()
    const { kept, garden, change } = keeper(file, { writtenAt: at(27, 8) })
    await settle()
    change({ ...garden, profile: { ...garden.profile!, lastBackupAt: at(27, 9) } })
    await settle()
    expect(kept.record?.changedAt).toBeUndefined()
  })

  it('asks the browser for nothing on its own when its permission has lapsed', async () => {
    const file = fakeFile()
    file.permission = 'prompt'
    const { kept, onWritten } = keeper(file, { writtenAt: at(26, 8), changedAt: at(26, 20) })
    await waitFor(() => expect(kept.record?.problem?.kind).toBe('permission'))
    expect(file.requested).toBe(0)
    expect(file.writes).toBe(0)
    expect(onWritten).not.toHaveBeenCalled()
  })

  it('does nothing until a file is chosen', async () => {
    recordInMemory()
    const exportGarden = vi.fn(() => ({ text: '{}' }))
    render(
      <AutoBackupKeeper
        state={createInitialState('Robin', 'Quiet Corner')}
        readOnly={false}
        onExportGarden={exportGarden}
        onWritten={vi.fn()}
      />,
    )
    await settle()
    setVisibility('hidden')
    await settle()
    expect(exportGarden).not.toHaveBeenCalled()
  })
})

describe('pausing the file', () => {
  it('writes nothing while saving is paused', async () => {
    const file = fakeFile()
    const { exportGarden } = keeper(file, { writtenAt: at(26, 8), changedAt: at(26, 20) }, true)
    await settle()
    setVisibility('hidden')
    await settle()
    expect(exportGarden).not.toHaveBeenCalled()
    expect(file.writes).toBe(0)
  })

  it('writes nothing while the lock is on, and treats the file as behind once it is off', async () => {
    const file = fakeFile()
    act(() => gardenRepository.unlock({} as CryptoKey, 'lock-1'))
    const { kept, garden, change, exportGarden } = keeper(file, { writtenAt: at(27, 8) })
    await settle()
    // Nothing of the locked garden is noted or written.
    change({ ...garden, seeds: 30 })
    setVisibility('hidden')
    await settle()
    expect(kept.record?.changedAt).toBeUndefined()
    expect(exportGarden).not.toHaveBeenCalled()

    setVisibility('visible')
    act(() => gardenRepository.forget())
    await waitFor(() => expect(kept.record?.changedAt).toBe(at(27, 9)))
    setVisibility('hidden')
    await waitFor(() => expect(file.writes).toBe(1))
  })
})
