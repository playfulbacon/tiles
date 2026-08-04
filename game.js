/* Hex Lands - a turn based hex tile laying game.
 * Draw a tile from the deck, drag it onto the board, connect it to the land. */

const VERSION = '0.9.0';

/* ------------------------------------------------------------------ *
 * Tile types
 * ------------------------------------------------------------------ */

const TYPES = {
  water: {
    name: 'Water',
    base: '#2b6ea8',
    top: '#3d86c2',
    ink: '#1b4a73',
    light: '#8fd0ef',
  },
  rock: {
    name: 'Rock',
    base: '#7b818a',
    top: '#8d949d',
    ink: '#575d65',
    light: '#b5bcc4',
  },
  grass: {
    name: 'Grass',
    base: '#4f9d3a',
    top: '#5db044',
    ink: '#356c27',
    light: '#8ed36c',
  },
  dirt: {
    name: 'Dirt',
    base: '#a3703f',
    top: '#b47f4a',
    ink: '#754c28',
    light: '#d3a473',
  },
};

const TYPE_KEYS = Object.keys(TYPES);

/* The bag holds 60 tiles: eleven plain of each terrain, twelve split down the
 * middle, and four specials that bring an animal with them. That leaves each
 * terrain on eighteen tiles. */
const COPIES_PER_TYPE = 11;
const COPIES_PER_MIX = 2;

/* A split tile is halved: three sides one terrain, three the other. Which
 * terrain a neighbour sees depends on which half faces it, so how a split tile
 * is turned decides what it is worth and to whom. */
const MIXES = [
  ['water', 'rock'],    // a rocky shore
  ['water', 'grass'],   // reeds and marsh
  ['water', 'dirt'],    // a muddy bank
  ['rock', 'grass'],    // an outcrop in the meadow
  ['rock', 'dirt'],     // scree and gravel
  ['grass', 'dirt'],    // worn ground
];
const HALF = 3;         // sides belonging to the second terrain

/* Special tiles. Laying one puts that animal straight onto it, with no layout
 * to satisfy - a burrow is a worm's, a spring holds fish, a den is a bear's.
 * They are rare on purpose: four tiles in sixty. */
const SPECIALS = [
  { type: 'dirt', animal: 'worm', name: 'Burrow' },
  { type: 'water', animal: 'fish', name: 'Spring' },
  { type: 'grass', animal: 'spider', name: 'Thicket' },
  { type: 'rock', animal: 'bear', name: 'Den' },
];

// How many tiles a player draws to choose from. Set on the title screen.
const DRAW_CHOICES = [2, 3, 4];
const VARIANTS = 3;

const comboKey = (types) => types.join('+');

// "Water" or "Water & rock", for hints and labels.
function terrainName(types) {
  if (types.length === 1) return TYPES[types[0]].name;
  return TYPES[types[0]].name + ' & ' + TYPES[types[1]].name.toLowerCase();
}

const PLAYER_COLORS = [
  '#f2c14e', '#e8724c', '#6fc3df', '#b98ce0', '#7fd18a', '#f291c4',
];

/* ------------------------------------------------------------------ *
 * Hex math (flat topped hexes, axial coordinates)
 * ------------------------------------------------------------------ */

const SQRT3 = Math.sqrt(3);

const DIRS = [
  [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1],
];

function hexToPixel(q, r, size) {
  return {
    x: size * 1.5 * q,
    y: size * SQRT3 * (r + q / 2),
  };
}

function pixelToHex(x, y, size) {
  const q = (2 / 3) * x / size;
  const r = (-x / 3 + (SQRT3 / 3) * y) / size;
  return roundHex(q, r);
}

function roundHex(q, r) {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  let rs = Math.round(s);
  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return { q: rq, r: rr };
}

const key = (q, r) => q + ',' + r;

/* Side 0 of a hex is the edge between corner 0 and corner 1, and so on round.
 * Neighbour direction d meets side (6 - d) % 6. */
const sideFacing = (d) => (6 - d) % 6;

function dirToward(fromQ, fromR, toQ, toR) {
  for (let d = 0; d < DIRS.length; d++) {
    if (fromQ + DIRS[d][0] === toQ && fromR + DIRS[d][1] === toR) return d;
  }
  return -1;
}

/* What this tile presents on one of its six sides. A plain tile shows the same
 * terrain all the way round; a split tile shows its second terrain on the
 * sides its half covers, turned by the tile's facing. */
function terrainOnSide(tile, side) {
  if (!tile.types[1]) return tile.types[0];
  const local = (((side - (tile.rot || 0)) % 6) + 6) % 6;
  return local < (tile.sides || HALF) ? tile.types[1] : tile.types[0];
}

function hexCorners(cx, cy, size) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i);
    pts.push([cx + size * Math.cos(a), cy + size * Math.sin(a)]);
  }
  return pts;
}

function traceHex(ctx, cx, cy, size) {
  const pts = hexCorners(cx, cy, size);
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < 6; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

/* ------------------------------------------------------------------ *
 * Deterministic pseudo random, so a tile always looks the same
 * ------------------------------------------------------------------ */

function makeRng(seed) {
  let s = seed >>> 0 || 1;
  return function () {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* ------------------------------------------------------------------ *
 * Tile sprites - each type/variant is painted once at high resolution
 * ------------------------------------------------------------------ */

const SPRITE_R = 128;
const sprites = {};

function buildSprites() {
  for (const type of TYPE_KEYS) {
    sprites[type] = [];
    for (let v = 0; v < VARIANTS; v++) sprites[type].push(makeSprite([type], v));
  }
}

function paintTerrain(c, type, cx, cy, R, w, h, rand) {
  const t = TYPES[type];
  const g = c.createLinearGradient(0, cy - R, 0, cy + R);
  g.addColorStop(0, t.top);
  g.addColorStop(1, t.base);
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);

  if (type === 'water') paintWater(c, cx, cy, R, t, rand);
  else if (type === 'rock') paintRock(c, cx, cy, R, t, rand);
  else if (type === 'grass') paintGrass(c, cx, cy, R, t, rand);
  else paintDirt(c, cx, cy, R, t, rand);
}

function makeSprite(types, variant) {
  const R = SPRITE_R;
  const pad = 6;
  const w = Math.ceil(2 * R) + pad * 2;
  const h = Math.ceil(SQRT3 * R) + pad * 2;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const c = cv.getContext('2d');
  const cx = w / 2;
  const cy = h / 2;
  const rand = makeRng(hashString(comboKey(types) + ':' + variant) || 7);

  c.save();
  traceHex(c, cx, cy, R);
  c.clip();

  paintTerrain(c, types[0], cx, cy, R, w, h, rand);

  // Inner shading so tiles read as separate pieces.
  const vig = c.createRadialGradient(cx, cy, R * 0.55, cx, cy, R * 1.05);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.28)');
  c.fillStyle = vig;
  c.fillRect(0, 0, w, h);
  c.restore();

  // Rim.
  traceHex(c, cx, cy, R - 1);
  c.lineWidth = 5;
  c.strokeStyle = TYPES[types[0]].ink;
  c.stroke();
  traceHex(c, cx, cy, R - 5);
  c.lineWidth = 2;
  c.strokeStyle = 'rgba(255,255,255,0.14)';
  c.stroke();

  return cv;
}

function paintWater(c, cx, cy, R, t, rand) {
  // Long horizontal ripples.
  c.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const y = cy - R * 0.8 + (i + rand() * 0.4) * (R * 1.7 / 9);
    const amp = 4 + rand() * 7;
    const len = R * (1.1 + rand() * 0.7);
    const x0 = cx - len / 2 + (rand() - 0.5) * R * 0.4;
    c.beginPath();
    for (let x = 0; x <= len; x += 6) {
      const yy = y + Math.sin((x / len) * Math.PI * (2 + rand() * 0.02) + i) * amp;
      if (x === 0) c.moveTo(x0 + x, yy);
      else c.lineTo(x0 + x, yy);
    }
    c.strokeStyle = i % 3 === 0 ? t.light : 'rgba(255,255,255,0.18)';
    c.globalAlpha = i % 3 === 0 ? 0.55 : 0.75;
    c.lineWidth = 5 + rand() * 4;
    c.stroke();
  }
  c.globalAlpha = 1;
  // Deep patches.
  for (let i = 0; i < 4; i++) {
    c.beginPath();
    c.ellipse(cx + (rand() - 0.5) * R * 1.2, cy + (rand() - 0.5) * R * 1.1,
      R * (0.2 + rand() * 0.2), R * (0.1 + rand() * 0.12), rand() * Math.PI, 0, Math.PI * 2);
    c.fillStyle = 'rgba(20,60,95,0.22)';
    c.fill();
  }
}

function paintRock(c, cx, cy, R, t, rand) {
  // Angular facets.
  for (let i = 0; i < 16; i++) {
    const px = cx + (rand() - 0.5) * R * 1.7;
    const py = cy + (rand() - 0.5) * R * 1.5;
    const rad = R * (0.13 + rand() * 0.22);
    const sides = 5 + Math.floor(rand() * 2);
    const rot = rand() * Math.PI;
    c.beginPath();
    for (let s = 0; s < sides; s++) {
      const a = rot + (s / sides) * Math.PI * 2;
      const rr = rad * (0.7 + rand() * 0.5);
      const x = px + Math.cos(a) * rr;
      const y = py + Math.sin(a) * rr * 0.8;
      if (s === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.closePath();
    c.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.14)';
    c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.18)';
    c.lineWidth = 2.5;
    c.stroke();
  }
  // Cracks.
  c.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    let x = cx + (rand() - 0.5) * R * 1.4;
    let y = cy + (rand() - 0.5) * R * 1.2;
    c.beginPath();
    c.moveTo(x, y);
    for (let s = 0; s < 4; s++) {
      x += (rand() - 0.5) * R * 0.5;
      y += (rand() - 0.5) * R * 0.5;
      c.lineTo(x, y);
    }
    c.strokeStyle = 'rgba(40,45,52,0.5)';
    c.lineWidth = 3;
    c.stroke();
  }
}

function paintGrass(c, cx, cy, R, t, rand) {
  // Soft meadow blotches.
  for (let i = 0; i < 6; i++) {
    c.beginPath();
    c.ellipse(cx + (rand() - 0.5) * R * 1.3, cy + (rand() - 0.5) * R * 1.2,
      R * (0.22 + rand() * 0.25), R * (0.16 + rand() * 0.18), rand() * Math.PI, 0, Math.PI * 2);
    c.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.10)';
    c.fill();
  }
  // Tufts of grass.
  c.lineCap = 'round';
  for (let i = 0; i < 70; i++) {
    const px = cx + (rand() - 0.5) * R * 1.85;
    const py = cy + (rand() - 0.5) * R * 1.6;
    const hgt = R * (0.07 + rand() * 0.07);
    const lean = (rand() - 0.5) * hgt * 0.9;
    c.strokeStyle = rand() > 0.45 ? t.ink : t.light;
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(px, py);
    c.lineTo(px + lean, py - hgt);
    c.moveTo(px, py);
    c.lineTo(px + lean * 0.2 - hgt * 0.35, py - hgt * 0.8);
    c.stroke();
  }
}

