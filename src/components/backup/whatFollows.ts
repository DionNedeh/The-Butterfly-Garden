import type { ProtectedRestoreProps } from './ProtectedRestore'

/**
 * What happens once a sealed file opens, said as the screen that asked for
 * its secret does it (ProtectedRestoreProps' `next`). Only Settings shows
 * what a file holds before anything is replaced, so only there is that
 * promised; elsewhere it is restored at once, and the prompt says so.
 */
export function whatFollows(next: ProtectedRestoreProps['next'], file: 'backup' | 'copy'): string {
  switch (next) {
    case 'preview':
      return `Nothing is replaced until you have seen what the ${file} holds.`
    case 'replace':
      return 'Once it opens, it is restored straight away, in place of what is stored here.'
    case 'arrive':
      return 'Once it opens, the garden it holds is restored here straight away.'
  }
}
