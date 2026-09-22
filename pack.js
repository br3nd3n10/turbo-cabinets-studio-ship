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

const EPS = 1e-9;

function bankOf(row, inventory) {
  return row.cut ? 'base' : inventory.get(row.skuId)?.bank || 'base';
}

function runOf(room, row) {
  const wall = (room?.walls || []).find((item) => item.id === row.wallId);
  return wall ? runs(wall, 0).find((run) => run.start <= row.start + EPS && row.start < run.end - EPS) || null : null;
}

function footprint(wallId, start, sku) {
  const along = [start, start + sku.width];
  return wallId === 'sink' ? { x: [0, sku.depth], z: along } : { x: along, z: [0, sku.depth] };
}

function overlap([a0, a1], [b0, b1]) {
  return Math.min(a1, b1) - Math.max(a0, b0);
}

// The square a blind box's door needs in front of its open face. Nothing swapped in may
// stand there.
function doorSwings(rows, inventory) {
  return rows.filter((row) => !row.cut && inventory.get(row.skuId)?.blind).map((row) => {
    const sku = inventory.get(row.skuId);
    const door = [row.start + sku.frontOffset, row.start + sku.frontOffset + sku.frontWidth];
    const out = [sku.depth, sku.depth + sku.frontWidth];
    return row.wallId === 'sink'
      ? { bank: sku.bank, x: out, z: [row.start + sku.width - sku.frontOffset - sku.frontWidth, row.start + sku.width - sku.frontOffset] }
      : { bank: sku.bank, x: door, z: out };
  });
}

// A target names a placed row by wall and start. Bases and uppers can share both, so a
// bank or a skuId tells them apart.
export function findRow(rows, target, inventory) {
  return rows.find((row) => !row.cut && row.wallId === target.wallId && Math.abs(row.start - target.start) < EPS
    && (!target.skuId || row.skuId === target.skuId)
    && (!target.bank || bankOf(row, inventory) === target.bank)) || null;
}

// Current boxes that can take the place of the row at `target`: the same bank, not a blind
// corner box, fitting the rest of the run, and clear of every blind door's swing.
export function candidates(room, rows, target, inventory) {
  const row = findRow(rows, target, inventory);
  const current = row && inventory.get(row.skuId);
  if (!current || current.blind || current.kind !== 'base' && current.kind !== 'upper') return [];
  const run = runOf(room, row);
  if (!run) return [];
  const remaining = run.end - row.start;
  const swings = doorSwings(rows, inventory).filter((swing) => swing.bank === current.bank);
  return [...inventory.values()].filter((sku) => {
    if (sku.bank !== current.bank || sku.blind || sku.kind === 'appliance' || sku.width > remaining + EPS) return false;
    const box = footprint(row.wallId, row.start, sku);
    return !swings.some((swing) => overlap(box.x, swing.x) > EPS && overlap(box.z, swing.z) > EPS);
  });
}

// Put `skuId` where the row at `target` stands, then refit the rest of that run from the
// recipe's regular boxes. Rows before the target, other runs, and the other bank stay.
export function swapRow(room, rows, target, skuId, skus, { cutFace = null, inventory } = {}) {
  const row = findRow(rows, target, inventory);
  const next = inventory.get(skuId);
  const run = row && runOf(room, row);
  if (!row || !next || !run || !candidates(room, rows, target, inventory).some((sku) => sku.id === skuId)) return rows;
  const bank = bankOf(row, inventory);
  const wall = room.walls.find((item) => item.id === row.wallId);
  const rest = (item) => item.wallId === row.wallId && bankOf(item, inventory) === bank && item.start > row.start + EPS && item.start < run.end - EPS;
  const index = rows.indexOf(row);
  const refit = fillRun({ start: row.start + next.width, end: run.end }, wall, skus.filter((sku) => !sku.blind), cutFace);
  return [
    ...rows.slice(0, index).filter((item) => !rest(item)),
    { skuId: next.id, wallId: row.wallId, start: row.start },
    ...refit,
    ...rows.slice(index + 1).filter((item) => !rest(item)),
  ];
}
