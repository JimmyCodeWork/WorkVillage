import { describe, expect, test } from 'claude-code/testing'

import { BUILDINGS } from '../src/core/balance'
import { applySignal, createVillage, restore, stageOf, withStyles, type Signal, type Village } from '../src/core/world'

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
