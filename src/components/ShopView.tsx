import { useState, type CSSProperties } from 'react'
import { flightPatterns } from '../data/flightPatterns'
import { JAR_PRICE, jarCharacters, jarColors } from '../data/jars'
import {
  cosmeticItems,
  premiumItems,
  supplyItems,
} from '../data/shopItems'
import { stageLabels } from '../lib/lifecycle'
import type { AppState, FlightPatternId, JarColorId } from '../types'
import { Icon } from './Icons'

type ShopTab = 'supplies' | 'boutique' | 'jars' | 'flight' | 'pass'

const tabs: Array<{ id: ShopTab; label: string; icon: Parameters<typeof Icon>[0]['name'] }> = [
  { id: 'supplies', label: 'Supplies', icon: 'leaf' },
  { id: 'boutique', label: 'Boutique', icon: 'bow' },
  { id: 'jars', label: 'Jars', icon: 'shop' },
  { id: 'flight', label: 'Flight', icon: 'flight' },
  { id: 'pass', label: 'Garden Pass', icon: 'crown' },
]

export function ShopView({
  state,
  onPurchasePattern,
  onPurchaseJar,
  onPurchaseItem,
}: {
  state: AppState
  onPurchasePattern: (patternId: FlightPatternId) => void
  onPurchaseJar: (character: string, colorId: JarColorId) => void
  onPurchaseItem: (itemId: string) => void
}) {
  const [tab, setTab] = useState<ShopTab>('supplies')
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
          <p className="eyebrow">The garden shop</p>
          <h1>Stock up &amp; dress up</h1>
          <p>
            Sunlight earns Nectar; bonds and emergences earn Stardust. Spend
            them on care supplies, outfits, keepsakes, and flight styles.
          </p>
        </div>
        <div className="wallet-stack">
          <div className="nectar-wallet large" aria-label={`${state.nectar} Nectar`}>
            <Icon name="nectar" />
            <strong>{state.nectar}</strong>
            <span>Nectar</span>
          </div>
          <div className="stardust-wallet large" aria-label={`${state.stardust} Stardust`}>
            <Icon name="stardust" />
            <strong>{state.stardust}</strong>
            <span>Stardust</span>
          </div>
        </div>
      </header>

      <nav className="shop-tabs" aria-label="Shop sections">
        {tabs.map((item) => (
          <button
            key={item.id}
            className={tab === item.id ? 'active' : ''}
            onClick={() => setTab(item.id)}
            aria-current={tab === item.id ? 'page' : undefined}
          >
            <Icon name={item.icon} size={18} />
            {item.label}
          </button>
        ))}
      </nav>

      {tab === 'supplies' && (
        <section aria-labelledby="supplies-title">
          <div className="section-heading shop-section-heading">
            <div>
              <p className="eyebrow">Care satchel</p>
              <h2 id="supplies-title">Supplies for every stage</h2>
            </div>
          </div>
          <p className="section-explainer">
            Supplies are used by care activities — leaves for caterpillars,
            mist for eggs and chrysalises, nectar drops and fruit for
            butterflies.
          </p>
          <div className="shop-grid">
            {supplyItems.map((item) => {
              const owned = state.inventory[item.id] ?? 0
              const affordable = state.nectar >= item.cost
              return (
                <article className="card shop-item-card" key={item.id}>
                  <span className="shop-item-icon">
                    <Icon name={item.icon as Parameters<typeof Icon>[0]['name']} size={30} />
                  </span>
                  <h3>{item.name}</h3>
                  <p>{item.description}</p>
                  <small className="owned-note">In satchel: {owned}</small>
                  <div className="pattern-card-footer">
                    <span className="pattern-cost">
                      <Icon name="nectar" size={18} />
                      {item.cost}
                    </span>
                    <button
                      className="primary-button"
                      disabled={!affordable}
                      onClick={() => onPurchaseItem(item.id)}
                    >
                      {affordable ? 'Buy one' : 'Not enough Nectar'}
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      )}

      {tab === 'boutique' && (
        <section aria-labelledby="boutique-title">
          <div className="section-heading shop-section-heading">
            <div>
              <p className="eyebrow">Outfits &amp; keepsakes</p>
              <h2 id="boutique-title">The companion boutique</h2>
            </div>
          </div>
          <p className="section-explainer">
            One purchase, whole-garden closet: equip any owned piece on any
            companion from the Care page. Each listing shows the life stages
            it fits.
          </p>
          <div className="shop-grid">
            {cosmeticItems.map((item) => {
              const owned = state.ownedItemIds.includes(item.id)
              const balance =
                item.currency === 'stardust' ? state.stardust : state.nectar
              const affordable = balance >= item.cost
              return (
                <article className="card shop-item-card" key={item.id}>
                  <span className="shop-item-icon">
                    <Icon name={item.icon as Parameters<typeof Icon>[0]['name']} size={30} />
                  </span>
                  <h3>{item.name}</h3>
                  <p>{item.description}</p>
                  <small className="owned-note">
                    {item.slot === 'headwear'
                      ? 'Headwear'
                      : item.slot === 'accessory'
                        ? 'Accessory'
                        : 'Aura'}{' '}
                    · Fits: {(item.stages ?? []).map((stage) => stageLabels[stage]).join(', ')}
                  </small>
                  <div className="pattern-card-footer">
                    <span className="pattern-cost">
                      <Icon name={item.currency === 'stardust' ? 'stardust' : 'nectar'} size={18} />
                      {item.cost}
                    </span>
                    <button
                      className={owned ? 'secondary-button' : 'primary-button'}
                      disabled={owned || !affordable}
                      onClick={() => onPurchaseItem(item.id)}
                    >
                      {owned
                        ? 'Owned'
                        : affordable
                          ? 'Buy'
                          : `Not enough ${item.currency === 'stardust' ? 'Stardust' : 'Nectar'}`}
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      )}

      {tab === 'jars' && (
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
      )}

      {tab === 'flight' && (
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
      )}

      {tab === 'pass' && (
        <section aria-labelledby="pass-title">
          <div className="garden-pass-banner card">
            <div>
              <p className="eyebrow">A very exclusive corner</p>
              <h2 id="pass-title">The Garden Pass</h2>
              <p>
                A seasonal collection of one-of-a-kind regalia, auras, and
                trails is being prepared. These treasures will unlock with the
                Garden Pass in a future update — you can admire them today.
              </p>
            </div>
            <span className="coming-soon-ribbon">Coming soon</span>
          </div>
          <div className="shop-grid">
            {premiumItems.map((item) => (
              <article className="card shop-item-card premium-item" key={item.id}>
                <span className="shop-item-icon premium">
                  <Icon name={item.icon as Parameters<typeof Icon>[0]['name']} size={30} />
                </span>
                <h3>{item.name}</h3>
                <p>{item.description}</p>
                <small className="owned-note">
                  Fits: {(item.stages ?? []).map((stage) => stageLabels[stage]).join(', ')}
                </small>
                <div className="pattern-card-footer">
                  <span className="pattern-cost premium-cost">
                    <Icon name="lock" size={16} />
                    Garden Pass
                  </span>
                  <button className="secondary-button" disabled>
                    Coming soon
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
