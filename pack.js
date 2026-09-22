// The sink wall is taped from the inside corner. The range wall's corner box already
// fills the first `depth` inches of that return, and the measured reference layout
// puts a 3 in filler after it so the corner doors clear each other.
const CORNER_FILLER = 3;

function cornerStart(wall, depth) {
  return wall.id === 'sink' ? depth + CORNER_FILLER : 0;
}

function runs(wall, depth) {
  const openings = [...(wall.openings || [])].sort((a, b) => a.start - b.start);
  const out = [];
  let at = cornerStart(wall, depth);
  for (const opening of openings) {
    if (opening.start > at) out.push({ start: at, end: opening.start });
    at = Math.max(at, opening.start + opening.width);
  }
  if (at < wall.length) out.push({ start: at, end: wall.length });
  return out;
}

function fillRun(run, wall, skus, cutFace) {
  const rows = [];
  let at = run.start;
  while (at < run.end) {
    const fit = skus.find((sku) => at + sku.width <= run.end);
    if (!fit) {
      const width = run.end - at;
      if (cutFace && width > 0) rows.push({ cut: true, wallId: wall.id, start: at, width, height: cutFace.height, depth: cutFace.depth });
      break;
    }
    rows.push({ skuId: fit.id, wallId: wall.id, start: at });
    at += fit.width;
  }
  return rows;
}

export function packRoom(room, skus, cutFace = null) {
  const depth = Math.max(0, ...skus.map((sku) => sku.depth || 0));
  return (room?.walls || []).flatMap((wall) => runs(wall, depth).flatMap((run) => fillRun(run, wall, skus, cutFace)));
}
