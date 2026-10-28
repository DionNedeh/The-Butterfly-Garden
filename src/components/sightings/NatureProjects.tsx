import { useId } from 'react'
import { INATURALIST, regionalNatureProjects } from '../../data/natureProjects'
import type { RegionId } from '../../types'
import './sightings.css'

/**
 * Citizen-science projects a gardener could share sightings with, if they
 * like: the one nearest their region, where there is one, and iNaturalist,
 * which works anywhere (data/natureProjects). Plain links that open in the
 * browser, as the support page's do; the app sends nothing anywhere, and
 * says so.
 */
export function NatureProjects({ region }: { region?: RegionId }) {
  const titleId = useId()
  const nearby = region && region !== 'elsewhere' ? regionalNatureProjects[region] : undefined
  const projects = nearby ? [nearby, INATURALIST] : [INATURALIST]
  return (
    <section className="nature-projects" aria-labelledby={titleId}>
      <h3 id={titleId}>Share with a nature project, if you like</h3>
      <p className="subtle-copy">
        These links leave the garden and open in your browser. Nothing from
        your field book goes with them: what you share there, you share
        yourself.
      </p>
      <ul>
        {projects.map((project) => (
          <li key={project.href}>
            <a
              className="nature-project-link"
              href={project.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              {project.name}{' '}
              <span className="sr-only">(opens in your browser)</span>
              <span aria-hidden="true"> ↗</span>
            </a>
            <p>{project.about}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
