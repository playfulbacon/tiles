/* Animal cards: definitions, silhouettes and pattern matching.
 * Loaded before game.js. */

const TAU = Math.PI * 2;

/* ------------------------------------------------------------------ *
 * Pattern shape
 *
 * A pattern is a list of cells [dq, dr, requirement] where [0, 0] is the
 * hex the token stands on. A requirement is either { tile: 'water' } or
 * { token: 'fish' }; token requirements match that animal belonging to any
 * player, so pieces on the board interact with each other.
 *
 * Patterns match under all six rotations and their mirrors, so a card never
 * cares which way round the land happens to lie.
 * ------------------------------------------------------------------ */

const t = (type) => ({ tile: type });
const tok = (animal) => ({ token: animal });

const ANIMALS = {
  worm: {
    name: 'Worm',
    blurb: 'Turns the soil.',
    place: {
      points: 2,
      hint: 'Two connected dirt tiles',
      cells: [[0, 0, t('dirt')], [1, 0, t('dirt')]],
    },
    ret: {
      points: 3,
      hint: 'Dirt with grass one side, water the other',
      cells: [[0, 0, t('dirt')], [1, 0, t('grass')], [-1, 0, t('water')]],
    },
  },
  frog: {
    name: 'Frog',
    blurb: 'Hops the shallows.',
    place: {
      points: 2,
      hint: 'Two connected water tiles',
      cells: [[0, 0, t('water')], [1, 0, t('water')]],
    },
    ret: {
      points: 3,
      hint: 'Water and dirt connected, a rock between them',
      cells: [[0, 0, t('rock')], [1, 0, t('water')], [-1, 0, t('dirt')]],
    },
  },
  fish: {
    name: 'Fish',
    blurb: 'Runs the deep channels.',
    place: {
      points: 3,
      hint: 'Three water tiles in a row',
      cells: [[0, 0, t('water')], [1, 0, t('water')], [-1, 0, t('water')]],
    },
    ret: {
      points: 3,
      hint: 'Water touching both dirt and rock',
      cells: [[0, 0, t('water')], [1, 0, t('dirt')], [1, -1, t('rock')]],
    },
  },
  spider: {
    name: 'Spider',
    blurb: 'Strings a web between stones.',
    place: {
      points: 3,
      hint: 'Grass strung between two rocks',
      cells: [[0, 0, t('grass')], [1, 0, t('rock')], [-1, 0, t('rock')]],
    },
    ret: {
      points: 4,
      hint: 'On rock beside a frog',
      cells: [[0, 0, t('rock')], [1, 0, tok('frog')]],
    },
  },
  loon: {
    name: 'Loon',
    blurb: 'Dives for fish.',
    place: {
      points: 4,
      hint: 'Water beside a fish',
      cells: [[0, 0, t('water')], [1, 0, tok('fish')]],
    },
    ret: {
      points: 3,
      hint: 'Grass touching two water tiles',
      cells: [[0, 0, t('grass')], [1, 0, t('water')], [1, -1, t('water')]],
    },
  },
  deer: {
    name: 'Deer',
    blurb: 'Grazes near the stream.',
    place: {
      points: 3,
      hint: 'Two grass tiles with water opposite',
      cells: [[0, 0, t('grass')], [1, 0, t('grass')], [-1, 0, t('water')]],
    },
    ret: {
      points: 4,
      hint: 'On grass beside a bear',
      cells: [[0, 0, t('grass')], [1, 0, tok('bear')]],
    },
  },
  bear: {
    name: 'Bear',
    blurb: 'Fishes the rocky bank.',
    place: {
      points: 4,
      hint: 'Rock touching both water and grass',
      cells: [[0, 0, t('rock')], [1, 0, t('water')], [1, -1, t('grass')]],
    },
    ret: {
      points: 3,
      hint: 'Three rock tiles in a row',
      cells: [[0, 0, t('rock')], [1, 0, t('rock')], [-1, 0, t('rock')]],
    },
  },
};

