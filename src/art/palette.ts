// WorkVillage's own palette. Every sprite in this project is original work
// drawn for WorkVillage and released under the project's licence.

import type { RoofStyle } from '../core/balance'
import type { Season } from '../core/world'
import { mix } from '../pixel/canvas'

export const P = {
  outline: 0x2a2433,
  skin: 0xe9b995,
  skinShade: 0xc98f6e,
  hair: 0x4e3326,
  hairLight: 0x7a5236,
  pants: 0x3d3a52,
  boot: 0x2f2a2a,
  tunic: 0xb8553f, // replaced per villager

  leafDark: 0x2f6b3a,
  leaf: 0x4f9446,
  leafLight: 0x86c45c,
  pineDark: 0x24523f,
  pine: 0x357456,
  pineLight: 0x58a06d,
  bark: 0x7b5131,
  barkDark: 0x553522,
  wood: 0xb07a45,
  woodLight: 0xd3a26b,
  woodDark: 0x7d5230,

  stone: 0x8d8e9b,
  stoneLight: 0xb9bac4,
  stoneDark: 0x5e5f6e,

  thatch: 0xd6ad5b,
  thatchDark: 0xa57c39,
  roof: 0xa8483a,
  roofDark: 0x7a3030,
  canvas: 0xe6dcc0,
  canvasShade: 0xbfb08d,
  window: 0xf2d27a,
  windowDark: 0x3a3550,
  door: 0x5c3b25,

  soil: 0x6b4a33,
  soilDark: 0x4f3424,
  sprout: 0x8fd16a,
  crop: 0x6fae45,
  grain: 0xe2bd4f,

  fire: 0xf28a2e,
  fireCore: 0xfbe08a,
  ember: 0xc9442c,
  water: 0x4f86c6,
  white: 0xf4f1e8,
  metal: 0xa9b0b8,
} as const

/**
 * Each roof style as a recolouring of the art: tiles, thatch and tent canvas
 * together, so one building reads as one style. `classic` keeps the art.
 */
export const ROOF_COLORS: Readonly<Record<RoofStyle, ReadonlyMap<number, number>>> = {
  classic: new Map(),
  blue: new Map([
    [P.roof, 0x3f6f9e],
    [P.roofDark, 0x2c4f73],
    [P.canvas, 0xcfdcea],
    [P.canvasShade, 0x9fb3c8],
  ]),
  slate: new Map([
    [P.roof, 0x6b7280],
    [P.roofDark, 0x4b5160],
    [P.thatch, 0xc9b98a],
    [P.thatchDark, 0x938456],
    [P.canvas, 0xdcdcd6],
    [P.canvasShade, 0xb0b0a8],
  ]),
  moss: new Map([
    [P.roof, 0x5d8a4a],
    [P.roofDark, 0x3f6234],
    [P.thatch, 0xb9a95a],
    [P.thatchDark, 0x857a3c],
    [P.canvas, 0xd6e2c0],
    [P.canvasShade, 0xa9b98f],
  ]),
  terracotta: new Map([
    [P.roof, 0xc96a3a],
    [P.roofDark, 0x96482a],
    [P.thatch, 0xdba25a],
    [P.thatchDark, 0xa9733a],
    [P.canvas, 0xeed3b0],
    [P.canvasShade, 0xc9a985],
  ]),
  plum: new Map([
    [P.roof, 0x8a4f7a],
    [P.roofDark, 0x613659],
    [P.canvas, 0xe3d0e0],
    [P.canvasShade, 0xbba2b8],
  ]),
}

/** Tunic colours given to villagers in turn. */
export const TUNICS: readonly number[] = [
  0xb8553f, 0x3f6f9e, 0x5d8f3c, 0xc99a3a, 0x8a4f9a, 0x3f948d, 0xc76f8f, 0x6d6d6d,
]

export type Sky = {
  top: number
  bottom: number
  hillFar: number
  hillNear: number
  grass: number
  grassLight: number
  dirt: number
  dirtDark: number
  /** 0 by day, 1 at full night: how much sprites are dimmed. */
  dim: number
  stars: boolean
}

