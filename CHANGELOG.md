# Changelog

## Unreleased

- Buildings go where they suit: the plot beside the fire is kept free as the village square until
  the fountain stands there, in the middle of the village; the watchtower goes up on the outer edge
  facing the forest; new fields are broken on the outskirts; the rest are built near the fire as
  before. Villages whose square is already taken build the fountain on the nearest open ground.
- The rooster now comes once the village is a hamlet, wandering in from the edge of the clearing,
  instead of being there from the first camp.
- No more than twenty villagers live in a village, and a house now homes two instead of three, so the
  band never crowds; villagers already living there stay. By day each villager rests and wanders
  near its own home rather than all round the fire.
- Street lamps are now built by the villagers rather than appearing on their own. Once the village
  is a hamlet, while timber and stone are saved for the next building, a villager now and then puts
  up a lamp for a little timber and stone, on the same edges as before. Lamps are kept with the
  village; villages from before start without any and build them in time.
- A village builds one small fountain, as its next building once it has six. Its water plays by day
  and freezes in winter. Villages that already have six buildings build theirs next. The fixed
  building order otherwise carries on where it was.

## 0.3.2 - 2026-10-20

- Dozing is now an occasional thing each villager does on their own, rather than the whole village
  falling asleep at once. A villager at rest may doze off where it sits or go home for a nap, more
  often the longer things stay quiet, but never more than half the village at a time; each wakes on
  their own after a while, and work wakes whoever is dozing with a start. The rooster dozes in the
  sun now and then too.
- Nights are ordinary sleep: villagers with a home go to bed, with a Z over the roof, rising in the
  morning each in their own time. Now and then one gets up for a walk in the night before going back
  to bed.
- Street lamps go up along the village once it is a hamlet, on every third edge between settled
  plots, and light up after dark with a pool of warm light. Night walks lead to them.
- The README covers installing in the desktop app and keeping WorkVillage updated, including turning
  on auto-update, and notes that installing from a shell with `--marketplace` needs Claude Code
  2.1.292 or later.

## 0.3.1 - 2026-10-20

- Events: now and then something happens in the village on its own.
  - A bug may crawl out of the forest and scuttle about until the villagers catch it, which brings a
    little knowledge. Nothing is ever lost to a bug.
  - A villager may set out on an errand, walk out of sight and come back later with a sack of timber
    and stone, or empty-handed if the errand came to nothing.
  - After a long quiet the villagers go home for a nap, with a Z drifting up over the roof, while
    the one who keeps the camp dozes by the fire. The next work wakes the village: the nappers come
    out and everyone springs up. After dark they sleep on.
- Open ground grows low shrubs (one with berries), short weeds and small flowers in five colours,
  picked by where they grow, and wisps of weed and the odd flower dot the grass between trees and
  rocks. Flowers are plentiful in spring and few in autumn, shrubs turn with the seasons like the
  trees, and in winter only the snow-capped shrubs show.
- The village keeps a rooster. It scratches about the camp by day, pecking at the ground, dozes when
  the village does, sleeps by the fire at night, and crows when night turns to day.

## 0.3.0 - 2026-10-20

- Villagers see each job through. Felling a tree takes many blows, with chips of wood flying, then
  the tree falls away from the axe and is cut to length; a boulder is struck until it cracks and then
  broken up. Work speeds up while jobs queue, so the scene keeps pace with a busy session.
- Villagers with nothing to do lend a hand: two fell a tree, up to three raise a building or bring in
  a harvest. A helper carries the timber home, and a villager walking back empty-handed takes the next
  job straight away instead of first returning to the fire. Once a storehouse stands, timber and
  stone are carried there.
- Villagers go in and out of their homes. After dark those with a home walk to its door, open it and
  go in, and its windows light up only while someone is in; the one who keeps the camp stays by the
  fire. By day they now and then look in at home, and they come out in the morning, or at once when
  work comes in at night.
- Ponds and fishing. The wild has ponds in it, frozen over in winter, and a village with none near
  digs one where it clears a stump once it has a few buildings. In quiet moments a villager goes
  fishing for a little food: the float bobs, something bites, and the catch is held up, most often a
  fish. Work never waits on fishing; the line comes in for it.
