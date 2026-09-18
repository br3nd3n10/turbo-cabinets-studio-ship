---
name: verify-studio
description: Drive Turbo Cabinets Studio V1 (web kitchen builder) to prove user-facing behavior. Use when verifying the showroom-first flow, welcome, cabinet choices, two wall lengths, preview modes, or Save job on the isolated V1 site, not Noah's live embed.
---

# Verify Studio V1

Drive the isolated V1 kitchen builder the way a customer would. Do not drive Noah's live site.

V1 starts in a showroom. A welcome explains the job, then the customer picks a look, then adds two wall lengths, then sends the job. Layout, Room sizes, and Save job stay in the DOM. They stay hidden until Confirm, or they appear immediately when a room already exists.

## Surfaces

Primary surface is live V1 at `https://turbo-cabinets-studio-v1.vercel.app/`. That host is showroom-first. Models stay on the V1 origin. JS and CSS load from the ship repo pin.

Noah's production page `https://turbocabinets.net/studio` embeds the older app at `https://turbo-cabinets-studio.vercel.app/`. That embed has no Measure, Layout, or Save job. Doctor fails if those controls are missing.

This repo holds the V1 JS, CSS, catalog, and `showroom.js` phase machine. The V1 HTML shell is `index.html`. Measured GLBs and section images live on the V1 host, not in this git tree.

## Launch

Prefer the live V1 URL. Start an isolated Chrome profile. Do not reuse a human Chrome profile.

```sh
.cursor/skills/verify-studio/scripts/control-studio launch
```

Ready when doctor prints `url=https://turbo-cabinets-studio-v1.vercel.app/`, `v1=true`, and `phase=welcome`.

Local overlay is for uncommitted `index.html`, `showroom.js`, or `studio.css` before a V1 deploy. It copies this repo into `/tmp/studio-verify-$RUN_ID`, fetches missing `models/measured-v3` GLBs from the V1 origin, and serves that directory.

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
- The page has `#welcome` and `#showroom-ready`
- `#measure-title` reads `Your two walls.`
- A fresh profile starts at `phase=welcome`
- The origin is the V1 host or a local verify directory this run started
- `#load-error` is hidden after the first kitchen load in headed Chrome. Headless Chrome may show `The kitchen could not load` because WebGL is unavailable. Measure and Save job still run.

Refuse to drive `https://turbo-cabinets-studio.vercel.app/` or `https://turbocabinets.net/studio`. Those are the older production embed.

## Drive

Use `control-studio browser`. Prefer IDs, `data-mode`, `data-bank`, `data-view`, and accessible names over coordinates.

Clicks use the element's own `click()`. That still fires when CSS hides a node. Do not open Room sizes from `#measure-open` during `showroom`. Use `#showroom-ready`.

Customer path on a fresh profile:

1. Read the welcome. Heading is `Find a look first. We'll fit it to your room after.`
2. Choose **Browse looks** (`#welcome-enter`). Phase becomes `showroom`. Layout, Room sizes, and Save job are not shown.
3. Pick a look if the recipe needs one.
4. Choose **I like this. Add my room sizes** (`#showroom-ready`). `#measure-title` reads `Your two walls.`
5. Type the stove wall and the sink wall. Confirm. Phase becomes `ready`. Layout is pressed. `#job-download` is enabled.

```sh
.cursor/skills/verify-studio/scripts/control-studio browser click --selector '#welcome-enter'
.cursor/skills/verify-studio/scripts/control-studio browser click --selector '#showroom-ready'
.cursor/skills/verify-studio/scripts/control-studio browser fill --selector '#range-length' --value '169.5'
.cursor/skills/verify-studio/scripts/control-studio browser fill --selector '#sink-length' --value '128.25'
.cursor/skills/verify-studio/scripts/control-studio browser click --selector '#measure-continue'
.cursor/skills/verify-studio/scripts/control-studio browser click --selector '#measure-confirm-btn'
.cursor/skills/verify-studio/scripts/control-studio browser snapshot --aria --path .cursor/skills/verify-studio/artifacts/measure.aria.txt
.cursor/skills/verify-studio/scripts/control-studio browser screenshot --path .cursor/skills/verify-studio/artifacts/measure.png
```

Read the matching file in `features/` before a proof. Start with [showroom-first](features/showroom-first.md), then [measure-l](features/measure-l.md). A proof that uses one convenient entry point is incomplete when that file lists others.

Clear `localStorage` key `turbo-cabinet-studio-v5` only inside the isolated profile this run started. A stored room skips welcome and starts in `ready`.

## Evidence

Write proof under `.cursor/skills/verify-studio/artifacts/`. Cleanup must not remove that directory.

Proof standards:

- Exercise the real UI path. Do not set `localStorage` and call that a save.
- Capture the action and the resulting state. A final screenshot alone is not enough.
- For Showroom first, the welcome heading is visible, then after Browse looks `#showroom-ready` is visible and Layout / Room sizes / Save job are not.
- For Measure L, the confirm dialog must show `Stove wall 169.5 in` and `Sink wall 128.25 in`, and after Confirm the Layout control is pressed and `#job-download` is enabled.
- For Save job, observe the downloaded `turbo-job-*.json` in the isolated Chrome download directory. Wall ids in that file stay `range` and `sink`.
- For a finish change, the pressed swatch name and `#scene-canvas` `data-upper-finish` or `data-lower-finish` must match.
- High-quality images skip WebGL. Prove image mode by `#image-stack` becoming visible and `#live-stage` hidden.

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
| `browser fill --selector <css> --value <text>` | Replace field value via input and change events |
| `browser press --key <name>` | Send a key |
| `browser snapshot --aria --path <file>` | Page text |
| `browser screenshot --path <file>` | PNG |
| `stop` | Tear down this run only |

## Feature map

Start at [features/README.md](features/README.md).
