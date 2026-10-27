import { useSyncExternalStore } from 'react'
import { gardenRepository, type LockState } from '../repository/gardenRepository'

/** Whether the garden here has a lock, and whether it is open (repository LockState). */
export function useLockState(): LockState {
  return useSyncExternalStore(gardenRepository.onLockChange, gardenRepository.lockState)
}
