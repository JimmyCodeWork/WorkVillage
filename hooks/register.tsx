import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderSurface } from 'claude-code'

import type { WorkvillageTransfer } from '../types'
import { decodeArchive, encodeArchive, type Archive } from '../src/core/archive'
import { BUILDINGS } from '../src/core/balance'
import {
  foundStyles,
  isVillageKey,
  newlyFound,
  profileFrom,
  recordWork,
  restoreProfile,
  statsDelta,
  villageKey,
  VILLAGE_KEY_PREFIX,
  type Profile,
} from '../src/core/profile'
import { UNLOCKS, type Unlock } from '../src/core/balance'
import {
  applySignal,
  builtCount,
  createVillage,
  isComplete,
  nextBuilding,
  restore,
  seasonOf,
  stageOf,
  type Milestone,
  type Signal,
  type Stats,
  type Village,
  withStyles,
} from '../src/core/world'
import { resolveLocale, translator, type MessageKey, type Translate } from '../src/i18n/index'
import { toRasterCells, toRgba, toSvg } from '../src/pixel/encode'
import { MONO_INK, type Palette } from '../src/pixel/filter'
import { FINE_SMALL_HEIGHT, renderFrame, SCENE_HEIGHTS, type SceneSize } from '../src/scene/render'
import {
  catchBugs,
  createScene,
  enqueue,
  isBusy,
  releaseBug,
  scoutReturns,
  sendScout,
  setDrowsiness,
  stepScene,
  syncScene,
  wake,
  type Scene,
} from '../src/scene/sim'
import { SETTINGS, settingValue, type SettingField } from '../src/settings'
import { hasThinking, isTestCommand, signalsFor } from '../src/signals'

const PANE = 'workvillage'
const SETTINGS_PANE = 'workvillage-settings'
const SETTINGS_KEY = 'settings'
const SCENE_KEY = 'village'
/** Widest band per size, in terminal columns. */
// The scene fills the band's width: the wilderness carries on past the village,
// so a wider band simply shows more of it. These are the elements' own limits.
const MAX_RASTER_COLUMNS = 512
const MAX_IMAGE_COLUMNS = 255
/** Widest vector scene, in scene pixels; past it the scene is centred. */
const MAX_VECTOR_WIDTH = 640
/** After this long without work the villagers grow drowsy, and dozes come oftener... */
const DROWSY_AFTER_MS = 60_000
/** ...until, this long after that, they are as drowsy as they get. */
const DROWSY_OVER_MS = 4 * 60_000
/** Roughly how many CSS pixels one column of a vector surface is. */
const VECTOR_CELL_PX = 8

const PALETTES: readonly Palette[] = ['color', 'grayscale', 'mono', 'mono-light', 'mono-dark']

type PixelSize = 'small' | 'medium' | 'large'
/** CSS pixels per scene pixel on vector surfaces. */
const VECTOR_SCALE: Readonly<Record<PixelSize, number>> = { small: 1.5, medium: 2, large: 3 }

const isHidden = atom({ plugin: 'workvillage', key: 'isHidden' } as const, false)
/**
 * Bumped on each animation frame a vector surface should redraw. Only the
 * scene's own drawings read it, so other panes (the settings) never redraw
 * with the animation.
 */
const animationFrame = atom({ plugin: 'workvillage', key: 'frame' } as const, 0)
/**
 * Settings chosen in the settings pane this session. They apply at once and
 * survive a reload, whether or not the engine has stored them yet.
 */
const chosenSettings = atom({ plugin: 'workvillage', key: 'chosen' } as const, {} as Record<string, string>)
const revision = atom({ plugin: 'workvillage', key: 'revision' } as const, 0)
const NO_TRANSFER: WorkvillageTransfer = { notice: '', values: {}, shown: '', pending: '' }
const transfer = atom({ plugin: 'workvillage', key: 'transfer' } as const, NO_TRANSFER)

