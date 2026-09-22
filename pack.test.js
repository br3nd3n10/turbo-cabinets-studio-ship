import assert from 'node:assert/strict';
import { packRoom } from './pack.js';

const ROOM = {
  walls: [
    { id: 'range', length: 169.5, openings: [{ kind: 'range', width: 30, start: 42 }] },
    { id: 'sink', length: 128.25, openings: [] },
  ],
};
const BASES = [
  { id: 'BBC39-L', width: 39, height: 34.5, depth: 24, blind: true, frontOffset: 24, frontWidth: 15 },
  { id: 'SB36', width: 36, height: 34.5, depth: 24 },
  { id: 'BWB18', width: 18, height: 34.5, depth: 24 },
  { id: 'B15-L', width: 15, height: 34.5, depth: 24 },
  { id: 'B12-R', width: 12, height: 34.5, depth: 24 },
];
const UPPERS = [
  { id: 'WBC2730-L', width: 27, height: 36, depth: 12, blind: true, frontOffset: 12, frontWidth: 15 },
  { id: 'W3630', width: 36, height: 36, depth: 12 },
  { id: 'W3015', width: 30, height: 15, depth: 12 },
  { id: 'W2730', width: 27, height: 36, depth: 12 },
  { id: 'W1230-L', width: 12, height: 36, depth: 12 },
];
const F3_BASE = { id: 'F3-base', width: 3, height: 34.5, depth: 24 };
const F3_UPPER = { id: 'F3-upper', width: 3, height: 36, depth: 12 };
const CUT_FACE = { height: 34.5, depth: 24 };
// Doors and pulls on the sku-v1 meshes project this far past the carcass front.
const FRONT = 2.363;

function skuOf(row, skus) {
  return skus.find((sku) => sku.id === row.skuId);
}

function footprint(row, skus) {
  const width = row.cut ? row.width : skuOf(row, skus).width;
  const depth = row.cut ? row.depth : skuOf(row, skus).depth;
  const along = [row.start, row.start + width];
  return row.wallId === 'sink'
    ? { x: [0, depth], z: along }
    : { x: along, z: [0, depth] };
}

