// The living part of the scene: villagers walking to work and back. Purely
// cosmetic; the village's lasting state changes in core/world.ts first, and
// the scene only shows a plot as it was until the villager has done the job.

import { TUNICS } from '../art/palette'
import type { Pose } from '../art/villager'
import { BUILDINGS } from '../core/balance'
import { random, type Action, type ActionKind, type Plot, type Village } from '../core/world'

/** Pixels per plot, along the ground. */
export const PLOT = 12

export const plotCenter = (index: number): number => index * PLOT + PLOT / 2

type Phase = 'idle' | 'toWork' | 'working' | 'returning' | 'arriving' | 'goingIn' | 'inside' | 'scouting' | 'away'

/**
 * A job a villager can be given: an action from the village, or one the
 * scene starts itself, such as catching a bug.
 */
export type JobKind = ActionKind | 'catch'
export type Job = { kind: JobKind; plot: number; before?: Plot; bug?: number }

/** The village rooster: about the camp by day, asleep by the fire at night, crowing at dawn. */
export type Rooster = {
  x: number
  targetX: number
  facingLeft: boolean
  pose: 'walk1' | 'walk2' | 'stand' | 'peck' | 'sit' | 'crow'
  restUntil: number
  crowUntil: number
}

/** A bug let loose by a failed test run, crawling about until the tests pass and it is caught. */
export type Bug = { id: number; x: number; dir: 1 | -1; isCaught: boolean }

/** What comes up on the line: mostly a fish, now and then something else. */
export type Catch = 'fish' | 'boot' | 'chest'

export type Walker = {
  id: number
  /** Left edge of the villager's box, in world pixels. */
  x: number
  tunic: number
  facingLeft: boolean
  phase: Phase
  pose: Pose
  action?: Job
  /** Which step of the job is under way, from the job's STEPS. */
  step: number
  targetX: number
  workLeft: number
  carry?: 'log' | 'stone' | 'sack'
  /** When a scout out on an errand comes back with nothing, at the latest. */
  awayUntil?: number
  /** Gone home for a nap in a long quiet, to come out when work wakes the village. */
  isNapping?: boolean
  restUntil: number
  hop: number
  /** The villager whose job this one is lending a hand with. */
  helping?: number
  /** The plot of the home this villager sleeps in; none sleeps by the fire. */
  home?: number
  /** What the line brought up, once something bites. */
  caught?: Catch
}

/**
 * What a plot shows while a job changes it, drawn in place of the plot: a
 * tree falling and then lying felled, a boulder cracking and then broken.
 */
export type Effect =
  | { kind: 'falling'; start: number; towardLeft: boolean }
  | { kind: 'felled'; towardLeft: boolean }
  | { kind: 'cracked' }
  | { kind: 'rubble' }

/** A chip of wood or stone thrown up by a blow, in world pixels. */
export type Chip = { x: number; y: number; vx: number; vy: number; life: number; color: 'wood' | 'stone' | 'leaf' }

export type Scene = {
  tick: number
  camp: number
  walkers: Walker[]
  queue: Job[]
  holds: Map<number, Plot>
  effects: Map<number, Effect>
  chips: Chip[]
  /** A finished storehouse nearest the camp, where timber and stone are taken. */
  depot?: number
  /** Homes by plot, one entry per bed, nearest the camp first. */
  beds: number[]
  /** Doors standing open, by plot, until the tick given. */
  doors: Map<number, number>
  bugs: Bug[]
  /** Nothing has happened for a while: the villagers doze where they rest. */
  isDozing: boolean
  /** When work woke the village from a doze, for the villagers' start. */
  wokeAt?: number
  rooster: Rooster
  /** Whether it was night at the last step, to catch the dawn. */
  wasNight?: boolean
  nextId: number
  rand: () => number
}

const SPEED = 1
const MAX_QUEUE = 6
/** Work goes twice as fast while this many jobs wait, so a busy session never falls far behind. */
const BACKLOG = 3
/** Ticks a fall takes, from the last blow until the tree lies on the ground. */
export const FALL_TICKS = 8

