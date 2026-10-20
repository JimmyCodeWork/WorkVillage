// Composes one frame of the village: sky, hills, ground, plots, villagers.

import { P, ROOF_COLORS, SEASON_DRIFT, SEASON_LEAVES, seasonSky, skyFor, type Sky } from '../art/palette'
import {
  CAUGHT_BOOT,
  CAUGHT_CHEST,
  CAUGHT_FISH,
  BANNER,
  BARREL,
  BENCH,
  CAMPFIRE,
  CRATE,
  FLOWER_POT,
  LANTERN,
  WOODPILE,
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
import { drawVillager, ROD_TIP, VILLAGER_HEIGHT, VILLAGER_WIDTH } from '../art/villager'
import type { BuildingKind, PropStyle } from '../core/balance'
import { BUILDINGS } from '../core/balance'
import { hash01, seasonOf, wildPlot, type Look, type Plot, type Season, type Village } from '../core/world'
import { invertMonochrome, isMono, toGrayscale, toMonochrome, type Palette } from '../pixel/filter'
import { CLEAR, createCanvas, drawSprite, fillRect, mix, setPixel, type Canvas, type Sprite } from '../pixel/canvas'
import { FALL_TICKS, isWorked, occupied, plotCenter, PLOT, type Catch, type Chip, type Effect, type Scene, type Walker } from './sim'

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

const PROP_ART: Readonly<Record<Exclude<PropStyle, 'none'>, Sprite>> = {
  barrel: BARREL,
  crate: CRATE,
  woodpile: WOODPILE,
  flowers: FLOWER_POT,
  lantern: LANTERN,
  bench: BENCH,
  banner: BANNER,
}

/**
 * How a building looks: as chosen when it was placed, or, for one raised
 * before buildings had looks, picked from the village's kit by where it stands.
 */
function lookOf(village: Village, index: number, plot: Plot): Look {
  if (plot.kind === 'building' && plot.look) return plot.look
  const at = index - village.camp
  const { kit, seed } = village
  return {
    roof: hash01(seed + 31, at) < 0.5 ? kit.accent : kit.roofs[Math.floor(hash01(seed + 37, at) * kit.roofs.length)]!,
    prop: kit.props[Math.floor(hash01(seed + 41, at) * kit.props.length)]!,
    mirrored: hash01(seed + 43, at) < 0.5,
  }
}

/** Where a building's decoration stands: at the corner of its plot, away from the way it faces. */
function propAt(look: Look, x0: number, art: Sprite): number {
  return look.mirrored ? x0 : x0 + PLOT - art.width
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
  season: Season,
  look?: Look,
  isDoorOpen = false,
): void {
  const GROUND = groundOf(canvas)
  const isWinter = season === 'winter'
  const centered = (sprite: Sprite): number => x0 + Math.floor((PLOT - sprite.width) / 2)
  switch (plot.kind) {
    case 'tree': {
      const art = TREES[plot.variant % TREES.length]!
      drawSprite(canvas, art, centered(art) + shake, bottomY(canvas, art), { recolor: SEASON_LEAVES[season] })
      break
    }
    case 'rock': {
      const art = ROCKS[plot.variant % ROCKS.length]!
      drawSprite(canvas, art, centered(art), bottomY(canvas, art))
      if (isWinter) drawSnowCap(canvas, art, centered(art), bottomY(canvas, art), false)
      break
    }
    case 'stump':
      drawSprite(canvas, STUMP, centered(STUMP), bottomY(canvas, STUMP))
      if (isWinter) drawSnowCap(canvas, STUMP, centered(STUMP), bottomY(canvas, STUMP), false)
      break
    case 'grass':
      // Tufts and flowers lie under the snow in winter.
      if (isWinter) break
      if (hash01(seed + 9, index) < 0.6) drawSprite(canvas, TUFT, x0 + 2 + Math.floor(hash01(seed, index) * 6), GROUND - 1)
      if (hash01(seed + 10, index) < 0.5) drawSprite(canvas, FLOWER, x0 + 1 + Math.floor(hash01(seed + 11, index) * 9), GROUND - 1)
      break
    case 'farm': {
      drawSprite(canvas, FARM_SOIL, x0 + 1, GROUND)
      // Fields lie fallow under the snow until spring.
      if (isWinter) {
        fillRect(canvas, x0 + 1, GROUND, FARM_SOIL.width, 1, P.white)
        break
      }
      const crop = CROPS[Math.min(plot.growth, CROPS.length - 1)]!
      drawSprite(canvas, crop, x0 + 1, GROUND - crop.height)
      break
    }
    case 'pond':
      drawPond(canvas, x0, index, tick, season)
      break
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
      const roof = look ? ROOF_COLORS[look.roof] : new Map<number, number>()
      // An open door shows the dark of the room behind it.
      const recolor = isDoorOpen ? new Map([...roof, [P.door, P.outline]]) : roof
      const style = { recolor, flip: look?.mirrored }
      if (done) {
        drawSprite(canvas, art, x, y, style)
        if (isWinter) {
          drawSnowCap(canvas, art, x, y, style.flip === true)
          if (plot.building === 'house') drawSmoke(canvas, x + (style.flip ? 1 : art.width - 3), y, tick)
        }
        if (look && look.prop !== 'none' && plot.building !== 'well') {
          const prop = PROP_ART[look.prop]
          drawSprite(canvas, prop, propAt(look, x0, prop), GROUND + 1 - prop.height, style)
        }
      } else {
        const reveal = Math.max(0.12, plot.progress / total)
        drawSprite(canvas, art, x, y, { ...style, reveal })
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

const WATER = { surface: 0x5b93cf, deep: 0x3f6fae, glint: 0xa9d2f2 }
const ICE = { surface: 0xcfe3ef, deep: 0xa9c8dc, glint: P.white }

/** A pond set into the ground, with reeds at its banks; frozen over in winter. */
function drawPond(canvas: Canvas, x0: number, index: number, tick: number, season: Season): void {
  const GROUND = groundOf(canvas)
  const water = season === 'winter' ? ICE : WATER
  fillRect(canvas, x0 + 1, GROUND, PLOT - 2, 1, water.surface)
  fillRect(canvas, x0 + 2, GROUND + 1, PLOT - 4, canvas.height - GROUND - 1, water.deep)
  // A glint drifting across the surface.
  setPixel(canvas, x0 + 2 + ((Math.floor(tick / 5) + index * 3) % (PLOT - 4)), GROUND, water.glint)
  if (season !== 'winter') {
    setPixel(canvas, x0 + 7, GROUND, P.leaf)
    setPixel(canvas, x0 + 8, GROUND, P.leafDark)
  }
  const reed = season === 'autumn' || season === 'winter' ? P.thatchDark : P.crop
  for (const [x, height] of [[x0, 3], [x0 + 1, 2], [x0 + PLOT - 1, 2]] as const) {
    for (let k = 1; k <= height; k++) setPixel(canvas, x, GROUND - k, reed)
  }
  setPixel(canvas, x0, GROUND - 3, P.woodDark)
}

const CAUGHT: Readonly<Record<Catch, Sprite>> = { fish: CAUGHT_FISH, boot: CAUGHT_BOOT, chest: CAUGHT_CHEST }

/**
 * The fishing line and float for a villager at the pond: the float bobbing
 * while it waits, pulled under at a bite with a start of surprise, drawn in
 * as the line is reeled, and the catch held up at the end.
 */
function drawFishing(canvas: Canvas, w: Walker, camera: number, tick: number): void {
  if (w.phase !== 'working' || w.action?.kind !== 'fish') return
  const GROUND = groundOf(canvas)
  const top = GROUND + 2 - VILLAGER_HEIGHT + w.hop
  const x = Math.round(w.x - camera)
  if (w.step === 4 && w.caught) {
    const art = CAUGHT[w.caught]
    drawSprite(canvas, art, x + Math.floor((VILLAGER_WIDTH - art.width) / 2), top - art.height + 1)
    return
  }
  if (w.step === 2) {
    // A start of surprise as the float goes under.
    for (const dy of [-4, -3, -1]) setPixel(canvas, x + 4, top + dy, P.fireCore)
  }
  const tip = ROD_TIP[w.pose]
  if (!tip) return
  const tipX = x + (w.facingLeft ? VILLAGER_WIDTH - 1 - tip[0] : tip[0])
  const tipY = top + tip[1]
  const pond = Math.round(plotCenter(w.action.plot) - camera)
  const reel = w.step === 3 ? Math.max(0, w.workLeft) / 10 : 1
  const floatX = Math.round(tipX + (pond - tipX) * reel)
  const sunk = w.step === 2
  const floatY = sunk ? GROUND : w.step === 3 ? GROUND - 1 - Math.round((1 - reel) * 3) : GROUND - 1 + (Math.floor(tick / 6) % 2)
  const steps = Math.max(Math.abs(floatX - tipX), Math.abs(floatY - tipY), 1)
  const sag = w.step === 1 ? 2 : 0.5
  for (let i = 1; i < steps; i++) {
    const t = i / steps
    const lx = Math.round(tipX + (floatX - tipX) * t)
    const ly = Math.round(tipY + (floatY - tipY) * t + Math.sin(Math.PI * t) * sag)
    setPixel(canvas, lx, ly, 0xd9dde2)
  }
  if (sunk) {
    setPixel(canvas, floatX - 1, GROUND, WATER.glint)
    setPixel(canvas, floatX + 1, GROUND, WATER.glint)
  } else {
    setPixel(canvas, floatX, floatY, P.ember)
  }
}

/** Snow on whatever is uppermost in each column of a sprite. */
function drawSnowCap(canvas: Canvas, art: Sprite, x: number, y: number, flip: boolean): void {
  for (let sx = 0; sx < art.width; sx++) {
    const source = flip ? art.width - 1 - sx : sx
    for (let sy = 0; sy < art.height; sy++) {
      if (art.pixels[sy * art.width + source] === CLEAR) continue
      setPixel(canvas, x + sx, y + sy, P.white)
      break
    }
  }
}

/** Smoke rising from a chimney whose top is at (x, y), drifting as it goes. */
function drawSmoke(canvas: Canvas, x: number, y: number, tick: number): void {
  for (let k = 0; k < 3; k++) {
    const rise = (Math.floor(tick / 3) + k * 3) % 8
    const sway = Math.round(Math.sin((tick + k * 9) / 6))
    setPixel(canvas, x + sway + Math.floor(rise / 3), y - 1 - rise, mix(P.stoneLight, P.white, rise / 8))
  }
}

/**
 * What drifts through the air: petals in spring, leaves in autumn, snow in
 * winter. Each flake keeps its own column and pace, so the drift looks loose.
 */
function drawDrift(canvas: Canvas, season: Season, tick: number, seed: number, camera: number): void {
  const color = SEASON_DRIFT[season]
  if (color === undefined) return
  const GROUND = groundOf(canvas)
  const isSnow = season === 'winter'
  const count = Math.ceil((canvas.width / 100) * (isSnow ? 14 : 5))
  const span = canvas.width + 16
  for (let i = 0; i < count; i++) {
    const speed = (isSnow ? 0.18 : 0.12) + hash01(seed + 51, i) * 0.1
    const fall = hash01(seed + 52, i) * GROUND + tick * speed
    const y = Math.floor(fall % GROUND)
    const lap = Math.floor(fall / GROUND)
    const drift = hash01(seed + 53, i + lap * 977) * span + tick * 0.05 - camera / 3
    const x = Math.round((((drift + Math.sin((tick + i * 7) / 9) * 1.5) % span) + span) % span) - 8
    setPixel(canvas, x, y, color)
  }
}

/** Fireflies over the grass on a summer night, each glowing and fading on its own. */
function drawFireflies(canvas: Canvas, tick: number, seed: number, camera: number): void {
  const GROUND = groundOf(canvas)
  const count = Math.ceil(canvas.width / 16)
  for (let i = 0; i < count; i++) {
    if (Math.floor(tick / 4 + hash01(seed + 61, i) * 8) % 8 > 2) continue
    const x = Math.round(((hash01(seed + 62, i) * canvas.width * 2 - camera / 2 + Math.sin((tick + i * 13) / 11) * 3) % canvas.width + canvas.width) % canvas.width)
    const y = GROUND - 2 - Math.floor(hash01(seed + 63, i) * 5) + Math.round(Math.sin((tick + i * 5) / 7))
    setPixel(canvas, x, y, P.sprout)
  }
}

/** Rows a felled tree leaves standing: its stump. */
const STUMP_ROWS = 3

/**
 * Draws a tree turned about the top of its stump by `angle` radians (positive
 * leans right), sampling the sprite backwards so no pixel is left as a hole.
 */
function drawTreeTurned(
  canvas: Canvas,
  art: Sprite,
  x: number,
  y: number,
  angle: number,
  groundY: number,
  recolor: ReadonlyMap<number, number>,
): void {
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
      if (color !== CLEAR) setPixel(canvas, originX + dx, py, recolor.get(color) ?? color)
    }
  }
}

/** A plot in the middle of a job: a tree falling or felled, a boulder cracked or broken. */
function drawEffect(canvas: Canvas, effect: Effect, plot: Plot, x0: number, tick: number, season: Season): void {
  const GROUND = groundOf(canvas)
  const centered = (sprite: Sprite): number => x0 + Math.floor((PLOT - sprite.width) / 2)
  if (effect.kind === 'falling' || effect.kind === 'felled') {
    drawSprite(canvas, STUMP, centered(STUMP), bottomY(canvas, STUMP))
    if (plot.kind !== 'tree') return
    const art = TREES[plot.variant % TREES.length]!
    // It tips slowly, then gathers speed until it hits the ground.
    const t = effect.kind === 'felled' ? 1 : Math.min(1, (tick - effect.start) / FALL_TICKS)
    const angle = (Math.PI / 2) * t * t * (effect.towardLeft ? -1 : 1)
    drawTreeTurned(canvas, art, centered(art), bottomY(canvas, art), angle, GROUND, SEASON_LEAVES[season])
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
  const season = seasonOf(village)
  const sky = seasonSky(skyFor(isMono(palette) ? 12 : time.hour), season)
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
  const lit: { sprite: Sprite; x: number; y: number; flip: boolean }[] = []
  const homes = occupied(scene)
  for (let index = first; index <= last; index++) {
    const inside = index >= 0 && index < village.plots.length
    const plot = inside ? (scene.holds.get(index) ?? village.plots[index]!) : wildPlot(village.seed, index - village.camp)
    const x0 = index * PLOT - camera
    const effect = inside ? scene.effects.get(index) : undefined
    const shake = inside && plot.kind === 'tree' && isWorked(scene, index) ? (Math.floor(tick / 3) % 2 === 0 ? 1 : -1) : 0
    const look = plot.kind === 'building' ? lookOf(village, index, plot) : undefined
    if (effect) drawEffect(canvas, effect, plot, x0, tick, season)
    else drawPlot(canvas, plot, x0, village.seed, index, shake, tick, season, look, (scene.doors.get(index) ?? 0) > tick)
    if (plot.kind === 'building' && look && plot.progress >= BUILDINGS[plot.building].steps) {
      const art = BUILDING_ART[plot.building]
      // A home's windows light up only while someone is in.
      const isLit = BUILDINGS[plot.building].housing === 0 || homes.has(index)
      if (isLit) lit.push({ sprite: art, x: x0 + Math.floor((PLOT - art.width) / 2), y: bottomY(canvas, art), flip: look.mirrored })
      if (look.prop === 'lantern' && plot.building !== 'well') {
        lit.push({ sprite: LANTERN, x: propAt(look, x0, LANTERN), y: GROUND + 1 - LANTERN.height, flip: false })
      }
    }
  }

  const fireX = plotCenter(village.camp) - camera
  drawStockpile(canvas, village, fireX + 4)

  const sorted = [...scene.walkers].sort((a, b) => a.id - b.id)
  for (const w of sorted) {
    if (w.phase === 'inside') continue
    drawVillager(canvas, w.x - camera, GROUND + 2 - VILLAGER_HEIGHT + w.hop, w.pose, w.tunic, w.facingLeft)
    drawFishing(canvas, w, camera, tick)
  }
  drawChips(canvas, scene, camera)
  drawDrift(canvas, season, tick, village.seed, camera)

  nightShade(canvas, background, sky, fireX)
  if (sky.dim > 0) {
    // Fires and windows keep their light after dark.
    const fire = sky.stars ? CAMPFIRE[Math.floor(tick / 2) % CAMPFIRE.length]! : EMBERS
    if (sky.stars) drawSprite(canvas, fire, fireX - Math.floor(fire.width / 2), bottomY(canvas, fire), { only: P.fire })
    if (sky.stars) drawSprite(canvas, fire, fireX - Math.floor(fire.width / 2), bottomY(canvas, fire), { only: P.fireCore })
    for (const { sprite, x, y, flip } of lit) drawSprite(canvas, sprite, x, y, { only: P.window, flip })
    if (sky.stars && season === 'summer') drawFireflies(canvas, tick, village.seed, camera)
  }
  if (palette === 'grayscale') return toGrayscale(canvas)
  if (palette === 'mono-dark') return invertMonochrome(toMonochrome(canvas, background, GROUND))
  if (isMono(palette)) return toMonochrome(canvas, background, GROUND)
  return canvas
}

