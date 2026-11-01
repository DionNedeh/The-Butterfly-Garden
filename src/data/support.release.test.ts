import { describe, expect, it } from 'vitest'
import { addDaysToLocalDate } from '../lib/date'
import { releases } from './releases'
import { SUPPORT_CHECKED_ON, supportLines } from './support'

/**
 * The support page's numbers must be checked again before each release
 * (data/support). These make that a failing check: dating a release more than
 * 30 days after the numbers were last checked fails here, until each one has
 * been checked on the service's own site and SUPPORT_CHECKED_ON moved on.
 */
describe('5.8 the support lines are checked before each release', () => {
  it('were checked within 30 days of the newest dated release', () => {
    const dated = releases.flatMap((release) => (release.releasedOn ? [release.releasedOn] : []))
    expect(dated.length).toBeGreaterThan(0)
    const newest = dated.reduce((latest, day) => (day > latest ? day : latest))
    expect(SUPPORT_CHECKED_ON).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(
      SUPPORT_CHECKED_ON >= addDaysToLocalDate(newest, -30),
      `the support lines were last checked on ${SUPPORT_CHECKED_ON}, more than 30 days before the release dated ${newest}: check each number on the service's own site, then update SUPPORT_CHECKED_ON in src/data/support.ts`,
    ).toBe(true)
  })

  it('dials and texts the number each link names', () => {
    const numbered = supportLines.flatMap((line) =>
      line.contacts.filter((contact) => /^(tel|sms):/.test(contact.href)),
    )
    expect(numbered.length).toBeGreaterThan(0)
    for (const contact of numbered) {
      const dialled = contact.href.replace(/^(tel|sms):/, '').replace(/\D/g, '')
      expect(dialled.length, contact.href).toBeGreaterThan(0)
      expect(dialled, `${contact.label} → ${contact.href}`).toBe(contact.label.replace(/\D/g, ''))
    }
  })
})
