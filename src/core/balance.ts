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
} as const

export const WORLD = {
  initialPlots: 9,
  /** Fewer wild plots than this and the clearing grows. */
  minWild: 4,
  expandBy: 2,
  maxPlots: 40,
} as const
