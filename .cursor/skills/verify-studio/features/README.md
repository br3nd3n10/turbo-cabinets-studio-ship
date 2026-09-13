# Turbo Cabinets Studio V1 verification map

This directory is the maintained source for verifying V1 user-facing behavior. Read the index before driving the app, then use the matching feature file as the recipe.

## Baseline preconditions

- Drive `control-studio launch --local` until live V1 HTML includes `#welcome` and `#showroom-ready`.
- Live V1 at `https://turbo-cabinets-studio-v1.vercel.app/` is the old dump until this shell is published.
- Run `.cursor/skills/verify-studio/scripts/control-studio doctor` and require `v1=true`.
- Use the isolated Chrome profile from `control-studio launch`. Do not attach to a human browser.
- Never drive `https://turbo-cabinets-studio.vercel.app/` or `https://turbocabinets.net/studio`. Those are the older production embed.
- Start every recipe from a fresh isolated profile unless its preconditions say otherwise.

## Driving conventions

- Prefer `#id`, `[data-mode]`, `[data-bank]`, `[data-view]`, and accessible names.
- Treat every command as literal.
- Run browser actions through `control-studio browser`.
- Keep proof files under `.cursor/skills/verify-studio/artifacts/`.

## Proof and skip reporting

- Capture the user action and the resulting state, not only the final screen.
- UI proof includes a text snapshot and a screenshot with the Cabinet studio title visible.
- Mutation proof includes a second view of the stored value (`#job-download` enabled, canvas `data-*` attributes, or the downloaded JSON).
- Record the feature ID and entry point with every artifact.
- Report an unreachable path with the attempted command and the unmet precondition.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph. It then uses exactly four H2 sections in this order.

1. `Sub-features`
2. `How to get to it (user POV)`
3. `Driving it with control-studio`
4. `Gotchas`

## Features

- [Showroom first](./showroom-first.md) covers the welcome, picking a look, and hiding shop controls until the customer is ready.
- [Measure the L](./measure-l.md) covers opening Your two walls from the showroom, entering wall lengths, confirming, and landing in Layout.
- [Choose cabinets](./choose-cabinets.md) covers upper and lower style and finish, plus Use on both.
- [Preview modes](./preview-modes.md) covers Interactive 3D, High-quality images, Layout, Kitchen, and Close-up.
- [Save a job](./save-job.md) covers downloading the job JSON after a confirmed tape.
- [Choose surfaces](./choose-surfaces.md) covers countertop and flooring swatches.
