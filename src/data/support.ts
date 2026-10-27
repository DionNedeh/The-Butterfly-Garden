/**
 * Where to find a person to talk to, for the "If you need support now" page.
 *
 * Every entry was checked against the service's own site on the date below,
 * and must be checked again before each release: a wrong crisis number is
 * worse than none, and was found in 9% of depression apps studied (Martinengo
 * et al. 2019). Links only hand off to the phone's dialler, messages app or
 * browser; the app itself makes no request.
 */
export const SUPPORT_CHECKED_ON = '2026-10-26'

export interface SupportLine {
  id: string
  /** Where the service answers. */
  region: string
  name: string
  /** One plain sentence: who it is for and when it is open. */
  about: string
  contacts: Array<{ label: string; href: string }>
}

export const supportLines: readonly SupportLine[] = [
  {
    id: 'us-988',
    region: 'United States',
    name: '988 Suicide & Crisis Lifeline',
    about: 'Free and private, any time of day, for anyone in emotional distress, not only a crisis.',
    contacts: [
      { label: 'Call 988', href: 'tel:988' },
      { label: 'Text 988', href: 'sms:988' },
      { label: 'Chat online', href: 'https://chat.988lifeline.org/' },
    ],
  },
  {
    id: 'ca-988',
    region: 'Canada',
    name: '9-8-8 Suicide Crisis Helpline',
    about: 'Free, any time of day, every day of the year.',
    contacts: [
      { label: 'Call 9-8-8', href: 'tel:988' },
      { label: 'Text 9-8-8', href: 'sms:988' },
    ],
  },
  {
    id: 'uk-ie-samaritans',
    region: 'United Kingdom and Ireland',
    name: 'Samaritans',
    about: 'Free from landlines and mobiles, open 24 hours a day.',
    contacts: [{ label: 'Call 116 123', href: 'tel:116123' }],
  },
  {
    id: 'find-a-helpline',
    region: 'Everywhere else',
    name: 'Find A Helpline',
    about: 'Free, confidential helplines by phone, text or chat in more than 175 countries.',
    contacts: [{ label: 'Find a helpline near you', href: 'https://findahelpline.com/' }],
  },
]
