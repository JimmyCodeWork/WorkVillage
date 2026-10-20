// The village's lasting state and the rules that grow it. Pure functions:
// nothing here touches the host, so it is easy to test and to balance.

import {
  ACCENT_SHARE,
  BASE_PROPS,
  BASE_ROOFS,
  BUILD_ORDER,
  BUILDINGS,
  CAPACITY,
  PROPS,
  REWARDS,
  ROOFS,
  SEASON_ACTIONS,
  WORLD,
  type BuildingKind,
  type PropStyle,
  type RoofStyle,
} from './balance'

/** How one building looks, chosen when it is placed and kept for good. */
export type Look = { roof: RoofStyle; prop: PropStyle; mirrored: boolean }

/**
 * The styles a village's new buildings are drawn from, and its own colour,
 * which about half of them are raised in.
 */
export type Kit = { roofs: RoofStyle[]; props: PropStyle[]; accent: RoofStyle }

export type Plot =
  | { kind: 'tree'; variant: number }
  | { kind: 'rock'; variant: number }
  | { kind: 'stump' }
  | { kind: 'grass' }
  | { kind: 'camp' }
  | { kind: 'pond' }
  | { kind: 'farm'; growth: number }
  | { kind: 'building'; building: BuildingKind; progress: number; look?: Look }

export type Resources = { wood: number; stone: number; food: number; knowledge: number }

export type Stats = {
  edits: number
  reads: number
  tests: number
  commits: number
  tasks: number
  turns: number
  actions: number
  /** Responses in which the model thought before answering. */
  thoughts: number
}

export type Village = {
  version: 1
  seed: number
  plots: Plot[]
  /** Index of the camp plot; the village grows outward from it. */
  camp: number
  villagers: number
  resources: Resources
  stats: Stats
  /** Index into BUILD_ORDER of the next building to place. */
  nextBuild: number
  createdAt: number
  kit: Kit
}

export type Signal = 'edit' | 'create' | 'read' | 'think' | 'test' | 'commit' | 'task' | 'turn' | 'bug' | 'scout'

/** Signals that reward work already counted, or waiting; they do not move the seasons. */
const UNCOUNTED: readonly Signal[] = ['turn', 'bug', 'scout']

export type ActionKind =
  | 'chop'
  | 'clear'
  | 'quarry'
  | 'plant'
  | 'tend'
  | 'harvest'
  | 'build'
  | 'forage'
  | 'arrive'
  | 'celebrate'
  | 'study'
  | 'ponder'
  | 'fish'

/** What a villager should be seen doing for a signal. */
export type Action = {
  kind: ActionKind
  /** The plot worked on, by its index after the change. */
  plot: number
  /** How the plot looked before; shown until the villager finishes. */
  before: Plot | undefined
}

export type Milestone =
  | { kind: 'built'; building: BuildingKind }
  | { kind: 'stage'; stage: Stage }
  | { kind: 'arrived'; villagers: number }
  | { kind: 'expanded' }

export type Stage = 'camp' | 'hamlet' | 'village' | 'town' | 'city'

export type Outcome = { village: Village; action?: Action; milestones: Milestone[] }

