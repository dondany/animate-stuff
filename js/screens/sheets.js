import { SUBJECTS, sheetSvg } from '../sheet.js';
import { h, icons, iconBtn } from '../ui.js';

export function renderSheets(root) {
  let current = SUBJECTS[1];

  const preview = h('div', { class: 'sheet-preview' });
  // Only this element is visible when printing (see @media print in app.css).
  const printArea = h('div', { class: 'print-area' });
  document.body.append(printArea);

  const chips = SUBJECTS.map((s) => h('button', {
    class: 'chip',
    onClick: () => { current = s; update(); },
  }, `${s.emoji} ${s.name}`));

  function update() {
    preview.innerHTML = sheetSvg(current);
    chips.forEach((c, i) => c.setAttribute('aria-pressed', String(SUBJECTS[i] === current)));
  }

  function print(subjects) {
    printArea.innerHTML = subjects.map(sheetSvg).join('');
    window.print();
  }

  root.append(h('div', { class: 'screen sheets' },
    h('div', { class: 'topbar' },
      iconBtn('back', 'Back', () => { location.hash = '#/'; }),
      h('div', { class: 'title' }, 'Drawing sheets')),
    h('div', { class: 'row chips' }, chips),
    preview,
    h('p', { class: 'note' },
      'Print on A4. Kids draw the same thing in each box, changing it a little each time, then you scan the sheet. ',
      'Keep the 4 black corner squares clean. The scanner needs them.'),
    h('div', { class: 'row' },
      h('button', { class: 'btn', onClick: () => print(SUBJECTS) }, 'Print all 6'),
      h('button', { class: 'btn primary', onClick: () => print([current]), html: `${icons.print} Print this one` })),
  ));

  update();
  return () => printArea.remove();
}
