import { describe, expect, it } from 'vitest'
import html from '../index.html?raw'

/*
 * index.html is the page of both builds, the PWA's and the Android app's.
 * Until the garden has an address of its own that can send headers
 * (docs/moving-the-garden.md), what the page asks of the browser it asks
 * here.
 */
const page = new DOMParser().parseFromString(html, 'text/html')

describe('5.1 the page sends no Referer', () => {
  it('asks for no-referrer, before it asks for anything at all', () => {
    const policy = page.head.querySelectorAll('meta[name="referrer"]')
    expect(policy).toHaveLength(1)
    expect(policy[0].getAttribute('content')).toBe('no-referrer')
    // Every icon, stylesheet and script the page names comes after it, and
    // so is fetched under it.
    const first = page.head.querySelector('link, script, style')
    expect(first).not.toBeNull()
    expect(policy[0].compareDocumentPosition(first!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
