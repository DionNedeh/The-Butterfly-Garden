import type { JarColorDefinition } from '../types'

export const JAR_PRICE = 6

export const jarCharacters = [
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
  ...'0123456789'.split(''),
]

export const jarColors: JarColorDefinition[] = [
  {
    id: 'blue',
    label: 'Blue',
    fill: '#3b82c4',
    text: '#fffdf7',
    border: '#1d4f86',
    highlight: '#9fd3ff',
  },
  {
    id: 'yellow',
    label: 'Yellow',
    fill: '#f0bd45',
    text: '#2f2412',
    border: '#9f6b12',
    highlight: '#ffe6a1',
  },
  {
    id: 'pink',
    label: 'Pink',
    fill: '#d96f9f',
    text: '#fffdf7',
    border: '#8f3c63',
    highlight: '#ffc3dc',
  },
  {
    id: 'purple',
    label: 'Purple',
    fill: '#7d5bb5',
    text: '#fffdf7',
    border: '#4f3479',
    highlight: '#cab7ff',
  },
  {
    id: 'green',
    label: 'Green',
    fill: '#5f9860',
    text: '#fffdf7',
    border: '#376238',
    highlight: '#bde5b6',
  },
  {
    id: 'orange',
    label: 'Orange',
    fill: '#df7d37',
    text: '#fffdf7',
    border: '#9c4f18',
    highlight: '#ffc18b',
  },
  {
    id: 'white',
    label: 'White',
    fill: '#f8f4e8',
    text: '#2b392e',
    border: '#b9ad95',
    highlight: '#ffffff',
  },
  {
    id: 'charcoal',
    label: 'Charcoal',
    fill: '#2d3b45',
    text: '#fffdf7',
    border: '#15222a',
    highlight: '#8095a3',
  },
]
