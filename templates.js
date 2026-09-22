import { packRoom } from './pack.js';

const TEMPLATE_KEY = 'turbo-studio-template';
const STATE_KEY = 'turbo-cabinet-studio-v5';
const WALL_NAME = { range: 'Stove wall', sink: 'Sink wall' };
const CUT_FACE = { height: 34.5, depth: 24 };

const BASE = [
  { id: 'BBC39-L', kind: 'base', width: 39, height: 34.5, depth: 24 },
  { id: 'SB36', kind: 'base', width: 36, height: 34.5, depth: 24 },
  { id: 'BWB18', kind: 'base', width: 18, height: 34.5, depth: 24 },
  { id: 'B15-L', kind: 'base', width: 15, height: 34.5, depth: 24 },
  { id: 'B12-R', kind: 'base', width: 12, height: 34.5, depth: 24 },
];
const FILLER = { id: 'F3-base', kind: 'filler', width: 3, height: 34.5, depth: 24 };

const RECIPES = [
  { id: 'longer', name: 'Longer boxes', blurb: 'Largest current boxes first.', skus: sortByWidth(BASE, -1) },
  { id: 'more', name: 'More cabinets', blurb: 'Smaller current boxes, more doors.', skus: sortByWidth(BASE, 1) },
  { id: 'even', name: 'Even run', blurb: 'Mid-size boxes, no 39-inch corner.', skus: [BASE[2], BASE[3], BASE[1], BASE[4]] },
  { id: 'tight', name: 'Tight fillers', blurb: 'Largest boxes, then 3-inch fillers.', skus: [...sortByWidth(BASE, -1), FILLER] },
];

function sortByWidth(skus, dir) {
  return [...skus].sort((a, b) => (a.width - b.width) * dir);
}

function storedRoom() {
  try {
    return JSON.parse(localStorage.getItem(STATE_KEY) || 'null')?.room || null;
  } catch {
    return null;
  }
}

function loadPick() {
  try {
    const pick = JSON.parse(sessionStorage.getItem(TEMPLATE_KEY) || 'null');
    return pick?.rows?.length ? pick : null;
  } catch {
    return null;
  }
}

function savePick(pick) {
  sessionStorage.setItem(TEMPLATE_KEY, JSON.stringify(pick));
}

function clearPick() {
  sessionStorage.removeItem(TEMPLATE_KEY);
  globalThis.STUDIO_LAYOUT_OVERRIDE = null;
}

function signature(rows) {
  return rows.map((row) => (row.cut ? `${row.wallId}:cut:${row.width}` : `${row.wallId}:${row.skuId}`)).join('|');
}

function labelRow(row) {
  return row.cut ? `cut ${row.width} in` : row.skuId;
}

function wallLine(room, rows, wallId) {
  const wall = room.walls.find((item) => item.id === wallId);
  const placed = rows.filter((row) => row.wallId === wallId);
  const name = WALL_NAME[wallId] || wallId;
  if (!wall) return '';
  return `${name} ${wall.length} in · ${placed.map(labelRow).join(' · ') || 'open'}`;
}

function recipesFor(room) {
  const seen = new Set();
  const out = [];
  for (const recipe of RECIPES) {
    const rows = packRoom(room, recipe.skus, CUT_FACE);
    if (!rows.length) continue;
    const key = signature(rows);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...recipe, rows });
  }
  return out;
}

function applyLayoutView() {
  const interactive = document.querySelector('[data-mode=interactive]');
  interactive?.click();
  if (typeof globalThis.STUDIO_REFRESH === 'function') globalThis.STUDIO_REFRESH();
}

function chooseTemplate(recipe, { refresh = true } = {}) {
  savePick({ id: recipe.id, rows: recipe.rows });
  globalThis.STUDIO_LAYOUT_OVERRIDE = { rows: recipe.rows };
  markPressed(recipe.id);
  globalThis.STUDIO_SET_PHASE?.('ready');
  if (refresh) applyLayoutView();
}

function markPressed(id) {
  document.querySelectorAll('#template-list [data-template]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.template === id));
  });
}

function renderTemplates(room) {
  const list = document.querySelector('#template-list');
  if (!list || !room?.walls?.length) return;
  const pick = loadPick();
  list.replaceChildren(...recipesFor(room).map((recipe) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'template-card';
    button.dataset.template = recipe.id;
    button.setAttribute('aria-pressed', String(pick?.id === recipe.id));
    const title = document.createElement('strong');
    title.textContent = recipe.name;
    const blurb = document.createElement('p');
    blurb.textContent = recipe.blurb;
    const range = document.createElement('p');
    range.textContent = wallLine(room, recipe.rows, 'range');
    const sink = document.createElement('p');
    sink.textContent = wallLine(room, recipe.rows, 'sink');
    button.append(title, blurb, range, sink);
    button.addEventListener('click', () => chooseTemplate(recipe));
    return button;
  }));
}

function persistRoom(room) {
  try {
    const state = JSON.parse(localStorage.getItem(STATE_KEY) || '{}') || {};
    state.room = room;
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota */
  }
}

function onRoomConfirmed(room) {
  clearPick();
  persistRoom(room);
  renderTemplates(room);
  globalThis.STUDIO_SET_PHASE?.('templates');
}

function bootTemplates() {
  globalThis.STUDIO_ON_ROOM_CONFIRMED = onRoomConfirmed;
  globalThis.STUDIO_HAS_TEMPLATE = () => Boolean(loadPick() || globalThis.STUDIO_LAYOUT_OVERRIDE?.rows);
  const pick = loadPick();
  if (pick) globalThis.STUDIO_LAYOUT_OVERRIDE = { rows: pick.rows };
  const room = storedRoom();
  if (room) renderTemplates(room);
  if (room && pick) globalThis.STUDIO_SET_PHASE?.('ready');
  else if (room) globalThis.STUDIO_SET_PHASE?.('templates');
}

bootTemplates();
