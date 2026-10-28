import { goalSuggestions, WELLBEING_TAGS, type GoalSuggestion } from '../data/goalSuggestions'

/** A title as the gardener reads it: case and stray spaces aside. */
function titleKey(title: string): string {
  return title.trim().toLocaleLowerCase()
}

/** The suggestions not already among the gardener's goals, in their own order. */
export function openSuggestions(activeGoalTitles: readonly string[]): GoalSuggestion[] {
  const taken = new Set(activeGoalTitles.map(titleKey))
  return goalSuggestions.filter((suggestion) => !taken.has(titleKey(suggestion.title)))
}

/**
 * A few ideas for a new goal, each from a different part of wellbeing where
 * there are enough to go round.
 *
 * Parts the gardener's goals do not touch yet come first: someone with three
 * goals about rest is offered a walk or a message before a fourth way to
 * rest. A goal counts as touching a part only when its title is one of the
 * suggestions; the gardener's own wording is never guessed at. Nothing
 * already among their goals is offered again.
 *
 * `round` steps through the rest: each round starts where the last one
 * stopped, one idea per part, so "Other ideas" shows a new mix every time
 * and comes back round to the first after every idea has been shown. It is
 * a counter, not chance, so the same round always shows the same ideas.
 */
export function balancedSuggestions(
  activeGoalTitles: readonly string[],
  round: number,
  count: number,
): GoalSuggestion[] {
  const taken = new Set(activeGoalTitles.map(titleKey))
  const covered = new Set(
    goalSuggestions
      .filter((suggestion) => taken.has(titleKey(suggestion.title)))
      .map((suggestion) => suggestion.tag),
  )
  const open = openSuggestions(activeGoalTitles)
  const byTag = new Map(
    WELLBEING_TAGS.map((tag) => [tag, open.filter((suggestion) => suggestion.tag === tag)]),
  )
  const withIdeas = WELLBEING_TAGS.filter((tag) => byTag.get(tag)!.length > 0)
  const tags = [
    ...withIdeas.filter((tag) => !covered.has(tag)),
    ...withIdeas.filter((tag) => covered.has(tag)),
  ]
  const wanted = Math.min(Math.max(0, Math.floor(count)), open.length)
  const start = (Number.isFinite(round) ? Math.max(0, Math.floor(round)) : 0) * wanted
  const picks: GoalSuggestion[] = []
  // One slot per part in turn; a part's ideas take turns with each lap. With
  // fewer parts left than ideas wanted, a part gives a second idea rather
  // than the same one twice.
  for (let slot = start; picks.length < wanted; slot += 1) {
    const ideas = byTag.get(tags[slot % tags.length])!
    const idea = ideas[Math.floor(slot / tags.length) % ideas.length]
    if (!picks.includes(idea)) picks.push(idea)
  }
  return picks
}
