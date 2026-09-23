import { candidates, findRow, packRoom, swapRow } from './pack.js';
import { FILLER, SKU, pick } from './inventory.js';

const TEMPLATE_KEY = 'turbo-studio-template';
const STATE_KEY = 'turbo-cabinet-studio-v5';
const WALL_NAME = { range: 'Stove wall', sink: 'Sink wall' };
const CUT_FACE = { height: 34.5, depth: 24 };

const BASE = pick(['BBC39-L', 'SB36', 'BWB18', 'B15-L', 'B12-R']);
const UPPER = pick(['WBC2730-L', 'W3630', 'W3015', 'W2730', 'W1230-L']);

const RECIPES = [
  { id: 'longer', name: 'Longer boxes', blurb: 'Largest current boxes first.', skus: sortByWidth(BASE, -1), uppers: UPPER },
  { id: 'more', name: 'More cabinets', blurb: 'Smaller current boxes, more doors.', skus: sortByWidth(BASE, 1), uppers: pick(['WBC2730-L', 'W1230-L', 'W1230-R', 'W2730', 'W3015']) },
  { id: 'even', name: 'Even run', blurb: 'Mid-size boxes past the corner.', skus: pick(['BBC39-L', 'BWB18', 'B15-L', 'SB36', 'B12-R']), uppers: pick(['WBC2730-L', 'W2730', 'W1230-L', 'W3630', 'W3015']) },
  { id: 'tight', name: 'Tight fillers', blurb: 'Largest boxes, then 3-inch fillers.', skus: [...sortByWidth(BASE, -1), FILLER.base], uppers: pick(['WBC2730-L', 'W3630', 'W3015', 'W2730', 'F3-upper', 'W1230-L']) },
];

let selected = null;

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
    const stored = JSON.parse(sessionStorage.getItem(TEMPLATE_KEY) || 'null');
    return stored?.rows?.length ? stored : null;
  } catch {
    return null;
  }
}

function savePick(stored) {
  sessionStorage.setItem(TEMPLATE_KEY, JSON.stringify(stored));
}

function clearPick() {
  sessionStorage.removeItem(TEMPLATE_KEY);
  globalThis.STUDIO_LAYOUT_OVERRIDE = null;
}

function recipeOf(id) {
  return RECIPES.find((recipe) => recipe.id === id) || RECIPES[0];
}

function packRecipe(room, recipe) {
  return [
    ...packRoom(room, recipe.skus, { cutFace: CUT_FACE, filler: FILLER.base }),
    ...packRoom(room, recipe.uppers, { filler: FILLER.upper }),
  ];
}

function bankOf(row) {
  return row.cut ? 'base' : SKU.get(row.skuId)?.bank || 'base';
}

function signature(rows) {
  return rows.map((row) => (row.cut ? `${row.wallId}:cut:${row.width}` : `${row.wallId}:${row.skuId}`)).join('|');
}

function labelRow(row) {
  return row.cut ? `cut ${row.width} in` : row.skuId;
}

function wallLine(room, rows, wallId) {
  const wall = room.walls.find((item) => item.id === wallId);
  const placed = rows.filter((row) => row.wallId === wallId && bankOf(row) === 'base');
  const name = WALL_NAME[wallId] || wallId;
  if (!wall) return '';
  return `${name} ${wall.length} in · ${placed.map(labelRow).join(' · ') || 'open'}`;
}

function recipesFor(room) {
  const seen = new Set();
  const out = [];
  for (const recipe of RECIPES) {
    const rows = packRecipe(room, recipe);
    if (!rows.length) continue;
    const key = signature(rows);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...recipe, rows });
  }
  return out;
}

function applyRows(id, rows) {
  savePick({ id, rows });
  globalThis.STUDIO_LAYOUT_OVERRIDE = { rows };
  if (typeof globalThis.STUDIO_REFRESH === 'function') globalThis.STUDIO_REFRESH();
}

function chooseTemplate(recipe) {
  select(null);
  markPressed(recipe.id);
  globalThis.STUDIO_SET_PHASE?.('ready');
  applyRows(recipe.id, recipe.rows);
}

function markPressed(id) {
  document.querySelectorAll('#template-list [data-template]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.template === id));
  });
}