function paintDirt(c, cx, cy, R, t, rand) {
  // Patches of turned soil.
  for (let i = 0; i < 7; i++) {
    c.beginPath();
    c.ellipse(cx + (rand() - 0.5) * R * 1.4, cy + (rand() - 0.5) * R * 1.3,
      R * (0.2 + rand() * 0.28), R * (0.14 + rand() * 0.2), rand() * Math.PI, 0, Math.PI * 2);
    c.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(70,44,22,0.16)';
    c.fill();
  }
  // Faint furrows.
  c.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const y = cy - R * 0.8 + (i + rand() * 0.5) * (R * 1.6 / 6);
    const half = R * (0.55 + rand() * 0.42);
    c.beginPath();
    for (let x = -half; x <= half; x += 10) {
      const yy = y + Math.sin(x / 30 + i * 1.7) * 5;
      if (x === -half) c.moveTo(cx + x, yy); else c.lineTo(cx + x, yy);
    }
    c.strokeStyle = 'rgba(88,56,28,0.20)';
    c.lineWidth = 5 + rand() * 4;
    c.stroke();
  }
  // Pebbles and clods.
  for (let i = 0; i < 34; i++) {
    const px = cx + (rand() - 0.5) * R * 1.8;
    const py = cy + (rand() - 0.5) * R * 1.55;
    const rr = R * (0.02 + rand() * 0.045);
    c.beginPath();
    c.ellipse(px, py, rr * (1 + rand() * 0.6), rr, rand() * Math.PI, 0, Math.PI * 2);
    c.fillStyle = rand() > 0.5 ? t.light : t.ink;
    c.globalAlpha = 0.55;
    c.fill();
  }
  c.globalAlpha = 1;
}

/* ------------------------------------------------------------------ *
 * Game state
 * ------------------------------------------------------------------ */

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');

const state = {
  mode: 'title',        // title | playing | gameover
  // A turn is one required tile and one optional animal move, in either
  // order. The turn ends once the tile is down and the animal step is
  // spent or waived.
  turn: { tileLaid: false, animalMoved: false },
  players: 2,
  current: 0,
  deck: [],
  board: new Map(),     // "q,r" -> { q, r, type, variant, owner, placedAt }
  held: null,           // the tile drawn for this turn
  valid: new Set(),
  camera: { x: 0, y: 0, scale: 1 },
  hoverKey: null,
  covered: 0,           // tiles laid over land already down
  lastPlaced: null,
  tokens: new Map(),    // "player:animal" -> { player, animal, at }
  tokenAt: new Map(),   // "q,r" -> token
  scores: [],
  showOwners: false,    // mark each tile with the colour of who laid it
  choices: [],          // tiles drawn from the bag this turn, one to be kept
  drawCount: 3,         // how many come out of the bag each turn
  pending: null,        // a tile dropped but not yet confirmed
  sel: null,            // { animal, onBoard, spots:Set, canReturn }
  ready: {},            // animal -> is its next action available right now
  tokenDrag: null,      // { animal, x, y, from }
};

let W = 0, H = 0, DPR = 1;
const HEX_SIZE = 54;         // world size of a board hex
const DECK_SIZE = 26;        // the face down stack
const HAND_TILE = 34;        // the tile drawn for this turn

function deckAnchor() {
  const l = handLayout();
  return { x: 38, y: l.rowY + l.rowH / 2 };
}

function heldHome() {
  const l = handLayout();
  return { x: 38 + DECK_SIZE + HAND_TILE + 16, y: l.rowY + l.rowH / 2 };
}

// Measured with a probe element, because custom properties hand back the
// literal env() token rather than a resolved length.
const safeProbe = document.createElement('div');
safeProbe.style.cssText =
  'position:fixed;left:0;bottom:0;width:0;pointer-events:none;height:env(safe-area-inset-bottom,0px)';
document.body.appendChild(safeProbe);

function safeBottom() {
  return safeProbe.getBoundingClientRect().height || 0;
}

/* ---------------------------- deck ---------------------------- */

function buildDeck() {
  const deck = [];
  const spin = () => Math.floor(Math.random() * 6);
  const card = (type, extra) => Object.assign({
    types: [type], variant: Math.floor(Math.random() * VARIANTS), rot: spin(), sides: 0,
  }, extra);

  for (const type of TYPE_KEYS) {
    for (let i = 0; i < COPIES_PER_TYPE; i++) deck.push(card(type));
  }
  for (const mix of MIXES) {
    for (let i = 0; i < COPIES_PER_MIX; i++) {
      deck.push(card(mix[0], { types: mix.slice(), sides: HALF }));
    }
  }
  for (const sp of SPECIALS) deck.push(card(sp.type, { special: sp.animal, specialName: sp.name }));
  return shuffle(deck);
}

