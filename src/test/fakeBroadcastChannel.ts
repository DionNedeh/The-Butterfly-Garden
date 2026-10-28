/**
 * A BroadcastChannel for tests, where each instance stands for one tab's end
 * of a channel. A message reaches every other open instance of the same name,
 * as the browser's does, but at once, so a test needs no waiting.
 */
export class FakeBroadcastChannel {
  static readonly open = new Set<FakeBroadcastChannel>()

  onmessage: ((event: MessageEvent) => void) | null = null
  readonly name: string

  constructor(name: string) {
    this.name = name
    FakeBroadcastChannel.open.add(this)
  }

  postMessage(data: unknown): void {
    for (const other of [...FakeBroadcastChannel.open]) {
      if (other !== this && other.name === this.name)
        other.onmessage?.(new MessageEvent('message', { data }))
    }
  }

  close(): void {
    FakeBroadcastChannel.open.delete(this)
  }

  /** Every channel still open by this name. */
  static named(name: string): FakeBroadcastChannel[] {
    return [...FakeBroadcastChannel.open].filter((channel) => channel.name === name)
  }
}
