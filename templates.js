import './planner.js';
import { FILLER, SKU, pick } from './inventory.js';
import { findRow, handedTwin, isLocked, isSinkBase, packFunctional, placeAt, refusal, replaceRow } from './pack.js';
import { chainText, cornerNote, countLine, counts, gapLabel, missingPositions, planPieces, rowLabel, wallName } from './review.js';

const TEMPLATE_KEY = 'turbo-studio-template';
const STATE_KEY = 'turbo-cabinet-studio-v5';
const CUT_FACE = { height: 34.5, depth: 24 };
const UPPER = pick(['WBC2730-L', 'W3630', 'W3015', 'W2730', 'W1230-L']);

const RECIPES = [
  {
    id: 'drawers',
    name: 'More drawers',
    blurb: 'Drawer bases on the open runs. A sink base is used only where a sink is taped.',
    skus: pick(['BBC39-L', 'BWB18', 'SB36']),
    uppers: UPPER,
  },
  {
    id: 'cabinets',
    name: 'More cabinets',
    blurb: 'Narrower storage bases, so the same walls get more doors.',
    skus: pick(['BBC39-L', 'B12-R', 'B15-L', 'SB36']),
    uppers: pick(['WBC2730-L', 'W1230-L', 'W1230-R', 'W2730', 'W3015']),
  },
  {
    id: 'fillers',
    name: 'Fill the gaps',
    blurb: 'Drawer bases, then 3-inch fillers from stock. Inches that are left are an unresolved gap, not a cut cabinet.',
    skus: pick(['BBC39-L', 'BWB18', 'B15-L', 'B12-R', 'F3-base', 'SB36']),
    uppers: pick(['WBC2730-L', 'W3630', 'W3015', 'W2730', 'F3-upper', 'W1230-L']),
  },
];

let selected = null;

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
  const bases = packFunctional(room, recipe.skus, { bank: 'base', cutFace: CUT_FACE, filler: FILLER.base });
  const uppers = packFunctional(room, recipe.uppers, { bank: 'upper', filler: FILLER.upper });
  return { rows: [...bases.rows, ...uppers.rows], notes: [...bases.notes, ...uppers.notes] };
}

function bankOf(row) {
  return row.cut ? 'base' : SKU.get(row.skuId)?.bank || 'base';
}

function signature(rows) {
  return rows.map((row) => (row.cut ? `${row.wallId}:gap:${row.width}` : `${row.wallId}:${row.skuId}@${row.start}`)).join('|');
}

function baseUnits(rows) {
  return rows.filter((row) => !row.cut && bankOf(row) === 'base' && !SKU.get(row.skuId)?.blind && SKU.get(row.skuId)?.kind !== 'filler').length;
}

function gapInches(rows) {
  return rows.filter((row) => row.cut && bankOf(row) === 'base').reduce((sum, row) => sum + row.width, 0);
}

function recipesFor(room) {
  const packed = RECIPES.map((recipe) => ({ ...recipe, ...packRecipe(room, recipe) }));
  const drawers = packed.find((recipe) => recipe.id === 'drawers');
  const seen = new Set();
  const out = [];
  for (const recipe of packed) {
    if (!recipe.rows.length) continue;
    if (recipe.id === 'cabinets' && drawers && baseUnits(recipe.rows) <= baseUnits(drawers.rows)) continue;
    if (recipe.id === 'fillers' && drawers && gapInches(recipe.rows) >= gapInches(drawers.rows) - 1e-6 && counts(recipe.rows, SKU).filler <= counts(drawers.rows, SKU).filler) continue;
    const key = signature(recipe.rows);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(recipe);
  }
  return out.length ? out : packed.slice(0, 1);
}

function applyRows(id, rows, locks = loadPick()?.locks || []) {
  savePick({ id, rows, locks });
  globalThis.STUDIO_LAYOUT_OVERRIDE = { rows };
  if (typeof globalThis.STUDIO_REFRESH === 'function') globalThis.STUDIO_REFRESH();
  globalThis.STUDIO_SYNC?.();
}

function chooseTemplate(recipe) {
  globalThis.STUDIO_PUSH_HISTORY?.();
  select(null);
  markPressed(recipe.id);
  globalThis.STUDIO_SET_PHASE?.('ready');
  applyRows(recipe.id, recipe.rows, []);
}

