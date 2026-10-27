import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BREATH_IN_SECONDS,
  BREATH_OUT_SECONDS,
  breathPatterns,
  SESSION_MINUTES,
  type SessionMinutes,
} from '../data/breathing'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { breathOutcome, pacerFor, type BreathOutcome } from '../lib/breathing'
import {
  choicesFromDraft,
  choicesToDraft,
  FOLDED,
  FOLDED_CALM,
  nextChangeAt,
  phaseAt,
  planSession,
  stepsFor,
  timingsLine,
  toneOn,
  turnsBetween,
  wingFrames,
  type BreathChoices,
  type BreathPhase,
  type BreathSession,
} from '../lib/breathPacer'
import { openBreathTone, type BreathTone } from '../lib/breathTone'
import { toLocalDate } from '../lib/date'
import { useDraft } from '../lib/drafts'
import { motionPreference } from '../lib/motion'
import { getSpecies } from '../lib/progression'
import { soundVolumeOf } from '../lib/sound'
import type { AppState, AppView } from '../types'
import { Icon } from './Icons'
import { ButterflySprite } from './sprites/ButterflySprite'
import './breathe/breathe.css'

/** Where the gardener's choices are kept between visits, on this device. */
const CHOICES_DRAFT = 'breathing-choices'

/** How far ahead of the clock each turn's tone is queued. */
const TONE_LOOKAHEAD_MS = 2000

/**
 * How late a turn's tone may still sound: the first, at the very start, is
 * always a moment past by the time it is queued.
 */
const TONE_GRACE_MS = 250

/**
 * A moment past each change, so a timer that fires a hair early still finds
 * the new count rather than the old one again.
 */
const TICK_SLACK_MS = 15

/** What the page's own back button says, for the page that offered it. */
const BACK_LABELS: Partial<Record<AppView, string>> = {
  today: 'Back to Today',
  support: 'Back to support',
}

/** What finishing said about today's care. */
const OUTCOME_WORDS: Record<BreathOutcome, string> = {
  counts: 'That counts as care today.',
  counted: 'Already counted today.',
  full: 'Today’s Sunlight is already full, so this one is just for you.',
}

/** A session under way: its timings, when it began, and its tone, if any. */
interface Run {
  session: BreathSession
  /** On the same clock as `performance.now()` and the document's timeline. */
  startedAt: number
  tone?: BreathTone
}

type Status = 'ready' | 'running' | 'stopped' | 'done'

const secondsLabel = (seconds: number) => `${seconds} seconds`
const minutesLabel = (minutes: SessionMinutes) =>
  minutes === 1 ? '1 minute' : `${minutes} minutes`

/** Every whole second from `min` to `max`. */
const secondsFrom = (min: number, max: number) =>
  Array.from({ length: max - min + 1 }, (_, index) => min + index)

/**
 * Start both wings on one breath, on the compositor. Each wing is its own
 * layer of the sprite (SpriteFrame), and only its transform moves. They
 * share the session's start time, so however late they are made, they are
 * where the count is.
 */
function animateWings(
  box: HTMLElement | null,
  session: BreathSession,
  folded: number,
  startedAt: number,
): Animation[] {
  const wings = Array.from(box?.querySelectorAll<SVGSVGElement>('.wing') ?? [])
  if (wings.length === 0 || typeof wings[0].animate !== 'function') return []
  const frames = wingFrames(session, folded)
  return wings.map((wing) => {
    const animation = wing.animate(frames, {
      duration: session.cycleMs,
      iterations: session.breaths,
    })
    animation.startTime = startedAt
    return animation
  })
}

