import type { AppState } from '../types'
import { formatJournalDate, toLocalDate } from './date'
import { describeCheckInDetails, energyNameOf, feelingNamesOf } from './feelings'
import { moodChoiceOf, moodName } from './mood'
import { promptById } from './prompts'

/*
 * Readable copies of the journal: Markdown, a printable web page, and the
 * check-ins as a spreadsheet. They are for reading, printing and keeping, not
 * for restoring; the JSON backup does that.
 *
 * Each file is opened by some other program (a Markdown viewer, a browser, a
 * spreadsheet) that treats parts of its text as instructions. The gardener's
 * words must only ever reach those programs as words, so every piece of text
 * is escaped for the format it lands in, app text included: one rule for all
 * of it is easier to trust than a judgement about which strings are safe.
 */

/** What a garden without a name is called, as when one is first planted. */
const UNNAMED_GARDEN = 'My Butterfly Garden'

/** Any line ending a phone, a desktop or an old backup might have stored. */
const LINE_BREAKS = /\r\n|\r|\n/g

/** One day of the journal, already in words, in the order the timeline shows. */
interface ExportDay {
  localDate: string
  /** "Tuesday, October 27, 2026", as the timeline heads the day. */
  heading: string
  /**
   * `details` is "Feeling tired, hopeful · Energy low", or empty when neither was
   * given; `writtenLater` marks a check-in written afterwards for this day.
   */
  checkIn?: { weather: string; details: string; note: string; writtenLater: boolean }
  /** `prompt` is absent for a prompt this build no longer knows. */
  reflection?: { prompt?: string; body: string; writtenLater: boolean }
  recap?: {
    weather?: string
    wentWell: string
    settingDown: string
    /** One note per line of `forTomorrow`, blank lines dropped. */
    forTomorrow: string[]
  }
}

/** The latest entry of each day, as the Journal indexes them. */
function byDate<T extends { localDate: string }>(entries: readonly T[]): Map<string, T> {
  return new Map(entries.map((entry) => [entry.localDate, entry]))
}

/** Newest first. ISO dates order correctly as plain strings, with no locale involved. */
function newerFirst(a: string, b: string): number {
  return Number(a < b) - Number(a > b)
}

/**
 * Every day with something written, newest first.
 *
 * Indexed once and sorted once, so a garden kept for years costs a few
 * thousand map lookups rather than a scan of every entry for every day.
 */
function journalDays(state: AppState): ExportDay[] {
  const moodByDate = byDate(state.moods)
  const reflectionByDate = byDate(state.reflections)
  const recapByDate = byDate(state.recaps)
  const dates = [
    ...new Set([...moodByDate.keys(), ...reflectionByDate.keys(), ...recapByDate.keys()]),
  ].sort(newerFirst)
  return dates.map((localDate) => {
    const day: ExportDay = { localDate, heading: formatJournalDate(localDate) }
    const mood = moodByDate.get(localDate)
    if (mood) {
      day.checkIn = {
        weather: moodName(moodChoiceOf(mood)),
        details: describeCheckInDetails(mood),
        note: mood.note,
        writtenLater: mood.writtenLater === true,
      }
    }
    const reflection = reflectionByDate.get(localDate)
    if (reflection) {
      const prompt = promptById(reflection.promptId)
      day.reflection = {
        prompt: prompt?.family === 'free' ? 'Written freely' : prompt?.text,
        body: reflection.body,
        writtenLater: reflection.writtenLater === true,
      }
    }
    const recap = recapByDate.get(localDate)
    if (recap) {
      day.recap = {
        weather: recap.level ? moodName(recap.level) : undefined,
        wentWell: recap.wentWell,
        settingDown: recap.settingDown,
        forTomorrow: recap.forTomorrow.split(LINE_BREAKS).filter(written),
      }
    }
    return day
  })
}

/** "Sunlit Sanctuary journal": what heads every copy. */
function journalTitle(state: AppState): string {
  return `${state.profile?.gardenName.trim() || UNNAMED_GARDEN} journal`
}

/** Whether there are any words here; a blank answer is left out, not shown empty. */
function written(text: string): boolean {
  return text.trim() !== ''
}

