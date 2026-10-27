import { afterEach, describe, expect, it, vi } from 'vitest'
import { homeScreenAdvice, isInstalledApp } from './install'

/** User agents as each browser sends them, trimmed to what matters. */
const AGENTS = {
  iPhoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  iPhoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1',
  iPhoneFirefox:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/132.0 Mobile/15E148 Safari/605.1.15',
  iPhoneEdge:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 EdgiOS/130.0.2849.80 Mobile/15E148 Safari/605.1.15',
  iPhoneInstagram:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0',
  /** iPadOS asks for desktop sites, so its Safari says it is a Mac. */
  iPadSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  androidChrome:
    'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  desktopChrome:
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
}

function onDevice(
  userAgent: string,
  { maxTouchPoints = 0, standalone, displayStandalone = false }: {
    maxTouchPoints?: number
    standalone?: boolean
    displayStandalone?: boolean
  } = {},
) {
  vi.stubGlobal('navigator', { ...navigator, userAgent, maxTouchPoints, standalone })
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: displayStandalone && query === '(display-mode: standalone)',
  }))
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('advice on adding the garden to the Home Screen', () => {
  it('gives Safari its own steps on an iPhone', () => {
    onDevice(AGENTS.iPhoneSafari, { maxTouchPoints: 5 })
    expect(homeScreenAdvice()).toBe('safari')
  })

  it('knows an iPad by its touch, though it says it is a Mac', () => {
    onDevice(AGENTS.iPadSafari, { maxTouchPoints: 5 })
    expect(homeScreenAdvice()).toBe('safari')
  })

  it("points other iPhone browsers to their own Share menu", () => {
    for (const agent of [
      AGENTS.iPhoneChrome,
      AGENTS.iPhoneFirefox,
      // Edge carries Safari's Version token too.
      AGENTS.iPhoneEdge,
      // An app's own browser has no Safari token at all.
      AGENTS.iPhoneInstagram,
    ]) {
      onDevice(agent, { maxTouchPoints: 5 })
      expect(homeScreenAdvice()).toBe('browser')
    }
  })

  it('says nothing once the garden is on the Home Screen', () => {
    onDevice(AGENTS.iPhoneSafari, { maxTouchPoints: 5, standalone: true })
    expect(homeScreenAdvice()).toBeUndefined()
    onDevice(AGENTS.iPadSafari, { maxTouchPoints: 5, displayStandalone: true })
    expect(homeScreenAdvice()).toBeUndefined()
  })

  it('says nothing on a Mac, on Android or on a desktop', () => {
    onDevice(AGENTS.macSafari)
    expect(homeScreenAdvice()).toBeUndefined()
    // Chrome on Android has its own install prompt, which the app answers.
    onDevice(AGENTS.androidChrome, { maxTouchPoints: 5 })
    expect(homeScreenAdvice()).toBeUndefined()
    onDevice(AGENTS.desktopChrome)
    expect(homeScreenAdvice()).toBeUndefined()
  })

  it('never says anything in the Android app', () => {
    vi.stubEnv('VITE_PLATFORM', 'android')
    onDevice(AGENTS.iPhoneSafari, { maxTouchPoints: 5 })
    expect(homeScreenAdvice()).toBeUndefined()
  })
})

describe('knowing an installed app', () => {
  it('knows an installed app from a browser tab', () => {
    onDevice(AGENTS.desktopChrome, { displayStandalone: true })
    expect(isInstalledApp()).toBe(true)
    onDevice(AGENTS.desktopChrome)
    expect(isInstalledApp()).toBe(false)
    // iOS before display-mode was reported says so on the navigator.
    onDevice(AGENTS.iPhoneSafari, { maxTouchPoints: 5, standalone: true })
    expect(isInstalledApp()).toBe(true)
  })

  it('reads a browser without matchMedia as a tab', () => {
    vi.stubGlobal('navigator', { ...navigator, userAgent: AGENTS.iPhoneSafari, maxTouchPoints: 5 })
    vi.stubGlobal('matchMedia', undefined)
    expect(isInstalledApp()).toBe(false)
    expect(homeScreenAdvice()).toBe('safari')
  })
})
