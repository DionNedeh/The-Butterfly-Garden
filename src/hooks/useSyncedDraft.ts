import { useState } from 'react'

/**
 * A form field seeded from stored data that keeps up with edits made
 * elsewhere, without throwing away what is being typed here.
 *
 * Seeding a `useState` from a prop only works once, at mount: if the same day's
 * check-in is edited in the journal or in another tab, the form on Today goes
 * on showing the old text, and saving it silently overwrites the newer edit.
 * Re-seeding on every change has the opposite problem -- it wipes a half-typed
 * note the moment anything else saves.
 *
 * So this adopts an external change only while the field is untouched since
 * the last time it was synced. Once the gardener has typed, their draft wins
 * until they save or leave the page.
 */
export function useSyncedDraft<T extends string | number>(
  external: T,
): [T, (value: T) => void] {
  const [draft, setDraft] = useState(external)
  const [synced, setSynced] = useState(external)

  // Adjusting state during render, rather than in an effect: React re-runs the
  // component immediately with the new value and never commits the stale one.
  if (external !== synced) {
    if (draft === synced) setDraft(external)
    setSynced(external)
  }

  return [draft, setDraft]
}
