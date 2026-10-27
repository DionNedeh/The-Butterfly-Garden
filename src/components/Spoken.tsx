import { JAR_MARK_NAMES } from '../data/jars'

/**
 * Words shown one way and said another: what is on screen stays as it is,
 * and a screen reader hears `spoken` in its place. With nothing different
 * to say, the words are simply shown, and said as shown.
 */
export function Spoken({ text, spoken }: { text: string; spoken?: string }) {
  if (spoken === undefined || spoken === text) return text
  return (
    <>
      <span aria-hidden="true">{text}</span>
      <span className="sr-only">{spoken}</span>
    </>
  )
}

/**
 * A jar's character in a line of text: a mark shown as itself and said by
 * its name, which a screen reader would otherwise pass over, so a "!" jar
 * and a "?" jar never sound the same. Any other character is just itself.
 */
export function JarCharacter({ character }: { character: string }) {
  return <Spoken text={character} spoken={JAR_MARK_NAMES[character]} />
}
