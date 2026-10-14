import type { Canvas } from './canvas'

/**
 * `mono` follows the terminal's own colours (light paper elsewhere);
 * `mono-light` is black ink on white paper and `mono-dark` white on black.
 */
export type Palette = 'color' | 'grayscale' | 'mono' | 'mono-light' | 'mono-dark'

export const isMono = (palette: Palette): boolean => palette.startsWith('mono')

/** Ink and paper of the black-and-white palette. */
export const MONO_INK = 0x000000
export const MONO_PAPER = 0xffffff

function luminance(color: number): number {
  const r = (color >> 16) & 255
  const g = (color >> 8) & 255
  const b = color & 255
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

/** Every pixel to its shade of grey, in place. */
export function toGrayscale(canvas: Canvas): Canvas {
  const { pixels } = canvas
  for (let i = 0; i < pixels.length; i++) {
    const v = Math.round(luminance(pixels[i]!) * 255)
    pixels[i] = (v << 16) | (v << 8) | v
  }
  return canvas
}

/**
 * Turns a frame into black-and-white line art, in place. `backdrop` is the
 * frame as it was before anything stood on it (sky, hills, ground): it
 * becomes paper, with ink only for the horizon and the grass line. What
 * stands on it is filled by tone (dark ink, mid-tones a fine checker, light
 * paper) and outlined in ink where it meets the backdrop.
 */
export function toMonochrome(canvas: Canvas, backdrop: Int32Array, ground: number): Canvas {
  const { width, height, pixels } = canvas
  const isBackdrop = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= width || y >= height) return true
    const i = y * width + x
    return pixels[i] === backdrop[i]
  }
  const out = new Int32Array(pixels.length)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      if (isBackdrop(x, y)) {
        const isGrass = y === ground
        // A hill's top edge: unlike the sky's gradient, a hill is one colour downwards.
        const isRidge =
          y > 0 && y < ground - 1 && backdrop[i] !== backdrop[i - width] && backdrop[i] === backdrop[i + width] && x % 2 === 0
        out[i] = isGrass || isRidge ? MONO_INK : MONO_PAPER
        continue
      }
      const edge = isBackdrop(x - 1, y) || isBackdrop(x + 1, y) || isBackdrop(x, y - 1) || isBackdrop(x, y + 1)
      const l = luminance(pixels[i]!)
      const ink = edge || l < 0.45
      out[i] = ink ? MONO_INK : MONO_PAPER
    }
  }
  pixels.set(out)
  return canvas
}

/** Swaps ink and paper, in place: the dark black-and-white version. */
export function invertMonochrome(canvas: Canvas): Canvas {
  const { pixels } = canvas
  for (let i = 0; i < pixels.length; i++) pixels[i] = pixels[i] === MONO_INK ? MONO_PAPER : MONO_INK
  return canvas
}
