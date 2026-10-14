import { describe, expect, test } from 'claude-code/testing'

import { en } from '../src/i18n/en'
import { resolveLocale, translator } from '../src/i18n/index'
import { zhTW } from '../src/i18n/zh-TW'

describe('i18n', () => {
  test('both languages carry the same keys and placeholders', () => {
    expect(Object.keys(zhTW).sort()).toEqual(Object.keys(en).sort())
    const names = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort()
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(names(zhTW[key])).toEqual(names(en[key]))
    }
  })

  test('locale detection', () => {
    expect(resolveLocale('auto', [undefined, undefined, 'zh_TW.UTF-8'])).toBe('zh-TW')
    expect(resolveLocale('auto', ['zh_HK.UTF-8'])).toBe('zh-TW')
    expect(resolveLocale('auto', ['zh-Hant'])).toBe('zh-TW')
    expect(resolveLocale('auto', ['C', 'en_US.UTF-8'])).toBe('en')
    expect(resolveLocale('auto', [])).toBe('en')
    expect(resolveLocale('zh-TW', ['en_US'])).toBe('zh-TW')
    expect(resolveLocale('en', ['zh_TW'])).toBe('en')
  })

  test('placeholders are filled', () => {
    expect(translator('zh-TW')('toast.arrived', { villagers: 3 })).toBe('WorkVillage：新村民加入了（目前共 3 人）。')
  })
})