/**
 * Breathing with a butterfly (plan c.1): a calming exercise in which the
 * active companion's wings, or Marigold's, open as the gardener breathes in
 * and close as they breathe out, with the count beside them.
 *
 * One clock drives everything. The wings are a Web Animations timeline built
 * once per session; the count is asked for once a second, when it changes;
 * the tone is queued a moment ahead. With reduced motion the wings stay
 * still and the count, and the tone if chosen, carry it.
 *
 * Stop is one tap, beneath the count and never over it, and brought into
 * view above the dock as a session starts. Running a session to its end
 * counts as an act of care, once a day, through the usual Sunlight; stopping
 * early counts nothing and says nothing of it.
 */
export function BreathingView({
  state,
  onFinish,
  from,
  onBack,
}: {
  state: AppState
  /** Counts a session run to its end. Left out where the garden cannot save. */
  onFinish?: () => void
  /** The page that offered it, which the back button returns to. */
  from?: AppView
  onBack: () => void
}) {
  const profile = state.profile
  const pacer = pacerFor(state)
  const speciesName = getSpecies(pacer.speciesId)?.commonName

  const [draft, setDraft] = useDraft(CHOICES_DRAFT, '')
  const choices = useMemo(() => choicesFromDraft(draft), [draft])
  const choose = (change: Partial<BreathChoices>) =>
    setDraft(choicesToDraft(choicesFromDraft(JSON.stringify({ ...choices, ...change }))))
  const steps = useMemo(() => stepsFor(choices), [choices])
  const soundOn = profile?.ambientSound === true
  const tone = toneOn(choices, soundOn)

  // Still under the app's own setting or the system's; Calm moves less far.
  const systemStill = useMediaQuery('(prefers-reduced-motion: reduce)')
  const motion = motionPreference(profile)
  const still = systemStill || motion === 'reduce'
  const folded = motion === 'calm' ? FOLDED_CALM : FOLDED

  const [status, setStatus] = useState<Status>('ready')
  const [run, setRun] = useState<Run>()
  const [phase, setPhase] = useState<BreathPhase>()
  const [outcome, setOutcome] = useState<BreathOutcome>()
  const pacerBox = useRef<HTMLDivElement>(null)
  const countBox = useRef<HTMLDivElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const startButton = useRef<HTMLButtonElement>(null)
  const stopButton = useRef<HTMLButtonElement>(null)
  const doneHeading = useRef<HTMLHeadingElement>(null)

  const start = () => {
    const session = planSession(choices)
    // Made here, inside the tap: a browser lets a page start sound only from
    // a gesture, and one made a moment later could be held silent.
    const sessionTone = tone ? openBreathTone(soundVolumeOf(profile)) : undefined
    setRun({ session, startedAt: performance.now(), tone: sessionTone })
    setPhase(phaseAt(session, 0))
    setOutcome(undefined)
    setStatus('running')
  }

  const stop = () => {
    run?.tone?.close()
    setRun(undefined)
    setPhase(undefined)
    setStatus('stopped')
  }

  // The session's end, as it is when the clock gets there: what today's care
  // already holds is read then, just before the session is counted.
  const finish = () => {
    run?.tone?.close()
    setOutcome(onFinish ? breathOutcome(state, toLocalDate()) : undefined)
    onFinish?.()
    setRun(undefined)
    setPhase(undefined)
    setStatus('done')
  }
  const finishLatest = useRef(finish)
  useEffect(() => {
    finishLatest.current = finish
  })

  // The count, once a second, and each turn's tone a moment ahead. A timer
  // late from a hidden page is simply asked again, and is right; a turn it
  // passed is let go rather than sounded late.
  useEffect(() => {
    if (!run) return
    const { session, startedAt } = run
    let timer: number | undefined
    let tonesUntil = 0
    const sound = (elapsed: number) => {
      if (!run.tone) return
      const since = Math.max(tonesUntil, elapsed - TONE_GRACE_MS)
      tonesUntil = elapsed + TONE_LOOKAHEAD_MS
      for (const turn of turnsBetween(session, since, tonesUntil)) {
        run.tone.play((turn.atMs - elapsed) / 1000, turn.step.kind)
      }
    }
    const wait = (elapsed: number) => {
      window.clearTimeout(timer)
      timer = window.setTimeout(tick, nextChangeAt(session, elapsed) - elapsed + TICK_SLACK_MS)
    }
    function tick() {
      const elapsed = performance.now() - startedAt
      const now = phaseAt(session, elapsed)
      if (now.finished) {
        window.clearTimeout(timer)
        finishLatest.current()
        return
      }
      setPhase(now)
      sound(elapsed)
      wait(elapsed)
    }
    const elapsed = performance.now() - startedAt
    sound(elapsed)
    wait(elapsed)
    const seen = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', seen)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', seen)
    }
  }, [run])

  // The wings, only while motion is allowed. Made against the session's own
  // start, so a change of setting mid-session picks up exactly in step.
  useEffect(() => {
    if (!run || still) return
    const animations = animateWings(pacerBox.current, run.session, folded, run.startedAt)
    return () => animations.forEach((animation) => animation.cancel())
  }, [run, still, folded])

  // Leaving closes a tone still sounding: the back button, Escape, Android's
  // back gesture or any other page.
  const runTone = useRef<BreathTone | undefined>(undefined)
  useEffect(() => {
    runTone.current = run?.tone
  }, [run])
  useEffect(() => {
    const held = runTone
    return () => held.current?.close()
  }, [])

  // Arriving, focus is on the page's name; then on whatever replaced the
  // button just pressed, so it never falls to the page.
  //
  // A session starting moves the page as little as it can: the count is
  // brought out from under the header, then Stop clear of the dock (the
  // page's scroll-padding, breathe.css), each only if it is not already in
  // view. Focus alone would centre Stop, which on a short screen can take the
  // count, the only pacer with the wings still, up under the header.
  useEffect(() => {
    if (status === 'running') {
      stopButton.current?.focus({ preventScroll: true })
      countBox.current?.scrollIntoView({ block: 'nearest' })
      stopButton.current?.scrollIntoView({ block: 'nearest' })
    } else if (status === 'stopped') startButton.current?.focus()
    else if (status === 'done') doneHeading.current?.focus()
    else heading.current?.focus()
  }, [status])

  // Escape leaves, as Android's back gesture does, unless a dialog (the
  // phone's More sheet) is open and takes it.
  const backLatest = useRef(onBack)
  useEffect(() => {
    backLatest.current = onBack
  }, [onBack])
  useEffect(() => {
    const leave = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      if (document.querySelector('dialog[open]')) return
      backLatest.current()
    }
    document.addEventListener('keydown', leave)
    return () => document.removeEventListener('keydown', leave)
  }, [])

  const running = status === 'running'
  const backLabel = (from && BACK_LABELS[from]) ?? 'Back to the garden'
  const outMin = Math.max(
    BREATH_OUT_SECONDS.min,
    choices.pattern === 'slow' ? choices.inSeconds : BREATH_OUT_SECONDS.min,
  )

  return (
    <div className="view breathe-view">
      <header className="page-header">
        <div>
          <p className="eyebrow">A calming exercise</p>
          <h1 ref={heading} tabIndex={-1}>
            Breathe with {pacer.name}
          </h1>
          <p>
            {still
              ? 'Follow the count: breathe in while it says In, and out while it says Out.'
              : `Breathe in as ${pacer.name}’s wings open, and out as they close.`}
          </p>
        </div>
        <button className="secondary-button" onClick={onBack}>
          {backLabel}
        </button>
      </header>

      <section className="card breath-card" aria-label="Breathing pacer">
        <div className="breath-stage">
          <div
            ref={pacerBox}
            className={`breath-pacer${still ? '' : ' breath-moving'}`}
            style={{ ['--breath-folded' as string]: folded }}
          >
            <ButterflySprite
              speciesId={pacer.speciesId}
              label={speciesName ? `${pacer.name}, ${speciesName}` : pacer.name}
              size={150}
              flapping={false}
            />
          </div>
          <div ref={countBox} className="breath-count-box">
            {running && phase ? (
              // Seen, not read out each second: the step is read out below.
              <p className="breath-count" aria-hidden="true">
                <span className="breath-cue">{phase.step.cue}…</span>{' '}
                <span className="breath-number">{phase.count}</span>
              </p>
            ) : (
              <p className="breath-timings">{timingsLine(steps)}</p>
            )}
            <p className="sr-only" aria-live="polite">
              {running && phase ? phase.step.cue : ''}
            </p>
          </div>
        </div>

        {status === 'done' && (
          <div className="breath-done">
            <h2 ref={doneHeading} tabIndex={-1}>
              All done
            </h2>
            <p>
              {still ? '' : `${pacer.name} rests, wings folded. `}Take your time before you
              move on.
            </p>
            {outcome && (
              <p className="breath-counted">
                <Icon name="sun" size={18} />
                {OUTCOME_WORDS[outcome]}
              </p>
            )}
          </div>
        )}

        <div className="breath-actions">
          {running ? (
            <button ref={stopButton} className="primary-button breath-stop" onClick={stop}>
              Stop
            </button>
          ) : (
            <button ref={startButton} className="primary-button" onClick={start}>
              {status === 'done' ? 'Breathe again' : 'Start breathing'}
            </button>
          )}
        </div>
        <p className="breath-note" role="status">
          {status === 'stopped' ? 'Stopped. Come back whenever you like.' : ''}
        </p>
        <p className="breath-safety">If you feel light-headed, breathe normally.</p>
      </section>

      {!running && (
        <section className="card breath-settings" aria-labelledby="breath-settings-title">
          <h2 id="breath-settings-title">Your breath</h2>
          <fieldset className="motion-options">
            <legend>Pattern</legend>
            {breathPatterns.map((pattern) => (
              <label className="toggle-row" key={pattern.id}>
                <span>
                  <strong>{pattern.name}</strong>
                  <small>{pattern.description}</small>
                </span>
                <input
                  type="radio"
                  name="breath-pattern"
                  value={pattern.id}
                  checked={choices.pattern === pattern.id}
                  onChange={() => choose({ pattern: pattern.id })}
                />
              </label>
            ))}
          </fieldset>

          <div className="breath-timing-fields">
            {choices.pattern === 'slow' && (
              <label>
                Breathe in
                <select
                  value={choices.inSeconds}
                  onChange={(event) => choose({ inSeconds: Number(event.target.value) })}
                >
                  {secondsFrom(BREATH_IN_SECONDS.min, BREATH_IN_SECONDS.max).map((seconds) => (
                    <option key={seconds} value={seconds}>
                      {secondsLabel(seconds)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Breathe out
              <select
                value={choices.outSeconds}
                onChange={(event) => choose({ outSeconds: Number(event.target.value) })}
              >
                {secondsFrom(outMin, BREATH_OUT_SECONDS.max).map((seconds) => (
                  <option key={seconds} value={seconds}>
                    {secondsLabel(seconds)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="subtle-copy breath-hint">
            The breath out is never shorter than the breath in, and nothing is held.
          </p>

          <fieldset className="breath-lengths">
            <legend>How long</legend>
            {SESSION_MINUTES.map((minutes) => (
              <label className="breath-length" key={minutes}>
                <input
                  type="radio"
                  name="breath-minutes"
                  value={minutes}
                  checked={choices.minutes === minutes}
                  onChange={() => choose({ minutes })}
                />
                {minutesLabel(minutes)}
              </label>
            ))}
          </fieldset>

          <label className="toggle-row">
            <span>
              <strong>A soft tone at each turn</strong>
              <small>Quiet, at your sound volume. Handy with your eyes closed.</small>
            </span>
            <input
              type="checkbox"
              checked={tone}
              onChange={(event) => choose({ tone: event.target.checked })}
            />
          </label>
        </section>
      )}
    </div>
  )
}
