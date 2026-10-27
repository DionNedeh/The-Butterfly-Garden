import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react'
import {
  COMFORT_ITEMS,
  COMFORT_SECTIONS,
  COMFORT_TEXT_LENGTH,
  PHONE_LENGTH,
} from '../lib/comfortPlan'
import {
  addComfortItem,
  changeComfortItem,
  moveComfortItem,
  phoneProblem,
  removeComfortItem,
  restoreComfortItem,
  telHref,
  type ComfortWords,
} from '../lib/comfortPlanEdits'
import { useDraft } from '../lib/drafts'
import { hashForRoute } from '../lib/routes'
import type { AppView, ComfortItem, ComfortPlan, ComfortSection } from '../types'
import { UndoToast, type UndoOffer } from './UndoToast'
import './comfort/comfortLink.css'
import './comfort/comfort.css'

/** A change to the plan, from lib/comfortPlanEdits. */
type Change = (plan: ComfortPlan) => ComfortPlan

/** What the page's own back button says, for the page that opened it. */
const BACK_LABELS: Partial<Record<AppView, string>> = {
  today: 'Back to Today',
  settings: 'Back to Settings',
  support: 'Back to support',
}

interface SectionWords {
  title: string
  /** Shown while the list is empty: what might go there, never a request. */
  example: string
  /** The label of the field that adds a line: for people, the name. */
  field: string
}

/**
 * The plan's lists, in the app's own words. Kept plain and warm, and
 * nothing like a clinical form: this is the gardener's page, not a worksheet.
 */
const SECTIONS: Record<ComfortSection, SectionWords> = {
  helps: {
    title: 'Things that help me feel a little better',
    example: 'For example: a warm drink, a favourite song, or a slow walk around the block.',
    field: 'Something that helps',
  },
  people: {
    title: 'People I can reach',
    example:
      'For example: a friend who listens, someone in your family, or a neighbour. With a number, they are one tap away.',
    field: 'Name',
  },
  places: {
    title: 'Places that feel calm',
    example: 'For example: a bench by the water, the library, or a corner of your room with the lamp on.',
    field: 'A calm place',
  },
  kindWords: {
    title: 'Kind words for myself',
    example: 'For example: “I am doing the best I can today,” or what you would say to a friend.',
    field: 'Kind words',
  },
  matters: {
    title: 'What matters to me',
    example:
      'For example: the people and animals you love, a place you want to see, or something you are looking forward to.',
    field: 'Something that matters',
  },
}

/** The draft of the line being changed, which survives a reload with its words. */
const EDIT_DRAFT = 'comfort-edit'

/** The line open for changing, as its draft holds it. */
interface Editing {
  section: ComfortSection
  id: string
  text: string
  phone: string
}

function editingFrom(draft: string): Editing | undefined {
  if (!draft) return undefined
  try {
    const value = JSON.parse(draft) as Partial<Editing>
    if (
      COMFORT_SECTIONS.includes(value.section as ComfortSection) &&
      typeof value.id === 'string' &&
      typeof value.text === 'string' &&
      typeof value.phone === 'string'
    ) {
      return value as Editing
    }
  } catch {
    // A draft from elsewhere, or a broken one: nothing is open.
  }
  return undefined
}

/** A problem with what was typed, and the field it belongs to. */
interface Problem {
  field: 'text' | 'phone'
  message: string
}

/** Why these words cannot be kept yet, if they cannot. */
function problemWith(section: ComfortSection, words: ComfortWords): Problem | undefined {
  const phone = section === 'people' ? (words.phone ?? '') : ''
  if (!words.text.trim()) {
    return {
      field: 'text',
      message: phone.trim()
        ? 'Add a name too, so you know who this is.'
        : 'There are no words here yet.',
    }
  }
  const message = phoneProblem(phone)
  return message ? { field: 'phone', message } : undefined
}

/** A line's words as an Undo offer quotes them: the first few, whole words where possible. */
function quoted(text: string): string {
  if (text.length <= 40) return `“${text}”`
  const cut = text.slice(0, 40)
  return `“${cut.slice(0, cut.lastIndexOf(' ') > 20 ? cut.lastIndexOf(' ') : 40)}…”`
}

