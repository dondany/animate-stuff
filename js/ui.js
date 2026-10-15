// Small DOM helpers shared by the screens.

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value == null || value === false) continue;
    if (key.startsWith('on')) el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'class') el.className = value;
    else if (key === 'html') el.innerHTML = value;
    else el.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : String(child));
  }
  return el;
}

const svg = (paths) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

export const icons = {
  back: svg('<path d="M15 5l-7 7 7 7"/>'),
  play: svg('<path d="M7 4.5v15l12.5-7.5z" fill="currentColor"/>'),
  undo: svg('<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/>'),
  camera: svg('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
  flip: svg('<path d="M4 12a8 8 0 0113.7-5.7L20 8.5"/><path d="M20 4v4.5h-4.5"/><path d="M20 12a8 8 0 01-13.7 5.7L4 15.5"/><path d="M4 20v-4.5h4.5"/>'),
  onion: svg('<circle cx="10" cy="12" r="6"/><circle cx="14" cy="12" r="6" stroke-dasharray="2 3"/>'),
  share: svg('<path d="M12 15V3"/><path d="M7 8l5-5 5 5"/><path d="M5 12v8h14v-8"/>'),
  trash: svg('<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>'),
  copy: svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>'),
  pencil: svg('<path d="M4 20h4L19 9l-4-4L4 16z"/>'),
  print: svg('<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>'),
  boomerang: svg('<path d="M4 9h13l-3-3"/><path d="M20 15H7l3 3"/>'),
};

export function iconBtn(name, label, onClick, extra = {}) {
  return h('button', { class: 'icon-btn', 'aria-label': label, title: label, onClick, html: icons[name], ...extra });
}

// Opens a modal; returns { el, body, close }. Tapping the backdrop closes it.
export function modal(...content) {
  const body = h('div', { class: 'modal', role: 'dialog' }, ...content);
  const backdrop = h('div', { class: 'modal-backdrop' }, body);
  const close = () => backdrop.remove();
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  document.body.append(backdrop);
  return { el: backdrop, body, close };
}

export function confirmDialog(title, text, okLabel = 'Delete') {
  return new Promise((resolve) => {
    const done = (v) => { m.close(); resolve(v); };
    const m = modal(
      h('h2', null, title),
      text && h('p', null, text),
      h('div', { class: 'row' },
        h('button', { class: 'btn', onClick: () => done(false) }, 'Cancel'),
        h('button', { class: 'btn danger', onClick: () => done(true) }, okLabel)),
    );
  });
}

// A short "click" for the shutter. Kids love the sound.
let audio;
export function shutterSound() {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    const len = Math.floor(audio.sampleRate * 0.06);
    const buf = audio.createBuffer(1, len, audio.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const src = audio.createBufferSource();
    const gain = audio.createGain();
    gain.gain.value = 0.5;
    src.buffer = buf;
    src.connect(gain).connect(audio.destination);
    src.start();
  } catch { /* sound is optional */ }
}

// Keeps the screen awake while it's active (the phone sits on a stand for a while).
export function keepAwake() {
  let lock = null;
  let active = true;
  const acquire = async () => {
    if (!active || document.visibilityState !== 'visible' || !navigator.wakeLock) return;
    try { lock = await navigator.wakeLock.request('screen'); } catch { /* not allowed, ignore */ }
  };
  document.addEventListener('visibilitychange', acquire);
  acquire();
  return () => {
    active = false;
    document.removeEventListener('visibilitychange', acquire);
    lock?.release().catch(() => {});
  };
}

export function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}