// The bag: everything unpicked goes back in and it is shuffled again, so no
// one can track what is left beyond the count.
function shuffle(bag) {
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

function startGame(players) {
  state.mode = 'playing';
  state.players = players;
  state.current = 0;
  state.deck = buildDeck();
  state.board = new Map();
  state.valid = new Set();
  state.held = null;
  state.lastPlaced = null;
  state.covered = 0;
  state.camera = { x: 0, y: 0, scale: 1 };
  state.turn = { tileLaid: false, animalMoved: false };
  state.sel = null;
  state.pending = null;
  state.choices = [];
  state.tokenDrag = null;
  flashes.length = 0;
  initTokens();
  refreshReady();
  drawTile();
  syncHud();
}

function drawTile() {
  if (!state.deck.length) {
    endGame();
    return;
  }
  // Pull a few out of the bag; the player keeps one and the rest go back.
  const n = Math.min(state.drawCount, state.deck.length);
  state.choices = state.deck.splice(state.deck.length - n, n);
  state.held = null;
  recomputeValid();
  positionHint();
  syncHud();
}

function chooseTile(index) {
  const card = state.choices[index];
  if (!card) return;
  const rest = state.choices.filter((c, i) => i !== index);
  state.deck.push(...rest);
  shuffle(state.deck);
  state.choices = [];
  positionHint();
  const home = heldHome();
  state.held = {
    types: card.types,
    variant: card.variant,
    rot: card.rot,
    sides: card.sides,
    special: card.special,
    specialName: card.specialName,
    x: home.x,
    y: home.y,
    dragging: false,
    grabDX: 0,
    grabDY: 0,
    bornAt: performance.now(),
    returning: null,
  };
  syncHud();
  return state.held;
}

function recomputeValid() {
  const v = new Set();
  if (state.board.size === 0) {
    state.valid = v;   // empty board: anywhere goes
    return;
  }
  for (const tile of state.board.values()) {
    for (const [dq, dr] of DIRS) {
      const k = key(tile.q + dq, tile.r + dr);
      if (!state.board.has(k)) v.add(k);
    }
  }
  state.valid = v;
}

function isValidTarget(q, r) {
  const k = key(q, r);
  if (state.pending && state.pending.q === q && state.pending.r === r) return false;
  // A tile may be laid over one already down, reshaping the land, so long as
  // no animal is standing on it.
  if (state.board.has(k)) return !state.tokenAt.has(k);
  if (state.board.size === 0) return true;
  return state.valid.has(k);
}

// Is this hex an existing tile being covered rather than new land?
function isOverlay(q, r) {
  return state.board.has(key(q, r)) && !state.tokenAt.has(key(q, r));
}

function placeTile(q, r, tile) {
  const held = tile || state.held;
  const covering = state.board.has(key(q, r));
  state.board.set(key(q, r), {
    q, r,
    types: held.types,
    variant: held.variant,
    rot: held.rot,
    sides: held.sides,
    owner: state.current,
    placedAt: performance.now(),
  });

  state.lastPlaced = key(q, r);
  state.covered += covering ? 1 : 0;
  state.held = null;
  state.pending = null;
  state.turn.tileLaid = true;
  if (held.special) summonOnSpecial(held.special, q, r);
  // New land can open or close animal moves, so recheck the cards.
  refreshReady();
  refreshSelection();
  syncHud();
  if (state.turn.animalMoved) endTurn();
  else showHint('Move an animal, or end your turn', 2400);
}

// Called after the animal step. The turn only ends once the tile is down.
function spendAnimalMove() {
  state.turn.animalMoved = true;
  state.sel = null;
  refreshReady();
  if (state.turn.tileLaid) endTurn();
  else {
    syncHud();
    showHint('Now lay your tile', 2400);
  }
}

function endTurn() {
  state.turn = { tileLaid: false, animalMoved: false };
  state.sel = null;
  state.pending = null;
  state.choices = [];
  state.tokenDrag = null;
  state.current = (state.current + 1) % state.players;
  if (!state.deck.length) endGame();
  else drawTile();
}

/* A dropped tile waits for confirmation, so it can be turned first. It is not
 * on the board yet and does not count for any animal layout until confirmed. */
function setPending(q, r) {
  const h = state.held;
  state.pending = { q, r, types: h.types, variant: h.variant, rot: h.rot, sides: h.sides };
  state.held = null;
  state.hoverKey = null;
  ensurePendingRoom();
  showHint(h.types.length > 1 ? 'Turn it if you like, then confirm' : 'Confirm to lay it', 2600);
}

/* The controls straddle the tile, so a tile dropped hard against the top or
 * bottom of the view leaves nowhere to put them. Shift the board the smallest
 * amount that gives both rows their space. */
function ensurePendingRoom() {
  const p = state.pending;
  if (!p) return;
  const size = HEX_SIZE * state.camera.scale;
  const need = 38 + 12 + size * 0.95;          // a row, its gap, half a tile
  const minY = 56 + need;
  const maxY = trayTop() - need;
  if (maxY <= minY) return;                    // nothing sensible to do
  const pt = hexToPixel(p.q, p.r, HEX_SIZE);
  const s = worldToScreen(pt.x, pt.y);
  const delta = s.y < minY ? minY - s.y : (s.y > maxY ? maxY - s.y : 0);
  if (delta) state.camera.y -= delta / state.camera.scale;
}

function cancelPending() {
  const p = state.pending;
  if (!p) return;
  const home = heldHome();
  state.held = {
    types: p.types, variant: p.variant, rot: p.rot, sides: p.sides,
    x: home.x, y: home.y, dragging: false, grabDX: 0, grabDY: 0,
    bornAt: performance.now(), returning: null,
  };
  state.pending = null;
}

function confirmPending() {
  const p = state.pending;
  if (!p) return;
  placeTile(p.q, p.r, p);
}

/* A special tile calls its animal to it the moment it is laid, with no layout
 * to satisfy. This is a gift on top of the turn: it does not spend the one
 * animal move. If the animal is already out on the land it simply comes here
 * instead, which scores nothing but can save it a long walk. */
function summonOnSpecial(animal, q, r) {
  const token = myToken(animal);
  const k = key(q, r);
  if (state.tokenAt.has(k)) return;
  if (token.at) {
    state.tokenAt.delete(key(token.at.q, token.at.r));
    showHint(ANIMALS[animal].name + ' comes to the ' + specialNameFor(animal), 2600);
  } else {
    const pts = ANIMALS[animal].place.points;
    score(state.current, pts);
    flashScore('+' + pts, q, r);
    showHint(ANIMALS[animal].name + ' takes the ' + specialNameFor(animal) + '  +' + pts, 2800);
  }
  token.at = { q, r };
  token.movedAt = performance.now();
  state.tokenAt.set(k, token);
}

function specialNameFor(animal) {
  const sp = SPECIALS.find((s) => s.animal === animal);
  return sp ? sp.name.toLowerCase() : 'place';
}

function rotateTile(dir) {
  const tile = state.pending || state.held;
  if (!tile) return false;
  tile.rot = ((tile.rot || 0) + dir + 6) % 6;
  return true;
}

function endGame() {
  state.mode = 'gameover';
  state.held = null;
  state.sel = null;
  state.tokenDrag = null;
  showFinalCounts();
  showScoreboard();
  document.getElementById('gameover').classList.remove('hidden');
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('hint').classList.add('hidden');
}

/* ------------------------------------------------------------------ *
 * Animal tokens
 * ------------------------------------------------------------------ */

const tokenKey = (player, animal) => player + ':' + animal;

function initTokens() {
  state.tokens = new Map();
  state.tokenAt = new Map();
  state.scores = new Array(state.players).fill(0);
  for (let p = 0; p < state.players; p++) {
    for (const animal of ANIMAL_ORDER) {
      state.tokens.set(tokenKey(p, animal), {
        player: p, animal, at: null, movedAt: 0,
      });
    }
  }
}

function myToken(animal) {
  return state.tokens.get(tokenKey(state.current, animal));
}

// One cell of a card pattern, tested against the board as it stands.
function cellSatisfied(q, r, req, aq, ar) {
  if (req.tile) {
    const tile = state.board.get(key(q, r));
    if (!tile) return false;
    if (req.tile === 'any') return true;
    if (!tile.types.includes(req.tile)) return false;
    if (tile.types.length < 2) return true;
    // The animal stands on the anchor, so on that tile it simply stands on the
    // half it needs. Every other tile in the layout has to be showing the
    // terrain to the anchor - the animal must be able to reach it.
    if (aq === undefined || (q === aq && r === ar)) return true;
    const d = dirToward(q, r, aq, ar);
    if (d < 0) return true;                      // not adjacent; nothing to face
    return terrainOnSide(tile, sideFacing(d)) === req.tile;
  }
  if (req.tier) {
    const tk = state.tokenAt.get(key(q, r));
    return !!tk && ANIMALS[tk.animal].tier === req.tier;
  }
  if (req.token) {
    const tk = state.tokenAt.get(key(q, r));
    return !!tk && tk.animal === req.token;
  }
  return false;
}

// Every hex where this animal could be placed from its card right now.
function placementSpots(animal) {
  const spots = new Set();
  const cells = ANIMALS[animal].place.cells;
  for (const k of state.board.keys()) {
    if (state.tokenAt.has(k)) continue;
    const [q, r] = k.split(',').map(Number);
    if (matchPattern(q, r, cells, cellSatisfied)) spots.add(k);
  }
  return spots;
}

// Neighbouring tiles a token may step onto: laid land, nobody standing there.
function moveSpots(token) {
  const spots = new Set();
  if (!token.at) return spots;
  for (const [dq, dr] of DIRS) {
    const k = key(token.at.q + dq, token.at.r + dr);
    if (state.board.has(k) && !state.tokenAt.has(k)) spots.add(k);
  }
  return spots;
}

function canReturn(token) {
  if (!token.at) return false;
  return !!matchPattern(token.at.q, token.at.r, ANIMALS[token.animal].ret.cells, cellSatisfied);
}

function refreshReady() {
  state.ready = {};
  for (const animal of ANIMAL_ORDER) {
    const token = myToken(animal);
    state.ready[animal] = token.at ? canReturn(token) : placementSpots(animal).size > 0;
  }
}

function selectAnimal(animal) {
  const token = myToken(animal);
  state.sel = {
    animal,
    onBoard: !!token.at,
    spots: token.at ? moveSpots(token) : placementSpots(animal),
    canReturn: canReturn(token),
  };
}

function refreshSelection() {
  if (state.sel) selectAnimal(state.sel.animal);
}

function score(player, points) {
  state.scores[player] += points;
  syncHud();
}

function doPlaceToken(animal, q, r) {
  const token = myToken(animal);
  token.at = { q, r };
  token.movedAt = performance.now();
  state.tokenAt.set(key(q, r), token);
  score(state.current, ANIMALS[animal].place.points);
  flashScore('+' + ANIMALS[animal].place.points, q, r);
  spendAnimalMove();
}

function doMoveToken(animal, q, r) {
  const token = myToken(animal);
  state.tokenAt.delete(key(token.at.q, token.at.r));
  token.at = { q, r };
  token.movedAt = performance.now();
  state.tokenAt.set(key(q, r), token);
  spendAnimalMove();
}

function doReturnToken(animal) {
  const token = myToken(animal);
  const { q, r } = token.at;
  state.tokenAt.delete(key(q, r));
  token.at = null;
  token.movedAt = performance.now();
  score(state.current, ANIMALS[animal].ret.points);
  flashScore('+' + ANIMALS[animal].ret.points, q, r);
  spendAnimalMove();
}

// Short lived score popups floating off the board.
const flashes = [];
function flashScore(text, q, r) {
  const p = hexToPixel(q, r, HEX_SIZE);
  flashes.push({ text, wx: p.x, wy: p.y, born: performance.now() });
}

/* ------------------------------------------------------------------ *
 * Camera helpers
 * ------------------------------------------------------------------ */

function worldToScreen(wx, wy) {
  return {
    x: (wx - state.camera.x) * state.camera.scale + W / 2,
    y: (wy - state.camera.y) * state.camera.scale + H / 2,
  };
}

function screenToWorld(sx, sy) {
  return {
    x: (sx - W / 2) / state.camera.scale + state.camera.x,
    y: (sy - H / 2) / state.camera.scale + state.camera.y,
  };
}

function hexAtScreen(sx, sy) {
  const w = screenToWorld(sx, sy);
  return pixelToHex(w.x, w.y, HEX_SIZE);
}

/* ------------------------------------------------------------------ *
 * Rendering
 * ------------------------------------------------------------------ */

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2.5);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.floor(W * DPR);
  canvas.height = Math.floor(H * DPR);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (state.held && !state.held.dragging) {
    const home = heldHome();
    state.held.x = home.x;
    state.held.y = home.y;
  }
}

function drawBackground() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#16222e');
  g.addColorStop(1, '#0b1118');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Faint hex lattice so the empty board still reads as a grid.
  const size = HEX_SIZE * state.camera.scale;
  if (size < 16) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.035)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  const tl = screenToWorld(0, 0);
  const br = screenToWorld(W, H);
  const q0 = Math.floor(tl.x / (HEX_SIZE * 1.5)) - 1;
  const q1 = Math.ceil(br.x / (HEX_SIZE * 1.5)) + 1;
  for (let q = q0; q <= q1; q++) {
    const colX = HEX_SIZE * 1.5 * q;
    const r0 = Math.floor((tl.y / (HEX_SIZE * SQRT3)) - q / 2) - 1;
    const r1 = Math.ceil((br.y / (HEX_SIZE * SQRT3)) - q / 2) + 1;
    for (let r = r0; r <= r1; r++) {
      const p = hexToPixel(q, r, HEX_SIZE);
      const s = worldToScreen(p.x, p.y);
      const pts = hexCorners(s.x, s.y, size);
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < 6; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
    }
  }
  ctx.stroke();
  ctx.restore();
}

function drawTerrain(c, type, variant, size) {
  const sp = sprites[type][variant % VARIANTS];
  const scale = size / SPRITE_R;
  c.drawImage(sp, -sp.width * scale / 2, -sp.height * scale / 2,
    sp.width * scale, sp.height * scale);
}

/* The boundary between two terrains runs from the centre out to a corner, so
 * every one of the six sides belongs wholly to one terrain or the other. The
 * line bows a little on the way out so a shoreline does not look like a pie
 * chart. */
function radialEdge(c, size, corner, bowDeg, toCentre) {
  const a = (Math.PI / 180) * 60 * corner;
  const ca = a + (Math.PI / 180) * bowDeg;
  const ctrl = [size * 0.58 * Math.cos(ca), size * 0.58 * Math.sin(ca)];
  if (toCentre) c.quadraticCurveTo(ctrl[0], ctrl[1], 0, 0);
  else c.quadraticCurveTo(ctrl[0], ctrl[1], size * Math.cos(a), size * Math.sin(a));
}

// The wedge owning `sides` consecutive sides, starting at corner 0.
function sidePath(c, size, sides) {
  const pts = hexCorners(0, 0, size);
  c.beginPath();
  c.moveTo(0, 0);
  radialEdge(c, size, 0, -6, false);
  for (let i = 1; i <= sides; i++) c.lineTo(pts[i % 6][0], pts[i % 6][1]);
  radialEdge(c, size, sides % 6, 6, true);
  c.closePath();
}

// A special tile carries its animal as a watermark and a warm rim.
function drawSpecialMark(c, tile, cx, cy, size, alpha) {
  if (!tile.special) return;
  c.save();
  if (alpha != null) c.globalAlpha = alpha;
  drawGlyph(c, tile.special, cx, cy, size * 1.05, 'rgba(255,236,190,0.34)');
  c.globalAlpha = (alpha == null ? 1 : alpha) * 0.9;
  traceHex(c, cx, cy, size * 0.9);
  c.lineWidth = Math.max(1.5, size * 0.06);
  c.strokeStyle = 'rgba(255,214,130,0.85)';
  c.stroke();
  c.restore();
  c.globalAlpha = 1;
}

/* Draw a whole tile: its terrain, the sides the second terrain owns, and the
 * seam between them, all turned to the tile's rotation. */
