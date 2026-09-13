# Choose cabinets

Choose cabinets lets a customer pick a door style and finish for the upper run, the lower run, or both.

## Sub-features

- `cabinet-bank` switches the editor between Upper cabinets and Lower cabinets.
- `cabinet-style` changes the door family for the active bank.
- `cabinet-finish` presses a finish swatch for the active style.
- `cabinet-match` copies the active style and finish onto the other bank.

## How to get to it (user POV)

- Choose **Upper cabinets** or **Lower cabinets**.
- Change the **Upper door style** or **Lower door style** list.
- Choose a finish swatch under the finish heading.
- Choose **Use on both**.

## Driving it with control-studio

Preconditions:

- Doctor reports `v1=true`.
- If `#welcome` is visible, choose **Browse looks** first.
- The session is in Interactive 3D.

- **Select lower bank.** Choose **Lower cabinets**. Run `control-studio browser click --selector "[data-bank=lower]"`. `#style-label` reads `Lower door style`.
- **Change style.** Choose Slim Shaker. Run `control-studio browser fill --selector "#style" --value "slim-shaker"`. `#lower-summary` includes `Slim Shaker`.
- **Change finish.** Choose Urban Green. Run `control-studio browser click --selector "#finishes [aria-pressed=false][style*='4b5745']"` only if that swatch is Urban Green. Prefer clicking the swatch whose accessible name or following `#finish-name` becomes `Urban Green`.
- **Match both.** Choose **Use on both**. Run `control-studio browser click --selector "#match-both"`. `#upper-summary` and `#lower-summary` show the same style and finish.
- **Proof.** Wait until `#scene-canvas[data-ready=true]`. Run `control-studio browser snapshot --aria --path .cursor/skills/verify-studio/artifacts/choose-cabinets/both.aria.txt` and `control-studio browser screenshot --path .cursor/skills/verify-studio/artifacts/choose-cabinets/both.png`. The canvas `data-upper-style` and `data-lower-style` match.

## Gotchas

- Style options refill when the bank changes. Read `#style-label` before picking a value.
- **Use on both** copies only the active bank. It does not copy countertop or floor.
- Finish swatches are unlabeled color buttons. Assert `#finish-name` and the canvas `data-*-finish` attributes, not the swatch index.
- The kitchen GLB can take several seconds. Wait for `#loading` to hide and `#load-error` to stay hidden.
