/** A pixel colour as 0xRRGGBB. */
export type Color = number

/** Marks a sprite pixel that is not drawn. */
export const CLEAR = -1

/** An RGB framebuffer, row-major. */
export type Canvas = {
  readonly width: number
  readonly height: number
  readonly pixels: Int32Array
}

/** A sprite: a grid of colours, `CLEAR` where transparent. */
export type Sprite = {
  readonly width: number
  readonly height: number
  readonly pixels: Int32Array
}

export function createCanvas(width: number, height: number, fill: Color = 0): Canvas {
  const pixels = new Int32Array(width * height)
  pixels.fill(fill)
  return { width, height, pixels }
}

export function setPixel(canvas: Canvas, x: number, y: number, color: Color): void {
  if (color === CLEAR) return
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  if (ix < 0 || iy < 0 || ix >= canvas.width || iy >= canvas.height) return
  canvas.pixels[iy * canvas.width + ix] = color
}

export function getPixel(canvas: Canvas, x: number, y: number): Color {
  return canvas.pixels[y * canvas.width + x] ?? 0
}

export function fillRect(
  canvas: Canvas,
  x: number,
  y: number,
  width: number,
  height: number,
  color: Color,
): void {
  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) setPixel(canvas, x + dx, y + dy, color)
  }
}

export type DrawOptions = {
  /** Mirror horizontally. */
  flip?: boolean
  /** Draw only the bottom fraction (0..1) of the sprite, for construction. */
  reveal?: number
  /** Replace one colour with another (villager tunics). */
  recolor?: ReadonlyMap<Color, Color>
  /** Draw only the pixels of this colour (lit windows at night). */
  only?: Color
}

/** Draws `sprite` with its top-left corner at (x, y). */
export function drawSprite(
  canvas: Canvas,
  sprite: Sprite,
  x: number,
  y: number,
  options: DrawOptions = {},
): void {
  const ox = Math.round(x)
  const oy = Math.round(y)
  const firstRow =
    options.reveal === undefined
      ? 0
      : Math.round(sprite.height * (1 - Math.max(0, Math.min(1, options.reveal))))
  for (let sy = firstRow; sy < sprite.height; sy++) {
    for (let sx = 0; sx < sprite.width; sx++) {
      const source = options.flip ? sprite.width - 1 - sx : sx
      let color = sprite.pixels[sy * sprite.width + source] ?? CLEAR
      if (color === CLEAR) continue
      if (options.only !== undefined && color !== options.only) continue
      color = options.recolor?.get(color) ?? color
      setPixel(canvas, ox + sx, oy + sy, color)
    }
  }
}

/** Builds a sprite from rows of palette keys; `.` and space are transparent. */
export function sprite(palette: Readonly<Record<string, Color>>, rows: readonly string[]): Sprite {
  const width = Math.max(...rows.map(row => row.length))
  const height = rows.length
  const pixels = new Int32Array(width * height).fill(CLEAR)
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const key = row[x]!
      if (key === '.' || key === ' ') continue
      const color = palette[key]
      if (color === undefined) throw new Error(`Unknown palette key "${key}"`)
      pixels[y * width + x] = color
    }
  })
  return { width, height, pixels }
}

/** Linear blend of two colours, `t` in 0..1. */
export function mix(a: Color, b: Color, t: number): Color {
  const k = Math.max(0, Math.min(1, t))
  const r = Math.round(((a >> 16) & 255) * (1 - k) + ((b >> 16) & 255) * k)
  const g = Math.round(((a >> 8) & 255) * (1 - k) + ((b >> 8) & 255) * k)
  const bl = Math.round((a & 255) * (1 - k) + (b & 255) * k)
  return (r << 16) | (g << 8) | bl
}
