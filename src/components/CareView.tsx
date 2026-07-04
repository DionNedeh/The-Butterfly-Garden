import { useMemo, useState } from 'react'
import { careActionsForStage } from '../data/careActions'
import { getShopItem, outfitSlots, shopItems } from '../data/shopItems'
import { species } from '../data/content'
import {
  actionDoneToday,
  bondLevel,
  bondProgress,
  BOND_PER_LEVEL,
  careDaysCompleted,
  hasCaredToday,
  stageLabels,
  STAGE_CARE_DAYS,
  STAGE_ORDER,
} from '../lib/lifecycle'
import { visibleOutfit } from '../lib/wardrobe'
import { toLocalDate } from '../lib/date'
import type { AppState, CreatureStage, OutfitSlot } from '../types'
import { CreatureSprite } from './sprites/CreatureSprite'
import { Icon } from './Icons'

const stageDescriptions: Record<CreatureStage, string> = {
  egg: 'A tiny egg rests on its host leaf. Keep it warm and watched for three days of care and it will hatch.',
  caterpillar:
    'A very hungry caterpillar! Feed, bathe, and play across three days of care to help it grow toward its chrysalis.',
  chrysalis:
    'Quiet transformation is underway. Three days of gentle mists and encouragement will welcome a butterfly.',
  butterfly:
    'Fully grown and here to stay. Daily care now deepens your bond — and unlocks rewards along the way.',
}

