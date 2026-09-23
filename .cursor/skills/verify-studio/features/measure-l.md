# Measure the L

Measure the L lets a customer type the stove-wall and sink-wall lengths, confirm those numbers, and unlock layouts that fit that room.

## Sub-features

- `welcome-enter` opens Your two walls from **Tape my kitchen**.
- `measure-validate` blocks Continue until both wall lengths are numbers.
- `measure-confirm` echoes the typed lengths before they become the room.
- `measure-apply` closes the dialog and shows inventory layouts.

## How to get to it (user POV)

- From the welcome, choose **Tape my kitchen**.
- After Confirm, choose **Room sizes** in the view bar to change the walls.

## Driving it with control-studio

Preconditions:

- Doctor reports `v1=true` on the isolated V1 session or a local overlay.
- No room is stored in this profile (`#job-download` is disabled).
- If `#welcome` is visible, choose **Tape my kitchen** first. Run `control-studio browser click --selector "#welcome-enter"`.

- **Open from the welcome.** Choose **Tape my kitchen**. Run `control-studio browser click --selector "#welcome-enter"`. The dialog heading is `Your two walls.` and `#measure-form` is visible. `#template-list` is not shown.
- **Reject empty walls.** Choose **Continue** with both length fields empty. Run `control-studio browser click --selector "#measure-continue"`. `#measure-error` reads `Enter a wall length.`
- **Enter tape.** Type `169.5` and `128.25`. Run `control-studio browser fill --selector "#range-length" --value "169.5"` and `control-studio browser fill --selector "#sink-length" --value "128.25"`.
- **Continue.** Choose **Continue**. Run `control-studio browser click --selector "#measure-continue"`. The heading becomes `Check these lengths.` and `#confirm-length` contains `Stove wall 169.5 in` and `Sink wall 128.25 in`.
- **Back.** Choose **Back**. Run `control-studio browser click --selector "#measure-back"`. The form returns with the typed values still present.
- **Confirm.** Continue again, then choose **Confirm**. Run `control-studio browser click --selector "#measure-confirm-btn"`. The dialog closes. `body` `data-phase` is `templates`. `#template-list [data-template]` cards are visible. `#job-download` is not shown.
- **Proof.** Run `control-studio browser snapshot --aria --path .cursor/skills/verify-studio/artifacts/measure-l/confirm.aria.txt` and `control-studio browser screenshot --path .cursor/skills/verify-studio/artifacts/measure-l/templates.png`. The artifacts show the solved-layout cards.

## Gotchas

- Live V1 is measurement-first. The heading is `Your two walls.`, not `Tape the L.`
- `control-studio browser click` calls the element's `click()`, so a hidden `#measure-open` still opens the dialog. Use `#welcome-enter` on a fresh profile.
- `#job-download` stays disabled until a template is picked. A filled form is not a saved layout.
- Opening names in the job file stay `range` and `sink`. The form labels say stove wall and sink wall.
- Headless Chrome uses SwiftShader for the WebGL kitchen. Measure and Save job work without it.
