import { useEffect, useMemo, useRef } from 'react'
import { plants } from '../../data/content'
import { jarColors } from '../../data/jars'
import { jarForPlant, jarSpokenName } from '../../lib/jars'
import { stackJars, stackKey } from '../../lib/jarStacks'
import type { AppState } from '../../types'
import { JarCharacter } from '../Spoken'
import { JarSprite } from '../sprites/JarSprite'
import './jarManager.css'

const plantNames = new Map(plants.map((plant) => [plant.id, plant.name]))
const colorLabel = (colorId: string) =>
  jarColors.find((color) => color.id === colorId)?.label ?? 'Custom'

/** Where focus goes once the control pressed has gone. */
type FocusTarget = { to: 'stack'; key: string } | { to: 'return' }

/**
 * A plant's jar: the one on it, the jars that could go there, and every jar
 * placed in the garden. Alike jars on the shelf are one button ("Blue ×3"),
 * which places one of them, so a shelf of sixty is a handful of choices.
 * A jar on another plant keeps a button of its own, since moving it takes
 * it from somewhere in particular.
 *
 * Loaded once a plant is chosen, so the garden's first load carries none of
 * it.
 */
export function JarManager({
  state,
  plantId,
  plantName,
  visible,
  onPlaceJar,
  onRemoveJarPlacement,
}: {
  state: AppState
  plantId: string
  plantName: string
  /** Whether the plant is one of the spots the scene shows. */
  visible: boolean
  onPlaceJar: (jarId: string, plantId: string) => void
  onRemoveJarPlacement: (plantId: string) => void
}) {
  const jarHere = jarForPlant(state, plantId)
  const stacks = useMemo(
    () => stackJars(state.jars, state.jarPlacements).filter((stack) => stack.loose.length > 0),
    [state.jars, state.jarPlacements],
  )
  /** Jars on the other plants, in shelf order, each with where it sits. */
  const elsewhere = useMemo(() => {
    const plantOf = new Map(state.plants.map((plant) => [plant.id, plant.plantId]))
    const heldBy = new Map(
      state.jarPlacements
        .filter((placement) => placement.plantId !== plantId)
        .map((placement) => [
          placement.jarId,
          plantNames.get(plantOf.get(placement.plantId) ?? '') ?? 'another spot',
        ]),
    )
    return state.jars.flatMap((jar) => {
      const name = heldBy.get(jar.id)
      return name ? [{ jar, heldBy: name }] : []
    })
  }, [state.jars, state.jarPlacements, state.plants, plantId])
  const placed = useMemo(() => {
    const jarsById = new Map(state.jars.map((jar) => [jar.id, jar]))
    const plantOf = new Map(state.plants.map((plant) => [plant.id, plant.plantId]))
    return state.jarPlacements.flatMap((placement) => {
      const jar = jarsById.get(placement.jarId)
      const name = plantNames.get(plantOf.get(placement.plantId) ?? '')
      return jar && name ? [{ jar, plantName: name }] : []
    })
  }, [state.jars, state.jarPlacements, state.plants])
  const toPlace = state.jars.length - (jarHere ? 1 : 0)
  const loose = stacks.reduce((sum, stack) => sum + stack.loose.length, 0)

  // A button that places the last of its stack, or moves a jar here, goes
  // with the press, as does "Return to inventory": focus moves on to what
  // took its place rather than falling to the page.
  const root = useRef<HTMLDivElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const pendingFocus = useRef<FocusTarget | undefined>(undefined)
  useEffect(() => {
    const target = pendingFocus.current
    if (!target) return
    pendingFocus.current = undefined
    const buttons = Array.from(root.current?.querySelectorAll<HTMLElement>('button') ?? [])
    const stack =
      target.to === 'stack'
        ? buttons.find((button) => button.dataset.stack === target.key)
        : undefined
    const back = buttons.find((button) => button.dataset.return !== undefined)
    ;(stack ?? back ?? heading.current)?.focus()
  })

  return (
    <div className="jar-manager" role="group" aria-labelledby="jar-manager-title" ref={root}>
      <div className="section-heading compact-heading">
        <div>
          <p className="eyebrow">Jar inventory</p>
          <h3 id="jar-manager-title" ref={heading} tabIndex={-1}>
            Decorate this plant spot
          </h3>
        </div>
        <span className="count-badge">{toPlace} to place</span>
      </div>
      {!visible ? (
        <p className="empty-copy">
          Jars can be placed on the eight visible garden spots. Remove plants
          above the limit to bring this plant into the scene.
        </p>
      ) : (
        <>
          <div className="current-jar-card">
            {jarHere ? (
              <>
                <span className="jar-display" aria-hidden="true">
                  <JarSprite character={jarHere.character} colorId={jarHere.colorId} />
                </span>
                <div>
                  <strong>
                    {colorLabel(jarHere.colorId)} <JarCharacter character={jarHere.character} />{' '}
                    jar
                  </strong>
                  <small>Placed on this plant spot.</small>
                </div>
                <button
                  type="button"
                  className="secondary-button"
                  data-return=""
                  onClick={() => {
                    pendingFocus.current = { to: 'stack', key: stackKey(jarHere) }
                    onRemoveJarPlacement(plantId)
                  }}
                >
                  Return to inventory
                </button>
              </>
            ) : (
              <p className="empty-copy">
                This plant spot is empty. Choose a jar below to cover the base —{' '}
                {loose} of your jars {loose === 1 ? 'is' : 'are'} not on a plant
                yet.
              </p>
            )}
          </div>

          <div className="jar-inventory-grid" role="group" aria-label="Available jars">
            {stacks.length === 0 && elsewhere.length === 0 ? (
              <p className="empty-copy">
                {jarHere
                  ? 'No other jars are ready to place here.'
                  : 'No jars are waiting in inventory. Buy letters and numbers in the Shop with Nectar.'}
              </p>
            ) : (
              <>
                {stacks.map((stack) => {
                  const count = stack.loose.length
                  return (
                    <button
                      type="button"
                      key={stack.key}
                      data-stack={stack.key}
                      className="jar-inventory-button"
                      onClick={() => {
                        pendingFocus.current = { to: 'stack', key: stack.key }
                        onPlaceJar(stack.loose[0].id, plantId)
                      }}
                      aria-label={`Place ${jarSpokenName(stack.colorId, stack.character)} on ${plantName}${count > 1 ? `, ${count} on the shelf` : ''}`}
                    >
                      <span className="jar-display" aria-hidden="true">
                        <JarSprite character={stack.character} colorId={stack.colorId} />
                      </span>
                      <span>Place</span>
                      <small>
                        {colorLabel(stack.colorId)}
                        {count > 1 && ` ×${count}`}
                      </small>
                    </button>
                  )
                })}
                {elsewhere.map(({ jar, heldBy }) => (
                  <button
                    type="button"
                    key={jar.id}
                    className="jar-inventory-button"
                    onClick={() => {
                      pendingFocus.current = { to: 'return' }
                      onPlaceJar(jar.id, plantId)
                    }}
                    aria-label={`Move from ${heldBy} ${jarSpokenName(jar.colorId, jar.character)} on ${plantName}`}
                  >
                    <span className="jar-display" aria-hidden="true">
                      <JarSprite character={jar.character} colorId={jar.colorId} />
                    </span>
                    <span>Move from {heldBy}</span>
                    <small>{colorLabel(jar.colorId)}</small>
                  </button>
                ))}
              </>
            )}
          </div>
        </>
      )}
      {placed.length > 0 && (
        <details className="placed-jars-list">
          <summary>Placed jars ({placed.length})</summary>
          <ul>
            {placed.map(({ jar, plantName: on }) => (
              <li key={jar.id}>
                <span className="jar-display small" aria-hidden="true">
                  <JarSprite character={jar.character} colorId={jar.colorId} />
                </span>
                {colorLabel(jar.colorId)} <JarCharacter character={jar.character} /> on {on}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
