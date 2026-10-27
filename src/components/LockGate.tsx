import { lazy, Suspense, type ReactNode } from 'react'
import { useLockState } from '../hooks/useLockState'
import { SplashScreen } from './SplashScreen'

// The lock's screens, fetched only for a garden that turns out to have one.
const LockScreen = lazy(() =>
  import('./lock/LockScreen').then((m) => ({ default: m.LockScreen })),
)
const LockWatch = lazy(() =>
  import('./lock/LockWatch').then((m) => ({ default: m.LockWatch })),
)

/**
 * The garden lock's place in the shell, around the whole app.
 *
 * Without a lock it only passes the app through. When reading the garden
 * finds a lock this tab holds no key for (the repository says so), the app
 * is taken down -- and the garden it held in memory with it -- and the lock
 * screen shown instead; unlocking brings the app back, which loads the
 * garden as it always does. Another tab changing the lock is followed by
 * the app's own sync (hooks/usePersistence) or by the lock screen.
 */
export function LockGate({ children }: { children: ReactNode }) {
  const lock = useLockState()
  if (lock === 'locked') {
    return (
      <Suspense fallback={<SplashScreen />}>
        <LockScreen />
      </Suspense>
    )
  }
  return (
    <>
      {children}
      {lock === 'unlocked' && (
        <Suspense fallback={null}>
          <LockWatch />
        </Suspense>
      )}
    </>
  )
}
