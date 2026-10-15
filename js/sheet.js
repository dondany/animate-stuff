// The printable drawing sheet. All coordinates are millimetres on an A4
// landscape page; the scanner uses the same numbers to find the frames.

export const PAGE = { w: 297, h: 210 };

// QR-style finder squares: 7 modules (black ring, white ring, black centre).
// They're the same on every layout; the small one sits bottom-right.
export const MARKERS = {
  tl: { x: 18.75, y: 18.75, module: 2.5 },
  tr: { x: 278.25, y: 18.75, module: 2.5 },
  bl: { x: 18.75, y: 191.25, module: 2.5 },
  br: { x: 278.25, y: 191.25, module: 1.5 },
};

// The frame number badge sits in the gutter left of each frame's top corner.
export const NUMBER_R = 3.8;
export const numberCenter = (f) => ({ x: f.x - 5, y: f.y + 5 });

// Where the child writes their name; the scanner crops this as a label.
export const NAME_RECT = { x: 32, y: 10, w: 120, h: 19 };

// A centred grid of 4:3 frames. Gutters leave room for the number badges and
// for the scanner to measure the paper around each frame.
function grid({ cols, rows, w, gapY, cy }) {
  const h = (w * 3) / 4;
  const gapX = 10;
  const x0 = PAGE.w / 2 - (cols * w + (cols - 1) * gapX) / 2;
  const y0 = cy - (rows * h + (rows - 1) * gapY) / 2;
  const frames = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) frames.push({ x: x0 + c * (w + gapX), y: y0 + r * (h + gapY), w, h });
  }
  return { count: cols * rows, frames };
}

// Frame layouts must stay clear of the corner markers.
export const LAYOUTS = [
  grid({ cols: 2, rows: 2, w: 100, gapY: 10, cy: 116 }),
  grid({ cols: 4, rows: 2, w: 56.75, gapY: 10, cy: 114.5 }),
  grid({ cols: 4, rows: 3, w: 56.75, gapY: 8, cy: 104.85 }),
];

export const layoutFor = (count) => LAYOUTS.find((l) => l.count === count) ?? LAYOUTS[0];

// ---------- trace outlines ----------
// Each subject draws one frame at progress t (0..1) in a 100 × 75 box, so any
// number of frames gets smooth in-between steps. Looping subjects use
// t = i / n (the last frame leads back into the first); the others run
// t = 0..1 so the last frame shows the finished picture.

const f2 = (n) => Math.round(n * 100) / 100;
const clamp01 = (n) => Math.min(1, Math.max(0, n));
const ground = (y) => `<line x1="6" y1="${y}" x2="94" y2="${y}"/>`;

function bouncingBall(t) {
  const floor = 66, r = 8, top = 12;
  // 0 at the top, 1 on the floor; squared so it falls slowly at first and fast near the floor.
  const p = t < 0.5 ? (2 * t) ** 2 : (2 * (1 - t)) ** 2;
  if (p > 0.999) return ground(floor) + `<ellipse cx="50" cy="${floor - 5.5}" rx="11" ry="5.5"/>`;
  const fast = p > 0.6; // stretch a little when it's moving fast
  const cy = top + (floor - r - top) * p;
  return ground(floor) + `<ellipse cx="50" cy="${f2(cy)}" rx="${fast ? 7.2 : r}" ry="${fast ? 9 : r}"/>`;
}

function sunrise(t) {
  const horizon = 52, r = 11, cy = 60 - 40 * t; // ends low enough for the rays to fit
  let sun = '';
  if (cy + r <= horizon) {
    sun = `<circle cx="50" cy="${f2(cy)}" r="${r}"/>`;
  } else if (cy - r < horizon) {
    // Only the part above the horizon.
    const dx = Math.sqrt(r * r - (horizon - cy) ** 2);
    sun = `<path d="M${f2(50 - dx)} ${horizon}A${r} ${r} 0 ${cy < horizon ? 1 : 0} 1 ${f2(50 + dx)} ${horizon}"/>`;
  }
  let rays = '';
  if (t > 0.999) {
    rays = Array.from({ length: 8 }, (_, i) => {
      const a = (i * Math.PI) / 4;
      const p = (d) => `${f2(50 + d * Math.cos(a))} ${f2(cy + d * Math.sin(a))}`;
      return `<path d="M${p(r + 3)}L${p(r + 8)}"/>`;
    }).join('');
  }
  return ground(horizon) + sun + rays;
}

