// Composes one frame of the village: sky, hills, ground, plots, villagers.

import { P, skyFor, type Sky } from '../art/palette'
import {
  CAMPFIRE,
  CLOUD,
  CROPS,
  EMBERS,
  FARM_SOIL,
  FLOWER,
  HOUSE,
  HUT,
  LOG,
  ROCKS,
  STONE_BLOCK,
  STOREHOUSE,
  STUMP,
  TENT,
  TOWER,
  TREES,
  TUFT,
  WELL,
  WORKSHOP,
} from '../art/sprites'
import { drawVillager, VILLAGER_HEIGHT } from '../art/villager'
import type { BuildingKind } from '../core/balance'
import { BUILDINGS } from '../core/balance'
import { hash01, wildPlot, type Plot, type Village } from '../core/world'
import { invertMonochrome, isMono, toGrayscale, toMonochrome, type Palette } from '../pixel/filter'
import { CLEAR, createCanvas, drawSprite, fillRect, mix, setPixel, type Canvas, type Sprite } from '../pixel/canvas'
import { FALL_TICKS, isWorked, plotCenter, PLOT, type Chip, type Effect, type Scene } from './sim'

/** Scene heights in pixels; a terminal row holds two. */
export const SCENE_HEIGHTS = { small: 14, medium: 20 } as const
export type SceneSize = keyof typeof SCENE_HEIGHTS

/**
 * Height of the small scene drawn as an image at half-cell pixels: four
 * pixels to a terminal row, so it must be a multiple of four.
 */
export const FINE_SMALL_HEIGHT = 16

/** The row the grass is drawn on: a thinner band of soil in a small scene. */
const groundOf = (canvas: Canvas): number => canvas.height - (canvas.height >= 18 ? 4 : 2)

const BUILDING_ART: Readonly<Record<BuildingKind, Sprite>> = {
  tent: TENT,
  hut: HUT,
  well: WELL,
  storehouse: STOREHOUSE,
  house: HOUSE,
  workshop: WORKSHOP,
  tower: TOWER,
}

export type FrameTime = {
  /** Local hour of day, 0..24, fractional. */
  hour: number
}

export type FrameStyle = {
  /** Scene height in pixels. */
  height?: number
  palette?: Palette
}

function drawSky(canvas: Canvas, sky: Sky, tick: number, seed: number, camera: number): void {
  const GROUND = groundOf(canvas)
  for (let y = 0; y < GROUND; y++) {
    const color = mix(sky.top, sky.bottom, y / (GROUND - 1))
    fillRect(canvas, 0, y, canvas.width, 1, color)
  }
  if (sky.stars) {
    for (let x = 0; x < canvas.width; x++) {
      const wx = x + Math.floor(camera / 8)
      if (hash01(seed, wx * 31) < 0.06) {
        const y = Math.floor(hash01(seed + 1, wx) * 8)
        const twinkle = hash01(seed + 2, wx + Math.floor(tick / 6)) < 0.85
        if (twinkle) setPixel(canvas, x, y, mix(sky.top, P.white, 0.8))
      }
    }
  } else {
    // Clouds drift slowly from left to right.
    const span = canvas.width + 40
    for (let i = 0; i < 3; i++) {
      const base = hash01(seed + 40, i) * span
      const x = ((base + tick / (6 + i * 3) - camera / 6) % span + span) % span - 20
      const y = 1 + Math.floor(hash01(seed + 41, i) * 4)
      drawSprite(canvas, CLOUD, x, y, { recolor: new Map([[P.white, mix(sky.bottom, P.white, 0.75)]]) })
    }
  }
}