function drawTileArt(c, tile, cx, cy, size, alpha) {
  const rot = (tile.rot || 0) % 6;
  c.save();
  if (alpha != null) c.globalAlpha = alpha;
  c.translate(cx, cy);
  c.rotate((Math.PI / 3) * rot);
  drawTerrain(c, tile.types[0], tile.variant, size);

  if (tile.types[1]) {
    const sides = tile.sides || 2;
    c.save();
    sidePath(c, size * 1.02, sides);
    c.clip();
    drawTerrain(c, tile.types[1], tile.variant, size);
    c.restore();

    // Seam: only the two radial edges, not the rim.
    c.beginPath();
    c.moveTo(0, 0);
    radialEdge(c, size, 0, -6, false);
    c.moveTo(0, 0);
    radialEdge(c, size, sides % 6, 6, false);
    c.lineWidth = Math.max(1.2, size * 0.045);
    c.strokeStyle = 'rgba(12,18,24,0.5)';
    c.stroke();
  }
  c.restore();
  c.globalAlpha = 1;
}

function drawBoard(now) {
  for (const tile of state.board.values()) {
    const p = hexToPixel(tile.q, tile.r, HEX_SIZE);
    const s = worldToScreen(p.x, p.y);
    const size = HEX_SIZE * state.camera.scale;
    if (s.x < -size * 2 || s.x > W + size * 2 || s.y < -size * 2 || s.y > H + size * 2) continue;

    // Pop-in animation.
    const age = (now - tile.placedAt) / 260;
    const grow = age < 1 ? 0.82 + 0.18 * easeOutBack(Math.min(age, 1)) : 1;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = size * 0.18;
    ctx.shadowOffsetY = size * 0.06;
    drawTileArt(ctx, tile, s.x, s.y, size * grow);
    drawSpecialMark(ctx, tile, s.x, s.y, size * grow);
    ctx.restore();

    // Mixed tiles carry a pip per terrain, so the rule stays readable even
    // when the art is small or the terrains look alike at a glance.
    drawTypePips(ctx, tile, s.x, s.y, size);

    // Owner pip: who laid this tile. Off unless asked for.
    if (state.showOwners && state.players > 1) {
      const pr = Math.max(3.5, size * 0.115);
      const py = s.y + size * 0.58;
      ctx.beginPath();
      ctx.arc(s.x, py, pr, 0, Math.PI * 2);
      ctx.fillStyle = PLAYER_COLORS[tile.owner % PLAYER_COLORS.length];
      ctx.fill();
      ctx.lineWidth = Math.max(1, pr * 0.35);
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.stroke();
    }
  }
}

/* A dot sitting in the middle of each half, so which sides carry which terrain
 * reads at a glance and follows the tile when it is turned. */
function drawTypePips(c, tile, cx, cy, size) {
  if (!tile.types[1]) return;
  const pr = Math.max(2.4, size * 0.1);
  const sides = tile.sides || HALF;
  // The second terrain covers local sides 0 to sides-1, centred on that arc.
  const mid = (Math.PI / 3) * (sides / 2) + (Math.PI / 3) * (tile.rot || 0);
  const halves = [
    { type: tile.types[1], a: mid },
    { type: tile.types[0], a: mid + Math.PI },
  ];
  for (const h of halves) {
    const x = cx + Math.cos(h.a) * size * 0.46;
    const y = cy + Math.sin(h.a) * size * 0.46;
    c.beginPath();
    c.arc(x, y, pr * 1.5, 0, Math.PI * 2);
    c.fillStyle = 'rgba(8,14,20,0.5)';
    c.fill();
    c.beginPath();
    c.arc(x, y, pr, 0, Math.PI * 2);
    c.fillStyle = TYPES[h.type].light;
    c.fill();
  }
}

function easeOutBack(t) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function drawTargets(now) {
  const held = state.held;
  if (!held || !held.dragging) return;
  const size = HEX_SIZE * state.camera.scale;
  const pulse = 0.5 + 0.5 * Math.sin(now / 260);

  ctx.save();
  ctx.lineWidth = Math.max(2, size * 0.06);
  ctx.setLineDash([size * 0.22, size * 0.16]);

  if (state.board.size === 0) {
    // First tile: highlight wherever the pointer currently is.
    const h = hexAtScreen(held.x, held.y);
    const p = hexToPixel(h.q, h.r, HEX_SIZE);
    const s = worldToScreen(p.x, p.y);
    ctx.strokeStyle = `rgba(150,220,255,${0.45 + pulse * 0.4})`;
    traceHex(ctx, s.x, s.y, size * 0.94);
    ctx.stroke();
  } else {
    // Tiles that could be covered, marked quietly so the option is visible
    // without shouting over the land.
    ctx.strokeStyle = 'rgba(255,196,120,0.22)';
    ctx.lineWidth = Math.max(1.5, size * 0.04);
    for (const tile of state.board.values()) {
      if (state.tokenAt.has(key(tile.q, tile.r))) continue;
      const p = hexToPixel(tile.q, tile.r, HEX_SIZE);
      const sc = worldToScreen(p.x, p.y);
      if (sc.x < -size || sc.x > W + size || sc.y < -size || sc.y > H + size) continue;
      if (state.hoverKey === key(tile.q, tile.r)) continue;
      traceHex(ctx, sc.x, sc.y, size * 0.82);
      ctx.stroke();
    }
    if (state.hoverKey && isOverlay(...state.hoverKey.split(',').map(Number))) {
      const [q, r] = state.hoverKey.split(',').map(Number);
      const p = hexToPixel(q, r, HEX_SIZE);
      const sc = worldToScreen(p.x, p.y);
      ctx.setLineDash([]);
      ctx.fillStyle = `rgba(255,196,120,${0.16 + pulse * 0.1})`;
      traceHex(ctx, sc.x, sc.y, size);
      ctx.fill();
      ctx.strokeStyle = `rgba(255,206,140,${0.8 + pulse * 0.2})`;
      ctx.lineWidth = Math.max(3, size * 0.09);
      traceHex(ctx, sc.x, sc.y, size * 0.97);
      ctx.stroke();
      ctx.setLineDash([size * 0.22, size * 0.16]);
    }
    for (const k of state.valid) {
      const [q, r] = k.split(',').map(Number);
      const p = hexToPixel(q, r, HEX_SIZE);
      const s = worldToScreen(p.x, p.y);
      if (s.x < -size || s.x > W + size || s.y < -size || s.y > H + size) continue;
      const isHover = state.hoverKey === k;
      ctx.strokeStyle = isHover
        ? `rgba(160,235,255,${0.75 + pulse * 0.25})`
        : 'rgba(160,215,240,0.30)';
      ctx.lineWidth = isHover ? Math.max(3, size * 0.09) : Math.max(2, size * 0.05);
      traceHex(ctx, s.x, s.y, size * (isHover ? 0.96 : 0.9));
      ctx.stroke();
      if (isHover) {
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(160,235,255,0.10)';
        ctx.fill();
        ctx.setLineDash([size * 0.22, size * 0.16]);
      }
    }
  }
  ctx.restore();
}

// The bottom band is where the deck lives and where drops are refused, so it
// gets a dimming tray to separate the hand from the land behind it.
function trayTop() {
  return handLayout().top;
}

function drawTray() {
  const top = trayTop();
  const g = ctx.createLinearGradient(0, top, 0, H);
  g.addColorStop(0, 'rgba(8,13,18,0)');
  g.addColorStop(0.35, 'rgba(8,13,18,0.72)');
  g.addColorStop(1, 'rgba(8,13,18,0.94)');
  ctx.fillStyle = g;
  ctx.fillRect(0, top, W, H - top);
}

function drawDeck(now) {
  const d = deckAnchor();
  const remaining = tilesLeft();
  const stack = Math.min(4, Math.max(0, Math.ceil(remaining / 8)));

  // Shadow footprint.
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(d.x, d.y + DECK_SIZE * 0.95, DECK_SIZE * 1.05, DECK_SIZE * 0.3, 0, 0, Math.PI * 2);
  ctx.filter = 'blur(2px)';
  ctx.fill();
  ctx.restore();

  // Stacked backs.
  for (let i = stack; i >= 0; i--) {
    const oy = d.y - i * 3.5;
    drawTileBack(d.x, oy, DECK_SIZE, i === 0 ? 1 : 0.55 + i * 0.05);
  }

  // Count on the top of the deck.
  ctx.save();
  ctx.fillStyle = 'rgba(234,241,246,0.92)';
  ctx.font = '700 13px "Avenir Next", "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(tilesLeft()), d.x, d.y - stack * 3);
  ctx.restore();
  void now;
}

function drawTileBack(cx, cy, size, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  traceHex(ctx, cx, cy, size);
  const g = ctx.createLinearGradient(0, cy - size, 0, cy + size);
  g.addColorStop(0, '#2a3a4a');
  g.addColorStop(1, '#1b2733');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#0d151d';
  ctx.stroke();
  traceHex(ctx, cx, cy, size * 0.72);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(111,195,223,0.28)';
  ctx.stroke();
  ctx.restore();
}

function drawHeld(now) {
  const held = state.held;
  if (!held) return;

  // Return-to-deck animation.
  if (held.returning) {
    const t = Math.min(1, (now - held.returning.start) / 240);
    const e = 1 - Math.pow(1 - t, 3);
    held.x = held.returning.fromX + (held.returning.toX - held.returning.fromX) * e;
    held.y = held.returning.fromY + (held.returning.toY - held.returning.fromY) * e;
    if (t >= 1) held.returning = null;
  }

  const drawIn = Math.min(1, (now - held.bornAt) / 300);
  const appear = easeOutBack(drawIn);
  const bob = held.dragging ? 0 : Math.sin(now / 700) * 2.5;
  const size = held.dragging ? HAND_TILE * 1.35 : HAND_TILE * (0.86 + 0.14 * appear);

  // Ghost preview snapped to the hovered hex while dragging.
  if (held.dragging && state.hoverKey) {
    const [q, r] = state.hoverKey.split(',').map(Number);
    const p = hexToPixel(q, r, HEX_SIZE);
    const s = worldToScreen(p.x, p.y);
    drawTileArt(ctx, held, s.x, s.y, HEX_SIZE * state.camera.scale, 0.55);
    drawSpecialMark(ctx, held, s.x, s.y, HEX_SIZE * state.camera.scale, 0.55);
  }

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = held.dragging ? 26 : 14;
  ctx.shadowOffsetY = held.dragging ? 12 : 5;
  drawTileArt(ctx, held, held.x, held.y + bob, size);
  drawSpecialMark(ctx, held, held.x, held.y + bob, size);
  ctx.restore();
  drawTypePips(ctx, held, held.x, held.y + bob, size);

}

/* ------------------------------------------------------------------ *
 * Animal tokens, card rail and pattern diagrams
 * ------------------------------------------------------------------ */

