import { describe, expect, test } from 'claude-code/testing'

import { applySignal, createVillage } from '../src/core/world'
import { toBase64, toRasterCells, toSvg } from '../src/pixel/encode'
import { MONO_INK, MONO_PAPER } from '../src/pixel/filter'
import { renderFrame, SCENE_HEIGHTS } from '../src/scene/render'
import { catchBugs, createScene, CROW_TICKS, enqueue, isDozing, lampsOf, MAX_BUGS, releaseBug, scoutReturns, sendScout, setDrowsiness, stepScene, syncScene, wake } from '../src/scene/sim'

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
    // Most are in bed; one may be up for a walk in the night.
    expect(scene.walkers.slice(1).filter(w => w.phase === 'inside').length).toBeGreaterThan((scene.walkers.length - 1) / 2)
    // In the morning they come out again, each in their own time.
    for (let i = 0; i < 700; i++) stepScene(scene, false)
    expect(scene.walkers.filter(w => w.phase === 'inside').length).toBeLessThanOrEqual(scene.walkers.length / 2)
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

describe('events', () => {
  const village = (villagers: number) => ({ ...createVillage(8, 0), villagers })
  const run = (scene: ReturnType<typeof createScene>, ticks: number) => {
    for (let i = 0; i < ticks; i++) stepScene(scene, false)
  }

  test('failed test runs let bugs loose, never more than a few', () => {
    const scene = createScene(village(2))
    for (let i = 0; i < 5; i++) releaseBug(scene)
    expect(scene.bugs.length).toBe(MAX_BUGS)
    run(scene, 300)
    // They crawl about near the camp, waiting to be caught.
    for (const bug of scene.bugs) expect(Math.abs(bug.x - (scene.camp * 12 + 6))).toBeLessThanOrEqual(72)
  })

  test('passing tests again: every bug is caught', () => {
    const scene = createScene(village(2))
    releaseBug(scene)
    releaseBug(scene)
    run(scene, 20)
    expect(catchBugs(scene)).toBe(2)
    expect(catchBugs(scene)).toBe(0)
    let pounced = false
    for (let i = 0; i < 400 && scene.bugs.length > 0; i++) {
      stepScene(scene, false)
      pounced ||= scene.walkers.some(w => w.phase === 'working' && w.action?.kind === 'catch' && w.pose === 'kneel')
    }
    expect(pounced).toBe(true)
    expect(scene.bugs.length).toBe(0)
  })

  test('a scout goes out of sight on an errand and comes back with a sack', () => {
    const scene = createScene(village(3))
    run(scene, 10)
    sendScout(scene)
    // The one who keeps the camp never goes.
    expect(scene.walkers[0]!.phase).not.toBe('scouting')
    const scout = scene.walkers.find(w => w.phase === 'scouting')!
    run(scene, 300)
    expect(scout.phase).toBe('away')
    scoutReturns(scene, true)
    expect(scout.carry).toBe('sack')
    run(scene, 400)
    expect(scout.phase).toBe('idle')
    expect(scout.carry).toBeUndefined()
  })

  test('an errand that fails brings the scout back empty-handed; a lone villager stays put', () => {
    const scene = createScene(village(2))
    sendScout(scene)
    const scout = scene.walkers.find(w => w.phase === 'scouting')!
    scoutReturns(scene, false)
    expect(scout.phase).toBe('returning')
    expect(scout.carry).toBeUndefined()
    const alone = createScene(village(1))
    sendScout(alone)
    expect(alone.walkers[0]!.phase).not.toBe('scouting')
  })

  const settled = () => {
    let v = createVillage(21, 0)
    const signals = ['edit', 'edit', 'commit', 'task', 'create'] as const
    for (let i = 0; i < 90; i++) v = applySignal(v, signals[i % signals.length]!).village
    return v
  }

  test('dozing comes now and then, one villager at a time, never the whole village', () => {
    const scene = createScene(settled())
    setDrowsiness(scene, 1)
    let most = 0
    let dozed = 0
    let napped = false
    for (let i = 0; i < 2000; i++) {
      stepScene(scene, false)
      const dozing = scene.walkers.filter(w => isDozing(w, scene.tick))
      most = Math.max(most, dozing.length)
      dozed = Math.max(dozed, dozing.length)
      napped ||= scene.walkers.some(w => w.isNapping && w.phase === 'inside')
    }
    expect(dozed).toBeGreaterThan(0)
    expect(napped).toBe(true)
    expect(most).toBeLessThanOrEqual(Math.floor(scene.walkers.length / 2))
  })

  test('the drowsier the village, the oftener a doze', () => {
    const count = (drowsiness: number) => {
      const scene = createScene(settled())
      setDrowsiness(scene, drowsiness)
      let total = 0
      for (let i = 0; i < 2000; i++) {
        stepScene(scene, false)
        total += scene.walkers.filter(w => isDozing(w, scene.tick)).length
      }
      return total
    }
    expect(count(1)).toBeGreaterThan(count(0))
  })

  test('work wakes the dozers with a start and fetches the nappers out by day', () => {
    const scene = createScene(settled())
    setDrowsiness(scene, 1)
    for (let i = 0; i < 2000 && !scene.walkers.some(w => w.phase === 'idle' && isDozing(w, scene.tick) && w.x === w.targetX); i++) stepScene(scene, false)
    const dozer = scene.walkers.find(w => w.phase === 'idle' && isDozing(w, scene.tick))!
    expect(dozer).toBeDefined()
    wake(scene)
    expect(scene.drowsiness).toBe(0)
    expect(scene.walkers.some(w => isDozing(w, scene.tick))).toBe(false)
    stepScene(scene, false)
    expect(dozer.hop).not.toBe(0)
    stepScene(scene, false)
    expect(scene.walkers.some(w => w.isNapping)).toBe(false)
  })

  test('at night most are in bed, though now and then one gets up for a walk under the lamps', () => {
    const scene = createScene(settled())
    expect(scene.lamps.length).toBeGreaterThan(0)
    let strolled = false
    let inBed = 0
    for (let i = 0; i < 3000; i++) {
      stepScene(scene, true)
      strolled ||= scene.walkers.some(w => w.strollUntil !== undefined && w.phase === 'idle')
      if (i === 2999) inBed = scene.walkers.filter(w => w.phase === 'inside').length
    }
    expect(strolled).toBe(true)
    expect(inBed).toBeGreaterThan((scene.walkers.length - 1) / 2)
  })

  test('woken by work at night, those in bed sleep on', () => {
    const scene = createScene(settled())
    for (let i = 0; i < 600; i++) stepScene(scene, true)
    const inBed = scene.walkers.filter(w => w.phase === 'inside')
    wake(scene)
    stepScene(scene, true)
    expect(inBed.every(w => w.phase === 'inside')).toBe(true)
  })
})

