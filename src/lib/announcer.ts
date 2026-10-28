import type { GardenEvent } from './gardenEvents'

type Listener = (events: GardenEvent[]) => void

const listeners = new Set<Listener>()

/** Tell whoever is listening (the Celebrations component) what just happened. */
export function announce(events: GardenEvent[]): void {
  if (events.length === 0) return
  for (const listener of listeners) listener(events)
}

export function onAnnouncement(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
