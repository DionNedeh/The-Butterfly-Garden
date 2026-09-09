import { useState } from 'react'
import { shopItems } from '../data/shopItems'
import { flightPatterns } from '../data/flightPatterns'
import { jarCharacters, jarColors, JAR_PRICE, JAR_CAPACITY } from '../data/jars'
import { balanceFor, currencyLabel } from '../lib/currency'
import { GARDEN_PASS_PREVIEW_NOTICE } from '../lib/gardenPass'
import type {
  AppState,
  FlightPatternId,
  JarColorId,
  ShopItemDefinition,
} from '../types'
import { Icon } from './Icons'
import { JarSprite } from './sprites/JarSprite'
import { FlightPreview } from './FlyingButterfly'
import { ShopItemCard } from './shop/ShopItemCard'
import { ItemPreview } from './shop/ItemPreview'
import { BackdropGallery, type BackdropActions } from './BackdropGallery'

type ShopTab =
  | 'supplies'
  | 'boutique'
  | 'jars'
  | 'flight'
  | 'backdrops'
  | 'pass'
const tabs: { id: ShopTab; label: string }[] = [
  { id: 'supplies', label: 'Supplies' },
  { id: 'boutique', label: 'Boutique' },
  { id: 'jars', label: 'Jars' },
  { id: 'flight', label: 'Flight' },
  { id: 'backdrops', label: 'Backdrops' },
  { id: 'pass', label: 'Garden Pass' },
]
export function ShopView({
  state,
  onPurchasePattern,
  onPurchaseJar,
  onPurchaseItem,
  onOpenCare = () => {},
  onOpenFlight = () => {},
  ...backdrops
}: {
  state: AppState
  onPurchasePattern: (id: FlightPatternId) => void
  onPurchaseJar: (character: string, color: JarColorId) => void
  onPurchaseItem: (id: string) => void
  onOpenCare?: () => void
  onOpenFlight?: () => void
} & BackdropActions) {
  const [tab, setTab] = useState<ShopTab>('supplies')
  const [query, setQuery] = useState('')
  const [slot, setSlot] = useState('all')
  const [stage, setStage] = useState('all')
  const [currency, setCurrency] = useState('all')
  const [ownership, setOwnership] = useState('all')
  const [affordableOnly, setAffordableOnly] = useState(false)
  const [preview, setPreview] = useState<ShopItemDefinition>()
  const [character, setCharacter] = useState('A')
  const [color, setColor] = useState<JarColorId>('blue')
  const [note, setNote] = useState('')
  const items = shopItems
    .filter((item) =>
      tab === 'supplies'
        ? item.kind === 'supply'
        : tab === 'pass'
          ? item.premium
          : item.kind === 'cosmetic' && !item.premium,
    )
    .filter(
      (item) =>
        `${item.name} ${item.description}`
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (slot === 'all' || item.slot === slot) &&
        (stage === 'all' || item.stages?.some((value) => value === stage)) &&
        (currency === 'all' || item.currency === currency) &&
        (ownership === 'all' ||
          state.ownedItemIds.includes(item.id) === (ownership === 'owned')) &&
        (!affordableOnly || balanceFor(state, item.currency) >= item.cost),
    )
  const reset = () => {
    setQuery('')
    setSlot('all')
    setStage('all')
    setCurrency('all')
    setOwnership('all')
    setAffordableOnly(false)
  }
  const buyItem = (id: string) => {
    onPurchaseItem(id)
    setNote(
      `${shopItems.find((item) => item.id === id)?.name ?? 'Item'} added to your garden.`,
    )
  }
  return (
    <div className="view shop-view">
      <header className="page-header shop-heading">
        <div>
          <p className="eyebrow">Small treasures, lovingly chosen</p>
          <h1>Stock up &amp; dress up</h1>
          <p>A little care. A little colour. Something that feels like you.</p>
        </div>
        <div className="wallet-stack">
          <div className="nectar-wallet large">
            <Icon name="nectar" />
            <strong>{state.nectar}</strong>
            <span>Nectar</span>
          </div>
          <div className="stardust-wallet large">
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
            aria-current={tab === item.id ? 'page' : undefined}
            onClick={() => {
              setTab(item.id)
              reset()
              setNote('')
            }}
          >
            {item.label}
          </button>
        ))}
      </nav>
      {note && (
        <p className="shop-feedback" role="status">
          {note}
        </p>
      )}
      {(tab === 'supplies' || tab === 'boutique' || tab === 'pass') && (
        <>
          {tab === 'pass' ? (
            <section className="pass-hero">
              <div>
                <p className="eyebrow">A little more wonder</p>
                <h2>Your Garden Pass preview</h2>
                <p>{GARDEN_PASS_PREVIEW_NOTICE}</p>
                <div className="form-actions">
                  <button
                    className="primary-button"
                    onClick={() => setTab('backdrops')}
                  >
                    Explore backdrops
                  </button>
                  <button className="secondary-button" onClick={onOpenCare}>
                    Dress a companion
                  </button>
                </div>
              </div>
              <div className="pass-illustration" aria-hidden="true">
                <span>✧</span>
                <strong>
                  A garden
                  <br />
                  uniquely yours.
                </strong>
                <small>Outfits · scenes · your own images</small>
              </div>
            </section>
          ) : (
            <div className="section-heading">
              <div>
                <p className="eyebrow">
                  {tab === 'supplies'
                    ? 'The care satchel'
                    : 'The companion boutique'}
                </p>
                <h2>
                  {tab === 'supplies'
                    ? 'Thoughtful care, every day'
                    : 'Made for little personalities'}
                </h2>
              </div>
              <span className="count-badge">{items.length} pieces</span>
            </div>
          )}
          <div className="shop-filters">
            <label className="shop-search">
              Find something lovely
              <input
                type="search"
                placeholder="Search the collection…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            {tab !== 'supplies' && (
              <>
                <label>
                  Type
                  <select
                    value={slot}
                    onChange={(event) => setSlot(event.target.value)}
                  >
                    <option value="all">Every type</option>
                    <option value="headwear">Headwear</option>
                    <option value="accessory">Accessories</option>
                    <option value="aura">Auras</option>
                  </select>
                </label>
                <label>
                  Life stage
                  <select
                    value={stage}
                    onChange={(event) => setStage(event.target.value)}
                  >
                    <option value="all">Every stage</option>
                    {['egg', 'caterpillar', 'chrysalis', 'butterfly'].map(
                      (value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <label>
                  Collection
                  <select
                    value={ownership}
                    onChange={(event) => setOwnership(event.target.value)}
                  >
                    <option value="all">All pieces</option>
                    <option value="owned">Owned</option>
                    <option value="new">Not owned</option>
                  </select>
                </label>
              </>
            )}
            {tab !== 'pass' && (
              <>
                <label>
                  Currency
                  <select
                    value={currency}
                    onChange={(event) => setCurrency(event.target.value)}
                  >
                    <option value="all">Both currencies</option>
                    <option value="nectar">Nectar</option>
                    <option value="stardust">Stardust</option>
                  </select>
                </label>
                <label className="check-filter">
                  <input
                    type="checkbox"
                    checked={affordableOnly}
                    onChange={(event) =>
                      setAffordableOnly(event.target.checked)
                    }
                  />
                  Within my budget
                </label>
              </>
            )}
            <button className="text-button" onClick={reset}>
              Clear filters
            </button>
          </div>
          <p className="subtle-copy" role="status">
            {items.length} {items.length === 1 ? 'piece' : 'pieces'} to explore
            {tab === 'boutique' ? ' · Buy once, dress every companion.' : ''}
          </p>
          <div className="boutique-grid">
            {items.map((item) => (
              <ShopItemCard
                key={item.id}
                item={item}
                state={state}
                onPurchase={buyItem}
                onPreview={() => setPreview(item)}
                onWardrobe={onOpenCare}
              />
            ))}
          </div>
          {!items.length && (
            <div className="empty-collection">
              <h3>Nothing in this little corner yet</h3>
              <p>Try a different search or clear your filters.</p>
              <button className="secondary-button" onClick={reset}>
                Show the collection
              </button>
            </div>
          )}
        </>
      )}
      {tab === 'jars' && (
        <section className="card jar-shop-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Letters from the garden</p>
              <h2>Buy letters and numbers</h2>
              <p>
                Spell a name, a date, a little reminder. Each jar is yours to
                move and reuse.
              </p>
            </div>
            <span className="pattern-cost">{JAR_PRICE} Nectar each</span>
          </div>
          <div className="jar-shop-layout">
            <div>
              <h3>Character</h3>
              <div className="jar-character-grid" aria-label="Jar characters">
                {jarCharacters.map((value) => (
                  <button
                    key={value}
                    className={character === value ? 'selected' : ''}
                    aria-pressed={character === value}
                    onClick={() => setCharacter(value)}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h3>Colour</h3>
              <div className="jar-color-grid" aria-label="Jar colors">
                {jarColors.map((value) => (
                  <button
                    key={value.id}
                    className={color === value.id ? 'selected' : ''}
                    aria-pressed={color === value.id}
                    onClick={() => setColor(value.id)}
                  >
                    <span
                      className="colour-dot"
                      style={{ background: value.fill }}
                    />
                    {value.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="jar-purchase-preview">
              <JarSprite character={character} colorId={color} size={128} />
              <strong>
                {jarColors.find((value) => value.id === color)?.label}{' '}
                {character}
              </strong>
              <small>
                {state.jars.length} / {JAR_CAPACITY} keepsakes ·{' '}
                {
                  state.jars.filter(
                    (jar) =>
                      jar.character === character && jar.colorId === color,
                  ).length
                }{' '}
                matching
              </small>
              <button
                className="primary-button"
                disabled={
                  state.nectar < JAR_PRICE || state.jars.length >= JAR_CAPACITY
                }
                onClick={() => {
                  onPurchaseJar(character, color)
                  setNote(
                    `${character} jar added. Place it from a plant's detail panel in Garden.`,
                  )
                }}
              >
                {state.jars.length >= JAR_CAPACITY
                  ? 'Your jar shelf is full'
                  : state.nectar < JAR_PRICE
                    ? 'Not enough Nectar'
                    : `Buy ${jarColors.find((value) => value.id === color)?.label} ${character} jar`}
              </button>
            </div>
          </div>
        </section>
      )}
      {tab === 'flight' && (
        <section>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Follow the breeze</p>
              <h2>Collect new ways to fly</h2>
            </div>
            <button className="secondary-button" onClick={onOpenFlight}>
              Choose a pattern
            </button>
          </div>
          <div className="boutique-grid">
            {flightPatterns
              .filter((pattern) => pattern.cost > 0)
              .map((pattern) => {
                const owned = state.ownedFlightPatternIds.includes(pattern.id)
                const affordable =
                  balanceFor(state, pattern.currency) >= pattern.cost
                return (
                  <article className="boutique-card" key={pattern.id}>
                    <FlightPreview
                      pattern={pattern.id}
                      reduced={state.profile?.reducedMotion}
                    />
                    <div className="item-copy">
                      <p className="eyebrow">
                        {currencyLabel(pattern.currency)} flight pattern
                      </p>
                      <h3>{pattern.name}</h3>
                      <p>{pattern.description}</p>
                      <div className="item-footer">
                        <span className="pattern-cost">
                          {pattern.cost} {currencyLabel(pattern.currency)}
                        </span>
                        <button
                          className="primary-button compact"
                          disabled={owned || !affordable}
                          onClick={() => onPurchasePattern(pattern.id)}
                        >
                          {owned
                            ? 'Owned'
                            : affordable
                              ? `Buy ${pattern.name}`
                              : `Not enough ${currencyLabel(pattern.currency)}`}
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
          </div>
        </section>
      )}
      {tab === 'backdrops' && <BackdropGallery state={state} {...backdrops} />}
      {preview && (
        <ItemPreview item={preview} onClose={() => setPreview(undefined)} />
      )}
    </div>
  )
}
