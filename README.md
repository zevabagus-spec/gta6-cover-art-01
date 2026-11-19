# Neon Coast — GTA-style Cover Studio

[![make.fun](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/c/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/zevabagus-spec/gta6-cover-art-01/rank.svg)](https://make.fun/c/gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/zevabagus-spec/gta6-cover-art-01/reward.svg)](https://make.fun/c/gta6-cover-art-01)

An offline web app that turns your photos and a caption into GTA 6-style poster
cover art — multi-panel layouts, a Vice City sunset or neon colour grade, bold
display lettering — and exports it as a PNG to share. Made for the
[make.fun GTA 6 Cover Art competition](https://make.fun/c/gta6-cover-art-01).

## How it works

1. Add your own photos (or load the two free sample photos). Photos never leave
   your machine — everything runs in the browser, offline.
2. Pick one of seven layouts: Nine Panel, Hero + Three, Four Panel, Tilted
   Snapshots, Full Bleed, Split Duo, or Story Strip.
3. Pick one of six colour grades: Vice Sunset, Neon Nights, Golden Hour, Teal
   Noir, Hot Pink, or Mono Chrome.
4. Type the title and subtitle, set the heat meter, then click a panel to select
   it and drag to pan or scroll to zoom that photo. Sliders do the same.
5. Export a PNG in 1080×1080, 1080×1350, or 1920×1080 — one size, or all three
   at once. Undo/redo (Ctrl+Z / Ctrl+Y) covers every change.

The cover engine (`app/src/cover.js`) draws each panel cover-fit with its own
crop and zoom, grades it with a photo filter plus sunset/neon overlay washes,
then inks the panels, adds a halftone title block with gradient Anton lettering
and a glowing Pacifico script subtitle, a heat badge ribbon, a white poster
frame, film grain, and a vignette.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 — no build step, no network request.

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `app/` and `screenshots/` to the output directory and writes
`dossier.json` with the vendored make.fun library.

## Screenshots

`screenshots/` holds four images taken from the app itself: the exported wide
cover first, the editor with photos loaded, then the portrait and square covers
the app exported. The first by name is the cover.

## Originality

All art, lettering, and code here are original. No Rockstar Games logo,
wordmark, artwork, character, or font is used. The display fonts are Anton and
Pacifico, both under the SIL Open Font License (OFL); the license is documented
here rather than shipped as a separate text file. The font files themselves
were downloaded fresh from the google/fonts repository inside this build
session. The two sample photos were made with an image model for make.fun
and are free to use.

## Referral

Built with make.fun — try it with my referral link:
https://make.fun/r/pkrtjm47
