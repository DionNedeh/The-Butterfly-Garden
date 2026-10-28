import type { Season } from '../lib/seasons'
import type { ReflectionPrompt, ReflectionPromptFamily } from '../types'

/*
 * The reflection prompts live apart from data/content, which every page
 * waits for: only Today, the Journal and its exports read them, and those
 * arrive later. The free-writing prompt stays in data/content, since saving
 * any reflection needs its id.
 */

/**
 * Reflection prompts, in families.
 *
 * Kept to concrete "what" and "how" questions, which help people process a
 * day; abstract "why do I always…" questions feed rumination instead
 * (Watkins). No affirmations of character either: positive self-statements
 * can backfire for people with low self-esteem (Wood et al. 2009). The ids
 * are stored with every reflection, so an id is never reused or removed.
 */
const reflectionPromptRows: ReadonlyArray<
  readonly [id: string, text: string, family: ReflectionPromptFamily]
> = [
  ['notice', 'What is one small thing you noticed today?', 'noticing'],
  ['kindness', 'What would kindness toward yourself look like right now?', 'self-compassion'],
  ['lighter', 'What made today feel a little lighter?', 'savouring'],
  ['weather', 'If your inner weather could speak, what would it say?', 'processing'],
  ['enough', 'What was enough for today?', 'self-compassion'],
  ['release', 'What can you set down until tomorrow?', 'rest'],
  ['body', 'What is your body asking for?', 'rest'],
  ['care', 'Where did you offer care today?', 'connection'],
  ['support', 'What support would feel welcome?', 'connection'],
  ['steady', 'What helped you feel steady?', 'processing'],
  ['tiny-win', 'Name a tiny win that deserves to be remembered.', 'savouring'],
  ['curious', 'What are you curious about today?', 'noticing'],
  ['rest', 'What kind of rest might restore you?', 'rest'],
  ['boundary', 'What boundary protected your energy?', 'processing'],
  ['gratitude', 'What ordinary thing are you grateful for?', 'gratitude'],
  ['tomorrow', 'What gentle intention can you carry into tomorrow?', 'processing'],
  ['comfort', 'What brought you comfort recently?', 'savouring'],
  ['courage', 'Where did you show quiet courage?', 'self-compassion'],
  ['connection', 'When did you feel connected today?', 'connection'],
  ['pace', 'What would it mean to move at your own pace?', 'rest'],
  ['learned', 'What did today teach you about yourself?', 'processing'],
  ['begin', 'What is one easy place to begin?', 'processing'],
  ['protected', 'What deserves your attention, and what can wait?', 'processing'],
  ['garden', 'What would you like to nurture in your inner garden?', 'noticing'],
  ['sky', 'What did the sky look like the last time you looked up?', 'noticing'],
  ['outside-sound', 'What could you hear outside today?', 'noticing'],
  ['living-thing', 'Which living thing caught your eye today, and what was it doing?', 'noticing'],
  ['season', 'What tells you which season it is, right where you are?', 'noticing'],
  ['texture', 'What was the most pleasant thing you touched today?', 'noticing'],
  ['light', 'Where did the light fall nicely today?', 'noticing'],
  ['replay', 'Which moment from today would you happily live again?', 'savouring'],
  ['taste', 'What did you eat or drink today that you enjoyed?', 'savouring'],
  ['laughed', 'What made you smile or laugh, even a little?', 'savouring'],
  ['looking-forward', 'What is one small thing you are looking forward to?', 'savouring'],
  ['slowly', 'What did you do slowly today, on purpose or not?', 'savouring'],
  ['someone-helped', 'Who made something easier for you lately, and how?', 'gratitude'],
  ['place', 'What place are you glad exists?', 'gratitude'],
  ['tool', 'What everyday object made today a little easier?', 'gratitude'],
  ['past-self', 'What did a past version of you do that helps you now?', 'gratitude'],
  ['friend-words', 'If a friend had your day, what would you say to them?', 'self-compassion'],
  ['hard-thing', 'What felt hard today, and how did you get through it?', 'self-compassion'],
  ['allowed', 'What are you allowed to leave unfinished today?', 'self-compassion'],
  ['tried', 'What did you try today, whatever the result?', 'self-compassion'],
  ['soften', 'Where could you be a little softer with yourself this week?', 'self-compassion'],
  ['what-happened', 'What happened today, in three plain sentences?', 'processing'],
  ['next-step', 'What is the next small step on something that matters to you?', 'processing'],
  ['how-handled', 'How did you handle a moment that did not go to plan?', 'processing'],
  ['energy-gave', 'What gave you energy today, and what took it?', 'processing'],
  ['changed-mind', 'What did you see differently by the end of the day?', 'processing'],
  ['sleep-ready', 'What would help tonight feel restful?', 'rest'],
  ['pause', 'When did you pause today, even for a moment?', 'rest'],
  ['no-thanks', 'What could you say no to, kindly, to make room for rest?', 'rest'],
  ['quiet', 'Where did you find a little quiet today?', 'rest'],
  ['heard-from', 'Who did you hear from today, and how did it feel?', 'connection'],
  ['reach-out', 'Who would be glad to hear from you this week?', 'connection'],
  ['shared', 'What did you share with someone recently?', 'connection'],
  ['kind-act', 'What kind thing did you see someone do?', 'connection'],
  ['belong', 'Where do you feel you belong?', 'connection'],
  ['learn-small', 'What is one small thing you learned or would like to learn?', 'noticing'],
  ['made', 'What did you make, tidy or mend today?', 'savouring'],
  // Three good things in nature: noticing good things in everyday nature,
  // even a city's, lifted wellbeing in an app-based trial of 582 people
  // (McEwan et al. 2019). The field book keeps the butterflies and plants.
  ['nature-three', 'What were three good things you noticed in nature today?', 'nature'],
  ['nature-noticed', 'What did you notice in nature today?', 'nature'],
  ['nature-plant', 'Which plant caught your eye today, and what did you like about it?', 'nature'],
  ['nature-street', 'What bit of wild nature did you pass today, even in a street?', 'nature'],
]

