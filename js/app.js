import { renderHome } from './screens/home.js';
import { renderCapture } from './screens/capture.js';
import { renderPlay } from './screens/play.js';

const routes = [
  [/^#?\/?$/, renderHome],
  [/^#\/capture\/([\w-]+)$/, renderCapture],
  [/^#\/play\/([\w-]+)$/, renderPlay],
];

const app = document.getElementById('app');
let cleanup = null;
let navigation = 0;

async function route() {
  const current = ++navigation;
  cleanup?.();
  cleanup = null;
  document.querySelectorAll('.modal-backdrop').forEach((m) => m.remove());

  const match = routes.map(([re, render]) => [location.hash.match(re), render]).find(([m]) => m);
  if (!match) { location.hash = '#/'; return; }
  const [m, render] = match;

  app.replaceChildren();
  const dispose = await render(app, ...m.slice(1));
  // If the user navigated again while this screen was loading, tear it down.
  if (current !== navigation) dispose?.();
  else cleanup = dispose ?? null;
}

window.addEventListener('hashchange', route);
route();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
