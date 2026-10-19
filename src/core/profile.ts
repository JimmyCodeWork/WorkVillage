// The settler's record: what every village on this device adds up to. Each
// project keeps its own village; this keeps the lifetime totals and a short
// summary of each village, and only ever grows by the work done.

import { builtCount, stageOf, type Stage, type Stats, type Village } from './world'

export type VillageSummary = {
  stage: Stage
  villagers: number
  built: number
  updatedAt: number
}

export type Profile = {
  version: 1
  /** Work done across every project, since the record began. */
  lifetime: Stats
  /** One summary per project, keyed as its village is in the store. */
  villages: Record<string, VillageSummary>
  createdAt: number
}

const STAT_KEYS: readonly (keyof Stats)[] = ['edits', 'reads', 'tests', 'commits', 'tasks', 'turns', 'actions', 'thoughts']
const STAGES: readonly Stage[] = ['camp', 'hamlet', 'village', 'town', 'city']
const MAX_COUNT = 1e12
/** More projects than anyone keeps; past it the record is not a real one. */
const MAX_VILLAGES = 10_000

/** Where a project's village is kept in the store. */
export const VILLAGE_KEY_PREFIX = 'village:'

export function villageKey(root: string): string {
  return `${VILLAGE_KEY_PREFIX}${root}`
}

export function isVillageKey(key: string): boolean {
  return key.startsWith(VILLAGE_KEY_PREFIX) && key.length > VILLAGE_KEY_PREFIX.length
}

export function emptyStats(): Stats {
  return { edits: 0, reads: 0, tests: 0, commits: 0, tasks: 0, turns: 0, actions: 0, thoughts: 0 }
}

export function createProfile(now: number): Profile {
  return { version: 1, lifetime: emptyStats(), villages: {}, createdAt: now }
}

/** The work one village did between two of its states; never negative. */
export function statsDelta(before: Stats, after: Stats): Stats {
  const delta = emptyStats()
  for (const key of STAT_KEYS) delta[key] = Math.max(0, after[key] - before[key])
  return delta
}

export function addStats(a: Stats, b: Stats): Stats {
  const sum = emptyStats()
  for (const key of STAT_KEYS) sum[key] = a[key] + b[key]
  return sum
}

export function summarize(village: Village, now: number): VillageSummary {
  return { stage: stageOf(village), villagers: village.villagers, built: builtCount(village), updatedAt: now }
}

/**
 * Adds a village's new work to the record and refreshes its summary. The
 * record is read fresh before each call, so sessions in several terminals
 * add to it rather than overwrite each other.
 */
export function recordWork(profile: Profile, key: string, village: Village, delta: Stats, now: number): Profile {
  return {
    ...profile,
    lifetime: addStats(profile.lifetime, delta),
    villages: { ...profile.villages, [key]: summarize(village, now) },
  }
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_COUNT
}

function restoreSummary(value: unknown): VillageSummary | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const s = value as Record<string, unknown>
  if (!STAGES.includes(s.stage as Stage) || !isCount(s.villagers) || !isCount(s.built)) return undefined
  if (typeof s.updatedAt !== 'number' || !Number.isFinite(s.updatedAt)) return undefined
  return { stage: s.stage as Stage, villagers: s.villagers, built: s.built, updatedAt: s.updatedAt }
}

/** Reads a stored or imported record back, keeping only known fields. */
export function restoreProfile(value: unknown): Profile | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const p = value as Record<string, unknown>
  if (p.version !== 1 || typeof p.createdAt !== 'number' || !Number.isFinite(p.createdAt)) return undefined
  const l = (typeof p.lifetime === 'object' && p.lifetime !== null ? p.lifetime : {}) as Record<string, unknown>
  const lifetime = emptyStats()
  for (const key of STAT_KEYS) {
    const n = l[key] ?? 0
    if (!isCount(n)) return undefined
    lifetime[key] = n
  }
  if (typeof p.villages !== 'object' || p.villages === null || Array.isArray(p.villages)) return undefined
  const entries = Object.entries(p.villages)
  if (entries.length > MAX_VILLAGES) return undefined
  const villages: Record<string, VillageSummary> = {}
  for (const [key, item] of entries) {
    // Only store keys of villages; this also keeps out `__proto__` and the like.
    if (!isVillageKey(key)) return undefined
    const summary = restoreSummary(item)
    if (summary === undefined) return undefined
    villages[key] = summary
  }
  return { version: 1, lifetime, villages, createdAt: p.createdAt }
}