function markPressed(id) {
  document.querySelectorAll('#template-list [data-template]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.template === id));
  });
}

function svgEl(name) {
  return document.createElementNS('http://www.w3.org/2000/svg', name);
}

function miniPlan(room, rows) {
  const range = room.walls.find((wall) => wall.id === 'range');
  const sink = room.walls.find((wall) => wall.id === 'sink');
  const svg = svgEl('svg');
  svg.setAttribute('viewBox', '0 0 280 168');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Floor plan of this suggestion');
  const scale = Math.min(240 / (range?.length || 1), 120 / (sink?.length || 1));
  const ox = 16;
  const oy = 16;
  for (const piece of planPieces(room, rows, SKU)) {
    if (piece.bank !== 'base') continue;
    const rect = svgEl('rect');
    if (piece.wallId === 'sink') {
      rect.setAttribute('x', ox);
      rect.setAttribute('y', oy + piece.start * scale);
      rect.setAttribute('width', Math.max(24 * scale, 3));
      rect.setAttribute('height', Math.max(piece.width * scale, 1));
    } else {
      rect.setAttribute('x', ox + piece.start * scale);
      rect.setAttribute('y', oy);
      rect.setAttribute('width', Math.max(piece.width * scale, 1));
      rect.setAttribute('height', Math.max(24 * scale, 3));
    }
    rect.setAttribute('fill', piece.cut ? '#f3e2c2' : piece.sink ? '#d5e4f5' : piece.blind ? '#e4e7df' : '#fff');
    rect.setAttribute('stroke', '#29372e');
    rect.setAttribute('stroke-width', piece.cut ? '1' : '1.4');
    if (piece.cut) rect.setAttribute('stroke-dasharray', '3 2');
    svg.append(rect);
  }
  return svg;
}

function renderTemplates(room) {
  const list = document.querySelector('#template-list');
  if (!list || !room?.walls?.length) return;
  const stored = loadPick();
  const missing = missingPositions(room);
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
    button.append(title, blurb, miniPlan(room, recipe.rows));
    const summary = document.createElement('p');
    summary.textContent = countLine(recipe.rows, SKU);
    button.append(summary);
    if (missing.length) {
      const open = document.createElement('p');
      open.textContent = `${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} not taped, so those spots stay unresolved.`;
      button.append(open);
    }
    for (const note of recipe.notes || []) {
      const line = document.createElement('p');
      line.textContent = note;
      button.append(line);
    }
    const corner = document.createElement('p');
    corner.textContent = cornerNote(recipe.rows, SKU);
    button.append(corner);
    for (const line of chainText(room, recipe.rows, SKU)) {
      const math = document.createElement('p');
      math.textContent = line;
      button.append(math);
    }
    const skus = document.createElement('p');
    skus.textContent = recipe.rows.filter((row) => row.wallId && bankOf(row) === 'base').map((row) => (row.cut ? gapLabel(row) : row.skuId)).join(' · ');
    button.append(skus);
    button.addEventListener('click', () => chooseTemplate(recipe));
    return button;
  }));
  globalThis.STUDIO_SYNC?.();
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

function catalogQuery() {
  const search = document.querySelector('#catalog-search')?.value?.trim().toLowerCase() || '';
  const role = document.querySelector('#catalog-role')?.value || 'all';
  const width = document.querySelector('#catalog-width')?.value?.trim();
  return { search, role, width: width ? Number(width) : null };
}

function roleOf(sku) {
  if (!sku) return '';
  if (sku.blind) return 'corner';
  if (sku.kind === 'filler') return 'filler';
  if (sku.id === 'SB36' || /^sink base$/i.test(sku.name || '')) return 'sink';
  if (/drawer/i.test(sku.name || '')) return 'drawer';
  if (sku.bank === 'upper') return 'upper';
  return 'storage';
}

