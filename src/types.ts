export type IconName =
  | 'garden'
  | 'today'
  | 'journal'
  | 'settings'
  | 'sun'
  | 'moon'
  | 'seed'
  | 'leaf'
  | 'nectar'
  | 'shop'
  | 'flight'
  | 'care'
  | 'droplet'
  | 'music'
  | 'eye'
  | 'berry'
  | 'bath'
  | 'play'
  | 'sparkle'
  | 'stardust'
  | 'hat'
  | 'bow'
  | 'crown'
  | 'flower'
  | 'lock'

export type AppView =
  | 'garden'
  | 'care'
  | 'today'
  | 'journal'
  | 'shop'
  | 'flight-patterns'
  | 'guide'
  | 'settings'
  /** The end-of-day recap. Reached from Today, deliberately not in the nav. */
  | 'recap'
  | 'whats-new'
  /** Reached from Settings → About. */
  | 'privacy'
  | 'notices'
  /** "If you need support now": from Settings, the Guide and Today. */
  | 'support'
export type GoalSchedule = 'once' | 'daily' | 'weekdays'
export type PlantKind = 'host' | 'nectar'
export type CreatureStage = 'egg' | 'caterpillar' | 'chrysalis' | 'butterfly'
export type AppearanceTheme = 'sunlight' | 'night'
export type AmbientTrackId = 'garden-chimes' | 'garden' | 'piano-music'
export type FlightPatternId =
  | 'gentle-drift'
  | 'petal-hop'
  | 'figure-eight'
  | 'sunbeam-swoop'
  | 'spiral-rise'
  | 'garden-waltz'
  | 'clover-meander'
  | 'breeze-glide'
  | 'blossom-bounce'
  | 'ribbon-loop'
  | 'moonbeam-float'
  | 'canopy-dance'
export type GardenBackdropId =
  | 'sunlit-meadow'
  | 'woodland-brook'
  | 'secret-conservatory'
  | 'cottage-bloom'
  | 'rain-kissed-pond'
  | 'twilight-orchard'
  | 'cloud-garden'
export type ButterflyWingShape =
  | 'rounded'
  | 'swallowtail'
  | 'longwing'
  | 'small'
  | 'ragged'
  | 'broad'
  | 'clear'
export type JarColorId =
  | 'blue'
  | 'yellow'
  | 'pink'
  | 'purple'
  | 'green'
  | 'orange'
  | 'white'
  | 'charcoal'

export type CurrencyId = 'nectar' | 'stardust' | 'seeds'
export type OutfitSlot = 'headwear' | 'accessory' | 'aura'
export type ShopItemKind = 'supply' | 'cosmetic'

export interface Profile {
  id: 'profile'
  name: string
  gardenName: string
  createdAt: string
  activeCompanionId?: string
  reducedMotion: boolean
  /**
   * The middle way between full motion and `reducedMotion`: slower wings and
   * swaying, gentler flight, fewer butterflies aloft (see lib/motion). Ignored
   * while `reducedMotion` is on. Optional, so an older garden or backup reads
   * as full motion.
   */
  calmMotion?: boolean
  /** Whether the selected on-device soundscape is playing. */
  ambientSound?: boolean
  /** Soundscape played while ambient sound is enabled. */
  ambientTrack?: AmbientTrackId
  theme?: AppearanceTheme
  selectedBackdropId?: GardenBackdropId
  unlockedBackdropIds?: GardenBackdropId[]
  /**
   * A gardener's own image, when one is chosen. Takes precedence over
   * `selectedBackdropId` while the record exists and access allows it; the
   * built-in selection stays underneath as the fallback.
   */
  selectedCustomBackdropId?: string
  /** The newest release notes this gardener has already seen. */
  lastSeenReleaseId?: string
  /**
   * Keep the journal free of day counts: the rhythm card says nothing of how
   * many days. Optional, so an older garden reads as counts shown.
   */
  hideDayCounts?: boolean
  /**
   * The local date of a gentle day, if today is one: Today shows a few small
   * goals and no counts until midnight. Optional and self-expiring.
   */
  gentleDay?: string
  /**
   * The plant the gardener asked the next Sunlight to tend, while it is still
   * growing. Without it, the first plant still growing is tended.
   */
  tendFirstPlantId?: string
  /**
   * The hour (12–23) the gardener's evening starts, when the Moonlight recap
   * opens. Optional: without it the recap opens at 6pm.
   */
  recapOpensHour?: number
  /**
   * The hour (0–10) a late night ends: until then the recap still offers
   * the day before. Optional: without it, 4am.
   */
  recapGraceEndsHour?: number
}

