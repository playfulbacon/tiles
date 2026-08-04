/* Animal cards: definitions, silhouettes and pattern matching.
 * Loaded before game.js. */

const TAU = Math.PI * 2;

/* ------------------------------------------------------------------ *
 * Pattern shape
 *
 * A pattern is a list of cells [dq, dr, requirement] where [0, 0] is the
 * hex the token stands on. A requirement is one of:
 *
 *   { tile: 'water' }   that tile type
 *   { token: 'fish' }   that animal, belonging to any player
 *   { tier: 'mid' }     any animal of that tier, belonging to any player
 *
 * Animal requirements are met by anyone's piece, so the table props each
 * other up rather than each player building alone.
 *
 * Patterns match under all six rotations and their mirrors, so a card never
 * cares which way round the land happens to lie.
 * ------------------------------------------------------------------ */

const t = (type) => ({ tile: type });
const near = (animal) => ({ token: animal });      // one named animal
const nearTier = (tier) => ({ tier });             // any animal of a tier

/* ------------------------------------------------------------------ *
 * The ladder
 *
 * Animals belong to an early, mid or late tier, and points climb with the
 * tier. Cards that call for another animal name a specific one, chosen so
 * the pairing reads true: loons dive for fish, bears fish the shallows,
 * frogs eat spiders, a bear on the shore drives a loon off its nest.
 *
 * Two rules hold the escalation together, and validateCards() below checks
 * them on every load:
 *
 *   - going out may only ask for an animal of a LOWER tier
 *   - coming home may only ask for an animal of a HIGHER tier
 *
 * Anything else is land alone. Every tier has at least one animal that comes
 * home on land alone, so no tier can ever be stranded waiting on a predator
 * that is not on the board.
 * ------------------------------------------------------------------ */

const TIERS = {
  early: { name: 'Early', rank: 0, color: '#7fe0c4' },
  mid: { name: 'Mid', rank: 1, color: '#c9a6f5' },
  late: { name: 'Late', rank: 2, color: '#ffb36b' },
};
const TIER_ORDER = ['early', 'mid', 'late'];

const ANIMALS = {
  worm: {
    name: 'Worm',
    tier: 'early',
    blurb: 'Turns the soil.',
    place: {
      points: 2,
      hint: 'Two connected dirt tiles',
      cells: [[0, 0, t('dirt')], [1, 0, t('dirt')]],
    },
    ret: {
      points: 4,
      hint: 'Dirt at the meadow edge, more dirt opposite',
      cells: [[0, 0, t('dirt')], [1, 0, t('grass')], [-1, 0, t('dirt')]],
    },
  },
  frog: {
    name: 'Frog',
    tier: 'early',
    blurb: 'Hunts the muddy shallows.',
    place: {
      points: 2,
      hint: 'Water with dirt alongside',
      cells: [[0, 0, t('water')], [1, 0, t('dirt')]],
    },
    ret: {
      points: 5,
      hint: 'Grass by the water, beside a spider it can eat',
      cells: [[0, 0, t('grass')], [1, 0, t('water')], [1, -1, near('spider')]],
    },
  },
  fish: {
    name: 'Fish',
    tier: 'early',
    blurb: 'Runs the channels.',
    place: {
      points: 2,
      hint: 'Two connected water tiles',
      cells: [[0, 0, t('water')], [1, 0, t('water')]],
    },
    ret: {
      points: 5,
      hint: 'Open water, fleeing a diving loon',
      cells: [[0, 0, t('water')], [1, 0, t('water')], [1, -1, near('loon')]],
    },
  },
  spider: {
    name: 'Spider',
    tier: 'mid',
    blurb: 'Strings a web between stones.',
    place: {
      points: 4,
      hint: 'Grass beside rock, where a worm has worked the soil',
      cells: [[0, 0, t('grass')], [1, 0, t('rock')], [1, -1, near('worm')]],
    },
    ret: {
      points: 5,
      hint: 'Folds into the stones at the meadow edge',
      cells: [[0, 0, t('rock')], [1, 0, t('rock')], [1, -1, t('grass')]],
    },
  },
  loon: {
    name: 'Loon',
    tier: 'mid',
    blurb: 'Dives the open water.',
    place: {
      points: 5,
      hint: 'Open water with a fish to dive for',
      cells: [[0, 0, t('water')], [1, 0, t('water')], [1, -1, near('fish')]],
    },
    ret: {
      points: 7,
      hint: 'Leaves the nest when a bear comes to the shore',
      cells: [[0, 0, t('grass')], [1, 0, t('water')], [1, -1, near('bear')]],
    },
  },
  deer: {
    name: 'Deer',
    tier: 'late',
    blurb: 'Drinks at quiet water.',
    place: {
      points: 6,
      hint: 'Grass by the water, quiet enough for a loon',
      cells: [[0, 0, t('grass')], [1, 0, t('water')], [1, -1, near('loon')]],
    },
    ret: {
      points: 8,
      hint: 'Three grass tiles in a row',
      cells: [[0, 0, t('grass')], [1, 0, t('grass')], [-1, 0, t('grass')]],
    },
  },
  bear: {
    name: 'Bear',
    tier: 'late',
    blurb: 'Fishes the rocky bank.',
    place: {
      points: 7,
      hint: 'Rock by the water, with a fish running it',
      cells: [[0, 0, t('rock')], [1, 0, t('water')], [1, -1, near('fish')]],
    },
    ret: {
      points: 9,
      hint: 'Three rock tiles in a row',
      cells: [[0, 0, t('rock')], [1, 0, t('rock')], [-1, 0, t('rock')]],
    },
  },
};

