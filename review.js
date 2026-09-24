import { isSinkBase, openingBlocks, wallChain } from './pack.js';

export const STUDIO_CEILING = 96;
const EPS = 1e-9;
const NEEDED = ['sink', 'range', 'fridge', 'dishwasher'];
const WALL_NAME = { range: 'Stove wall', sink: 'Sink wall' };

export function roundIn(value) {
  return Math.round(value * 1000) / 1000;
}

export function wallName(id) {
  return WALL_NAME[id] || id;
}

export function gapLabel(row) {
  return `unresolved gap ${roundIn(row.width)} in`;
}

export function rowLabel(row, inventory) {
  if (row.cut) return gapLabel(row);
  const sku = inventory.get(row.skuId);
  return sku ? `${sku.name} (${sku.id})` : row.skuId;
}

function widthOf(row, inventory) {
  return row.cut ? row.width : inventory.get(row.skuId)?.width || 0;
}

function bankOf(row, inventory) {
  return row.cut ? 'base' : inventory.get(row.skuId)?.bank || 'base';
}

export function missingPositions(room) {
  const present = new Set((room?.walls || []).flatMap((wall) => (wall.openings || []).map((opening) => opening.kind)));
  return NEEDED.filter((kind) => !present.has(kind));
}

export function cornerNote(rows, inventory) {
  const blind = (rows || []).find((row) => !row.cut && row.wallId === 'range' && inventory.get(row.skuId)?.blind && bankOf(row, inventory) === 'base');
  if (!blind) return 'No blind corner box fits the inside corner, so both runs start past that square.';
  const sku = inventory.get(blind.skuId);
  return `The inside corner is a ${sku.width} in ${sku.name}, pulled 3 in off the sink wall so its door clears. A 3 in filler fills that strip. The sink wall starts after the ${sku.depth} in corner depth plus another 3 in filler. Those pieces are in the wall total.`;
}

export function counts(rows, inventory) {
  const tally = { drawers: 0, storage: 0, sink: 0, corner: 0, filler: 0, upper: 0, gap: 0 };
  for (const row of rows || []) {
    if (row.cut) {
      if (bankOf(row, inventory) === 'base') tally.gap += 1;
      continue;
    }
    const sku = inventory.get(row.skuId);
    if (!sku) continue;
    if (sku.kind === 'filler') tally.filler += 1;
    else if (sku.blind && sku.bank === 'base') tally.corner += 1;
    else if (isSinkBase(sku)) tally.sink += 1;
    else if (sku.bank === 'upper') tally.upper += 1;
    else if (/drawer/i.test(sku.name || '')) tally.drawers += 1;
    else if (sku.bank === 'base') tally.storage += 1;
  }
  return tally;
}

export function countLine(rows, inventory) {
  const tally = counts(rows, inventory);
  const parts = [];
  if (tally.drawers) parts.push(`${tally.drawers} drawer ${tally.drawers === 1 ? 'base' : 'bases'}`);
  if (tally.storage) parts.push(`${tally.storage} storage ${tally.storage === 1 ? 'base' : 'bases'}`);
  if (tally.sink) parts.push(`${tally.sink} sink ${tally.sink === 1 ? 'base' : 'bases'}`);
  if (tally.corner) parts.push(`${tally.corner} blind corner`);
  if (tally.upper) parts.push(`${tally.upper} upper ${tally.upper === 1 ? 'cabinet' : 'cabinets'}`);
  if (tally.filler) parts.push(`${tally.filler} purchasable ${tally.filler === 1 ? 'filler' : 'fillers'}`);
  if (tally.gap) parts.push(`${tally.gap} unresolved ${tally.gap === 1 ? 'gap' : 'gaps'}`);
  return parts.join(', ') || 'No cabinets placed';
}

function overlap(a0, a1, b0, b1) {
  return Math.min(a1, b1) - Math.max(a0, b0);
}