/** Image formats a garden image may be stored as. */
export type CustomBackdropMimeType = 'image/jpeg' | 'image/png' | 'image/webp'

/**
 * How a stored image is framed, as normalised focal coordinates.
 *
 * Kept instead of a cropped copy so the cover framing can be recalculated for
 * a phone and a desktop from the same picture. Cropping destructively would
 * mean one of the two shapes always looked wrong.
 */
export interface CustomBackdropCrop {
  /** Focal point across the image, 0..1. */
  x: number
  /** Focal point down the image, 0..1. */
  y: number
  /** 1 fits the frame; up to 3 magnifies about the focal point. */
  zoom: number
}

/**
 * One of a small number of images a gardener has added from their device.
 *
 * The processed image is stored, not the original file: it is resized, has its
 * metadata stripped by re-encoding, and is bounded in bytes. A backup carries
 * exactly this, which is why the interface must not claim to keep the original.
 */
export interface CustomBackdrop {
  id: string
  /** Plain text, entered by the gardener. */
  name: string
  createdAt: string
  updatedAt: string
  mimeType: CustomBackdropMimeType
  /** Pixel dimensions of the stored image, after resizing. */
  width: number
  height: number
  /** Decoded size of `imageData`, so a quota check needs no decode. */
  byteLength: number
  /** Base64, without a data-URL prefix. */
  imageData: string
  crop: CustomBackdropCrop
}

export interface Goal {
  id: string
  title: string
  schedule: GoalSchedule
  weekdays: number[]
  createdDate: string
  archived: boolean
  /** One-time goals planned for a specific day from the month planner. */
  scheduledDate?: string
  /** Hidden from Today until this local date (snooze). */
  snoozedUntil?: string
  /** Local dates the user chose to skip — no pressure, no penalty. */
  skippedDates?: string[]
}

export interface DailyCompletion {
  id: string
  goalId: string
  localDate: string
  completedAt: string
}

export interface MoodEntry {
  id: string
  localDate: string
  level: 1 | 2 | 3 | 4 | 5
  /**
   * The gardener chose "Not sure today". `level` is then the middle level,
   * so a build that predates this field reads an ordinary, neutral day.
   */
  unsure?: true
  note: string
  createdAt: string
  updatedAt: string
}

/** A check-in answer: one of the five weathers, or not sure. */
export type MoodChoice = MoodEntry['level'] | 'unsure'

export interface ReflectionEntry {
  id: string
  localDate: string
  promptId: string
  body: string
  createdAt: string
  updatedAt: string
}

/**
 * An end-of-day recap: the gardener's writing, and theirs to edit or delete.
 *
 * Deliberately separate from the `moonlight` ledger that records the payout.
 * Deleting a recap must not hand back the bonus, the same way deleting a mood
 * does not refund the Sunlight it earned.
 */
export interface RecapEntry {
  id: string
  /** The day being closed out -- not necessarily the day it was written. */
  localDate: string
  /** Evening inner weather. Absent when the question was skipped. */
  level?: 1 | 2 | 3 | 4 | 5
  /** "What went well today?" */
  wentWell: string
  /** "What are you setting down?" */
  settingDown: string
  /**
   * "Anything for tomorrow?": up to three notes, one per line. A single
   * string, so a build from before the lines reads them as one note.
   */
  forTomorrow: string
  /** The first note planned as a goal; kept for builds that know only one. */
  plannedGoalId?: string
  /** Every note planned as a goal, in order. */
  plannedGoalIds?: string[]
  createdAt: string
  updatedAt: string
}

/**
 * A collected Moonlight bonus. Append-only: the UI never removes one, so a
 * recap can be rewritten without paying out twice.
 */
export interface MoonlightAward {
  id: string
  localDate: string
  awardedAt: string
}

export interface PlantInstance {
  id: string
  plantId: string
  growth: number
  plantedAt: string
}

