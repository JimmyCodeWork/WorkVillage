import { describe, expect, test } from 'claude-code/testing'

import { BUILDINGS, SEASON_ACTIONS } from '../src/core/balance'
import { applySignal, capacity, createVillage, isComplete, lampSpots, nextBuilding, pondNear, restore, seasonOf, squareOf, stageOf, wildPlot, withStyles, type Signal, type Village } from '../src/core/world'

function run(village: Village, signals: readonly Signal[]): Village {
  return signals.reduce((v, s) => applySignal(v, s).village, village)
}

describe('world', () => {
  test('a new village is a camp in the wilderness', () => {
    const v = createVillage(1, 0)
    expect(v.plots[v.camp]?.kind).toBe('camp')
    expect(v.villagers).toBe(1)
    expect(v.plots.filter(p => p.kind === 'tree' || p.kind === 'rock').length).toBeGreaterThan(4)
    expect(stageOf(v)).toBe('camp')
  })

  test('editing clears the forest for timber', () => {
    const v = createVillage(1, 0)
    const outcome = applySignal(v, 'edit')
    expect(['chop', 'quarry']).toContain(outcome.action?.kind)
    expect(outcome.village.resources.wood + outcome.village.resources.stone).toBeGreaterThan(0)
    expect(outcome.action?.before?.kind).toBe(v.plots[outcome.action!.plot]?.kind)
  })

  test('steady work raises a tent, then grows into a hamlet', () => {
    let v = createVillage(7, 0)
    const built: string[] = []
    for (let i = 0; i < 120; i++) {
      const outcome = applySignal(v, i % 6 === 5 ? 'commit' : 'edit')
      v = outcome.village
      for (const m of outcome.milestones) if (m.kind === 'built') built.push(m.building)
    }
    expect(built[0]).toBe('tent')
    expect(built.length).toBeGreaterThanOrEqual(2)
    expect(stageOf(v)).not.toBe('camp')
  })

  test('passing tests plant and harvest fields', () => {
    let v = createVillage(3, 0)
    const kinds: string[] = []
    for (let i = 0; i < 8; i++) {
      const outcome = applySignal(v, 'test')
      v = outcome.village
      if (outcome.action) kinds.push(outcome.action.kind)
    }
    expect(kinds).toContain('plant')
    expect(kinds).toContain('harvest')
    expect(v.resources.food).toBeGreaterThan(0)
  })

  test('new villagers need somewhere to live', () => {
    const v = run(createVillage(5, 0), ['task', 'task'])
    expect(v.villagers).toBe(1)
    expect(v.resources.food).toBe(4)
  })

  test('buildings are paid for when placed', () => {
    const v = run(createVillage(9, 0), Array.from({ length: 4 }, () => 'edit' as const))
    const site = v.plots.find(p => p.kind === 'building')
    if (site?.kind === 'building') expect(site.progress).toBeLessThanOrEqual(BUILDINGS[site.building].steps)
  })

  test('the world never grows past its limit', () => {
    const v = run(createVillage(11, 0), Array.from({ length: 2000 }, (_, i) => (i % 3 ? 'edit' : 'create') as Signal))
    expect(v.plots.length).toBeLessThanOrEqual(40)
  })

  test('restore accepts saved villages and rejects anything else', () => {
    const v = createVillage(1, 0)
    expect(restore(JSON.parse(JSON.stringify(v)))?.camp).toBe(v.camp)
    expect(restore({ version: 2 })).toBeUndefined()
    expect(restore('village')).toBeUndefined()
  })
})

