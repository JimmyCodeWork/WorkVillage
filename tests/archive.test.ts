import { describe, expect, test } from 'claude-code/testing'

import { decodeArchive, encodeArchive, type Archive } from '../src/core/archive'
import { createProfile, foundStyles, newlyFound, profileFrom, recordWork, restoreProfile, statsDelta } from '../src/core/profile'
import { applySignal, createVillage, restore, type Signal, type Village } from '../src/core/world'

function grown(seed: number, count: number): Village {
  let v = createVillage(seed, 0)
  for (let i = 0; i < count; i++) v = applySignal(v, (i % 5 === 4 ? 'commit' : 'edit') as Signal).village
  return v
}

function read(code: string): Archive | undefined {
  const result = decodeArchive(code)
  return 'archive' in result ? result.archive : undefined
}

describe('export codes', () => {
  test('a village survives the trip through a code', () => {
    const village = grown(3, 60)
    const code = encodeArchive({ kind: 'village', village })
    expect(code).toMatch(/^WV1\.[A-Za-z0-9_-]+\.[0-9a-f]{8}$/)
    expect(read(code)).toEqual({ kind: 'village', village })
  })

  test('a backup keeps every village and the record, folder names in any script', () => {
    const villages = { 'village:/work/專案': grown(1, 30), 'village:/work/app': grown(2, 10) }
    const profile = recordWork(createProfile(0), 'village:/work/app', villages['village:/work/app'], villages['village:/work/app'].stats, 5)
    const archive: Archive = { kind: 'backup', profile, villages }
    expect(read(encodeArchive(archive))).toEqual(archive)
  })

  test('a code wrapped across lines still reads', () => {
    const code = encodeArchive({ kind: 'village', village: createVillage(9, 0) })
    const wrapped = code.replace(/(.{20})/g, '$1\n  ')
    expect(read(wrapped)).toBeDefined()
  })

  test('a changed, cut or foreign code is refused with the reason', () => {
    const code = encodeArchive({ kind: 'village', village: createVillage(9, 0) })
    const [prefix, body = '', sum] = code.split('.')
    const changed = `${prefix}.${body.slice(0, 10)}${body[10] === 'A' ? 'B' : 'A'}${body.slice(11)}.${sum}`
    expect(decodeArchive(changed)).toEqual({ error: 'checksum' })
    expect(decodeArchive(code.slice(0, -3))).toEqual({ error: 'checksum' })
    expect(decodeArchive('hello')).toEqual({ error: 'format' })
    expect(decodeArchive(`WV2.${body}.${sum}`)).toEqual({ error: 'version' })
  })

  test('a well-formed code holding no valid village is refused', () => {
    const broken = { ...createVillage(9, 0), villagers: -4 }
    expect(decodeArchive(encodeArchive({ kind: 'village', village: broken }))).toEqual({ error: 'content' })
    const sneaky = { kind: 'backup', profile: createProfile(0), villages: { __proto__x: createVillage(1, 0) } }
    expect(decodeArchive(encodeArchive(sneaky as unknown as Archive))).toEqual({ error: 'content' })
  })
})

describe('restore checks every field', () => {
  const base = () => JSON.parse(JSON.stringify(grown(4, 40))) as Record<string, unknown>

  test('a sound village comes back with only its known fields', () => {
    const v = { ...base(), extra: 'kept out' }
    const restored = restore(v)
    expect(restored).toBeDefined()
    expect(Object.keys(restored!)).not.toContain('extra')
  })

  test('anything out of shape is refused', () => {
    const plots = (base().plots as unknown[]).slice()
    expect(restore({ ...base(), camp: 0 })).toBeUndefined()
    expect(restore({ ...base(), plots: [...plots, ...plots, ...plots, ...plots, ...plots] })).toBeUndefined()
    expect(restore({ ...base(), plots: [...plots, { kind: 'castle' }] })).toBeUndefined()
    expect(restore({ ...base(), plots: plots.map(p => ((p as { kind: string }).kind === 'grass' ? { kind: 'building', building: 'hut', progress: 99 } : p)) })).toBeUndefined()
    expect(restore({ ...base(), resources: { wood: -1, stone: 0, food: 0, knowledge: 0 } })).toBeUndefined()
    expect(restore({ ...base(), villagers: 0 })).toBeUndefined()
    expect(restore({ ...base(), stats: { edits: 1.5 } })).toBeUndefined()
  })
})

describe('the device-wide record', () => {
  test('work adds up and each village keeps a summary', () => {
    const a = grown(1, 20)
    const b = grown(2, 30)
    let profile = recordWork(createProfile(0), 'village:/a', a, a.stats, 1)
    profile = recordWork(profile, 'village:/b', b, b.stats, 2)
    expect(profile.lifetime.edits).toBe(a.stats.edits + b.stats.edits)
    expect(Object.keys(profile.villages)).toEqual(['village:/a', 'village:/b'])
    expect(restoreProfile(JSON.parse(JSON.stringify(profile)))).toEqual(profile)
  })

  test('a village started over never takes work away', () => {
    const before = grown(1, 20).stats
    const delta = statsDelta(before, createVillage(1, 0).stats)
    expect(Object.values(delta).every(n => n === 0)).toBe(true)
  })

  test('a record naming anything but villages is refused', () => {
    const profile = JSON.parse(JSON.stringify(createProfile(0)))
    profile.villages = JSON.parse('{"__proto__": {"stage": "camp", "villagers": 1, "built": 0, "updatedAt": 0}}')
    expect(restoreProfile(profile)).toBeUndefined()
  })
})

describe('styles found by work', () => {
  const lifetime = (over: Partial<Record<string, number>>) => ({ ...createProfile(0).lifetime, ...over })

  test('work across the device finds new styles', () => {
    expect(foundStyles(lifetime({}))).toEqual({ roofs: [], props: [] })
    expect(foundStyles(lifetime({ commits: 30, edits: 200 }))).toEqual({ roofs: ['slate', 'moss'], props: ['lantern'] })
    expect(newlyFound(lifetime({ commits: 9 }), lifetime({ commits: 10 })).map(u => u.style)).toEqual(['lantern'])
    expect(newlyFound(lifetime({ commits: 10 }), lifetime({ commits: 11 }))).toEqual([])
  })

  test('a record begun on a device with villages starts from their work', () => {
    const a = grown(1, 20)
    const b = grown(2, 30)
    expect(profileFrom([a, b], 0).lifetime.edits).toBe(a.stats.edits + b.stats.edits)
  })
})
