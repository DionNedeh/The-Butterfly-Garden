import { useState } from 'react'
import { Butterfly } from './Butterfly'

export function Onboarding({
  onComplete,
}: {
  onComplete: (name: string, gardenName: string) => void
}) {
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [gardenName, setGardenName] = useState('Sunlit Sanctuary')

  return (
    <main className="onboarding-shell">
      <section
        className={`onboarding-card ${step === 2 ? 'lesson-card' : ''}`}
        aria-labelledby="welcome-title"
      >
        <div className="onboarding-art">
          <Butterfly
            speciesId="monarch"
            label="Marigold, a monarch butterfly"
            className="marigold"
          />
        </div>
        {step === 0 ? (
          <>
            <p className="eyebrow">A quiet place to begin</p>
            <h1 id="welcome-title">Welcome to your butterfly garden</h1>
            <p>
              I am Marigold. As you care for yourself, we will grow a living
              sanctuary together. Nothing here wilts when you need time away.
            </p>
            <button className="primary-button" onClick={() => setStep(1)}>
              Enter the garden
            </button>
          </>
        ) : step === 1 ? (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              setStep(2)
            }}
          >
            <p className="eyebrow">Make it yours</p>
            <h1 id="welcome-title">What shall we call this place?</h1>
            <label>
              Your name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Gardener"
                autoComplete="name"
              />
            </label>
            <label>
              Garden name
              <input
                value={gardenName}
                onChange={(event) => setGardenName(event.target.value)}
                required
              />
            </label>
            <button className="primary-button" type="submit">
              Meet your garden guide
            </button>
          </form>
        ) : (
          <div className="garden-lesson">
            <p className="eyebrow">Marigold’s garden guide</p>
            <h1 id="welcome-title">Here is how your sanctuary grows</h1>
            <p className="marigold-speech">
              Welcome, {name.trim() || 'Gardener'}! I will help you tend{' '}
              {gardenName}. Three gentle things work together here:
            </p>
            <div className="lesson-grid">
              <article>
                <span className="chrysalis small" aria-hidden="true" />
                <div>
                  <h2>Chrysalises</h2>
                  <p>
                    A butterfly’s “cocoon” is properly called a chrysalis.
                    Caterpillars form one after receiving care, then transform
                    safely inside. Missed days never harm them.
                  </p>
                </div>
              </article>
              <article>
                <Butterfly
                  speciesId="monarch"
                  label="A newly emerged monarch"
                  className="lesson-butterfly"
                />
                <div>
                  <h2>Emerging butterflies</h2>
                  <p>
                    After about three real days, the butterfly emerges. You will
                    welcome it by name, add its field note, and may choose it as
                    the companion flying through your garden.
                  </p>
                </div>
              </article>
              <article>
                <span className="lesson-seed" aria-hidden="true">●</span>
                <div>
                  <h2>Seeds and host plants</h2>
                  <p>
                    Care activities earn Sunlight, and your first Sunlight each
                    day brings one seed. You begin with two seeds, and every
                    emerging butterfly brings two more. Each seed adds one new
                    plant; mature host plants welcome matching caterpillars.
                  </p>
                </div>
              </article>
            </div>
            <div className="chrysalis-note">
              <span className="chrysalis small" aria-hidden="true" />
              <p>
                Sol’s monarch chrysalis is already waiting. They will emerge in
                about three days, even if you take a break.
              </p>
            </div>
            <button
              className="primary-button"
              onClick={() => onComplete(name, gardenName)}
            >
              Plant my first seeds
            </button>
          </div>
        )}
      </section>
    </main>
  )
}
