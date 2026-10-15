// Turns a photo of a printed drawing sheet into four animation frames.
//
// 1. Find the corner markers (QR-style squares) in a small copy of the photo.
// 2. Work out the perspective (a homography) from page millimetres to photo pixels.
// 3. For every frame, sample the photo through the homography and divide by the
//    paper colour measured just outside the frame, which removes shadows and
//    colour casts, then push near-white (paper, faint guide lines) to white.

import { MARKERS, LAYOUTS, NAME_RECT, NUMBER_R, numberCenter } from './sheet.js';
import { FRAME_W, FRAME_H } from './camera.js';

const DETECT_SIZE = 1200;
const SAMPLE_SIZE = 3000;

export class ScanError extends Error {
  constructor(message, preview) {
    super(message);
    this.preview = preview;
  }
}

export async function scanSheet(file) {
  const img = await loadImage(file);
  const sample = drawScaled(img, SAMPLE_SIZE);
  const detect = drawScaled(sample.canvas, DETECT_SIZE);
  const gray = toGray(detect.data, detect.w, detect.h);
  const { corners, layout, candidates } = findMarkers(gray, detect.w, detect.h);

  if (!corners) {
    throw new ScanError(
      candidates.length
        ? "Couldn't find all the black corner squares. Make sure the whole sheet is in the photo."
        : "Couldn't find the sheet in this photo. Take it from above, with all 4 corner squares in view.",
      previewWithMarks(detect.canvas, candidates),
    );
  }

  const k = sample.w / detect.w;
  const H = homography(
    [MARKERS.tl, MARKERS.tr, MARKERS.bl, MARKERS.br].map((m) => [m.x, m.y]),
    [corners.tl, corners.tr, corners.bl, corners.br].map((p) => [p.x * k, p.y * k]),
  );

  const badges = layout.frames.map(numberCenter);
  const frames = [];
  for (const f of layout.frames) {
    frames.push(await toJpeg(warpFrame(sample, H, f, badges)));
    await new Promise((r) => setTimeout(r, 0));
  }
  const label = await toJpeg(warpLabel(sample, H));
  return { frames, label, count: layout.count };
}

// ---------- image plumbing ----------

async function loadImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode(); // <img> applies the photo's EXIF rotation, unlike some other paths
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function drawScaled(source, maxSide) {
  const sw = source.naturalWidth ?? source.width;
  const sh = source.naturalHeight ?? source.height;
  const s = Math.min(1, maxSide / Math.max(sw, sh));
  const w = Math.round(sw * s);
  const h = Math.round(sh * s);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, w, h);
  return { canvas, w, h, data: ctx.getImageData(0, 0, w, h).data };
}

function toGray(data, w, h) {
  const g = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < g.length; i++, p += 4) g[i] = (data[p] * 77 + data[p + 1] * 150 + data[p + 2] * 29) >> 8;
  return g;
}

function toJpeg(imageData) {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  canvas.getContext('2d').putImageData(imageData, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not save the frame'))), 'image/jpeg', 0.9);
  });
}

function previewWithMarks(canvas, candidates) {
  const ctx = canvas.getContext('2d');
  ctx.lineWidth = Math.max(3, canvas.width / 300);
  ctx.strokeStyle = '#ff3b3b';
  for (const c of candidates) {
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.size * 0.8, 0, Math.PI * 2);
    ctx.stroke();
  }
  return canvas.toDataURL('image/jpeg', 0.7);
}

// ---------- marker detection ----------

// Bradley adaptive threshold: a pixel is "ink" if it's clearly darker than its
// neighbourhood. Copes with uneven light much better than a fixed cut-off.
function threshold(gray, w, h) {
  const integral = new Uint32Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += gray[y * w + x];
      integral[(y + 1) * (w + 1) + x + 1] = integral[y * (w + 1) + x + 1] + row;
    }
  }
  const half = Math.max(4, Math.round(Math.max(w, h) / 28));
  const bin = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - half), y1 = Math.min(h, y + half + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - half), x1 = Math.min(w, x + half + 1);
      const sum = integral[y1 * (w + 1) + x1] - integral[y0 * (w + 1) + x1] - integral[y1 * (w + 1) + x0] + integral[y0 * (w + 1) + x0];
      const count = (x1 - x0) * (y1 - y0);
      bin[y * w + x] = gray[y * w + x] * count < sum * 0.8 ? 1 : 0;
    }
  }
  return bin;
}

