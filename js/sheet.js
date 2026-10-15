// The printable drawing sheet. All coordinates are millimetres on an A4
// landscape page; the scanner uses the same numbers to find the frames.

export const PAGE = { w: 297, h: 210 };

// QR-style finder squares: 7 modules (black ring, white ring, black centre).
// Three big ones tell the scanner which way is up; the small one sits bottom-right.
export const MARKERS = {
  tl: { x: 18.75, y: 18.75, module: 2.5 },
  tr: { x: 278.25, y: 18.75, module: 2.5 },
  bl: { x: 18.75, y: 191.25, module: 2.5 },
  br: { x: 278.25, y: 191.25, module: 1.5 },
};

export const FRAME = { w: 100, h: 75 };
export const FRAMES = [
  { x: 43.5, y: 36 }, { x: 153.5, y: 36 },
  { x: 43.5, y: 121 }, { x: 153.5, y: 121 },
];

// The frame number badge sits in the gutter left of each frame's top corner.
export const NUMBER_R = 3.8;
export const numberCenter = (f) => ({ x: f.x - 5, y: f.y + 5 });

// Where the child writes their name; the scanner crops this as a label.
export const NAME_RECT = { x: 32, y: 10, w: 120, h: 19 };

const GUIDE = 'fill="none" stroke="#c8c8c8" stroke-width="0.7" stroke-dasharray="2.2 1.6" stroke-linecap="round" stroke-linejoin="round"';
const ground = (y) => `<line x1="6" y1="${y}" x2="94" y2="${y}"/>`;

function stickFigure({ head, neck, hip, arms, legs }) {
  return `<circle cx="${head[0]}" cy="${head[1]}" r="6"/>`
    + `<line x1="${neck[0]}" y1="${neck[1]}" x2="${hip[0]}" y2="${hip[1]}"/>`
    + [...arms, ...legs].map((pts) => `<polyline points="${pts.join(' ')}"/>`).join('');
}

const crouch = {
  head: [50, 32], neck: [50, 38], hip: [50, 54],
  arms: [[50, 42, 40, 50], [50, 42, 60, 50]],
  legs: [[50, 54, 42, 60, 45, 68], [50, 54, 58, 60, 55, 68]],
};

const leaves = '<path d="M50 58q-8-6-12 0q6 4 12 0"/><path d="M50 53q8-6 12 0q-6 4-12 0"/>';
const petals = [0, 60, 120, 180, 240, 300].map((a) => {
  const r = (a * Math.PI) / 180;
  return `<circle cx="${(50 + 8.5 * Math.cos(r)).toFixed(2)}" cy="${(24 + 8.5 * Math.sin(r)).toFixed(2)}" r="4.6"/>`;
}).join('');
const sunRays = Array.from({ length: 8 }, (_, i) => {
  const r = (i * Math.PI) / 4;
  const p = (d) => `${(50 + d * Math.cos(r)).toFixed(2)} ${(14 + d * Math.sin(r)).toFixed(2)}`;
  return `<path d="M${p(14)}L${p(19)}"/>`;
}).join('');

