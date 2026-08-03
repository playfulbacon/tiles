/* Hex Lands - a turn based hex tile laying game.
 * Draw a tile from the deck, drag it onto the board, connect it to the land. */

const VERSION = '0.1.0';

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
  players: 2,
  current: 0,
  deck: [],
  board: new Map(),     // "q,r" -> { q, r, type, variant, owner, placedAt }
  held: null,           // { type, variant, x, y, dragging, homeX, homeY, ... }
  valid: new Set(),
  camera: { x: 0, y: 0, scale: 1 },
  hoverKey: null,
  placedCount: { water: 0, rock: 0, grass: 0, dirt: 0 },
  lastPlaced: null,
};

let W = 0, H = 0, DPR = 1;
const HEX_SIZE = 54;         // world size of a board hex
const DECK_SIZE = 40;        // screen size of the deck / held tile

function deckAnchor() {
  const bottom = H - 22 - safeBottom();
  return { x: W / 2, y: bottom - DECK_SIZE * SQRT3 / 2 };
}

function heldHome() {
  const d = deckAnchor();
  return { x: d.x, y: d.y - DECK_SIZE * SQRT3 - 34 };
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
  state.current = (state.current + 1) % state.players;
  drawTile();
}

function endGame() {
  state.mode = 'gameover';
  state.held = null;
  showFinalCounts();
  document.getElementById('gameover').classList.remove('hidden');
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('hint').classList.add('hidden');
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
  return H - DECK_SIZE * 4.8 - safeBottom();
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
  ctx.font = '700 15px "Avenir Next", "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(state.deck.length), d.x, d.y - stack * 3.5 + 1);
  ctx.font = '600 8.5px "Avenir Next", "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = 'rgba(147,166,181,0.9)';
  ctx.fillText('DECK', d.x, d.y - stack * 3.5 + 16);
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
  const size = DECK_SIZE * (held.dragging ? 1.12 : 0.86 + 0.14 * appear);

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

  if (!held.dragging && !held.returning) {
    ctx.save();
    ctx.fillStyle = 'rgba(234,241,246,0.55)';
    ctx.font = '700 10px "Avenir Next", "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.letterSpacing = '1px';
    ctx.fillText(TYPES[held.type].name.toUpperCase(), held.x, held.y + bob + size * SQRT3 / 2 + 15);
    ctx.restore();
  }
}

function render(now) {
  drawBackground();
  if (state.mode === 'playing' || state.mode === 'gameover') {
    drawBoard(now);
    drawTargets(now);
  }
  if (state.mode === 'playing') {
    drawTray();
    drawDeck(now);
    drawHeld(now);
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
  const size = DECK_SIZE * 1.25;
  return Math.hypot(x - held.x, y - held.y) <= size;
}

function pointInDeck(x, y) {
  const d = deckAnchor();
  return Math.hypot(x - d.x, y - d.y) <= DECK_SIZE * 1.2;
}

canvas.addEventListener('pointerdown', (e) => {
  if (state.mode !== 'playing') return;
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (pointers.size === 2) {
    startPinch();
    return;
  }

  const held = state.held;
  if (held && !held.dragging && (pointInHeld(e.clientX, e.clientY) || pointInDeck(e.clientX, e.clientY))) {
    held.returning = null;
    held.dragging = true;
    held.pointerId = e.pointerId;
    // Grab from the tile centre so the tile sits under the finger.
    held.grabDX = 0;
    held.grabDY = pointInDeck(e.clientX, e.clientY) ? -DECK_SIZE * 0.5 : 0;
    held.x = e.clientX + held.grabDX;
    held.y = e.clientY + held.grabDY;
    updateHover();
    hideHint();
    return;
  }

  panning = { id: e.pointerId, x: e.clientX, y: e.clientY };
});

canvas.addEventListener('pointermove', (e) => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (pinch && pointers.size >= 2) {
    updatePinch();
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

  const held = state.held;
  if (held && held.dragging && held.pointerId === e.pointerId) {
    held.dragging = false;
    const h = hexAtScreen(held.x, held.y);
    const overUi = held.y > trayTop();
    if (!overUi && isValidTarget(h.q, h.r)) {
      placeTile(h.q, h.r);
    } else {
      returnHeld();
    }
    state.hoverKey = null;
  }
  if (panning && panning.id === e.pointerId) panning = null;
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
  document.getElementById('turnText').textContent =
    state.players === 1 ? 'Your turn' : 'Player ' + (state.current + 1);
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
buildPlayerPicker();
buildLegend(document.getElementById('legend'), null);

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
window.__debug = { placeTile, isValidTarget, hexToPixel, HEX_SIZE };

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 120));
resize();
requestAnimationFrame(render);
