# Changelog

## 0.2.3 - 2026-10-14

- The **Settings** link is a row of its own, apart from the village: at the medium size the summary
  stays under the picture as before, instead of sharing the link's row.

## 0.2.2 - 2026-10-14

- The **Settings** link has a row of its own instead of covering the village's corner; at the medium
  size it shares that row with the summary.
- New `link` setting: put that row above the village (default) or below it, or hide the link and use
  `/village settings`.

## 0.2.1 - 2026-10-14

- The settings button beside the village is now a plain **Settings** link in its bottom-right corner,
  laid over the picture, so the scene keeps its full width. The settings panel can also hide or show
  the village.
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
