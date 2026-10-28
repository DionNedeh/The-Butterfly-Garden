import { vi } from 'vitest'

/**
 * A stand-in for the Web Audio API that remembers every node it makes.
 *
 * The sound code is the only place in the app that takes hold of an
 * operating-system resource, and a context it forgets to close, or a node it
 * forgets to let go, stays alive until the tab closes. Browsers cap how many
 * contexts a page may hold at once, so a leak here ends with the garden
 * silently losing its sound -- the kind of failure nobody notices until a
 * device has been open for a while. These fakes let a test check that every
 * node made was stopped and disconnected.
 *
 * The audio clock is `currentTime`, moved by hand. `endUpTo` plays the part of
 * the browser, ending every source whose stop time has passed.
 */
function audioParam() {
  return {
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  }
}

export type FakeNode = ReturnType<typeof audioNode>

function audioNode(kind: string) {
  // Made when first touched: a long listen makes thousands of nodes, and a
  // full set of mocked parameters on each would fill the test's memory.
  const params: Partial<Record<string, ReturnType<typeof audioParam>>> = {}
  const param = (name: string) => (params[name] ??= audioParam())
  return {
    kind,
    get gain() {
      return param('gain')
    },
    get frequency() {
      return param('frequency')
    },
    get Q() {
      return param('Q')
    },
    get delayTime() {
      return param('delayTime')
    },
    get playbackRate() {
      return param('playbackRate')
    },
    get pan() {
      return param('pan')
    },
    type: 'sine',
    buffer: null as unknown,
    loop: false,
    onended: null as null | (() => void),
    /** Ended by `endUpTo`, as a browser ends a source whose time is up. */
    ended: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  }
}

/** Oscillators and buffer sources: the nodes that are started and stopped. */
export const isSource = (node: FakeNode) =>
  node.kind === 'oscillator' || node.kind === 'bufferSource'

/** When a source was asked to start (0 for "now"). */
export function startTime(node: FakeNode): number {
  return (node.start.mock.calls[0]?.[0] as number | undefined) ?? 0
}

/** When a source will stop by itself, if it was told. */
function stopTime(node: FakeNode): number | undefined {
  const stop = node.stop.mock.calls.at(-1)?.[0] as number | undefined
  if (stop !== undefined) return stop
  const [when, , duration] = (node.start.mock.calls[0] ?? []) as Array<number | undefined>
  return duration === undefined ? undefined : (when ?? 0) + duration
}

export class FakeAudioContext {
  // Low, so the seconds of noise a soundscape makes are quick to make here.
  sampleRate = 8_000
  currentTime = 0
  state: string = 'running'
  destination = {}
  nodes: FakeNode[] = []
  close = vi.fn(() => {
    this.state = 'closed'
    return Promise.resolve()
  })
  // As in a browser, the state changes once the promise settles.
  resume = vi.fn(() =>
    Promise.resolve().then(() => {
      if (this.state !== 'closed') this.state = 'running'
    }),
  )
  suspend = vi.fn(() =>
    Promise.resolve().then(() => {
      if (this.state !== 'closed') this.state = 'suspended'
    }),
  )
  createBuffer = vi.fn((_channels: number, length: number, rate: number) => {
    const data = new Float32Array(length)
    return { duration: length / rate, getChannelData: () => data }
  })
  createGain = vi.fn(() => this.make('gain'))
  createOscillator = vi.fn(() => this.make('oscillator'))
  createBufferSource = vi.fn(() => this.make('bufferSource'))
  createBiquadFilter = vi.fn(() => this.make('filter'))
  createDelay = vi.fn(() => this.make('delay'))
  createStereoPanner: (() => FakeNode) | undefined = vi.fn(() => this.make('panner'))

  private make(kind: string) {
    const node = audioNode(kind)
    this.nodes.push(node)
    return node
  }

  /** The master gain: the first node a context is asked for. */
  get master(): FakeNode {
    return this.nodes[0]
  }

  /** End every source whose stop time is now past, as the browser would. */
  endUpTo(time: number) {
    for (const node of this.nodes) {
      const stop = isSource(node) ? stopTime(node) : undefined
      if (stop === undefined || stop > time || node.ended) continue
      node.ended = true
      node.onended?.()
    }
  }

  /** Nodes not yet disconnected. */
  live(): FakeNode[] {
    return this.nodes.filter((node) => node.disconnect.mock.calls.length === 0)
  }
}

/**
 * A repeatable stand-in for Math.random (mulberry32), so a test of something
 * random gives the same answer on every run.
 */
export function seededRandom(seed = 1) {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Every context made since `installAudio`, in order. */
export let contexts: FakeAudioContext[] = []

/**
 * Put the fake in place of `AudioContext`. `onConstruct` runs first in its
 * constructor, so a test can make construction fail; `state` is what a new
 * context starts as ("suspended" when the browser holds sound back).
 */
export function installAudio(
  options: { onConstruct?: () => void; state?: string; noPanner?: boolean } = {},
) {
  contexts = []
  class InstalledContext extends FakeAudioContext {
    constructor() {
      options.onConstruct?.()
      super()
      if (options.state) this.state = options.state
      if (options.noPanner) this.createStereoPanner = undefined
      contexts.push(this)
    }
  }
  vi.stubGlobal('AudioContext', InstalledContext)
}
