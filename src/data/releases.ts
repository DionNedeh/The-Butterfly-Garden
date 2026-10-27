import { isAndroidApp } from '../lib/platform'

/**
 * What changed, release by release.
 *
 * Local data so release notes are readable offline, and immutable so a running
 * build can only ever describe itself. Nothing here is fetched, and nothing is
 * rendered as HTML: entries are plain strings that React escapes like any
 * other text.
 *
 * Only shipped and verified work belongs here. An entry describing something
 * planned would tell gardeners a feature is in the version they are running
 * when it is not.
 *
 * Only the What's new page reads these notes, so they are never part of the
 * garden's first load. What the app needs on every launch, the current
 * release's id and version, is in data/currentRelease.
 */
export interface ReleaseSection {
  title: string
  items: string[]
}

export interface ReleaseNote {
  /** Stable; `lastSeenReleaseId` in the profile refers to it. */
  id: string
  version: string
  /** ISO date. Left undefined until a release actually goes out. */
  releasedOn?: string
  title: string
  sections: ReleaseSection[]
}

/**
 * Newest first; the first is the release this build is (data/currentRelease).
 *
 * Each entry deliberately lists only what has landed. Sections are added as
 * each area is finished rather than written ahead of the work, so this file is
 * never a promise.
 */
export const releases: ReleaseNote[] = [
  {
    id: 'release-3-2',
    version: '3.2.0',
    title: 'New ways to care',
    sections: [
      {
        title: 'In the garden',
        items: [
          'Breathe with a butterfly: its wings open as you breathe in and close as you breathe out, for one, three or five minutes. Finishing counts as care, once a day.',
          'A young companion can grow alongside one of your goals, and each day the goal is done counts as a day of its care.',
          'Settings can add a daily garden visit to your own calendar. Your calendar does the reminding; the garden sends nothing.',
          'On Sunday evening a letter from Marigold says what your week held. It quotes only lines you star in your journal, or none at all.',
        ],
      },
    ],
  },
  {
    id: 'release-3-1',
    version: '3.1.0',
    releasedOn: '2026-10-27',
    title: 'A kinder rhythm',
    sections: [
      {
        title: 'Today',
        items: [
          'A check-in starts with nothing chosen, and “Not sure today” is an answer of its own. Once you choose, you can add up to five feeling words and your energy.',
          'After a check-in, one gentle next step is offered, and “Not now” puts it away.',
          'Goals sit in compact rows, with Skip, Snooze, Edit and Archive behind ⋯. On a touch screen a swipe completes or skips, and most actions can be undone for a few seconds.',
          'A gentle day shows your first three goals and no counts, until midnight.',
          'Twenty-four goal ideas across the NHS five steps and rest, most with a two-minute version, and sixty reflection prompts with Another prompt and Write freely.',
          'You can choose which plant your next Sunlight tends.',
        ],
      },
      {
        title: 'Moonlight',
        items: [
          'The evening recap says what your day held, keeps up to three notes for tomorrow that can each become a goal, and can end by fading the garden to night.',
          'The hours it opens and closes can be moved in Settings.',
        ],
      },
      {
        title: 'Your journal',
        items: [
          'Days you cared for yourself take the place of the streak, and a missed day never resets them. Settings can hide the numbers.',
          'Search your journal, see a weather calendar by month or a year at a glance, and keep your words as Markdown, a printable page, or check-ins as a spreadsheet.',
          'On this day brings back an entry from a month or a year ago.',
          'You can write for a day you missed. It is marked “Written later” and earns nothing.',
        ],
      },
      {
        title: 'Garden and companions',
        items: [
          'A new egg arrives with a name you can keep or change.',
          'Each butterfly flies in a lane of sky of its own. Tap one to meet it, pet it, or go to its care, where it can have a flight pattern of its own.',
          'Care keeps each companion’s story, saves looks to wear again, and says what the next bond level brings.',
          'Keep giving, a garden pace in Settings, lets a host plant in full bloom bloom again.',
          'A small welcome back after a few days away, and Plant a seed says why when it cannot.',
          'Your own images can be turned, made brighter or darker, and one kept for the night.',
        ],
      },
      {
        title: 'Guide',
        items: [
          'Every species’ fact was checked against field guides, and two more open up as your bond with a companion grows.',
          'My region, in Settings, marks the butterflies and plants native where you garden, with plants to grow for them.',
          'The Guide has contents and one search, and “What does this do?” links open the right part and bring you back.',
        ],
      },
      {
        title: 'Shop',
        items: [
          'Every purchase says what happened, or why nothing was spent. Supplies can be bought one, three or five at a time.',
          'On a phone, the shop’s filters wait behind one Filter button.',
          'Alike jars stack on your shelf, a jar on no plant can be recycled for half its Nectar, with a few seconds to undo, and jars take accented capitals and a few marks.',
          'On the Garden Pass tab, Owned shows the pieces you can wear.',
        ],
      },
      {
        title: 'Sound',
        items: [
          'Two new soundscapes, Soft Rain and Dawn Birdsong, with a volume, a piano that night can bring, and an optional fade-out after 15, 30 or 60 minutes.',
          ...(isAndroidApp()
            ? []
            : ['You choose whether the sound keeps playing in the background.']),
        ],
      },
      {
        title: 'Settings and the app',
        items: [
          'The theme can follow your device or your evening, and text comes in three sizes.',
          'On a phone, five tabs and a More sheet, with today’s Sunlight kept in the header.',
          'A new garden is offered up to three starter goals, and told where it is kept.',
          isAndroidApp()
            ? 'A gentle note in Settings when your last backup is a month old.'
            : 'A gentle note in Settings when your last backup is a month old, and Share backup… where the browser can share a file.',
          '“If you need support now” lists crisis lines, from Settings, the Guide and after a stormy check-in.',
          'What’s new opens by itself once after an update.',
          ...(isAndroidApp()
            ? []
            : [
                'The installed app has shortcuts to Check in, Today and Journal.',
                'Updates are looked for while the garden is open, and Update now reloads every open tab together.',
                'On iPhone and iPad, a short guide shows how to add the garden to your Home Screen, where Safari’s seven-day clean-up does not reach it.',
              ]),
        ],
      },
    ],
  },
  {
    id: 'release-3-0',
    version: '3.0.0',
    title: 'A livelier garden',
    sections: [
      {
        title: 'A garden made personal',
        items: [
          'Four new illustrated scenes, plus your own images with local cropping and media-inclusive garden backups.',
          isAndroidApp()
            ? 'Garden Pass outfits, scenes and personal backdrops come with the optional Garden Pass subscription.'
            : 'Garden Pass is a free PWA preview. No subscription or payment is active.',
        ],
      },
      {
        title: 'Little treasures',
        items: [
          'Twelve new cosmetics, coloured glass letter jars, and a boutique with search, filters and try-on previews.',
          'Headwear and accessories now move with their companion, including caterpillar accessories.',
        ],
      },
      {
        title: 'From seed to wings',
        items: [
          'A complete 25-species directory shows which host to plant and what your current garden can welcome next.',
          'Smooth generated flight tracks are shared by the garden and its miniature previews.',
        ],
      },
      {
        title: 'A softer place to return to',
        items: [
          'Refined botanical surfaces, clearer navigation and solid journal timeline dots.',
        ],
      },
      {
        title: 'Flight',
        items: [
          'Six more flight patterns to choose between: Clover Meander, Breeze Glide, Blossom Bounce, Ribbon Loop, Moonbeam Float and Canopy Dance.',
        ],
      },
      {
        title: isAndroidApp() ? 'Garden Pass' : 'Garden Pass preview',
        items: [
          isAndroidApp()
            ? 'Every Garden Pass outfit can be tried on in the shop before you decide; the subscription is sold through Google Play.'
            : 'Garden Pass outfits are included free in this release so you can try them. No subscription or payment is active.',
        ],
      },
      {
        title: 'Smaller things',
        items: [
          'The garden counts species welcomed rather than butterflies, so two of the same species read as one.',
        ],
      },
    ],
  },
]

export function getRelease(id: string): ReleaseNote | undefined {
  return releases.find((release) => release.id === id)
}