type Step = { ticks: number; effect?: Effect['kind'] }

/**
 * Each job as the steps a villager works through at the plot. Felling a
 * tree is many blows, the fall, and then cutting the trunk to length; a
 * boulder is struck until it cracks, then broken up.
 */
const STEPS: Readonly<Record<JobKind, readonly Step[]>> = {
  chop: [{ ticks: 42 }, { ticks: FALL_TICKS + 4, effect: 'falling' }, { ticks: 18, effect: 'felled' }],
  clear: [{ ticks: 30 }],
  quarry: [{ ticks: 24 }, { ticks: 18, effect: 'cracked' }, { ticks: 10, effect: 'rubble' }],
  plant: [{ ticks: 20 }],
  tend: [{ ticks: 18 }],
  harvest: [{ ticks: 22 }],
  build: [{ ticks: 36 }],
  forage: [{ ticks: 16 }],
  arrive: [{ ticks: 0 }],
  celebrate: [{ ticks: 16 }],
  study: [{ ticks: 32 }],
  ponder: [{ ticks: 24 }],
  // Cast, wait for a bite (its length drawn at random), the bite, reeling in, holding up the catch.
  fish: [{ ticks: 8 }, { ticks: 60 }, { ticks: 8 }, { ticks: 10 }, { ticks: 16 }],
  catch: [{ ticks: 10 }],
}

/** How many villagers can work one job together, the one who took it included. */
const CREW: Readonly<Record<JobKind, number>> = {
  chop: 2,
  clear: 2,
  quarry: 2,
  plant: 1,
  tend: 1,
  harvest: 3,
  build: 3,
  forage: 1,
  arrive: 1,
  celebrate: 1,
  study: 1,
  ponder: 1,
  fish: 1,
  catch: 1,
}

/** Most bugs about at once; more failed runs than this let loose no more. */
export const MAX_BUGS = 3
/** How far out a scout walks before it is out of sight on its errand. */
const SCOUT_RANGE = 160
/** A scout whose errand never ends comes back empty-handed after this many ticks. */
const SCOUT_TIMEOUT = 4800
/** Ticks the village takes to wake from a doze: the villagers spring up. */
export const WAKE_TICKS = 24
/** How long the rooster crows when night turns to day. */
export const CROW_TICKS = 40

/** Offset from a villager's box to its feet, for standing beside a plot. */
const REACH = 9

export function createScene(village: Village, seed = village.seed): Scene {
  const scene: Scene = {
    tick: 0,
    camp: village.camp,
    walkers: [],
    queue: [],
    holds: new Map(),
    effects: new Map(),
    chips: [],
    beds: [],
    doors: new Map(),
    bugs: [],
    isDozing: false,
    rooster: { x: 0, targetX: 0, facingLeft: false, pose: 'stand', restUntil: 0, crowUntil: 0 },
    nextId: 1,
    rand: random(seed ^ 0x5eed),
  }
  syncScene(scene, village)
  scene.rooster.x = scene.rooster.targetX = campX(scene) + 12
  return scene
}

function campX(scene: Scene): number {
  return plotCenter(scene.camp)
}

function addWalker(scene: Scene, x: number, phase: Phase): Walker {
  const id = scene.nextId++
  const walker: Walker = {
    id,
    x,
    tunic: TUNICS[(id - 1) % TUNICS.length]!,
    facingLeft: false,
    phase,
    pose: 'stand',
    step: 0,
    targetX: x,
    workLeft: 0,
    restUntil: 0,
    hop: 0,
  }
  scene.walkers.push(walker)
  return walker
}

function shifted<V>(map: Map<number, V>, shift: number): Map<number, V> {
  const next = new Map<number, V>()
  for (const [index, value] of map) next.set(index + shift, value)
  return next
}