function drawHills(canvas: Canvas, sky: Sky, camera: number): void {
  const GROUND = groundOf(canvas)
  for (let x = 0; x < canvas.width; x++) {
    const far = (x + camera / 4) / 9
    const near = (x + camera / 2) / 6
    const farTop = GROUND - 5 - Math.round(2 * Math.sin(far) + Math.sin(far * 0.37) * 2)
    const nearTop = GROUND - 2 - Math.round(1.5 * Math.sin(near * 0.8 + 1) + Math.sin(near * 0.23))
    for (let y = Math.max(0, farTop); y < GROUND; y++) setPixel(canvas, x, y, sky.hillFar)
    for (let y = Math.max(0, nearTop); y < GROUND; y++) setPixel(canvas, x, y, sky.hillNear)
  }
}

function drawGround(canvas: Canvas, sky: Sky, seed: number, camera: number): void {
  const GROUND = groundOf(canvas)
  fillRect(canvas, 0, GROUND, canvas.width, 1, sky.grass)
  fillRect(canvas, 0, GROUND + 1, canvas.width, canvas.height - GROUND - 1, sky.dirt)
  for (let x = 0; x < canvas.width; x++) {
    const wx = x + camera
    if (hash01(seed + 3, wx) < 0.3) setPixel(canvas, x, GROUND, sky.grassLight)
    if (hash01(seed + 4, wx) < 0.12) setPixel(canvas, x, GROUND + 2 + Math.floor(hash01(seed + 5, wx) * 2), sky.dirtDark)
  }
}

const bottomY = (canvas: Canvas, sprite: Sprite): number => groundOf(canvas) + 1 - sprite.height

function drawPlot(
  canvas: Canvas,
  plot: Plot,
  x0: number,
  seed: number,
  index: number,
  shake: number,
  tick: number,
): void {
  const GROUND = groundOf(canvas)
  const centered = (sprite: Sprite): number => x0 + Math.floor((PLOT - sprite.width) / 2)
  switch (plot.kind) {
    case 'tree': {
      const art = TREES[plot.variant % TREES.length]!
      drawSprite(canvas, art, centered(art) + shake, bottomY(canvas, art))
      break
    }
    case 'rock': {
      const art = ROCKS[plot.variant % ROCKS.length]!
      drawSprite(canvas, art, centered(art), bottomY(canvas, art))
      break
    }
    case 'stump':
      drawSprite(canvas, STUMP, centered(STUMP), bottomY(canvas, STUMP))
      break
    case 'grass':
      if (hash01(seed + 9, index) < 0.6) drawSprite(canvas, TUFT, x0 + 2 + Math.floor(hash01(seed, index) * 6), GROUND - 1)
      if (hash01(seed + 10, index) < 0.5) drawSprite(canvas, FLOWER, x0 + 1 + Math.floor(hash01(seed + 11, index) * 9), GROUND - 1)
      break
    case 'farm': {
      drawSprite(canvas, FARM_SOIL, x0 + 1, GROUND)
      const crop = CROPS[Math.min(plot.growth, CROPS.length - 1)]!
      drawSprite(canvas, crop, x0 + 1, GROUND - crop.height)
      break
    }
    case 'camp': {
      const fire = CAMPFIRE[Math.floor(tick / 2) % CAMPFIRE.length]!
      drawSprite(canvas, fire, centered(fire), bottomY(canvas, fire))
      break
    }
    case 'building': {
      const art = BUILDING_ART[plot.building]
      const total = BUILDINGS[plot.building].steps
      const done = plot.progress >= total
      const x = centered(art)
      const y = bottomY(canvas, art)
      if (done) {
        drawSprite(canvas, art, x, y)
      } else {
        const reveal = Math.max(0.12, plot.progress / total)
        drawSprite(canvas, art, x, y, { reveal })
        // Scaffolding around the unfinished part.
        for (let sy = y; sy <= GROUND; sy++) {
          setPixel(canvas, x - 1, sy, P.woodDark)
          setPixel(canvas, x + art.width, sy, P.woodDark)
          if ((sy - y) % 4 === 0) fillRect(canvas, x - 1, sy, art.width + 2, 1, P.wood)
        }
      }
      break
    }
  }
}

/** Rows a felled tree leaves standing: its stump. */
const STUMP_ROWS = 3

