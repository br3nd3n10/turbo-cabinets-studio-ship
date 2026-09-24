import { SKU } from './inventory.js';
import { placeAt } from './pack.js';
import { STUDIO_CEILING, chainText, checks, elevationPieces, parts, planPieces, scopeNote, wallName } from './review.js';

const PROJECTS_KEY = 'turbo-studio-projects';
const STATE_KEY = 'turbo-cabinet-studio-v5';
const TEMPLATE_KEY = 'turbo-studio-template';
const past = [];
const future = [];

function svgEl(name) {
  return document.createElementNS('http://www.w3.org/2000/svg', name);
}

function snapshot() {
  const state = globalThis.STUDIO_STATE;
  return JSON.stringify({
    pick: sessionStorage.getItem(TEMPLATE_KEY),
    saved: localStorage.getItem(STATE_KEY),
    upper: state?.upper || null,
    lower: state?.lower || null,
    counter: state?.counter || null,
    floor: state?.floor || null,
    paint: globalThis.STUDIO_FINISH_OVERRIDE?.() || null,
  });
}

function pushHistory() {
  const snap = snapshot();
  if (past.at(-1) === snap) return;
  past.push(snap);
  if (past.length > 40) past.shift();
  future.length = 0;
  paintHistory();
}

function restore(raw) {
  const data = JSON.parse(raw);
  if (data.pick) sessionStorage.setItem(TEMPLATE_KEY, data.pick);
  else sessionStorage.removeItem(TEMPLATE_KEY);
  if (data.saved) localStorage.setItem(STATE_KEY, data.saved);
  const state = globalThis.STUDIO_STATE;
  const saved = data.saved ? JSON.parse(data.saved) : null;
  if (state) {
    if (data.upper) state.upper = data.upper;
    if (data.lower) state.lower = data.lower;
    if (data.counter) state.counter = data.counter;
    if (data.floor) state.floor = data.floor;
    if (saved?.room) state.room = saved.room;
  }
  const pick = data.pick ? JSON.parse(data.pick) : null;
  globalThis.STUDIO_LAYOUT_OVERRIDE = pick?.rows ? { rows: pick.rows } : null;
  globalThis.STUDIO_SET_FINISH_OVERRIDE?.(data.paint || null);
  globalThis.STUDIO_SELECT?.(null);
  globalThis.STUDIO_SET_PHASE?.(pick?.rows ? 'ready' : saved?.room ? 'templates' : 'welcome');
  globalThis.STUDIO_REDRAW?.();
  sync();
  paintHistory();
}

function undo() {
  if (!past.length) return;
  future.push(snapshot());
  restore(past.pop());
}

function redo() {
  if (!future.length) return;
  past.push(snapshot());
  restore(future.pop());
}

function paintHistory() {
  const undoButton = document.querySelector('#undo');
  const redoButton = document.querySelector('#redo');
  if (undoButton) undoButton.disabled = !past.length;
  if (redoButton) redoButton.disabled = !future.length;
}

function room() {
  return globalThis.STUDIO_ROOM?.() || null;
}

function rows() {
  return globalThis.STUDIO_ROWS?.() || [];
}

function setDraw(mode) {
  document.body.dataset.draw = mode;
  document.querySelectorAll('[data-draw]').forEach((button) => {
    if (button.dataset.draw === 'plan' || button.dataset.draw === 'three' || button.dataset.draw === 'elevation') {
      button.setAttribute('aria-pressed', String(button.dataset.draw === mode));
    }
  });
  const plan = document.querySelector('#plan-view');
  const elevation = document.querySelector('#elevation-view');
  if (plan) plan.hidden = mode !== 'plan';
  if (elevation) elevation.hidden = mode !== 'elevation';
  if (mode === 'plan') drawPlan();
  if (mode === 'elevation') drawElevation();
}

function layerOn(name) {
  const button = document.querySelector(`[data-layer="${name}"]`);
  return !button || button.getAttribute('aria-pressed') !== 'false';
}