/** Keeps the scene in step with the village: its camp, its storehouse and its population. */
export function syncScene(scene: Scene, village: Village): void {
  const shift = village.camp - scene.camp
  if (shift !== 0) {
    // The clearing grew on the left: every plot index moves along with the camp.
    for (const w of scene.walkers) {
      w.x += shift * PLOT
      w.targetX += shift * PLOT
    }
    const moved = new Map<Job, Job>()
    const move = (a: Job): Job => {
      if (!moved.has(a)) moved.set(a, { ...a, plot: a.plot + shift })
      return moved.get(a)!
    }
    scene.queue = scene.queue.map(move)
    for (const w of scene.walkers) if (w.action) w.action = move(w.action)
    for (const chip of scene.chips) chip.x += shift * PLOT
    for (const bug of scene.bugs) bug.x += shift * PLOT
    scene.rooster.x += shift * PLOT
    scene.rooster.targetX += shift * PLOT
    scene.holds = shifted(scene.holds, shift)
    scene.effects = shifted(scene.effects, shift)
    scene.doors = shifted(scene.doors, shift)
    scene.camp = village.camp
  }
  scene.depot = village.plots
    .map((plot, index) => ({ plot, index }))
    .filter(({ plot }) => plot.kind === 'building' && plot.building === 'storehouse' && plot.progress >= BUILDINGS.storehouse.steps)
    .sort((a, b) => Math.abs(a.index - village.camp) - Math.abs(b.index - village.camp))[0]?.index
  scene.beds = village.plots
    .map((plot, index) => ({ plot, index }))
    .filter(({ plot }) => plot.kind === 'building' && plot.progress >= BUILDINGS[plot.building].steps)
    .sort((a, b) => Math.abs(a.index - village.camp) - Math.abs(b.index - village.camp) || a.index - b.index)
    .flatMap(({ plot, index }) => (plot.kind === 'building' ? Array.from({ length: BUILDINGS[plot.building].housing }, () => index) : []))
  syncPopulation(scene, village)
  // The first villager keeps the camp; the others take the beds in turn.
  scene.walkers.forEach((w, i) => {
    const home = i === 0 ? undefined : scene.beds[i - 1]
    if (w.home !== home && w.phase === 'inside') leaveHome(scene, w)
    w.home = home
  })
}

function syncPopulation(scene: Scene, village: Village): void {
  while (scene.walkers.length < village.villagers) {
    const offset = (scene.walkers.length % 2 === 0 ? -1 : 1) * (4 + scene.walkers.length * 3)
    addWalker(scene, campX(scene) + offset - 4, 'idle')
  }
  if (scene.walkers.length > village.villagers) scene.walkers.length = Math.max(1, village.villagers)
}

/** Queues an action for the next free villager. */
export function enqueue(scene: Scene, action: Action, village: Village): void {
  if (action.kind === 'arrive') {
    const edge = scene.rand() < 0.5 ? -2 * PLOT : village.plots.length * PLOT + PLOT
    const walker = addWalker(scene, edge, 'arriving')
    walker.targetX = campX(scene) + (scene.rand() * 24 - 12)
    walker.facingLeft = edge > walker.targetX
    // The village already counts the newcomer; drop a stand-in if one was added.
    while (scene.walkers.length > village.villagers && scene.walkers.length > 1) {
      const extra = scene.walkers.findIndex(w => w !== walker && w.phase === 'idle')
      if (extra < 0) break
      scene.walkers.splice(extra, 1)
    }
    return
  }
  if (action.before !== undefined) scene.holds.set(action.plot, action.before)
  scene.queue.push(action)
  while (scene.queue.length > MAX_QUEUE) {
    const dropped = scene.queue.shift()!
    scene.holds.delete(dropped.plot)
    // A bug nobody got round to is caught all the same.
    if (dropped.kind === 'catch') scene.bugs = scene.bugs.filter(b => b.id !== dropped.bug)
  }
}