describe('reading and thinking', () => {
  test('reading is studied by the fire, thinking pondered, both add knowledge', () => {
    const v = createVillage(1, 0)
    const read = applySignal(v, 'read')
    expect(read.action?.kind).toBe('study')
    expect(read.village.resources.knowledge).toBe(1)
    const think = applySignal(read.village, 'think')
    expect(think.action?.kind).toBe('ponder')
    expect(think.village.resources.knowledge).toBe(3)
    expect(think.village.stats.thoughts).toBe(1)
  })

  test('enough knowledge becomes a planned step on the building under way', () => {
    let v = createVillage(7, 0)
    // Work until a building site is placed.
    for (let i = 0; i < 40 && !v.plots.some(p => p.kind === 'building'); i++) v = applySignal(v, 'edit').village
    const index = v.plots.findIndex(p => p.kind === 'building')
    expect(index).toBeGreaterThan(-1)
    const before = v.plots[index]
    v = { ...v, resources: { ...v.resources, knowledge: 4 } }
    const outcome = applySignal(v, 'think')
    expect(outcome.action?.kind).toBe('build')
    const after = outcome.village.plots[index]
    if (before?.kind === 'building' && after?.kind === 'building') expect(after.progress).toBe(before.progress + 1)
    expect(outcome.village.resources.knowledge).toBe(2)
  })

  test('villages saved before thoughts were counted still load', () => {
    const v = createVillage(1, 0)
    const { thoughts: _, ...old } = v.stats
    const restored = restore(JSON.parse(JSON.stringify({ ...v, stats: old })))
    expect(restored?.stats.thoughts).toBe(0)
    expect(applySignal(restored!, 'think').village.stats.thoughts).toBe(1)
  })
})

describe('looks', () => {
  const grow = (village: Village, count: number) =>
    run(village, Array.from({ length: count }, (_, i) => (i % 6 === 5 ? 'commit' : 'edit') as Signal))
  const looks = (village: Village) => village.plots.flatMap(p => (p.kind === 'building' && p.look ? [p.look] : []))

  test('each building is given a look from the village kit when it is placed', () => {
    const v = grow(createVillage(7, 0), 200)
    expect(looks(v).length).toBe(v.plots.filter(p => p.kind === 'building').length)
    for (const look of looks(v)) {
      expect(v.kit.roofs).toContain(look.roof)
      expect(v.kit.props).toContain(look.prop)
    }
    // The same seed always grows the same village.
    expect(looks(grow(createVillage(7, 0), 200))).toEqual(looks(v))
  })

  test('villages differ: their own colour, their forest and where they build', () => {
    const villages = [1, 2, 3, 4, 5, 6, 7, 8].map(seed => createVillage(seed, 0, { roofs: ['slate', 'moss'], props: [] }))
    expect(new Set(villages.map(v => v.kit.accent)).size).toBeGreaterThan(1)
    const forests = villages.map(v => v.plots.flatMap(p => (p.kind === 'tree' ? [p.variant] : [])).join())
    expect(new Set(forests).size).toBeGreaterThan(1)
    const layouts = [1, 2, 3, 4].map(seed => grow(createVillage(seed, 0), 200).plots.map(p => p.kind[0]).join(''))
    expect(new Set(layouts).size).toBeGreaterThan(1)
  })

  test('styles found later join the kit; the village keeps its own colour', () => {
    const v = createVillage(3, 0)
    const kit = withStyles(v.kit, ['plum'], ['lantern'])
    expect(kit.roofs).toContain('plum')
    expect(kit.props).toContain('lantern')
    expect(kit.accent).toBe(v.kit.accent)
    expect(withStyles(kit, ['plum'], []).roofs.filter(r => r === 'plum').length).toBe(1)
  })

  test('villages saved before looks existed load with the base kit', () => {
    const { kit: _, ...old } = createVillage(1, 0)
    const restored = restore(JSON.parse(JSON.stringify(old)))
    expect(restored?.kit.roofs).toEqual(['classic', 'blue'])
  })

  test('a kit or look out of shape is refused', () => {
    const v = JSON.parse(JSON.stringify(grow(createVillage(7, 0), 200)))
    expect(restore({ ...v, kit: { ...v.kit, accent: 'gold' } })).toBeUndefined()
    expect(restore({ ...v, kit: { ...v.kit, roofs: ['classic', 'classic'] } })).toBeUndefined()
    const index = v.plots.findIndex((p: { kind: string }) => p.kind === 'building')
    v.plots[index].look = { roof: 'classic', prop: 'cannon', mirrored: false }
    expect(restore(v)).toBeUndefined()
  })
})

