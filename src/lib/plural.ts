const english = new Intl.PluralRules('en')

/** "1 day", "3 days": a count with the word that agrees with it. */
export function counted(count: number, one: string, other: string): string {
  return `${count} ${english.select(count) === 'one' ? one : other}`
}

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']

/** "two goals", "12 goals": a count in words where words read more kindly. */
export function countedInWords(count: number, one: string, other: string): string {
  const number = Number.isInteger(count) && count >= 0 && count < WORDS.length ? WORDS[count] : String(count)
  return `${number} ${english.select(count) === 'one' ? one : other}`
}

/** "a", "a and b", "a, b and c". */
export function listed(items: readonly string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`
}