function renderTemplates(room) {
  const list = document.querySelector('#template-list');
  if (!list || !room?.walls?.length) return;
  const stored = loadPick();
  list.replaceChildren(...recipesFor(room).map((recipe) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'template-card';
    button.dataset.template = recipe.id;
    button.setAttribute('aria-pressed', String(stored?.id === recipe.id));
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

// Lego swap. A click on a placed box selects it. The panel lists the current boxes that
// fit there; choosing one replaces it and refits the rest of that run.
function describe(row) {
  const sku = SKU.get(row.skuId);
  const bank = sku?.bank === 'upper' ? 'upper' : 'base';
  return `${row.skuId} · ${WALL_NAME[row.wallId] || row.wallId} ${bank} at ${row.start} in`;
}

function inches(value) {
  return String(Math.round(value * 1000) / 1000);
}

function skuCard(sku, pressed) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'sku-card';
  button.setAttribute('aria-pressed', String(pressed));
  const id = document.createElement('strong');
  id.textContent = sku.id;
  const name = document.createElement('span');
  name.className = 'sku-name';
  name.textContent = sku.name || sku.id;
  const size = document.createElement('span');
  size.className = 'sku-size';
  size.textContent = `W ${inches(sku.width)}  H ${inches(sku.height)}  D ${inches(sku.depth)}`;
  button.append(id, name, size);
  return button;
}

function selectionKey(target) {
  return target ? `${target.wallId}:${target.start}:${target.bank}` : '';
}

function renderSwap() {
  const panel = document.querySelector('#swap');
  const list = document.querySelector('#swap-list');
  const title = document.querySelector('#swap-title');
  const note = document.querySelector('#swap-note');
  if (!panel || !list) return;
  const room = storedRoom();
  const stored = loadPick();
  const row = selected && stored && room ? findRow(stored.rows, selected, SKU) : null;
  if (!row) {
    panel.hidden = true;
    list.replaceChildren();
    document.querySelector('#swap-current')?.replaceChildren();
    const door = document.querySelector('#open-door');
    if (door) door.hidden = true;
    globalThis.STUDIO_HIGHLIGHT?.(null);
    return;
  }
  const options = candidates(room, stored.rows, selected, SKU);
  const currentSku = SKU.get(row.skuId);
  title.textContent = describe(row);
  note.textContent = options.length
    ? 'Pick another current cabinet for this spot. The rest of that run refits.'
    : 'This piece stays. The blind corner, its fillers, and the openings shape the room.';
  const current = document.querySelector('#swap-current');
  if (current) {
    current.replaceChildren();
    if (currentSku) {
      const card = skuCard(currentSku, true);
      card.dataset.catalog = currentSku.id;
      current.append(card);
    }
  }
  list.replaceChildren(...options.map((sku) => {
    const button = skuCard(sku, sku.id === row.skuId);
    button.dataset.swap = sku.id;
    button.addEventListener('click', () => swap(sku.id));
    return button;
  }));
  const door = document.querySelector('#open-door');
  const canOpen = currentSku && (currentSku.kind === 'base' || currentSku.kind === 'upper');
  if (door) {
    const open = canOpen && globalThis.STUDIO_DOOR_OPEN?.() === selectionKey(selected);
    door.hidden = !canOpen;
    door.setAttribute('aria-pressed', String(Boolean(open)));
    door.textContent = open ? 'Close door' : 'Open door';
  }
  panel.hidden = false;
  globalThis.STUDIO_HIGHLIGHT?.({ ...selected, skuId: row.skuId });
}

function select(target) {
  const next = target ? { wallId: target.wallId, start: target.start, skuId: target.skuId, bank: target.bank || SKU.get(target.skuId)?.bank || 'base' } : null;
  if (globalThis.STUDIO_DOOR_OPEN?.() && globalThis.STUDIO_DOOR_OPEN() !== selectionKey(next)) globalThis.STUDIO_CLOSE_DOOR?.();
  selected = next;
  renderSwap();
}

function swap(skuId) {
  const room = storedRoom();
  const stored = loadPick();
  if (!room || !stored || !selected) return;
  const recipe = recipeOf(stored.id);
  const skus = selected.bank === 'upper' ? recipe.uppers : recipe.skus;
  const rows = swapRow(room, stored.rows, selected, skuId, skus, { cutFace: selected.bank === 'upper' ? null : CUT_FACE, inventory: SKU });
  if (rows === stored.rows) return;
  applyRows(stored.id, rows);
  renderSwap();
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
  select(null);
  clearPick();
  persistRoom(room);
  renderTemplates(room);
  globalThis.STUDIO_SET_PHASE?.('templates');
}

// Picks saved before uppers joined the layout carry bases only. Pack the uppers once so
// the assembled kitchen and Save job see the whole layout.
function migrate(stored, room) {
  if (!stored || !room || stored.rows.some((row) => bankOf(row) === 'upper')) return stored;
  const rows = [...stored.rows, ...packRoom(room, recipeOf(stored.id).uppers, { filler: FILLER.upper })];
  savePick({ id: stored.id, rows });
  return { id: stored.id, rows };
}

function bootTemplates() {
  globalThis.STUDIO_ON_ROOM_CONFIRMED = onRoomConfirmed;
  globalThis.STUDIO_HAS_TEMPLATE = () => Boolean(loadPick() || globalThis.STUDIO_LAYOUT_OVERRIDE?.rows);
  globalThis.STUDIO_SELECT = select;
  globalThis.STUDIO_SELECTION = () => selected;
  document.querySelector('#open-door')?.addEventListener('click', () => {
    globalThis.STUDIO_TOGGLE_DOOR?.();
    renderSwap();
  });
  const room = storedRoom();
  const stored = migrate(loadPick(), room);
  if (stored) globalThis.STUDIO_LAYOUT_OVERRIDE = { rows: stored.rows };
  if (room) renderTemplates(room);
  if (room && stored) globalThis.STUDIO_SET_PHASE?.('ready');
  else if (room) globalThis.STUDIO_SET_PHASE?.('templates');
  document.querySelector('#swap-close')?.addEventListener('click', () => select(null));
}

bootTemplates();
