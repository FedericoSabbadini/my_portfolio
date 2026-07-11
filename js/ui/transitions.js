/* =========================================================================
   transitions.js — cinematic view swaps between the brain (home) and the
   knowledge-graph section. CSS carries the easing; these helpers sequence it.
   ========================================================================= */
const DUR_MED = 550;
const q = (id) => document.getElementById(id);

export function revealSection() {
  const section = q('section-view');
  const overlay = q('home-overlay');
  const labels = q('region-labels');
  overlay.classList.add('is-hidden');
  if (labels) labels.classList.add('is-hidden');
  section.hidden = false;
  // force reflow so the opacity transition runs
  void section.offsetWidth;
  section.classList.add('is-active');
  return wait(DUR_MED);
}

export function hideSection() {
  const section = q('section-view');
  section.classList.remove('is-active');
  return wait(DUR_MED).then(() => { section.hidden = true; });
}

export function showHomeOverlay() {
  q('home-overlay').classList.remove('is-hidden');
  const labels = q('region-labels');
  if (labels) labels.classList.remove('is-hidden');
}

export function hideBoot() {
  const boot = q('boot');
  if (!boot) return;
  boot.classList.add('is-hidden');
  setTimeout(() => boot.remove(), 1000);
}

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }
