import { expect, mock, test } from 'claude-code/testing'

const BAND = {
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 24,
    bodyColumns: 100,
    scroll: { offset: 0, bodyRows: 23, contentRows: 0 },
    view: {},
  },
} as const

test('the band draws the village and follows the work', async ($, on) => {
  mock.clock(on, { now: 0 })
  mock.store(on)
  mock.env(on, { LANG: 'en_US.UTF-8' })
  on('session.root', () => ({ value: '/work/project' }))
  on('command.register', () => ({ value: { command: 'village' } }))
  on('session.start', (_$, e) => e)
  on('ui.toast', () => ({ value: undefined }))
  on('tool.call', () => ({ result: { filePath: '/x', oldString: '', newString: '' } as never }))

  await $.session.start({ cwd: '/work/project', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ plugin: 'workvillage', surface: 'terminal', ...BAND })
  expect(await ui.find({ key: 'village' })).toBeDefined()
  // The default small band is the picture alone.
  expect(await ui.find({ type: 'Text' })).toBeUndefined()
  await ui.unmount()

  await $.tool.call({ tool: 'Edit', file_path: '/x', old_string: 'a', new_string: 'b' } as never)
  const stats = await $.command.run({ command: 'village', args: 'stats' } as never)
  expect(stats.text).toMatch(/Timber [1-9]|Stone [1-9]/)

  const desktop = await $.ui.mount({ plugin: 'workvillage', surface: 'desktop', ...BAND })
  expect(await desktop.find({ type: 'Svg' })).toBeDefined()
  await desktop.unmount()
})

test('/village stats speaks Traditional Chinese under a zh_TW locale', async ($, on) => {
  mock.clock(on, { now: 0 })
  mock.store(on)
  mock.env(on, { LANG: 'zh_TW.UTF-8' })
  on('session.root', () => ({ value: '/work/other' }))
  on('command.register', () => ({ value: { command: 'village' } }))
  on('session.start', (_$, e) => e)

  await $.session.start({ cwd: '/work/other', surface: 'terminal', isInteractive: true })
  const out = await $.command.run({ command: 'village', args: 'stats' } as never)
  expect(out.text).toMatch(/營地/)
})

test('kitty and Ghostty draw half-size pixels as an image', async ($, on) => {
  mock.clock(on, { now: 0 })
  mock.store(on)
  mock.env(on, { LANG: 'en_US.UTF-8', TERM: 'xterm-kitty' })
  on('session.root', () => ({ value: '/work/kitty' }))
  on('command.register', () => ({ value: { command: 'village' } }))
  on('session.start', (_$, e) => e)

  await $.session.start({ cwd: '/work/kitty', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ plugin: 'workvillage', surface: 'terminal', ...BAND })
  const image = await ui.find({ type: 'Image', key: 'village' })
  expect(image).toBeDefined()
  expect(await ui.find({ type: 'Raster' })).toBeUndefined()
  await ui.unmount()
})

test('the mono palette draws the band in black and white', { options: { palette: 'mono' } }, async ($, on) => {
  mock.clock(on, { now: 0 })
  mock.store(on)
  mock.env(on, { LANG: 'en_US.UTF-8' })
  on('session.root', () => ({ value: '/work/mono' }))
  on('command.register', () => ({ value: { command: 'village' } }))
  on('session.start', (_$, e) => e)

  await $.session.start({ cwd: '/work/mono', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ plugin: 'workvillage', surface: 'terminal', ...BAND })
  expect(await ui.find({ type: 'Raster', key: 'village' })).toBeDefined()
  await ui.unmount()

  const desktop = await $.ui.mount({ plugin: 'workvillage', surface: 'desktop', ...BAND })
  const svg = await desktop.find({ type: 'Svg' })
  expect(JSON.stringify(svg)).toMatch(/#000000/)
  expect(JSON.stringify(svg)).not.toMatch(/fill=\\?"#(?!000000|ffffff)/)
  await desktop.unmount()
})

const SETTINGS_PANE = {
  component: 'Pane',
  requestId: 'workvillage-settings',
  props: {
    title: 'WorkVillage settings',
    isFocused: true,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20, contentRows: 0 },
    view: {},
  },
} as const

test('the settings button opens a panel that writes the plugin options', async ($, on) => {
  mock.clock(on, { now: 0 })
  mock.store(on)
  mock.env(on, { LANG: 'en_US.UTF-8' })
  on('session.root', () => ({ value: '/work/settings' }))
  on('command.register', () => ({ value: { command: 'village' } }))
  on('session.start', (_$, e) => e)
  const opened: string[] = []
  on('ui.open', (_$, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('config.list', () => ({ value: [] }))
  const written: [string, unknown][] = []
  on('config.set', (_$, e) => {
    written.push([e.key, e.value])
    return { value: e.value }
  })

  await $.session.start({ cwd: '/work/settings', surface: 'terminal', isInteractive: true })
  const band = await $.ui.mount({ plugin: 'workvillage', surface: 'terminal', ...BAND })
  await band.press({ key: 'settings' })
  expect(opened).toEqual(['workvillage-settings'])
  await band.unmount()

  const panel = await $.ui.mount({ plugin: 'workvillage', surface: 'terminal', ...SETTINGS_PANE })
  expect((await panel.findAll({ type: 'Select' })).length).toBe(5)
  await panel.select({ key: 'palette', value: 'mono-dark' })
  expect(written).toEqual([['workvillage.palette', 'mono-dark']])
  await panel.unmount()

  const mobile = await $.ui.mount({ plugin: 'workvillage', surface: 'mobile', ...SETTINGS_PANE })
  await mobile.press({ key: 'size:medium' })
  expect(written.at(-1)).toEqual(['workvillage.size', 'medium'])
  await mobile.unmount()
})

test('the settings button never squeezes the scene', async ($, on) => {
  mock.clock(on, { now: 0 })
  mock.store(on)
  mock.env(on, { LANG: 'en_US.UTF-8' })
  on('session.root', () => ({ value: '/work/layout' }))
  on('command.register', () => ({ value: { command: 'village' } }))
  on('session.start', (_$, e) => e)

  await $.session.start({ cwd: '/work/layout', surface: 'desktop', isInteractive: true })
  const desktop = await $.ui.mount({ plugin: 'workvillage', surface: 'desktop', ...BAND })
  const scene = JSON.stringify(await desktop.find({ key: 'scene' }))
  expect(scene).toMatch(/"flexShrink":0/)
  const width = Number(/"width":(\d+(?:\.\d+)?)/.exec(JSON.stringify(await desktop.find({ type: 'Svg' })))?.[1])
  expect(width).toBeGreaterThanOrEqual(400)
  await desktop.unmount()

  const terminal = await $.ui.mount({ plugin: 'workvillage', surface: 'terminal', ...BAND })
  expect(JSON.stringify(await terminal.find({ key: 'scene' }))).toMatch(/"flexShrink":0/)
  expect(JSON.stringify(await terminal.find({ type: 'Raster' }))).toMatch(/"columns":98/)
  await terminal.unmount()
})
