import { speciesFacts } from '../data/speciesFacts'
import { factsShared, nextFactLevel } from '../lib/speciesFacts'
import './fieldFacts.css'

/**
 * A species' facts, as many as a bond `level` has shared (lib/speciesFacts),
 * and a quiet word on when the next one comes. Care shows a companion's own
 * bond; the Journal's field notes the deepest bond with any of the species.
 */
export function FieldFacts({ speciesId, level }: { speciesId: string; level: number }) {
  const known = speciesFacts[speciesId]
  if (!known) return null
  const next = nextFactLevel(level)
  return (
    <>
      {known.facts.slice(0, factsShared(level)).map((fact) => (
        <p className="field-fact" key={fact}>
          {fact}
        </p>
      ))}
      {next !== undefined && <p className="fact-hint">Bond level {next} shares another.</p>}
    </>
  )
}
