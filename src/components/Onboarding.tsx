import { useEffect, useRef, useState } from 'react'
import type { GoalSuggestion } from '../data/goalSuggestions'
import type { StarterGoal } from '../hooks/useGardenState'
import { ARRIVAL_HASH } from '../lib/hosting'
import { Butterfly } from './Butterfly'
import { readBackupFile, sealedKind } from '../lib/backupFile'
import { balancedSuggestions } from '../lib/goalSuggestions'
import { isAndroidApp } from '../lib/platform'
import { STARTER_COMPANION_NAME } from '../lib/progression'
import { ProtectedRestore } from './backup/ProtectedRestore'
import './goals/goals.css'

/** The most starter goals a new garden begins with: a few, never a list. */
export const MAX_STARTER_GOALS = 3

/** One idea from each part of wellbeing, so the choice is a mix. */
const STARTER_IDEAS = balancedSuggestions([], 0, 6)

/**
 * Where the garden lives and how to keep a copy, in one sentence, naming the
 * Settings button exactly as it reads on this platform.
 */
function whereItLives(): string {
  return isAndroidApp()
    ? 'Your garden lives only in this app on this phone, so now and then open Settings and choose Save a backup to keep a copy somewhere safe.'
    : 'Your garden lives only in this browser on this device, so now and then open Settings and choose Download a backup to keep a copy somewhere safe.'
}

export function Onboarding({
  onComplete,
  onRestore,
  arriving = false,
  movedTo,
}: {
  /** Make the garden, with the starter goals chosen (none, if skipped). */
  onComplete: (name: string, gardenName: string, starterGoals: StarterGoal[]) => void
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
  /** A protected backup chosen to restore, waiting for its passphrase. */
  const [sealedChoice, setSealedChoice] = useState<string>()
  const restoreInput = useRef<HTMLInputElement>(null)
  const [starters, setStarters] = useState<GoalSuggestion[]>([])
  const startersFull = starters.length >= MAX_STARTER_GOALS
  // Each step replaces the one before, button and all, so focus is taken to
  // the new step's heading rather than left to fall to the page.
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (step > 0) heading.current?.focus()
  }, [step])
  const toggleStarter = (idea: GoalSuggestion) =>
    setStarters((chosen) =>
      chosen.includes(idea)
        ? chosen.filter((item) => item !== idea)
        : chosen.length < MAX_STARTER_GOALS
          ? [...chosen, idea]
          : chosen,
    )

  const restoreText = async (text: string) => {
    if (!onRestore) return
    const result = await onRestore(text)
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

  const restore = async (file: File) => {
    if (!onRestore) return
    setRestoreNote(undefined)
    const chosen = await readBackupFile(file)
    if (!chosen.ok) {
      setRestoreNote(chosen.message)
      return
    }
    // A protected backup asks for its passphrase, and a locked garden's copy
    // for its passcode or recovery code; then each restores as any other.
    if (sealedKind(chosen.text)) setSealedChoice(chosen.text)
    else await restoreText(chosen.text)
  }

  return (
    <main className="onboarding-shell">
      <section
        className={`onboarding-card ${step === 3 ? 'lesson-card' : ''}`}
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
                      ref={restoreInput}
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
                  {sealedChoice !== undefined && (
                    <ProtectedRestore
                      text={sealedChoice}
                      next="arrive"
                      returnFocus={() => restoreInput.current}
                      onOpened={(plain) => {
                        setSealedChoice(undefined)
                        void restoreText(plain)
                      }}
                      onClose={(message) => {
                        setSealedChoice(undefined)
                        setRestoreNote(message)
                      }}
                    />
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
            <h1 id="welcome-title" ref={heading} tabIndex={-1}>
              What shall we call this place?
            </h1>
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
        ) : step === 2 ? (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              setStep(3)
            }}
          >
            <p className="eyebrow">A small start</p>
            <h1 id="welcome-title" ref={heading} tabIndex={-1}>
              Anything to care for each day?
            </h1>
            <p>
              Choose up to three small things to do each day, if any appeal.
              Each has a two-minute version for days that ask for less. You can
              change them, or add your own, on Today.
            </p>
            <fieldset className="starter-goals" aria-describedby="starter-goals-note">
              <legend>Starter goals</legend>
              {STARTER_IDEAS.map((idea) => {
                const chosen = starters.includes(idea)
                return (
                  <label key={idea.title} className="starter-goal">
                    <input
                      type="checkbox"
                      checked={chosen}
                      disabled={!chosen && startersFull}
                      onChange={() => toggleStarter(idea)}
                    />
                    <span>
                      {idea.title}{' '}
                      {idea.tinyTitle && <small>Two minutes: {idea.tinyTitle}</small>}
                    </span>
                  </label>
                )
              })}
            </fieldset>
            <p className="starter-goals-note" id="starter-goals-note" role="status">
              {startersFull ? 'Three is plenty to begin with.' : ''}
            </p>
            <div className="onboarding-choices">
              <button className="primary-button" type="submit">
                Continue
              </button>
              <button
                className="primary-button"
                type="button"
                onClick={() => {
                  setStarters([])
                  setStep(3)
                }}
              >
                Skip for now
              </button>
            </div>
          </form>
        ) : (
          <div className="garden-lesson">
            <p className="eyebrow">Marigold’s garden guide</p>
            <h1 id="welcome-title" ref={heading} tabIndex={-1}>
              Here is how your sanctuary grows
            </h1>
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
            <p className="onboarding-data-note">{whereItLives()}</p>
            <button
              className="primary-button"
              onClick={() =>
                onComplete(
                  name,
                  gardenName,
                  starters.map(({ title, tinyTitle }) => ({ title, tinyTitle })),
                )
              }
            >
              Plant my first seeds
            </button>
          </div>
        )}
      </section>
    </main>
  )
}
