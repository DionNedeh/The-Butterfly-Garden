import type { AmbientTrackId } from '../types'

export interface AmbientTrackDefinition {
  id: AmbientTrackId
  name: string
  description: string
}

export const DEFAULT_AMBIENT_TRACK_ID: AmbientTrackId = 'garden-chimes'

export const ambientTracks: AmbientTrackDefinition[] = [
  {
    id: 'garden-chimes',
    name: 'Garden Sounds & Wind Chimes',
    description:
      'The original blend of soft breeze, distant birdsong, and occasional wind chimes.',
  },
  {
    id: 'garden',
    name: 'Garden Sounds',
    description:
      'Soft breeze and distant birdsong, without wind chimes.',
  },
  {
    id: 'piano-music',
    name: 'Piano Music',
    description:
      'An original, gently repeating classical-style piano piece without garden sounds.',
  },
  {
    id: 'soft-rain',
    name: 'Soft Rain',
    description:
      'Steady, gentle rain with the odd soft drop close by, and no thunder. Calming ambience, not a sleep aid.',
  },
  {
    id: 'dawn-birdsong',
    name: 'Dawn Birdsong',
    description:
      'A few birds, made on this device, singing now and then with long, quiet pauses over a hush of morning air.',
  },
]

/** What night brings when the soundscape follows the theme (lib/sound). */
export const NIGHT_AMBIENT_TRACK_ID: AmbientTrackId = 'piano-music'

export function ambientTrackName(trackId: AmbientTrackId | undefined): string {
  return (
    ambientTracks.find((track) => track.id === trackId)?.name ??
    ambientTracks[0].name
  )
}