/** Where a villager stands to work a plot: the side it comes from, or as a helper the other side. */
function standFor(walker: Walker, action: Job, side?: 'left' | 'right', spread = 0): { x: number; facingLeft: boolean } {
  const center = plotCenter(action.plot)
  const fromRight = side === undefined ? walker.x + 4 > center : side === 'right'
  if (action.kind === 'fish') {
    // On the bank, not in the water: the rod reaches out over it.
    return fromRight ? { x: center + PLOT / 2 - 1, facingLeft: true } : { x: center - PLOT / 2 - REACH + 2, facingLeft: false }
  }
  return fromRight
    ? { x: center + 1 + spread, facingLeft: true }
    : { x: center - REACH - 1 - spread, facingLeft: false }
}

function workPose(kind: JobKind, step: number, beat: boolean): Pose {
  switch (kind) {
    case 'chop':
      // The tree's fall is watched, not worked.
      if (step === 1) return 'stand'
      return beat ? 'axeUp' : 'axeDown'
    case 'clear':
      return beat ? 'axeUp' : 'axeDown'
    case 'quarry':
      if (step === 2) return 'kneel'
      return beat ? 'pickUp' : 'pickDown'
    case 'build':
      return beat ? 'hammerUp' : 'hammerDown'
    case 'tend':
      return beat ? 'water1' : 'water2'
    case 'plant':
    case 'harvest':
    case 'forage':
    case 'catch':
      return 'kneel'
    case 'study':
      return 'read'
    case 'ponder':
      return beat ? 'ponder1' : 'ponder2'
    case 'fish':
      return step === 0 ? 'rodCast' : step === 1 ? 'rodOut' : step === 2 ? 'rodOut' : step === 3 ? 'rodPull' : 'holdUp'
    default:
      return 'stand'
  }
}

function walk(walker: Walker, tick: number): boolean {
  const dx = walker.targetX - walker.x
  if (Math.abs(dx) <= SPEED) {
    walker.x = walker.targetX
    return true
  }
  walker.facingLeft = dx < 0
  walker.x += Math.sign(dx) * SPEED
  if (walker.carry === 'log') walker.pose = 'carryLog'
  else if (walker.carry === 'stone') walker.pose = 'carryStone'
  else if (walker.carry === 'sack') walker.pose = 'carrySack'
  else walker.pose = Math.floor(tick / 2) % 2 === 0 ? 'walk1' : 'walk2'
  return false
}

/** Where timber and stone are taken: the storehouse once there is one, else the woodpile by the fire. */
function dropX(scene: Scene): number {
  if (scene.depot !== undefined) return plotCenter(scene.depot) - 4 + Math.floor(scene.rand() * 3) - 1
  return campX(scene) - 14 - Math.floor(scene.rand() * 4)
}

function restSpot(scene: Scene): number {
  return campX(scene) - 14 - Math.floor(scene.rand() * 4)
}

function startStep(scene: Scene, walker: Walker, step: number): void {
  const action = walker.action!
  const spec = STEPS[action.kind][step]!
  walker.step = step
  // A long queue speeds the work along so the scene keeps up with the session.
  const pace = scene.queue.length >= BACKLOG ? 0.5 : 1
  walker.workLeft = Math.max(1, Math.round(spec.ticks * pace))
  if (action.kind === 'fish') {
    // Fish keep their own time, whatever is queued.
    if (step === 1) walker.workLeft = spec.ticks + Math.floor(scene.rand() * 90)
    else walker.workLeft = spec.ticks
    if (step === 2) {
      const roll = scene.rand()
      walker.caught = roll < 0.8 ? 'fish' : roll < 0.95 ? 'boot' : 'chest'
    }
  }
  if (spec.effect === 'falling') {
    scene.effects.set(action.plot, { kind: 'falling', start: scene.tick, towardLeft: walker.facingLeft })
  } else if (spec.effect === 'felled') {
    const before = scene.effects.get(action.plot)
    scene.effects.set(action.plot, { kind: 'felled', towardLeft: before?.kind === 'falling' ? before.towardLeft : walker.facingLeft })
  } else if (spec.effect !== undefined) {
    scene.effects.set(action.plot, { kind: spec.effect })
  }
}

