import { useEffect, useRef, useState } from 'react'
import { shopItems } from '../data/shopItems'
import { flightPatterns } from '../data/flightPatterns'
import { jarCharacters, jarColors, JAR_PRICE, JAR_CAPACITY } from '../data/jars'
import { balanceFor, currencyLabel } from '../lib/currency'
import { GARDEN_PASS_PREVIEW_NOTICE } from '../lib/gardenPass'
import type { PurchaseOutcome } from '../lib/purchase'
import { useMediaQuery } from '../hooks/useMediaQuery'
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
import { GardenPassPanel } from './shop/GardenPassPanel'
import { FilterSheet } from './shop/FilterSheet'
import { PurchaseToast, type PurchaseNote } from './shop/PurchaseToast'
import { purchaseMessage, type PurchaseSubject } from './shop/purchaseMessage'
import { motionPreference } from '../lib/motion'
// Only the shop draws these, so they arrive with it rather than with the
// stylesheet every page waits for.
import './shop/shop.css'

export type ShopTab =
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
/** Matches the phone layout in garden-3.css. */
const PHONE_WIDTH = '(max-width: 600px)'
export function ShopView({
  state,
  onPurchasePattern,
  onPurchaseJar,
  onPurchaseItem,
  onOpenCare = () => {},
  onOpenFlight = () => {},
  initialTab = 'supplies',
  ...backdrops
}: {
  state: AppState
  onPurchasePattern: (id: FlightPatternId) => PurchaseOutcome
  onPurchaseJar: (character: string, color: JarColorId) => PurchaseOutcome
  onPurchaseItem: (id: string, quantity?: number) => PurchaseOutcome
  onOpenCare?: () => void
  onOpenFlight?: () => void
  /** Where the shop opens; the garden's Pass notice opens it on the Pass. */
  initialTab?: ShopTab
} & BackdropActions) {
  const [tab, setTab] = useState<ShopTab>(initialTab)
  const [query, setQuery] = useState('')
  const [slot, setSlot] = useState('all')
  const [stage, setStage] = useState('all')
  const [currency, setCurrency] = useState('all')
  const [ownership, setOwnership] = useState('all')
  const [affordableOnly, setAffordableOnly] = useState(false)
  const [preview, setPreview] = useState<ShopItemDefinition>()
  const [character, setCharacter] = useState('A')
  const [color, setColor] = useState<JarColorId>('blue')
  const [note, setNote] = useState<PurchaseNote>()
  // On a phone the filters wait in a sheet behind one button, so the
  // collection itself starts on the first screen.
  const phone = useMediaQuery(PHONE_WIDTH)
  const [sheetOpen, setSheetOpen] = useState(false)
  // A phone turned on its side can be wide enough for the inline panel. The
  // sheet is put away then, so it does not spring open again on turning back.
  if (sheetOpen && !phone) setSheetOpen(false)
  const filterButton = useRef<HTMLButtonElement>(null)
  const searchField = useRef<HTMLInputElement>(null)
  // Put away by a turn of the phone rather than by the gardener, the sheet
  // takes focus with it; the same search, now inline, has it back.
  const sheetWasOpen = useRef(false)
  useEffect(() => {
    if (sheetWasOpen.current && !sheetOpen && !phone) searchField.current?.focus()
    sheetWasOpen.current = sheetOpen
  }, [sheetOpen, phone])
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
  const activeFilters = [
    query !== '',
    slot !== 'all',
    stage !== 'all',
    currency !== 'all',
    ownership !== 'all',
    affordableOnly,
  ].filter(Boolean).length
  const reset = () => {
    setQuery('')
    setSlot('all')
    setStage('all')
    setCurrency('all')
    setOwnership('all')
    setAffordableOnly(false)
  }
  const closeSheet = () => {
    setSheetOpen(false)
    filterButton.current?.focus()
  }
  /**
   * Say what a purchase came to, in the words of the reducer's outcome.
   *
   * A purchase that cannot go through is aria-disabled rather than disabled:
   * it still looks unavailable, but it keeps focus when a purchase empties
   * the purse, and pressing it says why, and by how much, instead of nothing.
   */
  const tell = (outcome: PurchaseOutcome, subject: PurchaseSubject) =>
    setNote((previous) => ({
      text: purchaseMessage(outcome, subject),
      key: (previous?.key ?? 0) + 1,
    }))
  const buyItem = (id: string, quantity: number) => {
    const item = shopItems.find((entry) => entry.id === id)
    tell(onPurchaseItem(id, quantity), {
      name: item?.name ?? 'This piece',
      kind: item?.kind === 'supply' ? 'supply' : 'piece',
      quantity,
    })
  }
  const jarName = `${jarColors.find((value) => value.id === color)?.label} ${character} jar`
  // One set of filters, drawn inline on a wide screen or inside the sheet on
  // a phone, so there is never a second search field to keep in step.
  const filters = (
    <div className="shop-filters">
      <label className="shop-search">
        Find something lovely
        <input
          ref={searchField}
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
  )
  const results = (
    <p className="subtle-copy" role="status">
      {items.length} {items.length === 1 ? 'piece' : 'pieces'} to explore
      {tab === 'boutique' ? ' · Buy once, dress every companion.' : ''}
    </p>
  )
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
            }}
          >
            {item.label}
          </button>
        ))}
      </nav>
      {(tab === 'supplies' || tab === 'boutique' || tab === 'pass') && (
        <>
          {/* Inline rather than isAndroidApp(): the bundler folds only an
              inline check, which keeps the Play panel out of the PWA. */}
          {tab === 'pass' && import.meta.env.VITE_PLATFORM === 'android' ? (
            <GardenPassPanel
              onExploreBackdrops={() => setTab('backdrops')}
              onOpenCare={onOpenCare}
            />
          ) : tab === 'pass' ? (
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
          {phone ? (
            <div className="shop-filter-bar">
              <button
                ref={filterButton}
                className="secondary-button"
                aria-haspopup="dialog"
                onClick={() => setSheetOpen(true)}
              >
                Filter
                {activeFilters > 0 && (
                  <>
                    {' '}
                    <span className="filter-count">
                      {activeFilters}{' '}
                      <span className="sr-only">active</span>
                    </span>
                  </>
                )}
              </button>
              {results}
            </div>
          ) : (
            <>
              {filters}
              {results}
            </>
          )}
          {sheetOpen && (
            <FilterSheet results={items.length} onClose={closeSheet}>
              {filters}
            </FilterSheet>
          )}
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
                aria-disabled={
                  state.nectar < JAR_PRICE || state.jars.length >= JAR_CAPACITY
                    ? true
                    : undefined
                }
                onClick={() =>
                  tell(onPurchaseJar(character, color), { name: jarName, kind: 'jar' })
                }
              >
                {state.jars.length >= JAR_CAPACITY
                  ? 'Your jar shelf is full'
                  : state.nectar < JAR_PRICE
                    ? 'Not enough Nectar'
                    : `Buy ${jarName}`}
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
                      calm={motionPreference(state.profile) === 'calm'}
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
                          aria-disabled={owned || !affordable ? true : undefined}
                          onClick={() =>
                            tell(onPurchasePattern(pattern.id), {
                              name: pattern.name,
                              kind: 'pattern',
                            })
                          }
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
      <PurchaseToast note={note} onDone={() => setNote(undefined)} />
    </div>
  )
}
