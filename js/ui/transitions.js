/* =========================================================================
   transitions.js — view swaps between brain (home) and region catalog.
   ========================================================================= */
const DUR = 450;
const q = (id) => document.getElementById(id);

export function showRegion() {
  const home = q('home-view');
  const region = q('region-view');
  home.hidden = true;
  region.hidden = false;
  region.scrollTop = 0;
  return wait(DUR);
}

export function showHome() {
  const home = q('home-view');
  const region = q('region-view');
  region.hidden = true;
  home.hidden = false;
  return wait(DUR);
}

export function hideBoot() {
  const boot = q('boot');
  if (!boot) return;
  boot.classList.add('is-hidden');
  setTimeout(() => boot.remove(), 1000);
}

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }
