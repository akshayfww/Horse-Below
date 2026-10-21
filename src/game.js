import { LOCATIONS, WORLD, SPAWN } from './locations.js';
const TAU = Math.PI * 2, T = 8, COLS = WORLD.w / T, ROWS = WORLD.h / T, SPEED = 95;
const EDGES = [[0,1],[1,2],[2,3],[0,4],[1,5],[4,5],[5,6],[3,6],[4,7],[5,8],[6,9],[7,8],[8,9]];
const hash = (x, y) => { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const segDist = (px, py, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay; let t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy); t = Math.max(0, Math.min(1, t)); return Math.hypot(px - ax - t * dx, py - ay - t * dy); };

// Precomputed ground info: nearest landmark, distance, path mask
const nearest = new Int8Array(COLS * ROWS), nearD = new Float32Array(COLS * ROWS), onPath = new Uint8Array(COLS * ROWS);
for (let ty = 0; ty < ROWS; ty++) for (let tx = 0; tx < COLS; tx++) {
  const i = ty * COLS + tx, wx = tx * T + 4, wy = ty * T + 4; let bi = 0, bd = 1e9;
  LOCATIONS.forEach((l, k) => { const d = Math.hypot(wx - l.x, wy - l.y); if (d < bd) { bd = d; bi = k; } });
  nearest[i] = bi; nearD[i] = bd; let pd = 1e9;
  for (const [a, b] of EDGES) pd = Math.min(pd, segDist(wx, wy, LOCATIONS[a].x, LOCATIONS[a].y, LOCATIONS[b].x, LOCATIONS[b].y));
  onPath[i] = pd < 9 || (pd < 12 && hash(tx, ty) > 0.5) ? 1 : 0;
}
const rocks = [], decor = [];
for (let i = 0; i < 500 && rocks.length < 36; i++) {
  const x = hash(i, 11) * (WORLD.w - 120) + 60, y = hash(i, 23) * (WORLD.h - 120) + 60;
  if (LOCATIONS.some((l) => Math.hypot(x - l.x, y - l.y) < 160)) continue;
  if (EDGES.some(([a, b]) => segDist(x, y, LOCATIONS[a].x, LOCATIONS[a].y, LOCATIONS[b].x, LOCATIONS[b].y) < 42)) continue;
  if (Math.hypot(x - SPAWN.x, y - SPAWN.y) < 90) continue;
  rocks.push({ x: Math.round(x), y: Math.round(y), w: 12 + Math.floor(hash(i, 5) * 10), h: 9 + Math.floor(hash(i, 7) * 7) });
}
for (let i = 0; i < 220; i++) {
  const x = hash(i, 91) * WORLD.w, y = hash(i, 93) * WORLD.h;
  if (LOCATIONS.some((l) => Math.hypot(x - l.x, y - l.y) < 70)) continue;
  decor.push({ x, y, h: 8 + Math.floor(hash(i, 95) * 14), col: ['#1f6b57', '#2c7f4e', '#6b3f8f', '#a04b7a'][Math.floor(hash(i, 97) * 4)] });
}
const obstacles = [...LOCATIONS.map((l) => ({ x: l.x + l.obstacle[0], y: l.y + l.obstacle[1], w: l.obstacle[2], h: l.obstacle[3] })), ...rocks];
const bubbles = Array.from({ length: 80 }, (_, i) => ({ x: hash(i, 1) * WORLD.w, y: hash(i, 2) * WORLD.h, s: 1 + Math.floor(hash(i, 3) * 2), sp: 6 + hash(i, 4) * 14, ph: hash(i, 5) * TAU }));
const jellies = Array.from({ length: 7 }, (_, i) => ({ x: hash(i, 41) * WORLD.w, y: hash(i, 42) * WORLD.h, a: hash(i, 43) * TAU, ph: hash(i, 44) * TAU }));