// Connected components (4-connected) with per-component bounding boxes and centroids.
function components(bin, w, h) {
  const labels = new Int32Array(w * h);
  const parent = new Int32Array((w * h >> 1) + 2);
  const find = (a) => {
    while (parent[a] !== a) a = parent[a] = parent[parent[a]];
    return a;
  };
  let next = 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!bin[i]) continue;
      const up = y ? labels[i - w] : 0;
      const left = x ? labels[i - 1] : 0;
      if (!up && !left) {
        parent[next] = next;
        labels[i] = next++;
      } else if (up && left) {
        const a = find(up), b = find(left);
        if (a !== b) parent[Math.max(a, b)] = Math.min(a, b);
        labels[i] = Math.min(a, b);
      } else {
        labels[i] = up || left;
      }
    }
  }

  const area = new Int32Array(next), sumX = new Float64Array(next), sumY = new Float64Array(next);
  const minX = new Int32Array(next).fill(w), maxX = new Int32Array(next).fill(-1);
  const minY = new Int32Array(next).fill(h), maxY = new Int32Array(next).fill(-1);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!labels[i]) continue;
      const l = labels[i] = find(labels[i]);
      area[l]++; sumX[l] += x; sumY[l] += y;
      if (x < minX[l]) minX[l] = x;
      if (x > maxX[l]) maxX[l] = x;
      if (y < minY[l]) minY[l] = y;
      if (y > maxY[l]) maxY[l] = y;
    }
  }
  return { labels, count: next, area, sumX, sumY, minX, maxX, minY, maxY };
}

// Walks from (x, y) in direction (dx, dy) across white pixels and returns the
// label of the first ink pixel it hits, or 0.
function ray(c, bin, w, h, x, y, dx, dy, maxSteps) {
  let gap = 0;
  for (let s = 0; s < maxSteps; s++) {
    x += dx; y += dy;
    if (x < 0 || y < 0 || x >= w || y >= h) return { label: 0, gap };
    const i = y * w + x;
    if (bin[i]) return { label: c.labels[i], gap };
    gap++;
  }
  return { label: 0, gap };
}

// A marker is a solid square whose surroundings, in all four directions,
// hit the same enclosing ring of ink.
function finderCandidates(bin, w, h) {
  const c = components(bin, w, h);
  const out = [];
  for (let l = 1; l < c.count; l++) {
    const a = c.area[l];
    if (a < 9) continue;
    const bw = c.maxX[l] - c.minX[l] + 1;
    const bh = c.maxY[l] - c.minY[l] + 1;
    if (bw / bh > 2.5 || bh / bw > 2.5 || a / (bw * bh) < 0.45) continue;

    const cx = c.sumX[l] / a, cy = c.sumY[l] / a;
    const ix = Math.round(cx), iy = Math.round(cy);
    const reach = 3 * Math.max(bw, bh);
    const hits = [
      ray(c, bin, w, h, c.minX[l], iy, -1, 0, reach),
      ray(c, bin, w, h, c.maxX[l], iy, 1, 0, reach),
      ray(c, bin, w, h, ix, c.minY[l], 0, -1, reach),
      ray(c, bin, w, h, ix, c.maxY[l], 0, 1, reach),
    ];
    const ring = hits[0].label;
    if (!ring || ring === l || hits.some((r) => r.label !== ring)) continue;
    if (hits.some((r) => r.gap < 1 || r.gap > Math.max(bw, bh))) continue;

    const rw = c.maxX[ring] - c.minX[ring] + 1;
    const rh = c.maxY[ring] - c.minY[ring] + 1;
    const ratio = c.area[ring] / a;
    if (ratio < 1.2 || ratio > 6) continue;
    if (rw / bw < 1.6 || rw / bw > 4 || rh / bh < 1.6 || rh / bh > 4) continue;
    if (c.minX[ring] >= c.minX[l] || c.maxX[ring] <= c.maxX[l] || c.minY[ring] >= c.minY[l] || c.maxY[ring] <= c.maxY[l]) continue;
    const rcx = c.sumX[ring] / c.area[ring], rcy = c.sumY[ring] / c.area[ring];
    if (Math.hypot(rcx - cx, rcy - cy) > 0.2 * (rw + rh) / 2) continue;

    out.push({ x: (cx + rcx) / 2, y: (cy + rcy) / 2, size: (rw + rh) / 2 });
  }
  return out;
}

const PAGE_POINTS = [MARKERS.tl, MARKERS.tr, MARKERS.bl, MARKERS.br].map((m) => [m.x, m.y]);

