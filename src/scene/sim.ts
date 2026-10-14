// The living part of the scene: villagers walking to work and back. Purely
// cosmetic; the village's lasting state changes in core/world.ts first, and
// the scene only shows a plot as it was until the villager has done the job.

import { TUNICS } from '../art/palette'
import type { Pose } from '../art/villager'
import { random, type Action, type ActionKind, type Plot, type Village } from '../core/world'

/** Pixels per plot, along the ground. */
export const PLOT = 12

export const plotCenter = (index: number): number => index * PLOT + PLOT / 2

type Phase = 'idle' | 'toWork' | 'working' | 'returning' | 'arriving'

export type Walker = {
  id: number
  /** Left edge of the villager's box, in world pixels. */
  x: number
  tunic: number
  facingLeft: boolean
  phase: Phase
  pose: Pose
  action?: Action
  targetX: number
  workLeft: number
  carry?: 'log' | 'stone'
  restUntil: number
  hop: number
}

export type Scene = {
  tick: number
  camp: number
  walkers: Walker[]
  queue: Action[]
  holds: Map<number, Plot>
  nextId: number
  rand: () => number
}

const SPEED = 1
const MAX_QUEUE = 6
const WORK_TICKS: Record<ActionKind, number> = {
  chop: 18,
  clear: 12,
  quarry: 18,
  plant: 14,
  tend: 12,
  harvest: 14,
  build: 18,
  forage: 10,
  arrive: 0,
  celebrate: 16,
  study: 24,
  ponder: 18,
}

/** Offset from a villager's box to its feet, for standing beside a plot. */
const REACH = 9

export function createScene(village: Village, seed = village.seed): Scene {
  const scene: Scene = {
    tick: 0,
    camp: village.camp,
    walkers: [],
    queue: [],
    holds: new Map(),
    nextId: 1,
    rand: random(seed ^ 0x5eed),
  }
  syncPopulation(scene, village)
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
    targetX: x,
    workLeft: 0,
    restUntil: 0,
    hop: 0,
  }
  scene.walkers.push(walker)
  return walker
}

/** Keeps the scene in step with the village: its camp and its population. */
export function syncScene(scene: Scene, village: Village): void {
  const shift = village.camp - scene.camp
  if (shift !== 0) {
    for (const w of scene.walkers) {
      w.x += shift * PLOT
      w.targetX += shift * PLOT
    }
    scene.queue = scene.queue.map(a => ({ ...a }))
    const holds = new Map<number, Plot>()
    for (const [index, plot] of scene.holds) holds.set(index + shift, plot)
    scene.holds = holds
    scene.camp = village.camp
  }
  syncPopulation(scene, village)
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
  }
}

function standFor(walker: Walker, action: Action): { x: number; facingLeft: boolean } {
  const center = plotCenter(action.plot)
  const fromRight = walker.x + 4 > center
  return fromRight ? { x: center + 1, facingLeft: true } : { x: center - REACH - 1, facingLeft: false }
}

function workPose(kind: ActionKind, beat: boolean): Pose {
  switch (kind) {
    case 'chop':
    case 'clear':
      return beat ? 'axeUp' : 'axeDown'
    case 'quarry':
      return beat ? 'pickUp' : 'pickDown'
    case 'build':
      return beat ? 'hammerUp' : 'hammerDown'
    case 'tend':
      return beat ? 'water1' : 'water2'
    case 'plant':
    case 'harvest':
    case 'forage':
      return 'kneel'
    case 'study':
      return 'read'
    case 'ponder':
      return beat ? 'ponder1' : 'ponder2'
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
  else walker.pose = Math.floor(tick / 2) % 2 === 0 ? 'walk1' : 'walk2'
  return false
}

/** Advances the scene by one frame. `isNight` sends idle villagers to the fire. */
export function stepScene(scene: Scene, isNight: boolean): void {
  scene.tick++
  const tick = scene.tick

  for (const walker of scene.walkers) {
    if (walker.phase !== 'idle' || scene.queue.length === 0) continue
    const action = scene.queue.shift()!
    walker.action = action
    walker.phase = 'toWork'
    const stand = standFor(walker, action)
    walker.targetX = stand.x
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
          walker.facingLeft = standFor(walker, action).facingLeft
          walker.phase = 'working'
          walker.workLeft = WORK_TICKS[action.kind]
        }
        break
      }
      case 'working': {
        const action = walker.action!
        walker.workLeft--
        if (action.kind === 'celebrate') {
          walker.pose = 'stand'
          walker.hop = Math.floor(tick / 3) % 2 === 0 ? -2 : 0
        } else {
          walker.pose = workPose(action.kind, Math.floor(tick / 3) % 2 === 0)
        }
        if (walker.workLeft <= 0) {
          scene.holds.delete(action.plot)
          walker.carry = action.kind === 'chop' || action.kind === 'clear' ? 'log' : action.kind === 'quarry' ? 'stone' : undefined
          walker.action = undefined
          walker.phase = 'returning'
          walker.targetX = campX(scene) - 14 - Math.floor(scene.rand() * 4)
        }
        break
      }
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
        if (tick < walker.restUntil) break
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

/** Is a plot being worked on right now (for a shaking tree)? */
export function isWorked(scene: Scene, plot: number): boolean {
  return scene.walkers.some(w => w.phase === 'working' && w.action?.plot === plot)
}

/** Whether anything is moving; a quiet scene can be drawn less often. */
export function isBusy(scene: Scene): boolean {
  return scene.queue.length > 0 || scene.walkers.some(w => w.phase !== 'idle' || w.x !== w.targetX)
}
