import { useCallback, useSyncExternalStore } from 'react'

/**
 * Whether a media query matches, kept up to date as the window changes: a
 * phone turned on its side, a desktop window narrowed. False where there is
 * no matchMedia at all, as in a test that does not provide one.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof matchMedia !== 'function') return () => {}
      const list = matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    [query],
  )
  return useSyncExternalStore(
    subscribe,
    () => typeof matchMedia === 'function' && matchMedia(query).matches,
  )
}