/** The device-wide record, beside each project's `village:<root>`. */
const PROFILE_KEY = 'profile'
/** What the last import replaced, so it can be put back. */
const BACKUP_KEY = 'backup'

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
  /** The village's counters as last added to the device-wide record. */
  recorded: Stats
  /** The save in flight; saves run one after another. */
  saving: Promise<void>
  /** The store holds what the last import replaced. */
  canUndoImport: boolean
  /** The device's lifetime counts as last read, for the collection line. */
  lifetime: Stats
  scene: Scene
  isReady: boolean
  /** The start in flight, so a draw that comes first can wait for it. */
  starting?: Promise<void>
  ticker?: { cancel: () => void }
  saveTimer?: { cancel: () => void }
  mounts: Map<string, Mount>
  /** The userConfig values as loaded, for the settings panel. */
  options: Readonly<Record<string, unknown>>
  /** The POSIX locale variables, read at start, for a language change. */
  locales: readonly (string | undefined)[]
  /** While the settings pane is open the vector scene holds still. */
  isSettingsOpen: boolean
  /** So does it while the pointer rests on the Settings button. */
  isPointerOnSettings: boolean
  /** Surfaces where the Settings button's Client failed; a plain Button stands in. */
  clientFaults: Set<string>
  /** When anything last happened in the session, for dozing. */
  lastActivity: number
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
  recorded: createVillage(0, 0).stats,
  saving: Promise.resolve(),
  canUndoImport: false,
  lifetime: createVillage(0, 0).stats,
  scene: createScene(createVillage(0, 0)),
  isReady: false,
  mounts: new Map(),
  options: {},
  locales: [],
  isSettingsOpen: false,
  isPointerOnSettings: false,
  clientFaults: new Set(),
  lastActivity: Date.now(),
}

