import { LOCATIONS, byId } from './locations.js';
export const SC = 100;               // game pixels per audio-space unit
const TAU = Math.PI * 2;
const MAX_VOICES = 10;

/* ---------- built-in synthesized placeholder sounds (replace via Ctrl+D) ---------- */
function gen(d, sr, def, c) {
  const n = d.length, f = def.f || 220; let s = 4242 + c * 131;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const add = (t0, fn, dur) => { const i0 = Math.floor(t0 * sr); for (let k = 0; k < dur * sr && i0 + k < n; k++) d[i0 + k] += fn(k / sr); };
  const len = n / sr;
  switch (def.type) {
    case 'ring': for (let i = 0; i < n; i++) { const t = i / sr, p = t % 3; const on = p < 0.4 || (p > 0.5 && p < 0.9);
      d[i] = on ? 0.22 * (Math.sin(TAU * 440 * t) + Math.sin(TAU * 480 * t)) * (0.65 + 0.35 * Math.sin(TAU * 20 * t)) : 0; } break;
    case 'drone': for (let i = 0; i < n; i++) { const t = i / sr;
      d[i] = 0.28 * (Math.sin(TAU * f * t + 0.8 * Math.sin(TAU * 0.2 * t + c)) + 0.5 * Math.sin(TAU * f * 1.5 * t + c)) * (0.65 + 0.35 * Math.sin(TAU * 0.25 * t + c * 0.5)); } break;
    case 'pulse': for (let i = 0; i < n; i++) { const t = i / sr; d[i] = 0.8 * Math.sin(TAU * f * t) * Math.pow(0.5 + 0.5 * Math.sin(TAU * 0.5 * t - Math.PI / 2), 2); } break;
    case 'glide': { let ph = 0; for (let i = 0; i < n; i++) { const t = i / sr; ph += TAU * f * (1 + 0.45 * Math.sin(TAU * 0.125 * t + c * 1.3)) / sr;
      d[i] = 0.3 * (Math.sin(ph) + 0.3 * Math.sin(2 * ph)) * (0.6 + 0.4 * Math.sin(TAU * 0.25 * t + c)); } break; }
    case 'chime': { const sc = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
      for (let t0 = 0.2; t0 < len - 1; t0 += 0.5 + rnd() * 1.1) { const fr = sc[Math.floor(rnd() * 6)]; add(t0, (u) => 0.22 * Math.sin(TAU * fr * u) * Math.exp(-u * 3), 2); } break; }
    case 'bell': { const q = [1, 1.25, 1.5, 1.25, 2, 1.5, 1.25, 1];
      for (let i = 0; i * 0.6 < len - 0.8; i++) add(i * 0.6, (u) => 0.25 * (Math.sin(TAU * f * q[i % 8] * u) + 0.3 * Math.sin(TAU * f * q[i % 8] * 2.76 * u)) * Math.exp(-u * 4), 1.2); break; }
    case 'static': { let lp = 0; for (let i = 0; i < n; i++) { const t = i / sr; lp += 0.15 * ((rnd() * 2 - 1) - lp);
      d[i] = 0.5 * lp * (Math.sin(TAU * 0.5 * t) > -0.2 ? 1 : 0.15) + (Math.sin(TAU * 0.5 * t) > 0.6 ? 0.08 * Math.sin(TAU * (900 + 300 * Math.floor((t * 8) % 4)) * t) : 0); } break; }
    case 'blips': for (let k = 0; k < 14; k++) { const t0 = rnd() * (len - 0.4), fr = f * (0.7 + rnd()); add(t0, (u) => 0.25 * Math.sin(TAU * (fr * u + 1800 * u * u)) * Math.exp(-u * 18), 0.35); } break;
    case 'creak': { let ph = 0; for (let i = 0; i < n; i++) { const t = i / sr; ph += TAU * (f + 70 * Math.sin(TAU * 3 * t)) / sr;
      d[i] = 0.18 * Math.sin(Math.PI * t / len) * (((ph / TAU) % 1) * 2 - 1) * (0.6 + 0.4 * Math.sin(TAU * 1.1 * t)); } break; }
  }
}
export function makeDemo(ctx, def) {
  const sr = ctx.sampleRate, n = Math.floor(sr * (def.len || 6)), ch = def.stereo ? 2 : 1;
  const buf = ctx.createBuffer(ch, n, sr), F = Math.floor(sr * 0.06);
  for (let c = 0; c < ch; c++) {
    const d = buf.getChannelData(c); gen(d, sr, def, c);
    let pk = 0; for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(d[i]));
    const g = pk > 0.7 ? 0.7 / pk : 1;
    for (let i = 0; i < n; i++) { let m = g; if (i < F) m *= i / F; else if (n - i < F) m *= (n - i) / F; d[i] *= m; }
  }
  return buf;
}