function throwChips(scene: Scene, walker: Walker, color: Chip['color'], count: number): void {
  const x = walker.facingLeft ? walker.x : walker.x + 8
  for (let i = 0; i < count; i++) {
    const away = walker.facingLeft ? 1 : -1
    scene.chips.push({
      x,
      y: -3 - scene.rand() * 2,
      vx: (scene.rand() * 0.6 + 0.2) * away * (scene.rand() < 0.3 ? -1 : 1),
      vy: -0.6 - scene.rand() * 0.5,
      life: 6 + Math.floor(scene.rand() * 4),
      color,
    })
  }
}

/** On each blow: the tree sheds a chip and now and then a leaf; stone throws grit. */
function onBlow(scene: Scene, walker: Walker): void {
  const action = walker.action!
  if (action.kind === 'chop' && walker.step === 0) {
    throwChips(scene, walker, 'wood', 1)
    if (scene.rand() < 0.35) throwChips(scene, walker, 'leaf', 1)
  } else if (action.kind === 'chop' || action.kind === 'clear') {
    throwChips(scene, walker, 'wood', 1)
  } else if (action.kind === 'quarry') {
    throwChips(scene, walker, 'stone', walker.step === 1 ? 2 : 1)
  }
}

/** The job is done: the plot shows what it has become, and the crew goes back. */
function finish(scene: Scene, walker: Walker): void {
  const action = walker.action!
  if (action.kind === 'catch') scene.bugs = scene.bugs.filter(b => b.id !== action.bug)
  scene.holds.delete(action.plot)
  scene.effects.delete(action.plot)
  const load = action.kind === 'chop' || action.kind === 'clear' ? 'log' : action.kind === 'quarry' ? 'stone' : undefined
  const crew = scene.walkers.filter(w => w.helping === walker.id)
  // A helper takes the load home, so the one who took the job is free for the next.
  const bearer = load !== undefined ? (crew[0] ?? walker) : undefined
  for (const w of [walker, ...crew]) {
    w.carry = w === bearer ? load : undefined
    w.action = undefined
    w.helping = undefined
    w.caught = undefined
    w.step = 0
    w.phase = 'returning'
    w.targetX = w.carry !== undefined ? dropX(scene) : restSpot(scene)
  }
}

/** A villager with nothing to do joins a job under way that has room. */
function lendHand(scene: Scene, walker: Walker): boolean {
  for (const lead of scene.walkers) {
    if (lead === walker || lead.helping !== undefined || lead.action === undefined) continue
    if (lead.phase !== 'toWork' && !(lead.phase === 'working' && lead.step === 0 && lead.workLeft > 12)) continue
    const crew = scene.walkers.filter(w => w.helping === lead.id).length
    if (crew + 1 >= CREW[lead.action.kind]) continue
    const leadSide = standFor(lead, lead.action).facingLeft ? 'right' : 'left'
    const side = crew === 0 ? (leadSide === 'right' ? 'left' : 'right') : leadSide
    const stand = standFor(walker, lead.action, side, crew === 0 ? 0 : 4)
    walker.helping = lead.id
    walker.action = lead.action
    walker.step = 0
    walker.phase = 'toWork'
    walker.targetX = stand.x
    return true
  }
  return false
}

/** Where a villager stands to go in at a home's door. */
function doorX(home: number): number {
  return plotCenter(home) - 4
}

function openDoor(scene: Scene, home: number): void {
  scene.doors.set(home, scene.tick + 6)
}

/** Comes out of the house, opening the door on the way. */
function leaveHome(scene: Scene, walker: Walker): void {
  if (walker.home !== undefined) openDoor(scene, walker.home)
  walker.phase = 'idle'
  walker.pose = 'stand'
  walker.restUntil = scene.tick + 10
}

/**
 * Hands that can take a job now: a villager resting, walking back
 * empty-handed, at home (who comes out for it) or fishing (who reels in).
 */
function isFree(walker: Walker): boolean {
  if (walker.helping !== undefined) return false
  if (walker.phase === 'idle' || walker.phase === 'inside' || walker.phase === 'goingIn') return true
  if (walker.phase === 'returning') return walker.carry === undefined
  return walker.action?.kind === 'fish' && (walker.phase === 'toWork' || walker.phase === 'working')
}

