const STATE = 'turbo-cabinet-studio-v5';
const TITLES = { form: 'Your two walls.', confirm: 'Check these lengths.' };
const WALLS = { range: 'Stove wall', sink: 'Sink wall' };
const SHAPES = [
  { id: 'rectangle', name: 'Rectangular', d: 'M6 10h36v22H6z' },
  { id: 'two', name: 'Two walls', d: 'M6 8h14v18h28v12H6z' },
  { id: 'three', name: 'Three walls', d: 'M6 8h36v24H34V18H14v14H6z' },
  { id: 'custom', name: 'Custom', d: 'M8 22 L18 8h22l10 14v12H8z' },
];

let shape = 'two';

function shapeSvg(id, pressed) {
  const item = SHAPES.find((entry) => entry.id === id) || SHAPES[1];
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 48 42');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', item.d);
  path.setAttribute('fill', pressed ? '#29372e' : '#fff');
  path.setAttribute('stroke', '#29372e');
  path.setAttribute('stroke-width', '2');
  path.setAttribute('stroke-linejoin', 'round');
  svg.append(path);
  return svg;
}

function roomSvg(range, sink) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 320 200');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Two walls. Stove wall ${range || ''} inches. Sink wall ${sink || ''} inches.`);
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M28 28h78v96h186v48H28z');
  path.setAttribute('fill', '#fff');
  path.setAttribute('stroke', '#29372e');
  path.setAttribute('stroke-width', '3');
  const stove = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  stove.setAttribute('x', '40');
  stove.setAttribute('y', '78');
  stove.setAttribute('fill', '#29372e');
  stove.setAttribute('font-size', '15');
  stove.setAttribute('font-family', 'League Spartan, sans-serif');
  stove.textContent = range ? `Stove wall ${range} in` : 'Stove wall';
  const sinkText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  sinkText.setAttribute('x', '118');
  sinkText.setAttribute('y', '154');
  sinkText.setAttribute('fill', '#29372e');
  sinkText.setAttribute('font-size', '15');
  sinkText.setAttribute('font-family', 'League Spartan, sans-serif');
  sinkText.textContent = sink ? `Sink wall ${sink} in` : 'Sink wall';
  svg.append(path, stove, sinkText);
  return svg;
}

function typedLengths() {
  return {
    range: document.querySelector('#range-length')?.value?.trim() || '',
    sink: document.querySelector('#sink-length')?.value?.trim() || '',
  };
}

function storedLengths() {
  try {
    const room = JSON.parse(localStorage.getItem(STATE) || 'null')?.room;
    const range = room?.walls?.find((wall) => wall.id === 'range')?.length;
    const sink = room?.walls?.find((wall) => wall.id === 'sink')?.length;
    return { range: range == null ? '' : String(range), sink: sink == null ? '' : String(sink) };
  } catch {
    return { range: '', sink: '' };
  }
}

function paintShapes() {
  const row = document.querySelector('#shape-row');
  if (!row || row.childElementCount) return;
  row.replaceChildren(...SHAPES.map((item) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'shape';
    button.dataset.shape = item.id;
    button.setAttribute('aria-pressed', String(item.id === shape));
    button.append(shapeSvg(item.id, item.id === shape), document.createTextNode(item.name));
    button.addEventListener('click', () => chooseShape(item.id));
    return button;
  }));
}

function chooseShape(next) {
  shape = next;
  document.body.dataset.shape = next;
  document.querySelectorAll('#shape-row .shape').forEach((button) => {
    const on = button.dataset.shape === next;
    button.setAttribute('aria-pressed', String(on));
    button.querySelector('svg')?.replaceWith(shapeSvg(button.dataset.shape, on));
  });
  const note = document.querySelector('#shape-note');
  if (!note) return;
  note.hidden = next === 'two';
  note.textContent = next === 'two' ? '' : 'This studio lays out the two-wall kitchen. Choose Two walls, then type both lengths.';
}

function drawConfirm() {
  const host = document.querySelector('#confirm-shape');
  const confirm = document.querySelector('#measure-confirm');
  if (!host || !confirm || confirm.hidden) return;
  const typed = typedLengths();
  host.replaceChildren(roomSvg(typed.range, typed.sink));
}

function drawRoomPreview() {
  const host = document.querySelector('#room-preview');
  if (!host) return;
  const lengths = storedLengths();
  host.replaceChildren(roomSvg(lengths.range, lengths.sink));
  const title = document.querySelector('#image-title');
  const caption = lengths.range && lengths.sink ? `Stove wall ${lengths.range} in · Sink wall ${lengths.sink} in` : 'Two walls';
  if (title && title.textContent !== caption) title.textContent = caption;
  const mode = document.querySelector('#mode-caption');
  if (mode) mode.textContent = 'Your room';
}

function hasRoom() {
  try {
    return Boolean(JSON.parse(localStorage.getItem(STATE) || 'null')?.room);
  } catch {
    return false;
  }
}

function hasTemplate() {
  return Boolean(globalThis.STUDIO_HAS_TEMPLATE?.());
}

function phase() {
  return document.body.dataset.phase;
}

