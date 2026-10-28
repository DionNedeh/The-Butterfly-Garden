import { effectiveBackdropId } from '../lib/appearance'
import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useMemo,
  useState,
  type CSSProperties,
} from 'react'
import { plants, species } from '../data/content'
import { flightPatterns } from '../data/flightPatterns'
import { getDailyPromptIndex, toLocalDate } from '../lib/date'
import { distinctSpeciesRaised } from '../lib/speciesAcquisition'
import { FlyingButterfly } from './FlyingButterfly'
import { JarSprite } from './sprites/JarSprite'
import { backdropAssets, loadBackdrop } from '../data/backdropAssets'
import { activeCustomBackdrop } from '../lib/customBackdrops'
import { hasGardenPassFeature } from '../lib/gardenPass'
import { flightPatternFor } from '../lib/flightPatterns'
import { CustomBackdropImage } from './CustomBackdropImage'
import { jarForPlant, jarSpokenName } from '../lib/jars'
import {
  DAILY_SEED_REWARD,
  EMERGENCE_SEED_REWARD,
  MAX_PLANT_GROWTH,
  PLANT_SEED_COST,
} from '../lib/progression'
import type { AppState, AppearanceTheme, OutfitSlot } from '../types'
import { PLANT_CAPACITY, plantingBlocker } from '../lib/plantManagement'
import {
  careDaysCompleted,
  hasCaredToday,
  STAGE_CARE_DAYS,
  stageLabels,
} from '../lib/lifecycle'
import { visibleOutfits } from '../lib/wardrobe'
import { Butterfly } from './Butterfly'
import { CreatureSprite } from './sprites/CreatureSprite'
import { FlowerSprite } from './sprites/FlowerSprite'
import { Icon } from './Icons'
import { CALM_AIRBORNE, motionPreference } from '../lib/motion'
import { currentSeason, hemisphereOf } from '../lib/seasons'
import { welcomeBackToday } from '../lib/visits'
import { homeScreenAdvice, isHomeScreenGuidePutAway, putAwayHomeScreenGuide } from '../lib/install'

/** Only on a return after a few days away, so the first load carries none of it. */
const WelcomeBack = lazy(() =>
  import('./garden/WelcomeBack').then((m) => ({ default: m.WelcomeBack })),
)
/** Only on an iPhone or iPad in a browser, until put away. */
const HomeScreenGuide = lazy(() =>
  import('./garden/HomeScreenGuide').then((m) => ({ default: m.HomeScreenGuide })),
)
/**
 * Marigold's letter, while one waits. It decides that for itself, so none of
 * the letters' timing is in the first load.
 */
const LetterCard = lazy(() =>
  import('./garden/LetterCard').then((m) => ({ default: m.LetterCard })),
)
/** The seed tray, once it is first opened. */
const SeedTray = lazy(() =>
  import('./garden/SeedTray').then((m) => ({ default: m.SeedTray })),
)
/** A plant's field guide and its jars, only once a plant is chosen. */
const PlantPanel = lazy(() =>
  import('./garden/PlantPanel').then((m) => ({ default: m.PlantPanel })),
)
const Moth = lazy(() => import('./garden/Moth').then((m) => ({ default: m.Moth })))
const SeasonArt = lazy(() => import('./garden/SeasonArt').then((m) => ({ default: m.SeasonArt })))
/** At night, with full motion, in place of the day's petals. */
const Fireflies = lazy(() =>
  import('./garden/Fireflies').then((m) => ({ default: m.Fireflies })),
)
/**
 * The line under the garden's name, by day, by night and by season
 * (lib/gardenLines): its words are the garden's alone, so they are not in the
 * first load. Should they fail to load (an update half-arrived, say), the
 * garden's quiet line stands in.
 */
const GardenLine = lazy(() =>
  import('./garden/GardenLine').then(
    (m) => ({ default: m.GardenLine }),
    () => ({ default: () => 'The garden is finding its rhythm.' }),
  ),
)

/** Catalogs are static, so index them once at module load instead of scanning
 *  them inside every render loop. */
