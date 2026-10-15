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
  // The resources sit on a row above the picture.
  expect(await ui.find({ type: 'Text', text: /Camp/ })).toBeDefined()
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

test('the resources row above the village holds the settings button', async ($, on) => {
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
  for (const surface of ['terminal', 'desktop'] as const) {
    const band = await $.ui.mount({ plugin: 'workvillage', surface, ...BAND })
    const tree = JSON.stringify(await band.find({ type: 'Box' }))
    // The resources row comes first, the village under it.
    expect(tree.indexOf('"key":"header"')).toBeGreaterThan(-1)
    expect(tree.indexOf('"key":"header"')).toBeLessThan(tree.indexOf('"key":"village"'))
    const header = JSON.stringify(await band.find({ key: 'header' }))
    expect(header).toMatch(/Camp/)
    expect(header).toMatch(/"key":"settings"/)
    // A button, not a plain text link.
    expect(JSON.stringify(await band.find({ key: 'settings' }))).not.toMatch(/"plain":true/)
    if (surface === 'terminal') {
      await band.press({ key: 'settings' })
    } else {
      // On the desktop the button is a Client, so it can tell when the pointer rests on it.
      expect(JSON.stringify(await band.find({ key: 'settings' }))).toMatch(/settings-button/)
      await band.press({ key: 'open', in: 'settings' } as never)
    }
    expect(opened.at(-1)).toBe('workvillage-settings')
    await band.unmount()
  }

  const panel = await $.ui.mount({ plugin: 'workvillage', surface: 'terminal', ...SETTINGS_PANE })
  expect((await panel.findAll({ type: 'Select' })).length).toBe(5)
  expect(await panel.find({ key: 'link' })).toBeUndefined()
  await panel.press({ key: 'visibility' })
  expect(await panel.find({ type: 'Button', key: 'visibility', text: /Show the village/ })).toBeDefined()
  await panel.select({ key: 'palette', value: 'mono-dark' })
  expect(written).toEqual([['workvillage.palette', 'mono-dark']])
  await panel.unmount()

  const mobile = await $.ui.mount({ plugin: 'workvillage', surface: 'mobile', ...SETTINGS_PANE })
  await mobile.press({ key: 'size:medium' })
  expect(written.at(-1)).toEqual(['workvillage.size', 'medium'])
  await mobile.unmount()
})

test('the scene keeps its full width under the resources row', async ($, on) => {
  mock.clock(on, { now: 0 })
  mock.store(on)
  mock.env(on, { LANG: 'en_US.UTF-8' })
  on('session.root', () => ({ value: '/work/layout' }))
  on('command.register', () => ({ value: { command: 'village' } }))
  on('session.start', (_$, e) => e)

  await $.session.start({ cwd: '/work/layout', surface: 'desktop', isInteractive: true })
  const desktop = await $.ui.mount({ plugin: 'workvillage', surface: 'desktop', ...BAND })
  expect(JSON.stringify(await desktop.find({ key: 'village' }))).toMatch(/"flexShrink":0/)
  const width = Number(/"width":(\d+(?:\.\d+)?)/.exec(JSON.stringify(await desktop.find({ type: 'Svg' })))?.[1])
  expect(width).toBeGreaterThanOrEqual(450)
  await desktop.unmount()

  const terminal = await $.ui.mount({ plugin: 'workvillage', surface: 'terminal', ...BAND })
  expect(/"columns":(\d+)/.exec(JSON.stringify(await terminal.find({ type: 'Raster' })))?.[1]).toBe('100')
  expect(JSON.stringify(await terminal.find({ key: 'village' }))).not.toMatch(/"key":"settings"/)
  await terminal.unmount()
})

test('the animation never redraws the settings pane', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  mock.store(on)
  mock.env(on, { LANG: 'en_US.UTF-8' })
  on('session.root', () => ({ value: '/work/flicker' }))
  on('command.register', () => ({ value: { command: 'village' } }))
  on('session.start', (_$, e) => e)
  let invalidated = 0
  on('ui.invalidate', () => {
    invalidated++
    return { value: undefined }
  })

  await $.session.start({ cwd: '/work/flicker', surface: 'desktop', isInteractive: true })
  const band = await $.ui.mount({ plugin: 'workvillage', surface: 'desktop', ...BAND })
  const panel = await $.ui.mount({ plugin: 'workvillage', surface: 'desktop', ...SETTINGS_PANE })
  await clock.advance(2000)
  // The scene moves by its own state, never by redrawing everything the plugin drew.
  expect(invalidated).toBe(0)
  await panel.unmount()
  await band.unmount()
})

test('a draw that comes before session.start still shows the village', async ($, on) => {
  // What a reload after a settings change can look like: the band is drawn
  // by the fresh module before session.start reaches it.
  mock.clock(on, { now: 0 })
  mock.store(on)
  mock.env(on, { LANG: 'en_US.UTF-8' })
  on('session.root', () => ({ value: '/work/reload' }))
  on('command.register', () => ({ value: { command: 'village' } }))

  const ui = await $.ui.mount({ plugin: 'workvillage', surface: 'terminal', ...BAND })
  expect(await ui.find({ type: 'Raster', key: 'village' })).toBeDefined()
  await ui.unmount()
})