describe('seasons', () => {
  test('the seasons turn with the work done, starting in spring', () => {
    const at = (actions: number) => seasonOf({ ...createVillage(1, 0), stats: { ...createVillage(1, 0).stats, actions } })
    expect(at(0)).toBe('spring')
    expect(at(SEASON_ACTIONS - 1)).toBe('spring')
    expect(at(SEASON_ACTIONS)).toBe('summer')
    expect(at(SEASON_ACTIONS * 2)).toBe('autumn')
    expect(at(SEASON_ACTIONS * 3)).toBe('winter')
    expect(at(SEASON_ACTIONS * 4)).toBe('spring')
  })

  test('turns alone do not move the seasons', () => {
    const v = run(createVillage(1, 0), Array.from({ length: SEASON_ACTIONS * 2 }, () => 'turn' as const))
    expect(seasonOf(v)).toBe('spring')
  })
})

describe('ponds and fishing', () => {
  const withPond = (index: number) => {
    const v = createVillage(5, 0)
    const plots = v.plots.map((p, i) => (i === index ? ({ kind: 'pond' } as const) : p.kind === 'pond' ? ({ kind: 'grass' } as const) : p))
    return { ...v, plots }
  }

  test('some of the wild is water', () => {
    const plots = Array.from({ length: 400 }, (_, i) => wildPlot(3, i + 2))
    const ponds = plots.filter(p => p.kind === 'pond').length
    expect(ponds).toBeGreaterThan(5)
    expect(ponds).toBeLessThan(40)
  })

  test('when Claude has answered, a villager goes fishing and brings back food', () => {
    const v = withPond(2)
    const outcome = applySignal(v, 'turn')
    expect(outcome.action).toEqual({ kind: 'fish', plot: 2, before: undefined })
    expect(outcome.village.resources.food).toBe(v.resources.food + 1)
    // Waiting is not work: the seasons do not move for it.
    expect(outcome.village.stats.actions).toBe(v.stats.actions)
  })

  test('a settled village with no water digs a pond where it clears a stump', () => {
    const grown = run(createVillage(7, 0), Array.from({ length: 200 }, (_, i) => (i % 6 === 5 ? 'commit' : 'edit') as Signal))
    // Finished buildings, nothing to pay for a new one, the wild all stumps and no water anywhere in it.
    const plots = grown.plots.map(p =>
      p.kind === 'building' ? { ...p, progress: BUILDINGS[p.building].steps } : p.kind === 'tree' || p.kind === 'rock' || p.kind === 'pond' ? ({ kind: 'stump' } as const) : p,
    )
    // Stone to spare, so nobody hauls more of it, but no timber to start a building.
    const dry = { ...grown, plots, resources: { wood: 0, stone: 999, food: 0, knowledge: 0 } }
    expect(dry.plots.filter(p => p.kind === 'building').length).toBeGreaterThanOrEqual(2)
    const outcome = applySignal(dry, 'edit')
    expect(outcome.action?.kind).toBe('clear')
    const after = outcome.village.plots[outcome.action!.plot]
    // The wild beyond the village may have water of its own within reach; then there is no need to dig.
    expect(after?.kind).toBe(pondNear(dry) === undefined ? 'pond' : 'grass')
  })

  test('ponds load back', () => {
    const v = withPond(2)
    expect(restore(JSON.parse(JSON.stringify(v)))?.plots[2]).toEqual({ kind: 'pond' })
  })
})

describe('event rewards', () => {
  test('a bug caught brings knowledge, a scout timber and stone; neither moves the seasons', () => {
    const v = createVillage(1, 0)
    const bug = applySignal(v, 'bug').village
    expect(bug.resources.knowledge).toBe(v.resources.knowledge + 2)
    const scout = applySignal(v, 'scout').village
    expect(scout.resources.wood).toBe(v.resources.wood + 2)
    expect(scout.resources.stone).toBe(v.resources.stone + 1)
    expect(bug.stats.actions).toBe(v.stats.actions)
    expect(scout.stats.actions).toBe(v.stats.actions)
  })
})

