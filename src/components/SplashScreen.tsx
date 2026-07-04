import { ButterflySprite } from './sprites/ButterflySprite'

const splashFlyers = [
  { speciesId: 'monarch', top: '22%', duration: 3.4, delay: 0, size: 64 },
  { speciesId: 'blue-morpho', top: '38%', duration: 4.1, delay: 0.5, size: 52 },
  { speciesId: 'tiger-swallowtail', top: '54%', duration: 3.7, delay: 1.1, size: 58 },
  { speciesId: 'spring-azure', top: '30%', duration: 4.6, delay: 1.6, size: 38 },
  { speciesId: 'painted-lady', top: '64%', duration: 3.9, delay: 2.2, size: 46 },
]

/**
 * Boot splash: a stream of butterflies crosses the screen while the
 * garden wakes up from IndexedDB.
 */
export function SplashScreen() {
  return (
    <main className="splash-screen" aria-label="The Butterfly Garden is loading">
      <div className="splash-flyway" aria-hidden="true">
        {splashFlyers.map((flyer) => (
          <span
            key={flyer.speciesId}
            className="splash-flyer"
            style={{
              top: flyer.top,
              animationDuration: `${flyer.duration}s`,
              animationDelay: `${flyer.delay}s`,
            }}
          >
            <ButterflySprite speciesId={flyer.speciesId} size={flyer.size} />
          </span>
        ))}
      </div>
      <div className="splash-title">
        <h1>The Butterfly Garden</h1>
        <p>Waking the garden…</p>
        <span className="splash-shimmer" aria-hidden="true" />
      </div>
    </main>
  )
}
