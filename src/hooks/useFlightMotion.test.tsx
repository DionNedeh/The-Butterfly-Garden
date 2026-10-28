import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useFlightMotion } from './useFlightMotion'

/** Observers that report only when the test says so. */
const observed = {
  resize: [] as Array<() => void>,
  intersection: [] as Array<(entries: Array<{ isIntersecting: boolean }>) => void>,
  disconnects: 0,
}

let reduceMotion: { matches: boolean; listeners: Array<() => void> }

function animation() {
  return { pause: vi.fn(), play: vi.fn(), cancel: vi.fn() }
}

let animations: Array<ReturnType<typeof animation>> = []

function Flyer({ reduced = false, calm = false }: { reduced?: boolean; calm?: boolean }) {
  const { travel, heading } = useFlightMotion('c1', 'gentle-drift', 0, 64, reduced, false, calm)
  return (
    <div className="frame">
      <div ref={travel} className="travel">
        <div ref={heading} />
      </div>
    </div>
  )
}

const travel = () => document.querySelector<HTMLElement>('.travel')!

let width = 360
beforeEach(() => {
  observed.resize = []
  observed.intersection = []
  observed.disconnects = 0
  animations = []
  width = 360
  reduceMotion = { matches: false, listeners: [] }
  vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(() => width)
  vi.spyOn(Element.prototype, 'clientHeight', 'get').mockReturnValue(480)
  Element.prototype.animate = vi.fn(() => {
    const created = animation()
    animations.push(created)
    return created as unknown as Animation
  })
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        observed.resize.push(callback)
      }
      observe() {}
      disconnect() {
        observed.disconnects++
      }
    },
  )
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) {
        observed.intersection.push(callback)
      }
      observe() {}
      disconnect() {
        observed.disconnects++
      }
    },
  )
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      get matches() {
        return reduceMotion.matches
      },
      addEventListener: (_: string, listener: () => void) => reduceMotion.listeners.push(listener),
      removeEventListener: (_: string, listener: () => void) => {
        reduceMotion.listeners = reduceMotion.listeners.filter((each) => each !== listener)
      },
    })),
  )
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  // @ts-expect-error -- jsdom has no animate of its own; take the stub away again.
  delete Element.prototype.animate
})

describe('a butterfly in flight', () => {
  it('builds its travel and facing animations once as it appears', () => {
    render(<Flyer />)
    expect(animations).toHaveLength(2)
    // The observer's first report is the size the track was built for.
    act(() => observed.resize[0]())
    expect(animations).toHaveLength(2)
    expect(travel().style.transform).toMatch(/^translate\(/)
  })

  it('rebuilds the track when its frame changes size, letting the old one go', () => {
    render(<Flyer />)
    const [first, second] = animations
    width = 900
    act(() => observed.resize[0]())
    expect(animations).toHaveLength(4)
    expect(first.cancel).toHaveBeenCalled()
    expect(second.cancel).toHaveBeenCalled()
  })

  it('pauses out of sight, and flies again in view', () => {
    render(<Flyer />)
    act(() => observed.intersection[0]([{ isIntersecting: false }]))
    expect(travel()).toHaveClass('flight-paused')
    expect(animations[0].pause).toHaveBeenCalled()

    act(() => observed.intersection[0]([{ isIntersecting: true }]))
    expect(travel()).not.toHaveClass('flight-paused')
    expect(animations[0].play).toHaveBeenCalled()
  })

  it('pauses while the page is hidden', () => {
    render(<Flyer />)
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(travel()).toHaveClass('flight-paused')
    hidden.mockReturnValue(false)
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(travel()).not.toHaveClass('flight-paused')
  })

  it('rests in place when motion is reduced, by setting or by the system', () => {
    render(<Flyer reduced />)
    expect(animations).toHaveLength(0)
    expect(travel().style.transform).toMatch(/^translate\(/)
  })

  it('follows the system preference as it changes', () => {
    render(<Flyer />)
    expect(animations).toHaveLength(2)
    reduceMotion.matches = true
    act(() => reduceMotion.listeners.forEach((listener) => listener()))
    expect(animations[0].cancel).toHaveBeenCalled()
    expect(animations).toHaveLength(2)
  })

  it('stops everything it started when it leaves', () => {
    const { unmount } = render(<Flyer calm />)
    unmount()
    expect(animations.every((each) => each.cancel.mock.calls.length > 0)).toBe(true)
    expect(observed.disconnects).toBe(2)
    expect(reduceMotion.listeners).toHaveLength(0)
  })

  it('stays still where the browser lacks what flight needs', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    render(<Flyer />)
    expect(animations).toHaveLength(0)
    expect(travel().style.transform).toBe('')
  })
})