function optionRows(room, rows, target) {
  const row = findRow(rows, target, SKU);
  const current = row && SKU.get(row.skuId);
  if (!current) return [];
  const query = catalogQuery();
  return [...SKU.values()].filter((sku) => sku.bank === current.bank && sku.kind !== 'appliance').filter((sku) => {
    if (query.role !== 'all' && roleOf(sku) !== query.role) return false;
    if (query.width != null && Number.isFinite(query.width) && Math.abs(sku.width - query.width) > 1e-6) return false;
    if (!query.search) return true;
    return `${sku.id} ${sku.name || ''}`.toLowerCase().includes(query.search);
  }).map((sku) => ({ sku, reason: sku.id === row.skuId ? '' : refusal(room, rows, target, sku, SKU) }));
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
    globalThis.STUDIO_SYNC?.();
    return;
  }
  const currentSku = SKU.get(row.skuId);
  const options = optionRows(room, stored.rows, selected);
  const fits = options.filter((option) => !option.reason);
  title.textContent = `${currentSku?.name || row.skuId}`;
  note.textContent = 'The rest of this run refits around the cabinet you pick. Locked cabinets stay where they are.';
  const current = document.querySelector('#swap-current');
  if (current) {
    current.replaceChildren();
    const facts = document.createElement('p');
    facts.className = 'inspector-facts';
    const twin = handedTwin(currentSku, SKU);
    facts.textContent = `${row.skuId} · ${wallName(row.wallId)} · ${bankOf(row) === 'upper' ? 'upper' : 'base'} · W ${inches(currentSku?.width || row.width || 0)} H ${inches(currentSku?.height || 0)} D ${inches(currentSku?.depth || 0)} · offset ${inches(row.start)} in${twin ? '' : ' · this cabinet has no opposite hand in stock'}`;
    current.append(facts);
    const offset = document.createElement('label');
    offset.textContent = 'Offset from the inside corner (inches)';
    const input = document.createElement('input');
    input.id = 'move-offset';
    input.inputMode = 'decimal';
    input.value = inches(row.start);
    input.addEventListener('change', () => moveTo(Number(input.value)));
    offset.append(input);
    const lock = document.createElement('button');
    lock.type = 'button';
    lock.id = 'lock-cabinet';
    const locked = isLocked(stored.locks, row, bankOf(row));
    lock.setAttribute('aria-pressed', String(locked));
    lock.textContent = locked ? 'Unlock' : 'Lock';
    lock.addEventListener('click', () => toggleLock());
    const handing = document.createElement('button');
    handing.type = 'button';
    handing.id = 'handing';
    handing.hidden = !twin;
    handing.textContent = twin ? `Handing ${twin.id}` : '';
    if (twin) handing.addEventListener('click', () => swap(twin.id));
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.id = 'remove-cabinet';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => removeSelected());
    const duplicate = document.createElement('button');
    duplicate.type = 'button';
    duplicate.id = 'duplicate-cabinet';
    duplicate.textContent = 'Duplicate';
    duplicate.addEventListener('click', () => duplicateSelected());
    current.append(offset, lock, handing, remove, duplicate);
    const preview = document.createElement('p');
    preview.id = 'refit-preview';
    preview.textContent = 'Pick a cabinet to see which neighbors refit.';
    current.append(preview);
  }
  list.replaceChildren(...options.map((option) => {
    const button = skuCard(option.sku, option.sku.id === row.skuId);
    button.disabled = Boolean(option.reason);
    if (option.reason) {
      const why = document.createElement('span');
      why.className = 'sku-size';
      why.textContent = option.reason;
      button.append(why);
    }
    if (!option.reason && option.sku.id !== row.skuId) {
      button.addEventListener('click', () => swap(option.sku.id));
      button.addEventListener('focus', () => previewRefit(option.sku.id));
      button.addEventListener('pointerenter', () => previewRefit(option.sku.id));
    }
    return button;
  }));
  if (!fits.length) note.textContent = 'Nothing else in stock fits this spot. The reason is on each card.';
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
  const hint = document.querySelector('#select-hint');
  if (hint) hint.hidden = true;
  globalThis.STUDIO_SYNC?.();
}

