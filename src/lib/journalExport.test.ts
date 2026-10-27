import { describe, expect, it } from 'vitest'
import type { AppState, MoodEntry, RecapEntry, ReflectionEntry } from '../types'
import { formatJournalDate } from './date'
import { checkInsCsv, escapeHtml, journalHtml, journalMarkdown } from './journalExport'
import { createInitialState } from './progression'

const NOW = new Date(2026, 9, 27, 9, 30)

function mood(localDate: string, overrides: Partial<MoodEntry> = {}): MoodEntry {
  return {
    id: `mood-${localDate}`,
    localDate,
    level: 4,
    note: 'Felt calm after the walk.',
    createdAt: `${localDate}T09:00:00.000Z`,
    updatedAt: `${localDate}T09:00:00.000Z`,
    ...overrides,
  }
}

function reflection(localDate: string, overrides: Partial<ReflectionEntry> = {}): ReflectionEntry {
  return {
    id: `reflection-${localDate}`,
    localDate,
    promptId: 'notice',
    body: 'The light on the kitchen wall.',
    createdAt: `${localDate}T21:00:00.000Z`,
    updatedAt: `${localDate}T21:00:00.000Z`,
    ...overrides,
  }
}

function recap(localDate: string, overrides: Partial<RecapEntry> = {}): RecapEntry {
  return {
    id: `recap-${localDate}`,
    localDate,
    level: 2,
    wentWell: 'Walked to the river.',
    settingDown: 'The unanswered email.',
    forTomorrow: 'Book the appointment',
    createdAt: `${localDate}T22:00:00.000Z`,
    updatedAt: `${localDate}T22:00:00.000Z`,
    ...overrides,
  }
}

function garden(
  entries: Partial<Pick<AppState, 'moods' | 'reflections' | 'recaps'>> = {},
  name = 'Test Garden',
): AppState {
  return { ...createInitialState('Tester', name), ...entries }
}

/** The lines of a Markdown copy, for finding one block among the rest. */
function lines(markdown: string): string[] {
  return markdown.split('\n')
}

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html')
}

function texts(document: Document, selector: string): string[] {
  return [...document.querySelectorAll(selector)].map((element) => element.textContent ?? '')
}

