import { gardenRepository } from '../repository/gardenRepository'
import { flushDrafts } from './drafts'
import { reloadApp } from './reload'

/**
 * Moving every open tab of the PWA to a new version together.
 *
 * Two tabs on different builds is how one comes to write over what a newer
 * one stored (docs/Voyager a.4 D1). So when a gardener chooses "Update now",
 * the tab that applied the update tells every other tab of the app to load
 * again, and each first puts what it holds on disk: a draft being typed, a
 * change still being written. A tab in the middle of the recap or an editor
 * reloads too; its words are drafts, and drafts survive a reload.
 *
 * The Android app has no service worker and one window; it is updated by
 * Google Play, and none of this runs there.
 */

/**
 * The tabs' own channel for updates. The garden's sync channel
 * (hooks/usePersistence) carries only what was stored, and a tab that cannot
 * read the garden stops listening there; every tab listens here.
 */
const UPDATE_CHANNEL = 'butterfly-garden-update'

/** What one tab says to the others when an update has been applied. */
interface UpdateMessage {
  type: 'reload-for-update'
  /**
   * The build the sender is leaving (vite.config.ts names each build). Only
   * a tab still on that build reloads. One its own service worker has
   * already moved to the new build stays as it is, however late the message
   * comes: a tab the service worker was not looking after sends it only when
   * its wait to hear the update land runs out (components/UpdatePrompt).
   */
  from: string
}

/** Whether something said on the channel is an update message at all. */
function isUpdateMessage(data: unknown): data is UpdateMessage {
  if (typeof data !== 'object' || data === null) return false
  const { type, from } = data as Partial<Record<keyof UpdateMessage, unknown>>
  return type === 'reload-for-update' && typeof from === 'string'
}

/** How often an open, visible garden asks whether a new version is out. */
export const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000

/**
 * How long a reload waits for drafts and writes to land. Each is a moment's
 * work; past this, something is stuck, and staying behind on the old version
 * while every other tab moves on would be worse than what it might lose.
 */
const SETTLE_LIMIT_MS = 3000

/** Whether it is time to look for a new version again. */
export function updateCheckDue(lastCheckedAt: number, now: number): boolean {
  return now - lastCheckedAt >= UPDATE_CHECK_INTERVAL_MS
}

let reloading = false

/**
 * Load the app again for an update, once any unsaved draft and any change
 * still being written are on disk. Asked twice (by another tab and by this
 * tab's own service worker), it reloads once.
 */
export async function reloadForUpdate(): Promise<void> {
  if (reloading) return
  reloading = true
  let timer: ReturnType<typeof setTimeout> | undefined
  await Promise.race([
    Promise.all([flushDrafts(), gardenRepository.settled()]),
    new Promise<void>((resolve) => {
      timer = setTimeout(resolve, SETTLE_LIMIT_MS)
    }),
  ])
  clearTimeout(timer)
  reloadApp()
}

/**
 * Tell every other open tab of the app that is still on this build to load
 * the new version too.
 */
export function reloadOtherTabs(): void {
  if (typeof BroadcastChannel === 'undefined') return
  const channel = new BroadcastChannel(UPDATE_CHANNEL)
  channel.postMessage({ type: 'reload-for-update', from: __BUILD_ID__ } satisfies UpdateMessage)
  channel.close()
}

/**
 * Reload this tab whenever another on the same build applies an update.
 * Every tab listens, on every screen, onboarding and recovery included.
 * Returns how to stop.
 */
export function followUpdates(): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => undefined
  const channel = new BroadcastChannel(UPDATE_CHANNEL)
  channel.onmessage = (event: MessageEvent<unknown>) => {
    if (isUpdateMessage(event.data) && event.data.from === __BUILD_ID__) void reloadForUpdate()
  }
  return () => channel.close()
}
