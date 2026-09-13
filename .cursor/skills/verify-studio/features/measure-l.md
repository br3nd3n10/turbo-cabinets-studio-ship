# Measure the L

Measure the L lets a customer type the stove-wall and sink-wall lengths, confirm those numbers, and turn the kitchen into a layout the shop can save.

## Sub-features

- `showroom-ready` opens Your two walls after the customer likes a look.
- `measure-validate` blocks Continue until both wall lengths are numbers.
- `measure-confirm` echoes the typed lengths before they become the room.
- `measure-apply` closes the dialog, presses Layout, and enables Save job.

## How to get to it (user POV)

- From the showroom, choose **I like this. Add my room sizes**.
- After Confirm, choose **Room sizes** to change the walls.

## Driving it with control-studio

Preconditions:

- Doctor reports `v1=true` on the isolated V1 session or a local overlay.
- No room is stored in this profile (`#job-download` is disabled).
- If `#welcome` is visible, choose **Browse looks** first. Run `control-studio browser click --selector "#welcome-enter"`.

- **Open from the showroom.** Choose **I like this. Add my room sizes**. Run `control-studio browser click --selector "#showroom-ready"`. The dialog heading is `Your two walls.` and `#measure-form` is visible.
- **Reject empty walls.** Choose **Continue** with both length fields empty. Run `control-studio browser click --selector "#measure-continue"`. `#measure-error` reads `Enter a wall length.`
- **Enter tape.** Type `169.5` and `128.25`. Run `control-studio browser fill --selector "#range-length" --value "169.5"` and `control-studio browser fill --selector "#sink-length" --value "128.25"`.
- **Continue.** Choose **Continue**. Run `control-studio browser click --selector "#measure-continue"`. The heading becomes `Check these lengths.` and `#confirm-length` contains `Stove wall 169.5 in` and `Sink wall 128.25 in`.
- **Back.** Choose **Back**. Run `control-studio browser click --selector "#measure-back"`. The form returns with the typed values still present.
- **Confirm.** Continue again, then choose **Confirm**. Run `control-studio browser click --selector "#measure-confirm-btn"`. The dialog closes. `[data-mode=layout]` is pressed. `#job-download` is enabled. `#image-title` contains the wall lengths.
- **Proof.** Run `control-studio browser snapshot --aria --path .cursor/skills/verify-studio/artifacts/measure-l/confirm.aria.txt` and `control-studio browser screenshot --path .cursor/skills/verify-studio/artifacts/measure-l/layout.png`. The artifacts show Layout pressed and the typed tape.

## Gotchas

- Live V1 that still says `Tape the L.` has not received this shell. Use `--local` until that HTML ships.
- `control-studio browser click` calls the element's `click()`, so a hidden `#measure-open` still opens the dialog. Use `#showroom-ready` on a fresh profile.
- Layout stays hidden until Confirm. It is no longer an entry to Measure.
- `#job-download` stays disabled until Confirm. A filled form is not a saved room.
- Opening names in the job file stay `range` and `sink`. The form labels say stove wall and sink wall.
- Headless Chrome often fails the WebGL kitchen. Measure and Save job still work. Prove 3D with headed Chrome or High-quality images.
