// Renders preview PNGs of the village at a few points of growth.
// Usage: bun scripts/preview.ts <out-dir>

import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { SEASON_ACTIONS } from '../src/core/balance'
import { applySignal, createVillage, type Signal, type Village } from '../src/core/world'
import type { Canvas } from '../src/pixel/canvas'
import { renderFrame } from '../src/scene/render'
import { createScene, enqueue, stepScene, syncScene } from '../src/scene/sim'

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 255]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Uint8Array): Buffer {
  const head = Buffer.alloc(8)
  head.writeUInt32BE(data.length, 0)
  head.write(type, 4, 'ascii')
  const body = Buffer.concat([head.subarray(4), Buffer.from(data)])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([head.subarray(0, 4), body, crc])
}

function png(canvas: Canvas, scale: number): Buffer {
  const w = canvas.width * scale
  const h = canvas.height * scale
  const raw = Buffer.alloc((w * 3 + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0
    for (let x = 0; x < w; x++) {
      const c = canvas.pixels[Math.floor(y / scale) * canvas.width + Math.floor(x / scale)]!
      const at = y * (w * 3 + 1) + 1 + x * 3
      raw[at] = (c >> 16) & 255
      raw[at + 1] = (c >> 8) & 255
      raw[at + 2] = c & 255
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', new Uint8Array()),
  ])
}

const out = process.argv[2] ?? 'preview'
mkdirSync(out, { recursive: true })

const pattern: Signal[] = ['edit', 'edit', 'read', 'edit', 'test', 'edit', 'read', 'create', 'edit', 'test', 'edit', 'commit', 'task']
let village: Village = createVillage(20261014, 0)
const scene = createScene(village)

function run(signals: number, frames: number): void {
  for (let i = 0; i < signals; i++) {
    const outcome = applySignal(village, pattern[i % pattern.length]!)
    village = outcome.village
    if (outcome.action) enqueue(scene, outcome.action, village)
    syncScene(scene, village)
    for (let f = 0; f < frames; f++) stepScene(scene, false)
  }
}

const shots: [string, number, number, number][] = [
  ['01-wilderness', 0, 0, 10],
  ['02-clearing', 6, 30, 13],
  ['03-hamlet', 40, 20, 15],
  ['04-village', 160, 6, 11],
  ['05-dusk', 0, 20, 18.5],
  ['06-night', 0, 20, 22],
]
for (const [name, signals, frames, hour] of shots) {
  run(signals, frames)
  for (let f = 0; f < 12; f++) stepScene(scene, hour >= 20)
  const frame = renderFrame(village, scene, 160, { hour })
  writeFileSync(join(out, `${name}.png`), png(frame, 6))
  if (name === '04-village') {
    writeFileSync(join(out, `${name}-small.png`), png(renderFrame(village, scene, 120, { hour }, { height: 14 }), 6))
    writeFileSync(join(out, `${name}-fine.png`), png(renderFrame(village, scene, 240, { hour }, { height: 16 }), 3))
    writeFileSync(join(out, `${name}-grayscale.png`), png(renderFrame(village, scene, 120, { hour }, { height: 14, palette: 'grayscale' }), 6))
    writeFileSync(join(out, `${name}-mono.png`), png(renderFrame(village, scene, 120, { hour }, { height: 14, palette: 'mono' }), 6))
    writeFileSync(join(out, `${name}-mono-dark.png`), png(renderFrame(village, scene, 120, { hour }, { height: 14, palette: 'mono-dark' }), 6))
    writeFileSync(join(out, `${name}-mono-medium.png`), png(renderFrame(village, scene, 160, { hour }, { palette: 'mono' }), 6))
  }
  console.log(name, JSON.stringify(village.resources), 'villagers', village.villagers, 'plots', village.plots.length)
}

// The finished village through the year: the same village, its work counted on to each season.
const year = Math.floor(village.stats.actions / (SEASON_ACTIONS * 4)) * SEASON_ACTIONS * 4
for (const [name, season] of [['07-spring', 0], ['07-summer', 1], ['07-autumn', 2], ['07-winter', 3]] as const) {
  const seasonal = { ...village, stats: { ...village.stats, actions: year + season * SEASON_ACTIONS } }
  writeFileSync(join(out, `${name}.png`), png(renderFrame(seasonal, scene, 120, { hour: 12 }, { height: 14 }), 6))
}