const FONT = '"Avenir Next", "Segoe UI", system-ui, sans-serif';
const font = (spec) => spec + ' ' + FONT;

// Rebuilt every frame so pointer hit testing always matches what is drawn.
let hits = [];
function pushHit(id, x, y, w, h, data) { hits.push({ id, x, y, w, h, data }); }
function hitTest(x, y) {
  for (let i = hits.length - 1; i >= 0; i--) {
    const a = hits[i];
    if (x >= a.x && x <= a.x + a.w && y >= a.y && y <= a.y + a.h) return a;
  }
  return null;
}

/* The hand: a row holding the deck, this turn's tile and the turn buttons,
 * with the card rail beneath it. Both are on screen the whole turn, so the
 * tile and the animal can be played in either order and the cards can be
 * read at any moment. */
function handLayout() {
  const n = ANIMAL_ORDER.length;
  const gap = 5;
  const pad = 8;
  const cw = Math.min(64, (W - pad * 2 - gap * (n - 1)) / n);
  const ch = 66;
  const railY = H - safeBottom() - 8 - ch;
  const rowH = 74;
  const rowY = railY - 6 - rowH;
  // The tiles drawn from the bag get their own shelf above the hand.
  const choiceH = state.choices.length ? 80 : 0;
  const choiceY = rowY - 8 - choiceH;
  const aboveHand = choiceH ? choiceY : rowY;
  const detailH = 92;
  const detailY = aboveHand - 8 - detailH;
  return {
    n, gap, cw, ch, railY, rowY, rowH, detailY, detailH, choiceY, choiceH,
    startX: (W - (cw * n + gap * (n - 1))) / 2,
    btnW: Math.min(150, W * 0.42),
    btnH: 32,
    top: (state.sel ? detailY : aboveHand) - 12,
  };
}

const CHOICE_SIZE = 32;

// Where each drawn tile sits on the shelf.
function choicePos(i, lay) {
  const step = CHOICE_SIZE * 2 + 14;
  const total = step * state.choices.length - 14;
  return {
    x: (W - total) / 2 + step * i + CHOICE_SIZE,
    y: lay.choiceY + lay.choiceH / 2 - 4,
  };
}

function drawChoices(now, lay) {
  if (!state.choices.length) return;
  ctx.textAlign = 'center';
  ctx.font = font('700 9.5px');
  ctx.fillStyle = 'rgba(147,166,181,0.95)';
  ctx.fillText('PICK ONE FROM THE BAG', W / 2, lay.choiceY + 12);

  state.choices.forEach((card, i) => {
    const p = choicePos(i, lay);
    const lift = Math.sin(now / 620 + i * 1.3) * 1.6;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    drawTileArt(ctx, card, p.x, p.y + lift, CHOICE_SIZE);
    drawTypePips(ctx, card, p.x, p.y + lift, CHOICE_SIZE);
    drawSpecialMark(ctx, card, p.x, p.y + lift, CHOICE_SIZE);
    ctx.restore();
    if (card.special) {
      ctx.font = font('800 8px');
      ctx.fillStyle = 'rgba(255,214,130,0.95)';
      ctx.fillText(card.specialName.toUpperCase(), p.x, p.y + lift + CHOICE_SIZE * SQRT3 / 2 + 11);
    }
    pushHit('choice', p.x - CHOICE_SIZE, p.y - CHOICE_SIZE, CHOICE_SIZE * 2, CHOICE_SIZE * 2, i);
  });
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawTokensOnBoard(now) {
  const size = HEX_SIZE * state.camera.scale;
  for (const token of state.tokenAt.values()) {
    if (state.tokenDrag && state.tokenDrag.token === token) continue;
    const p = hexToPixel(token.at.q, token.at.r, HEX_SIZE);
    const s = worldToScreen(p.x, p.y);
    if (s.x < -size || s.x > W + size || s.y < -size || s.y > H + size) continue;

    const age = (now - token.movedAt) / 320;
    const hop = age < 1 ? Math.sin(Math.min(age, 1) * Math.PI) * size * 0.16 : 0;
    const selected = state.sel && state.sel.animal === token.animal &&
      token.player === state.current;
    const pulse = 0.5 + 0.5 * Math.sin(now / 240);
    const ring = selected
      ? (state.sel.canReturn ? `rgba(126,225,150,${0.55 + pulse * 0.45})`
        : `rgba(160,235,255,${0.5 + pulse * 0.5})`)
      : null;
    drawToken(ctx, token.animal, s.x, s.y - size * 0.06 - hop, size * 0.62,
      PLAYER_COLORS[token.player % PLAYER_COLORS.length], { ring });
  }
}

function drawTokenTargets(now) {
  const sel = state.sel;
  if (!sel || state.turn.animalMoved) return;
  const size = HEX_SIZE * state.camera.scale;
  const pulse = 0.5 + 0.5 * Math.sin(now / 300);
  const hoverK = tokenDropKey();

  ctx.save();
  ctx.setLineDash([size * 0.2, size * 0.15]);
  for (const k of sel.spots) {
    const [q, r] = k.split(',').map(Number);
    const p = hexToPixel(q, r, HEX_SIZE);
    const s = worldToScreen(p.x, p.y);
    if (s.x < -size || s.x > W + size || s.y < -size || s.y > H + size) continue;
    const hot = hoverK === k;
    const tint = sel.onBoard ? '160,235,255' : '126,225,150';
    ctx.strokeStyle = `rgba(${tint},${hot ? 0.95 : 0.34 + pulse * 0.16})`;
    ctx.lineWidth = hot ? Math.max(3, size * 0.09) : Math.max(2, size * 0.05);
    traceHex(ctx, s.x, s.y, size * (hot ? 0.96 : 0.88));
    ctx.stroke();
    if (hot) {
      ctx.setLineDash([]);
      ctx.fillStyle = `rgba(${tint},0.14)`;
      ctx.fill();
      ctx.setLineDash([size * 0.2, size * 0.15]);
    }
  }
  ctx.restore();
}

function drawFlashes(now) {
  for (let i = flashes.length - 1; i >= 0; i--) {
    const f = flashes[i];
    const t = (now - f.born) / 1200;
    if (t >= 1) { flashes.splice(i, 1); continue; }
    const s = worldToScreen(f.wx, f.wy);
    ctx.save();
    ctx.globalAlpha = 1 - t * t;
    ctx.font = font('800 22px');
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(6,12,18,0.8)';
    ctx.strokeText(f.text, s.x, s.y - 20 - t * 42);
    ctx.fillStyle = '#7ee196';
    ctx.fillText(f.text, s.x, s.y - 20 - t * 42);
    ctx.restore();
  }
}

/* One card's requirement diagram: the little hex cluster with the animal
 * standing on the anchor cell. */
function drawPatternDiagram(cx, cy, cells, s, color, animal) {
  const ext = patternExtent(cells);
  for (const [dq, dr, req] of cells) {
    const x = cx + s * 1.5 * dq - s * ext.cx;
    const y = cy + s * SQRT3 * (dr + dq / 2) - s * ext.cy;
    traceHex(ctx, x, y, s * 0.95);
    if (req.tile) {
      ctx.fillStyle = TYPES[req.tile].base;
      ctx.fill();
      ctx.strokeStyle = TYPES[req.tile].ink;
      ctx.lineWidth = 1.6;
      ctx.stroke();
    } else {
      // An animal requirement. The glyph says which animal, so the cell needs
      // no colour coding of its own.
      const tint = '#c9d9e6';
      ctx.fillStyle = '#1d2833';
      ctx.fill();
      ctx.setLineDash([2.5, 2.5]);
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = tint;
      ctx.stroke();
      ctx.setLineDash([]);
      drawGlyph(ctx, req.token || 'any', x, y, s * 1.05, tint);
    }
  }
  // Mark where the animal itself stands.
  const ax = cx - s * ext.cx;
  const ay = cy - s * ext.cy;
  drawToken(ctx, animal, ax, ay, s * 0.82, color, { shadow: false });
}

function drawCardDetail(now, animal, lay) {
  const a = ANIMALS[animal];
  const token = myToken(animal);
  const color = PLAYER_COLORS[state.current % PLAYER_COLORS.length];
  const x = 10, w = W - 20, y = lay.detailY, h = lay.detailH;

  roundRect(x, y, w, h, 14);
  ctx.fillStyle = 'rgba(24,35,46,0.95)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.font = font('800 13px');
  ctx.fillStyle = '#eaf1f6';
  ctx.fillText(a.name.toUpperCase(), x + 14, y + 20);
  const nameW = ctx.measureText(a.name.toUpperCase()).width;
  ctx.font = font('500 11px');
  ctx.fillStyle = '#93a6b5';
  ctx.fillText(a.blurb, x + 20 + nameW, y + 20);

  const half = w / 2;
  ctx.beginPath();
  ctx.moveTo(x + half, y + 30);
  ctx.lineTo(x + half, y + h - 10);
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.stroke();

  const cols = [
    { label: 'GO OUT', p: a.place, active: !token.at, ready: !token.at && state.sel.spots.size > 0 },
    { label: 'COME HOME', p: a.ret, active: !!token.at, ready: !!token.at && state.sel.canReturn },
  ];
  cols.forEach((col, i) => {
    const cx0 = x + i * half;
    ctx.globalAlpha = col.active ? 1 : 0.42;
    ctx.textAlign = 'left';
    ctx.font = font('800 10px');
    ctx.fillStyle = col.ready ? '#7ee196' : '#93a6b5';
    ctx.fillText(col.label + '  +' + col.p.points, cx0 + 14, y + 44);
    ctx.font = font('500 10px');
    ctx.fillStyle = '#8ea1b0';
    wrapText(col.p.hint, cx0 + 14, y + 58, half - 78, 12);
    drawPatternDiagram(cx0 + half - 38, y + h / 2 + 12, col.p.cells, 12, color, animal);
    ctx.globalAlpha = 1;
  });
}

function wrapText(text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let ly = y;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, ly);
      line = word;
      ly += lineHeight;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, ly);
}

function drawButton(id, label, x, y, w, h, kind) {
  const enabled = kind !== 'off';
  roundRect(x, y, w, h, h / 2);
  if (kind === 'go') {
    ctx.fillStyle = 'rgba(126,225,150,0.92)';
  } else if (kind === 'ghost') {
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
  }
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = kind === 'go' ? 'rgba(126,225,150,0.9)' : 'rgba(255,255,255,0.14)';
  ctx.stroke();
  ctx.font = font('700 12px');
  ctx.textAlign = 'center';
  ctx.fillStyle = kind === 'go' ? '#07161c' : (enabled ? '#eaf1f6' : 'rgba(234,241,246,0.35)');
  ctx.fillText(label, x + w / 2, y + h / 2 + 4);
  if (enabled) pushHit(id, x, y, w, h);
}

