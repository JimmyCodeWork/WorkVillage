// The villager: an original 9x9 figure drawn pixel by pixel so poses and
// tools can be combined freely.

import { setPixel, type Canvas } from '../pixel/canvas'
import { P } from './palette'

export type Pose =
  | 'stand'
  | 'walk1'
  | 'walk2'
  | 'axeUp'
  | 'axeDown'
  | 'pickUp'
  | 'pickDown'
  | 'hammerUp'
  | 'hammerDown'
  | 'kneel'
  | 'water1'
  | 'water2'
  | 'carryLog'
  | 'carryStone'
  | 'sit'
  | 'read'
  | 'ponder1'
  | 'ponder2'
  | 'rodCast'
  | 'rodOut'
  | 'rodPull'
  | 'holdUp'
  | 'carrySack'

/** Width of the box the villager is drawn in; the body sits in its middle. */
export const VILLAGER_WIDTH = 9
export const VILLAGER_HEIGHT = 9

type Px = readonly [x: number, y: number, color: number]

const HEAD: readonly Px[] = [
  [3, 1, P.hair], [4, 1, P.hair], [5, 1, P.hair],
  [2, 2, P.hair], [3, 2, P.hair], [4, 2, P.hair], [5, 2, P.hair], [6, 2, P.skin],
  [3, 3, P.hair], [4, 3, P.skin], [5, 3, P.outline], [6, 3, P.skin],
  [4, 4, P.skin], [5, 4, P.skinShade],
]

const TORSO = (tunic: number): readonly Px[] => [
  [3, 5, tunic], [4, 5, tunic], [5, 5, tunic],
  [3, 6, tunic], [4, 6, tunic], [5, 6, tunic],
]

const LEGS: Record<'stand' | 'walk1' | 'walk2' | 'kneel' | 'sit', readonly Px[]> = {
  stand: [[3, 7, P.pants], [5, 7, P.pants], [3, 8, P.boot], [5, 8, P.boot]],
  walk1: [[3, 7, P.pants], [5, 7, P.pants], [2, 8, P.boot], [6, 8, P.boot]],
  walk2: [[4, 7, P.pants], [4, 8, P.boot], [5, 8, P.boot]],
  kneel: [[3, 7, P.pants], [4, 7, P.pants], [5, 7, P.pants], [6, 8, P.boot], [3, 8, P.pants]],
  sit: [[4, 7, P.pants], [5, 7, P.pants], [6, 7, P.pants], [6, 8, P.boot]],
}

