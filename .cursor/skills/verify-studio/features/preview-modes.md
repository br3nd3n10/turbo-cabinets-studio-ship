# Preview modes

Preview modes let a customer look at the same kitchen as Interactive 3D, High-quality images, or a measured Layout, from Kitchen or Close-up.

## Sub-features

- `mode-interactive` shows the live WebGL kitchen and orbit tools.
- `mode-image` shows this assembled kitchen after a template pick, not the old whole-kitchen showroom set. Orbit tools stay hidden.
- `mode-layout` shows the placed cabinet boxes after a confirmed tape.
- `view-kitchen` and `view-detail` switch Kitchen and Close-up.

## How to get to it (user POV)

- Choose **Interactive 3D**, **High-quality images**, or **Layout**.
- Choose **Kitchen** or **Close-up**.
- Drag, scroll, or use **+**, **−**, and reset in Interactive 3D.

## Driving it with control-studio

Preconditions:

- Doctor reports `v1=true`.
- If `#welcome` is visible, complete Measure first through a template pick.
- Layout proofs first complete Measure first. Layout is hidden until a template is picked.

- **Interactive.** Choose **Interactive 3D**. Run `control-studio browser click --selector "[data-mode=interactive]"`. `#mode-caption` reads `Interactive 3D`. `.orbit-tools` is visible. `#live-stage` is visible.
- **Close-up.** Choose **Close-up**. Run `control-studio browser click --selector "[data-view=detail]"`. That button is pressed.
- **Images.** After a template pick, choose **High-quality images**. Run `control-studio browser click --selector "[data-mode=image]"`. `#mode-caption` reads `This kitchen`. `#live-stage` is visible. `#image-stack` stays hidden. `#scene-canvas` `data-preview` is `sku`. `.orbit-tools` is hidden.
- **Layout.** After a confirmed room, choose **Layout**. Run `control-studio browser click --selector "[data-mode=layout]"`. `#mode-caption` reads `Layout`. `#layout-legend` is visible. `.viewbar` is hidden.
- **Proof.** Run `control-studio browser screenshot --path .cursor/skills/verify-studio/artifacts/preview-modes/image.png` in image mode and again in layout mode as `layout.png`. Each file shows the matching `#mode-caption`.

## Gotchas

- Layout stays hidden until a room exists. Clicking it before Confirm is not a customer path.
- After a pick, image mode is a still of the assembled SKU kitchen. It must not show the old measured-v3 showroom stack.
- A custom 3D orbit changes `#mode-caption` to `Custom 3D view`. Reset returns to Kitchen.
