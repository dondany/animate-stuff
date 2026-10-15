import { getProject, getFrames, saveProject, addFrame, removeFrame, deleteProject } from '../db.js';
import { FRAME_W, FRAME_H } from '../camera.js';
import { makeGif, playOrder } from '../gif.js';
import { h, icons, iconBtn, modal, confirmDialog } from '../ui.js';

export async function renderPlay(root, id) {
  const project = await getProject(id);
  if (!project) { location.hash = '#/'; return; }
  if (!project.frameIds.length) { location.hash = `#/capture/${id}`; return; }

  // frames[i] = { id, blob, url, img } in project order
  let frames = [];
  let order = [];
  let pos = 0;          // position in `order`
  let selected = -1;    // selected frame index, -1 = none
  let playing = true;
  let timer = 0;

  async function loadFrames() {
    const blobs = await getFrames(project.frameIds);
    frames.forEach((f) => URL.revokeObjectURL(f.url));
    frames = await Promise.all(project.frameIds.map(async (fid, i) => {
      const url = URL.createObjectURL(blobs[i]);
      const img = new Image();
      img.src = url;
      await img.decode().catch(() => {});
      return { id: fid, blob: blobs[i], url, img };
    }));
  }
  await loadFrames();

  // ----- elements -----
  const canvas = h('canvas', { width: FRAME_W, height: FRAME_H });
  const ctx = canvas.getContext('2d');
  const stage = h('div', { class: 'stage', onClick: togglePlay }, canvas, h('div', { class: 'play-hint', html: icons.play }));
  const title = h('div', { class: 'title' }, project.name);

  const fpsLabel = h('span', { class: 'fps' });
  const slider = h('input', { type: 'range', min: 2, max: 15, step: 1, 'aria-label': 'Speed' });
  slider.value = project.fps;
  slider.addEventListener('input', () => { project.fps = Number(slider.value); updateSpeed(); restartTimer(); });
  slider.addEventListener('change', () => saveProject(project));

  const boomChip = h('button', { class: 'chip', onClick: toggleBoomerang, html: `${icons.boomerang} Back & forth` });

  const strip = h('div', { class: 'strip' });
  const frameLabel = h('span');
  const frameActions = h('div', { class: 'frame-actions', hidden: true },
    frameLabel,
    h('button', { class: 'chip', onClick: duplicateSelected, html: `${icons.copy} Copy` }),
    h('button', { class: 'chip', onClick: deleteSelected, html: `${icons.trash} Delete` }));

  root.append(h('div', { class: 'screen player' },
    h('div', { class: 'topbar' },
      iconBtn('back', 'Back', () => { location.hash = '#/'; }),
      title,
      iconBtn('pencil', 'Rename', rename),
      iconBtn('trash', 'Delete animation', removeAnimation)),
    h('div', { class: 'stage-wrap' }, stage),
    h('div', { class: 'panel' },
      h('div', { class: 'speed' }, h('span', { 'aria-hidden': 'true' }, '🐢'), slider, h('span', { 'aria-hidden': 'true' }, '🐇'), fpsLabel),
      h('div', { class: 'row' }, boomChip),
      strip,
      frameActions,
      h('div', { class: 'row' },
        h('button', { class: 'btn', onClick: () => { location.hash = `#/capture/${project.id}`; }, html: `${icons.camera} Add photos` }),
        h('button', { class: 'btn primary', onClick: exportGif, html: `${icons.share} Save GIF` }))),
  ));

  // ----- playback -----
  function draw(index) {
    const f = frames[index];
    if (f) ctx.drawImage(f.img, 0, 0, FRAME_W, FRAME_H);
    for (const [i, el] of [...strip.children].entries()) el.classList.toggle('current', i === index);
  }

  function tick() {
    pos = (pos + 1) % order.length;
    draw(order[pos]);
  }

  function restartTimer() {
    clearInterval(timer);
    if (playing && order.length > 1) timer = setInterval(tick, 1000 / project.fps);
  }

  function togglePlay() {
    playing = !playing;
    if (playing) select(-1);
    stage.classList.toggle('paused', !playing);
    restartTimer();
  }

  function updateSpeed() {
    fpsLabel.textContent = `${project.fps} fps`;
  }

  function toggleBoomerang() {
    project.boomerang = !project.boomerang;
    boomChip.setAttribute('aria-pressed', String(project.boomerang));
    order = playOrder(frames.length, project.boomerang);
    pos = 0;
    saveProject(project);
  }

  // ----- frame editing -----
  function renderStrip() {
    strip.replaceChildren(...frames.map((f, i) =>
      h('button', { class: `thumb${i === selected ? ' selected' : ''}`, onClick: () => select(i === selected ? -1 : i) },
        h('img', { src: f.url, alt: `Frame ${i + 1}` }),
        h('span', { class: 'n' }, i + 1))));
  }

  function select(i) {
    selected = i;
    frameActions.hidden = i < 0;
    if (i >= 0) {
      frameLabel.textContent = `Frame ${i + 1}:`;
      playing = false;
      stage.classList.add('paused');
      restartTimer();
    }
    renderStrip();
    if (i >= 0) draw(i);
  }

  async function afterEdit(nextSelected) {
    await loadFrames();
    if (!frames.length) { location.hash = `#/capture/${project.id}`; return; }
    order = playOrder(frames.length, project.boomerang);
    pos = 0;
    select(Math.min(nextSelected, frames.length - 1));
  }

  async function duplicateSelected() {
    const f = frames[selected];
    if (!f) return;
    await addFrame(project, f.blob, selected + 1);
    await afterEdit(selected + 1);
  }

  async function deleteSelected() {
    const f = frames[selected];
    if (!f) return;
    await removeFrame(project, f.id);
    await afterEdit(selected);
  }

  async function rename() {
    const name = prompt('Name this animation', project.name)?.trim();
    if (!name) return;
    project.name = name;
    title.textContent = name;
    await saveProject(project);
  }

  async function removeAnimation() {
    const ok = await confirmDialog('Delete this animation?', `“${project.name}” and all its photos will be gone for good.`);
    if (!ok) return;
    await deleteProject(project);
    location.hash = '#/';
  }

  // ----- export -----
  async function exportGif() {
    const bar = h('div');
    const m = modal(h('h2', null, 'Making your GIF…'), h('div', { class: 'progress' }, bar));
    try {
      const gif = await makeGif(frames.map((f) => f.blob), {
        fps: project.fps,
        boomerang: project.boomerang,
        onProgress: (p) => { bar.style.width = `${Math.round(p * 100)}%`; },
      });
      const url = URL.createObjectURL(gif);
      const file = new File([gif], `${project.name.replace(/[^\p{L}\p{N} _-]+/gu, '').trim() || 'animation'}.gif`, { type: 'image/gif' });
      m.body.replaceChildren(
        h('h2', null, 'Ta-da! 🎉'),
        h('img', { class: 'result', src: url, alt: project.name }),
        h('p', null, `${formatSize(gif.size)}. Tip: you can also press and hold the picture to save it.`),
        h('div', { class: 'row' },
          h('button', { class: 'btn', onClick: () => { URL.revokeObjectURL(url); m.close(); } }, 'Close'),
          h('button', { class: 'btn primary', onClick: () => shareFile(file), html: `${icons.share} Share / Save` })),
      );
    } catch (err) {
      m.body.replaceChildren(
        h('h2', null, 'Something went wrong'),
        h('p', null, err.message),
        h('button', { class: 'btn', onClick: m.close }, 'Close'));
    }
  }

  // ----- start -----
  order = playOrder(frames.length, project.boomerang);
  boomChip.setAttribute('aria-pressed', String(!!project.boomerang));
  updateSpeed();
  renderStrip();
  draw(0);
  restartTimer();

  return () => {
    clearInterval(timer);
    frames.forEach((f) => URL.revokeObjectURL(f.url));
  };
}

function formatSize(bytes) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// The share sheet is the iPhone way to save to Photos or send via Messages.
// It must be called straight from a tap, which is why export ends with a button.
async function shareFile(file) {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }
  const a = h('a', { href: URL.createObjectURL(file), download: file.name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}