export function checks(room, rows, inventory, { ceiling = STUDIO_CEILING } = {}) {
  const issues = [];
  const list = rows || [];
  const missing = missingPositions(room);
  if (missing.length) issues.push({ id: 'missing', message: `${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} not taped yet. The layout does not guess those spots.`, severity: 'unresolved' });
  for (const row of list) {
    if (!row.cut) continue;
    issues.push({
      id: `gap-${row.wallId}-${row.start}`,
      wallId: row.wallId,
      start: row.start,
      bank: bankOf(row, inventory),
      message: `${wallName(row.wallId)} has an unresolved gap of ${roundIn(row.width)} in at ${roundIn(row.start)} in. That is not a cabinet, and it is not a cut carcass. A filler from stock or a different run can close it.`,
      severity: 'gap',
    });
  }
  for (const wall of room?.walls || []) {
    for (const row of list) {
      if (row.wallId !== wall.id || row.cut) continue;
      const width = widthOf(row, inventory);
      if (row.start < -EPS || row.start + width > wall.length + EPS) {
        issues.push({ id: `bounds-${wall.id}-${row.start}`, wallId: wall.id, start: row.start, skuId: row.skuId, message: `${row.skuId} runs past the ${wall.length} in ${wallName(wall.id).toLowerCase()}.`, severity: 'conflict' });
      }
    }
    const sameBank = (bank) => list.filter((row) => row.wallId === wall.id && bankOf(row, inventory) === bank);
    for (const bank of ['base', 'upper']) {
      const group = sameBank(bank);
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const a = group[i];
          const b = group[j];
          const aw = widthOf(a, inventory);
          const bw = widthOf(b, inventory);
          if (overlap(a.start, a.start + aw, b.start, b.start + bw) > EPS) {
            issues.push({ id: `overlap-${bank}-${a.start}-${b.start}`, wallId: wall.id, start: a.start, skuId: a.skuId, message: `${a.cut ? 'A gap' : a.skuId} overlaps ${b.cut ? 'a gap' : b.skuId} on the ${wallName(wall.id).toLowerCase()}.`, severity: 'conflict' });
          }
        }
      }
    }
    for (const opening of wall.openings || []) {
      if (opening.kind !== 'window') continue;
      for (const row of list) {
        if (row.cut || row.wallId !== wall.id || bankOf(row, inventory) !== 'upper') continue;
        const sku = inventory.get(row.skuId);
        if (!sku || !openingBlocks(opening, 'upper', [sku])) continue;
        if (overlap(row.start, row.start + sku.width, opening.start, opening.start + opening.width) > EPS) {
          issues.push({ id: `window-${wall.id}-${row.start}`, wallId: wall.id, start: row.start, skuId: row.skuId, message: `${sku.id} crosses the window at ${opening.start} in. Move the upper, or tape a sill that clears it.`, severity: 'conflict' });
        }
      }
    }
    for (const opening of wall.openings || []) {
      if (opening.kind !== 'sink') continue;
      const covered = list.some((row) => !row.cut && row.wallId === wall.id && isSinkBase(inventory.get(row.skuId)) && Math.abs(row.start - opening.start) < EPS);
      if (!covered) issues.push({ id: `sink-${wall.id}-${opening.start}`, wallId: wall.id, start: opening.start, message: `The sink at ${opening.start} in on the ${wallName(wall.id).toLowerCase()} has no sink base from stock.`, severity: 'unresolved' });
    }
  }
  const tops = list.filter((row) => !row.cut && bankOf(row, inventory) === 'upper').map((row) => {
    const sku = inventory.get(row.skuId);
    return (sku.bottom ?? 54) + sku.height;
  });
  if (tops.some((top) => top > ceiling + EPS)) {
    issues.push({ id: 'ceiling', message: `An upper cabinet ends above the ${ceiling} in ceiling.`, severity: 'conflict' });
  }
  issues.push({ id: 'site', message: 'Door swing, drawer clearance, and appliance clearance are not on a manufacturer sheet here. This list checks taped sizes and current cabinets only. A drawing is not an installation approval.', severity: 'note' });
  return issues;
}

