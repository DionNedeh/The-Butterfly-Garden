import { recapHoursOf } from './date'
import type { AppearanceTheme, Profile, ThemeFollows } from '../types'

/** What Settings offers: a theme chosen by hand, or something to follow. */
export type ThemeChoice = AppearanceTheme | ThemeFollows

/** The parts of a profile the theme depends on. */
type ThemeProfile = Pick<
  Profile,
  'theme' | 'themeFollows' | 'recapOpensHour' | 'recapGraceEndsHour'
>

/**
 * The hour a followed evening gives way to the day: 6am.
 *
 * Not the recap's late-night hour, which is 4am unless the gardener moved it:
 * at four it is still dark for most of the year, and a bright cream page then
 * would dazzle someone who is still up. Six is about when daylight and most
 * mornings begin. A gardener whose late night runs past six keeps the night
 * until it ends, so a night-shift worker is not handed sunlight mid-recap.
 */
export const EVENING_THEME_ENDS_HOUR = 6

/**
 * When a followed evening is night: from the hour the gardener's evening
 * starts (the hour the Moonlight recap opens) until the morning. The evening
 * starts at noon at the earliest and the morning comes by 10am, so the night
 * always runs across midnight and the two hours never meet.
 */
export function eveningNightHours(
  profile: Pick<Profile, 'recapOpensHour' | 'recapGraceEndsHour'> | undefined,
): { from: number; until: number } {
  const { opensHour, graceEndsHour } = recapHoursOf(profile)
  return { from: opensHour, until: Math.max(EVENING_THEME_ENDS_HOUR, graceEndsHour) }
}

/** The choice Settings shows as selected. */
export function themeChoiceOf(profile: ThemeProfile | undefined): ThemeChoice {
  return profile?.themeFollows ?? (profile?.theme === 'night' ? 'night' : 'sunlight')
}

/**
 * The theme to draw right now.
 *
 * Pure, so every mode can be tested at any hour: the caller reads the clock
 * and the device's dark setting (`prefersDark`, from prefers-color-scheme).
 * Local wall-clock, like the recap window, so an evening is whatever the
 * device calls one.
 */
export function effectiveTheme(
  profile: ThemeProfile | undefined,
  now: Date,
  prefersDark: boolean,
): AppearanceTheme {
  switch (profile?.themeFollows) {
    case 'device':
      return prefersDark ? 'night' : 'sunlight'
    case 'evening': {
      const { from, until } = eveningNightHours(profile)
      const hour = now.getHours()
      return hour >= from || hour < until ? 'night' : 'sunlight'
    }
    default:
      return profile?.theme === 'night' ? 'night' : 'sunlight'
  }
}

/**
 * The next moment a followed evening turns the theme, or undefined when
 * nothing on the clock will. The shell sets one timer to it rather than
 * checking the time every minute.
 */
export function nextThemeChange(
  profile: ThemeProfile | undefined,
  now: Date,
): Date | undefined {
  if (profile?.themeFollows !== 'evening') return undefined
  const { from, until } = eveningNightHours(profile)
  // Today's and tomorrow's two turning hours; the first still to come is next.
  // Built from the calendar rather than by adding hours, so a change of the
  // clocks in spring or autumn still lands on the hour the gardener sees.
  return [0, 1]
    .flatMap((days) =>
      [from, until].map(
        (hour) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, hour),
      ),
    )
    .filter((moment) => moment > now)
    .sort((a, b) => a.getTime() - b.getTime())[0]
}

/**
 * The browser's own bars, as index.html colours them for each device scheme.
 * These are the cream and the deep blue behind each theme's header.
 */
const BAR_COLOURS: Record<AppearanceTheme, string> = {
  sunlight: '#f7f3e8',
  night: '#07131f',
}

/**
 * Colour the browser's bars (meta theme-color) to match the garden.
 *
 * index.html colours them by the device's dark setting, which is right until
 * a garden opens; after that a night garden on a light device would sit under
 * a cream bar. Returns a function that puts index.html's colours back.
 */
export function paintBrowserBars(theme: AppearanceTheme): () => void {
  const metas = [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')]
  const before = metas.map((meta) => meta.content)
  for (const meta of metas) meta.content = BAR_COLOURS[theme]
  return () => {
    metas.forEach((meta, index) => {
      meta.content = before[index]
    })
  }
}