// Rail order climbs the ladder, early on the left.
const ANIMAL_ORDER = ['worm', 'frog', 'fish', 'spider', 'loon', 'deer', 'bear'];
const TIER_OF = (animal) => ANIMALS[animal].tier;
const animalsInTier = (tier) => ANIMAL_ORDER.filter((a) => ANIMALS[a].tier === tier);

/* ------------------------------------------------------------------ *
 * Card rules
 *
 * These hold the escalation together whatever the individual cards say, so
 * that retuning a card cannot quietly break the shape of the game. Run on
 * load; problems are reported to the console rather than thrown, so a bad
 * card never costs anyone a game in progress.
 * ------------------------------------------------------------------ */

function animalRequirements(pattern) {
  const out = [];
  for (const [, , req] of pattern.cells) {
    if (req.token) out.push({ kind: 'animal', animal: req.token, rank: TIERS[ANIMALS[req.token].tier].rank });
    else if (req.tier) out.push({ kind: 'tier', tier: req.tier, rank: TIERS[req.tier].rank });
  }
  return out;
}

function validateCards() {
  const problems = [];
  const homeOnLandAlone = {};

  for (const name of ANIMAL_ORDER) {
    const a = ANIMALS[name];
    if (!a) { problems.push(name + ' is in the rail order but has no card'); continue; }
    const rank = TIERS[a.tier].rank;

    // Going out may only lean on something already established below you.
    for (const req of animalRequirements(a.place)) {
      if (req.rank >= rank) {
        problems.push(`${name} (${a.tier}) goes out on ${req.animal || 'any ' + req.tier}, which is not a lower tier`);
      }
    }
    // Coming home may only be triggered by something above you.
    for (const req of animalRequirements(a.ret)) {
      if (req.rank <= rank) {
        problems.push(`${name} (${a.tier}) comes home on ${req.animal || 'any ' + req.tier}, which is not a higher tier`);
      }
    }
    // A card that names an animal must name one that exists.
    for (const p of [a.place, a.ret]) {
      for (const [, , req] of p.cells) {
        if (req.token && !ANIMALS[req.token]) problems.push(`${name} asks for unknown animal ${req.token}`);
        if (req.tier && !TIERS[req.tier]) problems.push(`${name} asks for unknown tier ${req.tier}`);
        if (req.tile && !['water', 'rock', 'grass', 'dirt', 'any'].includes(req.tile)) {
          problems.push(`${name} asks for unknown tile ${req.tile}`);
        }
      }
    }
    // The anchor is the hex the animal stands on, so it must be land.
    for (const [p, label] of [[a.place, 'going out'], [a.ret, 'coming home']]) {
      const anchor = p.cells.find(([dq, dr]) => dq === 0 && dr === 0);
      if (!anchor) problems.push(`${name} ${label} has no anchor cell`);
      else if (!anchor[2].tile) problems.push(`${name} ${label} stands on something that is not a tile`);
    }
    if (a.ret.points <= a.place.points) problems.push(`${name} should score more coming home than going out`);

    if (!animalRequirements(a.ret).length) homeOnLandAlone[a.tier] = true;
  }

  // Every tier needs a way home that does not depend on another animal,
  // otherwise a tier can be stranded waiting for a predator nobody has out.
  for (const tier of TIER_ORDER) {
    if (!animalsInTier(tier).length) continue;
    if (!homeOnLandAlone[tier]) {
      problems.push(`no ${tier} animal can come home on land alone`);
    }
  }

  // Reachability. Cards lean on other cards, so a careless edit can build a
  // knot nobody can untie - two animals each waiting on the other to go out
  // first. Grow the set of animals that can ever reach the board, then check
  // every card can both get out and get home from it.
  const canGoOut = new Set();
  let grew = true;
  while (grew) {
    grew = false;
    for (const name of ANIMAL_ORDER) {
      if (canGoOut.has(name)) continue;
      if (requirementsMet(ANIMALS[name].place, canGoOut)) { canGoOut.add(name); grew = true; }
    }
  }
  for (const name of ANIMAL_ORDER) {
    if (!canGoOut.has(name)) {
      problems.push(`${name} can never go out: its layout waits on an animal that can never get out either`);
    } else if (!requirementsMet(ANIMALS[name].ret, canGoOut)) {
      problems.push(`${name} can never come home: its layout waits on an animal that can never get out`);
    }
  }
  return problems;
}

// Can this pattern's animal requirements be met, given a set of animals that
// are able to reach the board? Tile requirements are down to the luck of the
// deck, so they are not considered here.
function requirementsMet(pattern, available) {
  for (const req of animalRequirements(pattern)) {
    if (req.kind === 'animal') {
      if (!available.has(req.animal)) return false;
    } else if (!animalsInTier(req.tier).some((a) => available.has(a))) {
      return false;
    }
  }
  return true;
}

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

// Stands in for "any animal of this tier" on a card diagram.
GLYPHS.any = function (c) {
  c.beginPath();
  c.ellipse(0, 0.36, 0.44, 0.34, 0, 0, TAU);
  c.fill();
  for (const [x, y, a] of [[-0.56, -0.2, -0.35], [-0.2, -0.52, -0.12], [0.2, -0.52, 0.12], [0.56, -0.2, 0.35]]) {
    c.beginPath();
    c.ellipse(x, y, 0.2, 0.26, a, 0, TAU);
    c.fill();
  }
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
