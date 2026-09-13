# Preview modes

Preview modes let a customer look at the same kitchen as Interactive 3D, High-quality images, or a measured Layout, from Kitchen or Close-up.

## Sub-features

- `mode-interactive` shows the live WebGL kitchen and orbit tools.
- `mode-image` shows stored images and hides orbit tools.
- `mode-layout` shows the placed cabinet boxes after a confirmed tape.
- `view-kitchen` and `view-detail` switch Kitchen and Close-up.

## How to get to it (user POV)

- Choose **Interactive 3D**, **High-quality images**, or **Layout**.
- Choose **Kitchen** or **Close-up**.
- Drag, scroll, or use **+**, **−**, and reset in Interactive 3D.

## Driving it with control-studio

Preconditions:

- Doctor reports `v1=true`.
- Layout proofs first complete Measure the L.

- **Interactive.** Choose **Interactive 3D**. Run `control-studio browser click --selector "[data-mode=interactive]"`. `#mode-caption` reads `Interactive 3D`. `.orbit-tools` is visible. `#live-stage` is visible.
- **Close-up.** Choose **Close-up**. Run `control-studio browser click --selector "[data-view=detail]"`. That button is pressed.
- **Images.** Choose **High-quality images**. Run `control-studio browser click --selector "[data-mode=image]"`. `#mode-caption` reads `High-quality image`. `#image-stack` is visible. `#live-stage` is hidden. `.orbit-tools` is hidden.
- **Layout.** After a confirmed room, choose **Layout**. Run `control-studio browser click --selector "[data-mode=layout]"`. `#mode-caption` reads `Layout`. `#layout-legend` is visible. `.viewbar` is hidden.
- **Proof.** Run `control-studio browser screenshot --path .cursor/skills/verify-studio/artifacts/preview-modes/image.png` in image mode and again in layout mode as `layout.png`. Each file shows the matching `#mode-caption`.

## Gotchas

- Layout without a room opens Measure. That is not a failed Layout control.
- Image mode needs the V1 host's section images. A local overlay that fetched only GLBs cannot prove image mode.
- A custom 3D orbit changes `#mode-caption` to `Custom 3D view`. Reset returns to Kitchen.