function growingFlower(t) {
  const top = 61 - 32 * t;
  let out = ground(68) + `<path d="M50 68V${f2(top)}"/>`;
  const leaf = clamp01((t - 0.1) / 0.35);
  if (leaf > 0) {
    const s = 0.4 + 0.6 * leaf;
    out += `<path d="M50 60q${f2(-8 * s)} ${f2(-6 * s)} ${f2(-12 * s)} 0q${f2(6 * s)} ${f2(4 * s)} ${f2(12 * s)} 0"/>`;
    if (top < 52) out += `<path d="M50 55q${f2(8 * s)} ${f2(-6 * s)} ${f2(12 * s)} 0q${f2(-6 * s)} ${f2(4 * s)} ${f2(-12 * s)} 0"/>`;
  } else {
    out += '<path d="M50 64q-4-3-6 0q3 2 6 0"/>';
  }
  if (t >= 0.8) {
    const q = clamp01((t - 0.8) / 0.2);
    const cy = top - 5, dist = 5 + 3.5 * q, pr = 2.4 + 2.2 * q;
    out += [0, 60, 120, 180, 240, 300].map((deg) => {
      const a = (deg * Math.PI) / 180;
      return `<circle cx="${f2(50 + dist * Math.cos(a))}" cy="${f2(cy + dist * Math.sin(a))}" r="${f2(pr)}"/>`;
    }).join('') + `<circle cx="50" cy="${f2(cy)}" r="4.5"/>`;
  } else if (t >= 0.5) {
    const k = clamp01((t - 0.5) / 0.3);
    out += `<ellipse cx="50" cy="${f2(top - 3 - 2 * k)}" rx="${f2(2 + 2 * k)}" ry="${f2(3 + 2.5 * k)}"/>`;
  }
  return out;
}

function sadToHappy(t) {
  const c = -1 + 2 * t; // -1 frown … +1 smile
  const ends = f2(49 - 3 * c), mid = f2(49 + 9 * c);
  const mouth = t > 0.999
    ? 'M36 45Q50 62 64 45Q50 49 36 45'
    : `M38 ${ends}Q50 ${mid} 62 ${ends}`;
  return `<circle cx="50" cy="37" r="26"/><circle cx="41" cy="30" r="2.5"/><circle cx="59" cy="30" r="2.5"/><path d="${mouth}"/>`;
}

// Stick-figure keyframes; in-betweens are blended from neighbouring poses.
const STAND = { head: [50, 22], body: [50, 28, 50, 48], arms: [50, 33, 43, 45, 50, 33, 57, 45], legs: [50, 48, 47, 58, 45, 68, 50, 48, 53, 58, 55, 68] };
const CROUCH = { head: [50, 32], body: [50, 38, 50, 54], arms: [50, 42, 40, 50, 50, 42, 60, 50], legs: [50, 54, 42, 60, 45, 68, 50, 54, 58, 60, 55, 68] };
const AIR = { head: [50, 10], body: [50, 16, 50, 36], arms: [50, 20, 40, 8, 50, 20, 60, 8], legs: [50, 36, 46, 44, 44, 52, 50, 36, 54, 44, 56, 52] };
const LAND = { ...CROUCH, arms: [50, 42, 38, 39, 50, 42, 62, 39] };
const JUMP = [[0, STAND], [0.25, CROUCH], [0.5, AIR], [0.75, LAND], [1, STAND]];

