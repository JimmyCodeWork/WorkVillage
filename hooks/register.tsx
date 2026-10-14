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
import { toRasterCells, toRgba, toSvg } from '../src/pixel/encode'
import { MONO_INK, type Palette } from '../src/pixel/filter'
import { FINE_SMALL_HEIGHT, renderFrame, SCENE_HEIGHTS, type SceneSize } from '../src/scene/render'
import { createScene, enqueue, isBusy, stepScene, syncScene, type Scene } from '../src/scene/sim'
import { SETTINGS, settingValue, type SettingField } from '../src/settings'
import { signalsFor } from '../src/signals'

const PANE = 'workvillage'
const SETTINGS_PANE = 'workvillage-settings'
const SETTINGS_KEY = 'settings'
const SCENE_KEY = 'village'
/** Widest band per size, in terminal columns. */
const MAX_COLUMNS: Readonly<Record<SceneSize, number>> = { small: 120, medium: 240 }
/** Widest vector scene, in scene pixels. */
const MAX_VECTOR_WIDTH = 320
/** Roughly how many CSS pixels one column of a vector surface is. */
const VECTOR_CELL_PX = 8

const PALETTES: readonly Palette[] = ['color', 'grayscale', 'mono', 'mono-light', 'mono-dark']

type PixelSize = 'small' | 'medium' | 'large'
/** CSS pixels per scene pixel on vector surfaces. */
const VECTOR_SCALE: Readonly<Record<PixelSize, number>> = { small: 1.5, medium: 2, large: 3 }

const isHidden = atom({ plugin: 'workvillage', key: 'isHidden' } as const, false)
const revision = atom({ plugin: 'workvillage', key: 'revision' } as const, 0)

/**
 * How one site draws the scene: `raster` is half-block cells (two pixels a
 * cell), `image` a picture at half-cell pixels where the terminal has
 * graphics, `vector` an SVG on the remote surfaces.
 */
type Mount = {
  kind: 'raster' | 'image' | 'vector'
  /** Scene size in pixels. */
  width: number
  height: number
  /** The box in terminal cells, for raster and image. */
  columns: number
  rows: number
}

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
  size: SceneSize
  pixel: PixelSize
  palette: Palette
  /** The terminal draws pictures (kitty graphics protocol). */
  hasGraphics: boolean
  language: unknown
  t: Translate
  storeKey: string
  village: Village
  scene: Scene
  isReady: boolean
  ticker?: { cancel: () => void }
  saveTimer?: { cancel: () => void }
  mounts: Map<string, Mount>
  /** The userConfig values as loaded, for the settings panel. */
  options: Readonly<Record<string, unknown>>
}

