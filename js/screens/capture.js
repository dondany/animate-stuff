import { getProject, getFrames, addFrame, removeFrame, requestPersistence } from '../db.js';
import { startCamera, stopCamera, isLive, grabFrame } from '../camera.js';
import { h, icons, iconBtn, shutterSound, keepAwake } from '../ui.js';

export async function renderCapture(root, id) {
  const project = await getProject(id);
  if (!project) { location.hash = '#/'; return; }
  requestPersistence();

  let stream = null;
  let facing = 'environment';
  let onion = true;
  let busy = false;
  let disposed = false;
  const urls = new Map(); // frameId -> object URL

  const blobs = await getFrames(project.frameIds);
  project.frameIds.forEach((fid, i) => blobs[i] && urls.set(fid, URL.createObjectURL(blobs[i])));

  // ----- elements -----
  const video = h('video', { autoplay: true, muted: true, playsinline: true });
  const onionImg = h('img', { class: 'onion', alt: '' });
  const flash = h('div', { class: 'flash' });
  const message = h('div', { class: 'message' }, 'Starting the camera…');
  const stage = h('div', { class: 'stage' }, video, onionImg, flash, message);
  const count = h('div', { class: 'badge', 'aria-label': 'Frames' });
  const strip = h('div', { class: 'strip' });

  const undoBtn = iconBtn('undo', 'Remove last photo', undo);
  const playBtn = iconBtn('play', 'Watch it move', () => { location.hash = `#/play/${project.id}`; });
  const shutter = h('button', { class: 'shutter', 'aria-label': 'Take photo', onClick: takePhoto });
  const onionChip = h('button', { class: 'chip', 'aria-pressed': 'true', onClick: toggleOnion, html: `${icons.onion} Ghost` });
  const flipChip = h('button', { class: 'chip', onClick: flipCamera, html: `${icons.flip} Flip` });

  root.append(h('div', { class: 'screen capture' },
    h('div', { class: 'topbar' },
      iconBtn('back', 'Back', () => { location.hash = '#/'; }),
      h('div', { class: 'title' }, project.name),
      count),
    h('div', { class: 'stage-col' },
      h('div', { class: 'stage-wrap' }, stage),
      strip),
    h('div', { class: 'side' },
      h('div', { class: 'controls' }, undoBtn, shutter, playBtn),
      h('div', { class: 'toggles' }, onionChip, flipChip)),
  ));

  // ----- behaviour -----
  function update() {
    const n = project.frameIds.length;
    count.textContent = n;
    undoBtn.disabled = n === 0;
    playBtn.disabled = n === 0;

    const lastUrl = n ? urls.get(project.frameIds[n - 1]) : null;
    onionImg.hidden = !(onion && lastUrl);
    if (lastUrl) onionImg.src = lastUrl;

    strip.replaceChildren(...project.frameIds.map((fid, i) =>
      h('div', { class: `thumb${i === n - 1 ? ' current' : ''}` },
        h('img', { src: urls.get(fid), alt: '' }),
        h('span', { class: 'n' }, i + 1))));
    strip.scrollLeft = strip.scrollWidth;
  }

  async function openCamera() {
    message.hidden = false;
    message.textContent = 'Starting the camera…';
    stopCamera(stream);
    try {
      stream = await startCamera(video, facing);
      if (disposed) { stopCamera(stream); return; }
      video.classList.toggle('mirror', facing === 'user');
      message.hidden = true;
    } catch (err) {
      message.textContent = err.name === 'NotAllowedError'
        ? 'The camera is blocked. In Safari tap “aA” → Website Settings → Camera → Allow, then come back.'
        : `Couldn't start the camera. ${err.message}`;
    }
  }

  async function takePhoto() {
    if (busy || !isLive(stream)) return;
    busy = true;
    try {
      shutterSound();
      flash.classList.remove('go');
      void flash.offsetWidth; // restart the flash animation
      flash.classList.add('go');
      const blob = await grabFrame(video, facing === 'user');
      const fid = await addFrame(project, blob);
      urls.set(fid, URL.createObjectURL(blob));
      update();
    } finally {
      busy = false;
    }
  }

  async function undo() {
    const fid = project.frameIds.at(-1);
    if (!fid) return;
    await removeFrame(project, fid);
    URL.revokeObjectURL(urls.get(fid));
    urls.delete(fid);
    update();
  }

  function toggleOnion() {
    onion = !onion;
    onionChip.setAttribute('aria-pressed', String(onion));
    update();
  }

  function flipCamera() {
    facing = facing === 'environment' ? 'user' : 'environment';
    openCamera();
  }

  // iOS stops the camera when the app goes to the background.
  function onVisible() {
    if (document.visibilityState === 'visible' && !isLive(stream)) openCamera();
  }

  // Space/Enter also take a photo (handy with a Bluetooth keyboard).
  function onKey(e) {
    if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); takePhoto(); }
  }

  document.addEventListener('visibilitychange', onVisible);
  document.addEventListener('keydown', onKey);
  const releaseWake = keepAwake();
  update();
  openCamera();

  return () => {
    disposed = true;
    document.removeEventListener('visibilitychange', onVisible);
    document.removeEventListener('keydown', onKey);
    releaseWake();
    stopCamera(stream);
    urls.forEach(URL.revokeObjectURL);
  };
}
