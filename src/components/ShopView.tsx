import { useState, type CSSProperties } from 'react'
import { flightPatterns } from '../data/flightPatterns'
import { JAR_PRICE, jarCharacters, jarColors } from '../data/jars'
import type { AppState, FlightPatternId, JarColorId } from '../types'
import { Icon } from './Icons'

export function ShopView({
  state,
  onPurchasePattern,
  onPurchaseJar,
}: {
  state: AppState
  onPurchasePattern: (patternId: FlightPatternId) => void
  onPurchaseJar: (character: string, colorId: JarColorId) => void
}) {
  const [selectedCharacter, setSelectedCharacter] = useState(jarCharacters[0])
  const [selectedColorId, setSelectedColorId] = useState<JarColorId>(
    jarColors[0].id,
  )
  const patterns = flightPatterns.filter((pattern) => pattern.cost > 0)
  const selectedColor =
    jarColors.find((color) => color.id === selectedColorId) ?? jarColors[0]
  const matchingJarCount = state.jars.filter(
    (jar) =>
      jar.character === selectedCharacter && jar.colorId === selectedColor.id,
  ).length
  const canBuyJar = state.nectar >= JAR_PRICE

  return (
    <div className="view shop-view">
      <header className="page-header">
        <div>
          <p className="eyebrow">Nectar shop</p>
          <h1>Collect garden keepsakes</h1>
          <p>
            Every Sunlight earns 3 Nectar. Spend it on reusable letter jars or
            flight patterns that stay in this garden.
          </p>
        </div>
        <div className="nectar-wallet large" aria-label={`${state.nectar} Nectar`}>
          <Icon name="nectar" />
          <strong>{state.nectar}</strong>
          <span>Nectar</span>
        </div>
      </header>

      <section className="card jar-shop-panel" aria-labelledby="jar-shop-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Custom jars</p>
            <h2 id="jar-shop-title">Buy letters and numbers</h2>
          </div>
          <span className="pattern-cost">
            <Icon name="nectar" size={18} />
            {JAR_PRICE} each
          </span>
        </div>
        <p className="section-explainer">
          Pick an uppercase letter or number, choose a color, then place that
          jar on a plant spot from your Garden. Each purchase is one reusable
          jar copy.
        </p>

        <div className="jar-shop-layout">
          <div>
            <h3>Character</h3>
            <div className="jar-character-grid" aria-label="Jar characters">
              {jarCharacters.map((character) => (
                <button
                  type="button"
                  key={character}
                  className={selectedCharacter === character ? 'selected' : ''}
                  onClick={() => setSelectedCharacter(character)}
                  aria-pressed={selectedCharacter === character}
                >
                  {character}
                </button>
              ))}
            </div>
          </div>
          <div>
            <h3>Color</h3>
            <div className="jar-color-grid" aria-label="Jar colors">
              {jarColors.map((color) => (
                <button
                  type="button"
                  key={color.id}
                  className={selectedColorId === color.id ? 'selected' : ''}
                  style={
                    {
                      '--jar-fill': color.fill,
                      '--jar-text': color.text,
                      '--jar-border': color.border,
                      '--jar-highlight': color.highlight,
                    } as CSSProperties
                  }
                  onClick={() => setSelectedColorId(color.id)}
                  aria-pressed={selectedColorId === color.id}
                >
                  <span className="jar-color-swatch" aria-hidden="true" />
                  {color.label}
                </button>
              ))}
            </div>
          </div>
          <div className="jar-purchase-preview">
            <span
              className="decorative-jar large"
              style={
                {
                  '--jar-fill': selectedColor.fill,
                  '--jar-text': selectedColor.text,
                  '--jar-border': selectedColor.border,
                  '--jar-highlight': selectedColor.highlight,
                } as CSSProperties
              }
              aria-hidden="true"
            >
              <span>{selectedCharacter}</span>
            </span>
            <strong>
              {selectedColor.label} {selectedCharacter}
            </strong>
            <small>
              You own {matchingJarCount} matching jar
              {matchingJarCount === 1 ? '' : 's'}.
            </small>
            <button
              className="primary-button"
              disabled={!canBuyJar}
              onClick={() => onPurchaseJar(selectedCharacter, selectedColor.id)}
            >
              {canBuyJar
                ? `Buy ${selectedColor.label} ${selectedCharacter} jar`
                : 'Not enough Nectar'}
            </button>
          </div>
        </div>
      </section>

      <section aria-labelledby="flight-shop-title">
        <div className="section-heading shop-section-heading">
          <div>
            <p className="eyebrow">Flight patterns</p>
            <h2 id="flight-shop-title">Collect new ways to fly</h2>
          </div>
        </div>
      <div className="shop-grid">
        {patterns.map((pattern) => {
          const owned = state.ownedFlightPatternIds.includes(pattern.id)
          const affordable = state.nectar >= pattern.cost
          return (
            <article className="card pattern-card" key={pattern.id}>
              <div className={`pattern-preview ${pattern.animationClass}`} aria-hidden="true">
                <span className="preview-flight-dot" />
              </div>
              <p className="eyebrow">Flight pattern</p>
              <h2>{pattern.name}</h2>
              <p>{pattern.description}</p>
              <div className="pattern-card-footer">
                <span className="pattern-cost">
                  <Icon name="nectar" size={18} />
                  {pattern.cost}
                </span>
                <button
                  className={owned ? 'secondary-button' : 'primary-button'}
                  disabled={owned || !affordable}
                  onClick={() => onPurchasePattern(pattern.id)}
                >
                  {owned ? 'Owned' : affordable ? `Buy ${pattern.name}` : 'Not enough Nectar'}
                </button>
              </div>
            </article>
          )
        })}
      </div>
      </section>
    </div>
  )
}
