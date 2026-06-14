export type AppView = 'garden' | 'today' | 'journal' | 'settings'
export type GoalSchedule = 'once' | 'daily' | 'weekdays'
export type PlantKind = 'host' | 'nectar'
export type CreatureStage = 'caterpillar' | 'chrysalis' | 'emerged'
export type AppearanceTheme = 'sunlight' | 'night'
export type GardenBackdropId =
  | 'sunlit-meadow'
  | 'woodland-brook'
  | 'secret-conservatory'

export interface Profile {
  id: 'profile'
  name: string
  gardenName: string
  createdAt: string
  activeCompanionId?: string
  reducedMotion: boolean
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
  carePoints: number
  discoveredAt: string
  chrysalisStartedAt?: string
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

export interface AppState {
  version: 1
  profile?: Profile
  goals: Goal[]
  completions: DailyCompletion[]
  moods: MoodEntry[]
  reflections: ReflectionEntry[]
  plants: PlantInstance[]
  creatures: CreatureInstance[]
  sunlight: SunlightAward[]
  seeds: number
}

export interface SpeciesDefinition {
  id: string
  commonName: string
  scientificName: string
  hostPlantIds: string[]
  wingColors: [string, string]
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