describe('the rooster', () => {
  const step = (scene: ReturnType<typeof createScene>, ticks: number, isNight: boolean) => {
    for (let i = 0; i < ticks; i++) stepScene(scene, isNight)
  }

  test('by day it scratches about near the camp, pecking now and then', () => {
    const scene = createScene(createVillage(8, 0))
    const camp = scene.camp * 12 + 6
    const poses = new Set<string>()
    for (let i = 0; i < 2000; i++) {
      stepScene(scene, false)
      poses.add(scene.rooster.pose)
      expect(Math.abs(scene.rooster.x - camp)).toBeLessThanOrEqual(42)
    }
    expect([...poses]).toEqual(expect.arrayContaining(['walk1', 'peck']))
    expect(poses.has('crow')).toBe(false)
  })

  test('it sleeps by the fire at night, and dozes in the sun now and then by day', () => {
    const night = createScene(createVillage(8, 0))
    step(night, 200, true)
    expect(night.rooster.pose).toBe('sit')
    const day = createScene(createVillage(8, 0))
    setDrowsiness(day, 1)
    let dozed = false
    for (let i = 0; i < 2000 && !dozed; i++) {
      stepScene(day, false)
      dozed = day.rooster.pose === 'sit'
    }
    expect(dozed).toBe(true)
  })

  test('it crows when night turns to day, and not when work wakes the village', () => {
    const scene = createScene(createVillage(8, 0))
    step(scene, 50, false)
    wake(scene)
    step(scene, 10, false)
    expect(scene.tick).toBeGreaterThan(scene.rooster.crowUntil)
    step(scene, 50, true)
    step(scene, 1, false)
    expect(scene.rooster.crowUntil).toBe(scene.tick + CROW_TICKS)
    expect(['crow', 'stand']).toContain(scene.rooster.pose)
  })

})

describe('meadows', () => {
  const meadow = (season: number) => {
    const v = createVillage(4, 0)
    const plots = v.plots.map(p => (p.kind === 'camp' ? p : ({ kind: 'grass' } as const)))
    const open = { ...v, plots, stats: { ...v.stats, actions: season * 40 } }
    const scene = createScene(open)
    scene.walkers = []
    return new Set(renderFrame(open, scene, 160, { hour: 12 }, { height: 20 }).pixels)
  }
  const PINK = 0xf4a6c0
  const BLUE = 0x7fa7e0

  test('open ground grows shrubs, weeds and flowers of several colours', () => {
    const colors = meadow(0)
    expect([PINK, BLUE, 0xe2bd4f, 0xc9442c].filter(c => colors.has(c)).length).toBeGreaterThanOrEqual(2)
    // Weeds in their own bright green, which no tree uses.
    expect(colors.has(0x8fd16a)).toBe(true)
  })

  test('in winter the flowers are gone under the snow', () => {
    const colors = meadow(3)
    expect(colors.has(PINK)).toBe(false)
    expect(colors.has(BLUE)).toBe(false)
  })
})

describe('street lamps', () => {
  test('lamps go up once the village is a hamlet, and light up after dark', () => {
    expect(lampsOf(createVillage(21, 0))).toEqual([])
    let v = createVillage(21, 0)
    const signals = ['edit', 'edit', 'commit', 'task', 'create'] as const
    for (let i = 0; i < 90; i++) v = applySignal(v, signals[i % signals.length]!).village
    const lamps = lampsOf(v)
    expect(lamps.length).toBeGreaterThan(0)
    // Never squeezed between two buildings.
    for (const x of lamps) {
      const left = v.plots[x / 12 - 1]
      const right = v.plots[x / 12]
      expect(left?.kind === 'building' && right?.kind === 'building').toBe(false)
    }
    const scene = createScene(v)
    scene.walkers = []
    const night = renderFrame(v, scene, 400, { hour: 23 }, { height: 20 })
    expect(new Set(night.pixels).has(0xf2d27a)).toBe(true)
  })
})