// Faint outlines to trace, drawn in frame coordinates (100 × 75 mm).
export const SUBJECTS = [
  { id: 'blank', emoji: '✏️', name: 'Blank', hint: 'Draw anything. Change it a little in every box.', frames: ['', '', '', ''] },
  {
    id: 'ball', emoji: '⚽', name: 'Bouncing ball', hint: 'Colour the ball. Watch it bounce!',
    frames: [
      ground(66) + '<circle cx="22" cy="16" r="8"/>',
      ground(66) + '<circle cx="42" cy="40" r="8"/>',
      ground(66) + '<ellipse cx="58" cy="61" rx="10.5" ry="5"/>',
      ground(66) + '<circle cx="76" cy="36" r="8"/>',
    ],
  },
  {
    id: 'sun', emoji: '☀️', name: 'Sunrise', hint: 'Colour the sun and the sky. Good morning!',
    frames: [
      ground(52) + '<path d="M40.78 52A11 11 0 0 1 59.22 52"/>',
      ground(52) + '<circle cx="50" cy="40" r="11"/>',
      ground(52) + '<circle cx="50" cy="26" r="11"/>',
      ground(52) + '<circle cx="50" cy="14" r="11"/>' + sunRays,
    ],
  },
  {
    id: 'flower', emoji: '🌷', name: 'Growing flower', hint: 'Colour the flower as it grows.',
    frames: [
      ground(68) + '<path d="M50 68V61"/><path d="M50 64q-4-3-6 0q3 2 6 0"/>',
      ground(68) + '<path d="M50 68V46"/>' + leaves,
      ground(68) + '<path d="M50 68V35"/>' + leaves + '<ellipse cx="50" cy="30" rx="4" ry="5.5"/>',
      ground(68) + '<path d="M50 68V29"/>' + leaves + petals + '<circle cx="50" cy="24" r="4.5"/>',
    ],
  },
  {
    id: 'smile', emoji: '🙂', name: 'Sad to happy', hint: 'Give the face colours. Make it smile!',
    frames: [
      'M38 53Q50 43 62 53',
      'M39 49L61 49',
      'M38 47Q50 53 62 47',
      'M36 45Q50 62 64 45Q50 49 36 45',
    ].map((mouth) => `<circle cx="50" cy="37" r="26"/><circle cx="41" cy="30" r="2.5"/><circle cx="59" cy="30" r="2.5"/><path d="${mouth}"/>`),
  },
  {
    id: 'jump', emoji: '🤸', name: 'Jumping kid', hint: 'Dress up the kid. Ready, steady, jump!',
    frames: [
      { head: [50, 22], neck: [50, 28], hip: [50, 48], arms: [[50, 33, 43, 45], [50, 33, 57, 45]], legs: [[50, 48, 45, 68], [50, 48, 55, 68]] },
      crouch,
      { head: [50, 10], neck: [50, 16], hip: [50, 36], arms: [[50, 20, 40, 8], [50, 20, 60, 8]], legs: [[50, 36, 44, 52], [50, 36, 56, 52]] },
      { ...crouch, arms: [[50, 42, 38, 39], [50, 42, 62, 39]] },
    ].map((pose) => ground(68) + stickFigure(pose)),
  },
];

function finder({ x, y, module: m }) {
  const r = (s) => `<rect x="${x - (s * m) / 2}" y="${y - (s * m) / 2}" width="${s * m}" height="${s * m}"`;
  return `${r(7)} fill="#000"/>${r(5)} fill="#fff"/>${r(3)} fill="#000"/>`;
}

export function sheetSvg(subject) {
  const frames = FRAMES.map((f, i) => {
    const n = numberCenter(f);
    return `<g transform="translate(${f.x} ${f.y})">`
      + `<rect width="${FRAME.w}" height="${FRAME.h}" rx="2" fill="#fff" stroke="#333" stroke-width="0.8"/>`
      + `<g ${GUIDE}>${subject.frames[i]}</g></g>`
      + `<circle cx="${n.x}" cy="${n.y}" r="${NUMBER_R}" fill="#222"/>`
      + `<text x="${n.x}" y="${n.y + 1.9}" font-size="5.4" font-weight="800" fill="#fff" text-anchor="middle">${i + 1}</text>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PAGE.w} ${PAGE.h}"
    font-family="ui-rounded, 'SF Pro Rounded', 'Arial Rounded MT Bold', system-ui, sans-serif">
    <rect width="${PAGE.w}" height="${PAGE.h}" fill="#fff"/>
    ${Object.values(MARKERS).map(finder).join('')}
    <text x="34" y="24" font-size="6" font-weight="800" fill="#222">Name:</text>
    <line x1="55" y1="25" x2="150" y2="25" stroke="#999" stroke-width="0.4"/>
    <text x="263" y="19" font-size="6" font-weight="800" fill="#222" text-anchor="end">${subject.name}</text>
    <text x="263" y="25.5" font-size="3.6" fill="#666" text-anchor="end">${subject.hint} 1 → 2 → 3 → 4</text>
    ${frames}
  </svg>`;
}
