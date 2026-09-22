import assert from 'node:assert/strict';
import { packRoom } from './pack.js';

const ROOM = {
  walls: [
    { id: 'range', length: 169.5, openings: [{ kind: 'range', width: 30, start: 42 }] },
    { id: 'sink', length: 128.25, openings: [] },
  ],
};
const BASES = [
  { id: 'BBC39-L', width: 39, height: 34.5, depth: 24 },
  { id: 'SB36', width: 36, height: 34.5, depth: 24 },
  { id: 'BWB18', width: 18, height: 34.5, depth: 24 },
  { id: 'B15-L', width: 15, height: 34.5, depth: 24 },
  { id: 'B12-R', width: 12, height: 34.5, depth: 24 },
];
const UPPERS = [
  { id: 'W3630', width: 36, height: 36, depth: 12 },
  { id: 'W3015', width: 30, height: 15, depth: 12 },
  { id: 'W2730', width: 27, height: 36, depth: 12 },
  { id: 'W1230-L', width: 12, height: 36, depth: 12 },
];
const CUT_FACE = { height: 34.5, depth: 24 };

function footprint(row, skus) {
  const width = row.cut ? row.width : skus.find((sku) => sku.id === row.skuId).width;
  const depth = row.cut ? row.depth : skus.find((sku) => sku.id === row.skuId).depth;
  const along = [row.start, row.start + width];
  return row.wallId === 'sink'
    ? { x: [0, depth], z: along }
    : { x: along, z: [0, depth] };
}

function overlap([a0, a1], [b0, b1]) {
  return Math.min(a1, b1) - Math.max(a0, b0);
}

function label(row) {
  return `${row.wallId}/${row.cut ? `cut ${row.width}` : row.skuId}@${row.start}`;
}

function collisions(rows, skus) {
  const boxes = rows.map((row) => ({ row, ...footprint(row, skus) }));
  const out = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const dx = overlap(boxes[i].x, boxes[j].x);
      const dz = overlap(boxes[i].z, boxes[j].z);
      if (dx > 1e-9 && dz > 1e-9) out.push(`${label(boxes[i].row)} x ${label(boxes[j].row)} shares ${dx} x ${dz} in`);
    }
  }
  return out;
}

const bases = packRoom(ROOM, BASES, CUT_FACE);
const uppers = packRoom(ROOM, UPPERS);
console.log('bases ', bases.map(label).join(' '));
console.log('uppers', uppers.map(label).join(' '));

assert.deepEqual(collisions(bases, BASES), [], 'base footprints share floor');
assert.deepEqual(collisions(uppers, UPPERS), [], 'upper footprints share floor');

const sinkBase = bases.find((row) => row.wallId === 'sink');
const sinkUpper = uppers.find((row) => row.wallId === 'sink');
assert.equal(sinkBase.start, 27, 'sink base return starts past the 24 in corner box and a 3 in filler');
assert.equal(sinkUpper.start, 15, 'sink upper return starts past the 12 in corner box and a 3 in filler');

assert.equal(bases.find((row) => row.wallId === 'range').start, 0, 'range wall keeps the corner');
for (const row of bases) {
  const wall = ROOM.walls.find((item) => item.id === row.wallId);
  const width = row.cut ? row.width : BASES.find((sku) => sku.id === row.skuId).width;
  assert.ok(row.start + width <= wall.length + 1e-9, `${label(row)} runs past the wall`);
  if (row.wallId === 'range') assert.ok(row.start + width <= 42 || row.start >= 72, `${label(row)} sits in the range opening`);
}

const oneWall = packRoom({ walls: [ROOM.walls[1]] }, BASES, CUT_FACE);
assert.equal(oneWall[0].start, 27, 'a lone sink wall is still taped from the inside corner');

console.log('pack.test.js ok');
