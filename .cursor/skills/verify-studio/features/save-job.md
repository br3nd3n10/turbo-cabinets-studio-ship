# Save a job

Save a job downloads a JSON file of the confirmed room and the picked layout so the shop can take the order without prices.

## Sub-features

- `job-disabled` keeps Save job disabled until a layout is picked.
- `job-download` writes `turbo-job-range-<length>_sink-<length>.json`.
- `job-from-confirm` offers Save job on the confirm step before the room is applied.

## How to get to it (user POV)

- Choose **Save job ↓** at the right of the view bar, next to Save view, after a layout card is picked. That button stays hidden until then.
- Choose **Save job ↓** on the Check these lengths step.

## Driving it with control-studio

Preconditions:

- Doctor reports `v1=true`.
- If `#welcome` is visible, complete Measure first through Confirm and a template pick.
- A template has been picked, or the confirm dialog is open.

- **Hidden first.** Before a template pick, `#job-download` is disabled and not shown.
- **Download after pick.** Choose **Save job ↓**. Run `control-studio browser click --selector "#job-download"`. A file named like `turbo-job-range-169.5_sink-128.25.json` appears in the isolated Chrome download directory.
- **Read the file.** The JSON has `room` and `layout`. `walls` contains `id` `range` and `sink` with the typed lengths. `layout.rows` use current inventory SKUs. It has no price fields.
- **Proof.** Copy the JSON to `.cursor/skills/verify-studio/artifacts/save-job/turbo-job.json` and screenshot the enabled button as `save-job.png`.

## Gotchas

- Confirm alone does not enable the view-bar Save job button. A template pick does.
- The confirm-step Save job uses `#measure-job-download`. The view-bar control is `#job-download`.
- The download lands in the isolated profile's download directory, not the user's Downloads folder.
- Each `browser` command re-applies the Chrome download path. A click without that path can look like a successful Save job with an empty folder.