function drawPlan() {
  const host = document.querySelector('#plan-view');
  const here = room();
  if (!host || !here) return;
  host.replaceChildren();
  const tools = document.createElement('div');
  tools.className = 'plan-tools';
  for (const [id, label] of [['base', 'Bases'], ['upper', 'Uppers']]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.layer = id;
    button.setAttribute('aria-pressed', layerOn(id) ? 'true' : 'false');
    button.textContent = label;
    button.addEventListener('click', () => {
      button.setAttribute('aria-pressed', String(button.getAttribute('aria-pressed') !== 'true'));
      drawPlan();
    });
    tools.append(button);
  }
  const range = here.walls.find((wall) => wall.id === 'range');
  const sink = here.walls.find((wall) => wall.id === 'sink');
  const scale = Math.min(640 / (range?.length || 1), 420 / (sink?.length || 1));
  const svg = svgEl('svg');
  svg.setAttribute('viewBox', `0 0 ${(range?.length || 1) * scale + 80} ${(sink?.length || 1) * scale + 80}`);
  svg.setAttribute('class', 'plan-svg');
  const ox = 48;
  const oy = 36;
  for (const piece of planPieces(here, rows(), SKU)) {
    if (piece.bank === 'upper' && !layerOn('upper')) continue;
    if (piece.bank === 'base' && !layerOn('base')) continue;
    const rect = svgEl('rect');
    const along = piece.width * scale;
    const depth = (piece.bank === 'upper' ? 12 : 24) * scale;
    if (piece.wallId === 'sink') {
      rect.setAttribute('x', ox + (piece.bank === 'upper' ? 4 : 0));
      rect.setAttribute('y', oy + piece.start * scale);
      rect.setAttribute('width', Math.max(depth, 2));
      rect.setAttribute('height', Math.max(along, 1));
    } else {
      rect.setAttribute('x', ox + piece.start * scale);
      rect.setAttribute('y', oy + (piece.bank === 'upper' ? 4 : 0));
      rect.setAttribute('width', Math.max(along, 1));
      rect.setAttribute('height', Math.max(depth, 2));
    }
    rect.setAttribute('fill', piece.cut ? '#f3e2c2' : piece.bank === 'upper' ? '#e7efe4' : '#fff');
    rect.setAttribute('stroke', '#29372e');
    rect.setAttribute('stroke-width', '2');
    if (piece.cut) rect.setAttribute('stroke-dasharray', '5 3');
    if (!piece.cut) {
      rect.style.cursor = 'pointer';
      rect.addEventListener('pointerdown', (event) => dragCabinet(event, piece, scale, ox, oy));
    }
    svg.append(rect);
    const text = svgEl('text');
    text.setAttribute('fill', '#29372e');
    text.setAttribute('font-size', '12');
    text.setAttribute('font-family', 'League Spartan, sans-serif');
    text.textContent = piece.cut ? `${Math.round(piece.width * 10) / 10}` : piece.skuId;
    if (piece.wallId === 'sink') {
      text.setAttribute('x', ox + 4);
      text.setAttribute('y', oy + (piece.start + piece.width / 2) * scale);
    } else {
      text.setAttribute('x', ox + (piece.start + 1) * scale);
      text.setAttribute('y', oy + 16);
    }
    svg.append(text);
  }
  const caption = document.createElement('p');
  caption.className = 'plan-caption';
  caption.textContent = `${chainText(here, rows(), SKU).join(' · ')} Ceiling ${here.ceiling || STUDIO_CEILING} in. Dashed marks are unresolved gaps, not cut cabinets.`;
  host.append(tools, svg, caption);
}

function dragCabinet(event, piece, scale, ox, oy) {
  event.preventDefault();
  event.stopPropagation();
  const svg = event.currentTarget.ownerSVGElement;
  const origin = { x: event.clientX, y: event.clientY };
  const move = (point) => {
    const local = new DOMPoint(point.clientX, point.clientY);
    const ctm = svg.getScreenCTM();
    if (!ctm) return piece.start;
    const mapped = local.matrixTransform(ctm.inverse());
    const along = piece.wallId === 'sink' ? (mapped.y - oy) / scale : (mapped.x - ox) / scale;
    return Math.round(along * 2) / 2;
  };
  const up = (point) => {
    window.removeEventListener('pointerup', up);
    const target = { wallId: piece.wallId, start: piece.start, skuId: piece.skuId, bank: piece.bank };
    if (Math.hypot(point.clientX - origin.x, point.clientY - origin.y) < 5) {
      globalThis.STUDIO_SELECT?.(target);
      return;
    }
    const start = move(point);
    const result = placeAt(room(), rows(), target, start, SKU, globalThis.STUDIO_LOCKS?.() || []);
    if (!result.ok) {
      const note = document.querySelector('.plan-caption');
      if (note) note.textContent = result.reason;
      return;
    }
    pushHistory();
    globalThis.STUDIO_APPLY_ROWS?.(result.rows);
    globalThis.STUDIO_SELECT?.({ ...target, start });
  };
  window.addEventListener('pointerup', up);
}

