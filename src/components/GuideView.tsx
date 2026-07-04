import { STAGE_CARE_DAYS } from '../lib/lifecycle'
import {
  DAILY_SEED_REWARD,
  DAILY_SUNLIGHT_CAP,
  NECTAR_PER_SUNLIGHT,
  PLANT_SEED_COST,
} from '../lib/progression'
import { Icon } from './Icons'

interface GuideSection {
  icon: Parameters<typeof Icon>[0]['name']
  eyebrow: string
  title: string
  paragraphs: string[]
}

const sections: GuideSection[] = [
  {
    icon: 'sun',
    eyebrow: 'The heart of the garden',
    title: 'Sunlight — care for yourself first',
    paragraphs: [
      `Everything begins with your own self-care. Checking in with your mood, completing a goal, or writing a reflection each earn one Sunlight, up to ${DAILY_SUNLIGHT_CAP} per day.`,
      `Every Sunlight converts into ${NECTAR_PER_SUNLIGHT} Nectar for the shop, grows one of your plants a step, and your first Sunlight each day adds ${DAILY_SEED_REWARD} seed to your tray. Nothing is ever lost on a hard day — the garden simply waits.`,
    ],
  },
  {
    icon: 'seed',
    eyebrow: 'Growing things',
    title: 'Seeds, plants, and butterfly eggs',
    paragraphs: [
      `Each seed plants one flower, shrub, or tree (${PLANT_SEED_COST} seed per plant, up to 8 spaces in the scene). Host plants shelter particular butterfly species; nectar plants feed everyone.`,
      'Plants grow one stage per Sunlight: seed, sprout, budding, full bloom. When a host plant reaches full bloom, look closely — a butterfly egg appears on its leaves, and a new companion begins.',
    ],
  },
  {
    icon: 'care',
    eyebrow: 'From egg to wings',
    title: 'The life cycle and care days',
    paragraphs: [
      `Every companion passes through four stages: egg, caterpillar, chrysalis, butterfly. Each stage before butterfly needs ${STAGE_CARE_DAYS} days of care to advance — and the days never need to be consecutive. Care on Monday, rest all week, care twice more later: that counts.`,
      'Any one care activity on a day marks that day as cared-for. The Care page shows dots for each stage: fill all three and your companion transforms, with a little celebration of Nectar (and Stardust and seeds when a butterfly emerges).',
      'Butterflies never stop needing you. Their care days keep counting forever and every activity deepens your bond.',
    ],
  },
  {
    icon: 'leaf',
    eyebrow: 'Daily tending',
    title: 'Care activities and supplies',
    paragraphs: [
      'Each stage has its own care menu: eggs like warmth, mist, and lullabies; caterpillars love fresh leaves, berry treats, dew baths, playtime, and being tucked in; chrysalises want mist, sunbeams, and encouragement; butterflies enjoy nectar sips, fruit, puddling baths, grooming, and flying with you.',
      'Every activity can be done once per companion per day. Some use a supply from your satchel — leaves, spring water, bath dew, nectar drops, fruit slices — bought with Nectar in the Shop. Free activities are always available, so you can care every day even with an empty satchel.',
    ],
  },
  {
    icon: 'care',
    eyebrow: 'A friendship meter',
    title: 'Bond levels',
    paragraphs: [
      'Every care activity earns bond points (supply-based ones earn more). Each bond level rewards you with Stardust and Nectar, and there is no ceiling — a butterfly you have loved for months keeps giving back.',
    ],
  },
  {
    icon: 'nectar',
    eyebrow: 'Two currencies',
    title: 'Nectar and Stardust',
    paragraphs: [
      'Nectar is the everyday currency: earned from Sunlight, spent on supplies, outfits, jars, and flight patterns.',
      'Stardust is rarer: earned from bond level-ups and butterfly emergences, spent on prestige cosmetics like the Star Diadem and Firefly Glow. Save it for the pieces you love.',
    ],
  },
  {
    icon: 'bow',
    eyebrow: 'Dress-up',
    title: 'The Boutique and wardrobe',
    paragraphs: [
      'Cosmetics come in three slots — headwear, accessories, and auras — and each lists the life stages it fits. Buy once, dress everyone: your whole garden shares one closet, managed from each companion\'s wardrobe on the Care page.',
      'If a companion changes stage and an item no longer fits, it is only hidden, never lost.',
    ],
  },
  {
    icon: 'crown',
    eyebrow: 'Something to look forward to',
    title: 'The Garden Pass',
    paragraphs: [
      'A very exclusive corner of the shop displays seasonal regalia — the Royal Monarch Crown, Aurora Veil, Rainbow Trail, and Celestial Cape. These unlock with the Garden Pass in a future update. For now, they are lovely to look at.',
    ],
  },
  {
    icon: 'today',
    eyebrow: 'Gentle structure',
    title: 'Goals, skipping, and snoozing',
    paragraphs: [
      'Goals can repeat daily, on chosen weekdays, or happen just once. Completing one earns Sunlight.',
      'Not every day has room for every goal. Skip sets a goal aside for today with zero penalty — it simply rests. Snooze tucks it away until tomorrow, and planned one-time goals move to the new day automatically. You can wake a snoozed goal any time.',
    ],
  },
  {
    icon: 'journal',
    eyebrow: 'Seeing the month',
    title: 'The calendar planner',
    paragraphs: [
      'The calendar on the Today page shows your whole month: dots for the goals landing on each day, suns for days you gathered Sunlight, and your mood\'s weather. Tap any upcoming day to plan a one-time goal for it — future you will find it waiting on the right morning.',
    ],
  },
  {
    icon: 'shop',
    eyebrow: 'Keepsakes',
    title: 'Letter jars',
    paragraphs: [
      'Letter and number jars are decorative keepsakes for your plant spots. Buy any character in any color, then place it from a plant\'s detail panel in the Garden. Spell names, dates, or tiny messages across your flowerbed.',
    ],
  },
  {
    icon: 'flight',
    eyebrow: 'Ways of flying',
    title: 'Flight patterns',
    paragraphs: [
      'Flight patterns change how your butterflies move through the garden scene — drifting, petal-hopping, figure eights, spirals. Buy them in the Shop, choose the active one on the Flight page.',
    ],
  },
  {
    icon: 'music',
    eyebrow: 'Set the mood',
    title: 'Ambient garden sound',
    paragraphs: [
      'The note button in the header plays a soft, endless garden soundscape — breeze, wind chimes, and distant birdsong — generated right on your device, so it works offline and never repeats. Toggle it off any time; your choice is remembered.',
    ],
  },
  {
    icon: 'moon',
    eyebrow: 'Yours alone',
    title: 'Privacy, offline, and backdrops',
    paragraphs: [
      'Everything lives on this device — moods, reflections, goals, and garden. There are no accounts and nothing is uploaded. The app works fully offline once installed.',
      'New garden backdrops unlock as your garden ages: the Woodland Brook after 30 days and the Secret Conservatory after 60. Switch them in Settings.',
    ],
  },
]

export function GuideView() {
  return (
    <div className="view guide-view">
      <header className="page-header">
        <div>
          <p className="eyebrow">Marigold's field guide</p>
          <h1>How the garden works</h1>
          <p>
            Everything in one place — from your first Sunlight to a garden
            full of butterflies in tiny hats.
          </p>
        </div>
      </header>
      <div className="guide-grid">
        {sections.map((section) => (
          <section className="card guide-card" key={section.title}>
            <span className="guide-icon">
              <Icon name={section.icon} size={24} />
            </span>
            <p className="eyebrow">{section.eyebrow}</p>
            <h2>{section.title}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 24)}>{paragraph}</p>
            ))}
          </section>
        ))}
      </div>
    </div>
  )
}
