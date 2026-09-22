# Measure first

Measure first lets a customer tape both walls and openings, confirm that room, then pick one of a few inventory layouts that solve it. Templates stay hidden until Confirm.

## Sub-features

- `welcome` explains the tape, the openings, the layout pick, and send before any catalog.
- `sizing` opens Your two walls from **Tape my kitchen** and keeps layout cards hidden.
- `templates` shows a few solved layouts only after Confirm.
- `ready` applies the picked run, reveals Layout and Save job, and keeps door style and color available.

## How to get to it (user POV)

- Land on a fresh V1 session and read the welcome.
- Choose **Tape my kitchen**.
- Type both walls, add openings, then Confirm.
- Pick one of the kitchens that fit.

## Driving it with control-studio

Preconditions:

- Doctor reports `v1=true` on live V1 or a local overlay.
- No room is stored in this profile (`#job-download` is disabled).

- **Welcome.** The first screen heading is `Tape both walls first. We'll show kitchens that fit.` `#welcome` is visible. `#template-list` is not shown.
- **Open sizes.** Choose **Tape my kitchen**. Run `control-studio browser click --selector "#welcome-enter"`. `body` `data-phase` is `sizing`. `#measure` is open. `#measure-title` reads `Your two walls.` `#template-list` is not shown. `[data-mode=layout]` and `#job-download` are not shown.
- **Confirm the room.** Type `169.5` and `128.25`, Continue, then Confirm. Phase becomes `templates`. `#templates` is visible. At least two `[data-template]` cards list stove-wall and sink-wall SKUs from current inventory.
- **Pick a layout.** Choose **Longer boxes**. Run `control-studio browser click --selector "#template-list [data-template=longer]"`. `body` `data-phase` is `ready`. That card is pressed. `[data-mode=interactive]` is pressed. `#scene-canvas` `data-preview` is `sku`. `#job-download` is enabled.
- **Proof.** Snapshot welcome, sizing (no cards), templates (cards, no Layout), and ready (assembled SKU kitchen) under `.cursor/skills/verify-studio/artifacts/measure-first/`.
- **Floor.** After the pick, run `control-studio browser bounds --path .cursor/skills/verify-studio/artifacts/measure-first/bounds.json`. It exits 0 with `sharedFloor=0`. The first sink base starts at `z[27,...]` and the first sink upper at `z[15,...]`, past the range wall's corner box.

## Gotchas

- Live V1 at `https://turbo-cabinets-studio-v1.vercel.app/` is the measurement-first host. Do not drive Noah's embed.
- A stored room without a picked template starts in `templates`.
- `#measure-open` stays in the DOM while hidden. `control-studio browser click` still fires it. Do not use that entry during `welcome`.
- Do not show or click `#template-list` before Confirm. The list exists in the DOM and stays hidden.
- Door style and color stay on the page after the welcome. They are not a substitute for picking a layout.
- The sink wall is taped from the inside corner. Its cards list fewer boxes than the wall length suggests because the first 27 in belong to the range wall's corner box and a 3 in filler.
