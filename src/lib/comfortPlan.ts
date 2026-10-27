import type { AppState, ComfortPlan, ComfortSection, Profile } from '../types'

/**
 * A comfort plan (plan c.8): a private page the gardener writes for their
 * harder days, in their own words. This is what storage and the app shell
 * need of it: its limits, the cleaning both the page and storage apply, and
 * how a change reaches the profile. The edits themselves
 * (lib/comfortPlanEdits) load with the page, so the first load carries none.
 *
 * The plan is kept in the profile, not beside it in the stored meta record:
 * an older build writes that record field by field and would drop a field it
 * did not know, but it carries the profile through whole, as it does saved
 * looks. Nothing else in the garden reads it.
 */

/** The plan's lists, in the order its page shows them. */
export const COMFORT_SECTIONS: readonly ComfortSection[] = [
  'helps',
  'people',
  'places',
  'kindWords',
  'matters',
]

/** How many lines a list keeps: few enough to read through on a hard day. */
export const COMFORT_ITEMS = 12

/** How long one line may be. */
export const COMFORT_TEXT_LENGTH = 200

/** How long a phone number may be, spaces and dashes included. */
export const PHONE_LENGTH = 32

/** A line as it is kept: trimmed, and no longer than COMFORT_TEXT_LENGTH. */
export function comfortText(text: string): string {
  return text.trim().slice(0, COMFORT_TEXT_LENGTH).trim()
}

/**
 * A phone number as it is kept: as the gardener wrote it, in the characters
 * numbers are written with (digits, plus signs, brackets, dots, dashes and
 * single spaces), no longer than PHONE_LENGTH. Anything else becomes a space.
 * The brackets stay, so "+44 (0)7700 900123" is shown as it was written and
 * the bracketed 0 can still be left out when it is dialled (telHref). Empty
 * when no digit is left, since that is no number at all.
 */
export function phoneNumber(text: string): string {
  const kept = text
    .replace(/[^\d+ ().-]+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim()
    .slice(0, PHONE_LENGTH)
    .trim()
  return /\d/.test(kept) ? kept : ''
}

/**
 * The garden after a change to its comfort plan. `change` is given the plan
 * as it is (empty when none is written) and returns it changed, or the very
 * same plan for no change, which hands back the very same garden. A plan
 * with nothing left in it is not kept at all, as before one was written.
 */
export function changeComfortPlan(
  state: AppState,
  change: (plan: ComfortPlan) => ComfortPlan,
): AppState {
  if (!state.profile) return state
  const plan = state.profile.comfortPlan ?? {}
  const next = change(plan)
  if (next === plan) return state
  const profile: Profile = { ...state.profile, comfortPlan: next }
  if (Object.keys(next).length === 0) delete profile.comfortPlan
  return { ...state, profile }
}
