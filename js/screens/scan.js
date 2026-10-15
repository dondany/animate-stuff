import { createProject, addFrame, listProjects, requestPersistence } from '../db.js';
import { scanSheet } from '../scanner.js';
import { h, icons, iconBtn } from '../ui.js';

export function renderScan(root) {
  requestPersistence();
  const urls = [];
  const players = new Set();
  const objectUrl = (blob) => { const u = URL.createObjectURL(blob); urls.push(u); return u; };

  const input = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true });
  input.addEventListener('change', () => {
    const files = [...input.files];
    input.value = '';
    processAll(files);
  });

  const list = h('div', { class: 'scan-list' });

  root.append(h('div', { class: 'screen scan' },
    h('div', { class: 'topbar' },
      iconBtn('back', 'Back', () => { location.hash = '#/'; }),
      h('div', { class: 'title' }, 'Scan drawings'),
      iconBtn('print', 'Print drawing sheets', () => { location.hash = '#/sheets'; })),
    h('ol', { class: 'steps' },
      h('li', null, 'Lay the sheet flat, in good light.'),
      h('li', null, 'Take the photo from above, with all 4 black corner squares in view.'),
      h('li', null, 'Lots of sheets? Photograph them all with the Camera app, then pick them here together.')),
    h('button', { class: 'new-card', onClick: () => input.click() },
      h('span', { class: 'plus', html: icons.camera }),
      h('span', null, 'Scan a sheet', h('small', null, 'Take a photo or choose from Photos'))),
    list,
    input,
  ));

  async function processAll(files) {
    for (const file of files) {
      const card = h('div', { class: 'scan-card' }, h('p', { class: 'working' }, 'Looking at the drawing…'));
      list.prepend(card);
      try {
        const result = await scanSheet(file);
        showResult(card, result);
      } catch (err) {
        showError(card, err);
      }
    }
  }

  function showResult(card, { frames, label, count }) {
    const frameUrls = frames.map(objectUrl);
    const imgs = frameUrls.map((src, i) => h('img', { src, alt: `Frame ${i + 1}`, hidden: i > 0 }));
    const stage = h('div', { class: 'stage' }, imgs);
    const player = { imgs, at: 0 };
    players.add(player);

    const nameInput = h('input', { class: 'name-input', type: 'text', placeholder: 'Name', 'aria-label': 'Name', autocomplete: 'off' });
    const save = h('button', { class: 'btn primary', onClick: onSave }, 'Save');
    const discard = h('button', { class: 'btn', onClick: () => { players.delete(player); card.remove(); } }, 'Discard');

    card.replaceChildren(
      stage,
      h('div', { class: 'strip' }, frameUrls.map((src, i) =>
        h('div', { class: 'thumb' }, h('img', { src, alt: '' }), h('span', { class: 'n' }, i + 1)))),
      h('img', { class: 'label-img', src: objectUrl(label), alt: 'Name written on the sheet' }),
      nameInput,
      h('div', { class: 'row' }, discard, save),
    );

    async function onSave() {
      save.disabled = discard.disabled = true;
      const count = (await listProjects()).length;
      const project = await createProject({
        name: nameInput.value.trim() || `Drawing ${count + 1}`,
        fps: { 4: 4, 8: 6, 12: 8 }[count] ?? 4,
        label: { type: label.type, data: await label.arrayBuffer() },
      });
      for (const blob of frames) await addFrame(project, blob);
      card.querySelector('.row').replaceChildren(
        h('span', { class: 'saved' }, `Saved as “${project.name}”`),
        h('button', { class: 'btn mint', onClick: () => { location.hash = `#/play/${project.id}`; } }, 'Open'));
      nameInput.disabled = true;
    }
  }

  function showError(card, err) {
    card.classList.add('failed');
    card.replaceChildren(
      err.preview && h('img', { class: 'debug-img', src: err.preview, alt: 'The photo, with possible corner squares circled' }),
      h('p', null, err.message || String(err)),
      h('div', { class: 'row' },
        h('button', { class: 'btn', onClick: () => card.remove() }, 'Discard'),
        h('button', { class: 'btn primary', onClick: () => { card.remove(); input.click(); } }, 'Try another photo')),
    );
  }

  // One timer drives every preview, at drawing-friendly speed.
  const timer = setInterval(() => {
    for (const p of players) {
      p.imgs[p.at].hidden = true;
      p.at = (p.at + 1) % p.imgs.length;
      p.imgs[p.at].hidden = false;
    }
  }, 250);

  return () => {
    clearInterval(timer);
    urls.forEach(URL.revokeObjectURL);
  };
}
