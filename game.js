/* Hex Lands - a turn based hex tile laying game.
 * Draw a tile from the deck, drag it onto the board, connect it to the land. */

const VERSION = '0.5.0';

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
const COPIES_PER_TYPE = 15;
const VARIANTS = 3;

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
    for (let v = 0; v < VARIANTS; v++) {
      sprites[type].push(makeSprite(type, v));
    }
  }
}

function makeSprite(type, variant) {
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
  const t = TYPES[type];
  const rand = makeRng(hashString(type + ':' + variant) || 7);

  c.save();
  traceHex(c, cx, cy, R);
  c.clip();

  // Base fill with a soft top light.
  const g = c.createLinearGradient(0, cy - R, 0, cy + R);
  g.addColorStop(0, t.top);
  g.addColorStop(1, t.base);
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);

  if (type === 'water') paintWater(c, cx, cy, R, t, rand);
  else if (type === 'rock') paintRock(c, cx, cy, R, t, rand);
  else if (type === 'grass') paintGrass(c, cx, cy, R, t, rand);
  else paintDirt(c, cx, cy, R, t, rand);

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
  c.strokeStyle = t.ink;
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
  placedCount: { water: 0, rock: 0, grass: 0, dirt: 0 },
  lastPlaced: null,
  tokens: new Map(),    // "player:animal" -> { player, animal, at }
  tokenAt: new Map(),   // "q,r" -> token
  scores: [],
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
  for (const type of TYPE_KEYS) {
    for (let i = 0; i < COPIES_PER_TYPE; i++) {
      deck.push({ type, variant: Math.floor(Math.random() * VARIANTS) });
    }
  }
  // Fisher-Yates.
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
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
  state.placedCount = { water: 0, rock: 0, grass: 0, dirt: 0 };
  state.camera = { x: 0, y: 0, scale: 1 };
  state.turn = { tileLaid: false, animalMoved: false };
  state.sel = null;
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
  const card = state.deck.pop();
  const home = heldHome();
  state.held = {
    type: card.type,
    variant: card.variant,
    x: home.x,
    y: home.y,
    dragging: false,
    grabDX: 0,
    grabDY: 0,
    bornAt: performance.now(),
    returning: null,
  };
  recomputeValid();
  syncHud();
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
  if (state.board.has(key(q, r))) return false;
  if (state.board.size === 0) return true;
  return state.valid.has(key(q, r));
}

