import assert from 'node:assert/strict';
import { FILLER, SKU, pick } from './inventory.js';
import { handedTwin, isLocked, openingBlocks, packFunctional, placeAt, replaceRow, wallChain } from './pack.js';
import { banksForScope, chainText, checks, cornerNote, counts, gapLabel, missingPositions, parts, scopeNote } from './review.js';

const ROOM = { walls: [{ id: 'range', length: 169.5, openings: [] }, { id: 'sink', length: 128.25, openings: [] }] };
const DRAWERS = pick(['BBC39-L', 'BWB18', 'SB36']);
const MORE = pick(['BBC39-L', 'B12-R', 'B15-L', 'SB36']);
const GAPS = pick(['BBC39-L', 'BWB18', 'B15-L', 'B12-R', 'F3-base', 'SB36']);
const UPPERS = pick(['WBC2730-L', 'W3630', 'W3015', 'W2730', 'W1230-L']);
const FACE = { height: 34.5, depth: 24 };

function ids(rows) {
  return rows.filter((row) => !row.cut).map((row) => row.skuId);
}

function pack(room, skus, bank, extra = {}) {
  return packFunctional(room, skus, { bank, cutFace: bank === 'base' ? FACE : null, filler: bank === 'base' ? FILLER.base : FILLER.upper, ...extra });
}

const drawers = pack(ROOM, DRAWERS, 'base');
const more = pack(ROOM, MORE, 'base');
const gaps = pack(ROOM, GAPS, 'base');
assert.equal(ids(drawers.rows).filter((id) => id === 'SB36').length, 0, 'no sink base without a sink');
assert.equal(ids(more.rows).includes('SB36'), false, 'more storage does not repeat sink bases');
assert.ok(ids(drawers.rows).includes('BWB18'), 'drawer recipe uses drawer bases');
assert.ok(counts(more.rows, SKU).storage > counts(drawers.rows, SKU).drawers, 'more cabinets is actually more bases');
assert.notEqual(ids(drawers.rows).join(), ids(gaps.rows).join(), 'filler recipe differs from drawers');
assert.ok(drawers.rows.some((row) => row.cut), 'leftover inches stay a gap row');
assert.equal(gapLabel(drawers.rows.find((row) => row.cut)).includes('unresolved gap'), true);
assert.equal(gapLabel(drawers.rows.find((row) => row.cut)).includes('cut'), false);
assert.ok(cornerNote(drawers.rows, SKU).includes('3 in'));
for (const packed of [drawers, more, gaps]) {
  const chain = wallChain(ROOM, packed.rows, SKU);
  for (const wall of chain) {
    const sum = Math.round(wall.parts.reduce((total, part) => total + part, 0) * 1000) / 1000;
    assert.equal(sum, wall.length, `${wall.wallId} parts add up`);
  }
}
assert.deepEqual(missingPositions(ROOM), ['sink', 'range', 'fridge', 'dishwasher']);

const sunk = {
  walls: [
    { id: 'range', length: 169.5, openings: [{ kind: 'range', width: 30, start: 60 }] },
    { id: 'sink', length: 128.25, openings: [{ kind: 'sink', width: 36, start: 60 }, { kind: 'window', width: 30, start: 70, sill: 42 }] },
  ],
};
const sunkBases = pack(sunk, [...DRAWERS, FILLER.base], 'base');
const sunkUppers = pack(sunk, UPPERS, 'upper');
assert.deepEqual(sunkBases.rows.filter((row) => row.skuId === 'SB36').map((row) => [row.wallId, row.start]), [['sink', 60]], 'one sink base on the taped sink');
assert.equal(sunkBases.rows.some((row) => row.wallId === 'range' && !row.cut && row.start < 90 && row.start + (SKU.get(row.skuId)?.width || row.width) > 60 && row.skuId !== 'SB36'), false, 'bases stay out of the range');
const windowSpan = sunkBases.rows.filter((row) => row.wallId === 'sink' && !row.cut && row.skuId !== 'SB36');
assert.ok(windowSpan.some((row) => row.start < 100 && row.start + SKU.get(row.skuId).width > 70), 'a window does not punch a hole in the bases');
assert.equal(sunkUppers.rows.some((row) => !row.cut && row.wallId === 'sink' && row.start < 100 && row.start + SKU.get(row.skuId).width > 70), false, 'uppers stop at the window');
assert.equal(openingBlocks({ kind: 'window' }, 'base', []), false);
assert.equal(openingBlocks({ kind: 'door', height: 30 }, 'upper', [{ kind: 'upper', bottom: 54, height: 36 }]), false, 'a short door leaves the uppers');
assert.equal(openingBlocks({ kind: 'door' }, 'upper', []), true, 'an untaped door height blocks uppers');

const mismatch = pack({ walls: [{ id: 'range', length: 169.5, openings: [] }, { id: 'sink', length: 128.25, openings: [{ kind: 'sink', width: 33, start: 60 }] }] }, DRAWERS, 'base');
assert.equal(ids(mismatch.rows).includes('SB36'), false);
assert.ok(mismatch.notes.some((note) => note.includes('33')));

const layout = [...sunkBases.rows, ...sunkUppers.rows];
const swap = replaceRow(sunk, layout, { wallId: 'sink', start: 60, bank: 'base' }, 'BWB18', DRAWERS, { cutFace: FACE, inventory: SKU, locks: [] });
assert.equal(swap.ok, false);
assert.match(swap.reason, /sink base stays/);
const storageSwap = replaceRow(sunk, layout, { wallId: 'range', start: 42, bank: 'base' }, 'B15-L', DRAWERS, { cutFace: FACE, inventory: SKU });
assert.equal(storageSwap.ok, true, storageSwap.reason || 'range-wall swap');
assert.equal(storageSwap.rows.some((row) => isLocked([{ wallId: 'sink', start: 60, bank: 'base' }], row, 'base') && row.skuId === 'SB36'), true);
const locked = [{ wallId: 'range', start: 42, bank: 'base' }];
const refused = replaceRow(sunk, layout, { wallId: 'range', start: 42, bank: 'base' }, 'B15-L', DRAWERS, { cutFace: FACE, inventory: SKU, locks: locked });
assert.equal(refused.ok, false);
assert.match(refused.reason, /locked/);
const moved = placeAt(sunk, layout, { wallId: 'sink', start: 60, bank: 'base' }, 10, SKU);
assert.equal(moved.ok, false);
const issueList = checks(sunk, layout, SKU);
assert.equal(issueList.some((issue) => issue.id === 'order-ready'), false);
assert.ok(issueList.some((issue) => issue.id === 'missing'));
const bill = parts(layout, SKU);
assert.equal(bill.some((line) => line.price != null || /price|\$|quote/i.test(JSON.stringify(line))), false);
assert.ok(bill.some((line) => line.skuId === 'SB36'));
assert.ok(bill.some((line) => /toe kick/i.test(line.name)));
assert.equal(banksForScope('lowers').includes('upper'), false);
assert.match(scopeNote('kitchen', 'Sage Green', layout, SKU), /Entire kitchen/);
assert.match(scopeNote('lowers', 'Sage Green', layout, SKU), /Uppers stay/);
assert.equal(handedTwin(SKU.get('W1230-L'), SKU)?.id, 'W1230-R');
assert.equal(handedTwin(SKU.get('B12-R'), SKU), null);
assert.ok(chainText(ROOM, drawers.rows, SKU)[0].includes('169.5'));

console.log('review.test.js ok');