export function parts(rows, inventory) {
  const lines = [];
  const groups = new Map();
  for (const row of rows || []) {
    if (row.cut) continue;
    const sku = inventory.get(row.skuId);
    if (!sku || sku.kind === 'appliance') continue;
    const key = sku.id;
    const group = groups.get(key) || { sku, qty: 0, places: [], target: { wallId: row.wallId, start: row.start, bank: sku.bank, skuId: sku.id } };
    group.qty += 1;
    group.places.push(`${wallName(row.wallId)} at ${roundIn(row.start)} in`);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    lines.push({
      skuId: group.sku.id,
      name: group.sku.name,
      kind: group.sku.kind,
      width: group.sku.width,
      height: group.sku.height,
      depth: group.sku.depth,
      qty: group.qty,
      places: group.places,
      target: group.target,
      status: group.sku.kind === 'filler' ? 'Filler from the current list' : 'Cabinet from the current list',
    });
  }
  const gaps = (rows || []).filter((row) => row.cut);
  if (gaps.length) {
    lines.push({
      skuId: '',
      name: 'Unresolved gap',
      kind: 'gap',
      width: null,
      height: null,
      depth: null,
      qty: gaps.length,
      places: gaps.map((row) => `${wallName(row.wallId)} ${roundIn(row.width)} in at ${roundIn(row.start)} in`),
      status: 'Not a product. Not a cut cabinet.',
    });
  }
  for (const row of rows || []) {
    const sku = !row.cut && inventory.get(row.skuId);
    if (!sku || sku.kind !== 'appliance') continue;
    lines.push({
      skuId: sku.id,
      name: sku.name,
      kind: 'appliance',
      width: sku.width,
      height: sku.height,
      depth: sku.depth,
      qty: 1,
      places: [`${wallName(row.wallId)} at ${roundIn(row.start)} in`],
      status: 'Visual placeholder. Not a cabinet order line.',
    });
  }
  lines.push({
    skuId: '',
    name: 'Toe kick, end panel, molding',
    kind: 'note',
    qty: 0,
    places: [],
    status: 'None of these are in the current cabinet list, so none are added.',
  });
  return lines;
}

export function chainText(room, rows, inventory) {
  return wallChain(room, rows, inventory).map((wall) => {
    const sum = roundIn(wall.parts.reduce((total, part) => total + part, 0));
    return `${wallName(wall.wallId)} ${wall.parts.map(roundIn).join(' + ')} = ${sum} in`;
  });
}

export function banksForScope(scope) {
  if (scope === 'uppers') return ['upper'];
  if (scope === 'lowers') return ['lower'];
  if (scope === 'kitchen') return ['upper', 'lower'];
  return [];
}

export function scopeNote(scope, finishName, rows, inventory) {
  const lowers = (rows || []).filter((row) => !row.cut && bankOf(row, inventory) === 'base' && inventory.get(row.skuId)?.kind !== 'appliance').length;
  const uppers = (rows || []).filter((row) => !row.cut && bankOf(row, inventory) === 'upper').length;
  if (scope === 'one') return 'The next finish changes only the selected cabinet.';
  if (scope === 'uppers') return `All uppers changes ${uppers} upper ${uppers === 1 ? 'cabinet' : 'cabinets'}. Lowers stay as they are.`;
  if (scope === 'lowers') return `All lowers changes ${lowers} lower ${lowers === 1 ? 'cabinet' : 'cabinets'}. Uppers stay as they are.`;
  if (scope === 'kitchen') return `Entire kitchen changes all ${uppers + lowers} cabinets${finishName ? ` to ${finishName}` : ''}. Uppers and lowers both change.`;
  return '';
}

export function planPieces(room, rows, inventory) {
  return (rows || []).map((row) => {
    const sku = row.cut ? null : inventory.get(row.skuId);
    return {
      wallId: row.wallId,
      start: row.start,
      width: widthOf(row, inventory),
      bank: bankOf(row, inventory),
      cut: Boolean(row.cut),
      skuId: row.skuId || '',
      name: row.cut ? 'Unresolved gap' : sku?.name || row.skuId,
      blind: Boolean(sku?.blind),
      sink: isSinkBase(sku),
    };
  });
}

export function elevationPieces(room, rows, inventory, wallId, ceiling = STUDIO_CEILING) {
  const wall = (room?.walls || []).find((item) => item.id === wallId);
  if (!wall) return { length: 0, ceiling, cabinets: [], openings: [] };
  const cabinets = (rows || []).filter((row) => row.wallId === wallId).map((row) => {
    const sku = row.cut ? null : inventory.get(row.skuId);
    const bank = bankOf(row, inventory);
    const bottom = row.cut ? 0 : sku?.bottom || 0;
    const height = row.cut ? 0 : sku?.height || 0;
    return { start: row.start, width: widthOf(row, inventory), bottom, height, bank, cut: Boolean(row.cut), skuId: row.skuId || '', name: row.cut ? 'Unresolved gap' : sku?.name || '' };
  });
  return { length: wall.length, ceiling, cabinets, openings: wall.openings || [] };
}
