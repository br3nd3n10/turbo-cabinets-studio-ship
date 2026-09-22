// Both walls are taped from the inside corner. One blind corner box owns that corner on
// the range wall, pulled 3 in off the sink wall so its door clears the return's fronts.
// The return starts past the corner box's depth plus the same 3 in. A 3 in filler fills
// each of those two strips so the run stays continuous, as in the measured reference
// layout (MEASURED_LAYOUT.md). Without a blind box the corner stays dead and both runs
// start past it.
const CORNER_FILLER = 3;

function runs(wall, from) {
  const openings = [...(wall.openings || [])].sort((a, b) => a.start - b.start);
  const out = [];
  let at = from;
  for (const opening of openings) {
    if (opening.start > at) out.push({ start: at, end: opening.start });
    at = Math.max(at, opening.start + opening.width);
  }
  if (at < wall.length) out.push({ start: at, end: wall.length });
  return out;
}

function fillRun(run, wall, skus, cutFace, lead = null) {
  const rows = [];
  let at = run.start;
  if (lead) {
    rows.push({ skuId: lead.id, wallId: wall.id, start: at });
    at += lead.width;
  }
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

function blindCornerFits(wall, blind) {
  const [first] = runs(wall, CORNER_FILLER);
  return Boolean(first && first.start === CORNER_FILLER && first.start + blind.width <= first.end);
}

function packWall(wall, skus, cutFace, blind, strip, depth) {
  const past = depth + CORNER_FILLER;
  if (!blind) return runs(wall, past).flatMap((run) => fillRun(run, wall, skus, cutFace));
  const joint = (start) => (strip ? [{ skuId: strip.id, wallId: wall.id, start }] : []);
  if (wall.id === 'range') {
    const [first, ...rest] = runs(wall, CORNER_FILLER);
    return [...joint(0), ...fillRun(first, wall, skus, cutFace, blind), ...rest.flatMap((run) => fillRun(run, wall, skus, cutFace))];
  }
  return [...joint(depth), ...runs(wall, past).flatMap((run) => fillRun(run, wall, skus, cutFace))];
}

export function packRoom(room, skus, { cutFace = null, filler = null } = {}) {
  const walls = room?.walls || [];
  const regular = skus.filter((sku) => !sku.blind);
  const depth = Math.max(0, ...skus.map((sku) => sku.depth || 0));
  const range = walls.find((wall) => wall.id === 'range');
  const candidate = skus.find((sku) => sku.blind) || null;
  const blind = candidate && range && blindCornerFits(range, candidate) ? candidate : null;
  const strip = filler && filler.width === CORNER_FILLER ? filler : null;
  return walls.flatMap((wall) => packWall(wall, regular, cutFace, blind, strip, depth));
}