export interface CreatureInstance {
  id: string
  speciesId: string
  name: string
  stage: CreatureStage
  /** Distinct local dates on which this creature received care, per stage. */
  careDates: Partial<Record<CreatureStage, string[]>>
  /** actionId -> local date the action was last performed (once per day each). */
  actionLog: Record<string, string>
  /** Lifetime bond points earned through care. */
  bond: number
  /** Equipped cosmetics by slot (item ids from the shop catalog). */
  outfit: Partial<Record<OutfitSlot, string>>
  discoveredAt: string
  /** Legacy 1.x care counter, kept for old saves. */
  carePoints: number
  chrysalisStartedAt?: string
  /** Legacy 1.x chrysalis timer; still honored for old saves. */
  emergeAt?: string
  emergedAt?: string
  sourcePlantId?: string
  /**
   * Set on an egg the garden has just found, until the gardener names it or
   * keeps the name it came with. Read only while the creature is an egg, so
   * one that hatches without an answer simply leaves the offer behind.
   */
  awaitingName?: boolean
}

export interface SunlightAward {
  id: string
  localDate: string
  source: string
  awardedAt: string
}

export interface JarInstance {
  id: string
  character: string
  colorId: JarColorId
  purchasedAt: string
}

export interface JarPlacement {
  plantId: string
  jarId: string
}

export interface AppState {
  version: 6
  profile?: Profile
  goals: Goal[]
  completions: DailyCompletion[]
  moods: MoodEntry[]
  reflections: ReflectionEntry[]
  recaps: RecapEntry[]
  moonlight: MoonlightAward[]
  /** At most CUSTOM_BACKDROP_SLOTS images the gardener added themselves. */
  customBackdrops: CustomBackdrop[]
  plants: PlantInstance[]
  creatures: CreatureInstance[]
  sunlight: SunlightAward[]
  seeds: number
  nectar: number
  stardust: number
  /** Consumable care supplies: itemId -> count on hand. */
  inventory: Record<string, number>
  /** Cosmetic items owned (shared closet, equip on any creature). */
  ownedItemIds: string[]
  ownedFlightPatternIds: FlightPatternId[]
  selectedFlightPatternId: FlightPatternId
  jars: JarInstance[]
  jarPlacements: JarPlacement[]
}

export interface SpeciesDefinition {
  id: string
  commonName: string
  scientificName: string
  hostPlantIds: string[]
  wingColors: [string, string]
  visualPattern: string
  wingShape: ButterflyWingShape
  fact: string
}

export interface PlantDefinition {
  id: string
  name: string
  scientificName: string
  kind: PlantKind
  speciesIds: string[]
  color: string
  description: string
}

/** What kind of reflection a prompt invites. */
export type ReflectionPromptFamily =
  | 'noticing'
  | 'savouring'
  | 'gratitude'
  | 'self-compassion'
  | 'processing'
  | 'rest'
  | 'connection'
  | 'free'

export interface ReflectionPrompt {
  id: string
  text: string
  family: ReflectionPromptFamily
}

export interface Observation {
  id: string
  /** A species id, or the literal 'all' for lines any butterfly can prompt. */
  speciesId: string
  text: string
}

export interface FlightPatternDefinition {
  id: FlightPatternId
  name: string
  description: string
  cost: number
  currency: Extract<CurrencyId, 'nectar' | 'stardust'>
}

export interface JarColorDefinition {
  id: JarColorId
  label: string
  fill: string
  /**
   * Ink for the letter on the jar's cream label (JAR_LABEL). Kept at WCAG AA
   * contrast or better against it; jars.test.ts checks every colour.
   */
  text: string
  border: string
  highlight: string
}

export interface CareActionDefinition {
  id: string
  stage: CreatureStage
  name: string
  description: string
  icon: IconName
  /** Bond points granted when performed. */
  bond: number
  /** Supply item consumed from inventory, if any. Free actions omit this. */
  requiresItemId?: string
}

export interface ShopItemDefinition {
  id: string
  kind: ShopItemKind
  name: string
  description: string
  icon: IconName
  cost: number
  currency: Extract<CurrencyId, 'nectar' | 'stardust'>
  /** Cosmetics only: which slot the item occupies. */
  slot?: OutfitSlot
  /** Cosmetics only: stages the item can be worn in. */
  stages?: CreatureStage[]
  /** Garden Pass exclusives — visible but not purchasable yet. */
  premium?: boolean
}
