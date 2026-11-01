import {
  lazy,
  Suspense,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from 'react'
import type { AppState, AppView, SightingSubject } from '../types'
import { SpeciesDirectory, type SpeciesShown } from './SpeciesDirectory'
import { RegionGuide } from './guide/RegionGuide'
import { STAGE_CARE_DAYS } from '../lib/lifecycle'
import { PLANT_CAPACITY } from '../lib/plantManagement'
import { REBLOOM_CARE_DAYS } from '../lib/gardenPace'
import {
  DAILY_SEED_REWARD,
  DAILY_SUNLIGHT_CAP,
  MOONLIGHT_STARDUST_REWARD,
  NECTAR_PER_SUNLIGHT,
  PLANT_SEED_COST,
} from '../lib/progression'
import type { IconName } from '../types'
import { Icon } from './Icons'
import { isAndroidApp } from '../lib/platform'
import { formatHour, recapHoursOf, recapOpensAt, type RecapHours } from '../lib/date'
import { hashForRoute } from '../lib/routes'
import { counted } from '../lib/plural'
import { regionGuideWords } from '../lib/regionGuide'
import { hasEveryWord, normaliseForSearch, searchWords } from '../lib/searchText'
import {
  fieldBookActions,
  photoNotSaved,
  seenInTheWild,
  type ChangeSightings,
} from '../lib/sightings'
import { MAX_SIGHTING_PHOTOS, MAX_SIGHTINGS } from '../lib/customBackdrops'
import { useLocalDate } from '../hooks/useLocalDate'
// Only the Guide draws these, so they arrive with it.
import './guide/guide.css'

// The sighting form arrives when a card's "Log a sighting" is pressed.
const SightingForm = lazy(() => import('./sightings/SightingForm'))

interface GuideSection {
  /** Its name in the address, `#/guide/{id}`, and in the table of contents' links. */
  id: string
  /** The table of contents' few words for it. */
  short: string
  icon: IconName
  eyebrow: string
  title: string
  paragraphs: string[]
}

function guideSections({ opensHour, graceEndsHour }: RecapHours): GuideSection[] {
  const android = isAndroidApp()
  return [
    {
      icon: 'sun',
      eyebrow: 'The heart of the garden',
      id: 'sunlight',
      short: 'Sunlight',
      title: 'Sunlight — care for yourself first',
      paragraphs: [
        `Everything begins with your own self-care. Checking in with your mood, completing a goal, or writing a reflection each earn one Sunlight, up to ${DAILY_SUNLIGHT_CAP} per day. So does breathing with a butterfly to the end of a session, once a day.`,
        `Every Sunlight converts into ${NECTAR_PER_SUNLIGHT} Nectar for the shop, grows one of your plants a step, and your first Sunlight each day adds ${DAILY_SEED_REWARD} seed to your tray. Nothing is ever lost on a hard day — the garden simply waits.`,
      ],
    },
    {
      icon: 'moon',
      eyebrow: 'Closing the day',
      id: 'moonlight',
      short: 'Moonlight',
      title: 'Moonlight — round out the evening',
      paragraphs: [
        `From ${recapOpensAt(opensHour)} you can round out your day: a few short questions about how it ended up, what went well, and what you would rather not carry into tomorrow. Every question can be skipped, and the recap is kept in your journal.`,
        `Closing the day earns ${MOONLIGHT_STARDUST_REWARD} Stardust — once per day, whether or not you earned any Sunlight. Some days the only thing you managed was getting to the end of them, and that still counts. ${graceEndsHour > 0 ? `If you are up past midnight the recap keeps offering yesterday until ${formatHour(graceEndsHour)}, so a late night closes the day you actually lived. ` : ''}Both hours can be moved in Settings, under Your rhythm.`,
        'Moonlight is separate from Sunlight. It does not grow your plants and it does not count toward your rhythm of care days — that still asks for an act of care.',
      ],
    },
    {
      icon: 'seed',
      eyebrow: 'Growing things',
      id: 'seeds',
      short: 'Seeds and plants',
      title: 'Seeds, plants, and butterfly eggs',
      paragraphs: [
        `Each seed plants one flower, shrub, or tree (${PLANT_SEED_COST} seed per plant, up to ${PLANT_CAPACITY} spaces in the scene). Host plants shelter particular butterfly species; nectar plants feed everyone. Shared host plants prefer a species you have not welcomed yet.`,
        'Plants grow one stage per Sunlight — seed, sprout, budding, full bloom — with each Sunlight tending the plant you chose on Today, or else the earliest one that can still grow. When a host plant reaches full bloom, look closely: a butterfly egg appears on its leaves, and a new companion begins. It arrives with a name no other companion has, and the Care page offers you the chance to choose another. There is no need to answer: if you do nothing, it keeps the name it came with.',
        'Missed days simply pause growth; nothing ever wilts. You can remove a plant from its field-guide panel (no seed refund), but a plant sheltering an egg, caterpillar, or chrysalis is protected until its butterfly emerges.',
        `What a plant does after its first bloom is your choice, in Settings under Garden pace. Classic, the garden’s usual pace, brings one egg from each host plant; plant another to welcome more. Keep giving lets a host plant in full bloom bloom again after ${REBLOOM_CARE_DAYS} more days of care (any day you earn Sunlight), with another egg each time, chosen the same way as the first. If every butterfly it hosts is still growing up here, it waits, ready, until one emerges.`,
      ],
    },
    {
      icon: 'care',
      eyebrow: 'From egg to wings',
      id: 'life-cycle',
      short: 'Life cycle',
      title: 'The life cycle and care days',
      paragraphs: [
        `Every companion passes through four stages: egg, caterpillar, chrysalis, butterfly. Each stage before butterfly needs ${STAGE_CARE_DAYS} days of care to advance — and the days never need to be consecutive. Care on Monday, rest all week, care twice more later: that counts.`,
        'Any one care activity on a day marks that day as cared-for. The Care page shows dots for each stage: fill all three and your companion transforms, with a little celebration of Nectar (and Stardust and seeds when a butterfly emerges).',
        'An egg, caterpillar or chrysalis can also grow alongside one of your goals: choose it when a new egg arrives, or on its Care page. Each day you complete that goal on Today counts as a day of care, just as an activity would, and a day cared for both ways counts once. Bond still comes from the activities themselves. When it emerges, its story remembers the goal it grew alongside; archiving or deleting the goal simply leaves it to the care menu, with nothing lost.',
        'Butterflies never stop needing you. Their care days keep counting forever and every activity deepens your bond.',
      ],
    },
    {
      icon: 'leaf',
      eyebrow: 'Daily tending',
      id: 'care',
      short: 'Care',
      title: 'Care activities and supplies',
      paragraphs: [
        'Each stage has its own care menu: eggs like warmth, mist, and lullabies; caterpillars love fresh leaves, berry treats, dew baths, playtime, and being tucked in; chrysalises want mist, sunbeams, and encouragement; butterflies enjoy nectar sips, fruit, puddling baths, grooming, and flying with you.',
        'Every activity can be done once per companion per day. Some use a supply from your satchel — leaves, spring water, bath dew, nectar drops, fruit slices — bought with Nectar in the Shop. Free activities are always available, so you can care every day even with an empty satchel.',
      ],
    },
    {
      icon: 'care',
      eyebrow: 'A friendship meter',
      id: 'bond',
      short: 'Bond levels',
      title: 'Bond levels',
      paragraphs: [
        'Every care activity earns bond points (supply-based ones earn more). Each bond level rewards you with Stardust and Nectar, and there is no ceiling — a butterfly you have loved for months keeps giving back.',
        'A deeper bond also shares more about a companion’s kind: a second fact at bond level 3 and a third at level 5, on the Care page and in your field notes.',
      ],
    },
    {
      icon: 'nectar',
      eyebrow: 'Two currencies',
      id: 'nectar-and-stardust',
      short: 'Nectar and Stardust',
      title: 'Nectar and Stardust',
      paragraphs: [
        'Nectar is the everyday currency: earned from Sunlight, spent on supplies, outfits, jars, and flight patterns.',
        'Stardust is rarer: earned from bond level-ups and butterfly emergences, spent in the Stardust atelier of the Boutique (pieces like the Star Diadem, Moonlit Halo, and Firefly Glow) and on the two most graceful flight patterns, Spiral Rise and Garden Waltz. Save it for what you love.',
      ],
    },
    {
      icon: 'bow',
      eyebrow: 'Dress-up',
      id: 'boutique',
      short: 'Boutique',
      title: 'The Boutique and wardrobe',
      paragraphs: [
        "Cosmetics come in three slots — headwear, accessories, and auras — and each lists the life stages it fits. Buy once, dress everyone: your whole garden shares one closet, managed from each companion's wardrobe on the Care page.",
        'If a companion changes stage and an item no longer fits, it is only hidden, never lost.',
      ],
    },
    {
      icon: 'crown',
      eyebrow: 'Something to look forward to',
      id: 'garden-pass',
      short: 'Garden Pass',
      title: 'The Garden Pass',
      paragraphs: [
        isAndroidApp()
          ? 'A very exclusive corner of the shop displays seasonal regalia — the Royal Monarch Crown, Aurora Veil, Rainbow Trail, and Celestial Cape — beside extra scenes and your own images as backdrops. They come with the optional Garden Pass subscription from Google Play; you can try any outfit on first, and everything else in the garden is free.'
          : 'A very exclusive corner of the shop displays seasonal regalia — the Royal Monarch Crown, Aurora Veil, Rainbow Trail, and Celestial Cape. They are included free in the current PWA preview. Try them from the Care wardrobe; no subscription or payment is active.',
      ],
    },
    {
      icon: 'today',
      eyebrow: 'Gentle structure',
      id: 'goals',
      short: 'Goals',
      title: 'Goals, skipping, and snoozing',
      paragraphs: [
        'Goals can repeat daily, on chosen weekdays, or happen just once. Completing one earns Sunlight — though repeating the same completed activity never creates extra Sunlight, and recurrence follows the calendar date on this device (daylight-saving changes are handled for you).',
        'Not every day has room for every goal. Skip sets a goal aside for today with zero penalty — it simply rests. Snooze tucks it away until tomorrow, and planned one-time goals move to the new day automatically. You can wake a snoozed goal any time.',
      ],
    },
    {
      icon: 'flight',
      eyebrow: 'Life in the scene',
      id: 'companions',
      short: 'Companions',
      title: 'Companions in the garden',
      paragraphs: [
        'Every emerged butterfly flies through the garden scene, pausing near flowers — and Marigold, your monarch guide, is always among them. Tap or click any butterfly in the garden to meet it: its card says who it is, has a Pet button for a little burst of hearts, and opens Care for a companion. On the Care page, a tap on any stage, egg to butterfly, gives the hearts straight away.',
        'Choose one butterfly as your active companion from its card in the Garden, and rename any companion whenever you like from its card or the Care page.',
      ],
    },
    {
      icon: 'journal',
      eyebrow: 'Kept as you wrote it',
      id: 'journal',
      short: 'Journal',
      title: 'Journal and your rhythm',
      paragraphs: [
        'The Journal holds your dated moods, reflections, and butterfly field notes. Personal entries can be edited or deleted at any time, and nothing you write is scored or analyzed.',
        'Your rhythm counts the days you earned at least one Sunlight: how many of the last seven, and how many this month. A missed day never sets it back to zero. It is just a gentle mirror, it never changes plant or butterfly progress, and Settings can hide the numbers altogether.',
      ],
    },
    {
      icon: 'journal',
      eyebrow: 'Looking back',
      id: 'letters-and-year',
      short: 'Letters and your year',
      title: 'Letters from Marigold, and your garden’s year',
      paragraphs: [
        'Each Sunday evening a letter from Marigold waits in the garden: a few lines about your week, kept in your journal. No scores and no advice, only what happened.',
        'A letter quotes only lines you star in the Journal, a check-in note or a reflection, and nothing else you wrote. Choose Never in Settings, under Letters from Marigold, and letters say what happened without quoting you at all.',
        'Your garden’s year, opened from the Journal, looks back at what you wrote, the weather of your days, who arrived and the lines you starred. Nothing on it is a score. It ends with a postcard made on your device from your garden’s scene, your butterflies, its name and the year. Nothing from your journal is on it, and it goes nowhere unless you tap to share or save it.',
      ],
    },
    {
      icon: 'eye',
      eyebrow: 'Noticed in nature',
      id: 'field-book',
      short: 'Field book',
      title: 'Your field book',
      paragraphs: [
        'The field book keeps the real butterflies and plants you notice out in the world, with a few words and a photo if you like. Log one in the Journal, under Seen in the wild, or from a butterfly’s or a plant’s card here in the Guide. Sightings earn nothing: noticing is the point.',
        `A photo is kept as a smaller copy on this device and in your backups, and nothing about where it was taken is kept; the garden never asks where you are. The field book keeps up to ${MAX_SIGHTINGS.toLocaleString()} sightings and ${MAX_SIGHTING_PHOTOS} photos.`,
      ],
    },
    {
      icon: 'journal',
      eyebrow: 'Seeing the month',
      id: 'calendar',
      short: 'Calendar',
      title: 'The calendar planner',
      paragraphs: [
        "The calendar on the Today page shows your whole month: dots for the goals landing on each day, suns for days you gathered Sunlight, and your mood's weather. Tap any upcoming day to plan a one-time goal for it — future you will find it waiting on the right morning.",
      ],
    },
    {
      icon: 'today',
      eyebrow: 'A nudge you choose',
      id: 'reminders',
      short: 'Calendar reminders',
      title: 'Reminders in your calendar',
      paragraphs: [
        `A daily garden visit, in Settings, puts a reminder in your own calendar: a morning check-in, your evening’s Moonlight, or any time you choose. ${android ? 'The app saves a calendar file for you to open' : 'The garden gives you a calendar file to open'}, and the event names only the garden, with nothing from your journal.`,
        'Your calendar does the reminding; the garden never sends notifications. To stop, delete the event in your calendar.',
      ],
    },
    {
      icon: 'flower',
      eyebrow: 'For harder days',
      id: 'comfort-plan',
      short: 'Comfort plan',
      title: 'Your comfort plan',
      paragraphs: [
        'My comfort plan is a page in your own words for a day that feels hard: what helps, people you can reach, places that feel calm, kind words for yourself, and what matters to you. Open it from the support page, from Settings, or from Today on a gentle day.',
        'Only you see it. It stays on this device and in the backups you save, and the garden never quotes it or shows it anywhere else. It is a personal page, not a medical or crisis plan, and not a stand-in for help: If you need support now lists people who can talk with you.',
      ],
    },
    {
      icon: 'shop',
      eyebrow: 'Keepsakes',
      id: 'jars',
      short: 'Letter jars',
      title: 'Letter jars',
      paragraphs: [
        "Letter and number jars are decorative keepsakes for your plant spots: A–Z, 0–9, accented capitals such as É and Ñ, and a few marks (! ? & + . *), in eight colors, one reusable jar per purchase. Place, move, or return them from a plant's detail panel in the Garden — each plant spot holds one jar. Spell names, dates, or tiny messages across your flowerbed.",
        'Removing a plant returns its jar safely to inventory. In the Shop, alike jars share a row on your shelf, and a jar that is not on a plant can be recycled for half its Nectar, with a few seconds to undo. Like all shop purchases, jars stay on this device.',
      ],
    },
    {
      icon: 'flight',
      eyebrow: 'Ways of flying',
      id: 'flight',
      short: 'Flight patterns',
      title: 'Flight patterns',
      paragraphs: [
        'Flight patterns change how your butterflies move through the garden scene — drifting, petal-hopping, figure eights, spirals. Buy them in the Shop, choose the active one on the Flight page.',
      ],
    },
    {
      icon: 'moon',
      eyebrow: 'After dark, and through the year',
      id: 'night-and-seasons',
      short: 'Night and seasons',
      title: 'The night garden and the seasons',
      paragraphs: [
        'When the garden turns to night, by the moon button in the header or by following your device or your evening, each scene shows its own painted night. An image of your own still comes first, and one can be chosen just for the night.',
        'The scene follows the seasons where you garden, as you set it in Settings: seasonal petals, autumn leaves and a quiet frost in winter. With Full garden motion, nights outside winter bring out fireflies, and a few moths visit the flowers in bloom.',
      ],
    },
    {
      icon: 'music',
      eyebrow: 'Set the mood',
      id: 'sound',
      short: 'Sound',
      title: 'Your garden soundscape',
      paragraphs: [
        'The note button in the header plays your selected soundscape. Choose the original garden sounds with wind chimes, garden sounds without chimes, soft rain, dawn birdsong, or an original classical-style piano loop in Settings, and how loud it plays. Night can bring the piano, if you like. Everything is generated on your device, works offline, and can be toggled off at any time.',
      ],
    },
    {
      icon: 'settings',
      eyebrow: 'Take it with you',
      id: 'offline',
      short: 'Offline',
      title: isAndroidApp() ? 'Offline and updates' : 'Install, offline, and updates',
      paragraphs: [
        isAndroidApp()
          ? 'The whole garden is inside the app, so it works offline from the moment it is installed. New versions arrive through Google Play.'
          : 'After the first successful load, the whole garden works offline. Supported browsers offer an Install button in the header for a standalone home-screen app, and when a new version is ready the app always asks before refreshing to apply it.',
      ],
    },
    {
      icon: 'leaf',
      eyebrow: 'Keep a copy',
      id: 'backups',
      short: 'Backups and moving',
      title: 'Backups, earlier copies, and moving to a new device',
      paragraphs: [
        android
          ? 'A backup file is a copy of your whole garden that you keep. Save one from Settings, under Backup and restore, and restore it there or on the welcome screen.'
          : 'A backup file is a copy of your whole garden that you keep. Download one from Settings, under Backup and restore, and restore it there or on the welcome screen. On supported desktop browsers you can also choose a backup file once, and the garden writes a fresh copy to it after each day’s changes and as you leave; it pauses while your garden is locked.',
        `Before the first change you make on a day, the garden also keeps a copy of how it was, up to seven, and the two from before a restore. Settings lists them, so you can look at one, put it back or discard it. ${android ? 'They live in this app with your garden, so they cannot help if the app is uninstalled or its storage cleared' : 'They live in this browser with your garden, so they cannot help if the site’s storage is cleared'}; a backup file can.`,
        `Moving to a new device? Move my garden makes a move file, locked with a one-time code shown as 12 words. ${android ? 'Save the file somewhere your new device can reach, such as a cloud drive' : 'Send the file to your new device any way you like'}, then choose Arrive from another device there, on the welcome screen or in Settings, and type the 12 words in order. The words are shown once and kept nowhere, and whoever has both can open your garden, so send them apart from the file, or not at all. A garden lock stays behind: turn it on again on the new device if you want it.`,
      ],
    },
    {
      icon: 'moon',
      eyebrow: 'Yours alone',
      id: 'privacy',
      short: 'Privacy',
      title: 'Privacy, backdrops, and starting over',
      paragraphs: [
        'Everything lives on this device — moods, reflections, goals, and garden. There are no accounts, no analytics, and nothing is uploaded. Lock my garden, in Settings, can seal it with a passcode too. Garden motion in Settings offers a calmer pace, or pauses decorative animation altogether, and Text size makes every word larger.',
        'New garden backdrops unlock as your garden ages: the Woodland Brook after 30 days and the Secret Conservatory after 60. Switch them in Settings — and the moon button in the header turns the whole app into a starry night theme. Settings can also follow your device’s dark setting, or bring the night in with your evening.',
        isAndroidApp()
          ? 'Delete all local data in Settings permanently removes this garden from this phone; clearing the app\'s storage or uninstalling it does the same. There is no undo, so treat it kindly.'
          : 'Delete all local data in Settings permanently removes this garden from the current browser; clearing site storage does the same. There is no undo, so treat it kindly.',
      ],
    },
    {
      icon: 'lock',
      eyebrow: 'Only for you',
      id: 'lock',
      short: 'Lock and protected backups',
      title: 'Locking your garden, and protected backups',
      paragraphs: [
        `Lock my garden, in Settings, keeps what the garden stores ${android ? 'on this phone' : 'in this browser'} sealed with a passcode you choose, and gives you a 24-word recovery code that opens it if the passcode is forgotten.${android ? '' : ' Where your device offers one, a passkey can open it too.'} It can lock by itself after a while out of sight. If you forget your passcode and lose your recovery code, nobody can open your garden, not even the people who made this app.`,
        `The lock cannot protect the garden while it is open, from someone using the ${android ? 'phone' : 'device'} then, or from ${android ? 'software that already controls the phone' : 'other code running at the same web address'}. Backups you ${android ? 'save' : 'download'} are not locked, and a garden moved to a new device is not locked there until you turn the lock on.`,
        `A protected backup is the usual backup file, locked with a passphrase you choose, so it can sit in your ${android ? 'files' : 'downloads'} or a cloud folder and opens only with that passphrase. The passphrase is never stored, here or in the file, so keep it somewhere safe, apart from the file: without it, nobody can open the backup, not this app and not you.`,
      ],
    },
  ]
}

/** The Guide's own way back, by the page a "What does this do?" link left. */
const RETURN_LABELS: Partial<Record<AppView, string>> = {
  today: 'Back to Today',
  care: 'Back to Care',
  settings: 'Back to Settings',
  recap: 'Back to Moonlight',
  shop: 'Back to the Shop',
  garden: 'Back to the garden',
}

/** The heading a section's link takes focus to. */
function headingId(section: string): string {
  return section === 'species' ? 'species-title' : `guide-${section}`
}

export function GuideView({
  state,
  onShowSeed,
  onOpenSupport,
  section,
  returnTo,
  onReturn,
  onOpenSection,
  onChangeSightings,
}: {
  state: AppState
  onShowSeed: (id: string) => void
  onOpenSupport?: () => void
  /** The section the address names, which takes focus when it arrives. */
  section?: string
  /** The page a "What does this do?" link left, for the way back. */
  returnTo?: AppView
  onReturn?: () => void
  /** Put a section in the address, as following its link does. */
  onOpenSection?: (section: string) => void
  /** Log a sighting from a species' or plant's card. Without it, none is offered. */
  onChangeSightings?: ChangeSightings
}) {
  const { opensHour, graceEndsHour } = recapHoursOf(state.profile)
  const region = state.profile?.region
  const today = useLocalDate()
  const seen = useMemo(() => seenInTheWild(state.sightings), [state.sightings])
  // The butterfly or plant whose card opened the sighting form, and the
  // button that did, which takes focus back when the form closes.
  const [logging, setLogging] = useState<SightingSubject>()
  const loggedFrom = useRef<HTMLElement | null>(null)
  /** Whether the photo of the sighting just logged was stored, while that is not yet known. */
  const photoSaved = useRef<Promise<boolean | 'conflict'>>(undefined)
  const [logged, setLogged] = useState('')
  // Rebuilt only when the gardener's evening moves, not on every garden change.
  const sections = useMemo(
    () => guideSections({ opensHour, graceEndsHour }),
    [opensHour, graceEndsHour],
  )
  // What a search can find in each section, normalised once.
  const searchable = useMemo(
    () =>
      new Map(
        sections.map((item) => [
          item.id,
          normaliseForSearch([item.short, item.eyebrow, item.title, ...item.paragraphs].join(' ')),
        ]),
      ),
    [sections],
  )
  const regionWords = useMemo(
    () => (region ? normaliseForSearch(regionGuideWords(region)) : ''),
    [region],
  )

  const [query, setQuery] = useState('')
  // Typing stays quick while the sections and species filter behind it. A
  // cleared search applies at once, so a section it was hiding can take focus.
  const deferredQuery = useDeferredValue(query)
  const words = useMemo(() => searchWords(query === '' ? '' : deferredQuery), [query, deferredQuery])
  const searching = words.length > 0
  const shown = searching
    ? sections.filter((item) => hasEveryWord(searchable.get(item.id) ?? '', words))
    : sections
  const regionShown = region !== undefined && (!searching || hasEveryWord(regionWords, words))
  const sectionsMatching = shown.length + (regionShown ? 1 : 0)
  // How many butterflies the directory below shows, once it has drawn them
  // for these same words: until then the line waits rather than miscount.
  const [speciesFound, setSpeciesFound] = useState<SpeciesShown>()
  const speciesMatching = speciesFound?.words === words ? speciesFound.count : undefined

  // A section named by the address takes focus once it is drawn: on arrival,
  // when Back or Forward changes it, and when its link is followed again.
  // A search hiding it is cleared, adjusting state while rendering, as React
  // advises, rather than in an effect after a frame of the wrong thing.
  const [arrivedAt, setArrivedAt] = useState(section)
  if (section !== arrivedAt) {
    setArrivedAt(section)
    if (section !== undefined) setQuery('')
  }
  const focusWanted = useRef(section)
  useEffect(() => {
    focusWanted.current = section
  }, [section])
  const [, askForFocus] = useState(0)
  const contents = [
    { id: 'species', short: 'Find your next companion' },
    ...(region ? [{ id: 'region', short: 'Where you live' }] : []),
    ...sections.map(({ id, short }) => ({ id, short })),
  ]
  useEffect(() => {
    const wanted = focusWanted.current
    if (wanted === undefined) return
    const heading = document.getElementById(headingId(wanted))
    if (heading) heading.focus()
    // Drawn, or never will be: a name in the address the Guide has no section
    // for simply opens it at the top. One that is known but not yet drawn,
    // while a cleared search settles, is tried again after the next render.
    if (heading || !contents.some((item) => item.id === wanted)) focusWanted.current = undefined
  })

  const follow = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return
    event.preventDefault()
    setQuery('')
    focusWanted.current = id
    onOpenSection?.(id)
    askForFocus((count) => count + 1)
  }

  const returnLabel = returnTo ? RETURN_LABELS[returnTo] : undefined
  return (
    <div className="view guide-view">
      <header className="page-header">
        <div>
          <p className="eyebrow">Marigold's field guide</p>
          <h1>How the garden works</h1>
          <p>
            Everything in one place — from your first Sunlight to a garden full
            of butterflies in tiny hats.
          </p>
        </div>
        {returnLabel && onReturn && (
          <button className="secondary-button guide-return" onClick={onReturn}>
            <span aria-hidden="true">←</span> {returnLabel}
          </button>
        )}
      </header>
      <nav className="card guide-contents" aria-labelledby="guide-contents-title">
        <h2 id="guide-contents-title">In this guide</h2>
        <label className="guide-search">
          Search the guide
          <input
            type="search"
            value={query}
            placeholder="Try Stardust, Monarch or Milkweed…"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <ul>
          {contents.map((item) => (
            <li key={item.id}>
              <a
                href={hashForRoute({ view: 'guide', section: item.id })}
                onClick={(event) => follow(event, item.id)}
              >
                {item.short}
              </a>
            </li>
          ))}
        </ul>
        <p className="subtle-copy guide-search-status" role="status">
          {!searching
            ? ''
            : sectionsMatching > 0
              ? `${counted(sectionsMatching, 'section matches', 'sections match')}.`
              : speciesMatching === undefined
                ? ''
                : speciesMatching > 0
                  ? `No section matches; ${counted(speciesMatching, 'butterfly below does', 'butterflies below do')}.`
                  : 'Nothing in the Guide matches.'}
        </p>
      </nav>
      <p className="subtle-copy guide-sighting-status" role="status">
        {logged}
      </p>
      <SpeciesDirectory
        state={state}
        onShowSeed={onShowSeed}
        words={words}
        region={region}
        seen={seen}
        onShown={setSpeciesFound}
        onLogSighting={
          onChangeSightings
            ? (subject, opener) => {
                loggedFrom.current = opener
                setLogged('')
                setLogging(subject)
              }
            : undefined
        }
      />
      {logging && onChangeSightings && (
        <Suspense fallback={null}>
          <SightingForm
            sightings={state.sightings}
            region={region}
            today={today}
            subject={logging}
            onSave={(input) => {
              const actions = fieldBookActions(onChangeSightings)
              if (actions.log(input) === undefined) return false
              // With a photo, "saved" waits for the photo to be stored.
              photoSaved.current = input.photo && actions.photoSaved(input.photo)
              return true
            }}
            onClose={(saved) => {
              setLogging(undefined)
              loggedFrom.current?.focus()
              if (!saved) return
              const words = 'Saved to your field book, in the Journal’s field notes.'
              const waiting = photoSaved.current
              photoSaved.current = undefined
              if (!waiting) setLogged(words)
              else void waiting.then((kept) => setLogged(kept === true ? words : photoNotSaved(kept)))
            }}
          />
        </Suspense>
      )}
      {region && regionShown && <RegionGuide region={region} />}
      <div className="guide-grid">
        {shown.map((item) => (
          <section className="card guide-card" key={item.id}>
            <span className="guide-icon">
              <Icon name={item.icon} size={24} />
            </span>
            <p className="eyebrow">{item.eyebrow}</p>
            <h2 id={headingId(item.id)} tabIndex={-1}>
              {item.title}
            </h2>
            {item.paragraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 24)}>{paragraph}</p>
            ))}
          </section>
        ))}
      </div>
      {onOpenSupport && (
        <p className="support-link-note">
          The garden is a place for small acts of care, not a stand-in for a
          person.{' '}
          <button className="text-button" onClick={onOpenSupport}>
            If you need support now
          </button>
        </p>
      )}
    </div>
  )
}
