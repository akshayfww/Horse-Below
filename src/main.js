import { GAME_TITLE, LOCATIONS } from './locations.js';
import { AudioEngine } from './audio.js';
import { storage } from './storage.js';
import { Game } from './game.js';
import { DevPanel } from './panel.js';

const $ = (s) => document.querySelector(s);
document.title = GAME_TITLE; $('#h1').textContent = GAME_TITLE;
const engine = new AudioEngine();
let toastT; const toast = (m) => { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 4000); };
let started = false, nameT;
const game = new Game($('#game'), engine, {
  onLocation(l) { const el = $('#locname'); clearTimeout(nameT); if (l) { el.textContent = l.name; el.classList.add('show'); } else nameT = setTimeout(() => el.classList.remove('show'), 1200); },
  onFound(n, total) { $('#discover').textContent = `Discovered ${n}/${total}`; },
});
const panel = new DevPanel($('#panel'), engine, {
  toast, onToggle(open) { game.paused = open || !$('#help').hidden; game.keys.clear(); if (!open) $('#game').focus(); },
});
const closeHelp = () => { $('#help').hidden = true; game.paused = panel.isOpen; $('#game').focus(); };

async function loadSaved() {
  try {
    const cfgs = await storage.allConfigs(); for (const [id, c] of Object.entries(cfgs)) if (engine.cfg[id]) engine.setConfig(id, c);
    const blobs = await storage.allBlobs();
    for (const [id, r] of Object.entries(blobs)) { try { engine.setUser(id, await engine.decode(new File([r.blob], r.name))); } catch (e) { toast(`Saved sound for "${id}" could not be decoded.`); } }
  } catch (e) { toast('Browser storage unavailable: sounds will not persist after refresh.'); }
}
$('#btnStart').onclick = async () => {
  try { engine.init(); await engine.resume(); } catch (e) { toast(e.message); }
  if (engine.ctx) await loadSaved();
  $('#title').hidden = true; $('#hud').hidden = false; started = true; game.start(); $('#game').focus();
};
$('#btnEditor').onclick = () => panel.toggle();
$('#btnHelp').onclick = () => { $('#help').hidden = false; game.paused = true; game.keys.clear(); };
$('#btnHelpClose').onclick = closeHelp;

const KEYMAP = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
addEventListener('keydown', (e) => {
  if (started && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); panel.toggle(); return; }
  if (e.key === 'Escape') { if (panel.isOpen) panel.close(); else if (!$('#help').hidden) closeHelp(); return; }
  if (engine.ctx && engine.ctx.state === 'suspended') engine.resume();
  const k = KEYMAP[e.key]; if (!k || !started || panel.isOpen || !$('#help').hidden) return;
  if (e.target.closest && e.target.closest('input,select,textarea')) return;
  e.preventDefault(); game.keys.add(k);
});
addEventListener('keyup', (e) => { const k = KEYMAP[e.key]; if (k) game.keys.delete(k); });
addEventListener('blur', () => game.keys.clear());
addEventListener('pointerdown', () => { if (engine.ctx && engine.ctx.state === 'suspended') engine.resume(); });
setInterval(() => {
  if (!engine.ctx) return;
  $('#audiostat').textContent = engine.ctx.state !== 'running' ? '🔇 audio paused: press any key' : `♪ ${engine.playing} sound${engine.playing === 1 ? '' : 's'} playing`;
}, 300);
window.__horse = { game, engine, panel };   // handy for debugging in the console
