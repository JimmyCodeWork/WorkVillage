import { en } from './en'
import { zhTW } from './zh-TW'

export type Messages = Record<keyof typeof en, string>
export type MessageKey = keyof Messages
export type Locale = 'en' | 'zh-TW'

const TABLES: Readonly<Record<Locale, Messages>> = { en, 'zh-TW': zhTW }

export type Translate = (key: MessageKey, values?: Readonly<Record<string, string | number>>) => string

export function translator(locale: Locale): Translate {
  const table = TABLES[locale]
  return (key, values) =>
    (table[key] ?? en[key]).replace(/\{(\w+)\}/g, (whole, name: string) =>
      values && name in values ? String(values[name]) : whole,
    )
}

/**
 * Picks a locale from the `language` option, falling back on the POSIX
 * locale variables when it is `auto`. Traditional Chinese locales (Taiwan,
 * Hong Kong, Macau, or an explicit Hant script) select zh-TW.
 */
export function resolveLocale(option: unknown, envLocales: readonly (string | undefined)[]): Locale {
  if (option === 'en' || option === 'zh-TW') return option
  const value = envLocales.find(v => v !== undefined && v !== '' && v !== 'C' && v !== 'POSIX')
  if (value === undefined) return 'en'
  const normalized = value.toLowerCase().replace('_', '-')
  if (/^zh-(tw|hk|mo)\b/.test(normalized) || normalized.includes('hant')) return 'zh-TW'
  return 'en'
}
