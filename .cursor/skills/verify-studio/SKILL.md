---
name: verify-studio
description: Drive Turbo Cabinets Studio V1 (web kitchen builder) to prove user-facing behavior. Use when verifying the measurement-first flow, welcome, two wall lengths, kitchen templates, cabinet choices, preview modes, or Save job on the isolated V1 site, not Noah's live embed.
---

# Verify Studio V1

Drive the isolated V1 kitchen builder the way a customer would. Do not drive Noah's live site.

V1 starts with a tape. A welcome explains the job, then the customer measures both walls and openings, confirms, picks a layout that solves that room from current inventory, then keeps swapping cabinets. Door style and color stay available. Layout templates stay hidden until Confirm. Layout, Room sizes, and Save job stay in the DOM. They stay hidden until a template is picked, or they appear immediately when a room and a picked layout already exist.

## Surfaces

Primary surface is live V1 at `https://turbo-cabinets-studio-v1.vercel.app/`. That host is measurement-first. Models stay on the V1 origin. JS and CSS load from the ship repo pin.

Noah's production page `https://turbocabinets.net/studio` embeds the older app at `https://turbo-cabinets-studio.vercel.app/`. That embed has no Measure, Layout, or Save job. Doctor fails if those controls are missing.

This repo holds the V1 JS, CSS, catalog, `showroom.js` phase machine, `pack.js` wall packer, `templates.js` layout cards, `kitchen.js` SKU assembler, and `models/sku-v1` meshes. The V1 HTML shell is `index.html`. Live V1 pins JS/CSS from this repo and rewrites `/models/sku-v1` to that pin. Measured-v3 GLBs and section images stay on the original V1 host.

## Launch

Prefer the live V1 URL. Start an isolated Chrome profile. Do not reuse a human Chrome profile.

```sh
.cursor/skills/verify-studio/scripts/control-studio launch
```

Ready when doctor prints `url=https://turbo-cabinets-studio-v1.vercel.app/`, `v1=true`, and `phase=welcome`.

Local overlay is for uncommitted `index.html`, `showroom.js`, `templates.js`, `kitchen.js`, `pack.js`, or `studio.css` before a V1 deploy. It copies this repo into `/tmp/studio-verify-$RUN_ID`, fetches missing `models/measured-v3` GLBs from the V1 origin, copies local `models/sku-v1` when present, and serves that directory.

```sh
.cursor/skills/verify-studio/scripts/control-studio launch --local
```

Ready when `http://127.0.0.1:<port>/` returns the Cabinet studio page and doctor prints `v1=true` and `phase=welcome`.

Teardown:

```sh
.cursor/skills/verify-studio/scripts/control-studio stop
```

Stop kills only the Chrome profile and local server this run started. It does not delete evidence.

## Doctor

Run this first whenever anything looks off.

```sh
.cursor/skills/verify-studio/scripts/control-studio doctor
```

Doctor is worth driving only when all of these hold:

- The page title is `Cabinet studio · Turbo Cabinets`
- `#measure-open`, `[data-mode=layout]`, and `#job-download` exist
- The page has `#welcome` and `#template-list`
- `#measure-title` reads `Your two walls.`
- A fresh profile starts at `phase=welcome`
- The origin is the V1 host or a local verify directory this run started
- `#load-error` is hidden after the first kitchen load. Headless Chrome uses SwiftShader so assembled SKU meshes can render.

Refuse to drive `https://turbo-cabinets-studio.vercel.app/` or `https://turbocabinets.net/studio`. Those are the older production embed.

## Drive

Use `control-studio browser`. Prefer IDs, `data-mode`, `data-bank`, `data-view`, and accessible names over coordinates.

Clicks use the element's own `click()`. That still fires when CSS hides a node. Do not open Room sizes from `#measure-open` during `welcome`. Use `#welcome-enter`. Do not open `#template-list` before Confirm.

Customer path on a fresh profile:

1. Read the welcome. Heading is `Tape both walls first. We'll show kitchens that fit.`
2. Choose **Tape my kitchen** (`#welcome-enter`). Phase becomes `sizing`. `#measure` opens. Layout, Save job, and `#template-list` are not shown.
3. Type the stove wall and the sink wall. Add openings if the recipe needs them. Confirm.
4. Phase becomes `templates`. A few layout cards are visible. Layout and Save job stay hidden.
5. Choose one card (`#template-list [data-template]`). Phase becomes `ready`. Interactive 3D is pressed. `#scene-canvas` `data-preview` is `sku`. `#job-download` is enabled.
6. Keep swapping cabinets from the other cards, or change door style and color. The assembled kitchen updates. High-quality images show this kitchen, not the old showroom set.

