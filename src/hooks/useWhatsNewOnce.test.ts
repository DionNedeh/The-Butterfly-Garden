import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { currentRelease } from '../data/currentRelease'
import { useWhatsNewOnce, type LaunchScreen } from './useWhatsNewOnce'

interface Props {
  screen: LaunchScreen
  readOnly?: boolean
  lastSeenReleaseId?: string
}

function launch(initial: Props) {
  const onOpen = vi.fn()
  const view = renderHook(
    ({ screen, readOnly = false, lastSeenReleaseId }: Props) =>
      useWhatsNewOnce({ screen, readOnly, lastSeenReleaseId, onOpen }),
    { initialProps: initial },
  )
  return { ...view, onOpen }
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

beforeEach(() => {
  // jsdom's document has focus only once an element has had it; a browser's
  // has it whenever its window is in front.
  vi.spyOn(document, 'hasFocus').mockReturnValue(true)
})

afterEach(() => {
  Reflect.deleteProperty(document, 'visibilityState')
  vi.restoreAllMocks()
})

describe("opening What's new by itself after an update", () => {
  it('opens once, the first time an updated garden is shown', () => {
    const { rerender, onOpen } = launch({ screen: 'loading', lastSeenReleaseId: 'release-3-0' })
    expect(onOpen).not.toHaveBeenCalled()
    rerender({ screen: 'garden', lastSeenReleaseId: 'release-3-0' })
    expect(onOpen).toHaveBeenCalledOnce()
    rerender({ screen: 'garden', lastSeenReleaseId: 'release-3-0' })
    rerender({ screen: 'garden', lastSeenReleaseId: undefined })
    expect(onOpen).toHaveBeenCalledOnce()
  })

  it('opens for a garden from before release notes were kept', () => {
    const { onOpen } = launch({ screen: 'garden', lastSeenReleaseId: undefined })
    expect(onOpen).toHaveBeenCalledOnce()
  })

  it('stays shut when the notes were already read, even if that changes later', () => {
    const { rerender, onOpen } = launch({ screen: 'garden', lastSeenReleaseId: currentRelease.id })
    // A backup from an older build restored later in the visit is not an update.
    rerender({ screen: 'garden', lastSeenReleaseId: 'release-3-0' })
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('never opens for a garden begun or restored during the visit', () => {
    const { rerender, onOpen } = launch({ screen: 'no-garden' })
    rerender({ screen: 'garden', lastSeenReleaseId: 'release-3-0' })
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('never opens while saving is paused, since reading them could not be kept', () => {
    const { rerender, onOpen } = launch({
      screen: 'garden',
      readOnly: true,
      lastSeenReleaseId: 'release-3-0',
    })
    rerender({ screen: 'garden', readOnly: false, lastSeenReleaseId: 'release-3-0' })
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('waits for a tab loaded in the background to be seen', () => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    const { onOpen } = launch({ screen: 'garden', lastSeenReleaseId: 'release-3-0' })
    expect(onOpen).not.toHaveBeenCalled()
    setVisibility('visible')
    expect(onOpen).toHaveBeenCalledOnce()
    setVisibility('hidden')
    setVisibility('visible')
    expect(onOpen).toHaveBeenCalledOnce()
  })

  it('waits for a window without focus to be turned to', () => {
    const hasFocus = vi.spyOn(document, 'hasFocus').mockReturnValue(false)
    const { onOpen } = launch({ screen: 'garden', lastSeenReleaseId: 'release-3-0' })
    expect(onOpen).not.toHaveBeenCalled()
    hasFocus.mockReturnValue(true)
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(onOpen).toHaveBeenCalledOnce()
  })

  it('leaves them shut in a background tab once another tab has opened them', () => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    const { rerender, onOpen } = launch({ screen: 'garden', lastSeenReleaseId: 'release-3-0' })
    // The other tab marked them read, and this tab took up its garden.
    rerender({ screen: 'garden', lastSeenReleaseId: currentRelease.id })
    setVisibility('visible')
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('never opens over a dialog the gardener has open', () => {
    const dialog = document.createElement('dialog')
    dialog.setAttribute('open', '')
    document.body.append(dialog)
    const { onOpen } = launch({ screen: 'garden', lastSeenReleaseId: 'release-3-0' })
    expect(onOpen).not.toHaveBeenCalled()
    // Another modal, marked so rather than native.
    dialog.remove()
    const sheet = document.createElement('div')
    sheet.setAttribute('aria-modal', 'true')
    document.body.append(sheet)
    setVisibility('visible')
    expect(onOpen).not.toHaveBeenCalled()
    // Closed, and the garden seen again: now they open.
    sheet.remove()
    setVisibility('visible')
    expect(onOpen).toHaveBeenCalledOnce()
  })

  it('stops waiting when the app closes', () => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    const { unmount, onOpen } = launch({ screen: 'garden', lastSeenReleaseId: 'release-3-0' })
    unmount()
    setVisibility('visible')
    expect(onOpen).not.toHaveBeenCalled()
  })
})