/* ---------- engine ---------- */
export class AudioEngine {
  constructor() {
    this.ctx = null; this.cfg = {}; this.user = new Map(); this.demoCache = new Map();
    this.voices = new Map(); this.live = new Set(); this.zone = new Map(); this.pv = null;
    this.onPreviewEnd = () => {};
    for (const l of LOCATIONS) this.cfg[l.id] = { ...l.defaults };
  }
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) throw new Error('Web Audio is not supported in this browser.');
    this.ctx = new AC({ latencyHint: 'interactive' });
    this.master = this.ctx.createGain(); this.master.gain.value = 0.85;
    this.comp = this.ctx.createDynamicsCompressor();       // clipping protection
    this.comp.threshold.value = -14; this.comp.ratio.value = 6; this.comp.attack.value = 0.01; this.comp.release.value = 0.25;
    this.master.connect(this.comp); this.comp.connect(this.ctx.destination);
    const L = this.ctx.listener;
    if (L.forwardX) { L.forwardX.value = 0; L.forwardY.value = 0; L.forwardZ.value = -1; L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0; }
    else L.setOrientation(0, 0, -1, 0, 1, 0);
  }
  async resume() { if (this.ctx && this.ctx.state !== 'running') { try { await this.ctx.resume(); } catch (e) { /* needs gesture */ } } }
  setConfig(id, c) { this.cfg[id] = { ...byId(id).defaults, ...c }; }
  setUser(id, buf) { buf ? this.user.set(id, buf) : this.user.delete(id); }
  demo(id) { if (!this.demoCache.has(id)) this.demoCache.set(id, makeDemo(this.ctx, byId(id).demo)); return this.demoCache.get(id); }
  buf(id) { return this.user.get(id) || (this.cfg[id].useDemo ? this.demo(id) : null); }
  async decode(file) {
    if (file.size > 80 * 1024 * 1024) throw new Error('File is larger than 80 MB.');
    const ab = await file.arrayBuffer();
    try { const b = await this.ctx.decodeAudioData(ab); if (!b.duration) throw 0; return b; }
    catch (e) { throw new Error(`"${file.name || 'file'}" could not be decoded by this browser. Try WAV, MP3, OGG or M4A.`); }
  }
  get playing() { return this.live.size; }

  mkPanner(c, x, z, rolloff) {
    const p = this.ctx.createPanner();
    p.panningModel = 'HRTF'; p.distanceModel = 'linear';
    const max = c.radius / SC; p.maxDistance = max; p.refDistance = Math.min(0.6, max * 0.4);
    p.rolloffFactor = rolloff; p.coneInnerAngle = 360;
    this.place(p, x, 0, z); return p;
  }
  place(p, x, y, z) {
    if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; } else p.setPosition(x, y, z);
  }
  voice(buf, c, build, loop) {
    const ctx = this.ctx, now = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = loop;
    const fade = ctx.createGain(); fade.gain.setValueAtTime(0, now);
    fade.gain.setTargetAtTime(c.volume, now, Math.max(0.02, c.fade / 3));   // smooth fade-in, no clicks
    const extra = build(src, fade);
    fade.connect(this.master);
    const v = { src, fade, ...extra }; this.live.add(v);
    src.onended = () => { try { fade.disconnect(); } catch (e) {} this.live.delete(v); for (const [k, x] of this.voices) if (x === v) this.voices.delete(k); };
    src.start(); return v;
  }
  start(loc) {
    const c = this.cfg[loc.id], buf = this.buf(loc.id);
    if (!buf || this.live.size >= MAX_VOICES) return;
    const v = this.voice(buf, c, (src, fade) => {
      if (c.mode === 'stereo') {       // keep the recording's own stereo/binaural image
        const sp = this.ctx.createStereoPanner(); sp.pan.value = c.pan; const dist = this.ctx.createGain(); dist.gain.value = 0;
        src.connect(sp); sp.connect(dist); dist.connect(fade); return { dist };
      }
      const p = this.mkPanner(c, (loc.x + c.offsetX) / SC, loc.y / SC, c.proximity ? 1 : 0.4);
      src.connect(p); p.connect(fade); return { panner: p };
    }, c.behavior === 'loop');
    this.voices.set(loc.id, v);
  }
  kill(v, f) {
    const t = this.ctx.currentTime; v.fade.gain.cancelScheduledValues(t);
    v.fade.gain.setValueAtTime(v.fade.gain.value, t); v.fade.gain.setTargetAtTime(0, t, Math.max(0.015, f / 4));
    try { v.src.stop(t + f + 0.2); } catch (e) {}
  }
  stop(id, f) { const v = this.voices.get(id); if (!v) return; this.voices.delete(id); this.kill(v, f); }
  refresh(id) { this.stop(id, 0.15); this.zone.set(id, false); }

  update(px, py) {
    if (!this.ctx) return;
    const L = this.ctx.listener, t = this.ctx.currentTime;
    // Listener sits on the horse. Screen x -> audio x (right), screen y -> audio z (down = behind).
    if (L.positionX) { L.positionX.value = px / SC; L.positionY.value = 0; L.positionZ.value = py / SC; } else L.setPosition(px / SC, 0, py / SC);
    for (const loc of LOCATIONS) {
      const c = this.cfg[loc.id], d = Math.hypot(px - loc.x, py - loc.y), v = this.voices.get(loc.id);
      if (c.behavior === 'loop') {
        if (!v && d < c.radius) this.start(loc);
        else if (v && d > c.radius * 1.05 && !c.continueAfterLeave) this.stop(loc.id, c.fade);
      } else {
        const inZ = d < loc.r;
        if (inZ && !this.zone.get(loc.id) && !v) this.start(loc);
        this.zone.set(loc.id, inZ);
      }
      const cur = this.voices.get(loc.id);
      if (cur && cur.dist) {
        const g = c.proximity ? Math.pow(Math.max(0, 1 - d / c.radius), 1.5) : (d < c.radius ? 1 : 0);
        cur.dist.gain.setTargetAtTime(g, t, 0.08);
      }
    }
  }

  /* editor preview: one voice, spatial mode sweeps left<->right so the HRTF movement is audible */
  preview(buf, c) {
    this.stopPreview(); if (!buf) return;
    const loop = c.behavior === 'loop'; let timer = 0;
    const v = this.voice(buf, { ...c, fade: 0.1 }, (src, fade) => {
      if (c.mode === 'stereo') { const sp = this.ctx.createStereoPanner(); sp.pan.value = c.pan; src.connect(sp); sp.connect(fade); return {}; }
      const p = this.ctx.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.rolloffFactor = 0;
      this.place(p, c.offsetX / SC, 0, -1.2); src.connect(p); p.connect(fade);
      const t0 = performance.now();
      timer = setInterval(() => this.place(p, Math.sin((performance.now() - t0) / 1200) * 2 + c.offsetX / SC, 0, -1.2), 30);
      return {};
    }, loop);
    v.timer = timer; this.pv = v;
    const end = v.src.onended; v.src.onended = () => { clearInterval(timer); end(); if (this.pv === v) { this.pv = null; this.onPreviewEnd(); } };
  }
  stopPreview() {
    const v = this.pv; if (!v) return; this.pv = null; clearInterval(v.timer); this.kill(v, 0.08); this.onPreviewEnd();
  }
}
