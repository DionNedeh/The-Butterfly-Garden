import { describe, expect, it } from 'vitest'
import { currentRelease, hasUnseenRelease, releaseName } from './currentRelease'
import { getRelease, releases } from './releases'

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
    // The first load knows only the id and version; the newest notes must be
    // the ones for that release, or What's new would describe another build.
    expect(releases[0].id).toBe(currentRelease.id)
    expect(releases[0].version).toBe(currentRelease.version)
    expect(getRelease(currentRelease.id)).toBe(releases[0])
    expect(getRelease('release-from-the-future')).toBeUndefined()
  })

  it('is the version the app reports', () => {
    expect(currentRelease.version).toBe(__APP_VERSION__)
  })

  it('keeps the 3.0 notes as they were', () => {
    const three = getRelease('release-3-0')
    expect(three?.version).toBe('3.0.0')
    expect(three?.title).toBe('A livelier garden')
  })

  it('leaves the date off a release still to go out', () => {
    expect(releases[0].releasedOn).toBeUndefined()
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

describe('speaking of a release', () => {
  it('names it by major and minor version', () => {
    expect(releaseName({ version: '3.0.0' })).toBe('3.0')
    expect(releaseName({ version: '3.12.4' })).toBe('3.12')
    expect(releaseName()).toBe(currentRelease.version.split('.').slice(0, 2).join('.'))
  })
})
