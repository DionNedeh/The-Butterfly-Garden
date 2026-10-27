import { useEffect, useMemo, useRef } from 'react'
import { jarColors } from '../../data/jars'
import {
  JAR_RECYCLE_NECTAR,
  type JarRestoreOutcome,
  type RecycledJar,
  type RecycleOutcome,
} from '../../lib/jars'
import { jarName, stackJars, type JarStack } from '../../lib/jarStacks'
import type { AppState } from '../../types'
import type { UndoOffer } from '../UndoToast'
import { JarSprite } from '../sprites/JarSprite'

/** Where a stack's jars are, in a few words. */
function whereabouts(count: number, loose: number): string {
  const placed = count - loose
  if (placed === 0) return 'On the shelf'
  if (loose === 0) return count === 1 ? 'On a plant' : 'All on plants'
  return `${placed} on ${placed === 1 ? 'a plant' : 'plants'}, ${loose} on the shelf`
}

/** Why Undo could not put a recycled jar back, or nothing when it did. */
function undoRefusal(outcome: JarRestoreOutcome, name: string): string | undefined {
  if (outcome.kind === 'spent')
    return `The Nectar from the ${name} has been spent since, so it stays recycled.`
  if (outcome.kind === 'full') return `Your jar shelf is full again, so the ${name} stays recycled.`
  return undefined
}

/**
 * The jars the gardener owns, alike ones stacked into one row ("Blue A ×3"),
 * each saying where its jars are. A jar on no plant can be recycled for half
 * its Nectar, at once, with Undo for a few seconds, as goals on Today are.
 * Undo is honest: it takes the Nectar back, so it is refused, and says why,
 * once that Nectar has been spent.
 */
export function JarShelf({
  jars,
  jarPlacements,
  onRecycle,
  onRestore,
  onOfferUndo,
  onSay,
}: Pick<AppState, 'jars' | 'jarPlacements'> & {
  onRecycle: (jarId: string) => RecycleOutcome
  onRestore: (recycled: RecycledJar) => JarRestoreOutcome
  /** Show the one undo the shop offers at a time. */
  onOfferUndo: (offer: UndoOffer) => void
  /** Say something in the shop's polite toast. */
  onSay: (text: string) => void
}) {
  const stacks = useMemo(() => stackJars(jars, jarPlacements), [jars, jarPlacements])
  const heading = useRef<HTMLHeadingElement>(null)
  const list = useRef<HTMLUListElement>(null)
  // After a recycle or its undo the button pressed may be gone: focus goes to
  // that stack's button if it is still there, otherwise to the heading, never
  // to the page. A key names a stack; null names the heading.
  const pendingFocus = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    const target = pendingFocus.current
    if (target === undefined) return
    pendingFocus.current = undefined
    const row = Array.from(list.current?.querySelectorAll<HTMLElement>('[data-stack]') ?? []).find(
      (element) => element.dataset.stack === target,
    )
    ;(row?.querySelector('button') ?? heading.current)?.focus()
  })

  const recycle = (stack: JarStack) => {
    // The newest of the stack: most often the one bought by mistake.
    const jar = stack.loose.at(-1)
    if (!jar) return
    const name = jarName(stack.colorId, stack.character)
    const outcome = onRecycle(jar.id)
    pendingFocus.current = stack.key
    if (outcome.kind !== 'recycled') {
      onSay(
        outcome.kind === 'placed'
          ? `The ${name} is on a plant now, so it was not recycled.`
          : `The ${name} was recycled already, so nothing changed.`,
      )
      return
    }
    const { recycled } = outcome
    onOfferUndo({
      message: `${name} recycled, for ${recycled.nectar} Nectar.`,
      undo: () => {
        const refusal = undoRefusal(onRestore(recycled), name)
        pendingFocus.current = refusal ? null : stack.key
        if (refusal) onSay(refusal)
      },
    })
  }

  return (
    <section className="card jar-shelf" aria-labelledby="jar-shelf-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Kept on the shelf</p>
          <h2 id="jar-shelf-title" ref={heading} tabIndex={-1}>
            Your jars
          </h2>
          <p className="subtle-copy">
            Alike jars share a row. One that is not on a plant can be recycled for{' '}
            {JAR_RECYCLE_NECTAR} Nectar.
          </p>
        </div>
        <span className="count-badge">
          {jars.length} {jars.length === 1 ? 'jar' : 'jars'}
        </span>
      </div>
      {stacks.length === 0 ? (
        <p className="empty-copy">No jars yet. The first one you buy will wait here.</p>
      ) : (
        <ul className="jar-stacks" ref={list}>
          {stacks.map((stack) => {
            const count = stack.jars.length
            const label = jarColors.find((color) => color.id === stack.colorId)?.label
            return (
              <li key={stack.key} className="jar-stack" data-stack={stack.key}>
                <span className="jar-display small" aria-hidden="true">
                  <JarSprite character={stack.character} colorId={stack.colorId} />
                </span>
                <span className="jar-stack-copy">
                  <strong>
                    {label} {stack.character}
                    {count > 1 && (
                      <>
                        <span aria-hidden="true"> ×{count}</span>
                        <span className="sr-only">, {count} jars</span>
                      </>
                    )}
                  </strong>
                  <small>{whereabouts(count, stack.loose.length)}</small>
                </span>
                {stack.loose.length > 0 && (
                  <button
                    className="secondary-button"
                    aria-label={`Recycle for ${JAR_RECYCLE_NECTAR} Nectar: one ${jarName(stack.colorId, stack.character)}`}
                    onClick={() => recycle(stack)}
                  >
                    Recycle for {JAR_RECYCLE_NECTAR} Nectar
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
