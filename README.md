# WorkVillage

**A pixel-art village above your Claude Code prompt that grows as your project progresses.**

English | [繁體中文](README.zh-TW.md)

![A finished village by day](docs/images/04-village.png)

Every project starts as untouched wilderness: a single settler and a campfire in the forest.
As you and Claude work, villagers walk out to fell trees, quarry stone, plant fields and raise
buildings. The camp becomes a hamlet, then a village, a town and eventually a city.

| Wilderness | Hamlet | Night |
| --- | --- | --- |
| ![Wilderness](docs/images/01-wilderness.png) | ![Hamlet](docs/images/03-hamlet.png) | ![Night](docs/images/06-night.png) |

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install workvillage --marketplace JimmyCodeWork/WorkVillage
```

Answer `y` to add the marketplace, then choose a scope. From a shell:

```
claude plugin install workvillage --marketplace JimmyCodeWork/WorkVillage
```

In the desktop app, click **+** next to the prompt box, then **Plugins**, **Add marketplace** with
`JimmyCodeWork/WorkVillage`, then **Add plugin**.

Requires Claude Code 2.1.275 or later.

## How your work shapes the village

| What happens in your session | What the villagers do |
| --- | --- |
| A file is edited | Fell a tree or clear a stump for **timber**, or work on the current building |
| A new file is written | Quarry a boulder for **stone** |
| Files are read or searched | Gather **knowledge**; now and then forage for food |
| A test run passes | Plant, water and harvest fields for **food** |
| A `git commit` succeeds | A milestone: a big push on the current building |
| A to-do or task is completed | A new villager arrives, if there is a home for them |

Buildings are raised in order: Tent, Hut, Well, Storehouse, House, Workshop and Watchtower.
Each costs timber and stone and takes several steps of work to finish. When the trees near the
camp are gone, the clearing extends further into the forest. The sky follows your local time,
and at night the villagers gather around the fire.

Failed tool calls never cost you anything: the village only ever grows.

## Commands

| Command | Description |
| --- | --- |
| `/village` | Open the village pane with resources and activity |
| `/village show` / `/village hide` | Show or hide the band above the prompt |
| `/village stats` | Print the village's resources and your activity |
| `/village settings` | Open the settings panel |
| `/village reset confirm` | Return this project's village to wilderness |

## Settings

Click **WorkVillage Settings** at the end of the hint line under the prompt (the `link` setting can move
it above or below the village instead), or run `/village settings`, to open the
settings panel. It can also hide or show the village above the prompt. Changes apply at once. The same settings are also in the `/config` menu,
under **workvillage**.

| Setting | Values | Default |
| --- | --- | --- |
| `size` | `small` (7 rows), `medium` (10 rows, with a summary line); both fill the band's width | `small` |
| `palette` | `color`, `grayscale`, `mono`, `mono-light`, `mono-dark` | `color` |
| `pixel` | `small`, `medium`, `large` (see below) | `small` |
| `link` | `hint`, `top`, `bottom`, `hidden` (where the Settings link sits) | `hint` |
| `language` | `auto`, `en`, `zh-TW` | `auto` (follows `LC_ALL`, `LC_MESSAGES` or `LANG`) |
| `animation` | `full`, `reduced`, `off` | `full` |

### Black and white

The `mono` palettes draw the village as black-and-white line art, in a light and a dark version:

| Palette | Look |
| --- | --- |
| `mono` | Follows your terminal's own text and background colours, so it suits light and dark themes alike; light elsewhere |
| `mono-light` | Black ink on white |
| `mono-dark` | White ink on black |

`grayscale` keeps every shade, in grey.

| `mono-light` | `mono-dark` |
| --- | --- |
| ![Light line art](docs/images/04-village-mono.png) | ![Dark line art](docs/images/04-village-mono-dark.png) |

![Grayscale](docs/images/04-village-grayscale.png)

## Where it draws

- **Terminal**: a pixel scene drawn with half-block characters and animated in place: 7 rows by
  default, or 10 rows with the `medium` size. When the terminal is too short, a one-line summary is
  shown instead.
- **Terminals with graphics (kitty, Ghostty)**: with `pixel` set to `small`, the scene is drawn as an
  image at half-size pixels, so the small band takes only 4 rows and shows twice as much of the
  village. Inside tmux, the half-block scene is used instead.
- **Claude Code Desktop**: the same scene as crisp SVG, at 1.5, 2 or 3 CSS pixels per pixel for
  `small`, `medium` and `large`.
- **Mobile**: available in the `/village` pane.

## Privacy

WorkVillage makes no network requests and sends no telemetry. It only counts what kind of work
happened (an edit, a read, a passing test). It never stores file names, file contents, commands or
prompts. Each project's village is saved in WorkVillage's own plugin store, keyed by the project's
root directory.

## Development

```
claude plugin validate .   # check the manifest and hooks module
claude plugin test .       # run the test suite
tsc -p .                   # type-check (after Claude Code has loaded the mod once)
bun scripts/preview.ts docs/images   # render the preview images
```

To try local changes, start Claude Code with `claude --plugin-dir /path/to/WorkVillage`.

### Releasing

Versions follow [Semantic Versioning](https://semver.org/). To release, set the same version in
`.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`, add a section to
`CHANGELOG.md`, and tag the merge commit as `vX.Y.Z`. Pushing the tag runs the release workflow,
which checks the versions and publishes a GitHub Release with that changelog section. The same
workflow can instead be run by hand from the Actions tab (**Release**, **Run workflow** on `main`,
with the version): it creates the tag on `main` and the release together.

The source is laid out as follows:

- `src/core`: the village's rules and balance, as pure functions
- `src/scene`: villager animation and frame composition
- `src/art`: the palette, sprites and villager poses
- `src/pixel`: the framebuffer and its terminal and SVG encoders
- `src/i18n`: English and Traditional Chinese strings
- `hooks/register.tsx`: wires Claude Code events to the village

## Artwork

All pixel art in WorkVillage was drawn for this project and is released under the same licence
as the code. It is not derived from any other game or asset pack.

## License

[MIT](LICENSE)
