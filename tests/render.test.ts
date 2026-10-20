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
    let village = createVillage(1, 0)
    for (let i = 0; i < 300; i++) village = applySignal(village, i % 7 === 6 ? 'commit' : i % 3 ? 'edit' : 'test').village
    for (const hour of [12, 18.5, 22]) {
      for (const palette of ['color', 'mono'] as const) {
        const svg = toSvg(renderFrame(village, createScene(village), 640, { hour }, { palette }), 3)
        expect(svg.length).toBeLessThan(131072)
      }
    }
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

describe('svg', () => {
  test('the paths redraw exactly the frame they encode', () => {
    let village = createVillage(3, 0)
    for (let i = 0; i < 200; i++) village = applySignal(village, i % 5 ? 'edit' : 'test').village
    const frame = renderFrame(village, createScene(village), 300, { hour: 12 })
    const svg = toSvg(frame, 2)
    const drawn = new Int32Array(frame.width * frame.height).fill(-1)
    for (const path of svg.matchAll(/<path fill="#([0-9a-f]{6})" d="([^"]+)"\/>/g)) {
      const color = parseInt(path[1]!, 16)
      for (const run of path[2]!.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
        const [x, y, w] = [Number(run[1]), Number(run[2]), Number(run[3])]
        for (let i = 0; i < w; i++) drawn[y * frame.width + x + i] = color
      }
    }
    expect([...drawn]).toEqual([...frame.pixels].map(c => c & 0xffffff))
  })
})

describe('work', () => {
  const working = (scene: ReturnType<typeof createScene>) => scene.walkers.filter(w => w.phase === 'working')

  test('a tree takes many blows, falls, and only then becomes a stump', () => {
    let village = createVillage(1, 0)
    const scene = createScene(village)
    const outcome = applySignal(village, 'edit')
    expect(outcome.action?.kind).toBe('chop')
    village = outcome.village
    enqueue(scene, outcome.action!, village)
    syncScene(scene, village)
    const plot = outcome.action!.plot
    let blows = 0
    let fellAt = -1
    for (let i = 0; i < 300 && scene.holds.has(plot); i++) {
      const chips = scene.chips.length
      stepScene(scene, false)
      if (scene.chips.length > chips && fellAt < 0) blows++
      if (fellAt < 0 && scene.effects.get(plot)?.kind === 'falling') fellAt = i
    }
    expect(blows).toBeGreaterThanOrEqual(6)
    expect(fellAt).toBeGreaterThan(-1)
    expect(scene.holds.has(plot)).toBe(false)
    expect(scene.effects.size).toBe(0)
  })

  test('idle villagers lend a hand, and one carries the timber home', () => {
    let village = { ...createVillage(1, 0), villagers: 3 }
    const scene = createScene(village)
    const outcome = applySignal(village, 'edit')
    village = outcome.village
    enqueue(scene, outcome.action!, village)
    syncScene(scene, village)
    let crew = 0
    for (let i = 0; i < 300 && scene.holds.size > 0; i++) {
      stepScene(scene, false)
      crew = Math.max(crew, working(scene).length)
    }
    // Felling takes two: the one who took the job and one helper.
    expect(crew).toBe(2)
    const bearers = scene.walkers.filter(w => w.carry === 'log')
    expect(bearers.length).toBe(1)
    // The other is empty-handed and free for the next job at once.
    expect(scene.walkers.filter(w => w.phase === 'returning' && w.carry === undefined).length).toBe(1)
  })

  test('the next job is taken on the way back, without first returning to the fire', () => {
    let village = { ...createVillage(1, 0), villagers: 2 }
    const scene = createScene(village)
    for (const signal of ['edit', 'edit'] as const) {
      const outcome = applySignal(village, signal)
      village = outcome.village
      enqueue(scene, outcome.action!, village)
      syncScene(scene, village)
    }
    // Both jobs are taken at once; nobody waits by the fire while work is queued.
    stepScene(scene, false)
    expect(scene.queue.length).toBe(0)
    expect(scene.walkers.every(w => w.phase === 'toWork')).toBe(true)
  })

  test('at night nobody joins a job; they gather by the fire', () => {
    let village = { ...createVillage(1, 0), villagers: 3 }
    const scene = createScene(village)
    const outcome = applySignal(village, 'edit')
    village = outcome.village
    enqueue(scene, outcome.action!, village)
    syncScene(scene, village)
    let crew = 0
    for (let i = 0; i < 300; i++) {
      stepScene(scene, true)
      crew = Math.max(crew, working(scene).length)
    }
    expect(crew).toBe(1)
  })
})

