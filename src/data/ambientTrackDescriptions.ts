import type { AmbientTrackId } from '../types'

/** What each soundscape is, as Settings describes it (data/ambientTracks.ts names them). */
export const ambientTrackDescriptions: Record<AmbientTrackId, string> = {
  'garden-chimes':
    'The original blend of soft breeze, distant birdsong, and occasional wind chimes.',
  'garden':
    'Soft breeze and distant birdsong, without wind chimes.',
  'piano-music':
    'An original, gently repeating classical-style piano piece without garden sounds.',
  'soft-rain':
    'Steady, gentle rain with the odd soft drop close by, and no thunder. Calming ambience, not a sleep aid.',
  'dawn-birdsong':
    'A few birds, made on this device, singing now and then with long, quiet pauses over a hush of morning air.',
}
