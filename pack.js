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

function roundIn(value) {
  return Math.round(value * 1000) / 1000;
}

// Widths along each taped wall, in order, including the corner return, openings, and leftover cuts.
// The parts add up to the wall length the customer typed.
export function wallChain(room, rows, inventory) {
  const list = rows || [];
  const blind = list.find((row) => !row.cut && row.wallId === 'range' && inventory.get(row.skuId)?.blind && inventory.get(row.skuId)?.bank === 'base');
  const corner = blind ? inventory.get(blind.skuId).depth : 0;
  return (room?.walls || []).map((wall) => {
    const pieces = [];
    if (wall.id === 'sink' && corner > 0) pieces.push({ start: 0, width: corner });
    for (const row of list) {
      if (row.wallId !== wall.id) continue;
      const sku = row.cut ? null : inventory.get(row.skuId);
      if (!row.cut && sku?.bank !== 'base') continue;
      const width = row.cut ? row.width : sku?.width || 0;
      if (width > 0) pieces.push({ start: row.start, width });
    }
    for (const opening of wall.openings || []) pieces.push({ start: opening.start, width: opening.width });
    pieces.sort((a, b) => a.start - b.start || a.width - b.width);
    const parts = [];
    let at = 0;
    for (const piece of pieces) {
      if (piece.start > at + EPS) parts.push(roundIn(piece.start - at));
      const end = piece.start + piece.width;
      if (end > at + EPS) {
        parts.push(roundIn(Math.min(end, wall.length) - Math.max(piece.start, at)));
        at = Math.max(at, end);
      }
    }
    if (wall.length > at + EPS) parts.push(roundIn(wall.length - at));
    return { wallId: wall.id, length: wall.length, parts };
  });
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

export function runOf(room, row) {
  const wall = (room?.walls || []).find((item) => item.id === row.wallId);
  return wall ? runs(wall, 0).find((run) => run.start <= row.start + EPS && row.start < run.end - EPS) || null : null;
}

export function isSinkBase(sku) {
  return Boolean(sku && sku.kind === 'base' && (sku.id === 'SB36' || /^sink base$/i.test(sku.name || '')));
}

// Windows are not floor blocks. A door blocks uppers unless its taped height ends at or
// below the upper bottoms. A sink is a cabinet anchor, not a hole.
export function openingBlocks(opening, bank, skus = []) {
  const kind = opening?.kind;
  if (kind === 'window') {
    if (bank !== 'upper') return false;
    const tops = skus.filter((sku) => sku.kind === 'upper' || sku.bank === 'upper').map((sku) => (sku.bottom ?? 54) + sku.height);
    if (opening.sill == null || opening.sill === '') return true;
    const top = tops.length ? Math.max(...tops) : 90;
    return Number(opening.sill) < top - EPS;
  }
  if (kind === 'door') {
    if (bank !== 'upper') return true;
    const bottoms = skus.filter((sku) => sku.kind === 'upper' || sku.bank === 'upper').map((sku) => sku.bottom ?? 54);
    const bottom = bottoms.length ? Math.min(...bottoms) : 54;
    if (opening.height == null || opening.height === '') return true;
    return Number(opening.height) > bottom + EPS;
  }
  if (kind === 'fridge') return true;
  if (kind === 'range' || kind === 'dishwasher') return bank === 'base';
  if (kind === 'sink') return false;
  return bank === 'base';
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

function rowWidth(row, inventory) {
  return row.cut ? row.width : inventory.get(row.skuId)?.width || 0;
}

function lockKey(lock) {
  return `${lock.wallId}:${lock.bank}:${roundIn(lock.start)}`;
}

export function isLocked(locks, row, bank) {
  return (locks || []).some((lock) => lock.wallId === row.wallId && lock.bank === bank && Math.abs(lock.start - row.start) < EPS);
}

function sinkAligned(room, row, sku) {
  const wall = (room?.walls || []).find((item) => item.id === row.wallId);
  return (wall?.openings || []).some((opening) => opening.kind === 'sink' && Math.abs(opening.start - row.start) < EPS && Math.abs(opening.width - sku.width) < EPS);
}

export function refusal(room, rows, target, sku, inventory) {
  const row = findRow(rows, target, inventory);
  const current = row && inventory.get(row.skuId);
  if (!row || !current || !sku) return 'That cabinet is not in the plan.';
  if (current.blind || sku.blind) return 'The blind corner stays where the two walls meet.';
  if (current.kind !== 'base' && current.kind !== 'upper') return 'Fillers and gaps stay put. Swap a cabinet, or pick another layout.';
  if (sku.bank !== current.bank) return 'That cabinet belongs on the other row.';
  if (sku.kind === 'appliance') return 'Appliances follow the opening you taped. They are not cabinet swaps.';
  if (isSinkBase(current) && !isSinkBase(sku)) return 'This sink base stays with the taped sink.';
  if (isSinkBase(sku) && !sinkAligned(room, row, sku)) return 'A sink base only sits on a taped sink of the same width.';
  const run = runOf(room, row);
  if (!run) return 'That spot is not on an open run.';
  const roomLeft = roundIn(run.end - row.start);
  if (sku.width > roomLeft + EPS) return `${sku.id} is ${sku.width} in wide. This run has ${roomLeft} in left.`;
  const swings = doorSwings(rows, inventory).filter((swing) => swing.bank === current.bank);
  const box = footprint(row.wallId, row.start, sku);
  if (swings.some((swing) => overlap(box.x, swing.x) > EPS && overlap(box.z, swing.z) > EPS)) return 'That cabinet would stand in the blind-corner door swing.';
  return '';
}

export function replaceRow(room, rows, target, skuId, skus, { cutFace = null, inventory, locks = [] } = {}) {
  const sku = inventory.get(skuId);
  const reason = refusal(room, rows, target, sku, inventory);
  if (reason) return { ok: false, reason, rows };
  const row = findRow(rows, target, inventory);
  const bank = bankOf(row, inventory);
  if (isLocked(locks, row, bank)) return { ok: false, reason: 'This cabinet is locked.', rows };
  const run = runOf(room, row);
  const fixed = rows.filter((item) => item !== row && item.wallId === row.wallId && bankOf(item, inventory) === bank && item.start >= run.start - EPS && item.start < run.end - EPS && isLocked(locks, item, bank));
  const end = row.start + sku.width;
  if (fixed.some((item) => row.start < item.start + rowWidth(item, inventory) - EPS && end > item.start + EPS)) {
    return { ok: false, reason: 'A locked cabinet is already in that span.', rows };
  }
  const kept = rows.filter((item) => {
    if (item.wallId !== row.wallId || bankOf(item, inventory) !== bank) return true;
    if (item.start < run.start - EPS || item.start >= run.end - EPS) return true;
    if (Math.abs(item.start - row.start) < EPS) return false;
    if (item.start < row.start - EPS) return true;
    return isLocked(locks, item, bank);
  });
  const blocks = fixed.map((item) => ({ start: item.start, end: item.start + rowWidth(item, inventory) }));
  blocks.push({ start: run.end, end: run.end });
  blocks.sort((a, b) => a.start - b.start);
  const storage = skus.filter((item) => !item.blind && !isSinkBase(item));
  const wall = room.walls.find((item) => item.id === row.wallId);
  const filled = [];
  let cursor = end;
  for (const block of blocks) {
    if (block.start > cursor + EPS) filled.push(...fillRun({ start: cursor, end: block.start }, wall, storage, cutFace));
    cursor = Math.max(cursor, block.end);
  }
  const removed = rows.filter((item) => !kept.includes(item) && item !== row);
  const nextRows = [...kept, { skuId: sku.id, wallId: row.wallId, start: row.start }, ...filled];
  return { ok: true, rows: nextRows, removed, filled };
}

export function placeAt(room, rows, target, start, inventory, locks = []) {
  const row = findRow(rows, target, inventory);
  const sku = row && inventory.get(row.skuId);
  const wall = row && (room?.walls || []).find((item) => item.id === row.wallId);
  if (!row || !sku || !wall) return { ok: false, reason: 'That cabinet is not in the plan.', rows };
  if (sku.blind) return { ok: false, reason: 'The blind corner stays where the two walls meet.', rows };
  const bank = sku.bank || bankOf(row, inventory);
  if (isLocked(locks, row, bank)) return { ok: false, reason: 'This cabinet is locked.', rows };
  if (!(start >= 0) || start + sku.width > wall.length + EPS) {
    return { ok: false, reason: `The ${wall.id} wall is ${wall.length} in. ${sku.id} at ${roundIn(start)} in would end at ${roundIn(start + sku.width)} in.`, rows };
  }
  for (const opening of wall.openings || []) {
    if (!openingBlocks(opening, bank, [...inventory.values()])) continue;
    if (start < opening.start + opening.width - EPS && start + sku.width > opening.start + EPS) {
      return { ok: false, reason: `That crosses the ${opening.kind} at ${opening.start} in.`, rows };
    }
  }
  for (const other of rows) {
    if (other === row || other.wallId !== row.wallId || bankOf(other, inventory) !== bank) continue;
    const width = rowWidth(other, inventory);
    if (start < other.start + width - EPS && start + sku.width > other.start + EPS) {
      const name = other.cut ? 'an unresolved gap' : other.skuId;
      return { ok: false, reason: `That overlaps ${name} at ${other.start} in.`, rows };
    }
  }
  const swings = doorSwings(rows.filter((item) => item !== row), inventory).filter((swing) => swing.bank === bank);
  const box = footprint(row.wallId, start, sku);
  if (swings.some((swing) => overlap(box.x, swing.x) > EPS && overlap(box.z, swing.z) > EPS)) {
    return { ok: false, reason: 'That stands in the blind-corner door swing.', rows };
  }
  return { ok: true, rows: rows.map((item) => (item === row ? { ...item, start } : item)) };
}

function cornerReserve(wallId, skus) {
  const blind = skus.find((sku) => sku.blind);
  const depth = Math.max(0, ...skus.map((sku) => sku.depth || 0));
  if (wallId === 'range') return blind ? CORNER_FILLER + blind.width : depth + CORNER_FILLER;
  return depth + CORNER_FILLER;
}

// Pack one bank. Sink bases are placed only on a matching taped sink. Other openings block
// only the banks they actually obstruct. Leftover inches stay an unresolved gap (a cut
// row), never a suggestion to cut a cabinet carcass.
export function packFunctional(room, skus, { bank = 'base', cutFace = null, filler = null } = {}) {
  const notes = [];
  const sink = bank === 'base' ? skus.find(isSinkBase) : null;
  const storage = skus.filter((sku) => !isSinkBase(sku));
  const face = cutFace || (bank === 'upper' ? { height: 36, depth: 12 } : { height: 34.5, depth: 24 });
  const anchors = [];
  const walls = (room?.walls || []).map((wall) => {
    const openings = [];
    for (const opening of wall.openings || []) {
      if (bank === 'base' && opening.kind === 'sink') {
        const reserve = cornerReserve(wall.id, storage.length ? storage : skus);
        const hitsCorner = opening.start < reserve - EPS && opening.start + opening.width > EPS;
        if (hitsCorner) {
          notes.push(`The sink on the ${wall.id} wall is taped through the inside corner. Move it past ${roundIn(reserve)} in.`);
          openings.push(opening);
          continue;
        }
        if (sink && Math.abs(opening.width - sink.width) < EPS) {
          anchors.push({ skuId: sink.id, wallId: wall.id, start: opening.start });
          openings.push({ kind: 'sink', width: opening.width, start: opening.start });
        } else {
          openings.push({ kind: 'sink', width: opening.width, start: opening.start });
          notes.push(sink
            ? `The sink on the ${wall.id} wall is ${opening.width} in wide. The sink base in stock is ${sink.width} in, so it is not placed.`
            : `A sink is taped on the ${wall.id} wall, and the current list has no sink base.`);
        }
        continue;
      }
      if (openingBlocks(opening, bank, skus)) openings.push(opening);
    }
    return { ...wall, openings };
  });
  // Sink anchors are represented as blocking openings above so the packer leaves their span.
  // openingBlocks treats kind sink as non-blocking, so force those spans to stay open.
  const blocked = walls.map((wall) => ({
    ...wall,
    openings: (wall.openings || []).map((opening) => (opening.kind === 'sink' ? { ...opening, kind: 'range' } : opening)),
  }));
  const packed = packRoom({ ...room, walls: blocked }, storage, { cutFace: face, filler });
  const rows = [...packed, ...anchors].sort((a, b) => (a.wallId < b.wallId ? -1 : a.wallId > b.wallId ? 1 : a.start - b.start));
  return { rows, notes };
}

export function handedTwin(sku, inventory) {
  if (!sku?.id) return null;
  const id = sku.id.endsWith('-L') ? `${sku.id.slice(0, -2)}-R` : sku.id.endsWith('-R') ? `${sku.id.slice(0, -2)}-L` : null;
  const twin = id && inventory.get(id);
  return twin && twin.id !== sku.id ? twin : null;
}

export { lockKey };