/** Which villagers are in which house, for lit windows. */
export function occupied(scene: Scene): Set<number> {
  return new Set(scene.walkers.flatMap(w => (w.phase === 'inside' && w.home !== undefined ? [w.home] : [])))
}

/**
 * A failed test run lets a bug loose at the edge of the clearing. Nothing
 * is lost by it; it only waits to be caught.
 */
export function releaseBug(scene: Scene): void {
  if (scene.bugs.length >= MAX_BUGS) return
  const side = scene.rand() < 0.5 ? -1 : 1
  scene.bugs.push({ id: scene.nextId++, x: campX(scene) + side * (30 + scene.rand() * 30), dir: side > 0 ? -1 : 1, isCaught: false })
}

/**
 * The tests pass again: every bug about is caught by whoever is free. Says
 * how many, for the village to reward.
 */
export function catchBugs(scene: Scene): number {
  const loose = scene.bugs.filter(b => !b.isCaught)
  for (const bug of loose) {
    const plot = Math.round((bug.x - PLOT / 2) / PLOT)
    bug.isCaught = true
    bug.x = plotCenter(plot) - 1
    scene.queue.unshift({ kind: 'catch', plot, bug: bug.id })
  }
  return loose.length
}

/**
 * A subagent sets out: a villager with nothing to do walks out of sight on
 * the errand. The one who keeps the camp stays.
 */
export function sendScout(scene: Scene): void {
  const scout = [...scene.walkers]
    .reverse()
    .find((w, i, all) => i < all.length - 1 && (w.phase === 'idle' || w.phase === 'inside') && w.helping === undefined)
  if (!scout) return
  if (scout.phase === 'inside') leaveHome(scene, scout)
  scout.isNapping = false
  const side = scene.rand() < 0.5 ? -1 : 1
  scout.phase = 'scouting'
  scout.targetX = campX(scene) + side * SCOUT_RANGE
  scout.awayUntil = scene.tick + SCOUT_TIMEOUT
}

/** A subagent is done: a scout comes back, with a sack of what it found when the errand went well. */
export function scoutReturns(scene: Scene, hasLoot: boolean): void {
  const scout = scene.walkers.find(w => w.phase === 'away') ?? scene.walkers.find(w => w.phase === 'scouting')
  if (!scout) return
  scout.phase = 'returning'
  scout.awayUntil = undefined
  scout.carry = hasLoot ? 'sack' : undefined
  scout.targetX = hasLoot ? dropX(scene) : restSpot(scene)
}

/** Whether a scout is out on an errand. */
export function hasScoutOut(scene: Scene): boolean {
  return scene.walkers.some(w => w.phase === 'scouting' || w.phase === 'away')
}

/** Long quiet sends the village dozing; the next work wakes it with a crow. */
export function setDozing(scene: Scene, isDozing: boolean): void {
  if (scene.isDozing && !isDozing) {
    scene.wokeAt = scene.tick
    // Those napping at home come out at the crow; after dark they sleep on.
    for (const w of scene.walkers) {
      if (!w.isNapping) continue
      w.isNapping = false
      w.restUntil = scene.tick
    }
  }
  scene.isDozing = isDozing
}

function stepBugs(scene: Scene): void {
  const home = campX(scene)
  for (const bug of scene.bugs) {
    if (bug.isCaught) {
      // Pinned where it was spotted, so the catcher finds it.
      continue
    }
    // A slow, aimless crawl, turning now and then and never far from the camp.
    if (scene.rand() < 0.02 || Math.abs(bug.x + bug.dir - home) > 70) bug.dir = bug.dir > 0 ? -1 : 1
    if (scene.tick % 3 === 0) bug.x += bug.dir
  }
}

/**
 * The rooster scratches about near the camp by day, pecking at the ground.
 * At night, or while the village dozes, it settles by the fire; when night
 * turns to day it crows.
 */
