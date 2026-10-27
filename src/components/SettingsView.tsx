import { BackdropGallery, type BackdropActions } from './BackdropGallery'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { ambientTrackDescriptions } from '../data/ambientTrackDescriptions'
import { ambientTracks, DEFAULT_AMBIENT_TRACK_ID } from '../data/ambientTracks'
import type { PersistenceStatus } from '../hooks/useGardenState'
import { previewBackup, type BackupPreview } from '../lib/backupPreview'
import { backupReminder } from '../lib/backupReminder'
import {
  formatHour,
  formatJournalDate,
  RECAP_GRACE_CHOICES,
  RECAP_OPENS_CHOICES,
  recapHoursOf,
  type RecapHours,
} from '../lib/date'
import { datedFileName, saveTextFile } from '../lib/download'
import { canShareFile, shareTextFile } from '../lib/shareFile'
import type { FileCopy } from '../lib/sightingPhotos'
import { isAndroidApp } from '../lib/platform'
import {
  formatBytes,
  requestPersistentStorage,
  storageStatus,
  type StorageStatus,
} from '../lib/storage'
import { homeScreenAdvice } from '../lib/install'
import { MAX_SIGHTING_PHOTOS, photosIn } from '../lib/customBackdrops'
import { isSealedBackup, readBackupFile } from '../lib/backupFile'
import { managePassSubscription, type PassStatus } from '../lib/playBilling'
import { usePassStatus } from '../hooks/usePassStatus'
import { FADE_OUT_CHOICES, type FadeOutMinutes } from '../hooks/useFadeOut'
import type {
  AmbientTrackId,
  AppState,
  GardenBackdropId,
  GardenPace,
  RegionId,
  TextSize,
} from '../types'
import { motionPreference, type MotionPreference } from '../lib/motion'
import { eveningNightHours, themeChoiceOf, type ThemeChoice } from '../lib/theme'
import { counted } from '../lib/plural'
import { keepsGiving, REBLOOM_CARE_DAYS } from '../lib/gardenPace'
import { releaseName } from '../data/currentRelease'
import { soundVolumeOf } from '../lib/sound'
import { SoundSwitches, SoundVolume } from './SoundControls'
import { GuideLink } from './GuideLink'
import { RegionSetting } from './RegionSetting'
import { ReminderSetting } from './ReminderSetting'
import { LetterSetting } from './LetterSetting'
import { ComfortLink } from './ComfortLink'
import { LockSettings } from './lock/LockSettings'
import { useLockState } from '../hooks/useLockState'
import { letterQuotesOf, type LetterQuotes } from '../lib/letters'
import { ProtectedRestore } from './backup/ProtectedRestore'
import './settings.css'

// Making a protected backup loads its dialog, and the code that locks the
// file, only when it is asked for.
const ProtectedBackupDialog = lazy(() =>
  import('./backup/ProtectedBackupDialog').then((m) => ({ default: m.ProtectedBackupDialog })),
)

/** The Garden Pass card's one-line answer, from Google Play's latest. */
function passSummary(status: PassStatus): string {
  switch (status.state) {
    case 'checking':
      return 'Checking with Google Play…'
    case 'unasked':
      return 'Open the Garden Pass to check your subscription with Google Play.'
    case 'active':
      return status.fromCache
        ? 'Your Garden Pass is open. Google Play will confirm it again once it can be reached.'
        : 'Your Garden Pass is open.'
    case 'pending':
      return 'Google Play is still processing your payment.'
    case 'suspended':
      return 'Your Garden Pass is on hold because Google Play could not take the last payment.'
    case 'inactive':
      return 'You do not have a Garden Pass. Everything else in the garden is free.'
    case 'unavailable':
      return 'Google Play cannot be reached right now.'
    case 'unconfigured':
      return 'The Garden Pass is not set up in this version of the app yet.'
  }
}

/**
 * Optional inline note rendered beneath the name field.
 *
 * Deliberate, and harmless: a small personal message the author left for a
 * few particular names, kept out of plain sight so it stays a surprise.
 * Each entry is an FNV-1a hash of a folded name and its note, XOR-encoded
 * against that hash (see noteForName). Nothing here reads, stores or sends
 * anything; e2e/app.spec.ts checks the notes from fixtures encoded alike.
 */
const nameNotes: ReadonlyArray<readonly [number, readonly number[]]> = [
  [
    0xd9b9523f,
    [
      21106, 55768, 21083, 55772, 21023, 55758, 21078, 55757, 21079, 55705,
      30043, 10166, 21023, 55700, 21023, 55786,
    ],
  ],
  [
    0xaee8413c,
    [
      16753, 44681, 16728, 44685, 16668, 44703, 16725, 44700, 16724, 44744,
      26200, 20711, 16657, 44744, 16751,
    ],
  ],
  [0x3d8993e5, [37809, 15841, 37760, 15785, 37811, 15846, 37772, 15853]],
]

const MOTION_CHOICES: ReadonlyArray<{
  value: MotionPreference
  label: string
  description: string
}> = [
  {
    value: 'full',
    label: 'Full garden motion',
    description: 'Wings, plants and flight move as they were drawn to.',
  },
  {
    value: 'calm',
    label: 'Calm garden motion',
    description:
      'Slower wings and swaying, gentler flight, and only a few butterflies aloft. Kinder to older phones and batteries.',
  },
  {
    value: 'reduce',
    label: 'Reduce garden motion',
    description: 'Pause decorative swaying and butterfly flight.',
  },
]

/** The text sizes, from the usual one up; the usual one stores nothing. */
const TEXT_SIZE_CHOICES: ReadonlyArray<{
  value: TextSize | undefined
  label: string
  description: string
  /** The label itself is shown at the size it chooses, as a preview. */
  scale: string
}> = [
  {
    value: undefined,
    label: 'Comfortable',
    description: 'The garden’s usual size.',
    scale: '1em',
  },
  {
    value: 'larger',
    label: 'Larger',
    description: 'A little larger, everywhere.',
    scale: '1.125em',
  },
  {
    value: 'largest',
    label: 'Largest',
    description: 'Larger again, for easier reading.',
    scale: '1.25em',
  },
]

