export type AppView =
  | 'garden'
  | 'care'
  | 'today'
  | 'journal'
  | 'shop'
  | 'flight-patterns'
  | 'guide'
  | 'settings'
export type GoalSchedule = 'once' | 'daily' | 'weekdays'
export type PlantKind = 'host' | 'nectar'
export type CreatureStage = 'egg' | 'caterpillar' | 'chrysalis' | 'butterfly'
export type AppearanceTheme = 'sunlight' | 'night'
export type FlightPatternId =
  | 'gentle-drift'
  | 'petal-hop'
  | 'figure-eight'
  | 'sunbeam-swoop'
  | 'spiral-rise'
  | 'garden-waltz'
export type GardenBackdropId =
  | 'sunlit-meadow'
  | 'woodland-brook'
  | 'secret-conservatory'
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
  /** Generative garden soundscape (breeze, chimes, birdsong). */
  ambientSound?: boolean
  theme?: AppearanceTheme
  selectedBackdropId?: GardenBackdropId
  unlockedBackdropIds?: GardenBackdropId[]
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
  note: string
  createdAt: string
  updatedAt: string
}

export interface ReflectionEntry {
  id: string
  localDate: string
  promptId: string
  body: string
  createdAt: string
  updatedAt: string
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
  version: 4
  profile?: Profile
  goals: Goal[]
  completions: DailyCompletion[]
  moods: MoodEntry[]
  reflections: ReflectionEntry[]
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

export interface ReflectionPrompt {
  id: string
  text: string
}

export interface Observation {
  id: string
  speciesId: string | 'all'
  text: string
}

export interface FlightPatternDefinition {
  id: FlightPatternId
  name: string
  description: string
  cost: number
  animationClass: string
}

export interface JarColorDefinition {
  id: JarColorId
  label: string
  fill: string
  text: string
  border: string
  highlight: string
}

export interface CareActionDefinition {
  id: string
  stage: CreatureStage
  name: string
  description: string
  icon: string
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
  icon: string
  cost: number
  currency: Extract<CurrencyId, 'nectar' | 'stardust'>
  /** Cosmetics only: which slot the item occupies. */
  slot?: OutfitSlot
  /** Cosmetics only: stages the item can be worn in. */
  stages?: CreatureStage[]
  /** Garden Pass exclusives — visible but not purchasable yet. */
  premium?: boolean
}
