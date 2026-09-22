const STATE = 'turbo-cabinet-studio-v5';
const TITLES = { form: 'Your two walls.', confirm: 'Check these lengths.' };
const WALLS = { range: 'Stove wall', sink: 'Sink wall' };

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

function boot() {
  globalThis.STUDIO_SET_PHASE = setPhase;
  pinInteractive();
  startPhase();
  document.querySelector('#welcome-enter')?.addEventListener('click', openSizes);
  document.querySelector('#measure')?.addEventListener('close', onMeasureClose);
  const title = document.querySelector('#measure-title');
  if (title) new MutationObserver(polishMeasure).observe(title, { childList: true, characterData: true, subtree: true });
  const echo = document.querySelector('#confirm-length');
  if (echo) new MutationObserver(polishMeasure).observe(echo, { childList: true, characterData: true, subtree: true });
  if (phase() === 'welcome') document.querySelector('#welcome-enter')?.focus();
}

boot();