/** How the garden gives; Classic, the pace it has always had, stores nothing. */
const PACE_CHOICES: ReadonlyArray<{
  value: GardenPace | undefined
  label: string
  description: string
}> = [
  {
    value: undefined,
    label: 'Classic',
    description:
      'Each host plant can bring one egg, when it first blooms. Plant another to welcome more.',
  },
  {
    value: 'keep-giving',
    label: 'Keep giving',
    description: `A host plant in full bloom blooms again after ${REBLOOM_CARE_DAYS} more days of care, and can bring another egg each time.`,
  },
]

/** The theme choices, with what each does in words. */
function themeChoices(
  android: boolean,
  evening: { from: number; until: number },
): ReadonlyArray<{ value: ThemeChoice; label: string; description: string }> {
  return [
    {
      value: 'sunlight',
      label: 'Sunlight',
      description: 'The bright garden, day and night.',
    },
    { value: 'night', label: 'Night', description: 'The starry garden, day and night.' },
    {
      value: 'device',
      label: 'Follow device',
      description: `Night whenever this ${android ? 'phone' : 'device'} is set to dark.`,
    },
    {
      value: 'evening',
      label: 'Follow evening',
      description: `Night from ${formatHour(evening.from)}, when your evening starts, until ${formatHour(evening.until)}.`,
    },
  ]
}

/**
 * What the restore picker offers. On Android the system file picker filters
 * by the type each storage app reports, and some report a .json file as plain
 * text or unknown bytes, which would grey out a perfectly good backup. The
 * file's contents are checked on import either way.
 */
const BACKUP_ACCEPT = isAndroidApp()
  ? 'application/json,.json,text/plain,application/octet-stream'
  : 'application/json,.json'

function foldName(value: string): number {
  let hash = 2166136261
  for (const char of value) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function noteForName(value: string): string | undefined {
  const key = foldName(value.trim().toLowerCase())
  return nameNotes
    .find(([id]) => id === key)?.[1]
    .map((code, index) =>
      String.fromCodePoint(code ^ ((key >>> ((index % 2) * 16)) & 0xffff)),
    )
    .join('')
}

/** "10:45 pm" or "22:45", as the gardener's clock shows it. */
const fadeTimeFormat = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
})

