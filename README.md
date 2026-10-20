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
| Files are read or searched | Read by the fire for **knowledge**; now and then forage for food |
| Claude thinks before answering, or hands work to a subagent | Ponder by the fire for more **knowledge** |
| A test run passes | Plant, water and harvest fields for **food** |
| A `git commit` succeeds | A milestone: a big push on the current building |
| A to-do or task is completed | A new villager arrives, if there is a home for them |
| Claude finishes answering and waits for you | Go fishing at the pond for **food** |

Every 4 knowledge becomes a planned step on the building under way, so reading and thinking help
the village grow too.

Villagers see each job through: a tree takes many blows of the axe, falls and is cut to length,
and a boulder is struck until it cracks and breaks apart. Villagers with nothing to do lend a hand
with the work under way, and once a storehouse stands, timber and stone are carried there.

Buildings are raised in order: Tent, Hut, Well, Storehouse, House, Workshop and Watchtower.
Each costs timber and stone and takes several steps of work to finish. When the trees near the
camp are gone, the clearing extends further into the forest. The sky follows your local time.
Villagers with a home go in after dark, and its windows light up while someone is in; the one who
keeps the camp stays by the fire. By day they now and then look in at home, and work that comes in
at night brings someone out of the house.

The wild has ponds in it, and a village with none near digs one once it has a few buildings. While
Claude waits for you, a villager goes fishing: the float bobs, something bites, and the villager
holds up the catch, most often a fish, now and then something else. Work never waits on fishing;
the line comes in when there is a job to do.

The seasons turn with your work rather than the calendar, so a year passes in a few hours of work
and stands still while you are away: blossom in spring, fireflies on summer nights, falling leaves
in autumn, and snow on the roofs and smoke from the chimneys in winter. The season is shown in the
row above the village.

| Spring | Summer | Autumn | Winter |
| --- | --- | --- | --- |
| ![Spring](docs/images/07-spring.png) | ![Summer](docs/images/07-summer.png) | ![Autumn](docs/images/07-autumn.png) | ![Winter](docs/images/07-winter.png) |

Failed tool calls never cost you anything: the village only ever grows.

### Every village is its own

Each village grows a forest of its own and has a colour of its own, which about half its buildings
are raised in. Every building is given its look when it is placed: the colour of its roof, which
way it faces, and something set down beside it, such as barrels, crates or a woodpile. New
buildings go up on either side of the camp, so no two villages are laid out alike.

More styles are found as you work on your projects: other roof colours, and new things to set
beside a building. A toast says when one is found, and it can turn up on any village's next
buildings. `/village stats` and the `/village` pane list the styles found so far; what is still to
be found, and how, is left for your work to turn up.

## Commands

| Command | Description |
| --- | --- |
| `/village` | Open the village pane with resources and activity |
| `/village show` / `/village hide` | Show or hide the band above the prompt |
| `/village stats` | Print the village's resources, your activity, the totals for every project on this device and the styles found |
| `/village settings` | Open the settings panel |
| `/village reset confirm` | Return this project's village to wilderness |

## Settings

The row above the village shows its resources, with a **Settings** button at its right end. Press it,
or run `/village settings`, to open the settings panel. It can also hide or show the village above the prompt. Changes apply at once. The same settings are also in the `/config` menu,
under **workvillage**.

| Setting | Values | Default |
| --- | --- | --- |
| `size` | `small` (7 rows), `medium` (10 rows); both fill the band's width, under the resources row | `small` |
| `palette` | `color`, `grayscale`, `mono`, `mono-light`, `mono-dark` | `color` |
| `pixel` | `small`, `medium`, `large` (see below) | `small` |
| `language` | `auto`, `en`, `zh-TW` | `auto` (follows `LC_ALL`, `LC_MESSAGES` or `LANG`) |
| `animation` | `full`, `reduced`, `off` | `full` |

### Export and import

The settings panel also keeps your villages safe and lets you move them:

- **Copy this village** puts an export code for this project's village on the clipboard.
- **Copy a full backup** copies every village on this device together with its lifetime record.
  A backup names each project's folder, so it can put each village back in place; keep it to
  yourself.
- **Import**: paste a code and press Enter. WorkVillage shows what the code holds and changes
  nothing until you confirm. A village replaces this project's village; a backup replaces the
  villages it holds and the lifetime record.
- **Undo import** puts back whatever the last import replaced.

Where the clipboard is not available, the code is shown in the panel to copy by hand. Importing
needs a text field, so it is available in the terminal and the desktop app. An export code holds
only counts and the village's layout, never file names, contents or commands. Close other Claude
Code sessions of the same project before importing into it: a session still open keeps its own
copy of the village and saves it over the import.

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
root directory, beside one lifetime record for the device: the work of every project added up,
and a short summary of each village.

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

## Support

If you enjoy WorkVillage, you can support its development on Ko-fi. Thank you for helping the village grow!

<a href="https://ko-fi.com/toolmanjimmy" target="_blank"><img height="36" style="border:0px;height:36px;" src="https://storage.ko-fi.com/cdn/kofi2.png?v=6" border="0" alt="Buy Me a Coffee at ko-fi.com" /></a>

## License

[MIT](LICENSE)
