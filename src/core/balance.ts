// Every number that shapes how fast the village grows, in one place.

export type BuildingKind = 'tent' | 'hut' | 'well' | 'storehouse' | 'house' | 'workshop' | 'tower'

export type BuildingSpec = {
  cost: { wood: number; stone: number }
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
  house: { cost: { wood: 14, stone: 8 }, steps: 8, housing: 3 },
  workshop: { cost: { wood: 16, stone: 10 }, steps: 8, housing: 1 },
  tower: { cost: { wood: 18, stone: 16 }, steps: 10, housing: 1 },
}

/** The order buildings are raised in; the last one repeats. */
export const BUILD_ORDER: readonly BuildingKind[] = [
  'tent',
  'hut',
  'well',
  'storehouse',
  'house',
  'hut',
  'workshop',
  'house',
  'tower',
  'house',
]

export const CAPACITY = { camp: 1 } as const

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
