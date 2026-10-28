import type { AmbientTrackId } from '../types'

/**
 * A soundscape's id and name: what the header and storage need. Each one's
 * description is in data/ambientTrackDescriptions.ts, which only Settings
 * reads, so the words arrive with that page rather than with the garden.
 */
export interface AmbientTrackDefinition {
  id: AmbientTrackId
  name: string
}

export const DEFAULT_AMBIENT_TRACK_ID: AmbientTrackId = 'garden-chimes'

export const ambientTracks: AmbientTrackDefinition[] = [
  {
    id: 'garden-chimes',
    name: 'Garden Sounds & Wind Chimes',
  },
  {
    id: 'garden',
    name: 'Garden Sounds',
  },
  {
    id: 'piano-music',
    name: 'Piano Music',
  },
  {
    id: 'soft-rain',
    name: 'Soft Rain',
  },
  {
    id: 'dawn-birdsong',
    name: 'Dawn Birdsong',
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
