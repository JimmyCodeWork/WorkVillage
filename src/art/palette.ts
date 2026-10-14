// WorkVillage's own palette. Every sprite in this project is original work
// drawn for WorkVillage and released under the project's licence.

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