function setPhase(next) {
  document.body.dataset.phase = next;
  const welcome = document.querySelector('#welcome');
  if (welcome) welcome.hidden = next !== 'welcome';
  const templates = document.querySelector('#templates');
  if (templates) templates.hidden = next !== 'templates' && next !== 'ready';
  const swap = document.querySelector('#swap');
  if (swap && next !== 'ready') swap.hidden = true;
  const preview = document.querySelector('#room-preview');
  if (preview) {
    preview.hidden = next !== 'templates';
    if (next === 'templates') drawRoomPreview();
  }
  const labels = document.querySelector('#wall-labels');
  if (labels && next !== 'ready') labels.hidden = true;
  const heading = document.querySelector('.options-intro h1');
  if (heading) heading.textContent = next === 'ready' ? 'Doors and color stay yours.' : 'The room comes first.';
  const main = document.querySelector('main');
  if (main) main.inert = next === 'welcome';
}

function startPhase() {
  if (hasRoom() && hasTemplate()) setPhase('ready');
  else if (hasRoom()) setPhase('templates');
  else setPhase('welcome');
}

// The studio still restores its last preview mode from storage. With the mode bar gone,
// 3D is the only view, so a stored image or layout mode would strand a returning customer.
function pinInteractive() {
  try {
    const state = JSON.parse(localStorage.getItem(STATE) || 'null');
    if (state && state.mode && state.mode !== 'interactive') {
      state.mode = 'interactive';
      localStorage.setItem(STATE, JSON.stringify(state));
    }
  } catch {
    /* ignore */
  }
}

function polishMeasure() {
  const title = document.querySelector('#measure-title');
  const confirm = document.querySelector('#measure-confirm');
  const lead = document.querySelector('#measure-lead');
  if (title) {
    if (title.textContent === 'Tape the L.') title.textContent = TITLES.form;
    if (title.textContent === 'Confirm the tape.') title.textContent = TITLES.confirm;
  }
  if (lead) lead.hidden = Boolean(confirm && !confirm.hidden);
  drawConfirm();
  const echo = document.querySelector('#confirm-length');
  if (echo?.textContent) {
    const next = echo.textContent
      .replace(/\brange\b/g, WALLS.range)
      .replace(/\bsink\b/g, WALLS.sink);
    if (next !== echo.textContent) echo.textContent = next;
  }
}

function fallbackPhase() {
  if (hasRoom() && hasTemplate()) return 'ready';
  if (hasRoom()) return 'templates';
  return 'welcome';
}

function openSizes() {
  setPhase('sizing');
  const open = document.querySelector('#measure-open');
  const dialog = document.querySelector('#measure');
  const tryOpen = (n) => {
    open?.click();
    polishMeasure();
    if (dialog?.open) return;
    if (n < 40) setTimeout(() => tryOpen(n + 1), 50);
    else setPhase(fallbackPhase());
  };
  tryOpen(0);
}

function onMeasureClose() {
  if (phase() === 'templates' || phase() === 'ready') return;
  setPhase(fallbackPhase());
}

function guardShape(event) {
  if (shape === 'two') return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const note = document.querySelector('#shape-note');
  if (note) {
    note.hidden = false;
    note.textContent = 'This studio lays out the two-wall kitchen. Choose Two walls, then type both lengths.';
  }
}

function finishScope(button) {
  const one = document.querySelector('#finish-one');
  const all = document.querySelector('#finish-all');
  const chosen = button?.id === 'finish-one' ? 'one' : 'all';
  one?.setAttribute('aria-pressed', String(chosen === 'one'));
  all?.setAttribute('aria-pressed', String(chosen === 'all'));
  const note = document.querySelector('#finish-scope-note');
  if (note && chosen === 'one' && !globalThis.STUDIO_SELECTION?.()) note.textContent = 'Select a cabinet, then pick a finish.';
  document.querySelector('#finishes button[aria-pressed="true"]')?.click();
}

function boot() {
  globalThis.STUDIO_SET_PHASE = setPhase;
  globalThis.STUDIO_FINISH_SCOPE = () => (document.querySelector('#finish-one')?.getAttribute('aria-pressed') === 'true' ? 'one' : 'all');
  pinInteractive();
  paintShapes();
  chooseShape('two');
  startPhase();
  document.querySelector('#measure-form')?.addEventListener('submit', guardShape, true);
  document.querySelector('#finish-one')?.addEventListener('click', (event) => finishScope(event.currentTarget));
  document.querySelector('#finish-all')?.addEventListener('click', (event) => finishScope(event.currentTarget));
  document.querySelector('#welcome-enter')?.addEventListener('click', openSizes);
  document.querySelector('#measure')?.addEventListener('close', onMeasureClose);
  const title = document.querySelector('#measure-title');
  if (title) new MutationObserver(polishMeasure).observe(title, { childList: true, characterData: true, subtree: true });
  const echo = document.querySelector('#confirm-length');
  if (echo) new MutationObserver(polishMeasure).observe(echo, { childList: true, characterData: true, subtree: true });
  const caption = document.querySelector('#image-title');
  if (caption) {
    new MutationObserver(() => {
      if (phase() === 'templates') drawRoomPreview();
    }).observe(caption, { childList: true, characterData: true, subtree: true });
  }
  if (phase() === 'welcome') document.querySelector('#welcome-enter')?.focus();
}

boot();
