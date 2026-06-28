export const FLIGHT_ROUTE_COUNT = 12

const routes = [
  [['78%', '19%'], ['53%', '31%'], ['18%', '72%'], ['32%', '54%'], ['78%', '70%']],
  [['14%', '55%'], ['39%', '27%'], ['56%', '68%'], ['44%', '41%'], ['12%', '71%']],
  [['84%', '32%'], ['61%', '52%'], ['44%', '75%'], ['73%', '23%'], ['86%', '66%']],
  [['9%', '25%'], ['34%', '47%'], ['67%', '73%'], ['49%', '36%'], ['9%', '69%']],
  [['7%', '68%'], ['27%', '18%'], ['51%', '61%'], ['74%', '24%'], ['88%', '72%']],
  [['91%', '22%'], ['71%', '58%'], ['46%', '26%'], ['26%', '73%'], ['8%', '41%']],
  [['22%', '16%'], ['49%', '74%'], ['77%', '45%'], ['56%', '18%'], ['19%', '70%']],
  [['68%', '76%'], ['38%', '58%'], ['18%', '28%'], ['52%', '35%'], ['86%', '59%']],
  [['43%', '20%'], ['81%', '32%'], ['69%', '71%'], ['34%', '63%'], ['13%', '43%']],
  [['57%', '66%'], ['79%', '18%'], ['31%', '24%'], ['15%', '70%'], ['62%', '42%']],
  [['6%', '38%'], ['31%', '74%'], ['58%', '22%'], ['82%', '53%'], ['44%', '69%']],
  [['88%', '62%'], ['63%', '16%'], ['28%', '51%'], ['52%', '76%'], ['11%', '25%']],
] as const

function stableHash(input: string): number {
  let hash = 2166136261
  for (const char of input) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function flightRouteStyleFor(id: string, index: number) {
  const hash = stableHash(`${id}:${index}`)
  const routeIndex = (hash + index * 5) % routes.length
  const route = routes[routeIndex]
  const size = 0.74 + ((hash >>> 3) % 7) * 0.055
  const duration = 17 + ((hash >>> 7) % 11)
  const delay = -(((hash >>> 11) % 240) / 10)
  const direction = (hash >>> 17) % 2 === 0 ? 1 : -1

  return {
    routeIndex,
    className: `flight-route-${routeIndex}`,
    style: {
      '--flight-delay': `${delay - index * 1.35}s`,
      '--flight-duration': `${duration}s`,
      '--flight-size': size.toFixed(2),
      '--flip-a': `${direction}`,
      '--flip-b': `${direction * -1}`,
      '--route-x0': route[0][0],
      '--route-y0': route[0][1],
      '--route-x1': route[1][0],
      '--route-y1': route[1][1],
      '--route-x2': route[2][0],
      '--route-y2': route[2][1],
      '--route-x3': route[3][0],
      '--route-y3': route[3][1],
      '--route-x4': route[4][0],
      '--route-y4': route[4][1],
    },
  }
}