function stepRooster(scene: Scene, isNight: boolean): void {
  const r = scene.rooster
  const tick = scene.tick
  if (scene.wasNight === true && !isNight) r.crowUntil = tick + CROW_TICKS
  scene.wasNight = isNight
  if (tick < r.crowUntil) {
    r.pose = Math.floor(tick / 6) % 2 === 0 ? 'crow' : 'stand'
    return
  }
  if (isNight || scene.isDozing) r.targetX = campX(scene) + 10
  if (Math.abs(r.targetX - r.x) >= 1) {
    // A short-legged gait: half a villager's pace.
    if (tick % 2 === 0) {
      r.facingLeft = r.targetX < r.x
      r.x += Math.sign(r.targetX - r.x)
    }
    r.pose = Math.floor(tick / 2) % 2 === 0 ? 'walk1' : 'walk2'
    return
  }
  if (isNight || scene.isDozing) {
    r.pose = 'sit'
    return
  }
  if (tick < r.restUntil) {
    if (tick % 8 === 0) r.pose = scene.rand() < 0.5 ? 'peck' : 'stand'
    return
  }
  const side = scene.rand() < 0.5 ? -1 : 1
  r.targetX = Math.round(campX(scene) + side * (8 + scene.rand() * 32))
  r.restUntil = tick + 20 + Math.floor(scene.rand() * 40)
}

function stepChips(scene: Scene): void {
  for (const chip of scene.chips) {
    chip.x += chip.vx
    chip.y += chip.vy
    chip.vy += 0.25
    chip.life--
  }
  scene.chips = scene.chips.filter(c => c.life > 0 && c.y < 2)
}

