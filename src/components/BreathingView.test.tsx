import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDraft, resetDrafts } from '../lib/drafts'
import { FOLDED_CALM } from '../lib/breathPacer'
import { createInitialState, DAILY_SUNLIGHT_CAP } from '../lib/progression'
import { contexts, installAudio } from '../test/fakeAudio'
import type { AppState, AppView, Profile, SunlightAward } from '../types'
import { BreathingView } from './BreathingView'

const NOW = new Date(2026, 9, 27, 10)
const TODAY = '2026-10-27'

interface FakeAnimation {
  keyframes: Keyframe[]
  options: KeyframeAnimationOptions
  startTime: number | null
  cancel: ReturnType<typeof vi.fn>
}

let animations: FakeAnimation[] = []

/** What was brought into view, in order: jsdom has no scrolling of its own. */
let scrolledTo: Array<{ element: Element; options: ScrollIntoViewOptions | boolean | undefined }> = []

function garden(profile: Partial<Profile> = {}, overrides: Partial<AppState> = {}): AppState {
  const state = createInitialState('Robin', 'Breath', NOW)
  return { ...state, profile: { ...state.profile!, ...profile }, ...overrides }
}

function award(source: string): SunlightAward {
  return { id: source, localDate: TODAY, source, awardedAt: NOW.toISOString() }
}

function renderView(
  options: { state?: AppState; from?: AppView; onFinish?: (() => void) | null } = {},
) {
  const onFinish = options.onFinish === null ? undefined : (options.onFinish ?? vi.fn())
  const onBack = vi.fn()
  const view = render(
    <BreathingView
      state={options.state ?? garden()}
      onFinish={onFinish}
      from={options.from}
      onBack={onBack}
    />,
  )
  return { ...view, onFinish, onBack }
}

/** Let the session's clock run on, and its timers with it. */
function wait(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

const start = () => fireEvent.click(screen.getByRole('button', { name: 'Start breathing' }))
const count = () => document.querySelector('.breath-count')?.textContent
const spoken = () => document.querySelector('[aria-live="polite"]')?.textContent

/** Reduced motion, as the system would say it. */
function preferReducedMotion() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('prefers-reduced-motion'),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] })
  vi.setSystemTime(NOW)
  animations = []
  scrolledTo = []
  Element.prototype.scrollIntoView = vi.fn(function (
    this: Element,
    options?: ScrollIntoViewOptions | boolean,
  ) {
    scrolledTo.push({ element: this, options })
  })
  // jsdom has no Web Animations; this one remembers what it was asked.
  Element.prototype.animate = vi.fn(function (
    keyframes: Keyframe[] | PropertyIndexedKeyframes | null,
    options?: number | KeyframeAnimationOptions,
  ) {
    const animation: FakeAnimation = {
      keyframes: keyframes as Keyframe[],
      options: options as KeyframeAnimationOptions,
      startTime: null,
      cancel: vi.fn(),
    }
    animations.push(animation)
    return animation as unknown as Animation
  })
})

afterEach(() => {
  cleanup()
  resetDrafts()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(Element.prototype, 'animate')
  Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
  vi.restoreAllMocks()
  Reflect.deleteProperty(document, 'visibilityState')
})