describe('lamps and the fountain', () => {
  const grow = (village: Village, count: number) =>
    run(village, Array.from({ length: count }, (_, i) => (['edit', 'edit', 'commit', 'task', 'create'] as const)[i % 5]!))

  test('lamps are built, for timber and stone, only once the village is a hamlet', () => {
    const camp = grow(createVillage(21, 0), 6)
    expect(camp.lamps).toEqual([])
    const grown = grow(createVillage(21, 0), 150)
    expect(grown.lamps.length).toBeGreaterThan(0)
    // Every lamp stands on an edge between settled plots, and no two share one.
    expect(new Set(grown.lamps).size).toBe(grown.lamps.length)
    for (const i of grown.lamps) expect(['tree', 'rock', 'stump', 'pond']).not.toContain(grown.plots[i - 1]?.kind)
  })

  test('a lamp costs what it says, and is put up between buildings while saving for the next', () => {
    let v = grow(createVillage(21, 0), 60)
    v = {
      ...v,
      plots: v.plots.map(p => (p.kind === 'building' ? { ...p, progress: BUILDINGS[p.building].steps } : p)),
      resources: { wood: 3, stone: 3, food: 0, knowledge: 0 },
      stats: { ...v.stats, edits: 3 },
      lamps: [],
    }
    const spots = lampSpots(v)
    expect(spots.length).toBeGreaterThan(0)
    const outcome = applySignal(v, 'edit')
    expect(outcome.village.lamps).toEqual([spots[0]])
    expect(outcome.village.resources.wood).toBe(1)
    expect(outcome.village.resources.stone).toBe(0)
  })

  test('there is one fountain, built once the village has enough buildings, outside the fixed order', () => {
    const v = grow(createVillage(21, 0), 900)
    expect(v.plots.filter(p => p.kind === 'building' && p.building === 'fountain').length).toBe(1)
    expect(nextBuilding(v)).not.toBe('fountain')
    // Without it, a village of six buildings builds the fountain next, whatever the order says.
    const without = { ...v, plots: v.plots.map(p => (p.kind === 'building' && p.building === 'fountain' ? ({ kind: 'grass' } as const) : p)) }
    expect(nextBuilding(without)).toBe('fountain')
    const young = grow(createVillage(21, 0), 20)
    expect(nextBuilding(young)).not.toBe('fountain')
  })

  test('lamps load back; anything else in their place is refused', () => {
    const v = JSON.parse(JSON.stringify(grow(createVillage(21, 0), 150)))
    expect(restore(v)?.lamps).toEqual(v.lamps)
    const { lamps: _, ...old } = v
    expect(restore(old)?.lamps).toEqual([])
    expect(restore({ ...v, lamps: [0] })).toBeUndefined()
    expect(restore({ ...v, lamps: [2, 2] })).toBeUndefined()
  })
})


describe('where things are built', () => {
  const grow = (village: Village, count: number) =>
    run(village, Array.from({ length: count }, (_, i) => (['edit', 'edit', 'commit', 'task', 'create', 'test'] as const)[i % 6]!))

  test('the square beside the fire is kept for the fountain, which stands in the middle', () => {
    for (const seed of [3, 21, 40]) {
      const v = grow(createVillage(seed, 0), 900)
      const fountain = v.plots.findIndex(p => p.kind === 'building' && p.building === 'fountain')
      expect(fountain).toBe(squareOf(v))
      expect(Math.abs(fountain - v.camp)).toBe(1)
    }
  })

  test('until then nothing else is built or sown on the square', () => {
    let v = createVillage(21, 0)
    for (let i = 0; i < 300; i++) {
      v = applySignal(v, (['edit', 'commit', 'test', 'create'] as const)[i % 4]!).village
      const square = v.plots[squareOf(v)]
      const hasFountain = v.plots.some(p => p.kind === 'building' && p.building === 'fountain')
      if (!hasFountain) expect(square?.kind === 'farm' || (square?.kind === 'building' && square.building !== 'fountain')).toBe(false)
    }
  })

  test('the watchtower goes up on the edge, and fields on the outskirts', () => {
    const v = grow(createVillage(21, 0), 900)
    const tower = v.plots.findIndex(p => p.kind === 'building' && p.building === 'tower')
    const buildings = v.plots.flatMap((p, i) => (p.kind === 'building' ? [Math.abs(i - v.camp)] : []))
    // Further out than most buildings.
    expect(buildings.filter(d => d > Math.abs(tower - v.camp)).length).toBeLessThan(buildings.length / 2)
  })

  test('a new field is broken on the open ground furthest from the fire', () => {
    const v = createVillage(21, 0)
    const plots = v.plots.map((p, i) => (i === v.camp ? p : ({ kind: 'grass' } as const)))
    const outcome = applySignal({ ...v, plots }, 'test')
    expect(outcome.action?.kind).toBe('plant')
    const furthest = Math.max(v.camp, plots.length - 1 - v.camp)
    expect(Math.abs(outcome.action!.plot - v.camp)).toBe(furthest)
  })
})