export class Game {
  constructor(canvas, engine, cb) {
    this.cv = canvas; this.c = canvas.getContext('2d'); this.engine = engine; this.cb = cb;
    this.keys = new Set(); this.paused = true; this.t = 0; this.cur = null; this.running = false;
    this.p = { x: SPAWN.x, y: SPAWN.y, rot: 0, phase: 0, moving: false };
    try { this.found = new Set(JSON.parse(localStorage.getItem('horse-below-found') || '[]')); } catch (e) { this.found = new Set(); }
    this.resize(); addEventListener('resize', () => this.resize());
  }
  resize() {
    const S = Math.max(2, Math.round(innerHeight / 300)); this.S = S;
    this.w = this.cv.width = Math.ceil(innerWidth / S); this.h = this.cv.height = Math.ceil(innerHeight / S);
    this.c.imageSmoothingEnabled = false;
  }
  start() { this.paused = false; if (this.running) return; this.running = true; this.last = performance.now(); requestAnimationFrame((n) => this.loop(n)); this.cb.onFound(this.found.size, LOCATIONS.length); }
  hit(x, y, w, h) {
    if (x < 14 || y < 14 || x + w > WORLD.w - 14 || y + h > WORLD.h - 14) return true;
    return obstacles.some((o) => x < o.x + o.w && x + w > o.x && y < o.y + o.h && y + h > o.y);
  }
  loop(now) {
    now = performance.now(); const dt = Math.max(0, Math.min(0.05, (now - this.last) / 1000)); this.last = now; this.t += dt;
    const p = this.p, k = this.keys;
    let dx = (k.has('right') ? 1 : 0) - (k.has('left') ? 1 : 0), dy = (k.has('down') ? 1 : 0) - (k.has('up') ? 1 : 0);
    p.moving = false;
    if (!this.paused && (dx || dy)) {
      const m = Math.hypot(dx, dy); dx /= m; dy /= m;                    // normalised: no faster diagonals
      const nx = p.x + dx * SPEED * dt, ny = p.y + dy * SPEED * dt;
      if (!this.hit(nx - 5, p.y - 2, 10, 7)) p.x = nx;
      if (!this.hit(p.x - 5, ny - 2, 10, 7)) p.y = ny;
      p.moving = true; p.phase += dt * 9;
      p.rot = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : Math.PI) : (dy > 0 ? Math.PI / 2 : -Math.PI / 2);
    }
    this.engine.update(p.x, p.y);
    let inside = null, bd = 1e9;
    for (const l of LOCATIONS) { const d = Math.hypot(p.x - l.x, p.y - l.y); if (d < l.r && d < bd) { bd = d; inside = l; } }
    if (inside !== this.cur) {
      this.cur = inside;
      if (inside && !this.found.has(inside.id)) {
        this.found.add(inside.id);
        try { localStorage.setItem('horse-below-found', JSON.stringify([...this.found])); } catch (e) {}
        this.cb.onFound(this.found.size, LOCATIONS.length);
      }
      this.cb.onLocation(inside);
    }
    this.draw();
    requestAnimationFrame((n) => this.loop(n));
  }
  draw() {
    const c = this.c, t = this.t, w = this.w, h = this.h, p = this.p;
    const cx = Math.round(Math.max(0, Math.min(WORLD.w - w, p.x - w / 2))), cy = Math.round(Math.max(0, Math.min(WORLD.h - h, p.y - h / 2)));
    const px = (x, y, ww, hh, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), ww, hh); };
    const circ = (x, y, r, col) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); };
    const ell = (x, y, rx, ry, col) => { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill(); };
    c.fillStyle = '#030c14'; c.fillRect(0, 0, w, h);
    c.save(); c.translate(-cx, -cy);
    // ground with caustics, region tints and paths
    for (let ty = Math.max(0, Math.floor(cy / T)); ty <= Math.min(ROWS - 1, Math.ceil((cy + h) / T)); ty++)
      for (let tx = Math.max(0, Math.floor(cx / T)); tx <= Math.min(COLS - 1, Math.ceil((cx + w) / T)); tx++) {
        const i = ty * COLS + tx, L = LOCATIONS[nearest[i]], near = nearD[i] < 230, n = hash(tx, ty);
        const cau = Math.sin(tx * 0.4 + t * 0.7) + Math.sin(ty * 0.33 - t * 0.55) + Math.sin((tx + ty) * 0.2 + t * 0.3);
        const base = near ? L.ground[0] : '#0a2638', alt = near ? L.ground[1] : '#0e3047';
        c.fillStyle = onPath[i] ? (n > 0.5 ? '#1b5568' : '#17495b') : (cau > 1.4 || n > 0.9 ? alt : base);
        c.fillRect(tx * T, ty * T, T, T);
      }
    for (const d of decor) { if (d.x < cx - 20 || d.x > cx + w + 20 || d.y < cy - 30 || d.y > cy + h + 20) continue;
      for (let k = 0; k < d.h / 3; k++) px(d.x + Math.sin(t * 0.9 + k * 0.5 + d.x) * k * 0.45, d.y - k * 3, 2, 3, d.col); }
    for (const r of rocks) { if (r.x > cx + w || r.x + r.w < cx || r.y > cy + h || r.y + r.h < cy) continue;
      px(r.x, r.y + 2, r.w, r.h, '#1a3347'); px(r.x, r.y, r.w, r.h - 2, '#2a4d66'); px(r.x + 2, r.y + 1, r.w - 6, 2, '#3f6a86'); }
    const g = { c, t, px, circ, ell, P: p };
    for (const l of LOCATIONS) if (l.x > cx - 120 && l.x < cx + w + 120 && l.y > cy - 120 && l.y < cy + h + 120) DRAW[l.id](g, l.x, l.y);
    // jellies + player
    for (const j of jellies) { const x = j.x + Math.sin(t * 0.2 + j.ph) * 60, y = (j.y + t * 3 * Math.cos(j.a)) % WORLD.h;
      ell(x, y, 6, 4, 'rgba(180,140,255,0.45)'); for (let k = -1; k <= 1; k++) px(x + k * 3 + Math.sin(t * 2 + k) , y + 3, 1, 5 + Math.sin(t * 2 + k + j.ph) * 2, 'rgba(180,140,255,0.35)'); }
    this.drawHorse(g);
    for (const b of bubbles) { const y = ((b.y - t * b.sp) % WORLD.h + WORLD.h) % WORLD.h; px(b.x + Math.sin(t + b.ph) * 4, y, b.s, b.s, 'rgba(170,230,240,0.4)'); }
    c.restore();
    // breathing tint near the giant, vignette
    const gi = LOCATIONS[9], gd = Math.hypot(p.x - gi.x, p.y - gi.y);
    if (gd < 500) { c.fillStyle = `rgba(2,20,10,${(1 - gd / 500) * 0.35 * (0.5 + 0.5 * Math.sin(t * 0.8))})`; c.fillRect(0, 0, w, h); }
    const vg = c.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, h * 0.95); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,5,12,0.65)');
    c.fillStyle = vg; c.fillRect(0, 0, w, h);
  }
  drawHorse({ c, t, px, circ, P }) {
    c.save(); c.translate(Math.round(P.x), Math.round(P.y));
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(0, 3, 13, 7, 0, 0, TAU); c.fill();
    circ(0, 0, 14, 'rgba(255,225,160,0.10)');
    c.rotate(P.rot);
    const sw = P.moving ? Math.round(Math.sin(P.phase * 2) * 2.5) : 0, bob = P.moving ? 0 : Math.round(Math.sin(t * 2) * 0.6);
    px(-7 + sw, -6, 3, 3, '#4a2a18'); px(-7 - sw, 3, 3, 3, '#4a2a18'); px(4 - sw, -6, 3, 3, '#4a2a18'); px(4 + sw, 3, 3, 3, '#4a2a18');
    px(-13, -1 + Math.round(Math.sin(t * 3 + P.phase) * 1.5), 5, 2, '#24120a');           // tail
    px(-8, -4, 16, 8, '#8a5530'); px(-8, -4, 16, 2, '#a56a3c'); px(-3, -4, 6, 8, '#c23b5a'); px(-3, -4, 6, 1, '#ef7090'); // body + blanket
    px(6, -3, 5, 6, '#8a5530'); px(-8, -1, 19, 2, '#2a160c');                                 // neck + mane
    px(10, -3 + bob, 6, 6, '#9c6238'); px(15, -2 + bob, 2, 4, '#d8b58a');                      // head + muzzle
    px(12, -3 + bob, 1, 1, '#000'); px(12, 2 + bob, 1, 1, '#000'); px(10, -5 + bob, 2, 2, '#4a2a18'); px(10, 3 + bob, 2, 2, '#4a2a18');
    c.restore();
  }
}

