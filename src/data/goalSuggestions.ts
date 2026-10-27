/**
 * Ideas for small goals, offered on Today and while a new garden is made.
 *
 * Each is tagged with one of the NHS "Five steps to mental wellbeing"
 * (connect, be active, keep learning, give, notice) or with rest, so the
 * ideas offered can be a mix rather than six ways to drink water. Each is
 * something anyone can do today: nothing that costs money, and nothing that
 * needs someone else to answer or agree.
 *
 * Most have a two-minute version for days that ask for less. One that is
 * already that small, or that should never be made smaller (medication),
 * has none.
 *
 * Kept apart from data/content.ts, which loads with the garden itself: only
 * Today and onboarding need these, and both load later.
 */

/** The NHS's five steps, and rest. In the order ideas are offered: gentlest first. */
export const WELLBEING_TAGS = ['rest', 'notice', 'active', 'connect', 'learn', 'give'] as const

export type WellbeingTag = (typeof WELLBEING_TAGS)[number]

export interface GoalSuggestion {
  title: string
  /** The same act made small enough for two minutes, where that makes sense. */
  tinyTitle?: string
  tag: WellbeingTag
}

export const goalSuggestions: readonly GoalSuggestion[] = [
  { tag: 'rest', title: 'Drink a glass of water', tinyTitle: 'Take three sips' },
  { tag: 'rest', title: 'Eat something nourishing', tinyTitle: 'Have a small snack' },
  { tag: 'rest', title: 'Rest without multitasking', tinyTitle: 'Sit still for a minute' },
  { tag: 'rest', title: 'Take prescribed medication' },

  { tag: 'notice', title: 'Take three slow breaths' },
  { tag: 'notice', title: 'Notice something beautiful', tinyTitle: 'Look up at the sky' },
  { tag: 'notice', title: 'Listen to the sounds around you', tinyTitle: 'Name one sound you hear' },
  { tag: 'notice', title: 'Write down one thought' },

  { tag: 'active', title: 'Step outside for two minutes', tinyTitle: 'Stand by an open window' },
  { tag: 'active', title: 'Stretch your shoulders', tinyTitle: 'Roll your shoulders' },
  { tag: 'active', title: 'Take a gentle ten-minute walk', tinyTitle: 'Walk to the door and back' },
  { tag: 'active', title: 'Move to a song you like', tinyTitle: 'Tap along to a chorus' },

  { tag: 'connect', title: 'Send a kind message', tinyTitle: 'Send a quick hello' },
  { tag: 'connect', title: 'Write a few lines to a friend', tinyTitle: 'Write them one line' },
  {
    tag: 'connect',
    title: 'Look at a photo of someone you love',
    tinyTitle: 'Think of them for a moment',
  },
  {
    tag: 'connect',
    title: 'Share something that made you smile',
    tinyTitle: 'Send one photo you like',
  },

  { tag: 'learn', title: 'Read a few pages of a book', tinyTitle: 'Read one page' },
  {
    tag: 'learn',
    title: 'Look up something you wondered about',
    tinyTitle: 'Read one paragraph about it',
  },
  { tag: 'learn', title: 'Work on a skill you enjoy', tinyTitle: 'Try it for two minutes' },
  {
    tag: 'learn',
    title: 'Learn a few words in another language',
    tinyTitle: 'Learn one word',
  },

  {
    tag: 'give',
    title: 'Write a note of thanks to someone',
    tinyTitle: 'Write one line of thanks',
  },
  {
    tag: 'give',
    title: 'Set aside something to give away',
    tinyTitle: 'Choose one thing to pass on',
  },
  { tag: 'give', title: 'Do one small chore for someone', tinyTitle: 'Put away one small thing' },
  { tag: 'give', title: 'Pick up one piece of litter' },
]
