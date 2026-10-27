import type { LetterQuotes } from '../lib/letters'

const QUOTE_CHOICES: ReadonlyArray<{ value: LetterQuotes; label: string; description: string }> = [
  {
    value: 'starred',
    label: 'Only lines I star',
    description: 'Star a check-in note or a reflection in the Journal, and a letter may quote it.',
  },
  {
    value: 'never',
    label: 'Never',
    description: 'Letters say what happened in the week, never what you wrote.',
  },
]

/**
 * Settings' choice about Marigold's weekly letters (lib/letters): whether a
 * letter may quote the gardener's own words. Only lines they starred, the
 * default, or never. A painful line is never quoted back unasked.
 */
export function LetterSetting({
  quotes,
  onChoose,
}: {
  quotes: LetterQuotes
  onChoose: (quotes: LetterQuotes) => void
}) {
  return (
    <section className="card" aria-labelledby="letter-settings-title">
      <p className="eyebrow">A letter each Sunday</p>
      <h2 id="letter-settings-title">Letters from Marigold</h2>
      <p className="section-explainer">
        Each Sunday evening Marigold writes a few lines about your week, kept in
        your journal. No scores and no advice: only what happened.
      </p>
      <fieldset className="motion-options">
        <legend>Quote my words in letters</legend>
        {QUOTE_CHOICES.map((choice) => (
          <label className="toggle-row" key={choice.value}>
            <span>
              <strong>{choice.label}</strong>
              <small>{choice.description}</small>
            </span>
            <input
              type="radio"
              name="letter-quotes"
              value={choice.value}
              checked={quotes === choice.value}
              onChange={() => onChoose(choice.value)}
            />
          </label>
        ))}
      </fieldset>
    </section>
  )
}