export function SettingsView({
  state,
  persistence,
  onUpdateProfile,
  onSelectAmbientTrack,
  onSelectBackdrop,
  onExportGarden,
  onBackupMade,
  reminderAt,
  onImportGarden,
  onUndoRestore,
  onDownloadSetAside,
  onDiscardSetAside,
  onCountSetAside,
  onDeleteAll,
  onOpenWhatsNew,
  onOpenPrivacy,
  onOpenNotices,
  onOpenSupport,
  onOpenComfort,
  onSetDayCountsHidden,
  onSetRecapHours,
  onChooseTheme,
  onSetTextSize,
  onSetGardenPace,
  fadeOutMinutes,
  fadeOutEndsAt,
  onChooseFadeOut,
  heardTrackId,
  onSetSoundVolume,
  onHearSoundVolume,
  onSetSoundFollowsTheme,
  onSetSoundInBackground,
  onOpenGardenPass,
  onSaveCustomBackdrop,
  onDeleteCustomBackdrop,
  onSelectCustomBackdrop,
  onSetRegion,
  onOpenGuide,
  onChooseNightBackdrop,
  onSetReminderTime,
  onSetLetterQuotes,
}: {
  state: AppState
  persistence: PersistenceStatus
  onUpdateProfile: (
    name: string,
    gardenName: string,
    motion: MotionPreference,
  ) => void
  onSelectAmbientTrack: (trackId: AmbientTrackId) => void
  onSelectBackdrop: (backdropId: GardenBackdropId) => void
  /**
   * The backup's text, at once or once its photos are read (a sighting's
   * photo is a Blob), with a word on any photo that could not be read.
   * Undefined while the garden is read-only: see useGardenState.
   */
  onExportGarden: () => FileCopy | undefined | Promise<FileCopy | undefined>
  /** A backup reached the gardener; `madeAt` is when it was exported. */
  onBackupMade?: (madeAt: Date) => void
  /** When the backup reminder is judged; the app passes noon of the day. */
  reminderAt?: Date
  onImportGarden: (text: string) => Promise<{ ok: boolean; message: string }>
  onUndoRestore?: (
    snapshotId: string,
  ) => Promise<{ ok: boolean; message: string }>
  /** The newest set-aside copy of an unreadable garden, as file text. */
  onDownloadSetAside?: () => Promise<FileCopy | undefined>
  onDiscardSetAside?: () => Promise<void>
  /** How many set-aside copies are kept, to decide whether to mention them. */
  onCountSetAside?: () => Promise<number>
  onDeleteAll: () => Promise<{ ok: boolean; message?: string }>
  onOpenWhatsNew?: () => void
  onOpenPrivacy?: () => void
  onOpenNotices?: () => void
  onOpenSupport?: () => void
  /** The comfort plan, offered beside the support page. */
  onOpenComfort?: () => void
  onSetDayCountsHidden?: (hidden: boolean) => void
  onSetRecapHours?: (hours: RecapHours) => void
  /** Sunlight or Night by hand, or follow the device or the evening. */
  onChooseTheme?: (choice: ThemeChoice) => void
  /** A larger text size, or undefined for the usual one. */
  onSetTextSize?: (size: TextSize | undefined) => void
  /** Keep giving, or Classic again (undefined). */
  onSetGardenPace?: (pace: GardenPace | undefined) => void
  /** The soundscape's fade-out length for this visit, if one is chosen. */
  fadeOutMinutes?: FadeOutMinutes
  /** When the fade-out timer runs out, while it is running. */
  fadeOutEndsAt?: number
  onChooseFadeOut?: (minutes: FadeOutMinutes | undefined) => void
  /** The soundscape that plays now, if night has brought the piano. */
  heardTrackId?: AmbientTrackId
  /** Store a volume, 0 to 100. */
  onSetSoundVolume?: (volume: number) => void
  /** Hear a volume while it is being chosen, before it is stored. */
  onHearSoundVolume?: (volume: number) => void
  onSetSoundFollowsTheme?: (on: boolean) => void
  onSetSoundInBackground?: (on: boolean) => void
  onOpenGardenPass?: () => void
  onSaveCustomBackdrop?: BackdropActions['onSaveCustomBackdrop']
  onDeleteCustomBackdrop?: BackdropActions['onDeleteCustomBackdrop']
  onSelectCustomBackdrop?: BackdropActions['onSelectCustomBackdrop']
  /** Where the gardener gardens, for the Guide's native marks, or none. */
  onSetRegion?: (region: RegionId | undefined) => void
  /** Open the Guide at a section, from a "What does this do?" link. */
  onOpenGuide?: (section: string) => void
  onChooseNightBackdrop?: BackdropActions['onChooseNightBackdrop']
  /** Remember the time of the daily visit just added to the calendar. */
  onSetReminderTime?: (time: string) => void
  /** Whether Marigold's letters may quote starred lines, or never. */
  onSetLetterQuotes?: (quotes: LetterQuotes) => void
}) {
  const [name, setName] = useState(state.profile?.name ?? '')
  const [gardenName, setGardenName] = useState(state.profile?.gardenName ?? '')
  const [motion, setMotion] = useState<MotionPreference>(
    motionPreference(state.profile),
  )
  const [deleteStep, setDeleteStep] = useState(false)
  const [deleteError, setDeleteError] = useState<string>()
  const [backupNote, setBackupNote] = useState<string>()
  const [restoreStep, setRestoreStep] = useState(false)
  /** A chosen backup, read and described, waiting for the gardener's yes. */
  const [pendingRestore, setPendingRestore] = useState<
    BackupPreview & { text: string; protected?: boolean }
  >()
  /** A protected backup chosen to restore, waiting for its passphrase. */
  const [sealedChoice, setSealedChoice] = useState<string>()
  /** Making a protected backup: to save or download it, or to share it. */
  const [protecting, setProtecting] = useState<'save' | 'share'>()
  const previewHeading = useRef<HTMLHeadingElement>(null)
  const [restoring, setRestoring] = useState(false)
  /**
   * While a backup is being made: a field book full of photos takes a moment
   * to write out, and a second tap meanwhile would only start a second one.
   */
  const [preparing, setPreparing] = useState(false)
  const preparingRef = useRef(false)
  /** The undo offer the gardener dismissed, so it is not shown again. */
  const [undoDismissed, setUndoDismissed] = useState<string>()
  const [setAsideCount, setSetAsideCount] = useState(0)
  const [storage, setStorage] = useState<StorageStatus>()
  // The field book's photos, which every backup carries: how many, and their size.
  const fieldBookPhotos = photosIn(state.sightings)
  // The moment the backup reminder is worked out for: the app's own (noon of
  // the day, shared with the badge on Settings), or when the page opened.
  const [openedAt] = useState(() => new Date())
  const reminderNow = reminderAt ?? openedAt
  /**
   * Whether this browser can hand the backup file to another app. Asked once;
   * always false in the Android app, which has its own save screen.
   */
  const [canShareBackup] = useState(() =>
    canShareFile(datedFileName(''), 'application/json'),
  )
  /** iPhone and iPad, not yet on the Home Screen: how to put it there. */
  const [homeScreen] = useState(homeScreenAdvice)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Inline rather than isAndroidApp(): the bundler folds only an inline
  // check, which keeps the Android-only cards and Play calls out of the PWA.
  const android = import.meta.env.VITE_PLATFORM === 'android'
  const pass = usePassStatus()
  // A backup is the garden in the clear, lock or no lock: said beside the button.
  const locked = useLockState() === 'unlocked'
  const [passNote, setPassNote] = useState<string>()
  useEffect(() => {
    let active = true
    void onCountSetAside?.().then((count) => {
      if (active) setSetAsideCount(count)
    })
    if (!android) {
      void storageStatus().then((status) => {
        if (active) setStorage(status)
      })
    }
    return () => {
      active = false
    }
  }, [onCountSetAside, android])

  const backupMade = (madeAt: Date) => {
    onBackupMade?.(madeAt)
  }

  /**
   * The backup file, or undefined (and why) while it cannot be made. Making
   * it can fail (its photos are read from storage), and that is said too,
   * never left as a tap that did nothing.
   */
  const exportBackup = async (): Promise<FileCopy | undefined> => {
    preparingRef.current = true
    setPreparing(true)
    if (fieldBookPhotos.count > 0) setBackupNote('Getting your backup ready, photos and all…')
    try {
      const copy = await onExportGarden()
      if (copy === undefined)
        setBackupNote(
          'Saving a backup is paused while the stored garden cannot be read. Download the set-aside copy instead.',
        )
      return copy
    } catch {
      setBackupNote('Your backup could not be made just now, so nothing was saved. Please try again.')
      return undefined
    } finally {
      preparingRef.current = false
      setPreparing(false)
    }
  }

  /**
   * One button, the right way for each build. On Android the gardener picks
   * where the file goes, and Android reports whether it was written, so
   * success can be stated plainly. In a browser the download is the
   * browser's from the moment it starts: deliberately not "downloaded",
   * because claiming a success we cannot observe is how someone ends up
   * trusting a backup that was never written.
   */
  const saveBackup = async () => {
    if (preparingRef.current) return
    setBackupNote(undefined)
    const madeAt = new Date()
    const copy = await exportBackup()
    if (copy) await saveCopy(copy, madeAt)
  }

  /** Save a backup already made, and say how it went. */
  const saveCopy = async (copy: FileCopy, madeAt: Date, started = 'Backup started.') => {
    try {
      const outcome = await saveTextFile(
        datedFileName(''),
        'application/json',
        copy.text,
      )
      // A started download counts: the browser will not say whether it
      // finished, and asking again every visit would be the wrong answer to
      // that. Backing out of Android's save screen does not.
      if (outcome !== 'cancelled') backupMade(madeAt)
      setBackupNote(
        outcome === 'cancelled'
          ? 'No backup was saved.'
          : `${
              outcome === 'saved'
                ? 'Backup saved. Keep the file somewhere safe.'
                : `${started} Check your downloads and keep the file somewhere safe.`
            }${copy.leftOut ? ` ${copy.leftOut}` : ''}`,
      )
    } catch {
      setBackupNote(
        android
          ? 'The backup could not be saved there. Try choosing another place.'
          : 'This browser would not start the download.',
      )
    }
  }

  /** Hand the backup to an app the gardener picks: Files, a drive, a message. */
  const shareBackup = async () => {
    if (preparingRef.current) return
    setBackupNote(undefined)
    const madeAt = new Date()
    const copy = await exportBackup()
    if (!copy) return
    // A browser shares only close after a tap: a few seconds. Writing out a
    // field book full of photos can take longer on a slow phone, and then
    // the share would be refused; the file is downloaded instead, and said
    // so. (Not every browser can tell, and those are left to try.)
    const activation = (navigator as { userActivation?: UserActivation }).userActivation
    if (activation?.isActive === false) {
      await saveCopy(
        copy,
        madeAt,
        'Getting your backup ready took a while, so it was downloaded rather than shared.',
      )
      return
    }
    try {
      const outcome = await shareTextFile(
        datedFileName(''),
        'application/json',
        copy.text,
        'The Butterfly Garden backup',
      )
      // Closing the share sheet is a choice, not a failure: nothing to say,
      // and "getting it ready" is over.
      if (outcome === 'cancelled') {
        setBackupNote('')
        return
      }
      backupMade(madeAt)
      setBackupNote(
        `Backup shared. Keep the file somewhere safe.${copy.leftOut ? ` ${copy.leftOut}` : ''}`,
      )
    } catch {
      setBackupNote('This browser would not share the file. Download it instead.')
    }
  }

  const saveSetAside = async () => {
    setBackupNote(undefined)
    try {
      const copy = await onDownloadSetAside?.()
      if (!copy) {
        setBackupNote('There is no set-aside copy to download.')
        return
      }
      const outcome = await saveTextFile(
        datedFileName('set-aside-copy'),
        'application/json',
        copy.text,
      )
      setBackupNote(
        outcome === 'cancelled'
          ? 'No copy was saved.'
          : `Keep that file safe: it is the garden exactly as it was stored.${copy.leftOut ? ` ${copy.leftOut}` : ''}`,
      )
    } catch {
      setBackupNote('The set-aside copy could not be saved there.')
    }
  }

  /** Describe a backup's text; nothing is replaced yet. */
  const describeBackup = (text: string, sealed = false) => {
    const preview = previewBackup(text)
    if (!preview.ok) {
      setBackupNote(`That backup could not be restored. ${preview.problem ?? ''}`)
      return
    }
    setPendingRestore({ ...preview, text, protected: sealed })
  }

  /**
   * Read and describe the chosen file; nothing is replaced yet. A protected
   * backup asks for its passphrase first, then is described like any other.
   */
  const chooseBackup = async (file: File) => {
    setBackupNote(undefined)
    setPendingRestore(undefined)
    const chosen = await readBackupFile(file)
    if (!chosen.ok) {
      setBackupNote(chosen.message)
      return
    }
    if (isSealedBackup(chosen.text)) {
      setSealedChoice(chosen.text)
      return
    }
    describeBackup(chosen.text)
  }

  // A preview reached through the passphrase prompt takes focus as the
  // prompt goes, so what the backup holds is what is read next.
  useEffect(() => {
    if (pendingRestore?.protected) previewHeading.current?.focus()
  }, [pendingRestore])

  const confirmRestore = async () => {
    if (!pendingRestore) return
    setRestoring(true)
    const result = await onImportGarden(pendingRestore.text)
    setRestoring(false)
    setBackupNote(result.message)
    if (result.ok) {
      setPendingRestore(undefined)
      setRestoreStep(false)
    }
  }

  const undoRestore = async (snapshotId: string) => {
    const result = await onUndoRestore?.(snapshotId)
    if (!result) return
    setBackupNote(result.message)
    if (result.ok) setUndoDismissed(snapshotId)
  }

  const askToKeepStorage = async () => {
    await requestPersistentStorage()
    setStorage(await storageStatus())
  }

  const undoSnapshotId =
    persistence.lastRestoreSnapshotId &&
    persistence.lastRestoreSnapshotId !== undoDismissed
      ? persistence.lastRestoreSnapshotId
      : undefined
  const profile = state.profile
  const recapHours = recapHoursOf(profile)
  const themeChoice = themeChoiceOf(profile)
  // Nothing to suggest about a garden that cannot be saved right now.
  const reminder = persistence.readOnly
    ? undefined
    : backupReminder(state, reminderNow)
  // Availability rather than earned unlocks: a Garden Pass scene is choosable
  // while access holds, and is never recorded as permanently earned.
  const nameNote = noteForName(name)

  return (
    <div className="view settings-view">
      <header className="page-header">
        <div>
          <p className="eyebrow">Your space, your choices</p>
          <h1>Settings</h1>
          <p>
            Change how the garden feels and understand where your data lives.
          </p>
        </div>
      </header>

      <section className="card" aria-labelledby="garden-settings-title">
        <p className="eyebrow">Garden details</p>
        <h2 id="garden-settings-title">Make the space yours</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            onUpdateProfile(name, gardenName, motion)
          }}
        >
          <label>
            Your name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={60}
            />
          </label>
          {nameNote && <p className="profile-note">{nameNote}</p>}
          <label>
            Garden name
            <input
              value={gardenName}
              onChange={(event) => setGardenName(event.target.value)}
              maxLength={60}
              required
            />
          </label>
          <fieldset className="motion-options">
            <legend>Garden motion</legend>
            {MOTION_CHOICES.map((choice) => (
              <label className="toggle-row" key={choice.value}>
                <span>
                  <strong>{choice.label}</strong>
                  <small>{choice.description}</small>
                </span>
                <input
                  type="radio"
                  name="garden-motion"
                  value={choice.value}
                  checked={motion === choice.value}
                  onChange={() => setMotion(choice.value)}
                />
              </label>
            ))}
          </fieldset>
          <button className="primary-button" type="submit">
            Save settings
          </button>
        </form>
      </section>

      {(onChooseTheme || onSetTextSize) && (
        // Beside motion, but a card of its own: motion waits for Save
        // settings, while these change the page at once, so they can be seen.
        <section className="card look-settings" aria-labelledby="look-settings-title">
          <p className="eyebrow">Light and lettering</p>
          <h2 id="look-settings-title">How the garden looks</h2>
          <p className="section-explainer">These change straight away.</p>
          {onChooseTheme && (
            <fieldset className="motion-options">
              <legend>Theme</legend>
              {themeChoices(android, eveningNightHours(profile)).map((choice) => (
                <label className="toggle-row" key={choice.value}>
                  <span>
                    <strong>{choice.label}</strong>
                    <small>{choice.description}</small>
                  </span>
                  <input
                    type="radio"
                    name="garden-theme"
                    value={choice.value}
                    checked={themeChoice === choice.value}
                    onChange={() => onChooseTheme(choice.value)}
                  />
                </label>
              ))}
            </fieldset>
          )}
          {onSetTextSize && (
            <fieldset className="motion-options">
              <legend>Text size</legend>
              {TEXT_SIZE_CHOICES.map((choice) => (
                <label className="toggle-row" key={choice.label}>
                  <span>
                    <strong style={{ fontSize: choice.scale }}>{choice.label}</strong>
                    <small>{choice.description}</small>
                  </span>
                  <input
                    type="radio"
                    name="text-size"
                    value={choice.value ?? 'comfortable'}
                    checked={profile?.textSize === choice.value}
                    onChange={() => onSetTextSize(choice.value)}
                  />
                </label>
              ))}
              {android && (
                <p className="subtle-copy">
                  Your phone’s own text size applies as well, so the two add up.
                </p>
              )}
            </fieldset>
          )}
        </section>
      )}

      <section
        className="card sound-settings-card"
        aria-labelledby="sound-settings-title"
      >
        <p className="eyebrow">Garden audio</p>
        <h2 id="sound-settings-title">Choose what you hear</h2>
        <p className="section-explainer">
          Your choice plays whenever the music button in the header is on.
          Everything is created on this device and works offline.
        </p>
        <fieldset className="sound-options">
          <legend className="sr-only">Sound option</legend>
          {ambientTracks.map((track) => {
            const chosen = profile?.ambientTrack ?? DEFAULT_AMBIENT_TRACK_ID
            const selected = chosen === track.id
            // Night may have brought the piano in place of the chosen one.
            const heard = (heardTrackId ?? chosen) === track.id
            return (
              <label
                className={`sound-option ${selected ? 'selected' : ''}`}
                key={track.id}
              >
                <input
                  type="radio"
                  name="ambient-track"
                  value={track.id}
                  checked={selected}
                  onChange={() => onSelectAmbientTrack(track.id)}
                />
                <span>
                  <strong>{track.name}</strong>
                  <small>{ambientTrackDescriptions[track.id]}</small>
                  <em>
                    {heard
                      ? profile?.ambientSound
                        ? 'Playing now'
                        : selected
                          ? 'Selected'
                          : 'Plays at night'
                      : selected
                        ? 'Back with the sunlight'
                        : 'Select sound'}
                  </em>
                </span>
              </label>
            )
          })}
        </fieldset>
        {onSetSoundVolume && (
          <SoundVolume
            volume={soundVolumeOf(profile)}
            onHear={onHearSoundVolume}
            onSet={onSetSoundVolume}
          />
        )}
        {onChooseFadeOut && (
          <div className="fade-out-setting">
            <label>
              Fade out after
              <select
                value={fadeOutMinutes ?? ''}
                onChange={(event) =>
                  onChooseFadeOut(
                    event.target.value
                      ? (Number(event.target.value) as FadeOutMinutes)
                      : undefined,
                  )
                }
              >
                <option value="">Keep playing</option>
                {FADE_OUT_CHOICES.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes} minutes
                  </option>
                ))}
              </select>
            </label>
            <p className="subtle-copy">
              {fadeOutEndsAt !== undefined
                ? `The sound fades away at ${fadeTimeFormat.format(fadeOutEndsAt)}.`
                : fadeOutMinutes
                  ? 'The timer starts when the sound is turned on.'
                  : 'Calming ambience that slowly fades, for this visit. It is not a sleep aid.'}
            </p>
          </div>
        )}
        <SoundSwitches
          profile={profile}
          android={android}
          onSetFollowsTheme={onSetSoundFollowsTheme}
          onSetInBackground={onSetSoundInBackground}
        />
      </section>

      {(onSetDayCountsHidden || onSetRecapHours) && (
        <section className="card" aria-labelledby="rhythm-settings-title">
          <p className="eyebrow">Your rhythm</p>
          <h2 id="rhythm-settings-title">Days and numbers</h2>
          {onSetRecapHours && (
            <div className="recap-hours">
              <label>
                My evening starts at
                <select
                  value={recapHours.opensHour}
                  onChange={(event) =>
                    onSetRecapHours({ ...recapHours, opensHour: Number(event.target.value) })
                  }
                >
                  {RECAP_OPENS_CHOICES.map((hour) => (
                    <option key={hour} value={hour}>
                      {formatHour(hour)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                A late night lasts until
                <select
                  value={recapHours.graceEndsHour}
                  onChange={(event) =>
                    onSetRecapHours({ ...recapHours, graceEndsHour: Number(event.target.value) })
                  }
                >
                  {RECAP_GRACE_CHOICES.map((hour) => (
                    <option key={hour} value={hour}>
                      {hour === 0 ? 'Midnight' : formatHour(hour)}
                    </option>
                  ))}
                </select>
              </label>
              <p className="subtle-copy">
                The Moonlight recap opens in your evening. Up past midnight, it
                still offers the day before until your late night ends. For
                shift work and night owls.
                {onOpenGuide && (
                  <>
                    {' '}
                    <GuideLink section="moonlight" topic="Moonlight" onOpen={onOpenGuide} />
                  </>
                )}
              </p>
            </div>
          )}
          {onSetDayCountsHidden && (
            <label className="toggle-row">
              <span>
                <strong>Show day counts</strong>
                <small>
                  How many days you cared for yourself, in the journal. Turn this
                  off to keep the journal free of numbers.
                </small>
              </span>
              <input
                type="checkbox"
                checked={!profile?.hideDayCounts}
                onChange={(event) => onSetDayCountsHidden(!event.target.checked)}
              />
            </label>
          )}
        </section>
      )}

      <ReminderSetting
        savedTime={profile?.reminderTime}
        eveningHour={recapHours.opensHour}
        onChooseTime={onSetReminderTime}
      />
      {onSetLetterQuotes && (
        <LetterSetting quotes={letterQuotesOf(profile)} onChoose={onSetLetterQuotes} />
      )}

      {onSetGardenPace && (
        <section className="card" aria-labelledby="pace-settings-title">
          <p className="eyebrow">How the garden gives</p>
          <h2 id="pace-settings-title">Garden pace</h2>
          <p className="section-explainer">
            A day of care is a day you earn Sunlight. Changing the pace keeps
            every plant, egg and day of care where it is.
            {onOpenGuide && (
              <>
                {' '}
                <GuideLink section="seeds" topic="Seeds, plants and eggs" onOpen={onOpenGuide} />
              </>
            )}
          </p>
          <fieldset className="motion-options">
            <legend className="sr-only">Garden pace</legend>
            {PACE_CHOICES.map((choice) => (
              <label className="toggle-row" key={choice.label}>
                <span>
                  <strong>{choice.label}</strong>
                  <small>{choice.description}</small>
                </span>
                <input
                  type="radio"
                  name="garden-pace"
                  value={choice.value ?? 'classic'}
                  checked={(choice.value === 'keep-giving') === keepsGiving(profile)}
                  onChange={() => onSetGardenPace(choice.value)}
                />
              </label>
            ))}
          </fieldset>
        </section>
      )}

      {onSetRegion && (
        <RegionSetting
          region={profile?.region}
          onChoose={onSetRegion}
          onOpenGuide={onOpenGuide}
        />
      )}

      {onSaveCustomBackdrop &&
        onDeleteCustomBackdrop &&
        onSelectCustomBackdrop && (
          <BackdropGallery
            state={state}
            onSelectBackdrop={onSelectBackdrop}
            onSaveCustomBackdrop={onSaveCustomBackdrop}
            onDeleteCustomBackdrop={onDeleteCustomBackdrop}
            onSelectCustomBackdrop={onSelectCustomBackdrop}
            onChooseNightBackdrop={onChooseNightBackdrop}
          />
        )}
      <section className="card">
        <p className="eyebrow">Growing together</p>
        <h2>The garden, version {releaseName()}</h2>
        <p>
          Discover the little things that make this release feel more like
          yours.
        </p>
        <button className="secondary-button" onClick={onOpenWhatsNew}>
          What's new
        </button>
      </section>

      {android && (
        <section
          className="card pass-settings-card"
          aria-labelledby="pass-settings-title"
        >
          <p className="eyebrow">Subscription</p>
          <h2 id="pass-settings-title">Garden Pass</h2>
          <p role="status">{passSummary(pass)}</p>
          <div className="form-actions">
            <button className="secondary-button" onClick={onOpenGardenPass}>
              See the Garden Pass
            </button>
            {pass.state !== 'unconfigured' && (
              <button
                className="text-button"
                onClick={() => {
                  setPassNote(undefined)
                  void managePassSubscription().then((opened) => {
                    if (!opened)
                      setPassNote(
                        'Google Play could not be opened on this device.',
                      )
                  })
                }}
              >
                Manage or cancel in Google Play
              </button>
            )}
          </div>
          {passNote && <p className="settings-note">{passNote}</p>}
        </section>
      )}

      <section className="card backup-card" aria-labelledby="backup-title">
        <p className="eyebrow">Keep a copy</p>
        <h2 id="backup-title">Backup and restore</h2>
        <p className="section-explainer">
          {android
            ? 'Your garden lives only in this app, on this phone. A backup file is the only sure way to move it to another phone or bring it back if the app is uninstalled or its storage is cleared. Nothing is uploaded — you choose where the file is saved.'
            : `Your garden lives only in this browser. A backup file is the only way to move it to another device or bring it back after site data is cleared. Nothing is uploaded — the file is saved straight to this device${canShareBackup ? ', or handed to an app you choose' : ''}.`}
        </p>
        {reminder && (
          <p className="backup-reminder">
            {reminder.text} A fresh copy keeps everything written since.
          </p>
        )}
        <div className="form-actions">
          {/* Held, not disabled, while a backup is made: a disabled button
              would drop the focus of the one just pressed. */}
          <button
            className="secondary-button"
            disabled={persistence.readOnly}
            aria-disabled={preparing || undefined}
            onClick={() => void saveBackup()}
          >
            {android ? 'Save a backup' : 'Download a backup'}
          </button>
          {canShareBackup && (
            <button
              className="secondary-button"
              disabled={persistence.readOnly}
              aria-disabled={preparing || undefined}
              onClick={() => void shareBackup()}
            >
              Share backup…
            </button>
          )}
          <button
            className="secondary-button"
            disabled={persistence.readOnly}
            onClick={() => {
              setBackupNote(undefined)
              setProtecting('save')
            }}
          >
            {android ? 'Save a protected backup…' : 'Download a protected backup…'}
          </button>
          {canShareBackup && (
            <button
              className="secondary-button"
              disabled={persistence.readOnly}
              onClick={() => {
                setBackupNote(undefined)
                setProtecting('share')
              }}
            >
              Share protected backup…
            </button>
          )}
          {!restoreStep ? (
            <button
              className="text-button"
              onClick={() => {
                setBackupNote(undefined)
                setRestoreStep(true)
              }}
            >
              Restore from a backup
            </button>
          ) : (
            <button
              className="text-button"
              onClick={() => {
                setRestoreStep(false)
                setPendingRestore(undefined)
              }}
            >
              Cancel restore
            </button>
          )}
        </div>
        {locked && (
          <p className="settings-note">
            This copy is not locked; keep it somewhere private, or use a protected backup.
          </p>
        )}
        <p className="subtle-copy">
          A protected backup needs a passphrase to open, so nobody can read your
          garden from the file without it.
        </p>
        {protecting && (
          <Suspense fallback={null}>
            <ProtectedBackupDialog
              share={protecting === 'share'}
              onExportGarden={onExportGarden}
              onClose={(result) => {
                setProtecting(undefined)
                if (!result) return
                backupMade(result.madeAt)
                setBackupNote(result.note)
              }}
            />
          </Suspense>
        )}
        {sealedChoice !== undefined && (
          <ProtectedRestore
            text={sealedChoice}
            returnFocus={() => fileInputRef.current}
            onOpened={(plain) => {
              setSealedChoice(undefined)
              describeBackup(plain, true)
            }}
            onClose={(note) => {
              setSealedChoice(undefined)
              if (note) setBackupNote(note)
            }}
          />
        )}
        {restoreStep && (
          <div className="delete-confirmation" role="alert">
            <strong>
              {android
                ? 'Restoring replaces everything currently in this app.'
                : 'Restoring replaces everything currently in this browser.'}
            </strong>
            <input
              ref={fileInputRef}
              type="file"
              accept={BACKUP_ACCEPT}
              aria-label="Backup file"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (file) void chooseBackup(file)
              }}
            />
          </div>
        )}
        {pendingRestore && (
          <div className="restore-preview" aria-labelledby="restore-preview-title">
            <h3 id="restore-preview-title" ref={previewHeading} tabIndex={-1}>
              {pendingRestore.gardenName
                ? `This backup holds ${pendingRestore.gardenName}`
                : 'This backup holds a garden'}
            </h3>
            <ul>
              {pendingRestore.protected && <li>A protected backup, opened with its passphrase</li>}
              {pendingRestore.counts && (
                <>
                  <li>
                    {counted(pendingRestore.counts.checkIns, 'check-in', 'check-ins')},{' '}
                    {counted(pendingRestore.counts.reflections, 'reflection', 'reflections')}{' '}
                    and{' '}
                    {counted(pendingRestore.counts.recaps, 'evening recap', 'evening recaps')}
                  </li>
                  <li>
                    {counted(pendingRestore.counts.goals, 'goal', 'goals')},{' '}
                    {counted(pendingRestore.counts.butterflies, 'butterfly', 'butterflies')}{' '}
                    and{' '}
                    {counted(pendingRestore.counts.images, 'image of your own', 'images of your own')}
                  </li>
                  {pendingRestore.counts.sightings > 0 && (
                    <li>
                      {counted(pendingRestore.counts.sightings, 'sighting', 'sightings')} in
                      the field book, with{' '}
                      {counted(pendingRestore.counts.photos, 'photo', 'photos')}
                    </li>
                  )}
                </>
              )}
              {pendingRestore.firstDay && pendingRestore.lastDay && (
                <li>
                  Written from {formatJournalDate(pendingRestore.firstDay)} to{' '}
                  {formatJournalDate(pendingRestore.lastDay)}
                </li>
              )}
              {pendingRestore.exportedAt && (
                <li>
                  Saved on{' '}
                  {new Date(pendingRestore.exportedAt).toLocaleString()}
                  {pendingRestore.appVersion
                    ? ` by version ${pendingRestore.appVersion}`
                    : ''}
                </li>
              )}
              {pendingRestore.repaired > 0 && (
                <li>
                  {pendingRestore.repaired} damaged{' '}
                  {pendingRestore.repaired === 1 ? 'entry' : 'entries'} will be
                  repaired as it is restored.
                </li>
              )}
            </ul>
            <p>
              The garden here now is kept aside, so you can undo the restore
              afterwards.
            </p>
            <div className="form-actions">
              <button
                className="primary-button"
                disabled={restoring}
                onClick={() => void confirmRestore()}
              >
                Restore this backup
              </button>
              <button
                className="text-button"
                onClick={() => setPendingRestore(undefined)}
              >
                Choose another file
              </button>
            </div>
          </div>
        )}
        {undoSnapshotId && onUndoRestore && (
          <div className="form-actions undo-restore">
            <button
              className="secondary-button"
              onClick={() => void undoRestore(undoSnapshotId)}
            >
              Undo the restore
            </button>
            <button
              className="text-button"
              onClick={() => setUndoDismissed(undoSnapshotId)}
            >
              Keep the restored garden
            </button>
          </div>
        )}
        {backupNote && (
          <p className="settings-note" role="status">
            {backupNote}
          </p>
        )}
        {persistence.readOnly && (
          <p className="settings-note error">
            Saving is paused because the stored garden could not be read. The
            unreadable copy has been set aside untouched; restoring a backup
            here will start saving again.
          </p>
        )}
        {(setAsideCount > 0 || persistence.readOnly) && onDownloadSetAside && (
          <div className="set-aside">
            <p>
              A copy of a garden this version could not read has been set aside
              on this device.
            </p>
            <div className="form-actions">
              <button
                className="secondary-button"
                onClick={() => void saveSetAside()}
              >
                Download the set-aside copy
              </button>
              {!persistence.readOnly && onDiscardSetAside && (
                <button
                  className="text-button"
                  onClick={() => {
                    void onDiscardSetAside().then(() => {
                      setSetAsideCount(0)
                      setBackupNote('The set-aside copies were discarded.')
                    })
                  }}
                >
                  Discard set-aside copies
                </button>
              )}
            </div>
          </div>
        )}
        {fieldBookPhotos.count > 0 && (
          <p className="settings-note">
            Your field book keeps{' '}
            {counted(fieldBookPhotos.count, 'photo', 'photos')} of what you saw
            in the wild, about {formatBytes(fieldBookPhotos.bytes)}, of the{' '}
            {MAX_SIGHTING_PHOTOS} it can hold. They are in every backup.
          </p>
        )}
        {!android && storage && storage.protection !== 'unknown' && (
          <div className="storage-status">
            <p>
              <strong>
                {storage.protection === 'protected'
                  ? 'This browser has agreed to keep your garden.'
                  : 'This browser may clear your garden if it runs short of space.'}
              </strong>{' '}
              {storage.usage !== undefined &&
                `The garden and the app use about ${formatBytes(storage.usage)} here.`}
            </p>
            {storage.protection === 'best-effort' && (
              <button
                className="text-button"
                onClick={() => void askToKeepStorage()}
              >
                Ask the browser again
              </button>
            )}
          </div>
        )}
        {/* The garden's Home Screen guide is shown once; this line stays,
            whatever the browser says about storage, until it agrees to keep
            the garden or the garden is on the Home Screen. */}
        {!android && homeScreen && storage && storage.protection !== 'protected' && (
          <p className="settings-note">
            {homeScreen === 'safari'
              ? 'On iPhone and iPad, Safari may clear what a website keeps after seven days of use without a visit. Add the garden to your Home Screen to keep it (Share, then Add to Home Screen, then Add), and keep a backup too.'
              : 'On iPhone and iPad, a browser may clear what a website keeps after seven days of use without a visit. Add the garden to your Home Screen to keep it (your browser’s Share menu, then Add to Home Screen, then Add), and keep a backup too.'}
          </p>
        )}
      </section>

      <section className="card privacy-card" aria-labelledby="privacy-title">
        <p className="eyebrow">Plain-language privacy</p>
        <h2 id="privacy-title">This garden stays on this device</h2>
        {android ? (
          <>
            <p>
              Your goals, check-ins, reflections, plants, and butterflies are
              stored only in this app, on this phone. We do not create an
              account, run analytics, send your entries to a server, or analyze
              what you write.
            </p>
            <p>
              The garden itself never contacts anyone. Everything it shows,
              down to its lettering, is already inside the app.
            </p>
            <p>
              The optional Garden Pass is sold through Google Play, which takes
              the payment; the app never sees your payment details. Google&apos;s
              billing library, which Play requires for this, is only used when
              you open the Garden Pass, subscribe, manage it in Google Play, or
              have a Pass, and Google may receive diagnostic information from
              it then or shortly after. It is never given anything you have
              written.
            </p>
            <p>
              Android&apos;s cloud backup is switched off for this app, so your
              journal is never copied to Google Drive. Moving to a new phone
              with Android&apos;s own transfer may bring the garden along; a
              backup file always can.
            </p>
            <p>
              Uninstalling the app or clearing its storage removes your garden.
              Cross-device sync is not part of this release, so keep a backup
              above if the garden matters to you.
            </p>
          </>
        ) : (
          <>
            <p>
              Your goals, check-ins, reflections, plants, and butterflies are
              stored only in this browser. We do not create an account, run
              analytics, send your entries to a server, or analyze what you
              write.
            </p>
            <p>
              The garden never contacts a third party — even its lettering is
              bundled with the app rather than fetched from a font service, so
              opening it tells no one that you did.
            </p>
            <p>
              The few things it does fetch after loading come from the app
              itself: the backdrops that unlock later, and a handful of extra
              letterforms, are left out of the install so a new gardener does
              not download half a megabyte they cannot use yet.
            </p>
            <p>
              Clearing this site&apos;s browser storage, uninstalling without
              keeping site data, or using another device can remove your
              garden. Cross-device sync is not part of this release, so keep a
              backup above if the garden matters to you.
            </p>
          </>
        )}
        <LockSettings />
      </section>

      <section className="card about-card" aria-labelledby="about-title">
        <p className="eyebrow">About</p>
        <h2 id="about-title">The Butterfly Garden {__APP_VERSION__}</h2>
        <p>
          A self-care companion, not a medical device. It does not diagnose,
          treat, cure, or prevent any condition. If you are struggling, please
          talk to a healthcare professional or someone you trust.
        </p>
        <div className="form-actions">
          <button className="secondary-button" onClick={onOpenPrivacy}>
            Privacy policy
          </button>
          <button className="text-button" onClick={onOpenNotices}>
            Open-source notices
          </button>
          {onOpenSupport && (
            <button className="text-button" onClick={onOpenSupport}>
              If you need support now
            </button>
          )}
          {onOpenComfort && (
            <ComfortLink onOpen={onOpenComfort}>
              {state.profile?.comfortPlan ? 'Your comfort plan' : 'Write a comfort plan'}
            </ComfortLink>
          )}
        </div>
      </section>

      <section className="card danger-card" aria-labelledby="delete-title">
        <p className="eyebrow">Permanent action</p>
        <h2 id="delete-title">Delete all local data</h2>
        <p>
          This removes the complete garden, journal, goals, and collection from
          {android ? ' this app' : ' this browser'}. It cannot be undone.
        </p>
        {!deleteStep ? (
          <button className="danger-button" onClick={() => setDeleteStep(true)}>
            Begin deletion
          </button>
        ) : (
          <div className="delete-confirmation" role="alert">
            <strong>Are you certain you want to start over?</strong>
            <div className="form-actions">
              <button
                className="danger-button"
                onClick={() => {
                  setDeleteError(undefined)
                  void onDeleteAll().then((result) => {
                    if (!result.ok) setDeleteError(result.message)
                  })
                }}
              >
                Yes, delete everything
              </button>
              <button
                className="secondary-button"
                onClick={() => setDeleteStep(false)}
              >
                Keep my garden
              </button>
            </div>
            {deleteError && (
              <p className="settings-note error">{deleteError}</p>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