export function CareView({
  state,
  onCare,
  onEquip,
  onUnequip,
  onRenameCreature,
  onGoToShop,
}: {
  state: AppState
  onCare: (creatureId: string, actionId: string) => void
  onEquip: (creatureId: string, itemId: string) => void
  onUnequip: (creatureId: string, slot: OutfitSlot) => void
  onRenameCreature: (creatureId: string, name: string) => void
  onGoToShop: () => void
}) {
  const ordered = useMemo(
    () =>
      [...state.creatures].sort(
        (a, b) =>
          STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage) ||
          a.name.localeCompare(b.name),
      ),
    [state.creatures],
  )
  const [selectedId, setSelectedId] = useState<string>()
  const [nameDraft, setNameDraft] = useState<string>()
  const selected =
    ordered.find((creature) => creature.id === selectedId) ?? ordered[0]
  const today = toLocalDate()

  if (!selected) {
    return (
      <div className="view care-view">
        <header className="page-header">
          <div>
            <p className="eyebrow">Companion care</p>
            <h1>The nursery is quiet</h1>
            <p>
              Grow a host plant in your Garden to welcome your first butterfly
              egg, then return here to care for it.
            </p>
          </div>
        </header>
      </div>
    )
  }

  const definition = species.find((item) => item.id === selected.speciesId)
  const actions = careActionsForStage(selected.stage)
  const careDays = careDaysCompleted(selected)
  const caredToday = hasCaredToday(selected, today)
  const outfit = visibleOutfit(state, selected.id)
  const level = bondLevel(selected.bond)
  const progress = bondProgress(selected.bond)
  const isButterfly = selected.stage === 'butterfly'

  return (
    <div className="view care-view">
      <header className="page-header">
        <div>
          <p className="eyebrow">Companion care</p>
          <h1>Care &amp; nurture</h1>
          <p>
            Every stage of life needs you: one act of care a day, three days
            per stage, and a bond that lasts forever.
          </p>
        </div>
      </header>

      <div className="creature-picker" role="tablist" aria-label="Your companions">
        {ordered.map((creature) => {
          const isSelected = creature.id === selected.id
          return (
            <button
              key={creature.id}
              role="tab"
              aria-selected={isSelected}
              className={`creature-chip ${isSelected ? 'selected' : ''}`}
              onClick={() => {
                setSelectedId(creature.id)
                setNameDraft(undefined)
              }}
            >
              <CreatureSprite
                speciesId={creature.speciesId}
                stage={creature.stage}
                size={44}
                outfit={visibleOutfit(state, creature.id)}
              />
              <span>
                <strong>{creature.name}</strong>
                <small>
                  {stageLabels[creature.stage]}
                  {creature.stage !== 'butterfly' &&
                    ` · ${careDaysCompleted(creature)}/${STAGE_CARE_DAYS}`}
                </small>
              </span>
              {!hasCaredToday(creature, today) && (
                <span className="needs-care-dot" title="Needs care today" />
              )}
            </button>
          )
        })}
      </div>

      <section className="card care-stage-card">
        <div className="care-stage-layout">
          <div className="care-portrait">
            <CreatureSprite
              speciesId={selected.speciesId}
              stage={selected.stage}
              size={190}
              outfit={outfit}
              label={`${selected.name} the ${definition?.commonName ?? 'butterfly'}`}
            />
            {caredToday && (
              <span className="cared-today-badge">
                <Icon name="care" size={16} /> Cared for today
              </span>
            )}
          </div>
          <div className="care-summary">
            <div className="care-name-row">
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  if (nameDraft !== undefined) {
                    onRenameCreature(selected.id, nameDraft)
                    setNameDraft(undefined)
                  }
                }}
              >
                <input
                  className="care-name-input"
                  value={nameDraft ?? selected.name}
                  onChange={(event) => setNameDraft(event.target.value)}
                  maxLength={40}
                  aria-label={`Name for ${selected.name}`}
                />
                {nameDraft !== undefined && nameDraft.trim() !== selected.name && (
                  <button className="secondary-button compact" type="submit">
                    Save
                  </button>
                )}
              </form>
              <p className="care-species">
                {definition?.commonName}
                <em> · {definition?.scientificName}</em>
              </p>
            </div>

            <div className="lifecycle-track" aria-label="Life cycle progress">
              {STAGE_ORDER.map((stage, index) => {
                const currentIndex = STAGE_ORDER.indexOf(selected.stage)
                const status =
                  index < currentIndex
                    ? 'done'
                    : index === currentIndex
                      ? 'current'
                      : 'ahead'
                return (
                  <div key={stage} className={`lifecycle-step ${status}`}>
                    <span className="lifecycle-dot" aria-hidden="true" />
                    <small>{stageLabels[stage]}</small>
                  </div>
                )
              })}
            </div>

            <p className="stage-description">{stageDescriptions[selected.stage]}</p>

            {!isButterfly ? (
              <div className="care-days" aria-label={`${careDays} of ${STAGE_CARE_DAYS} care days complete`}>
                <span>Care days toward {stageLabels[STAGE_ORDER[STAGE_ORDER.indexOf(selected.stage) + 1]]}:</span>
                <span className="care-day-dots" aria-hidden="true">
                  {Array.from({ length: STAGE_CARE_DAYS }, (_, index) => (
                    <span
                      key={index}
                      className={`care-day-dot ${index < careDays ? 'filled' : ''} ${index === careDays && caredToday ? 'today' : ''}`}
                    />
                  ))}
                </span>
                <strong>
                  {careDays} / {STAGE_CARE_DAYS}
                </strong>
              </div>
            ) : (
              <div className="care-days" aria-label="Lifetime care days">
                <span>Days of butterfly care:</span>
                <strong>{careDaysCompleted(selected)}</strong>
              </div>
            )}

            <div className="bond-meter" aria-label={`Bond level ${level}`}>
              <div className="bond-heading">
                <span>
                  <Icon name="care" size={16} /> Bond level {level}
                </span>
                <small>
                  {progress} / {BOND_PER_LEVEL} to level {level + 1}
                </small>
              </div>
              <div className="bond-bar">
                <span style={{ width: `${(progress / BOND_PER_LEVEL) * 100}%` }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="card" aria-labelledby="care-actions-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{stageLabels[selected.stage]} care</p>
            <h2 id="care-actions-title">Today's care menu</h2>
          </div>
          <span className="count-badge">
            {actions.filter((action) => actionDoneToday(selected, action.id, today)).length}{' '}
            / {actions.length} done
          </span>
        </div>
        <p className="section-explainer">
          Each activity can be done once a day. Activities marked with a supply
          use one from your satchel — stock up in the Shop.
        </p>
        <div className="care-action-grid">
          {actions.map((action) => {
            const done = actionDoneToday(selected, action.id, today)
            const supply = action.requiresItemId
              ? getShopItem(action.requiresItemId)
              : undefined
            const supplyCount = action.requiresItemId
              ? (state.inventory[action.requiresItemId] ?? 0)
              : undefined
            const missingSupply = supply !== undefined && (supplyCount ?? 0) < 1
            return (
              <button
                key={action.id}
                className={`care-action ${done ? 'done' : ''}`}
                disabled={done || missingSupply}
                onClick={() => onCare(selected.id, action.id)}
              >
                <span className="care-action-icon">
                  <Icon name={action.icon as Parameters<typeof Icon>[0]['name']} size={26} />
                </span>
                <strong>{action.name}</strong>
                <small>{action.description}</small>
                <span className="care-action-meta">
                  <span className="bond-chip">
                    <Icon name="care" size={14} /> +{action.bond}
                  </span>
                  {supply && (
                    <span className={`supply-chip ${missingSupply ? 'empty' : ''}`}>
                      {supply.name}: {supplyCount}
                    </span>
                  )}
                  {done && <span className="done-chip">Done today</span>}
                </span>
              </button>
            )
          })}
        </div>
        <div className="supply-footer">
          <span>
            Satchel:{' '}
            {Object.entries(state.inventory)
              .filter(([, count]) => count > 0)
              .map(([itemId, count]) => `${getShopItem(itemId)?.name ?? itemId} ×${count}`)
              .join(', ') || 'empty'}
          </span>
          <button className="text-button" onClick={onGoToShop}>
            Restock in the Shop →
          </button>
        </div>
      </section>

      <section className="card" aria-labelledby="wardrobe-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Wardrobe</p>
            <h2 id="wardrobe-title">Dress {selected.name}</h2>
          </div>
        </div>
        <p className="section-explainer">
          Cosmetics you own can be equipped on any companion. Items only show
          in stages they fit; nothing is ever lost.
        </p>
        <div className="wardrobe-grid">
          {outfitSlots.map((slot) => {
            const equippedId = selected.outfit[slot.id]
            const options = shopItems.filter(
              (item) =>
                item.kind === 'cosmetic' &&
                item.slot === slot.id &&
                !item.premium &&
                state.ownedItemIds.includes(item.id) &&
                (item.stages ?? []).includes(selected.stage),
            )
            return (
              <div className="wardrobe-slot" key={slot.id}>
                <h3>{slot.label}</h3>
                {options.length === 0 && !equippedId ? (
                  <p className="empty-copy">
                    No {slot.label.toLowerCase()} for this stage yet. Visit the
                    Boutique in the Shop.
                  </p>
                ) : (
                  <div className="wardrobe-options">
                    {options.map((item) => {
                      const isEquipped = equippedId === item.id
                      return (
                        <button
                          key={item.id}
                          className={`wardrobe-item ${isEquipped ? 'equipped' : ''}`}
                          onClick={() =>
                            isEquipped
                              ? onUnequip(selected.id, slot.id)
                              : onEquip(selected.id, item.id)
                          }
                          aria-pressed={isEquipped}
                        >
                          <Icon name={item.icon as Parameters<typeof Icon>[0]['name']} size={20} />
                          <span>{item.name}</span>
                          <small>{isEquipped ? 'Wearing — tap to remove' : 'Tap to wear'}</small>
                        </button>
                      )
                    })}
                    {equippedId && !options.some((item) => item.id === equippedId) && (
                      <button
                        className="wardrobe-item equipped"
                        onClick={() => onUnequip(selected.id, slot.id)}
                      >
                        <span>{getShopItem(equippedId)?.name ?? 'Item'}</span>
                        <small>Waiting for a fitting stage — tap to unequip</small>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {definition && (
        <section className="card species-fact-card">
          <p className="eyebrow">Field guide</p>
          <h2>{definition.commonName}</h2>
          <p>{definition.fact}</p>
        </section>
      )}
    </div>
  )
}