/* ---------- landmarks: each recognisable by silhouette and palette ---------- */
const DRAW = {
  phone({ c, t, px, circ }, x, y) {
    px(x - 9, y - 15, 18, 30, '#0a2a36'); px(x - 9, y - 15, 18, 2, '#3aa6bd'); px(x - 9, y + 13, 18, 2, '#3aa6bd'); px(x - 9, y - 15, 2, 30, '#3aa6bd'); px(x + 7, y - 15, 2, 30, '#3aa6bd');
    px(x - 6, y - 12, 12, 22, '#1b7288'); px(x - 4, y - 9, 8, 5, '#0a2a36');
    for (let i = 0; i < 6; i++) px(x - 4 + (i % 3) * 3, y + (i > 2 ? 3 : 0), 2, 2, '#e8d27a');
    const sw = Math.sin(t * 1.6) * 3; c.strokeStyle = '#d9c36a'; c.lineWidth = 1; c.beginPath(); c.moveTo(x + 4, y - 2); c.quadraticCurveTo(x + 10 + sw, y + 6, x + 8 + sw * 1.4, y + 14); c.stroke();
    px(x + 6 + sw * 1.4, y + 14, 5, 3, '#d9c36a');
    for (let i = 0; i < 3; i++) circ(x - 6 + i * 6 + Math.sin(t + i) * 2, y - 18 - ((t * 10 + i * 17) % 40), 1.5, 'rgba(180,235,245,0.6)');
  },
  forest({ c, t, px, circ, ell }, x, y) {
    ell(x, y - 18, 42, 10, '#3b2457'); ell(x, y - 20, 37, 7, '#5b3a86');
    for (let i = -3; i <= 3; i++) { const tx = x + i * 11, len = 24 + ((i * 7 + 21) % 5) * 5, sw = Math.sin(t * 0.8 + i) * 1.5;
      px(tx, y - 14, 3, len, '#7a4e9a'); px(tx - 1 + sw, y - 14 + len - 2, 5, 3, '#4a2d6a'); circ(tx + 1.5 + sw, y - 12 + len, 6, '#2f8f6a'); circ(tx + sw, y - 14 + len, 3, '#58c79a'); }
  },
  cathedral({ c, t, px, circ }, x, y) {
    px(x - 44, y - 2, 88, 4, '#d8d4bd'); c.strokeStyle = '#e8e4cf'; c.lineWidth = 3;
    for (let i = 0; i < 6; i++) { const ax = x - 35 + i * 14, hh = 21 - Math.abs(i - 2.5) * 3; c.beginPath(); c.ellipse(ax, y, 4, hh, 0, 0, TAU); c.stroke(); }
    circ(x - 52, y, 9, '#e8e4cf'); px(x - 55, y - 3, 3, 3, '#10243f'); px(x - 55, y + 1, 3, 3, '#10243f');
    for (let i = 0; i < 4; i++) px(x - 20 + i * 14, y - 1, 2, 2, ['#ff7a9c', '#7ad0ff', '#ffe27a', '#9cff7a'][(i + Math.floor(t)) % 4]);
  },
  moon({ c, t, px, circ, ell }, x, y) {
    circ(x, y, 36, '#2d5f7a'); circ(x, y, 34, '#07151f');
    const gr = c.createRadialGradient(x, y, 4, x, y, 62); gr.addColorStop(0, `rgba(200,255,220,${0.4 + 0.15 * Math.sin(t * 1.5)})`); gr.addColorStop(1, 'rgba(200,255,220,0)');
    c.fillStyle = gr; c.fillRect(x - 64, y - 64, 128, 128);
    const mx = x + Math.sin(t * 0.5) * 2, my = y + Math.cos(t * 0.5) * 2;
    circ(mx, my, 18, '#d7f5e0'); circ(mx - 6, my - 4, 4, '#b5d8c2'); circ(mx + 6, my + 5, 5, '#b5d8c2'); circ(mx + 3, my - 8, 2, '#b5d8c2');
    for (let k = 0; k < 2; k++) { const r = 20 + ((t * 8 + k * 8) % 16); c.strokeStyle = `rgba(160,230,220,${1 - (r - 20) / 16})`; c.lineWidth = 1; c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke(); }
  },
  radio({ c, t, px, circ }, x, y) {
    for (let i = 0; i < 9; i++) { const a = i * TAU / 9; circ(x + Math.cos(a) * 28, y + Math.sin(a) * 20 + 4, 7, ['#e0587a', '#f08a4b', '#b24a9c'][i % 3]); }
    px(x - 12, y + 6, 24, 12, '#6b4a3a'); px(x - 9, y + 9, 8, 6, '#2a1a12'); circ(x + 5, y + 12, 3, '#e8d27a');
    px(x - 2, y - 34, 4, 44, '#c8c2a8'); px(x - 10, y - 26, 20, 2, '#c8c2a8'); px(x - 7, y - 18, 14, 2, '#c8c2a8'); px(x - 5, y - 10, 10, 2, '#c8c2a8');
    circ(x, y - 36, 3, Math.sin(t * 4) > 0 ? '#ff4d4d' : '#552222');
    for (let k = 0; k < 3; k++) { const r = (t * 20 + k * 14) % 42; c.strokeStyle = `rgba(255,120,150,${1 - r / 42})`; c.lineWidth = 1; c.beginPath(); c.arc(x, y - 36, r, 0, TAU); c.stroke(); }
  },
  bedroom({ c, t, px, circ, ell }, x, y) {
    ell(x, y + 2, 44, 32, 'rgba(120,90,200,0.18)'); px(x - 14, y - 10, 28, 20, '#d8c9e8'); px(x - 14, y, 28, 10, '#6a5acd'); px(x - 12, y - 8, 10, 6, '#fff'); px(x + 2, y - 8, 10, 6, '#fff'); px(x - 14, y - 12, 28, 2, '#8a5a3a');
    for (let i = 0; i < 4; i++) { const a = t * 0.5 + i * TAU / 4, ox = x + Math.cos(a) * 36, oy = y + Math.sin(a) * 28;
      if (i === 0) { px(ox - 4, oy - 4, 8, 8, '#a0724a'); px(ox - 4, oy - 4, 8, 2, '#c8946a'); }
      else if (i === 1) { circ(ox, oy, 7, 'rgba(255,226,122,0.25)'); circ(ox, oy, 3, '#ffe27a'); }
      else if (i === 2) { px(ox - 5, oy - 3, 10, 6, '#7ac'); px(ox - 3, oy - 1, 6, 2, '#fff'); }
      else { circ(ox, oy, 4, '#e07a7a'); px(ox - 1, oy - 1, 2, 2, '#fff'); } }
  },
  glass({ c, t, px, P }, x, y) {
    const near = Math.hypot(P.x - x, P.y - y) < 130;
    for (let i = 0; i < 10; i++) { const a = i * 2.4, rr = 12 + i * 6, gx = x + Math.cos(a) * rr, gy = y + Math.sin(a) * rr * 0.8, s = 6 + (i % 3) * 3 + (i === 0 ? 6 : 0);
      c.fillStyle = `rgba(150,240,255,${0.22 + 0.18 * Math.sin(t * 2 + i)})`; c.strokeStyle = 'rgba(220,255,255,0.8)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(gx, gy - s); c.lineTo(gx + s * 0.6, gy); c.lineTo(gx, gy + s); c.lineTo(gx - s * 0.6, gy); c.closePath(); c.fill(); c.stroke(); }
    if (near) for (let k = 0; k < 3; k++) { const r = (t * 25 + k * 14) % 42; c.strokeStyle = `rgba(200,255,255,${0.5 * (1 - r / 42)})`; c.beginPath(); c.arc(x, y, 20 + r, 0, TAU); c.stroke(); }
  },
  eyes({ c, t, px, circ, P }, x, y) {
    const offs = [[-28, 8], [-14, -6], [0, 6], [14, -4], [28, 8], [-6, 18], [18, 18]];
    offs.forEach(([ox, oy], i) => { const bx = x + ox, by = y + oy, sw = Math.sin(t + i) * 2, ex = bx + sw, ey = by - 14 - (i % 3) * 3;
      c.strokeStyle = '#4c7a2a'; c.lineWidth = 2; c.beginPath(); c.moveTo(bx, by); c.quadraticCurveTo(bx + sw * 2, by - 8, ex, ey); c.stroke();
      circ(ex, ey, 6, '#eaf2e0'); const a = Math.atan2(P.y - ey, P.x - ex);
      circ(ex + Math.cos(a) * 2.2, ey + Math.sin(a) * 2.2, 3, '#7ae04a'); circ(ex + Math.cos(a) * 2.6, ey + Math.sin(a) * 2.6, 1.5, '#04110a'); });
  },
  playground({ c, t, px, circ }, x, y) {
    px(x - 36, y + 2, 72, 26, '#54401f'); px(x - 34, y + 4, 68, 22, '#6b5428');
    px(x - 24, y - 20, 2, 22, '#c08a3e'); px(x - 8, y - 20, 2, 22, '#c08a3e'); px(x - 24, y - 20, 18, 2, '#c08a3e');
    const a = Math.sin(t * 1.2) * 0.6, sx = x - 15 + Math.sin(a) * 14, sy = y - 20 + Math.cos(a) * 16;
    c.strokeStyle = '#999'; c.lineWidth = 1; c.beginPath(); c.moveTo(x - 22, y - 19); c.lineTo(sx - 3, sy); c.moveTo(x - 10, y - 19); c.lineTo(sx + 3, sy); c.stroke(); px(sx - 4, sy, 8, 2, '#e05a5a');
    c.fillStyle = '#e0a030'; c.beginPath(); c.moveTo(x + 8, y - 14); c.lineTo(x + 32, y - 14); c.lineTo(x + 36, y + 14); c.lineTo(x + 28, y + 14); c.closePath(); c.fill(); px(x + 8, y - 14, 3, 18, '#8a5a1a');
    circ(x + 2, y + 18, 3, '#4a8fd0');
  },
  giant({ c, t, px, circ, ell }, x, y) {
    const b = 0.5 + 0.5 * Math.sin(t * 0.8);
    c.strokeStyle = `rgba(120,220,160,${0.25 * (1 - b)})`; c.lineWidth = 1; c.beginPath(); c.ellipse(x, y, 60 + b * 20, 38 + b * 12, 0, 0, TAU); c.stroke();
    ell(x, y, 46 + 3 * b, 28 + 2 * b, '#2f5a3e'); ell(x, y - 3, 40 + 3 * b, 21 + 2 * b, '#3d7650');
    c.strokeStyle = '#1f3b2a'; c.lineWidth = 2; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(x - 12 + i * 12, y + 12, 9, Math.PI, 0); c.stroke(); }
    for (let i = 0; i < 4; i++) circ(x - 54 + i * 4, y - 10 + i * 8, 5, '#2f5a3e');
    c.strokeStyle = '#0f2418'; c.beginPath(); c.arc(x + 16, y - 8, 7, 0.1, Math.PI - 0.1); c.stroke(); px(x + 11, y - 8, 10, 1, '#0f2418');
    for (let i = 0; i < 3; i++) circ(x + 42 + Math.sin(t + i) * 2, y + 2 - ((t * 9 + i * 10) % 30), 1.5 + b, 'rgba(180,240,200,0.5)');
  },
};
