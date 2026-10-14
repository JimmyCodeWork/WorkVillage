import type { Canvas } from './canvas'

const UPPER_HALF_BLOCK = 0x2580
const LOWER_HALF_BLOCK = 0x2584
const FULL_BLOCK = 0x2588
const SPACE = 0x20
/** The terminal's own default colour, in a Raster cell. */
const TERMINAL_DEFAULT = 0x01000000
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/** Standard padded base64; written out so it runs in any JavaScript host. */
export function toBase64(bytes: Uint8Array): string {
  let out = ''
  let i = 0
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8) | bytes[i + 2]!
    out += ALPHABET[(n >> 18) & 63]! + ALPHABET[(n >> 12) & 63]! + ALPHABET[(n >> 6) & 63]! + ALPHABET[n & 63]!
  }
  const rest = bytes.length - i
  if (rest === 1) {
    const n = bytes[i]! << 16
    out += ALPHABET[(n >> 18) & 63]! + ALPHABET[(n >> 12) & 63]! + '=='
  } else if (rest === 2) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8)
    out += ALPHABET[(n >> 18) & 63]! + ALPHABET[(n >> 12) & 63]! + ALPHABET[(n >> 6) & 63]! + '='
  }
  return out
}

/**
 * Packs a canvas into terminal Raster cells: each cell is an upper half
 * block, its foreground the upper pixel and its background the lower one,
 * so one cell holds two square pixels. With `inkOnly`, pixels of that colour
 * are drawn in the terminal's default foreground and the rest left blank.
 */
export function toRasterCells(
  canvas: Canvas,
  options: { inkOnly?: number } = {},
): { columns: number; rows: number; cells: string } {
  const columns = canvas.width
  const rows = Math.ceil(canvas.height / 2)
  const words = new Uint32Array(columns * rows * 3)
  for (let row = 0; row < rows; row++) {
    for (let x = 0; x < columns; x++) {
      const top = canvas.pixels[row * 2 * columns + x] ?? 0
      const bottom = row * 2 + 1 < canvas.height ? (canvas.pixels[(row * 2 + 1) * columns + x] ?? 0) : top
      const at = (row * columns + x) * 3
      if (options.inkOnly !== undefined) {
        // Black and white in the terminal's own colours: ink is drawn with
        // the default foreground, paper left as the default background.
        const isTop = top === options.inkOnly
        const isBottom = bottom === options.inkOnly
        words[at] = isTop ? (isBottom ? FULL_BLOCK : UPPER_HALF_BLOCK) : isBottom ? LOWER_HALF_BLOCK : SPACE
        words[at + 1] = TERMINAL_DEFAULT
        words[at + 2] = TERMINAL_DEFAULT
        continue
      }
      words[at] = UPPER_HALF_BLOCK
      words[at + 1] = top & 0xffffff
      words[at + 2] = bottom & 0xffffff
    }
  }
  return { columns, rows, cells: toBase64(new Uint8Array(words.buffer)) }
}

function hex(color: number): string {
  return '#' + (color & 0xffffff).toString(16).padStart(6, '0')
}

/** Renders a canvas as crisp SVG, one rect per horizontal run of a colour. */
export function toSvg(canvas: Canvas, scale: number): string {
  const { width, height, pixels } = canvas
  const parts: string[] = []
  for (let y = 0; y < height; y++) {
    let x = 0
    while (x < width) {
      const color = pixels[y * width + x] ?? 0
      let run = 1
      while (x + run < width && pixels[y * width + x + run] === color) run++
      parts.push(`<rect x="${x}" y="${y}" width="${run}" height="1" fill="${hex(color)}"/>`)
      x += run
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" ` +
    `width="${width * scale}" height="${height * scale}" shape-rendering="crispEdges">` +
    parts.join('') +
    '</svg>'
  )
}

/** RGBA bytes, base64, as an Image element's `{ rgba, width, height }` takes them. */
export function toRgba(canvas: Canvas): { rgba: string; width: number; height: number } {
  const bytes = new Uint8Array(canvas.width * canvas.height * 4)
  canvas.pixels.forEach((color, i) => {
    bytes[i * 4] = (color >> 16) & 255
    bytes[i * 4 + 1] = (color >> 8) & 255
    bytes[i * 4 + 2] = color & 255
    bytes[i * 4 + 3] = 255
  })
  return { rgba: toBase64(bytes), width: canvas.width, height: canvas.height }
}