function drawElevation() {
  const host = document.querySelector('#elevation-view');
  const here = room();
  if (!host || !here) return;
  const wallId = document.body.dataset.elevationWall || 'range';
  host.replaceChildren();
  const tools = document.createElement('div');
  tools.className = 'plan-tools';
  for (const id of ['range', 'sink']) {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-pressed', String(id === wallId));
    button.textContent = wallName(id);
    button.addEventListener('click', () => {
      document.body.dataset.elevationWall = id;
      drawElevation();
    });
    tools.append(button);
  }
  const data = elevationPieces(here, rows(), SKU, wallId, here.ceiling || STUDIO_CEILING);
  const scale = Math.min(680 / (data.length || 1), 280 / (data.ceiling || 96));
  const svg = svgEl('svg');
  svg.setAttribute('viewBox', `0 0 ${data.length * scale + 36} ${data.ceiling * scale + 36}`);
  svg.setAttribute('class', 'plan-svg');
  const floor = svgEl('line');
  floor.setAttribute('x1', 16);
  floor.setAttribute('x2', 16 + data.length * scale);
  floor.setAttribute('y1', 16 + data.ceiling * scale);
  floor.setAttribute('y2', 16 + data.ceiling * scale);
  floor.setAttribute('stroke', '#29372e');
  floor.setAttribute('stroke-width', '2');
  svg.append(floor);
  const ceiling = svgEl('line');
  ceiling.setAttribute('x1', 16);
  ceiling.setAttribute('x2', 16 + data.length * scale);
  ceiling.setAttribute('y1', 16);
  ceiling.setAttribute('y2', 16);
  ceiling.setAttribute('stroke', '#29372e');
  ceiling.setAttribute('stroke-width', '1');
  svg.append(ceiling);
  const yOf = (inches) => 16 + (data.ceiling - inches) * scale;
  for (const opening of data.openings) {
    const rect = svgEl('rect');
    rect.setAttribute('x', 16 + opening.start * scale);
    rect.setAttribute('y', 16);
    rect.setAttribute('width', Math.max(opening.width * scale, 1));
    rect.setAttribute('height', data.ceiling * scale);
    rect.setAttribute('fill', 'none');
    rect.setAttribute('stroke', '#747a70');
    rect.setAttribute('stroke-dasharray', '4 3');
    svg.append(rect);
  }
  for (const cabinet of data.cabinets) {
    if (cabinet.cut || !cabinet.height) continue;
    const rect = svgEl('rect');
    rect.setAttribute('x', 16 + cabinet.start * scale);
    rect.setAttribute('y', yOf(cabinet.bottom + cabinet.height));
    rect.setAttribute('width', Math.max(cabinet.width * scale, 1));
    rect.setAttribute('height', Math.max(cabinet.height * scale, 1));
    rect.setAttribute('fill', cabinet.bank === 'upper' ? '#e7efe4' : '#fff');
    rect.setAttribute('stroke', '#29372e');
    svg.append(rect);
    rect.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      globalThis.STUDIO_SELECT?.({ wallId, start: cabinet.start, skuId: cabinet.skuId, bank: cabinet.bank });
    });
  }
  const label = document.createElement('p');
  label.className = 'plan-caption';
  label.textContent = `${wallName(wallId)} ${data.length} in · ceiling ${data.ceiling} in. Uppers use the stock mounting height.`;
  host.append(tools, svg, label);
}

function renderChecks() {
  const host = document.querySelector('#checks');
  const here = room();
  if (!host) return;
  host.replaceChildren();
  if (!here || document.body.dataset.phase === 'welcome') {
    host.hidden = true;
    return;
  }
  host.hidden = false;
  const title = document.createElement('h2');
  title.textContent = 'Checks';
  const lead = document.createElement('p');
  lead.className = 'showroom-lead';
  lead.textContent = 'A width that adds up is not an order. These are the open items.';
  host.append(title, lead);
  const list = document.createElement('ul');
  list.className = 'check-list';
  for (const issue of checks(here, rows(), SKU, { ceiling: here.ceiling || STUDIO_CEILING })) {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = issue.message;
    if (issue.wallId != null && issue.start != null) {
      button.addEventListener('click', () => {
        globalThis.STUDIO_SELECT?.({ wallId: issue.wallId, start: issue.start, skuId: issue.skuId, bank: issue.bank || 'base' });
        if (document.body.dataset.draw === 'elevation') {
          document.body.dataset.elevationWall = issue.wallId;
          drawElevation();
        }
      });
    }
    item.append(button);
    list.append(item);
  }
  host.append(list);
}