function drawTurnRow(now, lay) {
  const sel = state.sel;
  const cy = lay.rowY + lay.rowH / 2;
  const bx = W - 10 - lay.btnW;

  // Deck and the tile drawn for this turn, on the left.
  drawDeck(now);
  if (state.choices.length) {
    const h = heldHome();
    traceHex(ctx, h.x, h.y, HAND_TILE * 0.86);
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(147,166,181,0.45)';
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (!state.turn.tileLaid && !state.pending) {
    drawHeld(now);
    pushHit('tile', 4, lay.rowY, heldHome().x + HAND_TILE + 8, lay.rowH);
  } else if (state.pending) {
    const h = heldHome();
    traceHex(ctx, h.x, h.y, HAND_TILE * 0.86);
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(160,235,255,0.55)';
    ctx.stroke();
    ctx.setLineDash([]);
  } else {
    // Tile spent: a quiet marker where it sat.
    const h = heldHome();
    traceHex(ctx, h.x, h.y, HAND_TILE * 0.86);
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(126,225,150,0.5)';
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = font('800 15px');
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(126,225,150,0.85)';
    ctx.fillText('\u2713', h.x, h.y + 5);
  }

  // What the turn is still waiting on, in the gap between tile and buttons.
  const textX = heldHome().x + HAND_TILE + 18;
  const textW = bx - textX - 10;
  if (textW > 70) {
    ctx.textAlign = 'left';
    ctx.font = font('600 11.5px');
    ctx.fillStyle = 'rgba(147,166,181,0.92)';
    const msg = state.choices.length ? 'Pick a tile'
      : (state.pending ? 'Confirm your tile'
        : (!state.turn.tileLaid ? 'Play the tile'
          : (state.turn.animalMoved ? 'Turn done' : 'Animal optional')));
    wrapText(msg, textX, cy - 3, textW, 13);
  }

  // Return sits above End Turn; End Turn only unlocks once the tile is down.
  if (sel && sel.onBoard && !state.turn.animalMoved) {
    drawButton('return', 'Return to card  +' + ANIMALS[sel.animal].ret.points,
      bx, lay.rowY + 3, lay.btnW, lay.btnH, sel.canReturn ? 'go' : 'off');
  }
  drawButton('endturn', state.turn.tileLaid ? 'End Turn' : 'Lay a tile first',
    bx, lay.rowY + lay.rowH - lay.btnH - 3, lay.btnW, lay.btnH,
    state.turn.tileLaid ? 'ghost' : 'off');
}

function drawHand(now) {
  const lay = handLayout();

  // Tray behind the whole hand area.
  const g = ctx.createLinearGradient(0, lay.top, 0, H);
  g.addColorStop(0, 'rgba(8,13,18,0)');
  g.addColorStop(0.22, 'rgba(8,13,18,0.8)');
  g.addColorStop(1, 'rgba(8,13,18,0.96)');
  ctx.fillStyle = g;
  ctx.fillRect(0, lay.top, W, H - lay.top);
  pushHit('tray', 0, lay.top, W, H - lay.top);

  if (state.sel) drawCardDetail(now, state.sel.animal, lay);
  drawChoices(now, lay);
  drawTurnRow(now, lay);

  const color = PLAYER_COLORS[state.current % PLAYER_COLORS.length];
  ANIMAL_ORDER.forEach((animal, i) => {
    const token = myToken(animal);
    const x = lay.startX + i * (lay.cw + lay.gap);
    const y = lay.railY;
    const selected = state.sel && state.sel.animal === animal;

    roundRect(x, y, lay.cw, lay.ch, 10);
    ctx.fillStyle = selected ? 'rgba(111,195,223,0.18)' : 'rgba(255,255,255,0.05)';
    ctx.fill();
    ctx.lineWidth = selected ? 2 : 1;
    ctx.strokeStyle = selected ? 'rgba(140,215,240,0.9)' : 'rgba(255,255,255,0.12)';
    ctx.stroke();

    const cx = x + lay.cw / 2;
    if (token.at) {
      // Piece is out on the land: show an empty slot on the card.
      traceHex(ctx, cx, y + 24, 15);
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fill();
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(160,235,255,0.55)';
      ctx.stroke();
      ctx.setLineDash([]);
      drawGlyph(ctx, animal, cx, y + 24, 20, 'rgba(200,220,235,0.30)');
    } else {
      drawToken(ctx, animal, cx, y + 24, 32, color, { shadow: false });
    }

    ctx.textAlign = 'center';
    ctx.font = font('700 9px');
    ctx.fillStyle = 'rgba(234,241,246,0.85)';
    ctx.fillText(ANIMALS[animal].name.toUpperCase(), cx, y + 50);

    // Points, with the currently reachable side lit up.
    const a = ANIMALS[animal];
    const ready = state.ready[animal] && !state.turn.animalMoved;
    ctx.font = font('700 9px');
    ctx.fillStyle = ready ? '#7ee196' : 'rgba(147,166,181,0.75)';
    ctx.fillText(token.at ? 'HOME +' + a.ret.points : 'OUT +' + a.place.points, cx, y + 61);

    pushHit('card', x, y, lay.cw, lay.ch, animal);
  });
}

/* The pending tile's controls sit on two levels with the tile between them:
 * Back and Confirm above, turning below. Committing and turning are different
 * kinds of decision, and a fat finger reaching for one must not find the
 * other. */
function pendingLayout() {
  const p = state.pending;
  if (!p) return null;
  const pt = hexToPixel(p.q, p.r, HEX_SIZE);
  const s = worldToScreen(pt.x, pt.y);
  const size = HEX_SIZE * state.camera.scale;
  const canTurn = p.types.length > 1;
  const rotW = 44, gap = 8, backW = 64, okW = 92, h = 38;

  const topTotal = backW + gap + okW;
  const botTotal = rotW * 2 + gap;
  const clampX = (total) => Math.max(8, Math.min(W - 8 - total, s.x - total / 2));

  const lowest = trayTop() - h - 10;
  let topY = s.y - size * 0.95 - 12 - h;
  let botY = s.y + size * 0.95 + 12;
  topY = Math.max(56, Math.min(lowest - h - 10, topY));
  botY = Math.max(topY + h + 10, Math.min(lowest, botY));

  return {
    h, rotW, backW, okW, gap, canTurn,
    topX: clampX(topTotal), topY, topTotal,
    botX: clampX(botTotal), botY, botTotal,
    sx: s.x, sy: s.y, size,
  };
}

function drawRotIcon(cx, cy, r, dir, color) {
  const a0 = -Math.PI * 0.78, a1 = Math.PI * 0.5;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (dir > 0) ctx.arc(cx, cy, r, a0, a1);
  else ctx.arc(cx, cy, r, Math.PI - a1, Math.PI - a0);
  ctx.stroke();
  const ha = dir > 0 ? a1 : Math.PI - a1;
  const hx = cx + Math.cos(ha) * r, hy = cy + Math.sin(ha) * r;
  const tang = ha + (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
  ctx.beginPath();
  ctx.moveTo(hx + Math.cos(tang) * 7.5, hy + Math.sin(tang) * 7.5);
  ctx.lineTo(hx + Math.cos(tang + 2.45) * 7.5, hy + Math.sin(tang + 2.45) * 7.5);
  ctx.lineTo(hx + Math.cos(tang - 2.45) * 7.5, hy + Math.sin(tang - 2.45) * 7.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawPendingTile(now) {
  const p = state.pending;
  if (!p) return;
  const pt = hexToPixel(p.q, p.r, HEX_SIZE);
  const s = worldToScreen(pt.x, pt.y);
  const size = HEX_SIZE * state.camera.scale;
  const pulse = 0.5 + 0.5 * Math.sin(now / 300);

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = size * 0.35;
  ctx.shadowOffsetY = size * 0.1;
  drawTileArt(ctx, p, s.x, s.y, size, 0.92);
  drawSpecialMark(ctx, p, s.x, s.y, size, 0.92);
  ctx.restore();
  drawTypePips(ctx, p, s.x, s.y, size);

  ctx.save();
  ctx.setLineDash([size * 0.2, size * 0.14]);
  ctx.lineWidth = Math.max(2.5, size * 0.075);
  ctx.strokeStyle = `rgba(160,235,255,${0.55 + pulse * 0.45})`;
  traceHex(ctx, s.x, s.y, size * 1.02);
  ctx.stroke();
  ctx.restore();
  pushHit('pendingtile', s.x - size, s.y - size, size * 2, size * 2);
}

function drawPendingControls() {
  const lay = pendingLayout();
  if (!lay) return;

  // Above the tile: the two decisions that end the placement.
  drawButton('back', 'Back', lay.topX, lay.topY, lay.backW, lay.h, 'ghost');
  drawButton('confirm', 'Confirm', lay.topX + lay.backW + lay.gap, lay.topY,
    lay.okW, lay.h, 'go');

  // Below it: turning, which you may want to do several times.
  if (!lay.canTurn) return;
  let x = lay.botX;
  for (const [id, dir] of [['rotccw', -1], ['rotcw', 1]]) {
    roundRect(x, lay.botY, lay.rotW, lay.h, lay.h / 2);
    ctx.fillStyle = 'rgba(23,34,45,0.95)';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.stroke();
    drawRotIcon(x + lay.rotW / 2, lay.botY + lay.h / 2, 10, dir, '#eaf1f6');
    pushHit(id, x, lay.botY, lay.rotW, lay.h);
    x += lay.rotW + lay.gap;
  }
}

function drawDraggedToken(now) {
  const d = state.tokenDrag;
  if (!d) return;
  const color = PLAYER_COLORS[state.current % PLAYER_COLORS.length];
  const size = HEX_SIZE * state.camera.scale * 0.72;
  drawToken(ctx, d.animal, d.x, d.y - 14, size, color, {});
}

function render(now) {
  hits = [];
  // The hand grows and shrinks as the shelf and card detail come and go, so a
  // visible hint follows it rather than being placed once and left behind.
  if (!hintEl.classList.contains('hidden')) positionHint();
  drawBackground();
  if (state.mode === 'playing' || state.mode === 'gameover') {
    drawBoard(now);
    drawTargets(now);
    drawTokenTargets(now);
    drawTokensOnBoard(now);
    drawFlashes(now);
  }
  if (state.mode === 'playing') {
    drawPendingTile(now);
    drawHand(now);
    drawPendingControls();
    drawDraggedToken(now);
  }
  requestAnimationFrame(render);
}

/* ------------------------------------------------------------------ *
 * Input
 * ------------------------------------------------------------------ */

const pointers = new Map();
let panning = null;
let pinch = null;

function pointInHeld(x, y) {
  const held = state.held;
  if (!held) return false;
  return Math.hypot(x - held.x, y - held.y) <= HAND_TILE * 1.3;
}

function pointInDeck(x, y) {
  const d = deckAnchor();
  return Math.hypot(x - d.x, y - d.y) <= DECK_SIZE * 1.2;
}

let press = null;   // the pointer gesture in progress, for tap detection

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

/* The right mouse button turns the tile. It has to be wired to mousedown:
 * a browser only fires pointerdown for the first button pressed, so a right
 * click during a left button drag never arrives as one. */
canvas.addEventListener('mousedown', (e) => {
  if (state.mode !== 'playing' || e.button !== 2) return;
  if (rotateTile(1)) e.preventDefault();
});

canvas.addEventListener('pointerdown', (e) => {
  if (state.mode !== 'playing') return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;   // handled above

  // A second finger while dragging turns the tile rather than pinching.
  if (state.held && state.held.dragging && pointers.size >= 1) {
    rotateTile(1);
    return;
  }

  // Capture keeps a drag alive off the edge of the canvas, but a stray event
  // must not be allowed to throw and abandon the rest of this handler.
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* not a live pointer */ }
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (pointers.size === 2) {
    startPinch();
    return;
  }

  press = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0, hit: null };

  // Canvas drawn controls first.
  const hit = hitTest(e.clientX, e.clientY);
  if (hit) {
    press.hit = hit;
    if (hit.id === 'card') beginCardPress(hit.data, e);
    else if (hit.id === 'tile') beginTilePress(e);
    else if (hit.id === 'choice') beginChoicePress(hit.data, e);
    else if (hit.id === 'pendingtile') beginPendingDrag(e);
    return;
  }

  if (e.clientY < trayTop() && !state.turn.animalMoved) {
    // Picking up one of your own animals already out on the land.
    const h = hexAtScreen(e.clientX, e.clientY);
    const tk = state.tokenAt.get(key(h.q, h.r));
    if (tk && tk.player === state.current) {
      selectAnimal(tk.animal);
      state.tokenDrag = { animal: tk.animal, token: tk, from: 'board', x: e.clientX, y: e.clientY };
      hideHint();
      return;
    }
  }

  panning = { id: e.pointerId, x: e.clientX, y: e.clientY };
});

// Taking a tile from the shelf keeps it and drops the rest back in the bag.
function beginChoicePress(index, e) {
  const held = chooseTile(index);
  if (!held) return;
  held.dragging = true;
  held.pointerId = e.pointerId;
  held.grabDX = 0;
  held.grabDY = 0;
  held.x = e.clientX;
  held.y = e.clientY;
  updateHover();
  hideHint();
}

function beginTilePress(e) {
  const held = state.held;
  if (!held || held.dragging || state.turn.tileLaid) return;
  held.returning = null;
  held.dragging = true;
  held.pointerId = e.pointerId;
  // Grab from the tile centre so the tile sits under the finger.
  held.grabDX = 0;
  held.grabDY = pointInDeck(e.clientX, e.clientY) ? -HAND_TILE * 0.7 : 0;
  held.x = e.clientX + held.grabDX;
  held.y = e.clientY + held.grabDY;
  updateHover();
  hideHint();
}

// Picking a waiting tile back up puts it in hand, still turned as you left it.
function beginPendingDrag(e) {
  const p = state.pending;
  if (!p) return;
  state.held = {
    types: p.types, variant: p.variant, rot: p.rot, sides: p.sides,
    x: e.clientX, y: e.clientY, dragging: true, pointerId: e.pointerId,
    grabDX: 0, grabDY: 0, bornAt: performance.now(), returning: null,
  };
  state.pending = null;
  updateHover();
  hideHint();
}

function beginCardPress(animal, e) {
  selectAnimal(animal);
  const token = myToken(animal);
  if (!token.at && !state.turn.animalMoved) {
    state.tokenDrag = { animal, token, from: 'card', x: e.clientX, y: e.clientY };
  }
  hideHint();
}

// The hex a dragged token would land on, or null when it is over nothing valid.
function tokenDropKey() {
  const d = state.tokenDrag;
  if (!d || !state.sel || d.y > trayTop()) return null;
  const h = hexAtScreen(d.x, d.y);
  const k = key(h.q, h.r);
  return state.sel.spots.has(k) ? k : null;
}

function resolveTokenDrop(tap) {
  const d = state.tokenDrag;
  const sel = state.sel;
  state.tokenDrag = null;
  if (!sel || tap) return;          // a tap just selects the card
  if (state.turn.animalMoved) { showHint('One animal a turn'); return; }

  if (d.y > trayTop()) {
    if (d.from === 'board' && sel.canReturn) doReturnToken(sel.animal);
    else if (d.from === 'board') showHint('The land here does not match the return layout');
    else showHint('Drag the animal out onto the land');
    return;
  }
  const h = hexAtScreen(d.x, d.y);
  if (sel.spots.has(key(h.q, h.r))) {
    if (d.from === 'card') doPlaceToken(sel.animal, h.q, h.r);
    else doMoveToken(sel.animal, h.q, h.r);
    return;
  }
  showHint(d.from === 'card'
    ? 'That land does not match the placement layout'
    : 'Animals step to one connected tile at a time');
}

function tapBoard(e) {
  const sel = state.sel;
  if (!sel || e.clientY > trayTop() || state.turn.animalMoved) return;
  const h = hexAtScreen(e.clientX, e.clientY);
  const k = key(h.q, h.r);
  if (sel.spots.has(k)) {
    if (sel.onBoard) doMoveToken(sel.animal, h.q, h.r);
    else doPlaceToken(sel.animal, h.q, h.r);
  } else if (!state.tokenAt.has(k)) {
    state.sel = null;
  }
}

function fireButton(hit, e) {
  const still = hitTest(e.clientX, e.clientY);
  if (!still || still.id !== hit.id) return;
  if (hit.id === 'endturn') {
    if (!state.turn.tileLaid) { showHint('You must lay your tile before ending the turn'); return; }
    hideHint();
    endTurn();
  } else if (hit.id === 'return' && state.sel && state.sel.canReturn && !state.turn.animalMoved) {
    doReturnToken(state.sel.animal);
  } else if (hit.id === 'confirm') {
    hideHint();
    confirmPending();
  } else if (hit.id === 'back') {
    hideHint();
    cancelPending();
  } else if (hit.id === 'rotcw') {
    rotateTile(1);
  } else if (hit.id === 'rotccw') {
    rotateTile(-1);
  }
}

canvas.addEventListener('pointermove', (e) => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (pinch && pointers.size >= 2) {
    updatePinch();
    return;
  }

  if (press && press.id === e.pointerId) {
    press.moved = Math.max(press.moved, Math.hypot(e.clientX - press.x, e.clientY - press.y));
  }

  if (state.tokenDrag) {
    state.tokenDrag.x = e.clientX;
    state.tokenDrag.y = e.clientY;
    return;
  }

  const held = state.held;
  if (held && held.dragging && held.pointerId === e.pointerId) {
    held.x = e.clientX + held.grabDX;
    held.y = e.clientY + held.grabDY;
    updateHover();
    return;
  }

  if (panning && panning.id === e.pointerId) {
    const dx = e.clientX - panning.x;
    const dy = e.clientY - panning.y;
    state.camera.x -= dx / state.camera.scale;
    state.camera.y -= dy / state.camera.scale;
    panning.x = e.clientX;
    panning.y = e.clientY;
  }
});

function endPointer(e) {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinch = null;
  const tap = !!press && press.id === e.pointerId && press.moved < 8;

  const held = state.held;
  if (state.tokenDrag) {
    resolveTokenDrop(tap);
  } else if (held && held.dragging && held.pointerId === e.pointerId) {
    held.dragging = false;
    const h = hexAtScreen(held.x, held.y);
    const overUi = held.y > trayTop();
    if (!overUi && isValidTarget(h.q, h.r)) {
      setPending(h.q, h.r);
    } else {
      returnHeld();
    }
    state.hoverKey = null;
  } else if (tap && press.hit) {
    fireButton(press.hit, e);
  } else if (tap && state.mode === 'playing' && !state.turn.animalMoved) {
    tapBoard(e);
  }

  if (panning && panning.id === e.pointerId) panning = null;
  if (press && press.id === e.pointerId) press = null;
}

canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);