function placeTile(q, r) {
  const held = state.held;
  state.board.set(key(q, r), {
    q, r,
    type: held.type,
    variant: held.variant,
    owner: state.current,
    placedAt: performance.now(),
  });
  state.placedCount[held.type]++;
  state.lastPlaced = key(q, r);
  state.held = null;
  state.turn.tileLaid = true;
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
  state.tokenDrag = null;
  state.current = (state.current + 1) % state.players;
  if (!state.deck.length) endGame();
  else drawTile();
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
function cellSatisfied(q, r, req) {
  if (req.tile) {
    const tile = state.board.get(key(q, r));
    return !!tile && (req.tile === 'any' || tile.type === req.tile);
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

function drawSprite(type, variant, cx, cy, size, alpha) {
  const sp = sprites[type][variant % VARIANTS];
  const scale = size / SPRITE_R;
  const w = sp.width * scale;
  const h = sp.height * scale;
  if (alpha != null) ctx.globalAlpha = alpha;
  ctx.drawImage(sp, cx - w / 2, cy - h / 2, w, h);
  ctx.globalAlpha = 1;
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
    drawSprite(tile.type, tile.variant, s.x, s.y, size * grow);
    ctx.restore();

    // Owner pip.
    if (state.players > 1) {
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
  const remaining = state.deck.length + (state.held ? 1 : 0);
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
  ctx.fillText(String(state.deck.length), d.x, d.y - stack * 3);
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
    drawSprite(held.type, held.variant, s.x, s.y, HEX_SIZE * state.camera.scale, 0.55);
  }

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = held.dragging ? 26 : 14;
  ctx.shadowOffsetY = held.dragging ? 12 : 5;
  drawSprite(held.type, held.variant, held.x, held.y + bob, size);
  ctx.restore();

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
  const detailH = 92;
  const detailY = rowY - 8 - detailH;
  return {
    n, gap, cw, ch, railY, rowY, rowH, detailY, detailH,
    startX: (W - (cw * n + gap * (n - 1))) / 2,
    btnW: Math.min(150, W * 0.42),
    btnH: 32,
    top: (state.sel ? detailY : rowY) - 12,
  };
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
      // An animal requirement, tinted by the tier it belongs to.
      const tint = req.token ? TIERS[ANIMALS[req.token].tier].color
        : (req.tier ? TIERS[req.tier].color : '#c9d9e6');
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
  const tier = TIERS[a.tier];
  ctx.font = font('800 9px');
  ctx.fillStyle = tier.color;
  ctx.fillText(tier.name.toUpperCase(), x + 20 + nameW, y + 20);
  ctx.font = font('500 11px');
  ctx.fillStyle = '#93a6b5';
  ctx.fillText(a.blurb, x + 20 + nameW + ctx.measureText(tier.name.toUpperCase()).width + 12, y + 20);

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
  if (!state.turn.tileLaid) {
    drawHeld(now);
    pushHit('tile', 4, lay.rowY, heldHome().x + HAND_TILE + 8, lay.rowH);
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
    const msg = !state.turn.tileLaid
      ? 'Play the tile'
      : (state.turn.animalMoved ? 'Turn done' : 'Animal optional');
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

    // Tier bar: short for early, full width for late.
    const tier = TIERS[ANIMALS[animal].tier];
    const barW = (lay.cw - 20) * (0.4 + 0.3 * tier.rank);
    roundRect(x + 10, y + 6, barW, 3, 1.5);
    ctx.fillStyle = tier.color;
    ctx.globalAlpha = selected ? 1 : 0.75;
    ctx.fill();
    ctx.globalAlpha = 1;

    const cx = x + lay.cw / 2;
    if (token.at) {
      // Piece is out on the land: show an empty slot on the card.
      traceHex(ctx, cx, y + 26, 14);
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fill();
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(160,235,255,0.55)';
      ctx.stroke();
      ctx.setLineDash([]);
      drawGlyph(ctx, animal, cx, y + 26, 19, 'rgba(200,220,235,0.30)');
    } else {
      drawToken(ctx, animal, cx, y + 26, 30, color, { shadow: false });
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

function drawDraggedToken(now) {
  const d = state.tokenDrag;
  if (!d) return;
  const color = PLAYER_COLORS[state.current % PLAYER_COLORS.length];
  const size = HEX_SIZE * state.camera.scale * 0.72;
  drawToken(ctx, d.animal, d.x, d.y - 14, size, color, {});
}

function render(now) {
  hits = [];
  drawBackground();
  if (state.mode === 'playing' || state.mode === 'gameover') {
    drawBoard(now);
    drawTargets(now);
    drawTokenTargets(now);
    drawTokensOnBoard(now);
    drawFlashes(now);
  }
  if (state.mode === 'playing') {
    drawHand(now);
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

canvas.addEventListener('pointerdown', (e) => {
  if (state.mode !== 'playing') return;
  canvas.setPointerCapture(e.pointerId);
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
      placeTile(h.q, h.r);
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

function showHint(text, ms = 2200) {
  hintEl.textContent = text;
  hintEl.style.bottom = (H - trayTop() + 12) + 'px';
  hintEl.classList.remove('hidden');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => hintEl.classList.add('hidden'), ms);
}

function hideHint() {
  clearTimeout(hintTimer);
  hintEl.classList.add('hidden');
}

function syncHud() {
  document.getElementById('deckCount').textContent = String(state.deck.length);
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
    const sp = sprites[type][0];
    c.drawImage(sp, 0, 0, cv.width, cv.height);
    item.appendChild(cv);
    const label = document.createElement('span');
    label.textContent = TYPES[type].name;
    item.appendChild(label);
    if (counts) {
      const b = document.createElement('b');
      b.textContent = counts[type] + ' placed';
      item.appendChild(b);
    }
    el.appendChild(item);
  }
}

function showFinalCounts() {
  buildLegend(document.getElementById('finalCounts'), state.placedCount);
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
window.__debug = {
  placeTile, isValidTarget, hexToPixel, HEX_SIZE, endTurn,
  selectAnimal, placementSpots, moveSpots, canReturn, myToken, refreshReady,
  recomputeValid, spendAnimalMove,
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
