import { useId } from 'react'
import {
  JAR_ACCENTED,
  JAR_LETTERS,
  JAR_MARK_NAMES,
  JAR_MARKS,
  JAR_NUMBERS,
} from '../../data/jars'

interface CharacterGroup {
  /** Short and space-free: part of an element id. */
  key: string
  label: string
  characters: readonly string[]
}

const everyday: readonly CharacterGroup[] = [
  { key: 'letters', label: 'Letters', characters: [...JAR_LETTERS] },
  { key: 'numbers', label: 'Numbers', characters: [...JAR_NUMBERS] },
]
const more: readonly CharacterGroup[] = [
  { key: 'accented', label: 'Accented letters', characters: [...JAR_ACCENTED] },
  { key: 'marks', label: 'Marks', characters: [...JAR_MARKS] },
]

/**
 * Which character a new jar carries: letters and numbers first, as ever,
 * and the accented capitals and marks folded beneath them, so a phone does
 * not scroll past seventy buttons to reach the colours.
 */
export function JarCharacterPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (character: string) => void
}) {
  const id = useId()
  const group = ({ key, label, characters }: CharacterGroup) => (
    <div
      key={key}
      className="jar-character-group"
      role="group"
      aria-labelledby={`${id}-${key}`}
    >
      <p className="jar-group-label" id={`${id}-${key}`}>
        {label}
      </p>
      <div className="jar-character-grid">
        {characters.map((character) => (
          <button
            key={character}
            className={value === character ? 'selected' : ''}
            aria-pressed={value === character}
            // A mark is said by name as well. Read on its own, a lone "." or
            // "*" may be passed over in silence, leaving a button with no name.
            aria-label={JAR_MARK_NAMES[character] && `${character} ${JAR_MARK_NAMES[character]}`}
            onClick={() => onChange(character)}
          >
            {character}
          </button>
        ))}
      </div>
    </div>
  )
  return (
    <div className="jar-characters">
      {everyday.map(group)}
      <details className="jar-more-characters">
        <summary>Accents and marks</summary>
        {more.map(group)}
      </details>
    </div>
  )
}
