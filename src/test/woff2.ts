/**
 * What a bundled font can draw, read from the font file itself.
 *
 * For tests only. Node's own modules are reached through
 * process.getBuiltinModule, because the app's type-check rightly carries no
 * Node types; the few calls used are typed here.
 */
interface NodeFs {
  readFileSync(path: URL): Uint8Array
  readFileSync(path: URL, encoding: 'utf8'): string
  readdirSync(path: URL): string[]
}
interface NodeZlib {
  brotliDecompressSync(data: Uint8Array): Uint8Array
}
const node = (globalThis as unknown as { process: { getBuiltinModule(id: string): unknown } })
  .process
const fs = node.getBuiltinModule('node:fs') as NodeFs
const zlib = node.getBuiltinModule('node:zlib') as NodeZlib

export const readText = (file: URL) => fs.readFileSync(file, 'utf8')
export const listFiles = (directory: URL) => fs.readdirSync(directory)

/** The WOFF2 table directory's known tags this reader needs by index. */
const KNOWN_TAGS: Readonly<Record<number, string>> = { 0: 'cmap', 10: 'glyf', 11: 'loca' }

/**
 * Whether a WOFF2 font maps each character to a glyph of its own.
 *
 * WOFF2 (W3C): a header, a table directory, then every table in one Brotli
 * stream. The cmap table is never transformed, so once the stream is
 * inflated it reads as in any OpenType font.
 */
export function fontDraws(file: URL): (character: string) => boolean {
  const bytes = fs.readFileSync(file)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (view.getUint32(0) !== 0x774f4632) throw new Error(`${file.href} is not WOFF2`)
  const tableCount = view.getUint16(12)
  const compressedLength = view.getUint32(20)
  let at = 48
  const base128 = () => {
    let value = 0
    for (let i = 0; i < 5; i++) {
      const byte = bytes[at++]
      value = value * 128 + (byte & 0x7f)
      if (!(byte & 0x80)) return value
    }
    throw new Error('Malformed UIntBase128')
  }
  const tables: { tag: string; length: number }[] = []
  for (let i = 0; i < tableCount; i++) {
    const flags = bytes[at++]
    const index = flags & 0x3f
    let tag = KNOWN_TAGS[index] ?? `#${index}`
    if (index === 63) {
      tag = String.fromCharCode(...bytes.subarray(at, at + 4))
      at += 4
    }
    const version = flags >> 6
    const length = base128()
    // glyf and loca are transformed at version 0; every other table is
    // transformed at any version but 0. A transformed table states its
    // stored length as well.
    const transformed = tag === 'glyf' || tag === 'loca' ? version === 0 : version !== 0
    tables.push({ tag, length: transformed ? base128() : length })
  }
  const data = zlib.brotliDecompressSync(bytes.subarray(at, at + compressedLength))
  let offset = 0
  for (const table of tables) {
    if (table.tag === 'cmap') return cmapLookup(data.subarray(offset, offset + table.length))
    offset += table.length
  }
  throw new Error(`${file.href} has no cmap`)
}

/** A Unicode cmap subtable (format 4 or 12) as a lookup. */
function cmapLookup(cmap: Uint8Array): (character: string) => boolean {
  const view = new DataView(cmap.buffer, cmap.byteOffset, cmap.byteLength)
  let format4: number | undefined
  let format12: number | undefined
  for (let i = 0; i < view.getUint16(2); i++) {
    const platform = view.getUint16(4 + i * 8)
    const encoding = view.getUint16(6 + i * 8)
    const offset = view.getUint32(8 + i * 8)
    const unicode = platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10))
    if (!unicode) continue
    if (view.getUint16(offset) === 12) format12 = offset
    if (view.getUint16(offset) === 4) format4 = offset
  }
  if (format12 !== undefined) {
    const start = format12
    const groups = view.getUint32(start + 12)
    return (character) => {
      const code = character.codePointAt(0) ?? 0
      for (let group = 0; group < groups; group++) {
        const at = start + 16 + group * 12
        if (code >= view.getUint32(at) && code <= view.getUint32(at + 4))
          return view.getUint32(at + 8) + code - view.getUint32(at) !== 0
      }
      return false
    }
  }
  if (format4 === undefined) throw new Error('No Unicode cmap')
  const start = format4
  const segments = view.getUint16(start + 6) / 2
  const ends = start + 14
  const starts = ends + segments * 2 + 2
  const deltas = starts + segments * 2
  const ranges = deltas + segments * 2
  return (character) => {
    const code = character.codePointAt(0) ?? 0
    for (let segment = 0; segment < segments; segment++) {
      if (code > view.getUint16(ends + segment * 2)) continue
      const first = view.getUint16(starts + segment * 2)
      if (code < first) return false
      const delta = view.getInt16(deltas + segment * 2)
      const rangeAt = ranges + segment * 2
      const range = view.getUint16(rangeAt)
      if (range === 0) return ((code + delta) & 0xffff) !== 0
      const glyph = view.getUint16(rangeAt + range + (code - first) * 2)
      return glyph !== 0 && ((glyph + delta) & 0xffff) !== 0
    }
    return false
  }
}
