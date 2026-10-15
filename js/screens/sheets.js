import { SUBJECTS, LAYOUTS, sheetSvg } from '../sheet.js';
import { sheetsPdf } from '../pdf.js';
import { h, icons, iconBtn, modal } from '../ui.js';

export function renderSheets(root) {
  let subject = SUBJECTS[1];
  let layout = LAYOUTS[0];
  const urls = [];

  const preview = h('div', { class: 'sheet-preview' });

  const subjectChips = SUBJECTS.map((s) => h('button', {
    class: 'chip',
    onClick: () => { subject = s; update(); },
  }, `${s.emoji} ${s.name}`));

  const countChips = LAYOUTS.map((l) => h('button', {
    class: 'chip',
    onClick: () => { layout = l; update(); },
  }, `${l.count} pictures`));

  function update() {
    preview.innerHTML = sheetSvg(subject, layout);
    subjectChips.forEach((c, i) => c.setAttribute('aria-pressed', String(SUBJECTS[i] === subject)));
    countChips.forEach((c, i) => c.setAttribute('aria-pressed', String(LAYOUTS[i] === layout)));
  }

  // A PDF prints the same everywhere: the right page size, one sheet per page,
  // and the printer's "fit to page" takes care of margins.
  async function makePdf(subjects) {
    const bar = h('div');
    const m = modal(h('h2', null, 'Preparing the PDF…'), h('div', { class: 'progress' }, bar));
    try {
      const pdf = await sheetsPdf(subjects.map((s) => sheetSvg(s, layout)), {
        onProgress: (p) => { bar.style.width = `${Math.round(p * 100)}%`; },
      });
      const name = subjects.length === 1 ? `${subject.name} - ${layout.count} pictures.pdf` : `Drawing sheets - ${layout.count} pictures.pdf`;
      const file = new File([pdf], name, { type: 'application/pdf' });
      const url = URL.createObjectURL(file);
      urls.push(url);
      const canShare = navigator.canShare?.({ files: [file] });
      m.body.replaceChildren(
        h('h2', null, 'Ready to print'),
        h('p', null, `${subjects.length === 1 ? '1 page' : `${subjects.length} pages`}, A4 landscape. `
          + (canShare ? 'Tap Share, then Print (or send it to your computer).' : 'Open it and print. Keep "Fit to page" on.')),
        h('div', { class: 'row' },
          h('a', { class: 'btn', href: url, target: '_blank', rel: 'noopener', download: canShare ? null : name }, 'Open PDF'),
          canShare && h('button', { class: 'btn primary', onClick: () => share(file), html: `${icons.share} Share / Print` })),
        h('button', { class: 'btn', onClick: m.close }, 'Close'),
      );
    } catch (err) {
      m.body.replaceChildren(h('h2', null, 'Something went wrong'), h('p', null, err.message), h('button', { class: 'btn', onClick: m.close }, 'Close'));
    }
  }

  root.append(h('div', { class: 'screen sheets' },
    h('div', { class: 'topbar' },
      iconBtn('back', 'Back', () => { location.hash = '#/'; }),
      h('div', { class: 'title' }, 'Drawing sheets')),
    h('div', { class: 'row chips' }, subjectChips),
    h('div', { class: 'row chips' }, countChips),
    preview,
    h('p', { class: 'note' },
      'Kids draw the same thing in each box, changing it a little each time, then you scan the sheet. ',
      'More pictures means smoother movement but smaller boxes. Keep the 4 black corner squares clean. The scanner needs them.'),
    h('div', { class: 'row' },
      h('button', { class: 'btn', onClick: () => makePdf(SUBJECTS) }, 'Print all 6'),
      h('button', { class: 'btn primary', onClick: () => makePdf([subject]), html: `${icons.print} Print this one` })),
  ));

  update();
  return () => urls.forEach(URL.revokeObjectURL);
}

async function share(file) {
  try {
    await navigator.share({ files: [file] });
  } catch { /* cancelled */ }
}
