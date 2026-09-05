import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'

// Unmount between tests so one render cannot be found by the next one.
afterEach(() => {
  cleanup()
})