/** A small deterministic generator (mulberry32). */
export function random(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A stable hash of a value and a seed, 0..1. */
export function hash01(seed: number, n: number): number {
  return random((seed ^ Math.imul(n, 0x9e3779b1)) >>> 0)()
}

const TREE_KINDS = 3

export function wildPlot(seed: number, index: number): Plot {
  const r = hash01(seed, index)
  if (r < 0.14) return { kind: 'rock', variant: Math.floor(hash01(seed + 7, index) * 2) }
  if (r < 0.14 + WORLD.pondShare && index !== 0 && index !== 1) return { kind: 'pond' }
  // Each forest has a tree of its own that grows in about half its plots.
  const own = seed % TREE_KINDS
  const variant = hash01(seed + 17, index) < 0.5 ? own : Math.floor(hash01(seed + 13, index) * TREE_KINDS)
  return { kind: 'tree', variant }
}

/** The styles every village starts with, its own colour picked by its seed. */
export function baseKit(seed: number): Kit {
  return { roofs: [...BASE_ROOFS], props: [...BASE_PROPS], accent: BASE_ROOFS[Math.floor(hash01(seed + 23, 0) * BASE_ROOFS.length)]! }
}

/**
 * Adds styles found since to a village's kit. A new village takes its own
 * colour from everything found so far; an older one keeps the colour it has.
 */
export function withStyles(kit: Kit, roofs: readonly RoofStyle[], props: readonly PropStyle[]): Kit {
  const order = <T>(all: readonly T[], has: readonly T[]) => all.filter(item => has.includes(item))
  return {
    roofs: order(ROOFS, [...kit.roofs, ...roofs]),
    props: order(PROPS, [...kit.props, ...props]),
    accent: kit.accent,
  }
}

export function createVillage(seed: number, now: number, found: { roofs: readonly RoofStyle[]; props: readonly PropStyle[] } = { roofs: [], props: [] }): Village {
  const kit = withStyles(baseKit(seed), found.roofs, found.props)
  kit.accent = kit.roofs[Math.floor(hash01(seed + 23, 1) * kit.roofs.length)]!
  const plots: Plot[] = []
  const half = Math.floor(WORLD.initialPlots / 2)
  for (let i = 0; i < WORLD.initialPlots; i++) plots.push(wildPlot(seed, i - half))
  plots[half] = { kind: 'camp' }
  // A little clearing beside the fire to start from.
  plots[half + 1] = { kind: 'grass' }
  return {
    version: 1,
    seed,
    plots,
    camp: half,
    villagers: 1,
    resources: { wood: 0, stone: 0, food: 0, knowledge: 0 },
    stats: { edits: 0, reads: 0, tests: 0, commits: 0, tasks: 0, turns: 0, actions: 0, thoughts: 0 },
    nextBuild: 0,
    createdAt: now,
    kit,
  }
}

export type Season = 'spring' | 'summer' | 'autumn' | 'winter'
const SEASONS: readonly Season[] = ['spring', 'summer', 'autumn', 'winter']

/**
 * The village's season. It turns with the work done, not the calendar, so a
 * year passes in a few hours of work and stands still while nobody works.
 */
export function seasonOf(village: Village): Season {
  return SEASONS[Math.floor(village.stats.actions / SEASON_ACTIONS) % SEASONS.length]!
}

export function stageOf(village: Village): Stage {
  const built = builtCount(village)
  if (built >= 14) return 'city'
  if (built >= 9) return 'town'
  if (built >= 5) return 'village'
  if (built >= 2) return 'hamlet'
  return 'camp'
}

export function builtCount(village: Village): number {
  return village.plots.filter(p => p.kind === 'building' && isComplete(p)).length
}

export function isComplete(plot: Plot): boolean {
  return plot.kind === 'building' && plot.progress >= BUILDINGS[plot.building].steps
}

export function capacity(village: Village): number {
  let total = CAPACITY.camp
  for (const plot of village.plots) {
    if (plot.kind === 'building' && isComplete(plot)) total += BUILDINGS[plot.building].housing
  }
  return total
}

/** Plot indices ordered by distance from the camp, nearest first. */
function byDistance(village: Village, test: (plot: Plot) => boolean): number[] {
  return village.plots
    .map((plot, index) => ({ plot, index }))
    .filter(({ plot }) => test(plot))
    .sort((a, b) => Math.abs(a.index - village.camp) - Math.abs(b.index - village.camp) || a.index - b.index)
    .map(({ index }) => index)
}

function nearest(village: Village, test: (plot: Plot) => boolean): number | undefined {
  return byDistance(village, test)[0]
}

function site(village: Village): number | undefined {
  return nearest(village, p => p.kind === 'building' && !isComplete(p))
}

function nextBuilding(village: Village): BuildingKind {
  return BUILD_ORDER[Math.min(village.nextBuild, BUILD_ORDER.length - 1)]!
}

function canAfford(village: Village, kind: BuildingKind): boolean {
  const cost = BUILDINGS[kind].cost
  return village.resources.wood >= cost.wood && village.resources.stone >= cost.stone
}

/** Adds wilderness at the edge nearest to being cleared out. */
function expand(village: Village, milestones: Milestone[]): Village {
  const wild = village.plots.filter(p => p.kind === 'tree' || p.kind === 'rock').length
  if (wild >= WORLD.minWild || village.plots.length + WORLD.expandBy > WORLD.maxPlots) return village
  const plots = [...village.plots]
  let camp = village.camp
  const leftEdge = -camp
  const added = WORLD.expandBy
  // Alternate sides so the village stays roughly centred on its camp.
  const growLeft = camp < plots.length - 1 - camp
  for (let i = 0; i < added; i++) {
    if (growLeft) {
      plots.unshift(wildPlot(village.seed, leftEdge - 1 - i))
      camp += 1
    } else {
      plots.push(wildPlot(village.seed, plots.length - camp))
    }
  }
  milestones.push({ kind: 'expanded' })
  return { ...village, plots, camp }
}

function withPlot(village: Village, index: number, plot: Plot): Village {
  const plots = [...village.plots]
  plots[index] = plot
  return { ...village, plots }
}

function gain(village: Village, delta: Partial<Resources>): Village {
  const r = village.resources
  return {
    ...village,
    resources: {
      wood: r.wood + (delta.wood ?? 0),
      stone: r.stone + (delta.stone ?? 0),
      food: r.food + (delta.food ?? 0),
      knowledge: r.knowledge + (delta.knowledge ?? 0),
    },
  }
}

function count(village: Village, key: keyof Stats): Village {
  return { ...village, stats: { ...village.stats, [key]: village.stats[key] + 1 } }
}

/** A look for the next building, from the village's kit; the same seed always gives the same village. */
function chooseLook(village: Village): Look {
  const { kit, seed, nextBuild: n } = village
  const pick = <T>(items: readonly T[], salt: number): T => items[Math.floor(hash01(seed + salt, n) * items.length)]!
  const roof = hash01(seed + 31, n) < ACCENT_SHARE ? kit.accent : pick(kit.roofs, 37)
  return { roof, prop: pick(kit.props, 41), mirrored: hash01(seed + 43, n) < 0.5 }
}

/** Places the next building on open ground if it can be paid for. */
function placeSite(village: Village): { village: Village; plot?: number } {
  const kind = nextBuilding(village)
  if (!canAfford(village, kind)) return { village }
  // One of the two nearest clearings, so the village grows out on either side.
  const open = byDistance(village, p => p.kind === 'grass')
  const ground = open.length > 1 && hash01(village.seed + 29, village.nextBuild) < 0.5 ? open[1] : open[0]
  if (ground === undefined) return { village }
  const cost = BUILDINGS[kind].cost
  let next = gain(village, { wood: -cost.wood, stone: -cost.stone })
  next = withPlot(next, ground, { kind: 'building', building: kind, progress: 0, look: chooseLook(village) })
  next = { ...next, nextBuild: next.nextBuild + 1 }
  return { village: next, plot: ground }
}

function build(village: Village, index: number, steps: number, milestones: Milestone[]): Village {
  const plot = village.plots[index]
  if (plot?.kind !== 'building') return village
  const stageBefore = stageOf(village)
  const total = BUILDINGS[plot.building].steps
  const progress = Math.min(total, plot.progress + steps)
  let next = withPlot(village, index, { ...plot, progress })
  if (progress >= total && plot.progress < total) {
    milestones.push({ kind: 'built', building: plot.building })
    const stage = stageOf(next)
    if (stage !== stageBefore) milestones.push({ kind: 'stage', stage })
  }
  return next
}

/** Labour from editing: build if there is a site, else clear the wild. */
function labour(village: Village, preferStone: boolean, milestones: Milestone[]): Outcome {
  let v = village
  let at = site(v)
  if (at === undefined) {
    const placed = placeSite(v)
    v = placed.village
    at = placed.plot
  }
  if (at !== undefined) {
    const before = v.plots[at]
    return { village: build(v, at, 1, milestones), action: { kind: 'build', plot: at, before }, milestones }
  }

  const tree = nearest(v, p => p.kind === 'tree')
  const rock = nearest(v, p => p.kind === 'rock')
  const stump = nearest(v, p => p.kind === 'stump')
  const quarryFirst = preferStone || (v.resources.stone < neededStone(v) && rock !== undefined)

  if (rock !== undefined && (quarryFirst || tree === undefined)) {
    const before = v.plots[rock]
    v = gain(withPlot(v, rock, { kind: 'grass' }), { stone: REWARDS.quarryStone })
    return { village: v, action: { kind: 'quarry', plot: rock, before }, milestones }
  }
  if (rock === undefined && v.resources.stone < neededStone(v) && v.stats.edits % 2 === 0) {
    // No boulders left nearby: haul stone from the edge of the clearing.
    const edge = v.camp < v.plots.length / 2 ? v.plots.length - 1 : 0
    v = gain(v, { stone: REWARDS.haulStone })
    return { village: v, action: { kind: 'quarry', plot: edge, before: undefined }, milestones }
  }
  if (tree !== undefined && (stump === undefined || Math.abs(tree - v.camp) <= Math.abs(stump - v.camp) + 1)) {
    const before = v.plots[tree]
    v = gain(withPlot(v, tree, { kind: 'stump' }), { wood: REWARDS.chopWood })
    return { village: v, action: { kind: 'chop', plot: tree, before }, milestones }
  }
  if (stump !== undefined) {
    const before = v.plots[stump]
    // A settled village with no water near digs a pond where the stump was.
    const digs = builtCount(v) >= WORLD.pondAfterBuilt && pondNear(v) === undefined
    v = gain(withPlot(v, stump, digs ? { kind: 'pond' } : { kind: 'grass' }), { wood: REWARDS.clearWood })
    return { village: v, action: { kind: 'clear', plot: stump, before }, milestones }
  }
  return { village: v, action: forageAction(v), milestones }
}

/**
 * The nearest pond within reach of the camp, in the village or in the
 * wilderness beyond it, where the plot index runs past the village's ends.
 */
export function pondNear(village: Village): number | undefined {
  for (let d = 1; d <= WORLD.fishingReach; d++) {
    for (const index of [village.camp - d, village.camp + d]) {
      const inside = index >= 0 && index < village.plots.length
      const plot = inside ? village.plots[index]! : wildPlot(village.seed, index - village.camp)
      if (plot.kind === 'pond') return index
    }
  }
  return undefined
}

function neededStone(village: Village): number {
  return BUILDINGS[nextBuilding(village)].cost.stone
}

function forageAction(village: Village): Action {
  const target = nearest(village, p => p.kind === 'tree') ?? village.camp
  return { kind: 'forage', plot: target, before: undefined }
}

function farming(village: Village, milestones: Milestone[]): Outcome {
  let v = village
  const ripe = nearest(v, p => p.kind === 'farm' && p.growth >= REWARDS.ripeAt)
  if (ripe !== undefined) {
    const before = v.plots[ripe]
    v = gain(withPlot(v, ripe, { kind: 'farm', growth: 1 }), { food: REWARDS.harvestFood })
    return { village: v, action: { kind: 'harvest', plot: ripe, before }, milestones }
  }
  const growing = nearest(v, p => p.kind === 'farm')
  const farms = v.plots.filter(p => p.kind === 'farm').length
  const ground = nearest(v, p => p.kind === 'grass')
  if (ground !== undefined && (growing === undefined || farms < Math.ceil(v.villagers / 2))) {
    const before = v.plots[ground]
    v = withPlot(v, ground, { kind: 'farm', growth: 1 })
    return { village: v, action: { kind: 'plant', plot: ground, before }, milestones }
  }
  if (growing !== undefined) {
    const plot = v.plots[growing]
    if (plot?.kind === 'farm') {
      v = withPlot(v, growing, { kind: 'farm', growth: plot.growth + 1 })
      return { village: v, action: { kind: 'tend', plot: growing, before: plot }, milestones }
    }
  }
  return { village: gain(v, { food: 1 }), action: forageAction(v), milestones }
}

/**
 * Reading and thinking add knowledge; enough of it turns into a planned step
 * on the building under way. Without one, a villager studies or ponders by
 * the fire and the knowledge waits for the next site.
 */
function learning(village: Village, kind: 'study' | 'ponder', milestones: Milestone[]): Outcome {
  const at = site(village)
  if (at !== undefined && village.resources.knowledge >= REWARDS.knowledgePerStep) {
    const before = village.plots[at]
    const v = build(gain(village, { knowledge: -REWARDS.knowledgePerStep }), at, 1, milestones)
    return { village: v, action: { kind: 'build', plot: at, before }, milestones }
  }
  return { village, action: { kind, plot: village.camp, before: undefined }, milestones }
}

function arrival(village: Village, milestones: Milestone[]): Village {
  if (village.villagers >= capacity(village)) return village
  const villagers = village.villagers + 1
  milestones.push({ kind: 'arrived', villagers })
  return { ...village, villagers }
}

/** Applies one progress signal to the village. */
export function applySignal(village: Village, signal: Signal): Outcome {
  const milestones: Milestone[] = []
  let outcome: Outcome
  switch (signal) {
    case 'edit':
    case 'create':
      outcome = labour(count(village, 'edits'), signal === 'create', milestones)
      break
    case 'read': {
      const v = gain(count(village, 'reads'), { knowledge: REWARDS.readKnowledge })
      if (v.stats.reads % REWARDS.readsPerForage === 0) {
        outcome = { village: gain(v, { food: 1 }), action: forageAction(v), milestones }
      } else {
        outcome = learning(v, 'study', milestones)
      }
      break
    }
    case 'think':
      outcome = learning(gain(count(village, 'thoughts'), { knowledge: REWARDS.thinkKnowledge }), 'ponder', milestones)
      break
    case 'test':
      outcome = farming(count(village, 'tests'), milestones)
      break
    case 'commit': {
      let v = count(village, 'commits')
      let at = site(v)
      if (at === undefined) {
        const placed = placeSite(v)
        v = placed.village
        at = placed.plot
      }
      if (at !== undefined) {
        const before = v.plots[at]
        v = build(v, at, REWARDS.commitBuildSteps, milestones)
        outcome = { village: v, action: { kind: 'build', plot: at, before }, milestones }
      } else {
        v = gain(v, { wood: REWARDS.commitWood, stone: REWARDS.commitStone })
        outcome = { village: v, action: { kind: 'celebrate', plot: v.camp, before: undefined }, milestones }
      }
      break
    }
    case 'task': {
      const v = arrival(count(village, 'tasks'), milestones)
      outcome =
        v.villagers > village.villagers
          ? { village: v, action: { kind: 'arrive', plot: v.camp, before: undefined }, milestones }
          : { village: gain(v, { food: 2 }), milestones }
      break
    }
    case 'bug':
      // A bug from a failed test, caught now the tests pass.
      outcome = { village: gain(village, { knowledge: REWARDS.bugKnowledge }), milestones }
      break
    case 'scout':
      // A scout back from a subagent's errand with what it found.
      outcome = { village: gain(village, { wood: REWARDS.scoutWood, stone: REWARDS.scoutStone }), milestones }
      break
    case 'turn': {
      // Claude has answered and waits: a villager goes fishing until there is work again.
      const v = count(village, 'turns')
      const pond = pondNear(v)
      outcome =
        pond === undefined
          ? { village: v, milestones }
          : { village: gain(v, { food: REWARDS.fishFood }), action: { kind: 'fish', plot: pond, before: undefined }, milestones }
      break
    }
  }

  let v = outcome.village
  if (!UNCOUNTED.includes(signal)) {
    v = { ...v, stats: { ...v.stats, actions: v.stats.actions + 1 } }
    if (v.stats.actions % REWARDS.actionsPerArrival === 0) {
      const grown = arrival(v, milestones)
      if (grown !== v && outcome.action === undefined) {
        outcome = { ...outcome, action: { kind: 'arrive', plot: grown.camp, before: undefined } }
      }
      v = grown
    }
  }
  const campBefore = v.camp
  v = expand(v, milestones)
  const shift = v.camp - campBefore
  const action = outcome.action && shift !== 0 ? { ...outcome.action, plot: outcome.action.plot + shift } : outcome.action
  return { village: v, action, milestones }
}

/** Larger than any count a village reaches by work; past it a value is not a village's. */
const MAX_COUNT = 1e9
const STAT_KEYS: readonly (keyof Stats)[] = ['edits', 'reads', 'tests', 'commits', 'tasks', 'turns', 'actions', 'thoughts']

function isCount(value: unknown, max = MAX_COUNT): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max
}

