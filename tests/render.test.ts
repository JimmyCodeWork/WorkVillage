import { describe, expect, test } from 'claude-code/testing'

import { applySignal, createVillage } from '../src/core/world'
import { toBase64, toRasterCells, toSvg } from '../src/pixel/encode'
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
    const raster = toRasterCells(renderFrame(village, createScene(village), 120, { hour: 12 }, SCENE_HEIGHTS.small))
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
