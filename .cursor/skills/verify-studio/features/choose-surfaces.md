# Choose surfaces

Choose surfaces lets a customer restyle the countertop and floor colors. Those colors are suggestions, not Turbo Cabinets products.

## Sub-features

- `surface-counter` presses a countertop swatch and updates the counter name.
- `surface-floor` presses a flooring swatch and updates the floor name.
- `surface-note` keeps the not-a-product note visible.

## How to get to it (user POV)

- Choose a countertop swatch under **Countertop**.
- Choose a flooring swatch under **Flooring**.

## Driving it with control-studio

Preconditions:

- Doctor reports `v1=true`.
- If `#welcome` is visible, complete Measure first through Confirm so the template cards and surfaces are on screen.
- The session is in Interactive 3D or High-quality images.

- **Countertop.** Choose Charcoal. Click the counter swatch that sets `#counter-name` to `Charcoal`. `#scene-canvas` `data-counter` becomes `charcoal` after the kitchen finishes loading.
- **Floor.** Choose Dark walnut. Click the floor swatch that sets `#floor-name` to `Dark walnut`. The canvas `data-floor` becomes `dark-walnut`.
- **Proof.** Run `control-studio browser snapshot --aria --path .cursor/skills/verify-studio/artifacts/choose-surfaces/surfaces.aria.txt` and `control-studio browser screenshot --path .cursor/skills/verify-studio/artifacts/choose-surfaces/surfaces.png`. The names and canvas data attributes match.

## Gotchas

- Surface swatches have no text. Assert `#counter-name` and `#floor-name`.
- The note under the swatches must stay. It is the product-boundary warning.
- Image mode still changes these names. Prove the stack reload by waiting for `#loading` to hide.