// Rail order runs easy to hard.
const ANIMAL_ORDER = ['worm', 'frog', 'fish', 'spider', 'loon', 'deer', 'bear'];

/* ------------------------------------------------------------------ *
 * Orientations
 * ------------------------------------------------------------------ */

function rotAxial(q, r) { return [-r, q + r]; }        // 60 degrees
function mirrorAxial(q, r) { return [q, -q - r]; }

const ORIENTS = [];
for (let m = 0; m < 2; m++) {
  for (let i = 0; i < 6; i++) ORIENTS.push({ mirror: m === 1, turns: i });
}

function orient(q, r, o) {
  let a = q, b = r;
  if (o.mirror) [a, b] = mirrorAxial(a, b);
  for (let k = 0; k < o.turns; k++) [a, b] = rotAxial(a, b);
  return [a, b];
}

/* Try every orientation of `cells` anchored at (aq, ar). `check(q, r, req)`
 * reports whether one cell is satisfied. Returns the matching orientation, or
 * null when the layout is not on the board. */
function matchPattern(aq, ar, cells, check) {
  for (const o of ORIENTS) {
    let ok = true;
    for (const [dq, dr, req] of cells) {
      const [tq, tr] = orient(dq, dr, o);
      if (!check(aq + tq, ar + tr, req)) { ok = false; break; }
    }
    if (ok) return o;
  }
  return null;
}