/**
 * Draws a tree turned about the top of its stump by `angle` radians (positive
 * leans right), sampling the sprite backwards so no pixel is left as a hole.
 */
function drawTreeTurned(canvas: Canvas, art: Sprite, x: number, y: number, angle: number, groundY: number): void {
  const pivotX = Math.floor(art.width / 2)
  const pivotY = art.height - STUMP_ROWS
  const originX = x + pivotX
  // As it comes down it rests on its crown, so the trunk lifts off the ground a little.
  const originY = y + pivotY - Math.round(Math.abs(Math.sin(angle)) * 2)
  const radius = Math.ceil(Math.hypot(art.width, art.height))
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  for (let dy = -radius; dy <= radius; dy++) {
    const py = originY + dy
    // A falling tree lies on the grass, never in the soil.
    if (py > groundY) continue
    for (let dx = -radius; dx <= radius; dx++) {
      const sx = Math.round(dx * cos + dy * sin) + pivotX
      const sy = Math.round(-dx * sin + dy * cos) + pivotY
      if (sx < 0 || sy < 0 || sx >= art.width || sy >= pivotY) continue
      const color = art.pixels[sy * art.width + sx]!
      if (color !== CLEAR) setPixel(canvas, originX + dx, py, color)
    }
  }
}

/** A plot in the middle of a job: a tree falling or felled, a boulder cracked or broken. */
function drawEffect(canvas: Canvas, effect: Effect, plot: Plot, x0: number, tick: number): void {
  const GROUND = groundOf(canvas)
  const centered = (sprite: Sprite): number => x0 + Math.floor((PLOT - sprite.width) / 2)
  if (effect.kind === 'falling' || effect.kind === 'felled') {
    drawSprite(canvas, STUMP, centered(STUMP), bottomY(canvas, STUMP))
    if (plot.kind !== 'tree') return
    const art = TREES[plot.variant % TREES.length]!
    // It tips slowly, then gathers speed until it hits the ground.
    const t = effect.kind === 'felled' ? 1 : Math.min(1, (tick - effect.start) / FALL_TICKS)
    const angle = (Math.PI / 2) * t * t * (effect.towardLeft ? -1 : 1)
    drawTreeTurned(canvas, art, centered(art), bottomY(canvas, art), angle, GROUND)
    return
  }
  if (plot.kind === 'rock' && effect.kind === 'cracked') {
    const art = ROCKS[plot.variant % ROCKS.length]!
    const x = centered(art)
    const y = bottomY(canvas, art)
    drawSprite(canvas, art, x, y)
    const mid = Math.floor(art.width / 2)
    for (let i = 0; i < art.height - 1; i++) setPixel(canvas, x + mid + (i % 2), y + i, P.outline)
    return
  }
  // Broken up: a few blocks of stone waiting to be carried off.
  for (const dx of [1, 5, 9]) drawSprite(canvas, STONE_BLOCK, x0 + dx - 1, GROUND - 1)
}

const CHIP_COLORS: Readonly<Record<Chip['color'], number>> = { wood: P.woodLight, stone: P.stoneLight, leaf: P.leaf }

function drawChips(canvas: Canvas, scene: Scene, camera: number): void {
  const GROUND = groundOf(canvas)
  for (const chip of scene.chips) setPixel(canvas, Math.round(chip.x - camera), Math.round(GROUND + chip.y), CHIP_COLORS[chip.color])
}

function drawStockpile(canvas: Canvas, village: Village, x: number): void {
  const GROUND = groundOf(canvas)
  // A small woodpile right of the fire; it grows with the wood in store.
  const logs = Math.min(3, Math.ceil(village.resources.wood / 6))
  for (let i = 0; i < logs; i++) drawSprite(canvas, LOG, x, GROUND - 1 - i * 2)
}