describe('population', () => {
  test('however many homes there are, no more than twenty live in the village', () => {
    const v = run(createVillage(21, 0), Array.from({ length: 1500 }, (_, i) => (['edit', 'edit', 'commit', 'task', 'create', 'test'] as const)[i % 6]!))
    expect(v.villagers).toBe(20)
  })
})

describe('what gets built', () => {
  const signals = ['edit', 'edit', 'commit', 'task', 'create', 'test'] as const
  const history = (seed: number, count: number) => {
    let v = createVillage(seed, 0)
    const order: string[] = []
    for (let i = 0; i < count; i++) {
      const outcome = applySignal(v, signals[i % signals.length]!)
      for (const m of outcome.milestones) if (m.kind === 'built') order.push(m.building)
      v = outcome.village
    }
    return { v, order }
  }
  const counts = (v: Village) => {
    const c: Record<string, number> = {}
    for (const p of v.plots) if (p.kind === 'building') c[p.building] = (c[p.building] ?? 0) + 1
    return c
  }

  test('every village starts with a tent, then builds in an order of its own', () => {
    const orders = [1, 2, 3, 21, 40].map(seed => history(seed, 600).order)
    for (const order of orders) expect(order[0]).toBe('tent')
    expect(new Set(orders.map(o => o.slice(0, 8).join())).size).toBeGreaterThan(1)
    // The same seed always grows the same way.
    expect(history(21, 600).order).toEqual(history(21, 600).order)
  })

  test('each kind keeps to its cap, and homes stop once there is room for everyone', () => {
    for (const seed of [1, 2, 3, 21, 40]) {
      const { v } = history(seed, 1500)
      const c = counts(v)
      expect(c.tent ?? 0).toBeLessThanOrEqual(1)
      expect(c.hut ?? 0).toBeLessThanOrEqual(3)
      for (const kind of ['well', 'storehouse', 'workshop', 'tower']) expect(c[kind] ?? 0).toBeLessThanOrEqual(2)
      expect(c.fountain).toBe(1)
      expect(capacity(v)).toBeLessThanOrEqual(20)
      // Not a house more than the village needs to reach twenty.
      expect((c.house ?? 0) * 2).toBeLessThanOrEqual(20 + 2)
    }
  })

  test('once everything is built, no new site is started', () => {
    const { v } = history(21, 3000)
    expect(nextBuilding(v)).toBeUndefined()
    expect(v.plots.some(p => p.kind === 'building' && !isComplete(p))).toBe(false)
  })

  test('old buildings are rebuilt as better ones, with no one losing their home or the village its stage', () => {
    const { v } = history(21, 1500)
    expect(counts(v).tent ?? 0).toBe(0)
    let mid = createVillage(21, 0)
    let saw = false
    for (let i = 0; i < 1500 && !saw; i++) {
      const before = { stage: stageOf(mid), capacity: capacity(mid) }
      const outcome = applySignal(mid, signals[i % signals.length]!)
      const rebuilding = outcome.village.plots.some(p => p.kind === 'building' && p.from !== undefined)
      if (rebuilding && !mid.plots.some(p => p.kind === 'building' && p.from !== undefined)) {
        saw = true
        expect(stageOf(outcome.village)).toBe(before.stage)
        expect(capacity(outcome.village)).toBeGreaterThanOrEqual(before.capacity)
        expect(outcome.milestones.some(m => m.kind === 'stage')).toBe(false)
      }
      mid = outcome.village
    }
    expect(saw).toBe(true)
  })
})