export const reflectionPrompts: ReflectionPrompt[] = reflectionPromptRows.map(
  ([id, text, family]) => ({ id, text, family }),
)

/** A prompt that joins the rotation only in its own season (plan c.7). */
export interface SeasonalPrompt extends ReflectionPrompt {
  season: Season
}

/**
 * A few prompts for each season, offered only where the garden knows the
 * gardener's season: with a region chosen (lib/seasons, knownSeason), since
 * spring in March would be wrong for half the world. Concrete "what" and
 * "which" questions, like the rest, about the season where the gardener is.
 * Stored by id like any other prompt, so the same rule holds: never reused
 * or removed. (A build from before these shows such a reflection without its
 * question, as it does any prompt it does not know.)
 */
const seasonalPromptRows: ReadonlyArray<
  readonly [id: string, text: string, family: ReflectionPromptFamily, season: Season]
> = [
  ['spring-first-sign', 'What is the first sign of spring you have noticed near you?', 'nature', 'spring'],
  ['spring-growing', 'What is starting to grow or flower where you are?', 'nature', 'spring'],
  ['summer-noticed', 'Which flowers or insects of summer caught your eye lately?', 'nature', 'summer'],
  ['summer-evenings', 'What do you enjoy most about the longer evenings?', 'savouring', 'summer'],
  ['autumn-changing', 'What is changing in the trees and gardens near you this season?', 'nature', 'autumn'],
  ['autumn-comfort', 'What small comfort helps you settle into the cooler days?', 'rest', 'autumn'],
  ['winter-green', 'What is still green or alive outside, even in winter?', 'nature', 'winter'],
  ['winter-rest', 'What helps you rest and keep warm through the darker days?', 'rest', 'winter'],
]

export const seasonalPrompts: SeasonalPrompt[] = seasonalPromptRows.map(
  ([id, text, family, season]) => ({ id, text, family, season }),
)