function nightShade(canvas: Canvas, background: Int32Array, sky: Sky, fireX: number): void {
  if (sky.dim <= 0) return
  const GROUND = groundOf(canvas)
  const night = 0x0d1328
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const i = y * canvas.width + x
      const color = canvas.pixels[i]!
      const dist = Math.hypot(x - fireX, (y - (GROUND - 3)) * 1.4)
      const glow = sky.stars ? Math.max(0, 1 - dist / 22) : 0
      // The backdrop is already drawn in night colours; dim only what stands on it.
      const dimmed = color === background[i] ? color : mix(color, night, sky.dim * (1 - glow))
      canvas.pixels[i] = glow > 0 ? mix(dimmed, P.fire, glow * 0.18) : dimmed
    }
  }
}

/**
 * Draws a frame `width` pixels wide centred on the camp. Plots outside the
 * village are drawn as the wilderness that will be cleared there later.
 */
export function renderFrame(
  village: Village,
  scene: Scene,
  width: number,
  time: FrameTime,
  style: FrameStyle = {},
): Canvas {
  const palette = style.palette ?? 'color'
  // Line art reads best by daylight; night would turn it to solid ink.
  const sky = skyFor(isMono(palette) ? 12 : time.hour)
  const canvas = createCanvas(width, style.height ?? SCENE_HEIGHTS.medium)
  const GROUND = groundOf(canvas)
  const camera = Math.round(plotCenter(village.camp) - width / 2)
  const tick = scene.tick

  drawSky(canvas, sky, tick, village.seed, camera)
  drawHills(canvas, sky, camera)
  drawGround(canvas, sky, village.seed, camera)
  const background = canvas.pixels.slice()

  const first = Math.floor(camera / PLOT) - 1
  const last = Math.ceil((camera + width) / PLOT) + 1
  const lit: { sprite: Sprite; x: number; y: number }[] = []
  for (let index = first; index <= last; index++) {
    const inside = index >= 0 && index < village.plots.length
    const plot = inside ? (scene.holds.get(index) ?? village.plots[index]!) : wildPlot(village.seed, index - village.camp)
    const x0 = index * PLOT - camera
    const effect = inside ? scene.effects.get(index) : undefined
    const shake = inside && plot.kind === 'tree' && isWorked(scene, index) ? (Math.floor(tick / 3) % 2 === 0 ? 1 : -1) : 0
    if (effect) drawEffect(canvas, effect, plot, x0, tick)
    else drawPlot(canvas, plot, x0, village.seed, index, shake, tick)
    if (plot.kind === 'building' && plot.progress >= BUILDINGS[plot.building].steps) {
      const art = BUILDING_ART[plot.building]
      lit.push({ sprite: art, x: x0 + Math.floor((PLOT - art.width) / 2), y: bottomY(canvas, art) })
    }
  }

  const fireX = plotCenter(village.camp) - camera
  drawStockpile(canvas, village, fireX + 4)

  const sorted = [...scene.walkers].sort((a, b) => a.id - b.id)
  for (const w of sorted) {
    drawVillager(canvas, w.x - camera, GROUND + 2 - VILLAGER_HEIGHT + w.hop, w.pose, w.tunic, w.facingLeft)
  }
  drawChips(canvas, scene, camera)

  nightShade(canvas, background, sky, fireX)
  if (sky.dim > 0) {
    // Fires and windows keep their light after dark.
    const fire = sky.stars ? CAMPFIRE[Math.floor(tick / 2) % CAMPFIRE.length]! : EMBERS
    if (sky.stars) drawSprite(canvas, fire, fireX - Math.floor(fire.width / 2), bottomY(canvas, fire), { only: P.fire })
    if (sky.stars) drawSprite(canvas, fire, fireX - Math.floor(fire.width / 2), bottomY(canvas, fire), { only: P.fireCore })
    for (const { sprite, x, y } of lit) drawSprite(canvas, sprite, x, y, { only: P.window })
  }
  if (palette === 'grayscale') return toGrayscale(canvas)
  if (palette === 'mono-dark') return invertMonochrome(toMonochrome(canvas, background, GROUND))
  if (isMono(palette)) return toMonochrome(canvas, background, GROUND)
  return canvas
}