function restoreLook(value: unknown): Look | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const l = value as Record<string, unknown>
  if (!ROOFS.includes(l.roof as RoofStyle) || !PROPS.includes(l.prop as PropStyle) || typeof l.mirrored !== 'boolean') return undefined
  return { roof: l.roof as RoofStyle, prop: l.prop as PropStyle, mirrored: l.mirrored }
}

function restoreKit(value: unknown, seed: number): Kit | undefined {
  // Villages saved before styles existed start with the base kit.
  if (value === undefined) return baseKit(seed)
  if (typeof value !== 'object' || value === null) return undefined
  const k = value as Record<string, unknown>
  const isList = <T extends string>(list: unknown, all: readonly T[]): list is T[] =>
    Array.isArray(list) && list.length > 0 && list.length <= all.length && list.every(item => all.includes(item as T)) && new Set(list).size === list.length
  if (!isList(k.roofs, ROOFS) || !isList(k.props, PROPS) || !k.roofs.includes(k.accent as RoofStyle)) return undefined
  return { roofs: [...k.roofs], props: [...k.props], accent: k.accent as RoofStyle }
}

function restorePlot(value: unknown): Plot | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const p = value as Record<string, unknown>
  switch (p.kind) {
    case 'tree':
    case 'rock':
      return isCount(p.variant, 15) ? { kind: p.kind, variant: p.variant } : undefined
    case 'stump':
    case 'grass':
    case 'camp':
    case 'pond':
      return { kind: p.kind }
    case 'farm':
      return isCount(p.growth, 100) ? { kind: 'farm', growth: p.growth } : undefined
    case 'building': {
      if (typeof p.building !== 'string' || !Object.hasOwn(BUILDINGS, p.building)) return undefined
      const building = p.building as BuildingKind
      if (!isCount(p.progress, BUILDINGS[building].steps)) return undefined
      if (p.look === undefined) return { kind: 'building', building, progress: p.progress }
      const look = restoreLook(p.look)
      return look && { kind: 'building', building, progress: p.progress, look }
    }
    default:
      return undefined
  }
}

