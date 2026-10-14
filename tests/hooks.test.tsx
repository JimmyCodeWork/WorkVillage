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