function summary(): string {
  const r = rt.village.resources
  return rt.t('summary.line', {
    stage: rt.t(`stage.${stageOf(rt.village)}`),
    season: rt.t(`season.${seasonOf(rt.village)}`),
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
  const next = nextBuilding(village)
  const cost = BUILDINGS[next].cost
  return t('summary.next', { building: t(`building.${next}`), wood: cost.wood, stone: cost.stone })
}

function statsText(s: Stats = rt.village.stats): string {
  const { t } = rt
  return [
    `${t('stat.edits')} ${s.edits}`,
    `${t('stat.reads')} ${s.reads}`,
    `${t('stat.thoughts')} ${s.thoughts}`,
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

/** Every project's work on this device, for `/village stats`. */
function lifetimeText(profile: Profile): string {
  return `${rt.t('stat.lifetime', { villages: Object.keys(profile.villages).length })} ${statsText(profile.lifetime)}`
}

async function storedVillages($: EngineInterface): Promise<Record<string, Village>> {
  const villages: Record<string, Village> = {}
  for (const key of await $.store.keys()) {
    const village = isVillageKey(key) ? restore(await $.store.get(key)) : undefined
    if (village) villages[key] = village
  }
  return villages
}

/** The device's record; one begun now starts from the villages already on the device. */
async function readProfile($: EngineInterface): Promise<Profile> {
  const stored = restoreProfile(await $.store.get(PROFILE_KEY))
  return stored ?? profileFrom(Object.values(await storedVillages($)), await $.clock.now())
}

/** A fresh village for this project, with every style found so far. */
async function freshVillage($: EngineInterface, seed: number): Promise<Village> {
  rt.lifetime = (await readProfile($)).lifetime
  return createVillage(seed, await $.clock.now(), foundStyles(rt.lifetime))
}

/** A village with every style found on this device added to its kit. */
async function withFound($: EngineInterface, village: Village): Promise<Village> {
  rt.lifetime = (await readProfile($)).lifetime
  const styles = foundStyles(rt.lifetime)
  return { ...village, kit: withStyles(village.kit, styles.roofs, styles.props) }
}

/**
 * The styles found so far, by name. What is still to be found is only
 * counted: how to find it is left for work to turn up, not to be chased.
 */
function collectionText(): string {
  const found = UNLOCKS.filter(u => rt.lifetime[u.stat] >= u.at)
  const names = found.map(styleName).join(rt.t('collection.separator'))
  const left = UNLOCKS.length - found.length
  return [
    rt.t('collection.title', { found: found.length, total: UNLOCKS.length }),
    found.length > 0 ? names : rt.t('collection.none'),
    left > 0 ? rt.t('collection.left', { left }) : rt.t('collection.complete'),
  ].join(' ')
}

function styleName(unlock: Unlock): string {
  return unlock.kind === 'roof' ? rt.t(`style.roof.${unlock.style}`) : rt.t(`style.prop.${unlock.style}`)
}

function scheduleSave($: EngineInterface): void {
  rt.saveTimer?.cancel()
  rt.saveTimer = $.clock.after(1500, () => void saveNow($))
}

/**
 * Saves the village, then adds its work since the last save to the device's
 * record. The record is read fresh each time, so sessions in other terminals
 * add to it too rather than overwrite it.
 */
function saveNow($: EngineInterface): Promise<void> {
  rt.saveTimer?.cancel()
  rt.saving = rt.saving
    .then(async () => {
      const village = rt.village
      // Read first: a record begun now counts the villages as stored before this save.
      const profile = await readProfile($)
      await $.store.set(rt.storeKey, village)
      const delta = statsDelta(rt.recorded, village.stats)
      const next = recordWork(profile, rt.storeKey, village, delta, await $.clock.now())
      await $.store.set(PROFILE_KEY, next)
      rt.recorded = village.stats
      rt.lifetime = next.lifetime
      // Styles found by this work can turn up on this village's next buildings.
      const found = newlyFound(profile.lifetime, next.lifetime)
      if (found.length > 0) {
        const styles = foundStyles(next.lifetime)
        rt.village = { ...rt.village, kit: withStyles(rt.village.kit, styles.roofs, styles.props) }
        await $.store.set(rt.storeKey, rt.village)
        for (const unlock of found) $.ui.toast(rt.t('toast.found', { style: styleName(unlock) }))
      }
    })
    .catch(() => undefined)
  return rt.saving
}

/** Puts a village in place as this project's, without counting it as new work. */
function adopt(village: Village): void {
  rt.village = village
  rt.recorded = village.stats
  rt.scene = createScene(village)
}

/** Something happened: the village wakes if it was dozing. */
function stir(): void {
  rt.lastActivity = Date.now()
  wake(rt.scene)
}

async function apply($: EngineInterface, signals: readonly Signal[]): Promise<void> {
  if (signals.length === 0) return
  await ensureStarted($)
  stir()
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
  const columns = Math.max(24, Math.min(MAX_RASTER_COLUMNS, Math.floor(bodyColumns)))
  if (surface !== 'terminal') {
    // Fill the slot at the chosen pixel scale: a wider slot shows more village.
    const fit = Math.floor((Math.floor(bodyColumns) * VECTOR_CELL_PX) / VECTOR_SCALE[rt.pixel])
    const width = Math.max(48, Math.min(MAX_VECTOR_WIDTH, fit))
    return { kind: 'vector', width, height: SCENE_HEIGHTS[size], columns: 0, rows: 0 }
  }
  if (rt.pixel === 'small' && rt.hasGraphics) {
    // Two pixels across and four down per cell: half the size of a raster pixel.
    const height = size === 'small' ? FINE_SMALL_HEIGHT : SCENE_HEIGHTS.medium
    const imageColumns = Math.min(columns, MAX_IMAGE_COLUMNS)
    return { kind: 'image', width: imageColumns * 2, height, columns: imageColumns, rows: height / 4 }
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
  setDrowsiness(rt.scene, (Date.now() - rt.lastActivity - DROWSY_AFTER_MS) / DROWSY_OVER_MS)
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
  // Vector surfaces redraw the whole scene, so they move at a calmer pace.
  // It holds still while the settings pane is open, so nothing redraws under a choice being made.
  const isHeld = rt.isSettingsOpen || rt.isPointerOnSettings
  if (hasVector && !isHeld && (rt.scene.tick % 4 === 0 || isBusy(rt.scene))) {
    void update($, animationFrame, n => n + 1)
  }
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

/** Applies the plugin options to the module's state. */
function configure(options: Readonly<Record<string, unknown>>): void {
  rt.options = options
  rt.animation = options.animation === 'reduced' || options.animation === 'off' ? options.animation : 'full'
  rt.size = options.size === 'medium' ? 'medium' : 'small'
  rt.palette = PALETTES.find(p => p === options.palette) ?? 'color'
  rt.pixel = options.pixel === 'medium' || options.pixel === 'large' ? options.pixel : 'small'
  rt.language = options.language
  rt.t = translator(resolveLocale(rt.language, rt.locales))
}

function startTicker($: EngineInterface): void {
  rt.ticker?.cancel()
  rt.ticker = rt.animation === 'off' ? undefined : $.clock.every(rt.animation === 'reduced' ? 1000 : 125, () => tick($))
}

async function start($: EngineInterface): Promise<void> {
  rt.locales = [await $.env.get('LC_ALL'), await $.env.get('LC_MESSAGES'), await $.env.get('LANG')]
  configure({ ...rt.options, ...(await read($, chosenSettings)) })
  rt.hasGraphics = await detectGraphics($)
  const root = await $.session.root()
  rt.storeKey = villageKey(root)
  const saved = restore(await $.store.get(rt.storeKey))
  adopt(saved ? await withFound($, saved) : await freshVillage($, seedFrom(root)))
  rt.canUndoImport = (await $.store.get(BACKUP_KEY)) !== undefined
  rt.isReady = true
  await $.command.register({
    name: 'village',
    description: rt.t('command.description'),
    argumentHint: '[show | hide | stats | settings | reset]',
  })
  startTicker($)
}

/**
 * Starts the module once. A reload (a changed setting, among others) can
 * reach a draw before session.start runs again; the draw starts it then
 * instead of drawing nothing until something else redraws the band.
 */
async function ensureStarted($: EngineInterface): Promise<void> {
  if (rt.isReady) return
  rt.starting ??= start($)
  try {
    await rt.starting
  } finally {
    rt.starting = undefined
  }
}

async function stop($: EngineInterface): Promise<void> {
  rt.ticker?.cancel()
  if (rt.isReady) await saveNow($)
}

async function openSettings($: EngineInterface): Promise<void> {
  rt.isSettingsOpen = true
  rt.isPointerOnSettings = false
  await $.ui.open({ id: SETTINGS_PANE, title: rt.t('settings.title') })
}

async function closeSettings($: EngineInterface): Promise<void> {
  rt.isSettingsOpen = false
  await $.ui.close({ id: SETTINGS_PANE })
}

async function setBandHidden($: EngineInterface, hidden: boolean): Promise<void> {
  await update($, isHidden, () => hidden)
}

/**
 * Applies a choice at once, then saves it as the /config menu would. The
 * choice holds for the session even when saving fails, which a toast reports.
 */
async function changeSetting($: EngineInterface, field: SettingField, value: string): Promise<void> {
  const before = rt.animation
  const chosen = await update($, chosenSettings, all => ({ ...all, [field]: value }))
  configure({ ...rt.options, ...chosen })
  if (rt.animation !== before) startTicker($)
  await update($, revision, n => n + 1)
  try {
    const rows = await $.config.list()
    const row =
      rows.find(r => r.provider.plugin.startsWith('workvillage') && r.key.endsWith(`.${field}`)) ??
      rows.find(r => r.key.endsWith(`.${field}`) && r.key.startsWith('workvillage'))
    const result = await $.config.set({ key: row?.key ?? `workvillage.${field}`, value })
    if (result.deny !== undefined) $.ui.toast(rt.t('settings.denied', { reason: result.deny }))
  } catch (error) {
    $.ui.toast(rt.t('settings.denied', { reason: error instanceof Error ? error.message : String(error) }))
  }
}

async function say($: EngineInterface, notice: MessageKey | '', values: Record<string, string | number> = {}, rest: Partial<WorkvillageTransfer> = {}): Promise<void> {
  await update($, transfer, () => ({ ...NO_TRANSFER, notice, values, ...rest }))
}

/** This project's village, or a backup of every village and the record on this device. */
async function makeArchive($: EngineInterface, kind: Archive['kind']): Promise<Archive> {
  await saveNow($)
  if (kind === 'village') return { kind, village: rt.village }
  return { kind, profile: await readProfile($), villages: await storedVillages($) }
}

/** Copies an export code; where the clipboard does not take it, shows it to copy by hand. */
async function exportCode($: EngineInterface, kind: Archive['kind'], surface: RenderSurface): Promise<void> {
  const code = encodeArchive(await makeArchive($, kind))
  const copied = await $.ui.copy({ text: code, surface }).catch(() => ({ isCopied: false as const }))
  const what = rt.t(kind === 'village' ? 'data.what.village' : 'data.what.backup')
  if (copied.isCopied) await say($, 'data.copied', { what })
  else await say($, 'data.copyByHand', { what }, { shown: code })
}

function preview(archive: Archive): { notice: MessageKey; values: Record<string, string | number> } {
  if (archive.kind === 'village') {
    const v = archive.village
    return {
      notice: 'data.preview.village',
      values: { stage: rt.t(`stage.${stageOf(v)}`), villagers: v.villagers, built: builtCount(v) },
    }
  }
  return { notice: 'data.preview.backup', values: { villages: Object.keys(archive.villages).length } }
}

/** Reads a pasted code and asks for confirmation; nothing changes yet. */
async function readImport($: EngineInterface, code: string): Promise<void> {
  if (code.trim() === '') return say($, '')
  const read = decodeArchive(code)
  if ('error' in read) return say($, `data.error.${read.error}`)
  const { notice, values } = preview(read.archive)
  await say($, notice, values, { pending: code })
}

/**
 * Puts an imported village or backup in place, after keeping what it
 * replaces so the import can be undone. A village replaces this project's;
 * a backup replaces the villages it holds and the device's record.
 */
async function confirmImport($: EngineInterface): Promise<void> {
  const { pending } = await read($, transfer)
  const decoded = decodeArchive(pending)
  if ('error' in decoded) return say($, `data.error.${decoded.error}`)
  const { archive } = decoded
  await saveNow($)
  const incoming: Record<string, unknown> =
    archive.kind === 'village' ? { [rt.storeKey]: archive.village } : { ...archive.villages, [PROFILE_KEY]: archive.profile }
  const entries: Record<string, unknown> = {}
  for (const key of Object.keys(incoming)) entries[key] = (await $.store.get(key)) ?? null
  await $.store.set(BACKUP_KEY, { at: await $.clock.now(), entries })
  rt.canUndoImport = true
  for (const [key, value] of Object.entries(incoming)) await $.store.set(key, value)
  const imported = restore(await $.store.get(rt.storeKey))
  adopt(imported ? await withFound($, imported) : rt.village)
  await saveNow($)
  await update($, revision, n => n + 1)
  await say($, 'data.imported')
}

/** Puts back what the last import replaced. */
async function undoImport($: EngineInterface): Promise<void> {
  const backup = (await $.store.get(BACKUP_KEY)) as { entries?: Record<string, unknown> } | undefined
  const entries = typeof backup?.entries === 'object' && backup.entries !== null ? backup.entries : {}
  for (const [key, value] of Object.entries(entries)) {
    if (!isVillageKey(key) && key !== PROFILE_KEY) continue
    if (value === null) await $.store.delete(key)
    else await $.store.set(key, value)
  }
  await $.store.delete(BACKUP_KEY)
  rt.canUndoImport = false
  const root = rt.storeKey.slice(VILLAGE_KEY_PREFIX.length)
  adopt(restore(await $.store.get(rt.storeKey)) ?? (await freshVillage($, seedFrom(root))))
  await saveNow($)
  await update($, revision, n => n + 1)
  await say($, 'data.undone')
}

async function runCommand($: EngineInterface, args: string): Promise<{ text: string }> {
  await ensureStarted($)
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
      await saveNow($)
      return { text: [summary(), progressLine(), statsText(), lifetimeText(await readProfile($)), collectionText()].join('\n') }
    case 'reset':
      if (arg !== 'confirm') return { text: t('command.resetConfirm') }
      // The device-wide record keeps the work done; only this village starts over.
      await saveNow($)
      adopt(await freshVillage($, rt.village.seed))
      await saveNow($)
      await update($, revision, n => n + 1)
      return { text: t('command.reset') }
    default:
      return { text: t('command.usage') }
  }
}

export const register: Register = (on, options) => {
  configure(options)

  on('session.start', async ($, e, next) => {
    await ensureStarted($)
    return next(e)
  })

  on('session.end', async ($, e, next) => {
    await stop($)
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const tool = String(e.tool)
    // A subagent's errand: a scout sets out now and comes back when it is done.
    const isErrand = tool === 'Agent' || tool === 'Task'
    if (isErrand) {
      await ensureStarted($)
      stir()
      sendScout(rt.scene)
    }
    const ran = await next(e)
    const isDone = ran.deny === undefined && ran.isError !== true
    if (isErrand) scoutReturns(rt.scene, isDone)
    if (isDone) {
      const signals = signalsFor(tool, e, ran.result)
      // Passing tests again: the bugs the failures let loose are caught.
      if (signals.includes('test') && rt.isReady) {
        for (let caught = catchBugs(rt.scene); caught > 0; caught--) signals.push('bug')
      }
      await apply($, signals)
    } else if (ran.deny === undefined && tool === 'Bash' && isTestCommand(String((e as { command?: unknown }).command ?? ''))) {
      // A failed test run costs nothing; a bug crawls out of the forest to be caught later.
      await ensureStarted($)
      stir()
      releaseBug(rt.scene)
    }
    return ran
  }).catch(($, e, next) => next(e))

  // A response the model thought through before answering grows knowledge.
  on('session.append', async ($, e, next) => {
    const stored = await next(e)
    if (hasThinking(e.door, e.message.content)) await apply($, ['think'])
    return stored
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    await apply($, ['turn'])
    return next(e)
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'village' }, async ($, e) => runCommand($, e.args))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    await read($, revision)
    await ensureStarted($)
    if (e.props.hasSurvey || (await read($, isHidden))) {
      rt.mounts.delete(e.requestId)
      return next(e)
    }
    const mount = layout(e.surface, e.props.bodyColumns, rt.size)
    if (e.surface === 'terminal') {
      const { Box, Text, Button, Raster, Image } = $.ui.resolve(e)
      // The resources row, then the scene.
      if (e.props.maxRows < mount.rows + 2) {
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
          <Box key="header" flexDirection="row" justifyContent="space-between" gap={2} width={mount.columns}>
            <Box flexShrink={1}>
              <Text dimColor wrap="truncate-end">
                {summary()}
              </Text>
            </Box>
            <Box flexShrink={0}>
              <Button key={SETTINGS_KEY} label={rt.t('settings.open')} onPress={() => openSettings($)} />
            </Box>
          </Box>
          <Box key="village" flexShrink={0}>
            {scene}
          </Box>
        </Box>
      )
    }
    if (e.surface === 'desktop') {
      await read($, animationFrame)
      const { Box, Text, Button, Svg, Client } = $.ui.resolve(e)
      rt.mounts.set(e.requestId, mount)
      return (
        <Box flexDirection="column">
          <Box key="header" flexDirection="row" justifyContent="space-between" alignItems="center" gap={2}>
            <Box flexShrink={1}>
              <Text dimColor>{summary()}</Text>
            </Box>
            <Box flexShrink={0}>
              {rt.clientFaults.has(e.surface) ? (
                <Button key={SETTINGS_KEY} label={rt.t('settings.open')} onPress={() => openSettings($)} />
              ) : (
                <Client key={SETTINGS_KEY} module="./settings-button.tsx" props={{ label: rt.t('settings.open') }} />
              )}
            </Box>
          </Box>
          <Box key="village" flexShrink={0} alignItems="center">
            <Svg
              source={toSvg(frame(mount), VECTOR_SCALE[rt.pixel])}
              alt={rt.t('alt.village', { summary: summary() })}
              width={mount.width * VECTOR_SCALE[rt.pixel]}
              height={mount.height * VECTOR_SCALE[rt.pixel]}
            />
          </Box>
        </Box>
      )
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    await read($, revision)
    await ensureStarted($)
    const mount = layout(e.surface, e.props.bodyColumns, 'medium')
    rt.mounts.set(e.requestId, mount)
    const lines = [summary(), progressLine(), statsText(), collectionText()]
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
    await read($, animationFrame)
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

  on('ui.message', async ($, e, next) => {
    if (e.element !== SETTINGS_KEY) return next(e)
    const data = (e.data ?? {}) as { type?: unknown; on?: unknown }
    if (data.type === 'hover') rt.isPointerOnSettings = data.on === true
    if (data.type === 'open') await openSettings($)
    return {}
  })

  on('ui.fault', async ($, e, next) => {
    // The surface could not run the button's Client: draw a plain Button there instead.
    if (e.element === SETTINGS_KEY) rt.clientFaults.add(e.surface)
    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.close', async ($, e, next) => {
    if (e.id === SETTINGS_PANE) rt.isSettingsOpen = false
    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: SETTINGS_PANE }, async ($, e) => {
    await ensureStarted($)
    rt.isSettingsOpen = true
    // Redraws only when a choice is made, never with the animation.
    await read($, chosenSettings)
    const { t } = rt
    const label = (field: SettingField, value: string) => t(`option.${field}.${value}` as Parameters<Translate>[0])
    const hidden = await read($, isHidden)
    const data = await read($, transfer)
    const notice = data.notice === '' ? undefined : t(data.notice as MessageKey, data.values)
    const exports = [
      { key: 'export-village', label: t('data.exportVillage'), onPress: (p: { surface: RenderSurface }) => exportCode($, 'village', p.surface) },
      { key: 'export-backup', label: t('data.exportBackup'), onPress: (p: { surface: RenderSurface }) => exportCode($, 'backup', p.surface) },
    ]
    const undo = { key: 'import-undo', label: t('data.undo'), onPress: () => undoImport($) }
    const visibility = {
      key: 'visibility',
      label: t(hidden ? 'settings.showVillage' : 'settings.hideVillage'),
      onPress: () => setBandHidden($, !hidden),
    }
    if (e.surface === 'mobile') {
      // No Select or Input on mobile: one Button per choice, the current one marked.
      const { Box, Text, Button, Code } = $.ui.resolve(e)
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
          <Box key="data" flexDirection="column">
            <Text bold>{t('data.title')}</Text>
            <Text dimColor>{t('data.hintMobile')}</Text>
            {exports.map(button => (
              <Button {...button} />
            ))}
            {rt.canUndoImport && <Button {...undo} />}
            {notice !== undefined && <Text>{notice}</Text>}
            {data.shown !== '' && <Code source={data.shown} />}
          </Box>
        </Box>
      )
    }
    const { Box, Text, Button, Select, Input, Code } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        <Text dimColor>{t('settings.hint')}</Text>
        <Box flexDirection="row" gap={2}>
          <Button {...visibility} />
          <Button key="done" label={t('settings.done')} variant="primary" onPress={() => closeSettings($)} />
        </Box>
        {SETTINGS.map(setting => (
          <Select
            key={setting.field}
            label={t(`setting.${setting.field}`)}
            value={settingValue(setting, rt.options[setting.field])}
            options={setting.options.map(value => ({ value, label: label(setting.field, value) }))}
            onSelect={value => changeSetting($, setting.field, value)}
          />
        ))}
        <Box key="data" flexDirection="column">
          <Text bold>{t('data.title')}</Text>
          <Text dimColor>{t('data.hint')}</Text>
          <Box flexDirection="row" gap={2}>
            {exports.map(button => (
              <Button {...button} />
            ))}
            {rt.canUndoImport && <Button {...undo} />}
          </Box>
          <Input
            key="import"
            label={t('data.import')}
            placeholder={t('data.importPlaceholder')}
            submitLabel={t('data.read')}
            onSubmit={value => readImport($, value)}
          />
          {notice !== undefined && <Text>{notice}</Text>}
          {data.pending !== '' && (
            <Box flexDirection="row" gap={2}>
              <Button key="import-confirm" label={t('data.confirm')} variant="primary" onPress={() => confirmImport($)} />
              <Button key="import-cancel" label={t('data.cancel')} onPress={() => say($, '')} />
            </Box>
          )}
          {data.shown !== '' && <Code source={data.shown} />}
        </Box>
      </Box>
    )
  })
}