/** Advances the scene by one frame. `isNight` sends idle villagers to the fire. */
export function stepScene(scene: Scene, isNight: boolean): void {
  scene.tick++
  const tick = scene.tick
  stepChips(scene)
  stepBugs(scene)
  stepRooster(scene, isNight)
  const isWaking = scene.wokeAt !== undefined && tick - scene.wokeAt < WAKE_TICKS

  for (const walker of scene.walkers) {
    if (scene.queue.length === 0) break
    if (!isFree(walker)) continue
    // A job never waits on fishing: another villager free goes first, else the line comes in.
    if (walker.action?.kind === 'fish' && scene.walkers.some(w => w !== walker && isFree(w) && w.action?.kind !== 'fish')) continue
    if (walker.phase === 'inside') leaveHome(scene, walker)
    walker.isNapping = false
    walker.caught = undefined
    const action = scene.queue.shift()!
    walker.action = action
    walker.step = 0
    walker.phase = 'toWork'
    walker.targetX = standFor(walker, action).x
  }

  for (const walker of scene.walkers) {
    walker.hop = 0
    switch (walker.phase) {
      case 'arriving':
        if (walk(walker, tick)) {
          walker.phase = 'idle'
          walker.pose = 'stand'
          walker.restUntil = tick + 10
        }
        break
      case 'toWork': {
        const action = walker.action!
        if (walk(walker, tick)) {
          const center = plotCenter(action.plot)
          walker.facingLeft = walker.x + 4 > center
          walker.phase = 'working'
          if (walker.helping === undefined) startStep(scene, walker, 0)
        }
        break
      }
      case 'working': {
        const action = walker.action!
        const beat = Math.floor(tick / 3) % 2 === 0
        if (walker.helping !== undefined) {
          // A helper works alongside until the job is done; finish() sends it back.
          const lead = scene.walkers.find(w => w.id === walker.helping)
          if (lead === undefined || lead.action !== action) {
            walker.helping = undefined
            walker.action = undefined
            walker.phase = 'returning'
            walker.targetX = restSpot(scene)
            break
          }
          // Out of step with the one it helps, so the blows alternate.
          walker.step = lead.step
          walker.pose = workPose(action.kind, lead.step, !beat)
          if (beat && tick % 3 === 0 && walker.pose !== 'stand') onBlow(scene, walker)
          break
        }
        walker.workLeft--
        if (action.kind === 'celebrate') {
          walker.pose = 'stand'
          walker.hop = Math.floor(tick / 3) % 2 === 0 ? -2 : 0
        } else {
          walker.pose = workPose(action.kind, walker.step, beat)
          // A blow lands as the tool comes down.
          if (!beat && tick % 3 === 0 && walker.pose !== 'stand') onBlow(scene, walker)
        }
        if (walker.workLeft <= 0) {
          if (walker.step + 1 < STEPS[action.kind].length) startStep(scene, walker, walker.step + 1)
          else finish(scene, walker)
        }
        break
      }
      case 'goingIn':
        if (walker.home === undefined) {
          walker.phase = 'idle'
          break
        }
        if (walk(walker, tick)) {
          openDoor(scene, walker.home)
          walker.phase = 'inside'
          walker.restUntil = tick + 40 + Math.floor(scene.rand() * 60)
        }
        break
      case 'inside':
        // Out again in the morning, or after a short visit by day; a nap lasts until the village wakes.
        if (!isNight && !walker.isNapping && tick >= walker.restUntil) leaveHome(scene, walker)
        break
      case 'scouting':
        if (walk(walker, tick)) walker.phase = 'away'
        break
      case 'away':
        if (walker.awayUntil !== undefined && tick >= walker.awayUntil) {
          walker.phase = 'returning'
          walker.awayUntil = undefined
          walker.targetX = restSpot(scene)
        }
        break
      case 'returning':
        if (walk(walker, tick)) {
          walker.carry = undefined
          walker.phase = 'idle'
          walker.pose = 'stand'
          walker.restUntil = tick + 8 + Math.floor(scene.rand() * 16)
        }
        break
      case 'idle': {
        if (walker.x !== walker.targetX) {
          if (walk(walker, tick)) walker.pose = isNight ? 'sit' : 'stand'
          break
        }
        if (isWaking) {
          // Up with a start at the rooster's crow.
          walker.pose = 'stand'
          walker.hop = Math.floor((tick - scene.wokeAt!) / 3) % 2 === 0 ? -2 : 0
          break
        }
        if (scene.isDozing) {
          // Nothing to do for a long while: those with a home go in for a nap, the rest doze where they rest.
          if (walker.home !== undefined) {
            walker.isNapping = true
            walker.phase = 'goingIn'
            walker.targetX = doorX(walker.home)
            break
          }
          walker.pose = 'sit'
          break
        }
        if (tick < walker.restUntil) break
        if (!isNight && lendHand(scene, walker)) break
        // After dark those with a home turn in; by day one sometimes looks in for a while.
        if (walker.home !== undefined && (isNight || scene.rand() < 0.2)) {
          walker.phase = 'goingIn'
          walker.targetX = doorX(walker.home)
          break
        }
        const spot = isNight ? 10 + scene.rand() * 6 : 6 + scene.rand() * 30
        const side = scene.rand() < 0.5 ? -1 : 1
        walker.targetX = Math.round(campX(scene) - 4 + side * spot)
        walker.restUntil = tick + 30 + Math.floor(scene.rand() * 60)
        if (isNight) walker.pose = 'sit'
        break
      }
    }
  }
}

/** Is a plot being struck right now (for a shaking tree)? */
export function isWorked(scene: Scene, plot: number): boolean {
  return scene.walkers.some(
    w => w.phase === 'working' && w.action?.plot === plot && STEPS[w.action.kind][w.step]?.effect === undefined,
  )
}

/** Whether anything is moving; a quiet scene can be drawn less often. */
export function isBusy(scene: Scene): boolean {
  return (
    scene.queue.length > 0 ||
    scene.chips.length > 0 ||
    scene.bugs.length > 0 ||
    (scene.wokeAt !== undefined && scene.tick - scene.wokeAt < WAKE_TICKS) ||
    scene.tick < scene.rooster.crowUntil ||
    scene.walkers.some(w => (w.phase !== 'idle' && w.phase !== 'inside' && w.phase !== 'away') || w.x !== w.targetX)
  )
}
