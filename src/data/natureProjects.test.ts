import { describe, expect, it } from 'vitest'
import { INATURALIST, NATURE_PROJECTS_CHECKED_ON, regionalNatureProjects } from './natureProjects'

describe('citizen-science projects', () => {
  it('has one near each marked region, and iNaturalist for anywhere', () => {
    expect(Object.keys(regionalNatureProjects).sort()).toEqual(['australasia', 'europe', 'north-america'])
    expect(regionalNatureProjects.europe.name).toBe('Big Butterfly Count')
    expect(regionalNatureProjects['north-america'].name).toBe('NABA Butterfly Counts')
    expect(regionalNatureProjects.australasia.name).toBe('Butterflies Australia')
    expect(INATURALIST.about).toMatch(/^Anywhere/)
  })

  it('links only to each project’s own page, over https, with a plain line about it', () => {
    for (const project of [INATURALIST, ...Object.values(regionalNatureProjects)]) {
      expect(new URL(project.href).protocol).toBe('https:')
      expect(project.about).toMatch(/^[A-Z].*\.$/)
      expect(project.about).not.toMatch(/\b(catch|handle)\b/i)
    }
    expect(NATURE_PROJECTS_CHECKED_ON).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
