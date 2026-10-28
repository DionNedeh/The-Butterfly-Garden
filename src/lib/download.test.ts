import { describe, expect, it } from 'vitest'
import { datedFileName } from './download'

describe('a saved file’s name', () => {
  it('carries the gardener’s own calendar day, not the date in Greenwich', () => {
    // Late evening, local time: in UTC it would already be tomorrow somewhere.
    const evening = new Date(2026, 9, 27, 23, 30)
    expect(datedFileName('journal', 'md', evening)).toBe('butterfly-garden-journal-2026-10-27.md')
    expect(datedFileName('', 'json', evening)).toBe('butterfly-garden-2026-10-27.json')
  })
})