/** The heading of a recap: the evening weather, when one was given. */
function recapHeading(weather: string | undefined): string {
  return weather ? `Rounded out the day: ${weather}` : 'Rounded out the day'
}

const NOTHING_YET = 'Nothing has been written in this journal yet.'

/**
 * The mark on an entry written afterwards for its day, as the Journal shows
 * it, so a copy read years later says the same as the app did.
 */
const WRITTEN_LATER = 'Written later'

// ---------------------------------------------------------------------------
// Markdown

/**
 * Text as one line that CommonMark, GitHub's extensions to it and pandoc
 * read literally. Any line break in it becomes a space, so it cannot end the
 * heading or list item it was put in.
 *
 * Inline, a backslash escapes the characters that would start emphasis,
 * code, a link, an image, strikethrough, a table cell, maths (`$`), a
 * superscript (`^`), a citation (`@`) or HTML and autolinks (`<`, `>`), and a
 * backslash itself, so one the gardener typed is kept. Every one is ASCII
 * punctuation, which every one of those readers lets a backslash escape. `&`
 * is escaped only where it would start an entity such as `&lt;`, which would
 * otherwise show as `<`.
 *
 * At the start of the line, where Markdown decides what kind of block it is,
 * the first character is escaped if it could open a heading, a list, a
 * thematic break, a setext underline or a definition; a quote, a code fence,
 * a table row and an HTML block are already covered by the inline escapes
 * and entities. Leading spaces are dropped first: rendered Markdown hides an
 * indent anyway, and four spaces of one would turn the line into code.
 */
