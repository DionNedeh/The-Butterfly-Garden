import { describe, expect, it } from 'vitest'
import {
  FLIGHT_ROUTE_COUNT,
  flightRouteStyleFor,
} from './flightRoutes'

describe('butterfly flight routes', () => {
  it('assigns stable routes for the same butterfly', () => {
    expect(flightRouteStyleFor('blue-morpho-1', 4)).toEqual(
      flightRouteStyleFor('blue-morpho-1', 4),
    )
  })

  it('spreads many butterflies across varied route profiles', () => {
    const routes = Array.from({ length: 18 }, (_, index) =>
      flightRouteStyleFor(`butterfly-${index}`, index),
    )
    const uniqueRoutes = new Set(routes.map((route) => route.routeIndex))
    const uniqueDurations = new Set(
      routes.map((route) => route.style['--flight-duration']),
    )

    expect(FLIGHT_ROUTE_COUNT).toBe(12)
    expect(uniqueRoutes.size).toBeGreaterThanOrEqual(8)
    expect(uniqueDurations.size).toBeGreaterThan(4)
    expect(routes[0].style).toMatchObject({
      '--route-x0': expect.stringMatching(/%$/),
      '--route-y4': expect.stringMatching(/%$/),
    })
  })
})