const DAY: Sky = {
  top: 0x6fb3e0,
  bottom: 0xbfe3f2,
  hillFar: 0x8fbfa8,
  hillNear: 0x6fa880,
  grass: 0x5c9a3e,
  grassLight: 0x82c051,
  dirt: 0x7a5538,
  dirtDark: 0x5c3f2a,
  dim: 0,
  stars: false,
}

const DUSK: Sky = {
  top: 0x5d5f9e,
  bottom: 0xf0a66e,
  hillFar: 0x7d6f8f,
  hillNear: 0x5e5f78,
  grass: 0x4b7a3a,
  grassLight: 0x6e9a48,
  dirt: 0x664632,
  dirtDark: 0x4d3426,
  dim: 0.25,
  stars: false,
}

const NIGHT: Sky = {
  top: 0x141a33,
  bottom: 0x2b3560,
  hillFar: 0x263052,
  hillNear: 0x1d2742,
  grass: 0x27452f,
  grassLight: 0x355a3a,
  dirt: 0x3a2b26,
  dirtDark: 0x2a1f1d,
  dim: 0.55,
  stars: true,
}

const DAWN: Sky = {
  top: 0x7f8fc4,
  bottom: 0xf3c79a,
  hillFar: 0x8f9fb0,
  hillNear: 0x6f8f86,
  grass: 0x52873c,
  grassLight: 0x76ad4c,
  dirt: 0x6e4c35,
  dirtDark: 0x523829,
  dim: 0.15,
  stars: false,
}

/** The sky and ground colours for a local hour (0..24). */
export function skyFor(hour: number): Sky {
  if (hour >= 7 && hour < 17.5) return DAY
  if (hour >= 17.5 && hour < 19.5) return DUSK
  if (hour >= 5 && hour < 7) return DAWN
  return NIGHT
}

const SNOW = 0xe9eff5
const NIGHT_INK = 0x0d1328

/**
 * The season's turn on the ground and hills: lusher in summer, gold in
 * autumn, under snow in winter. Colours put in whole are darkened by the
 * hour as the sky's own are.
 */
export function seasonSky(sky: Sky, season: Season): Sky {
  const byHour = (color: number): number => mix(color, NIGHT_INK, sky.dim)
  switch (season) {
    case 'spring':
      return { ...sky, grassLight: mix(sky.grassLight, byHour(0xa8d86a), 0.4) }
    case 'summer':
      return { ...sky, grass: mix(sky.grass, byHour(0x3f7f2e), 0.4) }
    case 'autumn':
      return {
        ...sky,
        grass: mix(sky.grass, byHour(0xa8862e), 0.7),
        grassLight: mix(sky.grassLight, byHour(0xd8a33a), 0.7),
        hillFar: mix(sky.hillFar, byHour(0xc09a5a), 0.4),
        hillNear: mix(sky.hillNear, byHour(0xb0803e), 0.4),
      }
    case 'winter':
      return {
        ...sky,
        grass: byHour(SNOW),
        grassLight: byHour(P.white),
        hillFar: mix(sky.hillFar, byHour(SNOW), 0.8),
        hillNear: mix(sky.hillNear, byHour(SNOW), 0.7),
      }
  }
}

/** Leaves through the year: blossom in spring, turning in autumn, snow-laden in winter. */
export const SEASON_LEAVES: Readonly<Record<Season, ReadonlyMap<number, number>>> = {
  spring: new Map([[P.leafLight, 0xf4c2d0]]),
  summer: new Map(),
  autumn: new Map([
    [P.leafDark, 0x9a4a22],
    [P.leaf, 0xd0782e],
    [P.leafLight, 0xeec04a],
  ]),
  winter: new Map([
    [P.leafDark, 0x9aa6b4],
    [P.leaf, 0xcfd8e2],
    [P.leafLight, P.white],
    [P.pineLight, P.white],
  ]),
}

/** What drifts through the air in each season, if anything. */
export const SEASON_DRIFT: Readonly<Record<Season, number | undefined>> = {
  spring: 0xf4c2d0,
  summer: undefined,
  autumn: 0xd0782e,
  winter: P.white,
}