// How many pixels one millimetre of the page covers around a page point.
function localScale(H, x, y) {
  const [ax, ay] = project(H, x, y);
  const [bx, by] = project(H, x + 1, y);
  const [cx, cy] = project(H, x, y + 1);
  return Math.sqrt(Math.abs((bx - ax) * (cy - ay) - (by - ay) * (cx - ax)));
}

// How far the observed marker sizes are from what this perspective predicts.
// This is what tells the small bottom-right marker apart from the top-left one.
function sizeError(H, assigned) {
  let err = 0;
  for (const [key, c] of Object.entries(assigned)) {
    if (!c) continue;
    const m = MARKERS[key];
    err = Math.max(err, Math.abs(Math.log(c.size / (7 * m.module * localScale(H, m.x, m.y)))));
  }
  return err;
}

// Fraction of points on the printed frame borders that really are dark lines.
function borderScore(gray, w, h, H, layout) {
  const at = (x, y) => {
    const [px, py] = project(H, x, y);
    const ix = Math.round(px), iy = Math.round(py);
    return ix < 0 || iy < 0 || ix >= w || iy >= h ? -1 : gray[iy * w + ix];
  };
  let hits = 0, total = 0;
  for (const f of layout.frames) {
    const edges = [
      [f.x, f.y, 1, 0, 0, -1], [f.x, f.y + f.h, 1, 0, 0, 1],
      [f.x, f.y, 0, 1, -1, 0], [f.x + f.w, f.y, 0, 1, 1, 0],
    ];
    for (const [x0, y0, dx, dy, nx, ny] of edges) {
      const len = dx ? f.w : f.h;
      for (let t = 0.1; t < 0.95; t += 0.1) {
        const x = x0 + dx * len * t, y = y0 + dy * len * t;
        const line = Math.min(...[-0.6, 0, 0.6].map((o) => at(x + nx * o, y + ny * o)).filter((v) => v >= 0));
        const paper = at(x + nx * 2.5, y + ny * 2.5);
        total++;
        if (paper > 0 && line < paper * 0.8) hits++;
      }
    }
  }
  return hits / total;
}

// Tries every plausible way of matching found squares to the sheet's corners,
// and every frame layout (4, 8 or 12 pictures), and keeps the combination
// whose printed frame borders line up best.
function findMarkers(gray, w, h) {
  const candidates = finderCandidates(threshold(gray, w, h), w, h);
  const top = [...candidates].sort((a, b) => b.size - a.size).slice(0, 12);
  let best = null;

  const consider = (tl, tr, bl, br) => {
    const corner = br ?? { x: tr.x + bl.x - tl.x, y: tr.y + bl.y - tl.y };
    const H = homography(PAGE_POINTS, [tl, tr, bl, corner].map((p) => [p.x, p.y]));
    if (!H.every(Number.isFinite)) return;
    const err = sizeError(H, { tl, tr, bl, br });
    if (err > 0.5) return;
    for (const layout of LAYOUTS) {
      const score = borderScore(gray, w, h, H, layout) - err * 0.2 - (br ? 0 : 0.1);
      if (!best || score > best.score) best = { score, layout, corners: { tl, tr, bl, br: corner } };
    }
  };

  // For three points, TL is the one where TR and BL turn clockwise, as on the page.
  const orient = (tl, p, q) => {
    const cross = (p.x - tl.x) * (q.y - tl.y) - (p.y - tl.y) * (q.x - tl.x);
    return cross > 0 ? [p, q] : [q, p];
  };

  // All four markers visible: any convex quad, any corner as top-left.
  for (let i = 0; i < top.length; i++) for (let j = i + 1; j < top.length; j++)
    for (let k = j + 1; k < top.length; k++) for (let l = k + 1; l < top.length; l++) {
      const quad = [top[i], top[j], top[k], top[l]];
      const cx = quad.reduce((s, p) => s + p.x, 0) / 4, cy = quad.reduce((s, p) => s + p.y, 0) / 4;
      quad.sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
      const turns = quad.map((p, n) => {
        const q = quad[(n + 1) % 4], r = quad[(n + 2) % 4];
        return Math.sign((q.x - p.x) * (r.y - q.y) - (q.y - p.y) * (r.x - q.x));
      });
      if (!turns.every((t) => t === turns[0])) continue;
      for (let n = 0; n < 4; n++) {
        const [tr, bl] = orient(quad[n], quad[(n + 1) % 4], quad[(n + 3) % 4]);
        consider(quad[n], tr, bl, quad[(n + 2) % 4]);
      }
    }

  // Bottom-right marker hidden (e.g. under a hand): fall back to three.
  if (!best || best.score < 0.6) {
    for (let i = 0; i < top.length; i++) for (let j = i + 1; j < top.length; j++)
      for (let k = j + 1; k < top.length; k++) {
        const tri = [top[i], top[j], top[k]];
        for (let n = 0; n < 3; n++) {
          const [tr, bl] = orient(tri[n], tri[(n + 1) % 3], tri[(n + 2) % 3]);
          consider(tri[n], tr, bl, null);
        }
      }
  }

  const found = best && best.score >= 0.6;
  return { corners: found ? best.corners : null, layout: found ? best.layout : null, candidates };
}

