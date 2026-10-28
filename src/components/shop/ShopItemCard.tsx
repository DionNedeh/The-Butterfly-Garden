import { useState } from 'react'
import type { AppState, ShopItemDefinition } from '../../types'
import { balanceFor, currencyLabel } from '../../lib/currency'
import { canWearItem } from '../../lib/gardenPass'
import { stageLabels } from '../../lib/lifecycle'
import { isAndroidApp } from '../../lib/platform'
import { listed } from '../../lib/plural'
import { CreatureSprite } from '../sprites/CreatureSprite'
import { Icon } from '../Icons'

/** How many of a supply can be bought in one go. */
const SUPPLY_QUANTITIES = [1, 3, 5] as const

export function ShopItemCard({
  item,
  state,
  onPurchase,
  onPreview,
  onWardrobe,
  wornBy = [],
}: {
  item: ShopItemDefinition
  state: AppState
  onPurchase: (id: string, quantity: number) => void
  onPreview: () => void
  onWardrobe: () => void
  /** The companions wearing this piece now, by name (lib/wardrobe wearersByItem). */
  wornBy?: readonly string[]
}) {
  const [quantity, setQuantity] = useState(1)
  const owned = state.ownedItemIds.includes(item.id)
  const allowed = canWearItem(state.ownedItemIds, item)
  const supply = item.kind === 'supply'
  // Priced exactly: five supplies cost five times one, and the button says
  // so before anything is spent.
  const price = item.cost * (supply ? quantity : 1)
  const shortBy = price - balanceFor(state, item.currency)
  // In the Android app a Pass item is part of a real subscription, so it says
  // so rather than "unavailable". These cards only appear on the Garden Pass
  // tab, right beneath the Pass's own offers, so they need no button of
  // their own until the Pass is open; "Try on" still works.
  const playPass = isAndroidApp() && item.premium
  return (
    <article className={`boutique-card ${item.premium ? 'pass-piece' : ''}`}>
      <div className="item-art">
        {supply ? (
          <Icon name={item.icon} size={48} />
        ) : (
          <CreatureSprite
            speciesId="monarch"
            stage={item.stages?.[0] ?? 'butterfly'}
            size={120}
            outfit={item.slot ? { [item.slot]: item.id } : {}}
          />
        )}
        <span className="item-tag">
          {playPass
            ? 'Garden Pass'
            : item.premium
              ? 'Pass preview'
              : supply
                ? 'Care supply'
                : item.slot}
        </span>
        {!supply && (
          <button
            className="preview-button"
            aria-label={`Preview ${item.name}`}
            onClick={onPreview}
          >
            Try on
          </button>
        )}
      </div>
      <div className="item-copy">
        <h3>{item.name}</h3>
        <p>{item.description}</p>
        <small className="item-fit">
          {supply
            ? `In satchel: ${state.inventory[item.id] ?? 0}`
            : `Fits: ${item.stages?.map((stage) => stageLabels[stage]).join(', ')}`}
        </small>
        {supply && (
          <div className="quantity-choice" role="group" aria-label={`How many ${item.name}`}>
            {SUPPLY_QUANTITIES.map((count) => (
              <button
                key={count}
                aria-pressed={quantity === count}
                onClick={() => setQuantity(count)}
              >
                ×{count}
              </button>
            ))}
          </div>
        )}
        <div className="item-footer">
          <span className="pattern-cost">
            <Icon
              name={item.currency === 'stardust' ? 'stardust' : 'nectar'}
              size={17}
            />
            {playPass && !allowed
              ? 'With the Garden Pass'
              : item.premium
                ? 'Included'
                : `${price} ${currencyLabel(item.currency)}`}
          </span>
          {playPass && !allowed ? null : item.premium || owned ? (
            <button
              className="secondary-button compact"
              disabled={!allowed}
              onClick={onWardrobe}
            >
              {allowed ? 'Open wardrobe' : 'Unavailable'}
            </button>
          ) : (
            <button
              className="primary-button compact"
              aria-disabled={shortBy > 0 ? true : undefined}
              onClick={() => onPurchase(item.id, supply ? quantity : 1)}
            >
              {shortBy > 0
                ? `Need ${shortBy} more`
                : !supply
                  ? 'Buy'
                  : quantity === 1
                    ? 'Buy one'
                    : `Buy ${quantity}`}
            </button>
          )}
        </div>
        {owned && wornBy.length === 0 && (
          <span className="owned-note">Owned · shared by all companions</span>
        )}
        {wornBy.length > 0 && (
          <span className="owned-note">
            {owned ? 'Owned · worn' : 'Worn'} by {listed(wornBy)}
          </span>
        )}
      </div>
    </article>
  )
}
