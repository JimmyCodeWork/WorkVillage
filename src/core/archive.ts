// Export codes: a village, or a backup of every village on the device, as one
// line of text that survives copying and pasting. A code holds only what the
// store holds (counts and plots, never file names, commands or contents); a
// backup also names each project's folder, so it can be put back in place.

import { isVillageKey, restoreProfile, type Profile } from './profile'
import { restore, type Village } from './world'

export type Archive =
  | { kind: 'village'; village: Village }
  | { kind: 'backup'; profile: Profile; villages: Record<string, Village> }

export type ArchiveError = 'format' | 'checksum' | 'version' | 'content'

/** The prefix names the format, so a later one can still read this one. */
const PREFIX = 'WV1'
/** A code past this is larger than the store can hold, so it is not one of ours. */
const MAX_CODE_LENGTH = 6_000_000
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

function utf8(text: string): number[] {
  const bytes: number[] = []
  for (const char of text) {
    const c = char.codePointAt(0)!
    if (c < 0x80) bytes.push(c)
    else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 63))
    else if (c < 0x10000) bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63))
    else bytes.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63))
  }
  return bytes
}

function fromUtf8(bytes: readonly number[]): string | undefined {
  let out = ''
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i]!
    const length = b < 0x80 ? 1 : b >> 5 === 6 ? 2 : b >> 4 === 14 ? 3 : b >> 3 === 30 ? 4 : 0
    if (length === 0 || i + length > bytes.length) return undefined
    let c = length === 1 ? b : b & (0x7f >> length)
    for (let k = 1; k < length; k++) {
      const next = bytes[i + k]!
      if (next >> 6 !== 2) return undefined
      c = (c << 6) | (next & 63)
    }
    if (c > 0x10ffff) return undefined
    out += String.fromCodePoint(c)
    i += length
  }
  return out
}

/** Unpadded base64url, so a code is one word to a terminal and a URL alike. */
function toBase64Url(bytes: readonly number[]): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0)
    const chars = Math.min(4, Math.ceil(((bytes.length - i) * 8) / 6))
    for (let k = 0; k < chars; k++) out += ALPHABET[(n >> (18 - k * 6)) & 63]
  }
  return out
}

function fromBase64Url(text: string): number[] | undefined {
  if (text.length % 4 === 1) return undefined
  const bytes: number[] = []
  for (let i = 0; i < text.length; i += 4) {
    const chunk = text.slice(i, i + 4)
    let n = 0
    for (let k = 0; k < 4; k++) {
      const value = k < chunk.length ? ALPHABET.indexOf(chunk[k]!) : 0
      if (value < 0) return undefined
      n = (n << 6) | value
    }
    const count = chunk.length - 1
    for (let k = 0; k < count; k++) bytes.push((n >> (16 - k * 8)) & 255)
  }
  return bytes
}

/** FNV-1a over the body: catches a code cut short or mistyped in pasting. */
function checksum(text: string): string {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return (h >>> 0).toString(16).padStart(8, '0')
}

export function encodeArchive(archive: Archive): string {
  const body = toBase64Url(utf8(JSON.stringify(archive)))
  return `${PREFIX}.${body}.${checksum(body)}`
}

function restoreArchive(value: unknown): Archive | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const a = value as Record<string, unknown>
  if (a.kind === 'village') {
    const village = restore(a.village)
    return village && { kind: 'village', village }
  }
  if (a.kind === 'backup') {
    const profile = restoreProfile(a.profile)
    if (profile === undefined || typeof a.villages !== 'object' || a.villages === null) return undefined
    if (Array.isArray(a.villages)) return undefined
    const villages: Record<string, Village> = {}
    for (const [key, item] of Object.entries(a.villages)) {
      const village = isVillageKey(key) ? restore(item) : undefined
      if (village === undefined) return undefined
      villages[key] = village
    }
    return { kind: 'backup', profile, villages }
  }
  return undefined
}

/**
 * Reads a pasted code back. Whitespace anywhere is ignored, since a terminal
 * may wrap a long code across lines; everything else must be exactly as made.
 */
export function decodeArchive(code: string): { archive: Archive } | { error: ArchiveError } {
  if (code.length > MAX_CODE_LENGTH) return { error: 'format' }
  const parts = code.replace(/\s+/g, '').split('.')
  if (parts.length !== 3 || !/^WV\d+$/.test(parts[0]!)) return { error: 'format' }
  if (parts[0] !== PREFIX) return { error: 'version' }
  const [, body = '', sum = ''] = parts
  if (checksum(body) !== sum.toLowerCase()) return { error: 'checksum' }
  const bytes = fromBase64Url(body)
  const text = bytes && fromUtf8(bytes)
  if (text === undefined) return { error: 'format' }
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return { error: 'format' }
  }
  const archive = restoreArchive(value)
  return archive ? { archive } : { error: 'content' }
}