```sh
.cursor/skills/verify-studio/scripts/control-studio browser click --selector '#welcome-enter'
.cursor/skills/verify-studio/scripts/control-studio browser fill --selector '#range-length' --value '169.5'
.cursor/skills/verify-studio/scripts/control-studio browser fill --selector '#sink-length' --value '128.25'
.cursor/skills/verify-studio/scripts/control-studio browser click --selector '#measure-continue'
.cursor/skills/verify-studio/scripts/control-studio browser click --selector '#measure-confirm-btn'
.cursor/skills/verify-studio/scripts/control-studio browser click --selector '#template-list [data-template="longer"]'
.cursor/skills/verify-studio/scripts/control-studio browser snapshot --aria --path .cursor/skills/verify-studio/artifacts/measure.aria.txt
.cursor/skills/verify-studio/scripts/control-studio browser screenshot --path .cursor/skills/verify-studio/artifacts/measure.png
```

Read the matching file in `features/` before a proof. Start with [measure-first](features/measure-first.md), then [measure-l](features/measure-l.md). A proof that uses one convenient entry point is incomplete when that file lists others.

Clear `localStorage` key `turbo-cabinet-studio-v5` only inside the isolated profile this run started. A stored room without a picked template starts in `templates`. A stored room plus `sessionStorage` `turbo-studio-template` starts in `ready`.

## Evidence

Write proof under `.cursor/skills/verify-studio/artifacts/`. Cleanup must not remove that directory.

Proof standards:

- Exercise the real UI path. Do not set `localStorage` and call that a save.
- Capture the action and the resulting state. A final screenshot alone is not enough.
- For Measure first, the welcome heading is visible, then after Tape my kitchen `#measure` is open and `#template-list` is not shown. After Confirm the cards are visible. After a pick, Interactive 3D is pressed, `#scene-canvas` `data-preview` is `sku`, and `#job-download` is enabled.
- For Measure L, the confirm dialog must show `Stove wall 169.5 in` and `Sink wall 128.25 in`.
- For Save job, observe the downloaded `turbo-job-*.json` in the isolated Chrome download directory. Wall ids in that file stay `range` and `sink`. The file has `room` and `layout` and no prices.
- For a finish or door-style change, `#scene-canvas` `data-upper-style` / `data-lower-style` and `data-*-finish` must match the controls. Swapping a template card must change `data-layout-skus`.
- After a pick, High-quality images are a still of this assembled kitchen. `#mode-caption` reads `This kitchen`. `#live-stage` stays visible. `#image-stack` stays hidden. `#scene-canvas` `data-preview` is `sku`.
- After a pick, `control-studio browser bounds` prints every placed mesh's world bounds in inches and exits non-zero when two meshes at the same height share floor. `stacked` counts uppers over bases, which is expected. The sink return starts at 27 in for bases and 15 in for uppers, past the range wall's corner box and a 3 in filler. `node pack.test.js` checks the same rule on the packer without a browser.

## Cleanup

```sh
.cursor/skills/verify-studio/scripts/control-studio stop
```

Removes `/tmp/studio-verify-$RUN_ID` overlay files and the isolated Chrome user-data dir. Leaves `.cursor/skills/verify-studio/artifacts/`.

Never `pkill chrome` or `pkill python`. Kill the PIDs recorded in the run's instance file.

## Helpers

`.cursor/skills/verify-studio/scripts/control-studio` is executable.

| Command | What it does |
| --- | --- |
| `launch` | Isolated Chrome on live V1 |
| `launch --local` | Local overlay server plus isolated Chrome |
| `doctor` | Read-only V1 health check, including `phase` and `welcome` |
| `browser click --selector <css>` | Click via the element's `click()` |
| `browser fill --selector <css>` | Replace field value via input and change events |
| `browser press --key <name>` | Send a key |
| `browser snapshot --aria --path <file>` | Page text |
| `browser screenshot --path <file>` | PNG |
| `browser bounds [--path <file>]` | World bounds of each placed SKU mesh in inches, fails when meshes share floor |
| `stop` | Tear down this run only |

## Feature map

Start at [features/README.md](features/README.md).
