const STATE = 'turbo-cabinet-studio-v5';
const ENTERED = 'turbo-showroom-entered';
const TITLES = { form: 'Your two walls.', confirm: 'Check these lengths.' };
const WALLS = { range: 'Stove wall', sink: 'Sink wall' };

function hasRoom() {
  try {
    return Boolean(JSON.parse(localStorage.getItem(STATE) || 'null')?.room);
  } catch {
    return false;
  }
}

function phase() {
  return document.body.dataset.phase;
}

function setPhase(next) {
  document.body.dataset.phase = next;
  if (next === 'showroom' || next === 'ready') sessionStorage.setItem(ENTERED, '1');
  const welcome = document.querySelector('#welcome');
  if (welcome) welcome.hidden = next !== 'welcome';
  const main = document.querySelector('main');
  if (main) main.inert = next === 'welcome';
}

function startPhase() {
  if (hasRoom()) setPhase('ready');
  else if (sessionStorage.getItem(ENTERED)) setPhase('showroom');
  else setPhase('welcome');
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

function openSizes() {
  setPhase('sizing');
  const open = document.querySelector('#measure-open');
  const dialog = document.querySelector('#measure');
  const tryOpen = (n) => {
    open?.click();
    polishMeasure();
    if (dialog?.open) return;
    if (n < 40) setTimeout(() => tryOpen(n + 1), 50);
    else setPhase('showroom');
  };
  tryOpen(0);
}

function onMeasureClose() {
  if (!document.querySelector('#job-download')?.disabled) setPhase('ready');
  else if (phase() === 'sizing') setPhase('showroom');
}

function boot() {
  startPhase();
  document.querySelector('#welcome-enter')?.addEventListener('click', () => setPhase('showroom'));
  document.querySelector('#welcome-back')?.addEventListener('click', () => setPhase('welcome'));
  document.querySelector('#showroom-ready')?.addEventListener('click', openSizes);
  document.querySelector('#measure')?.addEventListener('close', onMeasureClose);
  const title = document.querySelector('#measure-title');
  if (title) new MutationObserver(polishMeasure).observe(title, { childList: true, characterData: true, subtree: true });
  const echo = document.querySelector('#confirm-length');
  if (echo) new MutationObserver(polishMeasure).observe(echo, { childList: true, characterData: true, subtree: true });
  if (phase() === 'welcome') document.querySelector('#welcome-enter')?.focus();
}

boot();