function jumpingKid(t) {
  let i = 0;
  while (i < JUMP.length - 2 && t >= JUMP[i + 1][0]) i++;
  const [ta, a] = JUMP[i], [tb, b] = JUMP[i + 1];
  const k = (t - ta) / (tb - ta);
  const p = {};
  for (const key of Object.keys(a)) p[key] = a[key].map((v, n) => f2(v + (b[key][n] - v) * k));
  const line = (pts) => `<polyline points="${pts.join(' ')}"/>`;
  return ground(68)
    + `<circle cx="${p.head[0]}" cy="${p.head[1]}" r="6"/>`
    + line(p.body) + line(p.arms.slice(0, 4)) + line(p.arms.slice(4)) + line(p.legs.slice(0, 6)) + line(p.legs.slice(6));
}

export const SUBJECTS = [
  { id: 'blank', emoji: '✏️', name: 'Blank', hint: 'Draw anything. Change it a little each time.', loop: true, draw: () => '' },
  { id: 'ball', emoji: '⚽', name: 'Bouncing ball', hint: 'Colour the ball. Watch it bounce!', loop: true, draw: bouncingBall },
  { id: 'sun', emoji: '☀️', name: 'Sunrise', hint: 'Colour the sun and the sky. Good morning!', loop: false, draw: sunrise },
  { id: 'flower', emoji: '🌷', name: 'Growing flower', hint: 'Colour the flower as it grows.', loop: false, draw: growingFlower },
  { id: 'smile', emoji: '🙂', name: 'Sad to happy', hint: 'Give the face colours. Make it smile!', loop: false, draw: sadToHappy },
  { id: 'jump', emoji: '🤸', name: 'Jumping kid', hint: 'Dress up the kid. Ready, steady, jump!', loop: true, draw: jumpingKid },
];

// ---------- the page ----------

function finder({ x, y, module: m }) {
  const r = (s) => `<rect x="${x - (s * m) / 2}" y="${y - (s * m) / 2}" width="${s * m}" height="${s * m}"`;
  return `${r(7)} fill="#000"/>${r(5)} fill="#fff"/>${r(3)} fill="#000"/>`;
}

export function sheetSvg(subject, layout = LAYOUTS[0]) {
  const n = layout.count;
  const frames = layout.frames.map((f, i) => {
    const s = f.w / 100; // guides are drawn in a 100 × 75 box
    const t = subject.loop ? i / n : i / (n - 1);
    const badge = numberCenter(f);
    // Keep the outlines about the same line weight on small and big frames.
    const guide = `fill="none" stroke="#c8c8c8" stroke-width="${f2(0.7 / s)}" stroke-dasharray="${f2(2.2 / s)} ${f2(1.6 / s)}" stroke-linecap="round" stroke-linejoin="round"`;
    return `<rect x="${f2(f.x)}" y="${f2(f.y)}" width="${f2(f.w)}" height="${f2(f.h)}" rx="2" fill="#fff" stroke="#333" stroke-width="0.8"/>`
      + `<g transform="translate(${f2(f.x)} ${f2(f.y)}) scale(${f2(s)})" ${guide}>${subject.draw(t)}</g>`
      + `<circle cx="${f2(badge.x)}" cy="${f2(badge.y)}" r="${NUMBER_R}" fill="#222"/>`
      + `<text x="${f2(badge.x)}" y="${f2(badge.y + 1.9)}" font-size="${i >= 9 ? 4.4 : 5.4}" font-weight="800" fill="#fff" text-anchor="middle">${i + 1}</text>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PAGE.w} ${PAGE.h}"
    font-family="ui-rounded, 'SF Pro Rounded', 'Arial Rounded MT Bold', system-ui, sans-serif">
    <rect width="${PAGE.w}" height="${PAGE.h}" fill="#fff"/>
    ${Object.values(MARKERS).map(finder).join('')}
    <text x="34" y="24" font-size="6" font-weight="800" fill="#222">Name:</text>
    <line x1="55" y1="25" x2="150" y2="25" stroke="#999" stroke-width="0.4"/>
    <text x="263" y="19" font-size="6" font-weight="800" fill="#222" text-anchor="end">${subject.name} · ${n} pictures</text>
    <text x="263" y="25.5" font-size="3.6" fill="#666" text-anchor="end">${subject.hint}</text>
    ${frames}
  </svg>`;
}
