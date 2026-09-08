import { describe, expect, it } from 'vitest'
import {
  currentRelease,
  getRelease,
  hasUnseenRelease,
  releases,
} from './releases'

describe('release notes', () => {
  it('gives every release a unique id and some content', () => {
    const ids = releases.map((release) => release.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const release of releases) {
      expect(release.version).toMatch(/^\d+\.\d+\.\d+$/)
      expect(release.title.length).toBeGreaterThan(0)
      expect(release.sections.length).toBeGreaterThan(0)
      for (const section of release.sections) {
        expect(section.title.length).toBeGreaterThan(0)
        expect(section.items.length).toBeGreaterThan(0)
      }
    }
  })

  it('describes the release this build is', () => {
    expect(currentRelease).toBe(releases[0])
    expect(getRelease(currentRelease.id)).toBe(currentRelease)
    expect(getRelease('release-from-the-future')).toBeUndefined()
  })

  it('carries no markup to render', () => {
    // Entries are plain text rendered through React's normal escaping. Markup
    // here would either show up literally or invite rendering it as HTML.
    const text = releases
      .flatMap((release) => release.sections.flatMap((section) => section.items))
      .join(' ')
    expect(text).not.toMatch(/<[a-z/]/i)
  })

  it('makes no claim about a subscription', () => {
    const text = releases
      .flatMap((release) => release.sections.flatMap((section) => section.items))
      .join(' ')
      .toLowerCase()
    expect(text).toContain('no subscription or payment is active')
    for (const forbidden of ['subscribed', 'renews', 'trial', 'billed']) {
      expect(text).not.toContain(forbidden)
    }
  })

  it('treats a fresh garden and an unknown id as having notes to read', () => {
    expect(hasUnseenRelease(undefined)).toBe(true)
    // Usually a backup from a newer build. Hiding the notes because of a value
    // this build cannot place would leave no way to read them at all.
    expect(hasUnseenRelease('release-from-the-future')).toBe(true)
    expect(hasUnseenRelease(currentRelease.id)).toBe(false)
  })
})
