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
/**
 * What the theme follows in place of the gardener's own choice: the device's
 * dark setting, or the gardener's evening (lib/theme).
 */
export type ThemeFollows = 'device' | 'evening'
/** A text size larger than the usual one (lib/textSize). */
export type TextSize = 'larger' | 'largest'
/**
 * A garden pace other than Classic, the pace every garden has always had
 * (lib/gardenPace). Classic is the absence of a choice, so it stores nothing.
 */
export type GardenPace = 'keep-giving'
/**
 * Where the gardener said they garden, chosen in Settings (lib/region): the
 * Guide then marks which butterflies and plants are native there. Never
 * worked out from a location.
 */
export type RegionId = 'north-america' | 'europe' | 'australasia' | 'elsewhere'
export type AmbientTrackId =
  | 'garden-chimes'
  | 'garden'
  | 'piano-music'
  | 'soft-rain'
  | 'dawn-birdsong'
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
  /**
   * How loud the soundscape plays, a whole number from 0 to 100 (lib/sound).
   * Optional: without it, 50, the level the garden has always played at.
   */
  ambientVolume?: number
  /**
   * Night brings the piano: while the theme on screen is night, Piano Music
   * plays in place of `ambientTrack`, which returns with the sunlight.
   * Optional, and only ever true.
   */
  soundFollowsTheme?: true
  /**
   * False pauses the sound while the page is hidden and picks it up again
   * when it is seen. Optional, and only ever false: without it the sound keeps
   * playing in the background, as it always has.
   */
  soundInBackground?: false
  /**
   * The theme chosen by hand. While `themeFollows` is set it waits underneath,
   * so an older build, which follows nothing, still opens on this.
   */
  theme?: AppearanceTheme
  /**
   * Follow the device's dark setting, or the gardener's evening, instead of
   * `theme`. Optional: without it the theme is the one chosen by hand.
   */
  themeFollows?: ThemeFollows
  /** Text larger than usual. Optional: without it, the usual size. */
  textSize?: TextSize
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
  /**
   * When the gardener last kept a copy of the garden (an ISO timestamp): a
   * backup saved, downloaded or shared, or a restore, since the garden then
   * is exactly a file they hold. Settings uses it to suggest a fresh copy
   * now and then (lib/backupReminder). Optional: an older garden has no copy
   * on record.
   *
   * A backup file is written before this is set, so the value inside any file
   * is from the copy before it. A restore replaces that with the moment of
   * the restore, so a file never brings a stale or hand-edited date that
   * would keep the reminder quiet on a new device.
   */
  lastBackupAt?: string
  /**
   * Keep giving: a host plant in full bloom blooms again after a few more
   * days of care, with another egg (lib/gardenPace). Optional: without it the
   * garden keeps its Classic pace, exactly as before there was a choice.
   */
  gardenPace?: GardenPace
  /**
   * The local date the garden was last opened, noted at most once a day
   * (lib/visits). Optional: an older garden has no visit on record, and so
   * nothing to welcome anyone back from.
   */
  lastVisitOn?: string
  /**
   * The local date of a return after a few days away, while the garden's
   * small welcome-back reveal is still out. Putting it away clears it, and on
   * any other day it means nothing. It grants nothing and changes nothing.
   */
  welcomeBackOn?: string
  /**
   * When the garden began keeping its companions' diaries (an ISO timestamp):
   * the care each received and the outfits each wore. Set when a garden is
   * made, or by the first thing written down in an older one. A companion
   * welcomed before it has a story with gaps, and Care says so rather than
   * guessing. Optional: an older garden has kept nothing yet.
   */
  diarySince?: string
  /**
   * The region the gardener chose in Settings, for the Guide's native marks
   * and planting tips. Optional: without it the Guide shows neither.
   */
  region?: RegionId
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
  /**
   * The same goal made small enough for two minutes ("Roll your shoulders"
   * for "Stretch your shoulders"). A gentle day shows it in place of the
   * title; completing it is completing the goal.
   */
  tinyTitle?: string
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
  /**
   * Feeling words chosen beside the weather: ids from data/feelings, each
   * once, in that list's order, at most MAX_FEELINGS. Absent when none were
   * chosen; an empty list is never stored. Optional, so an older build reads
   * an ordinary check-in.
   */
  feelings?: string[]
  /** How much energy the day had, when the gardener said. Absent means not answered. */
  energy?: EnergyLevel
  /**
   * Written afterwards for this earlier day, from the Journal. It earns no
   * Sunlight and is not a cared-for day: the care happened on the day it was
   * written. Only ever stored as true; optional, so an older garden reads as
   * written on the day.
   */
  writtenLater?: true
  createdAt: string
  updatedAt: string
}

/** The three steps of the check-in's optional energy question. */
export type EnergyLevel = 'low' | 'steady' | 'bright'

/** A check-in answer: one of the five weathers, or not sure. */
export type MoodChoice = MoodEntry['level'] | 'unsure'

/** The optional extras a check-in may carry beside its weather and note. */
export type CheckInDetails = Pick<MoodEntry, 'feelings' | 'energy'>

export interface ReflectionEntry {
  id: string
  localDate: string
  promptId: string
  body: string
  /** Written afterwards for this earlier day; see MoodEntry.writtenLater. */
  writtenLater?: true
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
  /**
   * Under Keep giving, the days of care this host plant has seen in full
   * bloom since it last bloomed (lib/gardenPace), up to the number that
   * opens its next bloom. Absent at the start of each count, and always
   * under Classic, which never writes it.
   */
  careDaysSinceBloom?: number
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
  /**
   * A flight pattern of its own, chosen in Care; without one it flies the
   * garden's. Read through flightPatternFor (lib/flightPatterns): a pattern
   * the garden no longer owns is kept here but not flown, so it returns if
   * the pattern is owned again.
   */
  flightPatternId?: FlightPatternId
  /**
   * When the egg became a caterpillar, beside `chrysalisStartedAt` and
   * `emergedAt`. Recorded from the diary on; an older companion's hatching
   * is read from its last egg care day instead (lib/companionStory).
   */
  hatchedAt?: string
  /**
   * How many times each care action was given (action id -> count), from
   * the diary on. Only the companion's story reads it: no reward ever
   * depends on it.
   */
  careCounts?: Record<string, number>
  /**
   * Cosmetics this companion has worn (item ids), each once, in the order
   * first put on, from the diary on. At most MAX_OUTFITS_WORN.
   */
  outfitsWorn?: string[]
}

/** A look saved from a companion's outfit, to put on any companion later. */
export interface OutfitPreset {
  id: string
  /** The gardener's name for it: trimmed, at most PRESET_NAME_LENGTH. */
  name: string
  /** Cosmetic item ids by slot, as a companion's `outfit` holds them. */
  outfit: Partial<Record<OutfitSlot, string>>
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
  /**
   * Looks saved from the wardrobe, at most MAX_OUTFIT_PRESETS (lib/outfitPresets).
   * Optional, so an older garden or backup simply has none.
   */
  outfitPresets?: OutfitPreset[]
}

export interface SpeciesDefinition {
  id: string
  commonName: string
  scientificName: string
  hostPlantIds: string[]
  wingColors: [string, string]
  visualPattern: string
  wingShape: ButterflyWingShape
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