describe('seasons', () => {
  const inSeason = (n: number) => {
    const v = createVillage(1, 0)
    return { ...v, stats: { ...v.stats, actions: n * 40 } }
  }
  const grassRow = (n: number) => {
    const frame = renderFrame(inSeason(n), createScene(inSeason(n)), 80, { hour: 12 }, { height: 20 })
    return Array.from(frame.pixels.slice(16 * 80, 17 * 80))
  }

  test('winter lays snow on the ground, autumn turns it gold', () => {
    const spring = grassRow(0)
    const autumn = grassRow(2)
    const winter = grassRow(3)
    const isSnow = (c: number) => ((c >> 16) & 255) > 200 && ((c >> 8) & 255) > 200 && (c & 255) > 200
    expect(winter.filter(isSnow).length).toBeGreaterThan(winter.length / 2)
    // In spring only a birch trunk or the fire's core is that bright.
    expect(spring.filter(isSnow).length).toBeLessThan(spring.length / 10)
    expect(autumn).not.toEqual(spring)
  })
})

describe('homes', () => {
  const settled = () => {
    let v = createVillage(21, 0)
    const signals = ['edit', 'edit', 'commit', 'task', 'create'] as const
    for (let i = 0; i < 150; i++) v = applySignal(v, signals[i % signals.length]!).village
    return v
  }

  test('after dark villagers with a home go in; the one at the camp stays by the fire', () => {
    const v = settled()
    const scene = createScene(v)
    for (let i = 0; i < 400; i++) stepScene(scene, true)
    expect(scene.walkers[0]!.phase).not.toBe('inside')
    expect(scene.walkers.slice(1).every(w => w.phase === 'inside')).toBe(true)
    // In the morning they come out again.
    for (let i = 0; i < 40; i++) stepScene(scene, false)
    expect(scene.walkers.filter(w => w.phase === 'inside').length).toBeLessThan(scene.walkers.length / 2)
  })

  test('work at night brings a villager out of the house', () => {
    let v = settled()
    const scene = createScene(v)
    for (let i = 0; i < 400; i++) stepScene(scene, true)
    const outcome = applySignal(v, 'edit')
    v = outcome.village
    enqueue(scene, outcome.action!, v)
    syncScene(scene, v)
    stepScene(scene, true)
    expect(scene.queue.length).toBe(0)
    expect(scene.walkers.some(w => w.phase === 'toWork')).toBe(true)
  })
})

describe('fishing', () => {
  const pondVillage = () => {
    const v = createVillage(5, 0)
    return { ...v, plots: v.plots.map((p, i) => (i === 2 ? ({ kind: 'pond' } as const) : p)) }
  }

  test('a fishing trip ends with something held up', () => {
    let v = pondVillage()
    const scene = createScene(v)
    const outcome = applySignal(v, 'turn')
    v = outcome.village
    enqueue(scene, outcome.action!, v)
    syncScene(scene, v)
    const seen = new Set<string>()
    for (let i = 0; i < 400; i++) {
      stepScene(scene, false)
      const w = scene.walkers[0]!
      if (w.phase === 'working') seen.add(w.pose)
      if (w.caught && w.step === 4) seen.add(`caught:${w.caught}`)
    }
    expect([...seen]).toEqual(expect.arrayContaining(['rodCast', 'rodOut', 'rodPull', 'holdUp']))
    expect([...seen].some(s => s.startsWith('caught:'))).toBe(true)
  })

  test('work never waits on fishing: the line comes in for it', () => {
    let v = pondVillage()
    const scene = createScene(v)
    const fish = applySignal(v, 'turn')
    v = fish.village
    enqueue(scene, fish.action!, v)
    syncScene(scene, v)
    for (let i = 0; i < 60; i++) stepScene(scene, false)
    expect(scene.walkers[0]!.action?.kind).toBe('fish')
    const work = applySignal(v, 'edit')
    v = work.village
    enqueue(scene, work.action!, v)
    syncScene(scene, v)
    stepScene(scene, false)
    expect(scene.walkers[0]!.action?.kind).toBe(work.action!.kind)
  })
})