// Arms and tools, drawn over the body. Coordinates face right.
const ARMS: Record<Pose, readonly Px[]> = {
  stand: [[6, 6, P.skin]],
  walk1: [[6, 5, P.tunic], [6, 6, P.skin]],
  walk2: [[2, 6, P.skin]],
  axeUp: [[6, 4, P.skin], [6, 3, P.wood], [7, 2, P.wood], [7, 1, P.metal], [8, 1, P.metal], [8, 2, P.metal]],
  axeDown: [[6, 5, P.skin], [7, 6, P.wood], [8, 7, P.metal], [8, 6, P.metal]],
  pickUp: [[6, 4, P.skin], [6, 3, P.wood], [7, 2, P.wood], [6, 1, P.metal], [7, 1, P.metal], [8, 1, P.metal]],
  pickDown: [[6, 5, P.skin], [7, 6, P.wood], [8, 6, P.metal], [8, 7, P.metal], [8, 5, P.metal]],
  hammerUp: [[6, 4, P.skin], [7, 3, P.wood], [7, 2, P.metal], [8, 2, P.metal]],
  hammerDown: [[6, 5, P.skin], [7, 5, P.wood], [8, 5, P.metal], [8, 6, P.metal]],
  kneel: [[6, 6, P.skin], [7, 7, P.sprout]],
  water1: [[6, 5, P.skin], [7, 5, P.metal], [8, 5, P.metal], [8, 6, P.water]],
  water2: [[6, 5, P.skin], [7, 5, P.metal], [8, 5, P.metal], [8, 7, P.water]],
  carryLog: [[6, 4, P.skin], [2, 0, P.woodLight], [3, 0, P.wood], [4, 0, P.wood], [5, 0, P.wood], [6, 0, P.woodDark]],
  carryStone: [[6, 5, P.skin], [6, 4, P.stoneLight], [7, 4, P.stone], [7, 5, P.stoneDark]],
  sit: [[6, 6, P.skin]],
  // Seated with an open book on the knees.
  read: [[5, 5, P.skin], [6, 4, P.white], [7, 4, P.white], [6, 5, P.woodDark], [7, 5, P.woodDark]],
  // A hand at the chin, and a spark of an idea that comes and goes.
  ponder1: [[6, 5, P.skin], [6, 4, P.skinShade], [7, 0, P.fireCore], [8, -1, P.fireCore]],
  ponder2: [[6, 5, P.skin], [6, 4, P.skinShade], [7, 0, P.fireCore]],
  // A fishing rod: drawn back over the shoulder, held out over the water, pulled up as a fish bites.
  rodCast: [[5, 4, P.skin], [4, 3, P.woodDark], [3, 2, P.woodDark], [2, 1, P.woodDark], [1, 0, P.woodDark]],
  rodOut: [[6, 5, P.skin], [7, 4, P.woodDark], [8, 3, P.woodDark], [9, 2, P.woodDark], [10, 1, P.woodDark]],
  rodPull: [[6, 4, P.skin], [7, 3, P.woodDark], [7, 2, P.woodDark], [8, 1, P.woodDark], [8, 0, P.woodDark]],
  // Both hands up, holding what came out of the water over the head.
  holdUp: [[6, 4, P.skin], [6, 3, P.skin], [2, 4, P.skin], [2, 3, P.skin]],
  // A full sack over the shoulder, back from a scout's errand.
  carrySack: [[5, 4, P.skin], [1, 2, P.thatch], [2, 2, P.thatch], [1, 3, P.thatchDark], [2, 3, P.thatch], [3, 3, P.thatchDark], [2, 4, P.thatchDark]],
}

/** Where the tip of the rod is in a pose, facing right, for drawing the line. */
export const ROD_TIP: Partial<Record<Pose, readonly [x: number, y: number]>> = {
  rodOut: [10, 1],
  rodPull: [8, 0],
}

function legsFor(pose: Pose): readonly Px[] {
  if (pose === 'walk1' || pose === 'carryLog' || pose === 'carryStone' || pose === 'carrySack') return LEGS.walk1
  if (pose === 'walk2') return LEGS.walk2
  if (pose === 'kneel' || pose === 'water1' || pose === 'water2') return LEGS.kneel
  if (pose === 'sit' || pose === 'read') return LEGS.sit
  return LEGS.stand
}

/**
 * Draws a villager whose box's top-left is (x, y). `facingLeft` mirrors it.
 * Kneeling and sitting poses lower the upper body by one pixel.
 */
export function drawVillager(
  canvas: Canvas,
  x: number,
  y: number,
  pose: Pose,
  tunic: number,
  facingLeft: boolean,
  shade: (color: number) => number = c => c,
): void {
  const ox = Math.round(x)
  const oy = Math.round(y)
  const put = (px: number, py: number, color: number): void => {
    const dx = facingLeft ? VILLAGER_WIDTH - 1 - px : px
    setPixel(canvas, ox + dx, oy + py, shade(color === P.tunic ? tunic : color))
  }
  const lower = pose === 'kneel' || pose === 'water1' || pose === 'water2' || pose === 'sit' || pose === 'read' ? 1 : 0
  for (const [px, py, color] of legsFor(pose)) put(px, py, color)
  for (const [px, py, color] of TORSO(tunic)) put(px, py + lower, color)
  for (const [px, py, color] of HEAD) put(px, py + lower, color)
  for (const [px, py, color] of ARMS[pose]) put(px, py + (py >= 7 ? 0 : lower), color)
}
