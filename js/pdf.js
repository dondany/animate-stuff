// Builds a print-ready A4 landscape PDF from sheet SVGs. Each page is the SVG
// rendered to a high-resolution JPEG; a PDF can embed JPEG data as-is, so the
// whole file format fits in a few lines and needs no library.

const DPI = 240;
const MM = DPI / 25.4;
const PT = 72 / 25.4;

async function renderPage(svg, wMm, hMm) {
  const w = Math.round(wMm * MM), h = Math.round(hMm * MM);
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.replace('<svg ', `<svg width="${w}" height="${h}" `));
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.92));
  return { w, h, jpeg: new Uint8Array(await blob.arrayBuffer()) };
}

export async function sheetsPdf(svgs, { wMm = 297, hMm = 210, onProgress = () => {} } = {}) {
  const pages = [];
  for (let i = 0; i < svgs.length; i++) {
    pages.push(await renderPage(svgs[i], wMm, hMm));
    onProgress((i + 1) / svgs.length);
  }

  const enc = new TextEncoder();
  const chunks = [];
  const offsets = [];
  let length = 0;
  const write = (part) => {
    const bytes = typeof part === 'string' ? enc.encode(part) : part;
    chunks.push(bytes);
    length += bytes.length;
  };
  const object = (id, ...parts) => {
    offsets[id] = length;
    write(`${id} 0 obj\n`);
    parts.forEach(write);
    write('\nendobj\n');
  };

  const pw = (wMm * PT).toFixed(2), ph = (hMm * PT).toFixed(2);
  // Object ids: 1 catalog, 2 page tree, then page / contents / image per page.
  const ids = pages.map((_, i) => ({ page: 3 + i * 3, content: 4 + i * 3, image: 5 + i * 3 }));

  write('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, `<< /Type /Pages /Count ${pages.length} /Kids [${ids.map((o) => `${o.page} 0 R`).join(' ')}] >>`);
  pages.forEach((p, i) => {
    const o = ids[i];
    const draw = `q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`;
    object(o.page, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 ${o.image} 0 R >> >> /Contents ${o.content} 0 R >>`);
    object(o.content, `<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`);
    object(o.image,
      `<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`,
      p.jpeg,
      '\nendstream');
  });

  const xref = length;
  const count = 3 + pages.length * 3;
  write(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let id = 1; id < count; id++) write(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
  write(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(chunks, { type: 'application/pdf' });
}
