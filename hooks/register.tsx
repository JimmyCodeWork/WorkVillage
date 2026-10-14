import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { BUILD_ORDER, BUILDINGS } from '../src/core/balance'
import {
  applySignal,
  createVillage,
  isComplete,
  restore,
  stageOf,
  type Milestone,
  type Signal,
  type Village,
} from '../src/core/world'
import { resolveLocale, translator, type Translate } from '../src/i18n/index'
import { toRasterCells, toSvg } from '../src/pixel/encode'
import { renderFrame, SCENE_HEIGHT } from '../src/scene/render'
import { createScene, enqueue, isBusy, stepScene, syncScene, type Scene } from '../src/scene/sim'
import { signalsFor } from '../src/signals'

const PANE = 'workvillage'
const RASTER_KEY = 'village'
const RASTER_ROWS = SCENE_HEIGHT / 2
const MAX_WIDTH = 240
const SVG_SCALE = 3

const isHidden = atom({ plugin: 'workvillage', key: 'isHidden' } as const, false)
const revision = atom({ plugin: 'workvillage', key: 'revision' } as const, 0)

type Mount = { surface: string; width: number }

function localHour(): number {
  const now = new Date()
  return now.getHours() + now.getMinutes() / 60
}

function isNightHour(hour: number): boolean {
  return hour >= 19.5 || hour < 5
}

