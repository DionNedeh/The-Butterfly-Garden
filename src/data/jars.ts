import type { JarColorDefinition } from '../types'

export const JAR_PRICE = 6

/** Enough for a name or a short word on every plant spot, several times over. */
export const JAR_CAPACITY = 60

export const jarCharacters = [
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
  ...'0123456789'.split(''),
]

/** The cream label every jar's letter is printed on. */
export const JAR_LABEL = '#fff9e8'

export const jarColors: JarColorDefinition[] = [
  {
    id: 'blue',
    label: 'Blue',
    fill: '#3b82c4',
    text: '#1d4f86',
    border: '#1d4f86',
    highlight: '#9fd3ff',
  },
  {
    id: 'yellow',
    label: 'Yellow',
    fill: '#f0bd45',
    text: '#7a520c',
    border: '#9f6b12',
    highlight: '#ffe6a1',
  },
  {
    id: 'pink',
    label: 'Pink',
    fill: '#d96f9f',
    text: '#8f3c63',
    border: '#8f3c63',
    highlight: '#ffc3dc',
  },
  {
    id: 'purple',
    label: 'Purple',
    fill: '#7d5bb5',
    text: '#4f3479',
    border: '#4f3479',
    highlight: '#cab7ff',
  },
  {
    id: 'green',
    label: 'Green',
    fill: '#5f9860',
    text: '#376238',
    border: '#376238',
    highlight: '#bde5b6',
  },
  {
    id: 'orange',
    label: 'Orange',
    fill: '#df7d37',
    text: '#9c4f18',
    border: '#9c4f18',
    highlight: '#ffc18b',
  },
  {
    id: 'white',
    label: 'White',
    fill: '#f8f4e8',
    text: '#6b5f49',
    border: '#b9ad95',
    highlight: '#ffffff',
  },
  {
    id: 'charcoal',
    label: 'Charcoal',
    fill: '#2d3b45',
    text: '#15222a',
    border: '#15222a',
    highlight: '#8095a3',
  },
]