function previewRefit(skuId) {
  const room = storedRoom();
  const stored = loadPick();
  const preview = document.querySelector('#refit-preview');
  if (!room || !stored || !selected || !preview) return;
  const recipe = recipeOf(stored.id);
  const skus = selected.bank === 'upper' ? recipe.uppers : recipe.skus;
  const result = replaceRow(room, stored.rows, selected, skuId, skus, { cutFace: selected.bank === 'upper' ? { height: 36, depth: 12 } : CUT_FACE, inventory: SKU, locks: stored.locks || [] });
  if (!result.ok) {
    preview.textContent = result.reason;
    return;
  }
  const names = [...(result.removed || []), ...(result.filled || [])].map((row) => rowLabel(row, SKU));
  preview.textContent = names.length
    ? `This refits ${names.join(', ')}. Locked cabinets stay.`
    : 'The neighbors stay. Locked cabinets stay.';
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
  const result = replaceRow(room, stored.rows, selected, skuId, skus, { cutFace: selected.bank === 'upper' ? { height: 36, depth: 12 } : CUT_FACE, inventory: SKU, locks: stored.locks || [] });
  if (!result.ok) {
    const preview = document.querySelector('#refit-preview');
    if (preview) preview.textContent = result.reason;
    return;
  }
  globalThis.STUDIO_PUSH_HISTORY?.();
  applyRows(stored.id, result.rows, stored.locks || []);
  selected = { ...selected, skuId, start: selected.start };
  renderSwap();
}

function moveTo(start) {
  const room = storedRoom();
  const stored = loadPick();
  if (!room || !stored || !selected || !Number.isFinite(start)) return;
  const result = placeAt(room, stored.rows, selected, start, SKU, stored.locks || []);
  const preview = document.querySelector('#refit-preview');
  if (!result.ok) {
    if (preview) preview.textContent = result.reason;
    const input = document.querySelector('#move-offset');
    if (input && selected) input.value = inches(selected.start);
    return;
  }
  globalThis.STUDIO_PUSH_HISTORY?.();
  applyRows(stored.id, result.rows, stored.locks || []);
  selected = { ...selected, start };
  renderSwap();
}

function removeSelected() {
  const stored = loadPick();
  const preview = document.querySelector('#refit-preview');
  const row = selected && stored ? findRow(stored.rows, selected, SKU) : null;
  const sku = row && SKU.get(row.skuId);
  if (!row || !sku || sku.kind === 'filler') {
    if (preview) preview.textContent = 'Fillers and gaps stay put. Swap a cabinet, or pick another layout.';
    return;
  }
  if (sku.blind) {
    if (preview) preview.textContent = 'The blind corner stays where the two walls meet.';
    return;
  }
  if (isSinkBase(sku)) {
    if (preview) preview.textContent = 'This sink base stays with the taped sink.';
    return;
  }
  if (isLocked(stored.locks, row, bankOf(row))) {
    if (preview) preview.textContent = 'This cabinet is locked.';
    return;
  }
  const next = stored.rows.map((item) => (item === row ? { cut: true, wallId: row.wallId, start: row.start, width: sku.width, height: sku.height, depth: sku.depth } : item));
  globalThis.STUDIO_PUSH_HISTORY?.();
  applyRows(stored.id, next, stored.locks || []);
  select(null);
}

function duplicateSelected() {
  const stored = loadPick();
  const preview = document.querySelector('#refit-preview');
  const row = selected && stored ? findRow(stored.rows, selected, SKU) : null;
  const sku = row && SKU.get(row.skuId);
  if (!row || !sku || sku.kind === 'filler' || sku.blind) {
    if (preview) preview.textContent = 'Duplicate a storage cabinet, not a filler or the corner.';
    return;
  }
  const bank = bankOf(row);
  const gap = stored.rows
    .filter((item) => item.wallId === row.wallId && bankOf(item) === bank && item.start > row.start + 1e-6)
    .sort((a, b) => a.start - b.start)[0];
  if (!gap?.cut || gap.width + 1e-6 < sku.width) {
    if (preview) preview.textContent = `No open gap beside this cabinet is wide enough for another ${sku.id}.`;
    return;
  }
  const rest = Math.round((gap.width - sku.width) * 1000) / 1000;
  const copy = { skuId: sku.id, wallId: row.wallId, start: gap.start };
  const rows = stored.rows.flatMap((item) => {
    if (item !== gap) return [item];
    return rest > 0.05 ? [copy, { ...gap, start: gap.start + sku.width, width: rest }] : [copy];
  });
  globalThis.STUDIO_PUSH_HISTORY?.();
  applyRows(stored.id, rows, stored.locks || []);
  select({ ...selected, start: copy.start, skuId: sku.id });
}

