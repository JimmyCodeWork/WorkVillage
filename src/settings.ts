// The settings the village offers in its own panel, mirroring the
// manifest's userConfig fields.

export type SettingField = 'palette' | 'size' | 'pixel' | 'link' | 'language' | 'animation'

export type Setting = { field: SettingField; options: readonly string[]; fallback: string }

export const SETTINGS: readonly Setting[] = [
  { field: 'palette', options: ['color', 'grayscale', 'mono', 'mono-light', 'mono-dark'], fallback: 'color' },
  { field: 'size', options: ['small', 'medium'], fallback: 'small' },
  { field: 'pixel', options: ['small', 'medium', 'large'], fallback: 'small' },
  { field: 'link', options: ['hint', 'top', 'bottom', 'hidden'], fallback: 'hint' },
  { field: 'language', options: ['auto', 'en', 'zh-TW'], fallback: 'auto' },
  { field: 'animation', options: ['full', 'reduced', 'off'], fallback: 'full' },
]

/** The value an option holds, or the field's default when it is unset or unknown. */
export function settingValue(setting: Setting, value: unknown): string {
  return typeof value === 'string' && setting.options.includes(value) ? value : setting.fallback
}