describe('journalMarkdown', () => {
  it('heads the copy with the garden name and the day it was exported', () => {
    const markdown = journalMarkdown(garden({ moods: [mood('2026-10-26')] }), NOW)

    expect(lines(markdown).slice(0, 3)).toEqual([
      '# Test Garden journal',
      '',
      `Exported on ${formatJournalDate('2026-10-27')}`,
    ])
    expect(markdown.endsWith('\n')).toBe(true)
  })

  it('names a garden without a name the way a new garden is named', () => {
    const unnamed = { ...garden(), profile: undefined }
    expect(lines(journalMarkdown(unnamed, NOW))[0]).toBe('# My Butterfly Garden journal')

    const blank = garden()
    blank.profile = { ...blank.profile!, gardenName: '   ' }
    expect(lines(journalMarkdown(blank, NOW))[0]).toBe('# My Butterfly Garden journal')
  })

  it('says so when nothing has been written yet', () => {
    expect(journalMarkdown(garden(), NOW)).toContain(
      'Nothing has been written in this journal yet.',
    )
  })

  it('lists days newest first, a day with only a recap among them', () => {
    const markdown = journalMarkdown(
      garden({
        moods: [mood('2026-01-01'), mood('2026-01-03')],
        recaps: [recap('2026-01-02')],
      }),
      NOW,
    )

    expect(lines(markdown).filter((line) => line.startsWith('## '))).toEqual([
      `## ${formatJournalDate('2026-01-03')}`,
      `## ${formatJournalDate('2026-01-02')}`,
      `## ${formatJournalDate('2026-01-01')}`,
    ])
  })

  it('names the weather of a check-in, "Not sure" included, with its note', () => {
    const markdown = journalMarkdown(
      garden({
        moods: [
          mood('2026-01-01'),
          mood('2026-01-02', { level: 3, unsure: true, note: '   ' }),
        ],
      }),
      NOW,
    )

    expect(markdown).toContain('### Check-in: Bright\n\nFelt calm after the walk.')
    // A blank note leaves the check-in on its own rather than with an empty paragraph.
    expect(markdown).toContain(
      `### Check-in: Not sure\n\n## ${formatJournalDate('2026-01-01')}`,
    )
  })

  it('says a check-in’s feelings and energy in words, between its weather and its note', () => {
    const markdown = journalMarkdown(
      garden({
        moods: [
          mood('2026-01-01', { level: 2, feelings: ['hopeful', 'tired'], energy: 'low' }),
          mood('2026-01-02', { energy: 'bright', note: '' }),
        ],
      }),
      NOW,
    )

    expect(markdown).toContain(
      '### Check-in: Rainy\n\n*Feeling hopeful, tired · Energy low*\n\nFelt calm after the walk.',
    )
    expect(markdown).toContain(`### Check-in: Bright\n\n*Energy bright*\n\n## ${formatJournalDate('2026-01-01')}`)
  })

  it('gives a reflection its prompt, free writing its own words, and an unknown prompt none', () => {
    const markdown = journalMarkdown(
      garden({
        reflections: [
          reflection('2026-01-03'),
          reflection('2026-01-02', { promptId: 'free', body: 'Whatever came.' }),
          reflection('2026-01-01', { promptId: 'retired-prompt', body: 'Still mine.' }),
          reflection('2025-12-31', { body: '  ' }),
        ],
      }),
      NOW,
    )

    expect(markdown).toContain(
      '### Reflection\n\n*What is one small thing you noticed today?*\n\nThe light on the kitchen wall.',
    )
    expect(markdown).toContain('### Reflection\n\n*Written freely*\n\nWhatever came.')
    expect(markdown).toContain('### Reflection\n\nStill mine.')
    // A blank reflection keeps its prompt, without an empty paragraph under it.
    expect(markdown.endsWith('### Reflection\n\n*What is one small thing you noticed today?*\n')).toBe(true)
  })

  it('writes out a recap, one note for tomorrow per line', () => {
    const markdown = journalMarkdown(
      garden({
        recaps: [
          recap('2026-01-02', { forTomorrow: 'Book the appointment\n\nCall Mum\r\nWater the fern' }),
          recap('2026-01-01', { level: undefined, wentWell: '', settingDown: ' ', forTomorrow: '' }),
        ],
      }),
      NOW,
    )

    expect(markdown).toContain(
      [
        '### Rounded out the day: Rainy',
        '**What went well**',
        'Walked to the river.',
        '**Set down**',
        'The unanswered email.',
        '**For tomorrow**',
        '- Book the appointment\n- Call Mum\n- Water the fern',
      ].join('\n\n'),
    )
    // A recap with nothing written still marks the evening it was made.
    expect(markdown.trimEnd().endsWith('### Rounded out the day')).toBe(true)
  })

  it('keeps line breaks as hard breaks', () => {
    const markdown = journalMarkdown(
      garden({ reflections: [reflection('2026-01-01', { body: 'First line\nSecond line\r\n\r\nNew paragraph' })] }),
      NOW,
    )

    expect(markdown).toContain('First line  \nSecond line  \n  \nNew paragraph')
  })

  it('never lets a line of journal text start a block of its own', () => {
    const cases: Array<[written: string, escaped: string]> = [
      ['# Heading', '\\# Heading'],
      ['###', '\\###'],
      ['- a list', '\\- a list'],
      ['+ a list', '\\+ a list'],
      ['* a list', '\\* a list'],
      ['1. an ordered list', '1\\. an ordered list'],
      ['12) another', '12\\) another'],
      ['> a quote', '\\> a quote'],
      ['```js', '\\`\\`\\`js'],
      ['~~~', '\\~\\~\\~'],
      ['<div onclick="steal()">', '\\<div onclick="steal()"\\>'],
      ['<!-- hidden -->', '\\<!-- hidden --\\>'],
      ['---', '\\---'],
      ['===', '\\==='],
      ['***', '\\*\\*\\*'],
      ['| a | b |', '\\| a \\| b \\|'],
      [':--- | ---', '\\:--- \\| ---'],
      ['[ref]: https://example.com', '\\[ref\\]: https://example.com'],
      ['    four spaces would be code', 'four spaces would be code'],
      ['\t# a tab, then a heading', '\\# a tab, then a heading'],
    ]
    const markdown = journalMarkdown(
      garden({
        reflections: [reflection('2026-01-01', { body: cases.map(([line]) => line).join('\n') })],
      }),
      NOW,
    )

    expect(markdown).toContain(cases.map(([, line]) => line).join('  \n'))
  })

  it('reads inline Markdown and HTML in journal text as the words they are', () => {
    const note =
      '**bold** _soft_ `code` ~~gone~~ ![pixel](https://tracker.example/p.png) ' +
      '[tap](javascript:alert(1)) <script>alert(1)</script> &lt;b&gt; &#60; & ¯\\_(ツ)_/¯'
    const markdown = journalMarkdown(garden({ moods: [mood('2026-01-01', { note })] }), NOW)

    expect(markdown).toContain(
      '\\*\\*bold\\*\\* \\_soft\\_ \\`code\\` \\~\\~gone\\~\\~ !\\[pixel\\](https://tracker.example/p.png) ' +
        '\\[tap\\](javascript:alert(1)) \\<script\\>alert(1)\\</script\\> \\&lt;b\\&gt; \\&#60; & ¯\\\\\\_(ツ)\\_/¯',
    )
    expect(markdown).not.toMatch(/(?<!\\)[<>]/)
    expect(markdown).not.toMatch(/(?<!\\)\[/)
  })

  it('keeps the garden name inside its heading', () => {
    const markdown = journalMarkdown(garden({}, 'Rose\n# Injected <b>'), NOW)
    // createInitialState trims the name but keeps what is inside it.
    expect(lines(markdown)[0]).toBe('# Rose # Injected \\<b\\> journal')
  })
})

describe('Markdown read by pandoc and GitHub', () => {
  it('keeps money, carets, mentions and lettered lists as typed', () => {
    const markdown = journalMarkdown(
      garden({ moods: [mood('2026-01-01', { note: 'tea was $5-$10 ^_^ for @mum<3\na) slept\n(1) tea\niv. rest' })] }),
      NOW,
    )
    expect(markdown).toContain('tea was \\$5-\\$10 \\^\\_\\^ for \\@mum\\<3  ')
    expect(markdown).toContain('a\\) slept  ')
    expect(markdown).toContain('\\(1) tea  ')
    expect(markdown).toContain('iv\\. rest')
  })
})

describe('escapeHtml', () => {
  it('escapes the five characters that can change what HTML means', () => {
    expect(escapeHtml(`& < > " '`)).toBe('&amp; &lt; &gt; &quot; &#39;')
  })

  it('escapes an entity rather than letting it through', () => {
    expect(escapeHtml('&lt;script&gt;')).toBe('&amp;lt;script&amp;gt;')
  })
})

describe('journalHtml', () => {
  it('is a standalone page that can run nothing and load nothing', () => {
    const html = journalHtml(garden({ moods: [mood('2026-01-01')] }), NOW)
    const document = parse(html)
    const head = document.head

    expect(html.startsWith('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n')).toBe(true)
    expect(head.firstElementChild?.getAttribute('charset')).toBe('utf-8')
    const policy = head.querySelector('meta[http-equiv="Content-Security-Policy"]')
    expect(policy?.getAttribute('content')).toMatch(
      /^default-src 'none'; style-src 'unsafe-inline'(;|$)/,
    )
    // The policy comes before the stylesheet, and the stylesheet is inline.
    expect(head.children[1]).toBe(policy)
    expect(head.querySelector('meta[name="viewport"]')?.getAttribute('content')).toBe(
      'width=device-width, initial-scale=1',
    )
    expect(document.querySelectorAll('script, link, img, iframe, object, embed, form, base')).toHaveLength(0)
    expect(document.querySelectorAll('[src], [href], [style]')).toHaveLength(0)
    expect(head.querySelector('style')?.textContent).toContain('@media print')
  })

  it('escapes every piece of the gardener’s text, the garden name and title included', () => {
    const name = '</title><script>alert("name")</script>'
    const note = '<img src=x onerror="alert(1)">'
    const body = `"Quoted" & 'single' </p><script>alert(2)</script>`
    const html = journalHtml(
      garden(
        {
          moods: [mood('2026-01-01', { note })],
          reflections: [reflection('2026-01-01', { body })],
          recaps: [
            recap('2026-01-01', {
              wentWell: '<b>bold</b>',
              settingDown: '</dd></dl><a href="https://example.com">',
              forTomorrow: '<li>one</li>\n</ul><iframe>',
            }),
          ],
        },
        name,
      ),
      NOW,
    )
    const document = parse(html)

    expect(html).not.toMatch(/<(script|img|iframe|a|b)[\s>]/i)
    expect(document.title).toBe(`${name} journal`)
    expect(texts(document, 'h1')).toEqual([`${name} journal`])
    expect(texts(document, '.words')).toEqual([
      note,
      body,
      '<b>bold</b>',
      '</dd></dl><a href="https://example.com">',
      '<li>one</li>',
      '</ul><iframe>',
    ])
    expect(document.querySelectorAll('script, img, iframe, a, b')).toHaveLength(0)
  })

  it('keeps line breaks with pre-wrap rather than markup in the text', () => {
    const html = journalHtml(
      garden({ reflections: [reflection('2026-01-01', { body: 'One\n  indented\ntwo' })] }),
      NOW,
    )

    expect(html).toContain('<p class="words">One\n  indented\ntwo</p>')
    expect(html).not.toContain('<br')
    expect(html).toMatch(/\.words \{[^}]*white-space: pre-wrap/)
  })

  it('lays out each day newest first with its date, weather, prompt and recap', () => {
    const document = parse(
      journalHtml(
        garden({
          moods: [mood('2026-01-01', { level: 3, unsure: true }), mood('2026-01-02', { note: '' })],
          reflections: [
            reflection('2026-01-01', { promptId: 'free' }),
            reflection('2026-01-02', { promptId: 'retired-prompt', body: ' ' }),
          ],
          recaps: [
            recap('2026-01-03', { forTomorrow: 'Book the appointment\nCall Mum' }),
            recap('2026-01-02', { level: undefined, wentWell: '', settingDown: '', forTomorrow: '' }),
          ],
        }),
        NOW,
      ),
    )

    expect([...document.querySelectorAll('time')].map((time) => time.getAttribute('datetime'))).toEqual([
      '2026-01-03',
      '2026-01-02',
      '2026-01-01',
    ])
    expect(texts(document, 'h2')).toEqual(
      ['2026-01-03', '2026-01-02', '2026-01-01'].map(formatJournalDate),
    )
    expect(texts(document, 'h3')).toEqual([
      'Rounded out the day: Rainy',
      'Check-in: Bright',
      'Reflection',
      'Rounded out the day',
      'Check-in: Not sure',
      'Reflection',
    ])
    expect(texts(document, '.prompt')).toEqual(['Written freely'])
    expect(texts(document, 'dt')).toEqual(['What went well', 'Set down', 'For tomorrow'])
    expect(texts(document, 'li')).toEqual(['Book the appointment', 'Call Mum'])
    // A recap with nothing written has no empty list of answers.
    expect(document.querySelectorAll('dl')).toHaveLength(1)
    expect(texts(document, '.exported')).toEqual([`Exported on ${formatJournalDate('2026-10-27')}`])
  })

  it('says a check-in’s feelings and energy in words, and nothing for one without', () => {
    const document = parse(
      journalHtml(
        garden({
          moods: [
            mood('2026-01-01', { feelings: ['calm'], energy: 'steady' }),
            mood('2026-01-02'),
          ],
        }),
        NOW,
      ),
    )
    expect(texts(document, '.details')).toEqual(['Feeling calm · Energy steady'])
    expect(document.querySelector('.details + .words')?.textContent).toBe('Felt calm after the walk.')
  })

  it('says so when nothing has been written yet', () => {
    const document = parse(journalHtml(garden(), NOW))
    expect(document.querySelector('main')?.textContent).toBe(
      '\nNothing has been written in this journal yet.\n',
    )
    expect(document.querySelectorAll('article')).toHaveLength(0)
  })
})

describe('checkInsCsv', () => {
  it('starts with a byte order mark and a header row, and ends every record with CRLF', () => {
    expect(checkInsCsv(garden())).toBe('\uFEFF"date","weather","note","feelings","energy","written later"\r\n')
  })

  it('writes one quoted row per check-in, newest first, with the date as stored', () => {
    const csv = checkInsCsv(
      garden({
        moods: [
          mood('2026-01-01', { level: 1, note: 'Heavy day' }),
          mood('2026-01-03', { level: 3, unsure: true, note: '' }),
          mood('2026-01-02', { level: 5, note: 'Café with Zoë 🌼' }),
        ],
      }),
    )

    expect(csv).toBe(
      '\uFEFF' +
        [
          '"date","weather","note","feelings","energy","written later"',
          '"2026-01-03","Not sure","","","",""',
          '"2026-01-02","Radiant","Café with Zoë 🌼","","",""',
          '"2026-01-01","Stormy","Heavy day","","",""',
          '',
        ].join('\r\n'),
    )
  })

  it('adds feelings and energy after the first three columns, in words', () => {
    const csv = checkInsCsv(
      garden({
        moods: [
          mood('2026-01-02', { level: 2, feelings: ['anxious', 'tired'], energy: 'low' }),
          mood('2026-01-01', { feelings: ['proud'] }),
        ],
      }),
    )
    expect(csv.split('\r\n').slice(1, -1)).toEqual([
      '"2026-01-02","Rainy","Felt calm after the walk.","anxious, tired","low"',
      '"2026-01-01","Bright","Felt calm after the walk.","proud",""',
    ])
  })

  it('keeps quotes, commas and line breaks inside their field', () => {
    const csv = checkInsCsv(
      garden({ moods: [mood('2026-01-01', { note: 'She said "rest", so I did,\nfinally.' })] }),
    )

    expect(csv.split('\r\n')[1]).toBe(
      '"2026-01-01","Bright","She said ""rest"", so I did,\nfinally.","","",""',
    )
  })

  it('opens a field that looks like a formula as text', () => {
    const notes: Array<[written: string, field: string]> = [
      ['=1+1', `"'=1+1"`],
      ['+44 is the code', `"'+44 is the code"`],
      ['-2 degrees', `"'-2 degrees"`],
      ['@SUM(A1:A9)', `"'@SUM(A1:A9)"`],
      ['\tTabbed', `"'\tTabbed"`],
      ['\rReturned', `"'\rReturned"`],
      ['=HYPERLINK("https://example.com","tap")', `"'=HYPERLINK(""https://example.com"",""tap"")"`],
      ['1 = 1, a@b, -ish', '"1 = 1, a@b, -ish"'],
      // A later line, or what follows a semicolon or a tab, becomes a cell of
      // its own in a spreadsheet told to split on those.
      ['Slept badly\n=2*3\nbetter by noon', `"Slept badly\n'=2*3\nbetter by noon"`],
      ['fine;=2*3', `"fine;'=2*3"`],
      ['tab\t@x', `"tab\t'@x"`],
    ]
    const csv = checkInsCsv(
      garden({
        moods: notes.map(([note], index) =>
          mood(`2026-01-${String(notes.length - index).padStart(2, '0')}`, { note }),
        ),
      }),
    )

    expect(
      csv
        .split('\r\n')
        .slice(1, -1)
        .map((record) => record.slice('"2026-01-01","Bright",'.length, -',"","",""'.length)),
    ).toEqual(notes.map(([, field]) => field))
  })

  it('keeps the latest check-in of a day, as the timeline does', () => {
    const csv = checkInsCsv(
      garden({
        moods: [mood('2026-01-01', { note: 'First try' }), mood('2026-01-01', { note: 'Rewritten' })],
      }),
    )

    expect(csv.split('\r\n').slice(1)).toEqual(['"2026-01-01","Bright","Rewritten","","",""', ''])
  })
})

describe('entries written later', () => {
  const later = garden({
    moods: [mood('2026-01-02', { writtenLater: true, note: 'Caught up.' }), mood('2026-01-01')],
    reflections: [reflection('2026-01-02', { promptId: 'free', body: 'Remembered.', writtenLater: true })],
  })

  it('are marked in Markdown under their heading, and only they', () => {
    const markdown = journalMarkdown(later, NOW)
    expect(markdown).toContain('### Check-in: Bright\n\n*Written later*\n\nCaught up.')
    expect(markdown).toContain('### Reflection\n\n*Written later*\n\n*Written freely*\n\nRemembered.')
    expect(markdown.match(/Written later/g)).toHaveLength(2)
  })

  it('are marked on the printable page', () => {
    const document = parse(journalHtml(later, NOW))
    expect(texts(document, '.later')).toEqual(['Written later', 'Written later'])
    const first = document.querySelector('article section')
    expect(first?.querySelector('.later')?.textContent).toBe('Written later')
  })

  it('say "yes" in the spreadsheet’s last column, and nothing for the others', () => {
    expect(checkInsCsv(later).split('\r\n').slice(1, -1)).toEqual([
      '"2026-01-02","Bright","Caught up.","","","yes"',
      '"2026-01-01","Bright","Felt calm after the walk.","","",""',
    ])
  })
})
