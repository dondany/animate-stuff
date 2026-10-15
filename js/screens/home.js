import { listProjects, createProject, getFrame } from '../db.js';
import { h, icons, plural } from '../ui.js';

export async function renderHome(root) {
  const urls = [];
  const projects = await listProjects();

  const startNew = async () => {
    const p = await createProject();
    location.hash = `#/capture/${p.id}`;
  };

  const title = h('h1', null, [...'Animate!'].map((c) => h('span', null, c)));

  const cards = await Promise.all(projects.map(async (p) => {
    const first = p.frameIds[0] && await getFrame(p.frameIds[0]);
    let cover = '🎬';
    if (first) {
      const url = URL.createObjectURL(first);
      urls.push(url);
      cover = h('img', { src: url, alt: '' });
    }
    let label = null;
    if (p.label) {
      const url = URL.createObjectURL(new Blob([p.label.data], { type: p.label.type }));
      urls.push(url);
      label = h('img', { class: 'label-img', src: url, alt: '' });
    }
    const target = p.frameIds.length ? `#/play/${p.id}` : `#/capture/${p.id}`;
    return h('button', { class: 'card', onClick: () => { location.hash = target; } },
      h('div', { class: 'cover' }, cover),
      h('div', { class: 'meta' },
        h('div', { class: 'name' }, p.name),
        h('div', { class: 'count' }, plural(p.frameIds.length, 'frame')),
        label));
  }));

  root.append(h('div', { class: 'screen home' },
    title,
    h('p', { class: 'lead' }, 'Make things move, one photo at a time.'),
    h('button', { class: 'new-card', onClick: startNew },
      h('span', { class: 'plus' }, '+'),
      h('span', null, 'New animation', h('small', null, 'Photo by photo: clay, toys, anything!'))),
    h('div', { class: 'row' },
      h('button', { class: 'btn', onClick: () => { location.hash = '#/scan'; }, html: `${icons.camera} Scan drawings` }),
      h('button', { class: 'btn', onClick: () => { location.hash = '#/sheets'; }, html: `${icons.print} Print sheets` })),
    cards.length
      ? h('div', { class: 'grid' }, cards)
      : h('div', { class: 'empty' }, 'Your animations will show up here.'),
  ));

  return () => urls.forEach(URL.revokeObjectURL);
}
