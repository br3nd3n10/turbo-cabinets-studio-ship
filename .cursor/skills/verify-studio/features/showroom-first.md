# Showroom first

Showroom first lets a customer learn the job, pick a look, and only then type the two wall lengths Turbo needs to model that look in their room.

## Sub-features

- `welcome` explains the two walls, the look, and send before any tape or catalog.
- `showroom` hides Layout, Room sizes, Save job, and the layout slot until the look is chosen.
- `showroom-ready` opens Your two walls from **I like this. Add my room sizes**.
- `ready` reveals Layout, Room sizes, and Save job after Confirm.

## How to get to it (user POV)

- Land on a fresh V1 session and read the welcome.
- Choose **Browse looks**.
- Change a door or color, then choose **I like this. Add my room sizes**.

## Driving it with control-studio

Preconditions:

- Doctor reports `v1=true` on live V1 or a local overlay.
- No room is stored in this profile (`#job-download` is disabled).

- **Welcome.** The first screen heading is `Find a look first. We'll fit it to your room after.` `#welcome` is visible. `#showroom-ready` is not shown.
- **Enter the showroom.** Choose **Browse looks**. Run `control-studio browser click --selector "#welcome-enter"`. `body` `data-phase` is `showroom`. `#showroom-ready` is visible. `[data-mode=layout]`, `#measure-open`, and `#job-download` are not shown.
- **Open sizes.** Choose **I like this. Add my room sizes**. Run `control-studio browser click --selector "#showroom-ready"`. `#measure` is open. `#measure-title` reads `Your two walls.` `#measure-form` is visible.
- **Proof.** Run `control-studio browser snapshot --aria --path .cursor/skills/verify-studio/artifacts/showroom-first/welcome.aria.txt` before Browse looks, then `showroom.aria.txt` after, and screenshot those two states as `welcome.png` and `showroom.png`.

## Gotchas

- Live V1 at `https://turbo-cabinets-studio-v1.vercel.app/` is the showroom-first host. Do not drive Noah's embed.
- A stored room in `turbo-cabinet-studio-v5` skips welcome and starts in `ready`.
- `#measure-open` stays in the DOM while hidden. `control-studio browser click` still fires it. Do not use that entry during `showroom`.
- **Back to why** returns to welcome without clearing the look.
