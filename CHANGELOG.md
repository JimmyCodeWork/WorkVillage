# Changelog

## Unreleased

- Click the village to open a row of actions above it (Settings, Hide village, Close) instead of a
  button beside it, so the scene keeps its full width.
- On the desktop the scene fills the available width at the chosen pixel size, instead of a small box.

## 0.2.0 - 2026-10-14

- A settings button beside the village, and `/village settings`, open a panel for colours, size,
  pixel size, language and animation; changes apply at once.

## 0.1.0 - 2026-10-14

- First release: a pixel-art village above the prompt that grows from wilderness as you work.
- Villagers fell trees, quarry stone, farm and build in response to edits, reads, passing tests,
  commits and completed tasks.
- Seven buildings and five settlement stages; day and night follow local time.
- Terminal (half-block raster) and desktop (SVG) rendering, plus a `/village` pane.
- English and Traditional Chinese.
- `palette` setting: full colour, grayscale, or black-and-white line art in a light version, a
  dark version, or one that follows the terminal's own colours.
- `size` setting: a compact 7-row band by default, or the 10-row `medium` band with a summary line.
- `pixel` setting: half-size pixels drawn as an image in kitty and Ghostty, and finer SVG pixels on
  the desktop.
