// Original pixel art for WorkVillage. Each sprite is a grid of palette keys;
// `.` is transparent. The keys map to the colours in ./palette.ts.

import { sprite, type Sprite } from '../pixel/canvas'
import { P } from './palette'

const K: Record<string, number> = {
  k: P.outline,
  s: P.skin,
  S: P.skinShade,
  h: P.hair,
  H: P.hairLight,
  p: P.pants,
  b: P.boot,
  c: P.tunic,
  L: P.leafDark,
  l: P.leaf,
  m: P.leafLight,
  N: P.pineDark,
  n: P.pine,
  o: P.pineLight,
  t: P.bark,
  T: P.barkDark,
  w: P.wood,
  W: P.woodLight,
  d: P.woodDark,
  R: P.stone,
  Q: P.stoneLight,
  q: P.stoneDark,
  y: P.thatch,
  Y: P.thatchDark,
  r: P.roof,
  x: P.roofDark,
  v: P.canvas,
  V: P.canvasShade,
  i: P.window,
  I: P.windowDark,
  D: P.door,
  g: P.soil,
  G: P.soilDark,
  e: P.sprout,
  E: P.crop,
  z: P.grain,
  f: P.fire,
  F: P.fireCore,
  j: P.ember,
  a: P.water,
  u: P.white,
  M: P.metal,
}

const s = (rows: readonly string[]): Sprite => sprite(K, rows)

export const OAK = s([
  '..mmll...',
  '.mmllllL.',
  'mmlllllLL',
  'mllllllLL',
  'mllllllLL',
  'lllllLLLL',
  '.llLLLLL.',
  '..LLtLL..',
  '....t....',
  '....tT...',
  '....tT...',
  '...TttT..',
])

export const PINE = s([
  '....o....',
  '...onN...',
  '...onN...',
  '..oonNN..',
  '...onN...',
  '..oonNN..',
  '.ooonNNN.',
  '..oonNN..',
  '.ooonNNN.',
  'oooonNNNN',
  '....T....',
  '...TtT...',
])

export const BIRCH = s([
  '...mm....',
  '..mmlm...',
  '.mmlllL..',
  '.mlllLL..',
  'mmllllLL.',
  '.lllLLL..',
  '..lLuL...',
  '....u....',
  '....uk...',
  '....u....',
  '....uk...',
  '...uuu...',
])

export const TREES: readonly Sprite[] = [OAK, PINE, BIRCH]

export const STUMP = s([
  '.WWW.',
  'tWwWT',
  'TtTtT',
])

export const ROCK = s([
  '..QQR..',
  '.QQRRR.',
  'QQRRRRq',
  'QRRRRqq',
  'qqqqqqq',
])

export const BOULDER = s([
  '...QQRR...',
  '..QQRRRR..',
  '.QQRRRRRq.',
  'QQRRRRRRqq',
  'QRRRRRRqqq',
  'qqqqqqqqqq',
])

export const ROCKS: readonly Sprite[] = [ROCK, BOULDER]

export const LOG = s([
  'Wwwwd',
  'dwwwd',
])

export const STONE_BLOCK = s([
  'QR',
  'Rq',
])

export const CAMPFIRE: readonly Sprite[] = [
  s([
    '...f...',
    '..fFf..',
    '..fFFf.',
    '.jfFfj.',
    'qwdwdwq',
    '.q.w.q.',
  ]),
  s([
    '..f....',
    '...ff..',
    '..fFFf.',
    '.jFFfj.',
    'qwdwdwq',
    '.q.w.q.',
  ]),
  s([
    '....f..',
    '..ff...',
    '.fFFf..',
    '.jfFFj.',
    'qwdwdwq',
    '.q.w.q.',
  ]),
]

export const EMBERS = s([
  '.......',
  '.......',
  '.......',
  '..jj...',
  'qwdwdwq',
  '.q.w.q.',
])

export const TENT = s([
  '.....d.....',
  '....vdV....',
  '...vvdVV...',
  '..vvvIVVV..',
  '.vvvIIIVVV.',
  'vvvvIIIVVVV',
  'd...III...d',
])