function returnHeld() {
  const held = state.held;
  if (!held) return;
  const home = heldHome();
  held.returning = {
    start: performance.now(),
    fromX: held.x, fromY: held.y,
    toX: home.x, toY: home.y,
  };
  showHint('Tiles must touch the land already on the board');
}

function updateHover() {
  const held = state.held;
  if (!held || !held.dragging) { state.hoverKey = null; return; }
  const overUi = held.y > trayTop();
  const h = hexAtScreen(held.x, held.y);
  state.hoverKey = (!overUi && isValidTarget(h.q, h.r)) ? key(h.q, h.r) : null;
}

canvas.addEventListener('wheel', (e) => {
  if (state.mode !== 'playing') return;
  e.preventDefault();
  zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0016));
}, { passive: false });

function zoomAt(sx, sy, factor) {
  const before = screenToWorld(sx, sy);
  state.camera.scale = Math.max(0.42, Math.min(2.2, state.camera.scale * factor));
  const after = screenToWorld(sx, sy);
  state.camera.x += before.x - after.x;
  state.camera.y += before.y - after.y;
}

function startPinch() {
  const pts = [...pointers.values()];
  pinch = {
    dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
    cx: (pts[0].x + pts[1].x) / 2,
    cy: (pts[0].y + pts[1].y) / 2,
  };
  panning = null;
  state.tokenDrag = null;
  if (state.held && state.held.dragging) {
    state.held.dragging = false;
    state.hoverKey = null;
    const home = heldHome();
    state.held.returning = {
      start: performance.now(),
      fromX: state.held.x, fromY: state.held.y,
      toX: home.x, toY: home.y,
    };
  }
}

function updatePinch() {
  const pts = [...pointers.values()];
  const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  const cx = (pts[0].x + pts[1].x) / 2;
  const cy = (pts[0].y + pts[1].y) / 2;
  if (pinch.dist > 0) zoomAt(cx, cy, dist / pinch.dist);
  state.camera.x -= (cx - pinch.cx) / state.camera.scale;
  state.camera.y -= (cy - pinch.cy) / state.camera.scale;
  pinch = { dist, cx, cy };
}

/* ------------------------------------------------------------------ *
 * UI wiring
 * ------------------------------------------------------------------ */

const hudEl = document.getElementById('hud');
const hintEl = document.getElementById('hint');
let hintTimer = null;

function positionHint() {
  hintEl.style.bottom = (H - trayTop() + 12) + 'px';
}

function showHint(text, ms = 2200) {
  hintEl.textContent = text;
  positionHint();
  hintEl.classList.remove('hidden');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => hintEl.classList.add('hidden'), ms);
}