function toggleLock() {
  const stored = loadPick();
  if (!stored || !selected) return;
  const bank = selected.bank;
  const locks = stored.locks || [];
  const on = isLocked(locks, selected, bank);
  const next = on
    ? locks.filter((lock) => !(lock.wallId === selected.wallId && lock.bank === bank && Math.abs(lock.start - selected.start) < 1e-9))
    : [...locks, { wallId: selected.wallId, start: selected.start, bank }];
  globalThis.STUDIO_PUSH_HISTORY?.();
  applyRows(stored.id, stored.rows, next);
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
  globalThis.STUDIO_ANNOTATE_ROOM?.(room);
  select(null);
  clearPick();
  persistRoom(room);
  if (globalThis.STUDIO_STATE) globalThis.STUDIO_STATE.room = room;
  renderTemplates(room);
  globalThis.STUDIO_SET_PHASE?.('templates');
}

function migrate(stored, room) {
  if (!stored || !room || stored.rows.some((row) => bankOf(row) === 'upper')) return stored;
  const uppers = packFunctional(room, recipeOf(stored.id).uppers, { bank: 'upper', filler: FILLER.upper });
  const rows = [...stored.rows, ...uppers.rows];
  savePick({ id: stored.id, rows, locks: stored.locks || [] });
  return { id: stored.id, rows, locks: stored.locks || [] };
}

function renderStock() {
  const list = document.querySelector('#stock-list');
  if (!list) return;
  const query = catalogQuery();
  const cards = [...SKU.values()].filter((sku) => sku.kind !== 'appliance').filter((sku) => {
    if (query.role !== 'all' && roleOf(sku) !== query.role) return false;
    if (query.width != null && Number.isFinite(query.width) && Math.abs(sku.width - query.width) > 1e-6) return false;
    if (!query.search) return true;
    return `${sku.id} ${sku.name || ''}`.toLowerCase().includes(query.search);
  }).map((sku) => {
    const card = skuCard(sku, false);
    card.disabled = true;
    card.title = 'Click a cabinet in the plan to replace it with one that fits.';
    return card;
  });
  list.replaceChildren(...cards);
}

function bootTemplates() {
  globalThis.STUDIO_ON_ROOM_CONFIRMED = onRoomConfirmed;
  globalThis.STUDIO_HAS_TEMPLATE = () => Boolean(loadPick() || globalThis.STUDIO_LAYOUT_OVERRIDE?.rows);
  globalThis.STUDIO_SELECT = select;
  globalThis.STUDIO_SELECTION = () => selected;
  globalThis.STUDIO_ROWS = () => loadPick()?.rows || [];
  globalThis.STUDIO_LOCKS = () => loadPick()?.locks || [];
  globalThis.STUDIO_ROOM = storedRoom;
  globalThis.STUDIO_APPLY_ROWS = (rows, locks) => {
    const stored = loadPick();
    applyRows(stored?.id || 'drawers', rows, locks || stored?.locks || []);
    renderSwap();
  };
  document.querySelector('#open-door')?.addEventListener('click', () => {
    globalThis.STUDIO_TOGGLE_DOOR?.();
    renderSwap();
  });
  for (const id of ['catalog-search', 'catalog-width']) {
    document.querySelector('#' + id)?.addEventListener('input', () => { renderStock(); renderSwap(); });
  }
  document.querySelector('#catalog-role')?.addEventListener('change', () => { renderStock(); renderSwap(); });
  renderStock();
  const room = storedRoom();
  const stored = migrate(loadPick(), room);
  if (stored) globalThis.STUDIO_LAYOUT_OVERRIDE = { rows: stored.rows };
  if (room) renderTemplates(room);
  if (room && stored) globalThis.STUDIO_SET_PHASE?.('ready');
  else if (room) globalThis.STUDIO_SET_PHASE?.('templates');
  document.querySelector('#swap-close')?.addEventListener('click', () => select(null));
}

bootTemplates();