/**
 * Where focus goes once the page has redrawn, so it never falls to the page
 * body when the control pressed goes away: a list's heading, its field for
 * a new line, a control on one line, or the field of the line being changed.
 */
type FocusTarget =
  | { to: 'heading' | 'add'; section: ComfortSection }
  | { to: 'line'; id: string; control: 'edit' | 'up' | 'down' }
  | { to: 'edit'; field: Problem['field'] }

const headingId = (section: ComfortSection) => `comfort-${section}`
const addFieldId = (section: ComfortSection, field: Problem['field'] = 'text') =>
  `comfort-${section}-new-${field}`

/** An ordinary click follows the app's own way there; a modified one, the link's. */
function followed(event: MouseEvent<HTMLAnchorElement>): boolean {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return false
  }
  event.preventDefault()
  return true
}

/**
 * My comfort plan (plan c.8): a private page the gardener writes for harder
 * days, in their own words. Five short lists, each added to, changed,
 * reordered and removed from freely, Remove with an Undo. Words typed and
 * not yet kept are drafts, so a reload loses none of them.
 *
 * Nothing here asks to be filled in, and nothing anywhere else in the
 * garden quotes it. It begins with the way to people who can help, and says
 * plainly that it is no substitute for them.
 */
export function ComfortPlanView({
  plan = {},
  onChange,
  onOpenSupport,
  from,
  onBack,
}: {
  /** The plan as it stands; absent when nothing is written yet. */
  plan?: ComfortPlan
  /** Apply a change to the plan (useGardenState's changeComfortPlan). */
  onChange: (change: Change) => void
  onOpenSupport: () => void
  /** The page that opened this one, which its back button returns to. */
  from?: AppView
  onBack: () => void
}) {
  const root = useRef<HTMLDivElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const pendingFocus = useRef<FocusTarget>(undefined)
  const [undo, setUndo] = useState<UndoOffer>()
  const [said, setSaid] = useState('')
  const [editDraft, setEditDraft] = useDraft(EDIT_DRAFT, '')
  const editing = editingFrom(editDraft)
  const [editProblem, setEditProblem] = useState<Problem>()

  // The page takes focus at its heading as it opens, as breathing does.
  useEffect(() => heading.current?.focus(), [])

  useEffect(() => {
    const target = pendingFocus.current
    if (!target) return
    pendingFocus.current = undefined
    const page = root.current
    if (!page) return
    let element: HTMLElement | null = null
    if (target.to === 'line') {
      const line = Array.from(page.querySelectorAll<HTMLElement>('[data-line-id]')).find(
        (entry) => entry.dataset.lineId === target.id,
      )
      element =
        line?.querySelector<HTMLElement>(`[data-control="${target.control}"]`) ??
        line?.querySelector<HTMLElement>('[data-control="edit"]') ??
        null
    } else if (target.to === 'edit') {
      element = document.getElementById(`comfort-edit-${target.field}`)
    } else if (target.to === 'add') {
      element = document.getElementById(addFieldId(target.section))
    }
    // Failing that, the list's heading, or the page's.
    const listHeading = 'section' in target ? document.getElementById(headingId(target.section)) : null
    const focused = element ?? listHeading ?? heading.current
    focused?.focus()
  })

  const backLabel = (from && BACK_LABELS[from]) ?? 'Back to the garden'

  const add = (section: ComfortSection, words: ComfortWords) => {
    onChange((current) => addComfortItem(current, section, words))
    pendingFocus.current = { to: 'add', section }
    setSaid(`Added to ${SECTIONS[section].title}.`)
  }

  const openEditor = (section: ComfortSection, item: ComfortItem) => {
    setEditProblem(undefined)
    setEditDraft(JSON.stringify({ section, id: item.id, text: item.text, phone: item.phone ?? '' }))
    pendingFocus.current = { to: 'edit', field: 'text' }
  }

  const closeEditor = (id: string) => {
    setEditDraft('')
    setEditProblem(undefined)
    pendingFocus.current = { to: 'line', id, control: 'edit' }
  }

  const saveEdit = (event: FormEvent) => {
    event.preventDefault()
    if (!editing) return
    const words = { text: editing.text, phone: editing.phone }
    const problem = problemWith(editing.section, words)
    if (problem) {
      setEditProblem(problem)
      pendingFocus.current = { to: 'edit', field: problem.field }
      return
    }
    onChange((current) => changeComfortItem(current, editing.section, editing.id, words))
    closeEditor(editing.id)
    setSaid('Saved.')
  }

  const move = (section: ComfortSection, items: readonly ComfortItem[], index: number, by: -1 | 1) => {
    const to = index + by
    if (to < 0 || to >= items.length) return
    onChange((current) => moveComfortItem(current, section, items[index].id, by))
    pendingFocus.current = { to: 'line', id: items[index].id, control: by < 0 ? 'up' : 'down' }
    setSaid(`Moved ${by < 0 ? 'up' : 'down'}, now ${to + 1} of ${items.length}.`)
  }

  const remove = (section: ComfortSection, item: ComfortItem, index: number) => {
    onChange((current) => removeComfortItem(current, section, item.id))
    pendingFocus.current = { to: 'heading', section }
    setUndo({
      message: `Removed ${quoted(item.text)}.`,
      undo: () => {
        // The Undo button goes with the offer; focus goes to the line it put back.
        onChange((current) => restoreComfortItem(current, section, item, index))
        pendingFocus.current = { to: 'line', id: item.id, control: 'edit' }
      },
    })
  }

  return (
    <div className="view comfort-view" ref={root}>
      <header className="page-header">
        <div>
          <p className="eyebrow">For harder days</p>
          <h1 ref={heading} tabIndex={-1}>
            My comfort plan
          </h1>
          <p>
            What helps, who you can reach, and what matters to you, in your own
            words, for a day that feels hard.
          </p>
        </div>
        <button className="secondary-button" onClick={onBack}>
          {backLabel}
        </button>
      </header>

      <p className="card comfort-support">
        This is a personal page for harder days. It is not a substitute for
        help, and people are there to talk to.{' '}
        <a
          className="comfort-link"
          href={hashForRoute({ view: 'support' })}
          onClick={(event) => {
            if (followed(event)) onOpenSupport()
          }}
        >
          If you need support now
        </a>
      </p>

      {COMFORT_SECTIONS.map((section) => {
        const words = SECTIONS[section]
        const items = plan[section] ?? []
        const people = section === 'people'
        return (
          <section className="card comfort-section" key={section} aria-labelledby={headingId(section)}>
            <h2 id={headingId(section)} tabIndex={-1}>
              {words.title}
            </h2>
            {items.length === 0 ? (
              <p className="comfort-example">{words.example}</p>
            ) : (
              <ol className="comfort-lines" aria-labelledby={headingId(section)}>
                {items.map((item, index) => (
                  <li className="comfort-line" key={item.id} data-line-id={item.id}>
                    {editing?.section === section && editing.id === item.id ? (
                      <form className="comfort-form" onSubmit={saveEdit} noValidate>
                        <LineFields
                          idFor={(field) => `comfort-edit-${field}`}
                          textLabel={people ? 'Their name' : 'Your words'}
                          people={people}
                          text={editing.text}
                          phone={editing.phone}
                          problem={editProblem}
                          onText={(text) => {
                            setEditProblem(undefined)
                            setEditDraft(JSON.stringify({ ...editing, text }))
                          }}
                          onPhone={(phone) => {
                            setEditProblem(undefined)
                            setEditDraft(JSON.stringify({ ...editing, phone }))
                          }}
                        />
                        <div className="form-actions">
                          <button className="primary-button" type="submit">
                            Save changes
                          </button>
                          <button
                            className="secondary-button"
                            type="button"
                            onClick={() => closeEditor(item.id)}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <p className="comfort-words">
                          {people ? <strong>{item.text}</strong> : item.text}
                          {item.phone && <span className="comfort-phone">{item.phone}</span>}
                        </p>
                        <div className="comfort-actions">
                          {item.phone && (
                            <a className="secondary-button comfort-call" href={telHref(item.phone)}>
                              Call {item.text}
                            </a>
                          )}
                          <button
                            className="text-button"
                            type="button"
                            data-control="edit"
                            aria-label={`Edit ${item.text}`}
                            onClick={() => openEditor(section, item)}
                          >
                            Edit
                          </button>
                          {items.length > 1 && (
                            <>
                              <button
                                className="text-button"
                                type="button"
                                data-control="up"
                                aria-label={`Move up ${item.text}`}
                                aria-disabled={index === 0 || undefined}
                                onClick={() => move(section, items, index, -1)}
                              >
                                Move up
                              </button>
                              <button
                                className="text-button"
                                type="button"
                                data-control="down"
                                aria-label={`Move down ${item.text}`}
                                aria-disabled={index === items.length - 1 || undefined}
                                onClick={() => move(section, items, index, 1)}
                              >
                                Move down
                              </button>
                            </>
                          )}
                          <button
                            className="text-button danger-text"
                            type="button"
                            aria-label={`Remove ${item.text}`}
                            onClick={() => remove(section, item, index)}
                          >
                            Remove
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ol>
            )}
            {items.length >= COMFORT_ITEMS ? (
              <p className="subtle-copy">
                This list keeps {COMFORT_ITEMS} lines. Remove one to make room for another.
              </p>
            ) : (
              <AddLine section={section} words={words} onAdd={(typed) => add(section, typed)} />
            )}
          </section>
        )
      })}

      <p className="subtle-copy comfort-private">
        Only you see this page. It stays on this device and in the backups you
        save, and the garden never shows it anywhere else.
      </p>

      <p className="sr-only" role="status">
        {said}
      </p>
      <UndoToast offer={undo} onDone={() => setUndo(undefined)} />
    </div>
  )
}

/** A line's fields: its words (a person's name), and for a person a number. */
function LineFields({
  idFor,
  textLabel,
  people,
  text,
  phone,
  problem,
  onText,
  onPhone,
}: {
  idFor: (field: Problem['field']) => string
  textLabel: string
  people: boolean
  text: string
  phone: string
  problem?: Problem
  onText: (text: string) => void
  onPhone: (phone: string) => void
}) {
  const problemId = `${idFor('text')}-problem`
  const invalid = (field: Problem['field']) =>
    problem?.field === field ? { 'aria-invalid': true, 'aria-describedby': problemId } : {}
  return (
    <>
      <label>
        {textLabel}
        <input
          id={idFor('text')}
          value={text}
          maxLength={COMFORT_TEXT_LENGTH}
          autoComplete="off"
          onChange={(event) => onText(event.target.value)}
          {...invalid('text')}
        />
      </label>
      {people && (
        <label>
          <span>
            Phone number <small>(optional)</small>
          </span>
          <input
            id={idFor('phone')}
            type="tel"
            inputMode="tel"
            value={phone}
            maxLength={PHONE_LENGTH}
            autoComplete="off"
            onChange={(event) => onPhone(event.target.value)}
            {...invalid('phone')}
          />
        </label>
      )}
      {problem && (
        <p className="settings-note error" id={problemId} role="alert">
          {problem.message}
        </p>
      )}
    </>
  )
}

/**
 * The form at the foot of a list that adds a line to it. What is typed is a
 * draft until it is added, so leaving the page or a reload keeps it.
 */
function AddLine({
  section,
  words,
  onAdd,
}: {
  section: ComfortSection
  words: SectionWords
  onAdd: (typed: ComfortWords) => void
}) {
  const people = section === 'people'
  const [text, setText] = useDraft(`comfort-new:${section}`, '')
  const [phone, setPhone] = useDraft(`comfort-new:${section}:phone`, '')
  const [problem, setProblem] = useState<Problem>()
  return (
    <form
      className="comfort-form comfort-add"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        const typed = { text, phone: people ? phone : undefined }
        const found = problemWith(section, typed)
        setProblem(found)
        if (found) {
          document.getElementById(addFieldId(section, found.field))?.focus()
          return
        }
        onAdd(typed)
        setText('')
        setPhone('')
      }}
    >
      <LineFields
        idFor={(field) => addFieldId(section, field)}
        textLabel={words.field}
        people={people}
        text={text}
        phone={phone}
        problem={problem}
        // What was wrong goes as soon as it is being put right.
        onText={(value) => {
          setProblem(undefined)
          setText(value)
        }}
        onPhone={(value) => {
          setProblem(undefined)
          setPhone(value)
        }}
      />
      <div className="form-actions">
        <button className="secondary-button" type="submit" aria-label={`Add to ${words.title}`}>
          Add
        </button>
      </div>
    </form>
  )
}