function withFront(box, row) {
  return row.wallId === 'sink'
    ? { x: [box.x[0], box.x[1] + FRONT], z: box.z }
    : { x: box.x, z: [box.z[0], box.z[1] + FRONT] };
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

function cornerDoorBlockers(rows, skus) {
  const corner = rows.find((row) => row.wallId === 'range' && skuOf(row, skus)?.blind);
  if (!corner) return ['no blind corner box on the range wall'];
  const sku = skuOf(corner, skus);
  const swing = {
    x: [corner.start + sku.frontOffset, corner.start + sku.frontOffset + sku.frontWidth],
    z: [sku.depth, sku.depth + sku.frontWidth],
  };
  return rows
    .filter((row) => row !== corner)
    .map((row) => ({ row, box: withFront(footprint(row, skus), row) }))
    .filter(({ box }) => overlap(box.x, swing.x) > 1e-9 && overlap(box.z, swing.z) > 1e-9)
    .map(({ row, box }) => `${label(row)} front x[${box.x}] z[${box.z}] stands in the corner door swing x[${swing.x}] z[${swing.z}]`);
}

function uncovered(intervals, to) {
  const gaps = [];
  let at = 0;
  for (const [start, end] of [...intervals].sort((p, q) => p[0] - q[0])) {
    if (start > at + 1e-9 && at < to) gaps.push([at, Math.min(start, to)]);
    at = Math.max(at, end);
    if (at >= to) break;
  }
  if (at < to - 1e-9) gaps.push([at, to]);
  return gaps;
}

// A real corner run is continuous: from the inside corner to the end of the first regular
// box on each wall, some carcass covers every inch. Cuts are not carcasses.
function openFloor(rows, skus) {
  const boxes = rows.filter((row) => !row.cut).map((row) => ({ row, ...footprint(row, skus) }));
  const range = boxes.filter(({ row }) => row.wallId === 'range');
  const sink = boxes.filter(({ row }) => row.wallId === 'sink');
  if (!range.length || !sink.length) return ['a wall has no boxes'];
  const rangeDepth = Math.max(...range.map((box) => box.z[1]));
  const sinkDepth = Math.max(...sink.map((box) => box.x[1]));
  const corner = range.find(({ row }) => skuOf(row, skus).blind) || range[0];
  const firstSink = sink.find(({ row }) => !/^F\d/.test(row.skuId)) || sink[0];
  const alongRange = boxes.filter((box) => box.z[0] < rangeDepth - 1e-9).map((box) => box.x);
  const alongSink = boxes.filter((box) => box.x[0] < sinkDepth - 1e-9).map((box) => box.z);
  return [
    ...uncovered(alongRange, corner.x[1]).map(([from, to]) => `open floor on the range wall x[${from},${to}]`),
    ...uncovered(alongSink, firstSink.z[1]).map(([from, to]) => `open floor on the sink wall z[${from},${to}]`),
  ];
}

const bases = packRoom(ROOM, BASES, { cutFace: CUT_FACE, filler: F3_BASE });
const uppers = packRoom(ROOM, UPPERS, { filler: F3_UPPER });
const BASE_SKUS = [...BASES, F3_BASE];
const UPPER_SKUS = [...UPPERS, F3_UPPER];
console.log('bases ', bases.map(label).join(' '));
console.log('uppers', uppers.map(label).join(' '));

assert.deepEqual(collisions(bases, BASE_SKUS), [], 'base footprints share floor');
assert.deepEqual(collisions(uppers, UPPER_SKUS), [], 'upper footprints share floor');
assert.deepEqual(cornerDoorBlockers(bases, BASE_SKUS), [], 'the base corner door cannot swing');
assert.deepEqual(cornerDoorBlockers(uppers, UPPER_SKUS), [], 'the upper corner door cannot swing');
assert.deepEqual(openFloor(bases, BASE_SKUS), [], 'the base corner has open floor');
assert.deepEqual(openFloor(uppers, UPPER_SKUS), [], 'the upper corner has open floor');
assert.ok(bases.some((row) => row.wallId === 'range' && row.skuId === 'F3-base' && row.start === 0), 'a 3 in filler joins the blind base to the sink wall');
assert.ok(bases.some((row) => row.wallId === 'sink' && row.skuId === 'F3-base' && row.start === 24), 'a 3 in filler joins the blind base to the sink return');
assert.ok(uppers.some((row) => row.wallId === 'range' && row.skuId === 'F3-upper' && row.start === 0), 'a 3 in filler joins the blind upper to the sink wall');
assert.ok(uppers.some((row) => row.wallId === 'sink' && row.skuId === 'F3-upper' && row.start === 12), 'a 3 in filler joins the blind upper to the sink return');

const blindBases = bases.filter((row) => row.skuId === 'BBC39-L');
const blindUppers = uppers.filter((row) => row.skuId === 'WBC2730-L');
assert.equal(blindBases.length, 1, 'one blind corner owns the inside corner');
assert.equal(blindUppers.length, 1, 'one blind upper owns the inside corner');
assert.deepEqual([blindBases[0].wallId, blindBases[0].start], ['range', 3], 'blind base pulled 3 in off the sink wall');
assert.deepEqual([blindUppers[0].wallId, blindUppers[0].start], ['range', 3], 'blind upper pulled 3 in off the sink wall');
assert.equal(bases.find((row) => row.wallId === 'sink' && !/^F\d/.test(row.skuId)).start, 27, 'sink base return starts past the 24 in corner box and a 3 in filler');
assert.equal(uppers.find((row) => row.wallId === 'sink' && !/^F\d/.test(row.skuId)).start, 15, 'sink upper return starts past the 12 in corner box and a 3 in filler');

for (const row of bases) {
  const wall = ROOM.walls.find((item) => item.id === row.wallId);
  const width = row.cut ? row.width : skuOf(row, BASE_SKUS).width;
  assert.ok(row.start + width <= wall.length + 1e-9, `${label(row)} runs past the wall`);
  if (row.wallId === 'range') assert.ok(row.start + width <= 42 || row.start >= 72, `${label(row)} sits in the range opening`);
}

const dead = packRoom(ROOM, BASES.filter((sku) => !sku.blind), { cutFace: CUT_FACE, filler: F3_BASE });
assert.deepEqual(collisions(dead, BASE_SKUS), [], 'dead corner footprints share floor');
assert.equal(dead.find((row) => row.wallId === 'range').start, 27, 'without a blind box the range run starts past a dead corner');
assert.equal(dead.find((row) => row.wallId === 'sink').start, 27, 'without a blind box the sink run starts past a dead corner');

const blocked = packRoom({ walls: [{ id: 'range', length: 40, openings: [{ kind: 'fridge', width: 36, start: 0 }] }, ROOM.walls[1]] }, BASES, { cutFace: CUT_FACE, filler: F3_BASE });
assert.equal(blocked.filter((row) => row.skuId === 'BBC39-L').length, 0, 'an opening at the corner leaves no room for a blind box');

console.log('pack.test.js ok');