// ---------- geometry ----------

// Solves the 3×3 perspective transform mapping four src points onto four dst points.
export function homography(src, dst) {
  const A = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i];
    const [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  for (let col = 0; col < 8; col++) {
    let pivot = col;
    for (let r = col + 1; r < 8; r++) if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r;
    [A[col], A[pivot]] = [A[pivot], A[col]];
    for (let r = 0; r < 8; r++) {
      if (r === col) continue;
      const f = A[r][col] / A[col][col];
      for (let k = col; k < 9; k++) A[r][k] -= f * A[col][k];
    }
  }
  return [...A.map((row, i) => row[8] / row[i]), 1];
}

export function project(H, x, y) {
  const d = H[6] * x + H[7] * y + H[8];
  return [(H[0] * x + H[1] * y + H[2]) / d, (H[3] * x + H[4] * y + H[5]) / d];
}

// ---------- sampling ----------

function bilinear(img, x, y, out) {
  const { data, w, h } = img;
  x = Math.min(Math.max(x - 0.5, 0), w - 1.001);
  y = Math.min(Math.max(y - 0.5, 0), h - 1.001);
  const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0;
  const i = (y0 * w + x0) * 4, j = i + w * 4;
  for (let c = 0; c < 3; c++) {
    const top = data[i + c] + (data[i + 4 + c] - data[i + c]) * fx;
    const bot = data[j + c] + (data[j + 4 + c] - data[j + c]) * fx;
    out[c] = top + (bot - top) * fy;
  }
  return out;
}

const lum = (c) => c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;

// Paper colour around a page point: the brightest few of nine nearby samples,
// so a stray pencil mark doesn't count as paper.
function paperAt(img, H, x, y) {
  const samples = [];
  for (const dx of [-0.8, 0, 0.8]) {
    for (const dy of [-0.8, 0, 0.8]) {
      const [px, py] = project(H, x + dx, y + dy);
      samples.push(bilinear(img, px, py, [0, 0, 0]));
    }
  }
  samples.sort((a, b) => lum(b) - lum(a));
  return [0, 1, 2].map((c) => (samples[0][c] + samples[1][c] + samples[2][c] + samples[3][c] + samples[4][c]) / 5);
}

// Measures the paper along one side of the frame (just outside its border).
// Points covered by the number badge come back as null.
function paperAlong(img, H, from, to, skip, n = 24) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const x = from[0] + (to[0] - from[0]) * t;
    const y = from[1] + (to[1] - from[1]) * t;
    pts.push(skip(x, y) ? null : paperAt(img, H, x, y));
  }
  return pts;
}

const median = (values) => values.sort((a, b) => a - b)[values.length >> 1];

// Keeps shadows but drops marks. A shadow darkens paper evenly in all three
// channels; crayon, felt-tip or a dark pencil line doesn't. Dropped points are
// filled in from their neighbours along the same side.
function cleanSides(sides) {
  const all = sides.flat().filter(Boolean);
  const ref = [0, 1, 2].map((c) => Math.max(1, median(all.map((p) => p[c]))));
  const isNeutral = (p) => {
    const r = p.map((v, c) => v / ref[c]);
    const mean = (r[0] + r[1] + r[2]) / 3;
    return mean > 0.3 && (Math.max(...r) - Math.min(...r)) / mean < 0.15;
  };
  return sides.map((side) => {
    // Shadows change gradually; a sudden dark dip between two brighter
    // neighbours is a pencil line or the edge of something printed.
    const good = side.map((p, i) => {
      if (!p || !isNeutral(p)) return false;
      const prev = side[i - 1], next = side[i + 1];
      return !(prev && next && lum(p) < 0.88 * Math.min(lum(prev), lum(next)));
    });
    return side.map((p, i) => {
      if (good[i]) return p;
      let a = i - 1, b = i + 1;
      while (a >= 0 && !good[a]) a--;
      while (b < side.length && !good[b]) b++;
      if (a < 0 && b >= side.length) return ref;
      if (a < 0) return side[b];
      if (b >= side.length) return side[a];
      const f = (i - a) / (b - a);
      return [0, 1, 2].map((c) => side[a][c] + (side[b][c] - side[a][c]) * f);
    });
  });
}