function renderParts() {
  const host = document.querySelector('#parts');
  if (!host) return;
  const here = room();
  host.replaceChildren();
  if (!here || !rows().length) {
    host.hidden = true;
    return;
  }
  host.hidden = false;
  const title = document.createElement('h2');
  title.textContent = 'Parts';
  const lead = document.createElement('p');
  lead.className = 'showroom-lead';
  lead.textContent = 'Current cabinets only. No prices.';
  host.append(title, lead);
  const table = document.createElement('div');
  table.className = 'parts-list';
  for (const line of parts(rows(), SKU)) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'part-row';
    const name = document.createElement('strong');
    name.textContent = line.skuId ? `${line.name} · ${line.skuId}` : line.name;
    const meta = document.createElement('span');
    const size = line.width ? ` · ${line.width}×${line.height}×${line.depth} in` : '';
    meta.textContent = `${line.qty ? `Qty ${line.qty}` : ''}${size} · ${line.status}${line.places?.length ? ` · ${line.places.join('; ')}` : ''}`;
    row.append(name, meta);
    if (line.target) row.addEventListener('click', () => globalThis.STUDIO_SELECT?.(line.target));
    table.append(row);
  }
  host.append(table);
}

function projects() {
  try {
    const list = JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveProjects(list) {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(list));
}

function currentJob() {
  const here = room();
  const state = globalThis.STUDIO_STATE;
  return {
    version: 1,
    name: document.querySelector('#project-name')?.value?.trim() || 'Kitchen',
    room: here,
    layout: { rows: rows() },
    locks: globalThis.STUDIO_LOCKS?.() || [],
    finishes: state ? { upper: state.upper, lower: state.lower, counter: state.counter, floor: state.floor, paint: globalThis.STUDIO_FINISH_OVERRIDE?.() || null } : null,
  };
}

function download(filename, text, type) {
  const blob = new Blob([text], { type });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function rememberProject(job) {
  const list = projects().filter((item) => item.name !== job.name);
  list.unshift({ name: job.name, savedAt: new Date().toISOString(), job });
  saveProjects(list.slice(0, 12));
  renderProjects();
}

function applyJob(job) {
  if (!job?.room?.walls?.length || !job.layout?.rows) throw new Error('This file needs a room and a layout.');
  for (const row of job.layout.rows) {
    if (row.cut) continue;
    if (!SKU.has(row.skuId)) throw new Error(`${row.skuId} is not in the current cabinet list.`);
  }
  pushHistory();
  const state = globalThis.STUDIO_STATE || {};
  state.room = job.room;
  if (job.finishes?.upper) state.upper = job.finishes.upper;
  if (job.finishes?.lower) state.lower = job.finishes.lower;
  if (job.finishes?.counter) state.counter = job.finishes.counter;
  if (job.finishes?.floor) state.floor = job.finishes.floor;
  globalThis.STUDIO_SET_FINISH_OVERRIDE?.(job.finishes?.paint || null);
  const saved = JSON.parse(localStorage.getItem(STATE_KEY) || '{}') || {};
  saved.room = job.room;
  if (job.finishes?.upper) saved.upper = job.finishes.upper;
  if (job.finishes?.lower) saved.lower = job.finishes.lower;
  localStorage.setItem(STATE_KEY, JSON.stringify(saved));
  sessionStorage.setItem(TEMPLATE_KEY, JSON.stringify({ id: 'opened', rows: job.layout.rows, locks: job.locks || [] }));
  globalThis.STUDIO_LAYOUT_OVERRIDE = { rows: job.layout.rows };
  if (document.querySelector('#project-name') && job.name) document.querySelector('#project-name').value = job.name;
  globalThis.STUDIO_SET_PHASE?.('ready');
  globalThis.STUDIO_REDRAW?.();
  sync();
}

function renderProjects() {
  const host = document.querySelector('#project-list');
  if (!host) return;
  host.replaceChildren(...projects().map((item) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = item.name;
    button.addEventListener('click', () => {
      try { applyJob(item.job); } catch (error) { setProjectError(error.message); }
    });
    return button;
  }));
}

function setProjectError(message) {
  const node = document.querySelector('#project-error');
  if (!node) return;
  node.hidden = !message;
  node.textContent = message || '';
}

function packetHtml(job) {
  const here = job.room;
  const lines = parts(job.layout.rows, SKU).map((line) => `<li>${line.name}${line.skuId ? ` (${line.skuId})` : ''} — ${line.status}${line.places?.length ? ` — ${line.places.join('; ')}` : ''}</li>`).join('');
  const issues = checks(here, job.layout.rows, SKU, { ceiling: here.ceiling || STUDIO_CEILING }).map((issue) => `<li>${issue.message}</li>`).join('');
  const walls = chainText(here, job.layout.rows, SKU).map((line) => `<li>${line}</li>`).join('');
  return `<!doctype html><meta charset="utf-8"><title>${job.name} plan</title><body style="font-family:Georgia,serif;max-width:760px;margin:40px auto;line-height:1.5"><h1>${job.name}</h1><p>This packet is a drawing for a homeowner or installer. It is not an installation approval. Outstanding checks are listed below. No prices.</p><h2>Measurements</h2><ul>${walls}</ul><p>Ceiling ${here.ceiling || STUDIO_CEILING} in.</p><h2>Parts</h2><ul>${lines}</ul><h2>Checks</h2><ul>${issues}</ul></body>`;
}

function annotateRoom(parsed) {
  const ceiling = Number(document.querySelector('#ceiling-height')?.value);
  if (Number.isFinite(ceiling) && ceiling > 0) parsed.ceiling = ceiling;
  const formRows = [...document.querySelectorAll('#opening-list .opening-row')];
  for (const wall of parsed.walls || []) {
    for (const opening of wall.openings || []) {
      const match = formRows.find((row) => row.querySelector('[name=wall]')?.value === wall.id && row.querySelector('[name=kind]')?.value === opening.kind && Number(row.querySelector('[name=start]')?.value) === opening.start);
      if (!match) continue;
      const sill = Number(match.querySelector('[name=sill]')?.value);
      const height = Number(match.querySelector('[name=height]')?.value);
      const swing = match.querySelector('[name=swing]')?.value;
      if (Number.isFinite(sill) && sill >= 0) opening.sill = sill;
      if (Number.isFinite(height) && height > 0) opening.height = height;
      if (swing) opening.swing = swing;
    }
  }
}

function decorateOpening(row) {
  if (row.querySelector('[name=sill]') || row.dataset.decorated) return;
  row.dataset.decorated = 'true';
  const kind = row.querySelector('[name=kind]');
  const extra = document.createElement('div');
  extra.className = 'opening-extra';
  const sill = document.createElement('label');
  sill.textContent = 'Sill';
  const sillInput = document.createElement('input');
  sillInput.name = 'sill';
  sillInput.inputMode = 'decimal';
  sill.append(sillInput);
  const height = document.createElement('label');
  height.textContent = 'Height';
  const heightInput = document.createElement('input');
  heightInput.name = 'height';
  heightInput.inputMode = 'decimal';
  height.append(heightInput);
  const swing = document.createElement('label');
  swing.textContent = 'Swing';
  const swingInput = document.createElement('select');
  swingInput.name = 'swing';
  swingInput.append(new Option('Swing', ''), new Option('Left', 'left'), new Option('Right', 'right'));
  swing.append(swingInput);
  const hint = document.createElement('p');
  hint.className = 'note';
  extra.append(sill, height, swing, hint);
  row.append(extra);
  const paint = () => {
    const value = kind?.value;
    sill.hidden = value !== 'window';
    height.hidden = value !== 'window' && value !== 'door';
    swing.hidden = value !== 'door';
    hint.textContent = value === 'window'
      ? 'Sill is inches off the floor. A window does not remove the base cabinets under it.'
      : value === 'door'
        ? 'Height is optional. Without it, uppers stop at the door.'
        : value === 'range' || value === 'fridge' || value === 'dishwasher' || value === 'sink'
          ? 'The picture is a placeholder sized from stock. It is not a cabinet order line.'
          : '';
  };
  kind?.addEventListener('change', paint);
  paint();
}

function paintScope() {
  const map = { 'finish-one': 'one', 'finish-uppers': 'uppers', 'finish-lowers': 'lowers', 'finish-kitchen': 'kitchen' };
  const pressed = document.querySelector('.finish-scope [aria-pressed="true"]');
  const note = document.querySelector('#finish-scope-note');
  if (!pressed || !note || !rows().length) return;
  if (note.textContent && !/^(All |Entire |This cabinet )/.test(note.textContent)) return;
  note.textContent = scopeNote(map[pressed.id] || 'lowers', '', rows(), SKU);
}

function sync() {
  if (document.body.dataset.draw === 'plan') drawPlan();
  if (document.body.dataset.draw === 'elevation') drawElevation();
  renderChecks();
  renderParts();
  paintScope();
  paintHistory();
}

function boot() {
  globalThis.STUDIO_PUSH_HISTORY = pushHistory;
  globalThis.STUDIO_SYNC = sync;
  globalThis.STUDIO_ANNOTATE_ROOM = annotateRoom;
  const saveJob = (event) => {
    const job = currentJob();
    if (!job.room || !job.layout.rows.length) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    download(`turbo-job-${job.room.walls.map((wall) => `${wall.id}-${wall.length}`).join('_')}.json`, JSON.stringify(job, null, 2) + '\n', 'application/json');
  };
  document.querySelector('#job-download')?.addEventListener('click', saveJob, true);
  document.querySelector('#measure-job-download')?.addEventListener('click', saveJob, true);
  document.querySelector('#measure')?.addEventListener('toggle', () => {
    const input = document.querySelector('#ceiling-height');
    const ceiling = room()?.ceiling;
    if (input && ceiling) input.value = String(ceiling);
  });
  document.querySelector('#undo')?.addEventListener('click', undo);
  document.querySelector('#redo')?.addEventListener('click', redo);
  document.addEventListener('keydown', (event) => {
    if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return;
    event.preventDefault();
    if (event.shiftKey) redo();
    else undo();
  });
  document.querySelectorAll('[data-draw]').forEach((button) => {
    if (!['plan', 'three', 'elevation'].includes(button.dataset.draw)) return;
    button.addEventListener('click', () => setDraw(button.dataset.draw));
  });
  document.querySelector('#project-save')?.addEventListener('click', () => {
    const job = currentJob();
    if (!job.room) return setProjectError('Confirm the room before saving.');
    rememberProject(job);
    setProjectError('');
  });
  document.querySelector('#project-duplicate')?.addEventListener('click', () => {
    const job = currentJob();
    job.name = `${job.name} copy`;
    const input = document.querySelector('#project-name');
    if (input) input.value = job.name;
    rememberProject(job);
  });
  document.querySelector('#packet-download')?.addEventListener('click', () => {
    const job = currentJob();
    if (!job.room || !job.layout.rows.length) return setProjectError('Pick a layout before the packet.');
    download(`${job.name.replace(/\s+/g, '-').toLowerCase()}-plan.html`, packetHtml(job), 'text/html');
    setProjectError('');
  });
  document.querySelector('#job-open-input')?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      applyJob(JSON.parse(await file.text()));
      setProjectError('');
    } catch (error) {
      setProjectError(error.message || 'That file could not be opened.');
    }
    event.target.value = '';
  });
  const list = document.querySelector('#opening-list');
  if (list) {
    new MutationObserver(() => list.querySelectorAll('.opening-row').forEach(decorateOpening)).observe(list, { childList: true });
  }
  const ceiling = document.querySelector('#ceiling-height');
  if (ceiling && !ceiling.value) ceiling.value = String(STUDIO_CEILING);
  const suggestions = [
    { id: 'soft-white', name: 'Soft white', color: '#f7f4ee' },
    { id: 'warm-grey', name: 'Warm grey', color: '#d9d5cc' },
    { id: 'sage-wall', name: 'Pale sage', color: '#d5ddd0' },
    { id: 'clay', name: 'Clay', color: '#e4d2c4' },
  ];
  const paintSuggestion = (host, field) => {
    const node = document.querySelector(host);
    if (!node) return;
    node.replaceChildren(...suggestions.map((swatch) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'swatch';
      button.style.setProperty('--color', swatch.color);
      button.title = `${swatch.name}. Not a Turbo Cabinets product.`;
      button.setAttribute('aria-label', swatch.name);
      button.addEventListener('click', () => {
        globalThis[field] = swatch.color;
        node.querySelectorAll('.swatch').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
        globalThis.STUDIO_REDRAW?.();
      });
      return button;
    }));
  };
  paintSuggestion('#wall-swatches', 'STUDIO_WALL_COLOR');
  paintSuggestion('#splash-swatches', 'STUDIO_SPLASH_COLOR');
  renderProjects();
  setDraw('three');
  sync();
}

boot();
