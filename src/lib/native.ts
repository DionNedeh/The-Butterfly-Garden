/**
 * The Android app's native side, reached through Capacitor.
 *
 * Every function here does nothing in the PWA. Each checks
 * `import.meta.env.VITE_PLATFORM` inline rather than calling isAndroidApp():
 * the bundler folds only the literal expression, and folding it is what drops
 * the Capacitor imports below from the web build altogether.
 */
import type { AppPlugin } from '@capacitor/app'
import type { PluginListenerHandle } from '@capacitor/core'

export type Unsubscribe = () => void

const nothing: Unsubscribe = () => undefined

/**
 * Subscribe to a Capacitor listener that is only available asynchronously,
 * returning a synchronous unsubscribe that also covers the case where the
 * caller leaves before the listener has been attached. A listener that cannot
 * be attached at all (a plugin missing from this build) is simply absent.
 */
export function attach(pending: Promise<PluginListenerHandle>): Unsubscribe {
  let handle: PluginListenerHandle | undefined
  let detached = false
  pending.then(
    (attached) => {
      if (detached) void attached.remove()
      else handle = attached
    },
    () => undefined,
  )
  return () => {
    detached = true
    void handle?.remove()
  }
}

/**
 * Every use of the App plugin, one after another.
 *
 * Capacitor loads a plugin's web implementation lazily, and two calls that
 * race before it has loaded each create their own copy; only one is kept, and
 * listeners added to the other are silently lost. On a device the calls go
 * straight to native code, but in a browser (the Android bundle under test)
 * this would drop the back-gesture handler at random. Queueing costs nothing.
 */
let appPluginQueue: Promise<unknown> = Promise.resolve()

function withAppPlugin<T>(use: (app: AppPlugin) => Promise<T>): Promise<T> {
  const next = appPluginQueue.then(async () => {
    const { App } = await import('@capacitor/app')
    return use(App)
  })
  appPluginQueue = next.catch(() => undefined)
  return next
}

/**
 * Android's system back gesture or button. While a handler is registered,
 * Capacitor no longer closes the app on its own; the handler decides.
 */
export function onBackButton(handler: () => void): Unsubscribe {
  if (import.meta.env.VITE_PLATFORM !== 'android') return nothing
  return attach(withAppPlugin((app) => app.addListener('backButton', handler)))
}

/** Whether the app is in the foreground, reported on every change. */
export function onAppActiveChange(
  handler: (active: boolean) => void,
): Unsubscribe {
  if (import.meta.env.VITE_PLATFORM !== 'android') return nothing
  return attach(
    withAppPlugin((app) =>
      app.addListener('appStateChange', ({ isActive }) => handler(isActive)),
    ),
  )
}

/**
 * Send the app to the background, as Android's own back gesture does from a
 * home screen. Nothing is closed, so the garden is exactly as it was when the
 * gardener returns.
 */
export async function leaveApp(): Promise<void> {
  if (import.meta.env.VITE_PLATFORM !== 'android') return
  // If Android declines, staying where we are is the right fallback.
  await withAppPlugin((app) => app.minimizeApp()).catch(() => undefined)
}

/**
 * Status-bar and navigation-bar icons: dark over the cream sunlight theme,
 * light over the night theme. Follows the garden's own theme, not the
 * system's, because it is the garden's header that sits behind them.
 */
export async function setSystemBarsForTheme(night: boolean): Promise<void> {
  if (import.meta.env.VITE_PLATFORM !== 'android') return
  const { SystemBars, SystemBarsStyle } = await import('@capacitor/core')
  // Cosmetic: icons in the wrong shade are better than an error.
  await SystemBars.setStyle({
    style: night ? SystemBarsStyle.Dark : SystemBarsStyle.Light,
  }).catch(() => undefined)
}

/**
 * One of the plugins that live in this app (android/app/src/main/java),
 * registered once.
 *
 * Handed back inside a plain object: a Capacitor plugin proxy answers every
 * property, `then` included, so a promise resolved with the proxy itself would
 * treat it as a thenable and call a native method named "then" that never
 * answers. Only call this after an inline VITE_PLATFORM check of your own.
 */
const inAppPlugins = new Map<string, Promise<{ plugin: unknown }>>()

export async function inAppPlugin<T>(name: string): Promise<{ plugin: T }> {
  if (import.meta.env.VITE_PLATFORM !== 'android')
    throw new Error(`${name} is only available in the Android app.`)
  let registered = inAppPlugins.get(name)
  if (!registered) {
    registered = import('@capacitor/core').then(({ registerPlugin }) => ({
      plugin: registerPlugin(name),
    }))
    inAppPlugins.set(name, registered)
  }
  return (await registered) as { plugin: T }
}

interface GardenFilesPlugin {
  saveDocument(options: {
    fileName: string
    mimeType: string
    text: string
  }): Promise<{ saved: boolean }>
}

/**
 * Write text to a file the gardener chooses with Android's "Save to…" screen.
 * Resolves false if they backed out without choosing; rejects if the chosen
 * place could not be written.
 */
export async function saveTextDocument(
  fileName: string,
  mimeType: string,
  text: string,
): Promise<boolean> {
  if (import.meta.env.VITE_PLATFORM !== 'android')
    throw new Error('Saving through Android is only available in the app.')
  const { plugin } = await inAppPlugin<GardenFilesPlugin>('GardenFiles')
  const { saved } = await plugin.saveDocument({ fileName, mimeType, text })
  return saved
}
