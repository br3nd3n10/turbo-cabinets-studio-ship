# Preview

The picked layout is the kitchen. 3D is the only view. A customer looks at it from Kitchen or Close-up, orbits it, and saves a still of it.

## Sub-features

- `view-kitchen` and `view-detail` switch Kitchen and Close-up.
- `orbit` drags, scrolls, and uses **+**, **−**, and reset.
- `save-view` downloads a PNG still of this kitchen from **Save view ↓**.

## How to get to it (user POV)

- Choose **Kitchen** or **Close-up**.
- Drag, scroll, or use **+**, **−**, and reset.
- Choose **Save view ↓** for a still.

## Driving it with control-studio

Preconditions:

- Doctor reports `v1=true`.
- If `#welcome` is visible, complete Measure first through a template pick.

- **Close-up.** Choose **Close-up**. Run `control-studio browser click --selector "[data-view=detail]"`. That button is pressed. `#mode-caption` still reads `Interactive 3D`.
- **Kitchen.** Choose **Kitchen**. Run `control-studio browser click --selector "[data-view=kitchen]"`. That button is pressed.
- **Still.** Choose **Save view ↓**. Run `control-studio browser click --selector "#download"`. `#snapshot` opens with `#snapshot-image` set and a `Download PNG ↓` link.
- **Proof.** Run `control-studio browser screenshot --path .cursor/skills/verify-studio/artifacts/preview-modes/close-up.png` in Close-up. `.viewbar` shows Kitchen, Close-up, Room sizes, Save view, and Save job, and no preview mode row above it.

## Gotchas

- There is no Interactive 3D, High-quality images, or Layout control. `[data-mode]` must not exist in the page. Doctor fails when it does.
- `#scene-canvas` `data-preview` stays `sku` after a pick. Layout boxes are gone.
- A custom 3D orbit changes `#mode-caption` to `Custom 3D view`. Reset returns to Kitchen.
- A profile that stored an older `mode` of `image` or `layout` is pinned back to `interactive` on load.
