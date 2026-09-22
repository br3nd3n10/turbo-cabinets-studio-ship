# Swap a cabinet

Swap a cabinet lets a customer click one placed box in the assembled kitchen, see the current boxes that fit there, and put one of them in its place. The rest of that run refits.

## Sub-features

- `swap-select` outlines the clicked box and opens Swap this cabinet with its name, wall, bank, and start.
- `swap-candidates` lists the boxes of the same bank that fit the rest of the run and stay out of the blind corner door's swing.
- `swap-apply` replaces the box, refits the rest of that run, and re-renders. Save job carries the new rows.
- `swap-fixed` keeps the blind corner box, its 3 in fillers, and the openings in place.

## How to get to it (user POV)

- Pick a layout, then click a cabinet in the 3D kitchen without dragging.
- Choose another cabinet under **Swap this cabinet**.
- Choose **Done** or click empty floor to clear the selection.

## Driving it with control-studio

Preconditions:

- Doctor reports `v1=true`.
- If `#welcome` is visible, complete Measure first through a template pick (Longer boxes on the 169.5 / 128.25 room with range 30 at 42).

- **Select.** Run `control-studio browser pick --sku SB36 --wall sink --start 27`. It clicks the projected centre of that mesh. `#scene-canvas` `data-selected` reads `sink:27:SB36`. `#swap` is visible and `#swap-title` reads `SB36 · Sink wall base at 27 in`. `#swap-list [data-swap]` lists `SB36`, `BWB18`, `B15-L`, `B12-R`, and `F3-base`.
- **Swap.** Run `control-studio browser click --selector '#swap-list [data-swap="BWB18"]'`. After `#loading` hides, `control-studio browser bounds` lists `sink BWB18 x[0,26.363] z[27,45]`, `sink SB36 z[45,81]`, `sink SB36 z[81,117]`, and still reports `sharedFloor=0 blocked=0 cornerGap=0`. `#swap-title` reads `BWB18 · Sink wall base at 27 in` and `[data-swap="BWB18"]` is pressed.
- **Upper.** Run `control-studio browser pick --sku W3630 --wall range --start 72`, then click `[data-swap="W1230-L"]`. The stove uppers become `W1230-L x[72,84]`, `W3630 x[84,120]`, `W3630 x[120,156]`, `W1230-L x[156,168]`.
- **Fixed pieces.** Run `control-studio browser pick --sku BBC39-L --wall range`. `#swap-note` reads `This piece stays.` and `#swap-list` is empty.
- **Save.** Click `#job-download`. The downloaded `turbo-job-*.json` `layout.rows` carry the swapped rows for both banks and no price fields.
- **Proof.** Screenshot after the swap as `.cursor/skills/verify-studio/artifacts/swap-cabinet/swapped.png` with the outlined box visible.

## Gotchas

- A click through OrbitControls marks the view as `Custom 3D view`. Reset returns to Kitchen. The selection is unaffected.
- `pick` uses a real mouse click at the mesh centre. A box hidden behind another mesh from the current camera may pick the front one. Choose Kitchen view first.
- `W3615` is 29.5 in deep. It is offered past the corner but refused for the first sink upper because it would stand in the blind upper door's swing.
- Swapping never moves the blind corner box or its fillers. `bounds` must keep `cornerGap=0` and `blocked=0` after every swap.
