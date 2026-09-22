export function runs(wall) {
  const openings = [...(wall.openings || [])].sort((a, b) => a.start - b.start);
  const out = [];
  let at = 0;
  for (const opening of openings) {
    if (opening.start > at) out.push({ start: at, end: opening.start });
    at = Math.max(at, opening.start + opening.width);
  }
  if (at < wall.length) out.push({ start: at, end: wall.length });
  return out;
}

export function fillRun(run, wall, skus, cutFace) {
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
  return (room?.walls || []).flatMap((wall) => runs(wall).flatMap((run) => fillRun(run, wall, skus, cutFace)));
}
