// Every number that shapes how fast the village grows, in one place.

export type BuildingKind =
  | 'tent'
  | 'hut'
  | 'well'
  | 'storehouse'
  | 'house'
  | 'workshop'
  | 'tower'
  | 'fountain'
  | 'windmill'
  | 'library'
  | 'clocktower'

export type BuildingSpec = {
  /** Landmarks also cost knowledge, gathered from reading and thinking. */
  cost: { wood: number; stone: number; knowledge?: number }
  /** Labour steps (edits) to finish once placed. */
  steps: number
  /** Villagers it houses once finished. */
  housing: number
}

export const BUILDINGS: Readonly<Record<BuildingKind, BuildingSpec>> = {
  tent: { cost: { wood: 6, stone: 0 }, steps: 3, housing: 2 },
  hut: { cost: { wood: 10, stone: 0 }, steps: 5, housing: 2 },
  well: { cost: { wood: 4, stone: 6 }, steps: 4, housing: 0 },
  storehouse: { cost: { wood: 12, stone: 4 }, steps: 6, housing: 0 },
  house: { cost: { wood: 14, stone: 8 }, steps: 8, housing: 2 },
  workshop: { cost: { wood: 16, stone: 10 }, steps: 8, housing: 1 },
  tower: { cost: { wood: 18, stone: 16 }, steps: 10, housing: 1 },
  fountain: { cost: { wood: 4, stone: 20 }, steps: 8, housing: 0 },
  windmill: { cost: { wood: 16, stone: 8, knowledge: 20 }, steps: 10, housing: 0 },
  library: { cost: { wood: 12, stone: 14, knowledge: 30 }, steps: 10, housing: 0 },
  clocktower: { cost: { wood: 10, stone: 22, knowledge: 40 }, steps: 12, housing: 0 },
}

/**
 * When each kind of building may be put up, and how many of it a village
 * keeps: `from` and `until` are how many buildings the village has, `most`
 * the cap by the same count, and `weight` how likely it is picked among the
 * kinds allowed. The fountain has its own rule.
 */
export type BuildRule = {
  from: number
  until?: number
  most: readonly (readonly [built: number, count: number])[]
  weight: number
}

export const BUILD_RULES: Readonly<Record<Exclude<BuildingKind, 'fountain'>, BuildRule>> = {
  tent: { from: 0, until: 1, most: [[0, 1]], weight: 1 },
  hut: { from: 1, until: 9, most: [[0, 3]], weight: 3 },
  well: { from: 2, most: [[0, 1], [9, 2]], weight: 3 },
  storehouse: { from: 3, most: [[0, 1], [9, 2]], weight: 2 },
  house: { from: 4, most: [[0, Infinity]], weight: 4 },
  workshop: { from: 5, most: [[0, 1], [14, 2]], weight: 2 },
  tower: { from: 8, most: [[0, 1], [14, 2]], weight: 1 },
  // Landmarks: one of each, for a village grown large enough, paid for mostly in knowledge.
  windmill: { from: 9, most: [[0, 1]], weight: 2 },
  library: { from: 9, most: [[0, 1]], weight: 2 },
  clocktower: { from: 14, most: [[0, 1]], weight: 2 },
}

/** As the village grows, old buildings are taken down and built again as something better. */
export const REBUILDS: readonly { from: BuildingKind; to: BuildingKind; after: number; weight: number }[] = [
  { from: 'tent', to: 'hut', after: 5, weight: 3 },
  { from: 'hut', to: 'house', after: 9, weight: 1 },
]

/** One villager lives at the camp; past `most`, no more come however many homes there are, so the band never crowds. */
export const CAPACITY = { camp: 1, most: 20 } as const

export const REWARDS = {
  chopWood: 3,
  clearWood: 1,
  quarryStone: 3,
  haulStone: 2,
  harvestFood: 4,
  ripeAt: 3,
  readsPerForage: 3,
  readKnowledge: 1,
  thinkKnowledge: 2,
  /** Knowledge spent on one planned step of the building under way. */
  knowledgePerStep: 4,
  commitBuildSteps: 3,
  commitWood: 2,
  commitStone: 2,
  actionsPerArrival: 25,
  /** Food a villager brings back from the pond. */
  fishFood: 1,
  /** Knowledge for each bug caught once the tests pass again. */
  bugKnowledge: 2,
  /** What a scout brings back from a subagent's errand. */
  scoutWood: 2,
  scoutStone: 1,
} as const

export const WORLD = {
  initialPlots: 9,
  /** Fewer wild plots than this and the clearing grows. */
  minWild: 4,
  expandBy: 2,
  maxPlots: 40,
  /** Share of the wild that is water. */
  pondShare: 0.05,
  /** How far from the camp, in plots, a villager walks to fish. */
  fishingReach: 12,
  /** Buildings a village has before it digs a pond of its own, if it has none. */
  pondAfterBuilt: 2,
} as const

/** Roof colourings a building can be raised with; `classic` is the art as drawn. */
export const ROOFS = ['classic', 'blue', 'slate', 'moss', 'terracotta', 'plum'] as const
export type RoofStyle = (typeof ROOFS)[number]

/** Small things set down beside a finished building; `none` leaves it bare. */
export const PROPS = ['none', 'barrel', 'crate', 'woodpile', 'flowers', 'lantern', 'bench', 'banner'] as const
export type PropStyle = (typeof PROPS)[number]

type Lifetime = { edits: number; reads: number; tests: number; commits: number; tasks: number }

export type Unlock =
  | { kind: 'roof'; style: RoofStyle; stat: keyof Lifetime; at: number }
  | { kind: 'prop'; style: PropStyle; stat: keyof Lifetime; at: number }

/** Every village starts with these. */
export const BASE_ROOFS: readonly RoofStyle[] = ['classic', 'blue']
export const BASE_PROPS: readonly PropStyle[] = ['none', 'barrel', 'crate', 'woodpile']

/**
 * Styles found through work on every project on the device. Once found, a
 * style can turn up on any village's next buildings.
 */
export const UNLOCKS: readonly Unlock[] = [
  { kind: 'prop', style: 'lantern', stat: 'commits', at: 10 },
  { kind: 'roof', style: 'slate', stat: 'edits', at: 150 },
  { kind: 'prop', style: 'flowers', stat: 'reads', at: 150 },
  { kind: 'roof', style: 'moss', stat: 'commits', at: 25 },
  { kind: 'prop', style: 'bench', stat: 'tasks', at: 15 },
  { kind: 'roof', style: 'terracotta', stat: 'tests', at: 40 },
  { kind: 'prop', style: 'banner', stat: 'commits', at: 60 },
  { kind: 'roof', style: 'plum', stat: 'edits', at: 600 },
]

/** Share of a village's buildings raised in its own colour. */
export const ACCENT_SHARE = 0.5

/** Actions (signals other than turns) a season lasts; a year is four of them. */
export const SEASON_ACTIONS = 40

/** A village builds one fountain, as its next building once it has this many. */
export const FOUNTAIN_AFTER_BUILT = 6

/** A street lamp: what it costs, and how often one goes up while timber and stone are saved for the next building. */
export const LAMP = { cost: { wood: 2, stone: 3 }, everyEdits: 4 } as const

/**
 * Once everything is built, the villagers make the village finer: a stone
 * path in front of it, fences round the fields, and flower beds on open
 * ground. What each costs.
 */
export const DECOR = {
  path: { wood: 0, stone: 2 },
  fence: { wood: 2, stone: 0 },
  garden: { wood: 1, stone: 1 },
} as const