const plantsById = new Map(plants.map((plant) => [plant.id, plant]))
const speciesById = new Map(species.map((item) => [item.id, item]))
/** Marigold flies with the companions but is the garden's guide, not one. */
const GUIDE_ID = 'marigold-guide'
/** Only asked for once a butterfly is tapped, so it is not in the first load. */
const ButterflyCard = lazy(() =>
  import('./ButterflyCard').then((m) => ({ default: m.ButterflyCard })),
)

/**
 * Rendered width of a plant sprite in the scene.
 *
 * Narrow viewports give each plant a slot far narrower than this so all eight
 * fit the row; the sprites then overlap like a dense bed, and the row reserves
 * half a sprite at each end so the outer two are not clipped by the card.
 * `--plant-sprite-size` carries the width to the stylesheet, which needs it
 * for that reservation.
 */
const PLANT_SPRITE_SIZE = 84

export function GardenView({
  state,
  onPlant,
  onRemovePlant,
  onPlaceJar,
  onRemoveJarPlacement,
  onSelectCompanion,
  onRenameCreature,
  onOpenCare,
  onCareFor,
  seedFocus,
  onOpenGuide,
  onPutAwayWelcomeBack,
  onOpenLetter,
  onReadLetter,
  theme,
}: {
  state: AppState
  onPlant: (plantId: string) => void
  onRemovePlant: (plantId: string) => void
  onPlaceJar: (jarId: string, plantId: string) => void
  onRemoveJarPlacement: (plantId: string) => void
  onSelectCompanion: (creatureId: string) => void
  onRenameCreature: (creatureId: string, name: string) => void
  onOpenCare: () => void
  /** Opens Care with one companion chosen, from its card in the scene. */
  onCareFor?: (creatureId: string) => void
  seedFocus?: string
  onOpenGuide?: () => void
  /** Put away the welcome back after a few days away (lib/visits). */
  onPutAwayWelcomeBack?: () => void
  /** Open Marigold's newest letter in the Journal (lib/letters). */
  onOpenLetter?: () => void
  /** Note the letter for the week ending on this Sunday as read, or put away. */
  onReadLetter?: (sunday: string) => void
  /** The theme on screen, chosen or followed: night shows the night's image. */
  theme?: AppearanceTheme
}) {
  const [showSeedTray, setShowSeedTray] = useState(Boolean(seedFocus))
  const [selectedPlantId, setSelectedPlantId] = useState<string>()
  const [confirmPlantRemoval, setConfirmPlantRemoval] = useState(false)
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({})
  /**
   * Indexed once per change to the creatures, rather than recomputed for each
   * sprite. Building it per creature scanned the whole list every time, and
   * handed each sprite a fresh object that defeated its memo -- so typing a
   * butterfly's name below re-rendered every butterfly and flower on screen.
   * Whether Pass outfits show is read here, during render, so the index is
   * rebuilt when Google Play's answer opens or closes the Pass.
   */
  const passCosmetics = hasGardenPassFeature('pass-cosmetics')
  const outfitByCreature = useMemo(
    () => visibleOutfits(state.creatures, passCosmetics),
    [state.creatures, passCosmetics],
  )
  const emerged = state.creatures.filter(
    (creature) => creature.stage === 'butterfly',
  )
  const developing = state.creatures.filter(
    (creature) => creature.stage !== 'butterfly',
  )
  const active = emerged.find(
    (creature) => creature.id === state.profile?.activeCompanionId,
  )
  const selectedPattern =
    flightPatterns.find(
      (pattern) => pattern.id === state.selectedFlightPatternId,
    ) ?? flightPatterns[0]
  const allGardenButterflies = [
    {
      id: GUIDE_ID,
      speciesId: 'monarch',
      label: 'Marigold, your monarch garden guide',
      // Marigold is the garden's guide, not a companion, so she wears nothing.
      outfit: undefined as Partial<Record<OutfitSlot, string>> | undefined,
      pattern: selectedPattern.id,
    },
    ...emerged.map((creature) => ({
      id: creature.id,
      speciesId: creature.speciesId,
      label: `${creature.name}, ${speciesById.get(creature.speciesId)?.commonName ?? 'butterfly'}`,
      outfit: outfitByCreature.get(creature.id),
      // Its own pattern while the garden owns it, otherwise the garden's.
      pattern: flightPatternFor(state, creature),
    })),
  ]
  // Keep the scene smooth on modest devices: at most 12 butterflies fly at
  // once. Marigold and the active companion always fly; the rest rotate
  // daily so every butterfly gets regular time in the air.
  const MAX_VISIBLE_FLYERS = 12
  const motion = motionPreference(state.profile)
  let gardenButterflies = allGardenButterflies
  if (allGardenButterflies.length > MAX_VISIBLE_FLYERS) {
    const always = allGardenButterflies.filter(
      (butterfly) =>
        butterfly.id === GUIDE_ID ||
        butterfly.id === state.profile?.activeCompanionId,
    )
    const rest = allGardenButterflies.filter(
      (butterfly) => !always.includes(butterfly),
    )
    const offset = getDailyPromptIndex(toLocalDate(), Math.max(1, rest.length))
    gardenButterflies = [
      ...always,
      ...Array.from(
        { length: MAX_VISIBLE_FLYERS - always.length },
        (_, index) => rest[(offset + index) % rest.length],
      ),
    ]
  }
  // How many share the sky. In calm motion only the first few fly and the
  // others settle, so the flyers spread out as if they were alone.
  const aloft =
    motion === 'calm'
      ? Math.min(CALM_AIRBORNE, gardenButterflies.length)
      : gardenButterflies.length
  /**
   * The butterfly whose card is open, by id, and which opening this is. A
   * dialog's close event comes a moment after it closes, by which time the
   * browser has already handed focus back to the butterfly; a key pressed in
   * that moment opens the card again, and the late event must not close the
   * new one. So each opening has a number, and a close ends only its own.
   */
  const [meeting, setMeeting] = useState<{ id: string; opening: number }>()
  const openings = useRef(0)
  const meet = (id: string) => {
    openings.current += 1
    setMeeting({ id, opening: openings.current })
  }
  const meetingCreature = emerged.find((creature) => creature.id === meeting?.id)
  const flightSpace = useRef<HTMLDivElement>(null)
  // The card has closed, however it was closed: focus goes back to the
  // butterfly it was about, rather than falling to the page.
  const closeCard = (closed: { id: string; opening: number }) => {
    if (openings.current !== closed.opening) return
    setMeeting((current) => (current?.opening === closed.opening ? undefined : current))
    const flyer = Array.from(
      flightSpace.current?.querySelectorAll<HTMLElement>('[data-flyer]') ?? [],
    ).find((element) => element.dataset.flyer === closed.id)
    flyer?.querySelector<HTMLElement>('[role="button"]')?.focus()
  }
  const today = toLocalDate()
  const night = theme === 'night'
  const region = state.profile?.region
  // By the gardener's half of the world, or the north's when that is not
  // known: only the scene reads it (its art's season, and fireflies), never
  // words about the gardener's own season.
  const season = currentSeason(today, hemisphereOf(region))
  const selectedPlant = state.plants.find(
    (plant) => plant.id === selectedPlantId,
  )
  const selectedPlantDefinition = selectedPlant
    ? plantsById.get(selectedPlant.plantId)
    : undefined
  const visiblePlants = state.plants.slice(0, PLANT_CAPACITY)
  const mothPlants = new Set(visiblePlants.filter(
    (plant) => plant.growth === MAX_PLANT_GROWTH && plantsById.get(plant.plantId)?.kind === 'nectar',
  ).slice(0, 3).map((plant) => plant.id))
  const visiblePlantIds = new Set(visiblePlants.map((plant) => plant.id))
  const selectedPlantIsVisible = selectedPlant
    ? visiblePlantIds.has(selectedPlant.id)
    : false
  const customBackdrop = activeCustomBackdrop(
    state,
    hasGardenPassFeature('custom-backdrops'),
    theme,
  )
  const [failedImage, setFailedImage] = useState<string>()
  const sceneId = state.profile
    ? effectiveBackdropId(state.profile)
    : 'sunlit-meadow'
  // The chosen scene from the first frame. Starting from Sunlit Meadow and
  // swapping once the chosen one loaded flashed the wrong garden on every
  // visit. A scene changed while the garden is open swaps only once decoded.
  const [displayedScene, setDisplayedScene] = useState({ id: sceneId, night })
  const [sceneUnavailable, setSceneUnavailable] = useState(false)
  useEffect(() => {
    let active = true
    void loadBackdrop(sceneId, undefined, night).then(
      () => {
        if (active) {
          setDisplayedScene({ id: sceneId, night })
          setSceneUnavailable(false)
        }
      },
      async () => {
        // A night painting not yet downloaded can fall back to this scene's
        // day painting. Keep the previous decoded image until it is ready.
        if (night) {
          try {
            await loadBackdrop(sceneId)
            if (active) {
              setDisplayedScene({ id: sceneId, night: false })
              setSceneUnavailable(true)
            }
            return
          } catch { /* The free meadow remains the final offline fallback. */ }
        }
        if (active) {
          setDisplayedScene({ id: 'sunlit-meadow', night: false })
          setSceneUnavailable(true)
        }
      },
    )
    return () => {
      active = false
    }
  }, [sceneId, night])

  const gardenFull = state.plants.length >= PLANT_CAPACITY
  const plantBlocker = plantingBlocker(state, PLANT_SEED_COST)
  const gardenTitle = useRef<HTMLHeadingElement>(null)
  const welcomeBack =
    onPutAwayWelcomeBack && welcomeBackToday(state.profile, today)
  // On an iPhone or iPad in a browser, how to keep the garden on the Home
  // Screen (lib/install), until put away. The answer cannot change while the
  // page is open, so it is asked once. Put away is remembered by this browser
  // alone: a backup carried to another iPhone still offers it there.
  const [homeScreen] = useState(homeScreenAdvice)
  const [homeScreenGuidePutAway, setHomeScreenGuidePutAway] = useState(isHomeScreenGuidePutAway)

  return (
    <div className="view garden-view">
      <section
        className={`garden-hero backdrop-${displayedScene.id}`}
        style={{ backgroundImage: `url(${backdropAssets[displayedScene.id][displayedScene.night ? 'night' : 'image']})` }}
        data-night-art={displayedScene.night && !customBackdrop ? '' : undefined}
        aria-labelledby="garden-title"
        // A hook for the seasons' art (data/seasons): CSS and images alone can
        // dress the scene by season, and by night with .theme-night around it.
        data-season={season}
        data-personal-art={customBackdrop ? '' : undefined}
      >
        <Suspense fallback={null}><SeasonArt /></Suspense>
        {customBackdrop && failedImage !== customBackdrop.id && (
          <div className="custom-scene-layer">
            <CustomBackdropImage
              image={customBackdrop}
              onError={() => setFailedImage(customBackdrop.id)}
            />
          </div>
        )}
        <div className="hero-petals" aria-hidden="true">
          {!night &&
            Array.from({ length: 7 }, (_, index) => (
              <span key={index} className={`hero-petal petal-${index + 1}`} />
            ))}
        </div>
        {/* Fireflies in place of petals by night, never in winter, and only
            with full motion: none with reduced or calm motion. */}
        {night && motion === 'full' && season !== 'winter' && (
          <Suspense fallback={null}>
            <Fireflies />
          </Suspense>
        )}
        <div className="garden-heading">
          <p className="eyebrow">Your living sanctuary</p>
          {/* Focusable by script only: the recap's fade to night lands here. */}
          <h1 id="garden-title" tabIndex={-1} ref={gardenTitle}>
            {state.profile?.gardenName}
          </h1>
          <p className="garden-observation">
            {/* A space holds the line's place while its words load. */}
            <Suspense fallback={'\u00a0'}>
              <GardenLine
                localDate={today}
                speciesId={active?.speciesId}
                night={night}
                region={region}
              />
            </Suspense>
          </p>
        </div>

        <div
          className="garden-flight-space"
          aria-label="Butterflies flying in the garden"
          ref={flightSpace}
        >
          {gardenButterflies.map((butterfly, index) => (
            <FlyingButterfly
              key={butterfly.id}
              id={butterfly.id}
              pattern={butterfly.pattern}
              index={index}
              aloft={aloft}
              onMeet={() => meet(butterfly.id)}
              speciesId={butterfly.speciesId}
              label={butterfly.label}
              outfit={butterfly.outfit}
              reduced={motion === 'reduce'}
              calm={motion === 'calm'}
              // The first few keep flying; the rest settle, which is most
              // of what makes calm motion lighter on an old phone.
              settled={motion === 'calm' && index >= CALM_AIRBORNE}
            />
          ))}
        </div>

        <div
          className="garden-plants"
          aria-label="Plants in your garden"
          style={
            { '--plant-sprite-size': `${PLANT_SPRITE_SIZE}px` } as CSSProperties
          }
        >
          {visiblePlants.map((plant, index) => {
            const definition = plantsById.get(plant.plantId)
            const placedJar = jarForPlant(state, plant.id)
            // Said, not shown: a mark by its name (lib/jars), so plants with
            // a "!" jar and a "?" jar do not sound alike.
            const jarLabel = placedJar
              ? ` with ${jarSpokenName(placedJar.colorId, placedJar.character)}`
              : ''
            return (
              <button
                type="button"
                className={`garden-plant growth-${plant.growth}`}
                style={
                  {
                    '--plant-color': definition?.color,
                    '--plant-delay': `${index * -0.7}s`,
                  } as CSSProperties
                }
                key={plant.id}
                title={`${definition?.name}: growth ${plant.growth} of ${MAX_PLANT_GROWTH}`}
                aria-label={`View ${definition?.name ?? 'plant'}, growth ${plant.growth} of ${MAX_PLANT_GROWTH}${jarLabel}`}
                aria-pressed={selectedPlantId === plant.id}
                onClick={() => {
                  setSelectedPlantId(plant.id)
                  setConfirmPlantRemoval(false)
                }}
              >
                <FlowerSprite
                  plantId={plant.plantId}
                  growth={plant.growth}
                  size={PLANT_SPRITE_SIZE}
                  swayDelay={index * -0.7}
                />
                {night && motion === 'full' && season !== 'winter' &&
                  mothPlants.has(plant.id) && (
                    <Suspense fallback={null}><Moth resting={index % 2 === 1} /></Suspense>
                  )}
                {placedJar && (
                  <span className="jar-display plant-jar" aria-hidden="true">
                    <JarSprite
                      character={placedJar.character}
                      colorId={placedJar.colorId}
                    />
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </section>
      {/* Outside the scene, so nothing styled for the scene reaches the card. */}
      {meeting && (meeting.id === GUIDE_ID || meetingCreature) && (
        <Suspense fallback={null}>
          <ButterflyCard
            key={meeting.opening}
            creature={meetingCreature}
            outfit={meetingCreature && outfitByCreature.get(meetingCreature.id)}
            region={region}
            onCareFor={
              meetingCreature && onCareFor
                ? () => onCareFor(meetingCreature.id)
                : undefined
            }
            onClose={() => closeCard(meeting)}
          />
        </Suspense>
      )}

      {/* Always here, so the welcome is heard, politely, as it arrives. */}
      <div className="welcome-back-region" role="status">
        {welcomeBack && (
          <Suspense fallback={null}>
            <WelcomeBack
              garden={state}
              returnedOn={today}
              onPutAway={() => {
                // The card leaves with its button; focus goes to the garden's name.
                gardenTitle.current?.focus()
                onPutAwayWelcomeBack()
              }}
            />
          </Suspense>
        )}
      </div>

      {homeScreen && !homeScreenGuidePutAway && (
        <Suspense fallback={null}>
          <HomeScreenGuide
            advice={homeScreen}
            onPutAway={() => {
              // The card leaves with its button; focus goes to the garden's name.
              gardenTitle.current?.focus()
              putAwayHomeScreenGuide()
              setHomeScreenGuidePutAway(true)
            }}
          />
        </Suspense>
      )}

      {/* From Sunday evening, Marigold's letter about the week (lib/letters),
          until it is read or put away, or the next Sunday's replaces it. */}
      {onOpenLetter && onReadLetter && (
        <Suspense fallback={null}>
          <LetterCard
            profile={state.profile}
            onRead={onOpenLetter}
            onPutAway={(sunday) => {
              // The card leaves with its button; focus goes to the garden's name.
              gardenTitle.current?.focus()
              onReadLetter(sunday)
            }}
          />
        </Suspense>
      )}

      {sceneUnavailable && (
        <p role="status">
          {/* Inline, so each build carries only its own wording. */}
          {import.meta.env.VITE_PLATFORM === 'android'
            ? 'This scene could not be opened. An available painting is shown instead.'
            : 'This scene is not available offline yet. An available painting is shown until you reconnect.'}
        </p>
      )}
      {(state.profile?.selectedCustomBackdropId ||
        (theme === 'night' && state.profile?.nightCustomBackdropId)) &&
        !customBackdrop && <p role="status">Your personal backdrop is currently unavailable. Your built-in scene is shown and your saved images remain in Settings.</p>}
      {failedImage && (
        <p role="status">
          Your image could not be displayed. The built-in scene is shown; your
          saved image remains in your backup.
        </p>
      )}
      <div className="garden-quick-links">
        <button className="text-button" onClick={onOpenCare}>
          Tend your companions →
        </button>
        {onOpenGuide && (
          <button className="text-button" onClick={onOpenGuide}>
            Find a butterfly & its seed →
          </button>
        )}
      </div>
      <section className="garden-stats" aria-label="Garden resources">
        <div>
          <Icon name="seed" />
          <strong>{state.seeds}</strong>
          <span>seeds ready</span>
        </div>
        <div>
          <Icon name="leaf" />
          {/* Distinct species, not creatures: two Monarchs are one species
              welcomed, which is what the label has always claimed. */}
          <strong>
            {distinctSpeciesRaised(state)} / {species.length}
          </strong>
          <span>species welcomed</span>
        </div>
        <button
          className="secondary-button compact"
          onClick={() => setShowSeedTray((value) => !value)}
          disabled={Boolean(plantBlocker)}
          aria-describedby={plantBlocker ? 'planting-blocker' : undefined}
          aria-expanded={showSeedTray}
        >
          Plant a seed
        </button>
      </section>
      {plantBlocker && (
        <p className="capacity-note" id="planting-blocker">
          {plantBlocker}
        </p>
      )}
      <p className="seed-economy-note">
        Earn {DAILY_SEED_REWARD} seed with your first Sunlight each day and{' '}
        {EMERGENCE_SEED_REWARD} when a butterfly emerges. Each new plant costs{' '}
        {PLANT_SEED_COST} seed.
      </p>

      <section
        className="card plant-inspector"
        aria-labelledby="plant-inspector-title"
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">Plant care</p>
            <h2 id="plant-inspector-title">Garden plants</h2>
          </div>
          <span className="count-badge">
            {state.plants.length} / {PLANT_CAPACITY}
          </span>
        </div>
        <p className="section-explainer">
          Select a plant in the scene or from this list to see its field guide
          and manage its space.
        </p>
        <div className="plant-management-list" aria-label="All garden plants">
          {state.plants.map((plant, index) => {
            const definition = plantsById.get(plant.plantId)
            return (
              <button
                key={plant.id}
                className={selectedPlantId === plant.id ? 'selected' : ''}
                onClick={() => {
                  setSelectedPlantId(plant.id)
                  setConfirmPlantRemoval(false)
                }}
                aria-pressed={selectedPlantId === plant.id}
              >
                <span
                  className="plant-dot"
                  style={{ backgroundColor: definition?.color }}
                  aria-hidden="true"
                />
                {definition?.name ?? 'Plant'} {index + 1}
              </button>
            )
          })}
        </div>
        {selectedPlant && selectedPlantDefinition ? (
          // Its own boundary: the App's would put the whole page away while
          // the plant's panel loads.
          <Suspense fallback={null}>
            <PlantPanel
              state={state}
              plant={selectedPlant}
              definition={selectedPlantDefinition}
              visible={selectedPlantIsVisible}
              confirmingRemoval={confirmPlantRemoval}
              onConfirmRemoval={setConfirmPlantRemoval}
              onRemove={() => {
                onRemovePlant(selectedPlant.id)
                setSelectedPlantId(undefined)
                setConfirmPlantRemoval(false)
              }}
              onPlaceJar={onPlaceJar}
              onRemoveJarPlacement={onRemoveJarPlacement}
            />
          </Suspense>
        ) : (
          <p className="empty-copy">Choose a plant to open its field guide.</p>
        )}
      </section>

      {showSeedTray && (
        <Suspense fallback={null}>
          <SeedTray
            seeds={state.seeds}
            gardenFull={gardenFull}
            seedFocus={seedFocus}
            onPlant={(plantId) => {
              onPlant(plantId)
              if (state.seeds <= 1) setShowSeedTray(false)
            }}
            onClose={() => setShowSeedTray(false)}
          />
        </Suspense>
      )}

      <section className="content-grid">
        <div className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Metamorphosis</p>
              <h2>Growing nearby</h2>
            </div>
            <span className="count-badge">{developing.length}</span>
          </div>
          <p className="section-explainer">
            Eggs hatch into caterpillars, caterpillars form chrysalises, and
            chrysalises open into butterflies — each after three days of care on
            the Care page. Progress is never lost.
          </p>
          {developing.length === 0 ? (
            <p className="empty-copy">
              Mature a host plant to welcome a new butterfly egg.
            </p>
          ) : (
            <div className="creature-list">
              {developing.map((creature) => {
                const definition = speciesById.get(creature.speciesId)
                const cared = hasCaredToday(creature)
                return (
                  <article className="creature-row" key={creature.id}>
                    <CreatureSprite
                      speciesId={creature.speciesId}
                      stage={creature.stage}
                      size={54}
                      outfit={outfitByCreature.get(creature.id)}
                    />
                    <div>
                      <strong>{creature.name}</strong>
                      <span>
                        {stageLabels[creature.stage]} · {definition?.commonName}
                      </span>
                      <small>
                        {careDaysCompleted(creature)} of {STAGE_CARE_DAYS} care
                        days{cared ? ' · cared for today' : ''}
                      </small>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
          <button className="secondary-button compact" onClick={onOpenCare}>
            Open the Care page
          </button>
        </div>

        <div className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Butterfly journal</p>
              <h2>Your companions</h2>
            </div>
            <span className="count-badge">{emerged.length}</span>
          </div>
          {emerged.length === 0 ? (
            <p className="empty-copy">
              {developing[0]
                ? `${developing[0].name} is still changing. The garden will be ready when they emerge.`
                : 'Your companions are still changing. The garden will be ready when they emerge.'}
            </p>
          ) : (
            <div className="companion-grid">
              {emerged.map((creature) => {
                const definition = speciesById.get(creature.speciesId)
                const selected =
                  creature.id === state.profile?.activeCompanionId
                return (
                  <article
                    className={`companion-card ${selected ? 'selected' : ''}`}
                    key={creature.id}
                  >
                    <button
                      className="companion-select-button"
                      onClick={() => onSelectCompanion(creature.id)}
                      aria-pressed={selected}
                    >
                      <Butterfly
                        speciesId={creature.speciesId}
                        label={definition?.commonName ?? 'Butterfly'}
                        outfit={outfitByCreature.get(creature.id)}
                      />
                      <strong>{creature.name}</strong>
                      <small>{definition?.commonName}</small>
                      <span>
                        {selected ? 'Exploring with you' : 'Choose companion'}
                      </span>
                    </button>
                    <form
                      className="butterfly-name-form"
                      onSubmit={(event) => {
                        event.preventDefault()
                        const draft = nameDrafts[creature.id] ?? creature.name
                        onRenameCreature(creature.id, draft)
                      }}
                    >
                      <label>
                        Butterfly name
                        <input
                          value={nameDrafts[creature.id] ?? creature.name}
                          onChange={(event) =>
                            setNameDrafts((current) => ({
                              ...current,
                              [creature.id]: event.target.value,
                            }))
                          }
                          maxLength={40}
                          aria-label={`Name for ${creature.name}`}
                        />
                      </label>
                      <button
                        className="secondary-button compact"
                        type="submit"
                      >
                        Save name
                      </button>
                    </form>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
