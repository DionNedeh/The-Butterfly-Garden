import { useRef } from 'react'
import type { AppView } from '../types'
import {
  inDockOrder,
  isMorePage,
  labelWithBadge,
  moreBadge,
  type NavItem,
} from '../lib/navigation'
import { Icon } from './Icons'

interface NavProps {
  items: readonly NavItem[]
  /** The page on screen. */
  current: AppView
  onNavigate: (view: AppView) => void
}

/** The dot that marks a badge. Its words are in the button's name. */
function BadgeDot() {
  return <span className="nav-badge" aria-hidden="true" />
}

function NavButton({
  item,
  current,
  onNavigate,
  className = '',
}: {
  item: NavItem
  current: AppView
  onNavigate: (view: AppView) => void
  className?: string
}) {
  const here = current === item.id
  return (
    <button
      className={`${className}${here ? ' active' : ''}`.trim() || undefined}
      onClick={() => onNavigate(item.id)}
      aria-current={here ? 'page' : undefined}
      aria-label={labelWithBadge(item)}
    >
      <Icon name={item.icon} />
      <span>{item.label}</span>
      {item.badge && <BadgeDot />}
    </button>
  )
}

/** Every page in a row across the header, on screens wide enough for it. */
export function PrimaryNav({ items, current, onNavigate }: NavProps) {
  return (
    <nav aria-label="Primary navigation">
      {items.map((item) => (
        <NavButton key={item.id} item={item} current={current} onNavigate={onNavigate} />
      ))}
    </nav>
  )
}

/**
 * The dock at the foot of smaller screens. On a phone it is one row of five:
 * the everyday pages and More, which opens a sheet with the rest. Every tab
 * is rendered, and the stylesheet (garden-3.css, android.css) decides which
 * show, so the dock never waits on script to fit the screen. On a tablet
 * every page has its own tab, as before, and More is not shown.
 *
 * The sheet is part of the shell rather than lazily loaded: it is the only way
 * to four pages on a phone, so it must open even when nothing can be fetched.
 */
export function BottomNav({ items, current, onNavigate }: NavProps) {
  const sheet = useRef<HTMLDialogElement>(null)
  const moreTab = useRef<HTMLButtonElement>(null)
  const badge = moreBadge(items)
  const moreHere = isMorePage(items, current)
  const close = () => sheet.current?.close()
  return (
    <>
      <nav className="bottom-nav" aria-label="Mobile navigation">
        {inDockOrder(items).map((item) => (
          <NavButton
            key={item.id}
            item={item}
            current={current}
            onNavigate={onNavigate}
            className={item.inMore ? 'in-more' : ''}
          />
        ))}
        <button
          ref={moreTab}
          className={`more-tab${moreHere ? ' active' : ''}`}
          onClick={() => sheet.current?.showModal()}
          aria-current={moreHere ? 'page' : undefined}
          aria-haspopup="dialog"
          aria-label={labelWithBadge({ label: 'More', badge })}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="5" cy="12" r="1.9" />
            <circle cx="12" cy="12" r="1.9" />
            <circle cx="19" cy="12" r="1.9" />
          </svg>
          <span>More</span>
          {badge && <BadgeDot />}
        </button>
      </nav>
      {/* Escape, Android's back gesture (lib/backNavigation), Close, a tap
          outside the sheet and choosing a page all end in its close event,
          which hands focus back to More. */}
      <dialog
        ref={sheet}
        className="more-sheet"
        aria-labelledby="more-sheet-title"
        onClose={() => moreTab.current?.focus()}
        onClick={(event) => {
          // The sheet's body fills the dialog, so only a tap on the backdrop
          // lands on the dialog itself.
          if (event.target === event.currentTarget) close()
        }}
      >
        <div className="more-sheet-body">
          <div className="more-sheet-heading">
            <h2 id="more-sheet-title">More</h2>
            <button className="secondary-button" onClick={close}>
              Close
            </button>
          </div>
          <ul className="more-sheet-pages">
            {items
              .filter((item) => item.inMore)
              .map((item) => (
                <li key={item.id}>
                  <NavButton
                    item={item}
                    current={current}
                    onNavigate={(view) => {
                      close()
                      onNavigate(view)
                    }}
                  />
                </li>
              ))}
          </ul>
        </div>
      </dialog>
    </>
  )
}