/* Cells in a canonical orientation, for drawing the card diagrams. */
function patternExtent(cells) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [dq, dr] of cells) {
    const x = 1.5 * dq;
    const y = Math.sqrt(3) * (dr + dq / 2);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

/* ------------------------------------------------------------------ *
 * Silhouettes
 *
 * Each is drawn in a -1..1 box so it can be scaled to any size, and is a
 * solid shape so it stays readable on a small coloured token.
 * ------------------------------------------------------------------ */

const GLYPHS = {
  fish(c) {
    c.beginPath();
    c.ellipse(0.08, 0, 0.6, 0.33, 0, 0, TAU);
    c.fill();
    c.beginPath();
    c.moveTo(-0.45, 0);
    c.lineTo(-1, -0.42);
    c.lineTo(-0.8, 0);
    c.lineTo(-1, 0.42);
    c.closePath();
    c.fill();
    c.beginPath();
    c.moveTo(-0.02, -0.28);
    c.lineTo(0.16, -0.62);
    c.lineTo(0.34, -0.24);
    c.closePath();
    c.fill();
    dot(c, 0.42, -0.09, 0.075);
  },

  // Seen from above: bulging eyes over a narrow body, hind legs folded wide.
  frog(c) {
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.strokeStyle = c.fillStyle;
    for (const s of [-1, 1]) {
      c.lineWidth = 0.17;
      c.beginPath();
      c.moveTo(s * 0.16, 0.02);
      c.quadraticCurveTo(s * 0.82, -0.06, s * 0.72, 0.42);
      c.quadraticCurveTo(s * 0.66, 0.74, s * 0.34, 0.76);
      c.stroke();
      c.lineWidth = 0.1;
      c.beginPath();
      c.moveTo(s * 0.36, 0.76);
      c.lineTo(s * 0.12, 0.92);
      c.moveTo(s * 0.36, 0.76);
      c.lineTo(s * 0.3, 0.98);
      c.stroke();
      c.lineWidth = 0.12;
      c.beginPath();
      c.moveTo(s * 0.2, -0.14);
      c.quadraticCurveTo(s * 0.52, 0.02, s * 0.46, 0.4);
      c.stroke();
    }
    c.beginPath();
    c.ellipse(0, 0.2, 0.34, 0.46, 0, 0, TAU);
    c.fill();
    c.beginPath();
    c.moveTo(-0.42, -0.28);
    c.quadraticCurveTo(0, -0.62, 0.42, -0.28);
    c.quadraticCurveTo(0.36, 0.06, 0, 0.06);
    c.quadraticCurveTo(-0.36, 0.06, -0.42, -0.28);
    c.closePath();
    c.fill();
    for (const s of [-1, 1]) {
      c.beginPath();
      c.arc(s * 0.36, -0.5, 0.22, 0, TAU);
      c.fill();
      dot(c, s * 0.36, -0.53, 0.095);
    }
  },

  loon(c) {
    c.beginPath();
    c.ellipse(-0.12, 0.3, 0.66, 0.29, -0.06, 0, TAU);
    c.fill();
    c.beginPath();
    c.moveTo(0.16, 0.4);
    c.quadraticCurveTo(0.34, -0.02, 0.4, -0.44);
    c.lineTo(0.66, -0.4);
    c.quadraticCurveTo(0.6, 0.04, 0.5, 0.42);
    c.closePath();
    c.fill();
    c.beginPath();
    c.arc(0.54, -0.55, 0.21, 0, TAU);
    c.fill();
    c.beginPath();
    c.moveTo(0.7, -0.64);
    c.lineTo(1.02, -0.52);
    c.lineTo(0.7, -0.44);
    c.closePath();
    c.fill();
    dot(c, 0.58, -0.6, 0.062);
    dot(c, -0.32, 0.2, 0.06);
    dot(c, -0.08, 0.28, 0.06);
    dot(c, -0.52, 0.34, 0.06);
  },

  deer(c) {
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.lineWidth = 0.11;
    c.strokeStyle = c.fillStyle;
    for (const [x0, dir] of [[0.42, -1], [0.6, 1]]) {
      c.beginPath();
      c.moveTo(x0, -0.72);
      c.lineTo(x0 + dir * 0.1, -1.02);
      c.moveTo(x0 + dir * 0.05, -0.86);
      c.lineTo(x0 + dir * 0.26, -0.92);
      c.stroke();
    }
    c.lineWidth = 0.13;
    for (const x of [-0.52, -0.3, 0.06, 0.26]) {
      c.beginPath();
      c.moveTo(x, 0.1);
      c.lineTo(x + (x < -0.1 ? -0.04 : 0.04), 0.86);
      c.stroke();
    }
    c.beginPath();
    c.ellipse(-0.18, -0.02, 0.52, 0.28, -0.05, 0, TAU);
    c.fill();
    c.beginPath();
    c.moveTo(0.08, -0.16);
    c.lineTo(0.34, -0.62);
    c.lineTo(0.56, -0.52);
    c.lineTo(0.32, 0.06);
    c.closePath();
    c.fill();
    c.beginPath();
    c.ellipse(0.55, -0.6, 0.25, 0.14, -0.35, 0, TAU);
    c.fill();
    c.beginPath();
    c.moveTo(-0.66, -0.16);
    c.lineTo(-0.84, -0.34);
    c.lineTo(-0.62, 0.06);
    c.closePath();
    c.fill();
  },

  // Side on, with a shouldered hump and ears clear of the skull.
  bear(c) {
    c.beginPath();
    c.moveTo(-0.78, 0.18);
    c.quadraticCurveTo(-0.86, -0.28, -0.42, -0.34);
    c.quadraticCurveTo(-0.05, -0.62, 0.24, -0.24);
    c.quadraticCurveTo(0.42, 0.16, 0.14, 0.44);
    c.quadraticCurveTo(-0.36, 0.6, -0.78, 0.18);
    c.closePath();
    c.fill();
    for (const [x, y] of [[-0.58, 0.5], [0.02, 0.5]]) {
      c.beginPath();
      c.ellipse(x, y, 0.17, 0.26, 0, 0, TAU);
      c.fill();
    }
    c.beginPath();
    c.arc(0.37, -0.5, 0.16, 0, TAU);
    c.fill();
    c.beginPath();
    c.arc(0.76, -0.44, 0.16, 0, TAU);
    c.fill();
    c.beginPath();
    c.arc(0.56, -0.26, 0.31, 0, TAU);
    c.fill();
    c.beginPath();
    c.ellipse(0.86, -0.14, 0.2, 0.15, 0.25, 0, TAU);
    c.fill();
    dot(c, 0.52, -0.34, 0.07);
    dot(c, 0.97, -0.13, 0.06);
  },

  worm(c) {
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.strokeStyle = c.fillStyle;
    c.lineWidth = 0.36;
    c.beginPath();
    c.moveTo(-0.82, 0.4);
    c.quadraticCurveTo(-0.36, -0.26, 0.04, 0.06);
    c.quadraticCurveTo(0.46, 0.4, 0.82, -0.3);
    c.stroke();
    c.save();
    c.strokeStyle = 'rgba(255,255,255,0.28)';
    c.lineWidth = 0.055;
    for (const [x, y, a] of [[-0.52, 0.16, 0.7], [-0.16, -0.13, -0.5], [0.34, 0.24, 0.9], [0.66, 0.02, 1.3]]) {
      c.beginPath();
      c.moveTo(x - Math.cos(a) * 0.15, y - Math.sin(a) * 0.15);
      c.lineTo(x + Math.cos(a) * 0.15, y + Math.sin(a) * 0.15);
      c.stroke();
    }
    c.restore();
    dot(c, 0.8, -0.36, 0.06);
  },

  spider(c) {
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.strokeStyle = c.fillStyle;
    c.lineWidth = 0.085;
    for (const s of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const spread = -0.5 + i * 0.42;
        c.beginPath();
        c.moveTo(0, 0.02);
        c.quadraticCurveTo(s * 0.55, spread - 0.28, s * 0.92, spread + 0.12);
        c.stroke();
      }
    }
    c.beginPath();
    c.ellipse(-0.34, 0.12, 0.38, 0.33, -0.1, 0, TAU);
    c.fill();
    c.beginPath();
    c.arc(0.14, -0.06, 0.23, 0, TAU);
    c.fill();
    dot(c, 0.22, -0.14, 0.06);
    dot(c, 0.04, -0.16, 0.055);
  },
};

