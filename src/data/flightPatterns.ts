import type { FlightPatternDefinition } from '../types'

export const flightPatterns: FlightPatternDefinition[] = [
  {
    id: 'gentle-drift',
    name: 'Gentle Drift',
    description: 'Easy garden loops with quiet pauses near the flowers.',
    cost: 0,
    animationClass: 'pattern-gentle-drift',
  },
  {
    id: 'petal-hop',
    name: 'Petal Hop',
    description: 'Short flower-to-flower movements with frequent little rests.',
    cost: 9,
    animationClass: 'pattern-petal-hop',
  },
  {
    id: 'figure-eight',
    name: 'Figure Eight',
    description: 'Smooth crossing loops with a gentle hover through the center.',
    cost: 18,
    animationClass: 'pattern-figure-eight',
  },
  {
    id: 'sunbeam-swoop',
    name: 'Sunbeam Swoop',
    description: 'High sunny arcs followed by low pauses over the blooms.',
    cost: 27,
    animationClass: 'pattern-sunbeam-swoop',
  },
  {
    id: 'spiral-rise',
    name: 'Spiral Rise',
    description: 'Climbing circles that settle into a slow, graceful descent.',
    cost: 36,
    animationClass: 'pattern-spiral-rise',
  },
  {
    id: 'garden-waltz',
    name: 'Garden Waltz',
    description: 'Broad alternating loops with several flower-side rests.',
    cost: 45,
    animationClass: 'pattern-garden-waltz',
  },
]