function hideHint() {
  clearTimeout(hintTimer);
  hintEl.classList.add('hidden');
}

function tilesLeft() {
  return state.deck.length + state.choices.length +
    (state.held ? 1 : 0) + (state.pending ? 1 : 0);
}

function syncHud() {
  document.getElementById('deckCount').textContent = String(tilesLeft());
  const color = PLAYER_COLORS[state.current % PLAYER_COLORS.length];
  const chip = document.getElementById('turnChip');
  chip.style.background = color;
  chip.style.color = color;
  const who = state.players === 1 ? 'You' : 'Player ' + (state.current + 1);
  const pts = state.scores[state.current] || 0;
  document.getElementById('turnText').textContent = who + ' \u00b7 ' + pts + ' pts';
  const step = document.getElementById('phaseText');
  if (step) {
    const t = state.turn;
    step.textContent = !t.tileLaid
      ? (t.animalMoved ? 'Lay your tile' : 'Lay a tile')
      : 'Animal optional';
  }
}

function buildPlayerPicker() {
  const wrap = document.getElementById('playerPicker');
  wrap.innerHTML = '';
  for (let n = 1; n <= 6; n++) {
    const b = document.createElement('button');
    b.className = 'pcount' + (n === state.players ? ' active' : '');
    b.textContent = String(n);
    b.addEventListener('click', () => {
      state.players = n;
      [...wrap.children].forEach((c, i) => c.classList.toggle('active', i === n - 1));
    });
    wrap.appendChild(b);
  }
}

function buildLegend(el, counts) {
  el.innerHTML = '';
  for (const type of TYPE_KEYS) {
    const item = document.createElement('div');
    item.className = 'legend-item';
    const cv = document.createElement('canvas');
    cv.width = 104;
    cv.height = 90;
    const c = cv.getContext('2d');
    drawTileArt(c, { types: [type], variant: 0, rot: 0, sides: 0 },
      cv.width / 2, cv.height / 2, cv.width * 0.46);
    item.appendChild(cv);
    const label = document.createElement('span');
    label.textContent = TYPES[type].name;
    item.appendChild(label);
    if (counts) {
      const b = document.createElement('b');
      // Mixed tiles count for both their terrains, so these overlap.
      b.textContent = counts[type] + ' tiles';
      item.appendChild(b);
    }
    el.appendChild(item);
  }
}

// The title screen shows what a split tile looks like from each half.
function buildSplitRow() {
  const el = document.getElementById('splitRow');
  if (!el) return;
  el.innerHTML = '';
  for (const mix of [['water', 'rock'], ['rock', 'grass'], ['grass', 'dirt']]) {
    const item = document.createElement('div');
    item.className = 'legend-item';
    const cv = document.createElement('canvas');
    cv.width = 104;
    cv.height = 90;
    const c = cv.getContext('2d');
    const tile = { types: mix, variant: 0, rot: 4, sides: HALF };
    drawTileArt(c, tile, cv.width / 2, cv.height / 2, cv.width * 0.46);
    drawTypePips(c, tile, cv.width / 2, cv.height / 2, cv.width * 0.46);
    item.appendChild(cv);
    const label = document.createElement('span');
    label.textContent = TYPES[mix[0]].name + ' / ' + TYPES[mix[1]].name;
    item.appendChild(label);
    el.appendChild(item);
  }
}

// The title screen shows the four special tiles and what each one brings.
function buildSpecialRow() {
  const el = document.getElementById('specialRow');
  if (!el) return;
  el.innerHTML = '';
  for (const sp of SPECIALS) {
    const item = document.createElement('div');
    item.className = 'legend-item';
    const cv = document.createElement('canvas');
    cv.width = 104;
    cv.height = 90;
    const c = cv.getContext('2d');
    const tile = { types: [sp.type], variant: 0, rot: 0, sides: 0, special: sp.animal };
    drawTileArt(c, tile, cv.width / 2, cv.height / 2, cv.width * 0.46);
    drawSpecialMark(c, tile, cv.width / 2, cv.height / 2, cv.width * 0.46);
    item.appendChild(cv);
    const label = document.createElement('span');
    label.textContent = sp.name;
    item.appendChild(label);
    const b = document.createElement('b');
    b.textContent = ANIMALS[sp.animal].name;
    item.appendChild(b);
    el.appendChild(item);
  }
}

/* Display options live in localStorage, so a preference survives a refresh
 * rather than needing setting every game. */
const OWNERS_KEY = 'hexlands-show-owners';

function buildOptions() {
  const box = document.getElementById('ownerToggle');
  if (!box) return;
  let saved = null;
  try { saved = localStorage.getItem(OWNERS_KEY); } catch (err) { /* private mode */ }
  state.showOwners = saved === 'on';
  box.checked = state.showOwners;
  box.addEventListener('change', () => {
    state.showOwners = box.checked;
    try { localStorage.setItem(OWNERS_KEY, box.checked ? 'on' : 'off'); } catch (err) { /* ignore */ }
  });
}

function buildDrawPicker() {
  const wrap = document.getElementById('drawPicker');
  if (!wrap) return;
  wrap.innerHTML = '';
  for (const n of DRAW_CHOICES) {
    const b = document.createElement('button');
    b.className = 'pcount' + (n === state.drawCount ? ' active' : '');
    b.textContent = String(n);
    b.addEventListener('click', () => {
      state.drawCount = n;
      [...wrap.children].forEach((c) => c.classList.toggle('active', c === b));
    });
    wrap.appendChild(b);
  }
}

function showFinalCounts() {
  const counts = { water: 0, rock: 0, grass: 0, dirt: 0 };
  for (const tile of state.board.values()) {
    for (const type of tile.types) counts[type]++;
  }
  buildLegend(document.getElementById('finalCounts'), counts);
}

function buildAnimalRow() {
  const wrap = document.getElementById('animalRow');
  wrap.innerHTML = '';
  let i = 0;
  for (const tier of TIER_ORDER) {
    const group = document.createElement('div');
    group.className = 'tier-group';
    group.style.setProperty('--tier', TIERS[tier].color);

    const head = document.createElement('b');
    head.textContent = TIERS[tier].name;
    group.appendChild(head);

    const row = document.createElement('div');
    row.className = 'tier-animals';
    for (const animal of animalsInTier(tier)) {
      const item = document.createElement('div');
      const cv = document.createElement('canvas');
      cv.width = 80;
      cv.height = 80;
      drawToken(cv.getContext('2d'), animal, 40, 40, 72,
        PLAYER_COLORS[i++ % PLAYER_COLORS.length], { shadow: false });
      item.appendChild(cv);
      const label = document.createElement('span');
      label.textContent = ANIMALS[animal].name;
      item.appendChild(label);
      row.appendChild(item);
    }
    group.appendChild(row);
    wrap.appendChild(group);
  }
}

function showScoreboard() {
  const el = document.getElementById('scoreboard');
  el.innerHTML = '';
  const best = Math.max(...state.scores);
  const rows = state.scores
    .map((pts, player) => ({ pts, player }))
    .sort((a, b) => b.pts - a.pts);
  for (const row of rows) {
    const div = document.createElement('div');
    div.className = 'score-row' + (row.pts === best && best > 0 ? ' win' : '');
    div.innerHTML =
      '<span class="chip"></span>' +
      '<span class="who"></span>' +
      '<span class="crown"></span>' +
      '<span class="pts"></span>';
    div.querySelector('.chip').style.background =
      PLAYER_COLORS[row.player % PLAYER_COLORS.length];
    div.querySelector('.who').textContent =
      state.players === 1 ? 'You' : 'Player ' + (row.player + 1);
    div.querySelector('.crown').textContent =
      row.pts === best && best > 0 && rows.filter((r) => r.pts === best).length === 1 ? 'WINNER' : '';
    div.querySelector('.pts').textContent = row.pts + ' pts';
    el.appendChild(div);
  }
}

function showTitle() {
  state.mode = 'title';
  state.held = null;
  document.getElementById('title').classList.remove('hidden');
  document.getElementById('gameover').classList.add('hidden');
  hudEl.classList.add('hidden');
  hideHint();
}

function beginGame() {
  document.getElementById('title').classList.add('hidden');
  document.getElementById('gameover').classList.add('hidden');
  hudEl.classList.remove('hidden');
  startGame(state.players);
  showHint('Drag the tile anywhere to start the land', 3000);
}

/* ------------------------------------------------------------------ *
 * Boot
 * ------------------------------------------------------------------ */

buildSprites();

const cardProblems = validateCards();
if (cardProblems.length) {
  console.warn('Card rules violated:\n  ' + cardProblems.join('\n  '));
}

buildPlayerPicker();
buildLegend(document.getElementById('legend'), null);
buildSplitRow();
buildSpecialRow();
buildDrawPicker();
buildOptions();
buildAnimalRow();

for (const id of ['hudVersion', 'titleVersion', 'overVersion']) {
  document.getElementById(id).textContent = 'v' + VERSION;
}

document.getElementById('startBtn').addEventListener('click', beginGame);
document.getElementById('againBtn').addEventListener('click', beginGame);
document.getElementById('titleBtn').addEventListener('click', showTitle);
document.getElementById('menuBtn').addEventListener('click', showTitle);

// Exposed for debugging and automated smoke tests.
window.__state = state;
window.__version = VERSION;
window.__lay = handLayout;
window.__pendLay = pendingLayout;
window.__debug = {
  placeTile, isValidTarget, hexToPixel, HEX_SIZE, endTurn,
  selectAnimal, placementSpots, moveSpots, canReturn, myToken, refreshReady,
  recomputeValid, spendAnimalMove, cancelPending, confirmPending, setPending,
  chooseTile, summonOnSpecial, SPECIALS, terrainOnSide, isOverlay,
  doPlaceToken, doMoveToken, doReturnToken, matchPattern, cellSatisfied,
};

/* ------------------------------------------------------------------ *
 * Update check
 *
 * GitHub Pages serves this page with a ten minute cache, so a phone will
 * happily show yesterday's build after a refresh. version.json is fetched
 * with caching disabled; when it names a version newer than the one baked
 * into this script, the page reloads itself at a URL the cache has never
 * seen. The session guard means a mismatch can never cause a reload loop.
 * ------------------------------------------------------------------ */

async function checkForUpdate() {
  try {
    const res = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return;
    const latest = (await res.json()).version;
    if (!latest || latest === VERSION) return;
    if (sessionStorage.getItem('hexlands-update') === latest) return;
    sessionStorage.setItem('hexlands-update', latest);
    const url = new URL(location.href);
    url.searchParams.set('v', latest);
    location.replace(url.toString());
  } catch (err) {
    // Offline, or opened straight off the file system. Nothing to do.
  }
}

checkForUpdate();

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 120));
resize();
requestAnimationFrame(render);