function along(profile, t) {
  const x = t * (profile.length - 1);
  const i = Math.min(profile.length - 2, Math.max(0, Math.floor(x)));
  const f = Math.min(1, Math.max(0, x - i));
  return [0, 1, 2].map((c) => profile[i][c] + (profile[i + 1][c] - profile[i][c]) * f);
}

// Maps colour divided by paper colour (1 = paper) to output: paper and faint
// guide lines go white, ink and crayon get a contrast boost.
const TONE = new Uint8ClampedArray(512);
for (let i = 0; i < 512; i++) {
  const r = i / 384;
  TONE[i] = 255 * Math.pow(Math.min(1, Math.max(0, (r - 0.1) / 0.7)), 1.15);
}

function warpFrame(img, H, f, badges) {
  // The crop sits inside the printed border and keeps a 4:3 shape.
  const innerW = f.w - 5;
  const innerH = innerW * FRAME_H / FRAME_W;
  const x0 = f.x + 2.5;
  const y0 = f.y + (f.h - innerH) / 2;

  // Paper colour on a ring 3.5 mm outside the frame, skipping the number badge.
  const d = 3.5;
  const L = f.x - d, R = f.x + f.w + d, T = f.y - d, B = f.y + f.h + d;
  const skip = (x, y) => badges.some((b) => Math.hypot(x - b.x, y - b.y) < NUMBER_R + 1.5);
  const [top, bottom, left, right] = cleanSides([
    paperAlong(img, H, [L, T], [R, T], skip),
    paperAlong(img, H, [L, B], [R, B], skip),
    paperAlong(img, H, [L, T], [L, B], skip),
    paperAlong(img, H, [R, T], [R, B], skip),
  ]);

  const out = new ImageData(FRAME_W, FRAME_H);
  const colS = [], colT = [], colB = [];
  for (let ox = 0; ox < FRAME_W; ox++) {
    const s = (x0 + (ox + 0.5) * innerW / FRAME_W - L) / (R - L);
    colS.push(s);
    colT.push(along(top, s));
    colB.push(along(bottom, s));
  }
  const c00 = top[0], c10 = top[top.length - 1], c01 = bottom[0], c11 = bottom[bottom.length - 1];
  const px = [0, 0, 0];

  for (let oy = 0; oy < FRAME_H; oy++) {
    const v = y0 + (oy + 0.5) * innerH / FRAME_H;
    const t = (v - T) / (B - T);
    const lv = along(left, t), rv = along(right, t);
    for (let ox = 0; ox < FRAME_W; ox++) {
      const u = x0 + (ox + 0.5) * innerW / FRAME_W;
      const [sx, sy] = project(H, u, v);
      bilinear(img, sx, sy, px);
      const s = colS[ox], tv = colT[ox], bv = colB[ox];
      const o = (oy * FRAME_W + ox) * 4;
      for (let c = 0; c < 3; c++) {
        // Coons patch: blends the four measured edges into a smooth paper estimate.
        const paper = (1 - t) * tv[c] + t * bv[c] + (1 - s) * lv[c] + s * rv[c]
          - ((1 - s) * (1 - t) * c00[c] + s * (1 - t) * c10[c] + (1 - s) * t * c01[c] + s * t * c11[c]);
        out.data[o + c] = TONE[Math.min(511, Math.round((px[c] / Math.max(paper, 1)) * 384))];
      }
      out.data[o + 3] = 255;
    }
  }
  return out;
}

// The handwritten name, for telling sheets apart.
function warpLabel(img, H) {
  const { x, y, w, h } = NAME_RECT;
  const scale = 5; // px per mm
  const ow = Math.round(w * scale), oh = Math.round(h * scale);
  const paper = paperAt(img, H, x + w - 2, y + 2);
  const out = new ImageData(ow, oh);
  const px = [0, 0, 0];
  for (let oy = 0; oy < oh; oy++) {
    for (let ox = 0; ox < ow; ox++) {
      const [sx, sy] = project(H, x + (ox + 0.5) / scale, y + (oy + 0.5) / scale);
      bilinear(img, sx, sy, px);
      const o = (oy * ow + ox) * 4;
      for (let c = 0; c < 3; c++) out.data[o + c] = TONE[Math.min(511, Math.round((px[c] / Math.max(paper[c], 1)) * 384))];
      out.data[o + 3] = 255;
    }
  }
  return out;
}
