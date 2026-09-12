---
name: verify-studio
description: Drive Turbo Cabinets Studio V1 (web kitchen builder) to prove user-facing behavior. Use when verifying Measure L, cabinet choices, preview modes, or Save job on the isolated V1 site, not Noah's live embed.
---

# Verify Studio V1

Drive the isolated V1 kitchen builder the way a customer would. Do not drive Noah's live site.

## Surfaces

Primary surface is the V1 web UI at `https://turbo-cabinets-studio-v1.vercel.app/`.

Noah's production page `https://turbocabinets.net/studio` embeds the older app at `https://turbo-cabinets-studio.vercel.app/`. That embed has no Measure, Layout, or Save job. Doctor fails if those controls are missing.

This repo holds the V1 JS, CSS, and catalog. The V1 HTML shell is `index.html`. Measured GLBs and section images live on the V1 host, not in this git tree.

## Launch

Prefer the live V1 URL. Start an isolated Chrome profile. Do not reuse a human Chrome profile.

```sh
.cursor/skills/verify-studio/scripts/control-studio launch
```

Ready when doctor prints `url=https://turbo-cabinets-studio-v1.vercel.app/` and `v1=true`.

Local overlay is optional when you must exercise uncommitted `index.html`, `studio.js`, or `studio.css` before a V1 deploy. It copies this repo into `/tmp/studio-verify-$RUN_ID`, fetches missing `models/measured-v3` GLBs from the V1 origin, and serves that directory.

```sh
.cursor/skills/verify-studio/scripts/control-studio launch --local
```

Ready when `http://127.0.0.1:<port>/` returns the Cabinet studio page and doctor prints `v1=true`.

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
- `#measure-title` can read `Tape the L.`
- The origin is the V1 host or a local verify directory this run started
- `#load-error` is hidden after the first kitchen load in headed Chrome. Headless Chrome may show `The kitchen could not load` because WebGL is unavailable. Measure and Save job still run.

Refuse to drive `https://turbo-cabinets-studio.vercel.app/` or `https://turbocabinets.net/studio`. Those are the older production embed.

## Drive

Use `control-studio browser`. Prefer IDs, `data-mode`, `data-bank`, `data-view`, and accessible names over coordinates.

```sh
.cursor/skills/verify-studio/scripts/control-studio browser click --selector '#measure-open'
.cursor/skills/verify-studio/scripts/control-studio browser fill --selector '#range-length' --value '169.5'
.cursor/skills/verify-studio/scripts/control-studio browser fill --selector '#sink-length' --value '128.25'
.cursor/skills/verify-studio/scripts/control-studio browser click --selector '#measure-continue'
.cursor/skills/verify-studio/scripts/control-studio browser snapshot --aria --path .cursor/skills/verify-studio/artifacts/measure.aria.txt
.cursor/skills/verify-studio/scripts/control-studio browser screenshot --path .cursor/skills/verify-studio/artifacts/measure.png
```

Read the matching file in `features/` before a proof. A proof that uses one convenient entry point is incomplete when that file lists others.

Clear `localStorage` key `turbo-cabinet-studio-v5` only inside the isolated profile this run started.

## Evidence

Write proof under `.cursor/skills/verify-studio/artifacts/`. Cleanup must not remove that directory.

Proof standards:

- Exercise the real UI path. Do not set `localStorage` and call that a save.
- Capture the action and the resulting state. A final screenshot alone is not enough.
- For Measure L, the confirm dialog must show the typed wall lengths, and after Confirm the Layout control is pressed and `#job-download` is enabled.
- For Save job, observe the downloaded `turbo-job-*.json` in the isolated Chrome download directory.
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
| `doctor` | Read-only V1 health check |
| `browser click --selector <css>` | Click |
| `browser fill --selector <css> --value <text>` | Replace field value |
| `browser press --key <name>` | Send a key |
| `browser snapshot --aria --path <file>` | Accessibility tree |
| `browser screenshot --path <file>` | PNG |
| `stop` | Tear down this run only |

## Feature map

Start at [features/README.md](features/README.md).