describe('breathing with a butterfly', () => {
  it('opens on its name, says what it is, and how long each breath is', () => {
    renderView()
    const heading = screen.getByRole('heading', { level: 1, name: 'Breathe with Marigold' })
    expect(heading).toHaveFocus()
    expect(screen.getByText('A calming exercise')).toBeInTheDocument()
    expect(screen.getByText('In… 4 · Out… 6')).toBeInTheDocument()
    expect(screen.getByText('If you feel light-headed, breathe normally.')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Marigold, Monarch' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Slow breathing/ })).toBeChecked()
    expect(screen.getByRole('radio', { name: '1 minute' })).toBeChecked()
  })

  it('paces with the active companion once it has wings', () => {
    const state = garden()
    const sol = { ...state.creatures[0], stage: 'butterfly' as const }
    renderView({ state: { ...state, creatures: [sol], profile: { ...state.profile!, activeCompanionId: sol.id } } })
    expect(screen.getByRole('heading', { level: 1, name: 'Breathe with Sol' })).toBeInTheDocument()
    expect(screen.getByText('Breathe in as Sol’s wings open, and out as they close.')).toBeInTheDocument()
  })

  it('starts with a tap, hands focus to Stop, and counts each breath', () => {
    renderView()
    start()
    expect(screen.getByRole('button', { name: 'Stop' })).toHaveFocus()
    // Nothing else to choose while it runs.
    expect(screen.queryByRole('group', { name: 'Pattern' })).toBeNull()
    expect(count()).toBe('In… 1')
    expect(spoken()).toBe('In')
    // Each change is drawn a moment after its second, never a moment before.
    wait(1020)
    expect(count()).toBe('In… 2')
    wait(3000)
    expect(count()).toBe('Out… 1')
    expect(spoken()).toBe('Out')
    wait(5000)
    expect(count()).toBe('Out… 6')
    wait(1000)
    expect(count()).toBe('In… 1')
  })

  it('brings the count, then Stop, into view as it starts, and no further', () => {
    renderView()
    const focus = vi.spyOn(HTMLElement.prototype, 'focus')
    start()
    const stop = screen.getByRole('button', { name: 'Stop' })
    // Focus alone would centre Stop, which can take the count up under the
    // header; it is only moved as far as each needs, the count first.
    expect(focus).toHaveBeenCalledWith({ preventScroll: true })
    expect(stop).toHaveFocus()
    expect(scrolledTo).toEqual([
      { element: document.querySelector('.breath-count-box'), options: { block: 'nearest' } },
      { element: stop, options: { block: 'nearest' } },
    ])
    // Nothing more is moved while it runs, or when it stops.
    wait(5000)
    fireEvent.click(stop)
    expect(scrolledTo).toHaveLength(2)
  })

  it('moves both wings on one Web Animations timeline, a transform only', () => {
    renderView()
    start()
    expect(animations).toHaveLength(2)
    for (const animation of animations) {
      expect(animation.options).toEqual({ duration: 10_000, iterations: 6 })
      expect(animation.keyframes.map((frame) => Object.keys(frame).sort())).toEqual(
        Array(3).fill(['easing', 'offset', 'transform']),
      )
      // Both start at the session's own start, where the count does.
      expect(animation.startTime).toBe(animations[0].startTime)
    }
    expect(animations[0].startTime).toEqual(expect.any(Number))
  })

  it('stops with one tap: nothing is counted, and focus goes back to Start', () => {
    const { onFinish } = renderView()
    start()
    wait(30_000)
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    expect(screen.getByRole('button', { name: 'Start breathing' })).toHaveFocus()
    expect(screen.getByRole('status')).toHaveTextContent('Stopped. Come back whenever you like.')
    expect(animations.every((animation) => animation.cancel.mock.calls.length > 0)).toBe(true)
    wait(60_000)
    expect(onFinish).not.toHaveBeenCalled()
    expect(screen.queryByRole('heading', { name: 'All done' })).toBeNull()
  })

  it('counts a session run to its end as care today, and says so', () => {
    const { onFinish } = renderView()
    start()
    wait(59_000)
    expect(onFinish).not.toHaveBeenCalled()
    wait(1100)
    expect(onFinish).toHaveBeenCalledOnce()
    expect(screen.getByRole('heading', { level: 2, name: 'All done' })).toHaveFocus()
    expect(screen.getByText('That counts as care today.')).toBeInTheDocument()
    expect(screen.getByText(/Marigold rests, wings folded/)).toBeInTheDocument()
    // Another session can follow; it is counted once a day by the garden.
    fireEvent.click(screen.getByRole('button', { name: 'Breathe again' }))
    expect(screen.getByRole('button', { name: 'Stop' })).toHaveFocus()
    expect(screen.queryByText('That counts as care today.')).toBeNull()
  })

  it('says when today’s breathing was already counted', () => {
    renderView({ state: garden({}, { sunlight: [award(`breath:${TODAY}`)] }) })
    start()
    wait(61_000)
    expect(screen.getByText('Already counted today.')).toBeInTheDocument()
  })

  it('says when today’s Sunlight is already full', () => {
    const sunlight = Array.from({ length: DAILY_SUNLIGHT_CAP }, (_, index) => award(`goal:${index}`))
    renderView({ state: garden({}, { sunlight }) })
    start()
    wait(61_000)
    expect(screen.getByText(/Today’s Sunlight is already full/)).toBeInTheDocument()
  })

  it('says nothing of care where the garden cannot keep it', () => {
    renderView({ onFinish: null })
    start()
    wait(61_000)
    expect(screen.getByRole('heading', { name: 'All done' })).toBeInTheDocument()
    expect(screen.queryByText(/today\./)).toBeNull()
  })

  it('keeps the wings still under reduced motion, and the count carries it', () => {
    renderView({ state: garden({ reducedMotion: true }) })
    expect(
      screen.getByText('Follow the count: breathe in while it says In, and out while it says Out.'),
    ).toBeInTheDocument()
    expect(document.querySelector('.breath-moving')).toBeNull()
    start()
    expect(animations).toEqual([])
    expect(count()).toBe('In… 1')
    wait(4020)
    expect(count()).toBe('Out… 1')
  })

  it('keeps them still when the system asks for less motion too', () => {
    preferReducedMotion()
    renderView()
    start()
    expect(animations).toEqual([])
    expect(count()).toBe('In… 1')
  })

  it('moves them less far in Calm motion', () => {
    renderView({ state: garden({ calmMotion: true }) })
    start()
    expect(animations[0].keyframes[0].transform).toBe(`scaleX(${FOLDED_CALM})`)
  })

  it('catches up at once when the page is seen again', () => {
    renderView()
    start()
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(count()).toBe('In… 1')
  })

  it('leaves with Escape, as Android’s back gesture does, and with its own button', () => {
    const { onBack } = renderView({ from: 'today' })
    start()
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(onBack).toHaveBeenCalledOnce()
    fireEvent.keyDown(document.body, { key: 'Enter' })
    fireEvent.click(screen.getByRole('button', { name: 'Back to Today' }))
    expect(onBack).toHaveBeenCalledTimes(2)
  })

  it('leaves Escape to an open dialog', () => {
    const { onBack } = renderView()
    const dialog = document.createElement('dialog')
    dialog.setAttribute('open', '')
    document.body.append(dialog)
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(onBack).not.toHaveBeenCalled()
    dialog.remove()
  })

  it('names the page it goes back to', () => {
    renderView({ from: 'support' })
    expect(screen.getByRole('button', { name: 'Back to support' })).toBeInTheDocument()
    cleanup()
    renderView()
    expect(screen.getByRole('button', { name: 'Back to the garden' })).toBeInTheDocument()
  })
})

describe('the choices', () => {
  it('adjust the breath in and out, never letting out be shorter than in', () => {
    renderView()
    fireEvent.change(screen.getByLabelText('Breathe in'), { target: { value: '6' } })
    expect(screen.getByText('In… 6 · Out… 6')).toBeInTheDocument()
    const out = screen.getByLabelText('Breathe out')
    expect(within(out).getAllByRole('option').map((option) => option.textContent)).toEqual([
      '6 seconds',
      '7 seconds',
      '8 seconds',
    ])
    fireEvent.change(out, { target: { value: '8' } })
    expect(screen.getByText('In… 6 · Out… 8')).toBeInTheDocument()
    start()
    expect(animations[0].options).toEqual({ duration: 14_000, iterations: 4 })
  })

  it('offer the cyclic sigh, whose breath in is its own', () => {
    renderView()
    fireEvent.click(screen.getByRole('radio', { name: /Cyclic sigh/ }))
    expect(screen.getByText('In… 2 · In again… 1 · Out… 6')).toBeInTheDocument()
    expect(screen.queryByLabelText('Breathe in')).toBeNull()
    start()
    wait(2020)
    expect(count()).toBe('In again… 1')
    wait(1000)
    expect(count()).toBe('Out… 1')
  })

  it('last one, three or five minutes, and are kept for next time on this device', () => {
    renderView()
    fireEvent.click(screen.getByRole('radio', { name: '5 minutes' }))
    expect(JSON.parse(getDraft('breathing-choices') ?? '{}')).toMatchObject({ minutes: 5 })
    cleanup()
    renderView()
    expect(screen.getByRole('radio', { name: '5 minutes' })).toBeChecked()
    start()
    expect(animations[0].options).toEqual({ duration: 10_000, iterations: 30 })
  })
})

describe('the tone', () => {
  it('is off when the garden’s sound is off, and makes no sound', () => {
    installAudio()
    renderView()
    expect(screen.getByRole('checkbox', { name: /A soft tone at each turn/ })).not.toBeChecked()
    start()
    expect(contexts).toEqual([])
  })

  it('follows the garden’s sound until chosen, and starts inside the tap', () => {
    installAudio()
    renderView({ state: garden({ ambientSound: true }) })
    expect(screen.getByRole('checkbox', { name: /A soft tone at each turn/ })).toBeChecked()
    start()
    expect(contexts).toHaveLength(1)
    const tones = () => contexts[0].nodes.filter((node) => node.kind === 'oscillator')
    // The first turn sounds at once; the next is queued a moment ahead.
    expect(tones()).toHaveLength(1)
    wait(3000)
    expect(tones()).toHaveLength(2)
    expect(tones()[1].frequency.value).toBeLessThan(tones()[0].frequency.value)
    // Stopping closes it.
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    wait(500)
    expect(contexts[0].close).toHaveBeenCalled()
  })

  it('can be turned on with the sound off, and is kept as chosen', () => {
    installAudio()
    renderView()
    fireEvent.click(screen.getByRole('checkbox', { name: /A soft tone at each turn/ }))
    expect(JSON.parse(getDraft('breathing-choices') ?? '{}')).toMatchObject({ tone: true })
    start()
    expect(contexts).toHaveLength(1)
  })

  it('falls silent when the page is left mid-breath', () => {
    installAudio()
    const { unmount } = renderView({ state: garden({ ambientSound: true }) })
    start()
    unmount()
    wait(500)
    expect(contexts[0].close).toHaveBeenCalled()
  })
})
