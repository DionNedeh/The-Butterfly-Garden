import { useState } from 'react'
import { companionStory } from '../../lib/companionStory'
import { formatDayInWords, formatWelcomedOn } from '../../lib/fieldNotes'
import { counted, listed } from '../../lib/plural'
import type { CreatureInstance, Profile } from '../../types'

/** "once", "twice", "5 times": how often a kind of care was given. */
function times(count: number): string {
  if (count === 1) return 'once'
  if (count === 2) return 'twice'
  return counted(count, 'time', 'times')
}

/**
 * A companion's story: the days its life began and changed, how many days it
 * was cared for, the care it was given most and the outfits it wore. Folded
 * until asked for, like the Journal's field notes, and worked out only then.
 * What the garden did not keep is said plainly, never filled in.
 */
export function CompanionStory({
  creature,
  profile,
}: {
  creature: CreatureInstance
  profile?: Pick<Profile, 'diarySince'>
}) {
  const [open, setOpen] = useState(false)
  const story = open ? companionStory(creature, profile) : undefined
  const welcomedOn = formatWelcomedOn(creature)
  const whole = story?.diary.kind === 'whole'

  return (
    <details
      className="card companion-story"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <span>
          <span className="eyebrow">Remembered</span>
          <strong>{creature.name}’s story</strong>
        </span>
      </summary>
      {story && (
        <>
          <dl className="story-list">
            <div>
              <dt>Welcomed</dt>
              <dd>
                {welcomedOn ? `${welcomedOn}, as ` : 'As '}
                {story.arrivedAs === 'egg' ? 'an egg' : 'a caterpillar'}
              </dd>
            </div>
            {story.hatchedOn && (
              <div>
                <dt>Hatched</dt>
                <dd>{formatDayInWords(story.hatchedOn)}</dd>
              </div>
            )}
            {story.chrysalisOn && (
              <div>
                <dt>Became a chrysalis</dt>
                <dd>{formatDayInWords(story.chrysalisOn)}</dd>
              </div>
            )}
            {story.emergedOn && (
              <div>
                <dt>Emerged</dt>
                <dd>{formatDayInWords(story.emergedOn)}</dd>
              </div>
            )}
            <div>
              <dt>Days cared for</dt>
              <dd>
                {story.daysCaredFor > 0
                  ? counted(story.daysCaredFor, 'day', 'days')
                  : 'None yet'}
              </dd>
            </div>
            {(story.favourite || whole) && (
              <div>
                <dt>Favourite care</dt>
                <dd>
                  {story.favourite
                    ? `${story.favourite.name}, ${times(story.favourite.count)}`
                    : 'None yet'}
                </dd>
              </div>
            )}
            {(story.outfitsWorn.length > 0 || whole) && (
              <div>
                <dt>Outfits worn</dt>
                <dd>
                  {story.outfitsWorn.length > 0 ? listed(story.outfitsWorn) : 'None yet'}
                </dd>
              </div>
            )}
          </dl>
          {story.diary.kind === 'began' && (
            <p className="story-note">
              This garden began keeping a diary on{' '}
              {formatDayInWords(story.diary.on)}, so some of {creature.name}’s
              story from before then was never written down.
            </p>
          )}
          {story.diary.kind === 'not-begun' && (
            <p className="story-note">
              This garden keeps a diary from now on: the care {creature.name}{' '}
              is given and the outfits {creature.name} wears will be written
              down here.
            </p>
          )}
        </>
      )}
    </details>
  )
}