function seedFrom(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

type Runtime = {
  animation: 'full' | 'reduced' | 'off'
  language: unknown
  t: Translate
  storeKey: string
  village: Village
  scene: Scene
  isReady: boolean
  ticker?: { cancel: () => void }
  saveTimer?: { cancel: () => void }
  mounts: Map<string, Mount>
}

// The module's own state: rebuilt from $.store at each session.start, so a
// hot reload loses nothing that matters.
const rt: Runtime = {
  animation: 'full',
  language: 'auto',
  t: translator('en'),
  storeKey: '',
  village: createVillage(0, 0),
  scene: createScene(createVillage(0, 0)),
  isReady: false,
  mounts: new Map(),
}

function summary(): string {
  const r = rt.village.resources
  return rt.t('summary.line', {
    stage: rt.t(`stage.${stageOf(rt.village)}`),
    villagers: rt.village.villagers,
    wood: r.wood,
    stone: r.stone,
    food: r.food,
  })
}

function progressLine(): string {
  const { t, village } = rt
  const site = village.plots.find(p => p.kind === 'building' && !isComplete(p))
  if (site?.kind === 'building') {
    const percent = Math.floor((site.progress / BUILDINGS[site.building].steps) * 100)
    return t('summary.building', { building: t(`building.${site.building}`), percent })
  }
  const next = BUILD_ORDER[Math.min(village.nextBuild, BUILD_ORDER.length - 1)]!
  const cost = BUILDINGS[next].cost
  return t('summary.next', { building: t(`building.${next}`), wood: cost.wood, stone: cost.stone })
}

function statsText(): string {
  const { t } = rt
  const s = rt.village.stats
  return [
    `${t('stat.edits')} ${s.edits}`,
    `${t('stat.reads')} ${s.reads}`,
    `${t('stat.tests')} ${s.tests}`,
    `${t('stat.commits')} ${s.commits}`,
    `${t('stat.tasks')} ${s.tasks}`,
    `${t('stat.turns')} ${s.turns}`,
  ].join(' · ')
}

function announce($: EngineInterface, milestone: Milestone): void {
  const { t } = rt
  switch (milestone.kind) {
    case 'built':
      $.ui.toast(t('toast.built', { building: t(`building.${milestone.building}`) }))
      break
    case 'stage':
      $.ui.toast(t('toast.stage', { stage: t(`stage.${milestone.stage}`) }))
      break
    case 'arrived':
      $.ui.toast(t('toast.arrived', { villagers: milestone.villagers }))
      break
    case 'expanded':
      break
  }
}

function scheduleSave($: EngineInterface): void {
  rt.saveTimer?.cancel()
  rt.saveTimer = $.clock.after(1500, () => saveNow($))
}

function saveNow($: EngineInterface): void {
  void $.store.set(rt.storeKey, rt.village)
}

async function apply($: EngineInterface, signals: readonly Signal[]): Promise<void> {
  if (!rt.isReady || signals.length === 0) return
  for (const signal of signals) {
    const outcome = applySignal(rt.village, signal)
    rt.village = outcome.village
    if (outcome.action) enqueue(rt.scene, outcome.action, rt.village)
    syncScene(rt.scene, rt.village)
    for (const milestone of outcome.milestones) announce($, milestone)
  }
  scheduleSave($)
  await update($, revision, n => n + 1)
}

function frameWidth(columns: number): number {
  return Math.max(24, Math.min(MAX_WIDTH, Math.floor(columns)))
}

function tick($: EngineInterface): void {
  const hour = localHour()
  stepScene(rt.scene, isNightHour(hour))
  let hasVector = false
  for (const [requestId, mount] of rt.mounts) {
    if (mount.surface !== 'terminal') {
      hasVector = true
      continue
    }
    const { cells } = toRasterCells(renderFrame(rt.village, rt.scene, mount.width, { hour }))
    void blit($, requestId, cells)
  }
  // Vector surfaces redraw the whole tree, so they move at a calmer pace.
  if (hasVector && (rt.scene.tick % 4 === 0 || isBusy(rt.scene))) $.ui.invalidate('ui.render')
}

async function blit($: EngineInterface, requestId: string, cells: string): Promise<void> {
  const result = await $.ui.blit({ requestId, key: RASTER_KEY, cells })
  if (result.deny !== undefined) rt.mounts.delete(requestId)
}

async function start($: EngineInterface): Promise<void> {
  const locales = [await $.env.get('LC_ALL'), await $.env.get('LC_MESSAGES'), await $.env.get('LANG')]
  rt.t = translator(resolveLocale(rt.language, locales))
  const root = await $.session.root()
  rt.storeKey = `village:${root}`
  rt.village = restore(await $.store.get(rt.storeKey)) ?? createVillage(seedFrom(root), await $.clock.now())
  rt.scene = createScene(rt.village)
  rt.isReady = true
  await $.command.register({
    name: 'village',
    description: rt.t('command.description'),
    argumentHint: '[show | hide | stats | reset]',
  })
  rt.ticker?.cancel()
  rt.ticker = rt.animation === 'off' ? undefined : $.clock.every(rt.animation === 'reduced' ? 1000 : 125, () => tick($))
}

async function stop($: EngineInterface): Promise<void> {
  rt.ticker?.cancel()
  rt.saveTimer?.cancel()
  if (rt.isReady) await $.store.set(rt.storeKey, rt.village)
}

async function runCommand($: EngineInterface, args: string): Promise<{ text: string }> {
  const { t } = rt
  const [verb = '', arg = ''] = args.trim().split(/\s+/)
  switch (verb) {
    case '':
      await update($, isHidden, () => false)
      await $.ui.open({ id: PANE, title: t('pane.title') })
      return { text: t('command.opened') }
    case 'show':
      await update($, isHidden, () => false)
      return { text: t('command.shown') }
    case 'hide':
      await update($, isHidden, () => true)
      return { text: t('command.hidden') }
    case 'stats':
      return { text: `${summary()}\n${progressLine()}\n${statsText()}` }
    case 'reset':
      if (arg !== 'confirm') return { text: t('command.resetConfirm') }
      rt.village = createVillage(rt.village.seed, await $.clock.now())
      rt.scene = createScene(rt.village)
      await $.store.set(rt.storeKey, rt.village)
      await update($, revision, n => n + 1)
      return { text: t('command.reset') }
    default:
      return { text: t('command.usage') }
  }
}

export const register: Register = (on, options) => {
  rt.animation = options.animation === 'reduced' || options.animation === 'off' ? options.animation : 'full'
  rt.language = options.language

  on('session.start', async ($, e, next) => {
    await start($)
    return next(e)
  })

  on('session.end', async ($, e, next) => {
    await stop($)
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny === undefined && ran.isError !== true) {
      await apply($, signalsFor(String(e.tool), e, ran.result))
    }
    return ran
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    await apply($, ['turn'])
    return next(e)
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'village' }, async ($, e) => runCommand($, e.args))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    await read($, revision)
    if (!rt.isReady || e.props.hasSurvey || (await read($, isHidden))) {
      rt.mounts.delete(e.requestId)
      return next(e)
    }
    const width = frameWidth(e.props.bodyColumns)
    if (e.surface === 'terminal') {
      const { Box, Text, Raster } = $.ui.resolve(e)
      if (e.props.maxRows < RASTER_ROWS + 2) {
        rt.mounts.delete(e.requestId)
        return <Text dimColor>{`⌂ ${summary()}`}</Text>
      }
      rt.mounts.set(e.requestId, { surface: 'terminal', width })
      const frame = toRasterCells(renderFrame(rt.village, rt.scene, width, { hour: localHour() }))
      return (
        <Box flexDirection="column">
          <Raster key={RASTER_KEY} columns={frame.columns} rows={frame.rows} cells={frame.cells} />
          <Text dimColor wrap="truncate-end">
            {summary()}
          </Text>
        </Box>
      )
    }
    if (e.surface === 'desktop') {
      const { Box, Text, Svg } = $.ui.resolve(e)
      rt.mounts.set(e.requestId, { surface: 'desktop', width })
      const svgWidth = Math.min(width, 200)
      const source = toSvg(renderFrame(rt.village, rt.scene, svgWidth, { hour: localHour() }), SVG_SCALE)
      return (
        <Box flexDirection="column">
          <Svg source={source} alt={rt.t('alt.village', { summary: summary() })} />
          <Text dimColor>{summary()}</Text>
        </Box>
      )
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    await read($, revision)
    const width = frameWidth(e.props.bodyColumns)
    const lines = [summary(), progressLine(), statsText()]
    if (e.surface === 'terminal') {
      const { Box, Text, Raster } = $.ui.resolve(e)
      rt.mounts.set(e.requestId, { surface: 'terminal', width })
      const frame = toRasterCells(renderFrame(rt.village, rt.scene, width, { hour: localHour() }))
      return (
        <Box flexDirection="column">
          <Raster key={RASTER_KEY} columns={frame.columns} rows={frame.rows} cells={frame.cells} />
          {lines.map(line => (
            <Text>{line}</Text>
          ))}
        </Box>
      )
    }
    const { Box, Text, Svg } = $.ui.resolve(e)
    rt.mounts.set(e.requestId, { surface: e.surface, width })
    const source = toSvg(renderFrame(rt.village, rt.scene, Math.min(width, 200), { hour: localHour() }), SVG_SCALE)
    return (
      <Box flexDirection="column">
        <Svg source={source} alt={rt.t('alt.village', { summary: summary() })} />
        {lines.map(line => (
          <Text>{line}</Text>
        ))}
      </Box>
    )
  })
}