// Small light coloured detail (eyes, spots) punched into a silhouette.
function dot(c, x, y, r) {
  const prev = c.fillStyle;
  c.fillStyle = 'rgba(255,255,255,0.82)';
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.fill();
  c.fillStyle = prev;
}

function drawGlyph(c, animal, cx, cy, size, color) {
  c.save();
  c.translate(cx, cy);
  c.scale(size / 2, size / 2);
  c.fillStyle = color;
  GLYPHS[animal](c);
  c.restore();
}

/* A player's playing piece: a coloured disc carrying the animal. */
function drawToken(c, animal, cx, cy, size, color, opts = {}) {
  const r = size / 2;
  c.save();
  if (opts.shadow !== false) {
    c.shadowColor = 'rgba(0,0,0,0.55)';
    c.shadowBlur = r * 0.7;
    c.shadowOffsetY = r * 0.22;
  }
  c.beginPath();
  c.arc(cx, cy, r, 0, TAU);
  const g = c.createLinearGradient(0, cy - r, 0, cy + r);
  g.addColorStop(0, mixHex(color, '#ffffff', 0.3));
  g.addColorStop(1, mixHex(color, '#000000', 0.16));
  c.fillStyle = g;
  c.fill();
  c.restore();

  c.beginPath();
  c.arc(cx, cy, r, 0, TAU);
  c.lineWidth = Math.max(1.2, r * 0.13);
  c.strokeStyle = 'rgba(10,16,22,0.85)';
  c.stroke();

  if (opts.ring) {
    c.beginPath();
    c.arc(cx, cy, r + Math.max(2.5, r * 0.28), 0, TAU);
    c.lineWidth = Math.max(2, r * 0.16);
    c.strokeStyle = opts.ring;
    c.stroke();
  }

  drawGlyph(c, animal, cx, cy + r * 0.04, size * 0.82, 'rgba(12,20,27,0.88)');
}

function mixHex(a, b, amount) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (sh) => {
    const va = (pa >> sh) & 255, vb = (pb >> sh) & 255;
    return Math.round(va + (vb - va) * amount);
  };
  return 'rgb(' + ch(16) + ',' + ch(8) + ',' + ch(0) + ')';
}
