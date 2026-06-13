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
      <section className="onboarding-card" aria-labelledby="welcome-title">
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
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              onComplete(name, gardenName)
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
            <div className="chrysalis-note">
              <span className="chrysalis small" aria-hidden="true" />
              <p>
                A monarch chrysalis is waiting. Sol will emerge in about three
                days, even if you take a break.
              </p>
            </div>
            <button className="primary-button" type="submit">
              Plant my first seeds
            </button>
          </form>
        )}
      </section>
    </main>
  )
}