/**
 * Reads a saved or imported village back, or undefined when it is not one.
 * Every field is checked and only known fields are kept, since an imported
 * code may come from anywhere.
 */
export function restore(value: unknown): Village | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const v = value as Record<string, unknown>
  if (v.version !== 1 || !isCount(v.seed, 0xffffffff) || !Array.isArray(v.plots)) return undefined
  if (v.plots.length === 0 || v.plots.length > WORLD.maxPlots) return undefined
  const plots: Plot[] = []
  for (const item of v.plots) {
    const plot = restorePlot(item)
    if (plot === undefined) return undefined
    plots.push(plot)
  }
  if (!isCount(v.camp, plots.length - 1) || plots[v.camp]?.kind !== 'camp') return undefined
  if (plots.filter(p => p.kind === 'camp').length !== 1) return undefined
  if (!isCount(v.villagers) || v.villagers < 1 || !isCount(v.nextBuild)) return undefined
  if (typeof v.createdAt !== 'number' || !Number.isFinite(v.createdAt)) return undefined
  const kit = restoreKit(v.kit, v.seed)
  if (kit === undefined) return undefined

  const r = (typeof v.resources === 'object' && v.resources !== null ? v.resources : {}) as Record<string, unknown>
  const resources = { wood: r.wood, stone: r.stone, food: r.food, knowledge: r.knowledge ?? 0 }
  if (!Object.values(resources).every(n => isCount(n))) return undefined

  // Villages saved before a counter existed start it at zero.
  const s = (typeof v.stats === 'object' && v.stats !== null ? v.stats : {}) as Record<string, unknown>
  const stats = {} as Stats
  for (const key of STAT_KEYS) {
    const n = s[key] ?? 0
    if (!isCount(n)) return undefined
    stats[key] = n
  }

  return {
    version: 1,
    seed: v.seed,
    plots,
    camp: v.camp,
    villagers: v.villagers,
    resources: resources as Resources,
    stats,
    nextBuild: v.nextBuild,
    createdAt: v.createdAt,
    kit,
  }
}
