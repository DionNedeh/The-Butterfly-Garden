import { useState } from 'react'
import { ARRIVAL_HASH } from '../lib/hosting'
import { Butterfly } from './Butterfly'
import { MAX_BACKUP_BYTES } from './SafeMode'
import { STARTER_COMPANION_NAME } from '../lib/progression'

export function Onboarding({
  onComplete,
  onRestore,
  arriving = false,
  movedTo,
}: {
  onComplete: (name: string, gardenName: string) => void
  /** Bring a garden in from a backup instead of starting a new one. */
  onRestore?: (text: string) => Promise<{ ok: boolean; message: string }>
  /** Opened from the old address to receive a garden (lib/hosting). */
  arriving?: boolean
  /** Set only at an old address: where the garden lives now. */
  movedTo?: URL
}) {
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [gardenName, setGardenName] = useState('Sunlit Sanctuary')
  const [restoreOpen, setRestoreOpen] = useState(arriving)
  const [restoreNote, setRestoreNote] = useState<string>()

  const restore = async (file: File) => {
    if (!onRestore) return
    setRestoreNote(undefined)
    if (file.size > MAX_BACKUP_BYTES) {
      setRestoreNote('That file is too large to be a garden backup.')
      return
    }
    const result = await onRestore(await file.text())
    if (result.ok && window.location.hash === ARRIVAL_HASH) {
      // Arrived and restored: the address no longer needs to say so.
      window.history.replaceState(
        null,
        '',
        window.location.pathname + window.location.search,
      )
    }
    // On success the garden opens, so only a refusal stays to be read.
    if (!result.ok) setRestoreNote(result.message)
  }

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
            {movedTo && (
              <p className="moved-note" role="note">
                The garden now lives at{' '}
                <a href={movedTo.href}>{movedTo.host}</a>. If you have been
                growing one there, it is waiting for you.
              </p>
            )}
            <button className="primary-button" onClick={() => setStep(1)}>
              Enter the garden
            </button>
            {onRestore &&
              (restoreOpen ? (
                <div className="onboarding-restore">
                  <p>
                    {arriving
                      ? 'Welcome to the garden’s new home. Choose the backup you just saved, and everything you have grown comes with you.'
                      : 'Bring a garden here from a backup file, from another device or another browser.'}
                  </p>
                  <label className="secondary-button file-button">
                    Choose a backup
                    <input
                      type="file"
                      accept="application/json,.json,text/plain,application/octet-stream"
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        event.target.value = ''
                        if (file) void restore(file)
                      }}
                    />
                  </label>
                  {restoreNote && (
                    <p className="settings-note error" role="status">
                      {restoreNote}
                    </p>
                  )}
                </div>
              ) : (
                <button
                  className="text-button"
                  onClick={() => setRestoreOpen(true)}
                >
                  I have a backup
                </button>
              ))}
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
                maxLength={60}
              />
            </label>
            <label>
              Garden name
              <input
                value={gardenName}
                onChange={(event) => setGardenName(event.target.value)}
                maxLength={60}
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
                  <h2>Four stages of life</h2>
                  <p>
                    Egg, caterpillar, chrysalis, butterfly. Visit the Care page
                    and tend each little one — feed, bathe, play, keep warm.
                    Three days of care (they never need to be in a row) carries
                    them to the next stage. Missed days never harm them.
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
                  <h2>Companions for life</h2>
                  <p>
                    When a butterfly emerges, the care continues: share nectar,
                    groom wings, fly together, and dress them from the
                    boutique. Every day of care deepens your bond and earns
                    rewards.
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
                    plant; mature host plants reveal butterfly eggs.
                  </p>
                </div>
              </article>
            </div>
            <div className="chrysalis-note">
              <span className="chrysalis small" aria-hidden="true" />
              <p>
                {STARTER_COMPANION_NAME}, your monarch caterpillar, is already
                waiting on the Care page — with fresh leaves packed in your
                satchel.
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