test('the scene fills a wide band instead of leaving room on the right', async ($, on) => {
  mock.clock(on, { now: 0 })
  mock.store(on)
  mock.env(on, { LANG: 'en_US.UTF-8' })
  on('session.root', () => ({ value: '/work/wide' }))
  on('command.register', () => ({ value: { command: 'village' } }))
  on('session.start', (_$, e) => e)

  await $.session.start({ cwd: '/work/wide', surface: 'terminal', isInteractive: true })
  const wide = { ...BAND, props: { ...BAND.props, bodyColumns: 200 } }
  const terminal = await $.ui.mount({ plugin: 'workvillage', surface: 'terminal', ...wide })
  expect(/"columns":(\d+)/.exec(JSON.stringify(await terminal.find({ type: 'Raster' })))?.[1]).toBe('200')
  await terminal.unmount()

  const desktop = await $.ui.mount({ plugin: 'workvillage', surface: 'desktop', ...wide })
  const svg = JSON.stringify(await desktop.find({ type: 'Svg' }))
  expect(Number(/"width":(\d+(?:\.\d+)?)/.exec(svg)?.[1])).toBe(960)
  expect(JSON.stringify(await desktop.find({ key: 'village' }))).toMatch(/"alignItems":"center"/)
  await desktop.unmount()
})


test('a choice in the settings pane applies at once and does not snap back', async ($, on) => {
  mock.clock(on, { now: 0 })
  mock.store(on)
  mock.env(on, { LANG: 'en_US.UTF-8' })
  on('session.root', () => ({ value: '/work/choose' }))
  on('command.register', () => ({ value: { command: 'village' } }))
  on('session.start', (_$, e) => e)
  on('ui.toast', () => ({ value: undefined }))
  on('config.list', () => ({ value: [] }))
  // The engine refuses to store it: the choice must still hold for the session.
  on('config.set', () => ({ deny: 'not stored here' }))

  await $.session.start({ cwd: '/work/choose', surface: 'desktop', isInteractive: true })
  const panel = await $.ui.mount({ plugin: 'workvillage', surface: 'desktop', ...SETTINGS_PANE })
  await panel.select({ key: 'palette', value: 'mono-dark' })
  expect(JSON.stringify(await panel.find({ type: 'Select', key: 'palette' }))).toMatch(/"value":"mono-dark"/)
  await panel.unmount()

  const band = await $.ui.mount({ plugin: 'workvillage', surface: 'desktop', ...BAND })
  const svg = JSON.stringify(await band.find({ type: 'Svg' }))
  expect(svg).toMatch(/#000000/)
  expect(svg).not.toMatch(/fill=\\?"#(?!000000|ffffff)/)
  await band.unmount()
})

test('the scene holds still while the settings pane is open', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  mock.store(on)
  mock.env(on, { LANG: 'en_US.UTF-8' })
  on('session.root', () => ({ value: '/work/still' }))
  on('command.register', () => ({ value: { command: 'village' } }))
  on('session.start', (_$, e) => e)
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.close', () => ({ value: undefined }))
  let frames = 0
  on('state.set', (_$, e, next) => {
    if ((e as { key?: string }).key === 'frame') frames++
    return next(e)
  })

  await $.session.start({ cwd: '/work/still', surface: 'desktop', isInteractive: true })
  const band = await $.ui.mount({ plugin: 'workvillage', surface: 'desktop', ...BAND })
  await clock.advance(2000)
  expect(frames).toBeGreaterThan(0)

  await band.post({ type: 'open' }, { in: 'settings' })
  const panel = await $.ui.mount({ plugin: 'workvillage', surface: 'desktop', ...SETTINGS_PANE })
  const before = frames
  await clock.advance(2000)
  expect(frames).toBe(before)

  // Done closes the pane and the scene moves again.
  await panel.press({ key: 'done' })
  await clock.advance(2000)
  expect(frames).toBeGreaterThan(before)
  await panel.unmount()
  await band.unmount()
})

test('the scene holds still while the pointer rests on the Settings button', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  mock.store(on)
  mock.env(on, { LANG: 'en_US.UTF-8' })
  on('session.root', () => ({ value: '/work/hover' }))
  on('command.register', () => ({ value: { command: 'village' } }))
  on('session.start', (_$, e) => e)
  let frames = 0
  on('state.set', (_$, e, next) => {
    if ((e as { key?: string }).key === 'frame') frames++
    return next(e)
  })

  await $.session.start({ cwd: '/work/hover', surface: 'desktop', isInteractive: true })
  const band = await $.ui.mount({ plugin: 'workvillage', surface: 'desktop', ...BAND })
  await clock.advance(2000)
  expect(frames).toBeGreaterThan(0)

  await band.pointer({ type: 'enter', x: 1, y: 0, in: 'settings' })
  const before = frames
  await clock.advance(2000)
  expect(frames).toBe(before)

  await band.pointer({ type: 'leave', x: 1, y: 0, in: 'settings' })
  await clock.advance(2000)
  expect(frames).toBeGreaterThan(before)
  await band.unmount()
})