export const HUT = s([
  '.....YY.....',
  '....YyyY....',
  '...YyyyyY...',
  '..YyyyyyyY..',
  '.YyyyyyyyyY.',
  'YYYYYYYYYYYY',
  '.wwwwwwwwww.',
  '.wWwwDDwwWw.',
  '.wiwwDDwwiw.',
  '.wwwwDDwwww.',
  '.ddddDDdddd.',
])

export const WELL = s([
  '.xxxxxx.',
  'xrrrrrrx',
  '.T....T.',
  '.T..M.T.',
  '.T..M.T.',
  'QRRRRRRq',
  'RaaaaaaR',
  'RQRRQRRq',
  'qqqqqqqq',
])

export const STOREHOUSE = s([
  '....xxxx....',
  '..xxrrrrxx..',
  'xxrrrrrrrrxx',
  '.dWWWWWWWWd.',
  '.dWdwwwwdWd.',
  '.dWwdwwdwWd.',
  '.dWwwddwwWd.',
  '.dWwdwwdwWd.',
  '.dWdwwwwdWd.',
  '.dddddddddd.',
])

export const HOUSE = s([
  '.........qq.',
  '.....xx..qq.',
  '....xrrx.qq.',
  '...xrrrrxqq.',
  '..xrrrrrrx..',
  '.xrrrrrrrrx.',
  'xxxxxxxxxxxx',
  '.WwwwwwwwwW.',
  '.WiIwDDwiIW.',
  '.WIIwDDwIIW.',
  '.WwwwDDwwwW.',
  '.QRQRDDRQRQ.',
  '.RqRqDDqRqR.',
])

export const WORKSHOP = s([
  '.....YYYYYY.',
  '...YYyyyyyyY',
  '.YYyyyyyyyyY',
  'YYYYYYYYYYYY',
  '.dwwwwwwwwd.',
  '.dwiwwwwiwd.',
  '.dwwwDDwwwd.',
  '.dwwwDDwwwd.',
  '.dQRQDDQRQd.',
  '.qqqqDDqqqq.',
])

export const TOWER = s([
  '..x.x.x.',
  '..xxxxx.',
  '..xrrrx.',
  '.xrrrrrx',
  'xxxxxxxx',
  '.QRRRRq.',
  '.RRIIRq.',
  '.QRRRRq.',
  '.RRRRRq.',
  '.QRIIRq.',
  '.RRRRRq.',
  '.QRRRRq.',
  '.RRRRRq.',
  '.QRDDRq.',
  '.qqDDqq.',
])

export const FARM_SOIL = s([
  'gGgGgGgGgG',
  'GgGgGgGgGg',
])

/** Crops above the soil, by growth stage 1..3. */
export const CROPS: readonly Sprite[] = [
  s(['..........', '..........', '..........']),
  s(['..........', '..........', '.e..e..e..']),
  s(['..........', '.E..E..E..', '.eE.eE.eE.']),
  s(['.z..z..z..', '.Ez.Ez.Ez.', '.EE.EE.EE.']),
]

export const CLOUD = s([
  '...uuu.....',
  '.uuuuuuu.u.',
  'uuuuuuuuuuu',
])

/** Things set down beside a finished building, standing on the grass. */
export const BARREL = s(['dWd', 'wWw', 'dWd'])
export const CRATE = s(['WWW', 'wdw', 'ddd'])
export const WOODPILE = s(['.W.', 'WdW', 'dWd'])
export const FLOWER_POT = s(['z.u', 'eme', '.w.'])
/** A lamp on a post; its glass is lit after dark. */
export const LANTERN = s(['k', 'i', 'd', 'd', 'd'])
export const BENCH = s(['WWWW', 'd..d'])
/** A pennant in the roof's own colour. */
export const BANNER = s(['drr', 'dr.', 'd..', 'd..'])

/** What a villager holds up from the pond. */
export const CAUGHT_FISH = s(['.QQq.', 'QQQQq', '.QQq.'])
export const CAUGHT_BOOT = s(['dd.', 'dd.', 'ddd'])
export const CAUGHT_CHEST = s(['wWWw', 'dzzd', 'dddd'])

export const FLOWER = s(['z', 'e'])
export const TUFT = s(['m.m', '.m.'])
