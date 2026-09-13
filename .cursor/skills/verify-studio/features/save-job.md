# Save a job

Save a job downloads a JSON file of the confirmed L tape so the shop can take the order without prices.

## Sub-features

- `job-disabled` keeps Save job disabled until a room exists.
- `job-download` writes `turbo-job-range-<length>_sink-<length>.json`.
- `job-from-confirm` offers Save job on the confirm step before the room is applied.

## How to get to it (user POV)

- Choose **Save job ↓** in the mode bar after Confirm. That button stays hidden until a room exists.
- Choose **Save job ↓** on the Check these lengths step.

## Driving it with control-studio

Preconditions:

- Doctor reports `v1=true`.
- If `#welcome` is visible, complete Showroom first then Measure the L first.
- Measure the L has been confirmed, or the confirm dialog is open.

- **Hidden first.** Before Confirm, `#job-download` is disabled and not shown.
- **Download after confirm.** Choose **Save job ↓**. Run `control-studio browser click --selector "#job-download"`. A file named like `turbo-job-range-169.5_sink-128.25.json` appears in the isolated Chrome download directory.
- **Read the file.** The JSON `walls` array contains `id` `range` and `sink` with the typed lengths. It has no price fields.
- **Proof.** Copy the JSON to `.cursor/skills/verify-studio/artifacts/save-job/turbo-job.json` and screenshot the enabled button as `save-job.png`.

## Gotchas

- Confirm is required. Continue alone does not enable the mode-bar Save job button.
- The confirm-step Save job uses `#measure-job-download`. The mode-bar control is `#job-download`.
- The download lands in the isolated profile's download directory, not the user's Downloads folder.