// The module's own state: rebuilt from $.store at each session.start, so a
// hot reload loses nothing that matters.
const rt: Runtime = {
  animation: 'full',
  size: 'small',
  pixel: 'small',
  palette: 'color',
  hasGraphics: false,
  language: 'auto',
  t: translator('en'),
  storeKey: '',
  village: createVillage(0, 0),
  scene: createScene(createVillage(0, 0)),
  isReady: false,
  mounts: new Map(),
  options: {},
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

function layout(surface: string, bodyColumns: number, size: SceneSize): Mount {
  const columns = Math.max(24, Math.min(MAX_COLUMNS[size], Math.floor(bodyColumns)))
  if (surface !== 'terminal') {
    // Fill the slot at the chosen pixel scale: a wider slot shows more village.
    const fit = Math.floor((Math.floor(bodyColumns) * VECTOR_CELL_PX) / VECTOR_SCALE[rt.pixel])
    const width = Math.max(48, Math.min(MAX_VECTOR_WIDTH, fit))
    return { kind: 'vector', width, height: SCENE_HEIGHTS[size], columns: 0, rows: 0 }
  }
  if (rt.pixel === 'small' && rt.hasGraphics) {
    // Two pixels across and four down per cell: half the size of a raster pixel.
    const height = size === 'small' ? FINE_SMALL_HEIGHT : SCENE_HEIGHTS.medium
    return { kind: 'image', width: columns * 2, height, columns, rows: height / 4 }
  }
  const height = SCENE_HEIGHTS[size]
  return { kind: 'raster', width: columns, height, columns, rows: height / 2 }
}

function frame(mount: Mount, hour = localHour()) {
  return renderFrame(rt.village, rt.scene, mount.width, { hour }, { height: mount.height, palette: rt.palette })
}

function rasterCells(canvas: ReturnType<typeof frame>): string {
  return toRasterCells(canvas, rt.palette === 'mono' ? { inkOnly: MONO_INK } : {}).cells
}

function tick($: EngineInterface): void {
  const hour = localHour()
  stepScene(rt.scene, isNightHour(hour))
  let hasVector = false
  for (const [requestId, mount] of rt.mounts) {
    if (mount.kind === 'vector') {
      hasVector = true
    } else if (mount.kind === 'image') {
      void blitImage($, requestId, toRgba(frame(mount, hour)))
    } else {
      void blitRaster($, requestId, rasterCells(frame(mount, hour)))
    }
  }
  // Vector surfaces redraw the whole tree, so they move at a calmer pace.
  if (hasVector && (rt.scene.tick % 4 === 0 || isBusy(rt.scene))) $.ui.invalidate('ui.render')
}

async function blitRaster($: EngineInterface, requestId: string, cells: string): Promise<void> {
  const result = await $.ui.blit({ requestId, key: SCENE_KEY, cells })
  if (result.deny !== undefined) rt.mounts.delete(requestId)
}

async function blitImage(
  $: EngineInterface,
  requestId: string,
  source: { rgba: string; width: number; height: number },
): Promise<void> {
  const result = await $.ui.blit({ requestId, key: SCENE_KEY, source })
  if (result.deny !== undefined) rt.mounts.delete(requestId)
}

/** Whether this process runs in a terminal that draws Image elements. */
async function detectGraphics($: EngineInterface): Promise<boolean> {
  const term = (await $.env.get('TERM')) ?? ''
  const program = ((await $.env.get('TERM_PROGRAM')) ?? '').toLowerCase()
  if ((await $.env.get('TMUX')) !== undefined) return false
  return (
    term.includes('kitty') ||
    term.includes('ghostty') ||
    program === 'ghostty' ||
    (await $.env.get('KITTY_WINDOW_ID')) !== undefined ||
    (await $.env.get('GHOSTTY_RESOURCES_DIR')) !== undefined
  )
}

async function start($: EngineInterface): Promise<void> {
  const locales = [await $.env.get('LC_ALL'), await $.env.get('LC_MESSAGES'), await $.env.get('LANG')]
  rt.t = translator(resolveLocale(rt.language, locales))
  rt.hasGraphics = await detectGraphics($)
  const root = await $.session.root()
  rt.storeKey = `village:${root}`
  rt.village = restore(await $.store.get(rt.storeKey)) ?? createVillage(seedFrom(root), await $.clock.now())
  rt.scene = createScene(rt.village)
  rt.isReady = true
  await $.command.register({
    name: 'village',
    description: rt.t('command.description'),
    argumentHint: '[show | hide | stats | settings | reset]',
  })
  rt.ticker?.cancel()
  rt.ticker = rt.animation === 'off' ? undefined : $.clock.every(rt.animation === 'reduced' ? 1000 : 125, () => tick($))
}

async function stop($: EngineInterface): Promise<void> {
  rt.ticker?.cancel()
  rt.saveTimer?.cancel()
  if (rt.isReady) await $.store.set(rt.storeKey, rt.village)
}

async function openSettings($: EngineInterface): Promise<void> {
  await $.ui.open({ id: SETTINGS_PANE, title: rt.t('settings.title') })
}

async function setBandHidden($: EngineInterface, hidden: boolean): Promise<void> {
  await update($, isHidden, () => hidden)
}

/**
 * Writes one of the plugin's userConfig fields as the /config menu would;
 * the engine then reloads the module with the new options.
 */
async function changeSetting($: EngineInterface, field: SettingField, value: string): Promise<void> {
  const rows = await $.config.list()
  const key = rows.find(row => row.key.endsWith(`.${field}`) && row.key.split('.')[0]?.startsWith('workvillage'))?.key
  const result = await $.config.set({ key: key ?? `workvillage.${field}`, value })
  if (result.deny !== undefined) $.ui.toast(rt.t('settings.denied', { reason: result.deny }))
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
    case 'settings':
      await openSettings($)
      return { text: t('command.settings') }
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
  rt.size = options.size === 'medium' ? 'medium' : 'small'
  rt.palette = PALETTES.find(p => p === options.palette) ?? 'color'
  rt.pixel = options.pixel === 'medium' || options.pixel === 'large' ? options.pixel : 'small'
  rt.language = options.language
  rt.options = options

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
    const size = rt.size
    const mount = layout(e.surface, e.props.bodyColumns, size)
    // The small band is the picture alone; /village stats has the numbers.
    const withSummary = size === 'medium'
    if (e.surface === 'terminal') {
      const { Box, Text, Button, Raster, Image } = $.ui.resolve(e)
      if (e.props.maxRows < mount.rows + (withSummary ? 2 : 1)) {
        rt.mounts.delete(e.requestId)
        return <Text dimColor>{`⌂ ${summary()}`}</Text>
      }
      rt.mounts.set(e.requestId, mount)
      const scene =
        mount.kind === 'image' ? (
          <Image key={SCENE_KEY} source={toRgba(frame(mount))} columns={mount.columns} rows={mount.rows} alt=" " />
        ) : (
          <Raster key={SCENE_KEY} columns={mount.columns} rows={mount.rows} cells={rasterCells(frame(mount))} />
        )
      return (
        <Box flexDirection="column">
          <Box key="scene" flexShrink={0}>
            {scene}
            {/* A plain text link in the corner, laid over the picture so it takes no room. */}
            <Box position="absolute" right={0} bottom={0}>
              <Button key={SETTINGS_KEY} label={rt.t('settings.open')} plain onPress={() => openSettings($)} />
            </Box>
          </Box>
          {withSummary && (
            <Text dimColor wrap="truncate-end">
              {summary()}
            </Text>
          )}
        </Box>
      )
    }
    if (e.surface === 'desktop') {
      const { Box, Text, Button, Svg } = $.ui.resolve(e)
      rt.mounts.set(e.requestId, mount)
      return (
        <Box flexDirection="column">
          <Box key="scene" flexShrink={0}>
            <Svg
              source={toSvg(frame(mount), VECTOR_SCALE[rt.pixel])}
              alt={rt.t('alt.village', { summary: summary() })}
              width={mount.width * VECTOR_SCALE[rt.pixel]}
              height={mount.height * VECTOR_SCALE[rt.pixel]}
            />
            <Box position="absolute" right={0} bottom={0}>
              <Button key={SETTINGS_KEY} label={rt.t('settings.open')} plain onPress={() => openSettings($)} />
            </Box>
          </Box>
          {withSummary && <Text dimColor>{summary()}</Text>}
        </Box>
      )
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    await read($, revision)
    const mount = layout(e.surface, e.props.bodyColumns, 'medium')
    rt.mounts.set(e.requestId, mount)
    const lines = [summary(), progressLine(), statsText()]
    if (e.surface === 'terminal') {
      const { Box, Text, Raster, Image } = $.ui.resolve(e)
      return (
        <Box flexDirection="column">
          {mount.kind === 'image' ? (
            <Image key={SCENE_KEY} source={toRgba(frame(mount))} columns={mount.columns} rows={mount.rows} alt=" " />
          ) : (
            <Raster key={SCENE_KEY} columns={mount.columns} rows={mount.rows} cells={rasterCells(frame(mount))} />
          )}
          {lines.map(line => (
            <Text>{line}</Text>
          ))}
        </Box>
      )
    }
    const { Box, Text, Svg } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        <Svg source={toSvg(frame(mount), VECTOR_SCALE[rt.pixel])} alt={rt.t('alt.village', { summary: summary() })} />
        {lines.map(line => (
          <Text>{line}</Text>
        ))}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: SETTINGS_PANE }, async ($, e) => {
    const { t } = rt
    const label = (field: SettingField, value: string) => t(`option.${field}.${value}` as Parameters<Translate>[0])
    const hidden = await read($, isHidden)
    const visibility = {
      key: 'visibility',
      label: t(hidden ? 'settings.showVillage' : 'settings.hideVillage'),
      onPress: () => setBandHidden($, !hidden),
    }
    if (e.surface === 'mobile') {
      // No Select on mobile: one Button per choice, the current one marked.
      const { Box, Text, Button } = $.ui.resolve(e)
      return (
        <Box flexDirection="column">
          <Text dimColor>{t('settings.hint')}</Text>
          <Button {...visibility} />
          {SETTINGS.map(setting => {
            const current = settingValue(setting, rt.options[setting.field])
            return (
              <Box flexDirection="column">
                <Text bold>{t(`setting.${setting.field}`)}</Text>
                {setting.options.map(value => (
                  <Button
                    key={`${setting.field}:${value}`}
                    label={label(setting.field, value)}
                    variant={value === current ? 'primary' : 'secondary'}
                    onPress={() => changeSetting($, setting.field, value)}
                  />
                ))}
              </Box>
            )
          })}
        </Box>
      )
    }
    const { Box, Text, Button, Select } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        <Text dimColor>{t('settings.hint')}</Text>
        <Button {...visibility} />
        {SETTINGS.map(setting => (
          <Select
            key={setting.field}
            label={t(`setting.${setting.field}`)}
            value={settingValue(setting, rt.options[setting.field])}
            options={setting.options.map(value => ({ value, label: label(setting.field, value) }))}
            onSelect={value => changeSetting($, setting.field, value)}
          />
        ))}
      </Box>
    )
  })
}
