import { describe, expect, test } from 'claude-code/testing'

import { applySignal, createVillage } from '../src/core/world'
import { toBase64, toRasterCells, toSvg } from '../src/pixel/encode'
import { MONO_INK, MONO_PAPER } from '../src/pixel/filter'
import { renderFrame, SCENE_HEIGHTS } from '../src/scene/render'
import { createScene, enqueue, stepScene, syncScene } from '../src/scene/sim'

describe('render', () => {
  test('base64 matches the standard alphabet and padding', () => {
    const bytes = (s: string) => new Uint8Array([...s].map(c => c.charCodeAt(0)))
    expect(toBase64(bytes('M'))).toBe('TQ==')
    expect(toBase64(bytes('Ma'))).toBe('TWE=')
    expect(toBase64(bytes('Man'))).toBe('TWFu')
  })

  test('a frame packs into half-block raster cells', () => {
    const village = createVillage(1, 0)
    const frame = renderFrame(village, createScene(village), 80, { hour: 12 })
    expect(frame.width).toBe(80)
    expect(frame.height).toBe(SCENE_HEIGHTS.medium)
    const raster = toRasterCells(frame)
    expect(raster.rows).toBe(SCENE_HEIGHTS.medium / 2)
    expect(raster.cells.length).toBe(Math.ceil((80 * 10 * 12) / 3) * 4)
  })

  test('the small scene is seven rows tall', () => {
    const village = createVillage(1, 0)
    const raster = toRasterCells(renderFrame(village, createScene(village), 120, { hour: 12 }, { height: SCENE_HEIGHTS.small }))
    expect(raster.rows).toBe(7)
  })

  test('svg stays within the size a surface accepts', () => {
    const village = createVillage(1, 0)
    const svg = toSvg(renderFrame(village, createScene(village), 200, { hour: 22 }), 3)
    expect(svg.length).toBeLessThan(131072)
  })

  test('a villager walks to a tree, chops it, and the stump appears', () => {
    let village = createVillage(1, 0)
    const scene = createScene(village)
    const outcome = applySignal(village, 'edit')
    village = outcome.village
    enqueue(scene, outcome.action!, village)
    syncScene(scene, village)
    expect(scene.holds.has(outcome.action!.plot)).toBe(true)
    for (let i = 0; i < 200; i++) stepScene(scene, false)
    expect(scene.holds.size).toBe(0)
  })
})

describe('palettes', () => {
  const village = createVillage(1, 0)

  test('mono-dark is mono with ink and paper swapped', () => {
    const light = renderFrame(village, createScene(village), 60, { hour: 12 }, { palette: 'mono-light' })
    const dark = renderFrame(village, createScene(village), 60, { hour: 12 }, { palette: 'mono-dark' })
    light.pixels.forEach((c, i) => expect(dark.pixels[i]).toBe(c === MONO_INK ? MONO_PAPER : MONO_INK))
  })

  test('grayscale leaves only shades of grey', () => {
    const frame = renderFrame(village, createScene(village), 80, { hour: 12 }, { palette: 'grayscale' })
    for (const c of frame.pixels) expect(((c >> 16) & 255) === (c & 255) && ((c >> 8) & 255) === (c & 255)).toBe(true)
  })

  test('mono is pure ink and paper, and draws in the terminal colours', () => {
    const frame = renderFrame(village, createScene(village), 80, { hour: 23 }, { palette: 'mono' })
    expect(new Set(frame.pixels)).toEqual(new Set([MONO_INK, MONO_PAPER]))
    const words = new Uint32Array(Uint8Array.from(atob(toRasterCells(frame, { inkOnly: MONO_INK }).cells), c => c.charCodeAt(0)).buffer)
    for (let i = 0; i < words.length; i += 3) {
      expect([0x20, 0x2580, 0x2584, 0x2588]).toContain(words[i])
      expect(words[i + 1]).toBe(0x01000000)
      expect(words[i + 2]).toBe(0x01000000)
    }
  })
})