function markdownLine(line: string): string {
  return line
    .replace(LINE_BREAKS, ' ')
    .trimStart()
    .replace(/[\\`*_[\]~|$^<>@]/g, '\\$&')
    .replace(/&(?=#?[0-9a-z]+;)/gi, '\\&')
    .replace(/^[#+\-=:(]/, '\\$&')
    // "1.", "a)", "iv." and the like begin a numbered list, in pandoc at least.
    .replace(/^(\d+|[a-z]|[ivxlcdm]+)([.)])/i, '$1\\$2')
}

/**
 * The gardener's own text, every line escaped and every line break kept.
 *
 * A single line break is a space in Markdown, so each one is made a hard
 * break with two trailing spaces. A backslash would also do it, but would
 * show at the end of every line of the file to anyone reading it as text.
 */
function markdownText(text: string): string {
  return text.split(LINE_BREAKS).map(markdownLine).join('  \n')
}

function dayMarkdown(day: ExportDay): string[] {
  const blocks = [`## ${markdownLine(day.heading)}`]
  if (day.checkIn) {
    blocks.push(`### ${markdownLine(`Check-in: ${day.checkIn.weather}`)}`)
    if (day.checkIn.writtenLater) blocks.push(`*${WRITTEN_LATER}*`)
    if (written(day.checkIn.details)) blocks.push(`*${markdownLine(day.checkIn.details)}*`)
    if (written(day.checkIn.note)) blocks.push(markdownText(day.checkIn.note))
  }
  if (day.reflection) {
    blocks.push('### Reflection')
    if (day.reflection.writtenLater) blocks.push(`*${WRITTEN_LATER}*`)
    if (day.reflection.prompt) blocks.push(`*${markdownLine(day.reflection.prompt)}*`)
    if (written(day.reflection.body)) blocks.push(markdownText(day.reflection.body))
  }
  if (day.recap) {
    blocks.push(`### ${markdownLine(recapHeading(day.recap.weather))}`)
    if (written(day.recap.wentWell)) {
      blocks.push('**What went well**', markdownText(day.recap.wentWell))
    }
    if (written(day.recap.settingDown)) {
      blocks.push('**Set down**', markdownText(day.recap.settingDown))
    }
    if (day.recap.forTomorrow.length > 0) {
      blocks.push(
        '**For tomorrow**',
        day.recap.forTomorrow.map((note) => `- ${markdownLine(note)}`).join('\n'),
      )
    }
  }
  return blocks
}

/** The whole journal as Markdown, newest day first. */
export function journalMarkdown(state: AppState, now: Date): string {
  const days = journalDays(state)
  const blocks = [
    `# ${markdownLine(journalTitle(state))}`,
    markdownLine(`Exported on ${formatJournalDate(toLocalDate(now))}`),
    ...(days.length === 0 ? [NOTHING_YET] : days.flatMap(dayMarkdown)),
  ]
  // Every block stands apart from the next with a blank line, so nothing the
  // gardener wrote can run on into the heading that follows it.
  return `${blocks.join('\n\n')}\n`
}

// ---------------------------------------------------------------------------
// HTML

const HTML_ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/** Text made safe for HTML, in element content or in a quoted attribute. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char])
}

/**
 * The page may not run a script, load a file, take a form anywhere or move
 * its own base, even if escaping were ever wrong. Inline styles are the one
 * thing it is allowed: its own stylesheet, so it reads well and prints well.
 */
const EXPORT_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"

/**
 * Print-friendly and self-contained: system fonts only, so nothing is
 * fetched. `pre-wrap` keeps the gardener's line breaks and spacing exactly
 * as written, with no markup added to their text.
 */
const EXPORT_CSS = [
  ':root { color-scheme: light; }',
  'body { margin: 0 auto; max-width: 40rem; padding: 2rem 1.25rem 3rem; }',
  "body { background: #fffdf7; color: #243a32; font: 1rem/1.6 Georgia, 'Times New Roman', serif; }",
  'h1 { margin: 0 0 0.25rem; font-size: 1.75rem; line-height: 1.25; }',
  'h2 { margin: 0 0 0.5rem; font-size: 1.25rem; }',
  'h3 { margin: 1rem 0 0.35rem; font-size: 1.05rem; }',
  'p, ul, dl, dd { margin: 0 0 0.5rem; }',
  'ul { padding-left: 1.25rem; }',
  'dt { font-weight: 700; }',
  '.exported, .prompt, .details, .later { color: #46584f; }',
  '.prompt, .later { font-style: italic; }',
  'article { margin-top: 2rem; border-top: 1px solid #d9d8c8; padding-top: 1.25rem; }',
  'section { break-inside: avoid; }',
  'h2, h3, dt { break-after: avoid; }',
  '.words { white-space: pre-wrap; overflow-wrap: anywhere; }',
  '@media print { body { max-width: none; padding: 0; background: #fff; color: #000; } }',
].join('\n')

/** A block of the gardener's words. */
function wordsHtml(text: string, tag: 'p' | 'dd' | 'li' = 'p'): string {
  // Nothing between the tags and the text: under pre-wrap, any whitespace
  // added here would show as part of what was written.
  return `<${tag} class="words">${escapeHtml(text)}</${tag}>`
}

function writtenLaterHtml(): string {
  return `<p class="later">${escapeHtml(WRITTEN_LATER)}</p>`
}

function dayHtml(day: ExportDay): string {
  const parts = [
    `<h2><time datetime="${escapeHtml(day.localDate)}">${escapeHtml(day.heading)}</time></h2>`,
  ]
  if (day.checkIn) {
    parts.push('<section>', `<h3>${escapeHtml(`Check-in: ${day.checkIn.weather}`)}</h3>`)
    if (day.checkIn.writtenLater) parts.push(writtenLaterHtml())
    if (written(day.checkIn.details)) {
      parts.push(`<p class="details">${escapeHtml(day.checkIn.details)}</p>`)
    }
    if (written(day.checkIn.note)) parts.push(wordsHtml(day.checkIn.note))
    parts.push('</section>')
  }
  if (day.reflection) {
    parts.push('<section>', '<h3>Reflection</h3>')
    if (day.reflection.writtenLater) parts.push(writtenLaterHtml())
    if (day.reflection.prompt) {
      parts.push(`<p class="prompt">${escapeHtml(day.reflection.prompt)}</p>`)
    }
    if (written(day.reflection.body)) parts.push(wordsHtml(day.reflection.body))
    parts.push('</section>')
  }
  if (day.recap) {
    const { recap } = day
    parts.push('<section>', `<h3>${escapeHtml(recapHeading(recap.weather))}</h3>`)
    const answers: string[] = []
    if (written(recap.wentWell)) {
      answers.push('<dt>What went well</dt>', wordsHtml(recap.wentWell, 'dd'))
    }
    if (written(recap.settingDown)) {
      answers.push('<dt>Set down</dt>', wordsHtml(recap.settingDown, 'dd'))
    }
    if (recap.forTomorrow.length > 0) {
      answers.push(
        '<dt>For tomorrow</dt>',
        `<dd><ul>${recap.forTomorrow.map((note) => wordsHtml(note, 'li')).join('')}</ul></dd>`,
      )
    }
    if (answers.length > 0) parts.push('<dl>', ...answers, '</dl>')
    parts.push('</section>')
  }
  return ['<article>', ...parts, '</article>'].join('\n')
}

/** The whole journal as one standalone, printable web page, newest day first. */
export function journalHtml(state: AppState, now: Date): string {
  const title = escapeHtml(journalTitle(state))
  const days = journalDays(state)
  const body =
    days.length === 0 ? `<p>${escapeHtml(NOTHING_YET)}</p>` : days.map(dayHtml).join('\n')
  // The charset comes first, inside the bytes a browser sniffs, and the
  // policy before anything it could govern.
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${EXPORT_CSP}">`,
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${title}</title>`,
    `<style>\n${EXPORT_CSS}\n</style>`,
    '</head>',
    '<body>',
    '<header>',
    `<h1>${title}</h1>`,
    `<p class="exported">${escapeHtml(`Exported on ${formatJournalDate(toLocalDate(now))}`)}</p>`,
    '</header>',
    '<main>',
    body,
    '</main>',
    '</body>',
    '</html>',
    '',
  ].join('\n')
}

// ---------------------------------------------------------------------------
// CSV

/**
 * A byte order mark. Without it, Excel reads a CSV in the system's legacy
 * code page and turns every accent and emoji into mojibake.
 */
const BOM = '\uFEFF'

/** RFC 4180 ends every record with CRLF, and some spreadsheets insist. */
const CRLF = '\r\n'

/**
 * A field a spreadsheet would run as a formula (OWASP, "CSV Injection"): a
 * note such as `=HYPERLINK(...)` must open as the words it is.
 */
const FORMULA_START = /^[=+\-@\t\r]/

/**
 * The same, inside a field: a spreadsheet told to split on semicolons or
 * tabs (the usual choice in much of Europe) misreads a quoted note there,
 * and a line break, tab or semicolon in it starts a cell of its own.
 */
const FORMULA_INSIDE = /(\r\n|[\r\n\t;])(?=[=+\-@])/g

/**
 * One field, always quoted, any quote inside doubled (RFC 4180), so commas
 * and line breaks in a note stay inside its cell. A field that would start a
 * formula gets a leading apostrophe inside the quotes, which spreadsheets
 * read as "this is text".
 */
function csvField(value: string): string {
  const inside = value.replace(FORMULA_INSIDE, "$1'")
  const guarded = FORMULA_START.test(inside) ? `'${inside}` : inside
  return `"${guarded.replaceAll('"', '""')}"`
}

function csvRecord(fields: readonly string[]): string {
  return fields.map(csvField).join(',')
}

/**
 * Every check-in as a spreadsheet, newest first: date, weather and note, then
 * feelings and energy, then "yes" for one written later for its day. The later
 * columns come last, so a sheet built on the first three still finds them
 * where they were.
 */
export function checkInsCsv(state: AppState): string {
  const moods = [...byDate(state.moods).values()].sort((a, b) =>
    newerFirst(a.localDate, b.localDate),
  )
  const records = [
    csvRecord(['date', 'weather', 'note', 'feelings', 'energy', 'written later']),
    ...moods.map((mood) =>
      csvRecord([
        mood.localDate,
        moodName(moodChoiceOf(mood)),
        mood.note,
        feelingNamesOf(mood.feelings).join(', '),
        energyNameOf(mood.energy) ?? '',
        mood.writtenLater === true ? 'yes' : '',
      ]),
    ),
  ]
  return `${BOM}${records.join(CRLF)}${CRLF}`
}
