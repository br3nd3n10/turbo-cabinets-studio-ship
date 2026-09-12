# Measure the L

Measure the L lets a customer type the range-wall and sink-wall tape, confirm those numbers, and turn the kitchen into a layout the shop can save.

## Sub-features

- `measure-open` opens Tape the L from Measure and from Layout when no room exists.
- `measure-validate` blocks Continue until both wall lengths are numbers.
- `measure-confirm` echoes the typed tape before it becomes the room.
- `measure-apply` closes the dialog, presses Layout, and enables Save job.

## How to get to it (user POV)

- Choose **Measure**.
- Choose **Layout** before any tape has been confirmed.

## Driving it with control-studio

Preconditions:

- Doctor reports `v1=true` on the isolated V1 session.
- No room is stored in this profile (`#job-download` is disabled).

- **Open from Measure.** Choose **Measure**. Run `control-studio browser click --selector "#measure-open"`. The dialog heading is `Tape the L.` and `#measure-form` is visible.
- **Open from Layout.** Close the dialog if open, then choose **Layout**. Run `control-studio browser click --selector "[data-mode=layout]"`. The same dialog opens because no room exists yet.
- **Reject empty walls.** Choose **Continue** with both length fields empty. Run `control-studio browser click --selector "#measure-continue"`. `#measure-error` reads `Enter a wall length.`
- **Enter tape.** Type `169.5` and `128.25`. Run `control-studio browser fill --selector "#range-length" --value "169.5"` and `control-studio browser fill --selector "#sink-length" --value "128.25"`.
- **Continue.** Choose **Continue**. Run `control-studio browser click --selector "#measure-continue"`. The heading becomes `Confirm the tape.` and `#confirm-length` contains `range 169.5 in` and `sink 128.25 in`.
- **Back.** Choose **Back**. Run `control-studio browser click --selector "#measure-back"`. The form returns with the typed values still present.
- **Confirm.** Continue again, then choose **Confirm**. Run `control-studio browser click --selector "#measure-confirm-btn"`. The dialog closes. `[data-mode=layout]` is pressed. `#job-download` is enabled. `#image-title` contains the wall lengths.
- **Proof.** Run `control-studio browser snapshot --aria --path .cursor/skills/verify-studio/artifacts/measure-l/confirm.aria.txt` and `control-studio browser screenshot --path .cursor/skills/verify-studio/artifacts/measure-l/layout.png`. The artifacts show Layout pressed and the typed tape.

## Gotchas

- **Layout** before a confirmed room is an entry to Measure, not a layout preview.
- `#job-download` stays disabled until Confirm. A filled form is not a saved room.
- Opening names are `range` and `sink`. Typed numbers are inches.
- `Tape numbers own the order.` is a note, not a second confirmation step.
- Headless Chrome often fails the WebGL kitchen. Measure and Save job still work. Prove 3D with headed Chrome or High-quality images.
