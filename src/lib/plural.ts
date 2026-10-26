const english = new Intl.PluralRules('en')

/** "1 day", "3 days": a count with the word that agrees with it. */
export function counted(count: number, one: string, other: string): string {
  return `${count} ${english.select(count) === 'one' ? one : other}`
}