- The seasons turn with the work done rather than the calendar, so a year passes in a few hours of
  work and stands still while nobody works. Spring brings blossom and drifting petals, summer lush
  grass and fireflies at night, autumn golden fields and falling leaves, and winter snow on the
  ground and roofs, falling snow and smoke from the chimneys. The row above the village names the
  season.
- Every village is its own. Each grows a forest of its own and has a colour of its own; every
  building is given a look when it is placed (its roof colour, which way it faces, and barrels, crates
  or a woodpile beside it), and new buildings go up on either side of the camp. Buildings raised
  before this release are given looks too.
- More styles are found through work on every project on the device: other roof colours, and new
  things to set beside a building. A toast says when one is found, and it can turn up on any
  village's next buildings. `/village stats` and the `/village` pane list the styles found so far
  and count those still to find, without saying how; they are left for work to turn up.
- A lifetime record now adds up the work of every project on the device. `/village stats` shows it
  under the project's own counts, and resetting a village keeps the work it recorded. On a device
  with villages already, the record starts from their work, so styles that work has earned are found
  at once.
- The settings panel can export and import villages. **Copy this village** copies an export code
  for this project's village, and **Copy a full backup** one for every village on the device; where
  the clipboard is not available the code is shown to copy by hand. A pasted code is checked and
  previewed, and changes nothing until it is confirmed; **Undo import** puts back what it replaced.
- The README describes the village growing with the work as a whole instead of listing which kind of
  work does what, so nothing invites doing work for the village's sake.
- Saved villages are now checked field by field when they load, so a damaged save or a malformed
  code is refused instead of drawn.
- Fixed: when the clearing grew on the left, jobs already waiting could be worked on the wrong plot.

## 0.2.8 - 2026-10-15

- Fixed: on the desktop the **Settings** button flickered with the scene's animation. The scene now
  holds still while the pointer rests on the button (the button is drawn by a small client module
  that reports the pointer entering and leaving it); a plain button stands in where a surface cannot
  run that module.

## 0.2.7 - 2026-10-14

- Fixed: a choice in the settings pane could snap back and not take effect. Choices now apply at once
  and hold for the session even before (or without) the engine storing them; a failure to store one is
  reported in a toast.
- Fixed: the settings pane could still flicker on the desktop. The scene now holds still while the
  settings pane is open, and the pane redraws only when a choice is made. A **Done** button closes it.

## 0.2.6 - 2026-10-14

- Reading and thinking now grow the village. A read sends a villager to read by the fire, and a
  response in which Claude thought first (or a task handed to a subagent) has one ponder there, with
  a spark of an idea. Both add knowledge, and every 4 knowledge becomes a planned step on the
  building under way. `/village stats` counts thoughts.
- The resources now sit on a row above the village at every size, with a **Settings** button at its
  right end. The `link` setting, the WorkVillage bar pane and the hint-line link are removed.
- Fixed: the settings pane flickered on the desktop. The scene's animation redrew everything the
  plugin drew; it now redraws only the scene.

## 0.2.5 - 2026-10-14

- Fixed: after changing a setting such as the pixel size, the village could vanish until
  `/village show`. A draw that reaches the reloaded module before `session.start` now starts it.
- The scene fills the band's whole width at every size, instead of stopping at 120 columns and
  leaving room on the right; the wilderness simply carries on. On the desktop it fills up to 640 scene
  pixels and is centred beyond that.
- The **Settings** link now has a small pane of its own by default (`link: panel`), a frame apart
  from the village, with a button to hide or show the village. Closing that pane keeps it closed for
  the session. The hint line under the prompt (`hint`) is drawn by terminals only; the Claude Code
  desktop app does not show it.
- SVG output is about three times smaller (one path per colour), which makes room for wider scenes.

## 0.2.4 - 2026-10-14

- The **WorkVillage Settings** link now sits at the end of the hint line under the prompt by default,
  outside the village's block (`link: hint`). It steps aside while you type or while a turn runs, and
  `link` can still put it above or below the village.

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
