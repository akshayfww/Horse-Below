import { LOCATIONS, byId } from './locations.js';
import { storage } from './storage.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const blobToDataURL = (b) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(b); });

export class DevPanel {
  constructor(root, engine, { onToggle, toast }) {
    this.root = root; this.engine = engine; this.onToggle = onToggle; this.toast = toast; this.drafts = {}; this.list = root.querySelector('#pList');
    root.querySelector('#pClose').onclick = () => this.close();
    root.querySelector('#pStopAll').onclick = () => engine.stopPreview();
    root.querySelector('#pExport').onclick = () => this.exportAll();
    root.querySelector('#pImport').onchange = (e) => this.importAll(e.target.files[0], e.target);
    this.list.addEventListener('click', (e) => { const b = e.target.closest('button[data-act]'); if (b) this.act(b.dataset.act, b.closest('details').dataset.id); });
    this.list.addEventListener('input', (e) => this.edit(e));
    this.list.addEventListener('change', (e) => e.target.type === 'file' ? this.upload(e) : this.edit(e));
    engine.onPreviewEnd = () => this.list.querySelectorAll('[data-act=preview]').forEach((b) => b.classList.remove('primary'));
  }
  get isOpen() { return !this.root.hidden; }
  open() { this.render(); this.root.hidden = false; this.onToggle(true); this.root.querySelector('#pClose').focus(); }
  close() { if (!this.isOpen) return; this.root.hidden = true; this.engine.stopPreview(); this.onToggle(false); }
  toggle() { this.isOpen ? this.close() : this.open(); }

  render() {
    this.list.innerHTML = '';
    for (const l of LOCATIONS) {
      this.drafts[l.id] = { cfg: { ...this.engine.cfg[l.id] }, file: null, buffer: null, removed: false };
      const el = document.createElement('details'); el.className = 'card'; el.dataset.id = l.id;
      el.innerHTML = `<summary><b>${esc(l.name)}</b><span class="sum"></span></summary><div class="body">
        <div class="row"><label class="btn">Upload / replace…<input type="file" accept="audio/*,.wav,.mp3,.ogg,.m4a,.flac,.aac,.opus" hidden></label>
          <button data-act="remove">Remove</button><button data-act="demo">Use demo tone</button></div>
        <div class="row"><button data-act="preview">▶ Preview</button><button data-act="stop">■ Stop</button><span class="info" data-r="info"></span></div>
        <label class="f sel">Playback mode<select data-k="mode"><option value="spatial">Spatialized mono (HRTF)</option><option value="stereo">Stereo recording (keep image)</option></select></label>
        <label class="f sel">Behavior<select data-k="behavior"><option value="loop">Looping ambience (while nearby)</option><option value="oneshot">One-shot on entering</option></select></label>
        <label class="f">Volume<input type="range" data-k="volume" min="0" max="1.5" step="0.05"><output></output></label>
        <label class="f">Audible radius<input type="range" data-k="radius" min="100" max="900" step="10"><output></output></label>
        <label class="f" data-for="spatial">Source offset X<input type="range" data-k="offsetX" min="-300" max="300" step="10"><output></output></label>
        <label class="f" data-for="stereo">Stereo balance<input type="range" data-k="pan" min="-1" max="1" step="0.05"><output></output></label>
        <label class="f">Fade time (s)<input type="range" data-k="fade" min="0.1" max="6" step="0.1"><output></output></label>
        <label class="chk"><input type="checkbox" data-k="proximity"> Louder as the horse gets closer</label>
        <label class="chk" data-for="loop"><input type="checkbox" data-k="continueAfterLeave"> Keep looping after leaving the radius</label>
        <div class="err" data-r="err" role="alert"></div>
        <div class="row"><button class="primary" data-act="save">Save</button></div></div>`;
      this.list.appendChild(el); this.sync(l.id);
    }
  }
  sync(id) {
    const el = this.list.querySelector(`[data-id=${id}]`), d = this.drafts[id], c = d.cfg;
    el.querySelectorAll('[data-k]').forEach((i) => { const k = i.dataset.k; if (i.type === 'checkbox') i.checked = !!c[k]; else i.value = c[k];
      const o = i.parentElement.querySelector('output'); if (o) o.textContent = k === 'radius' || k === 'offsetX' ? `${c[k]}px` : Number(c[k]).toFixed(2).replace(/\.?0+$/, ''); });
    el.querySelectorAll('[data-for]').forEach((x) => { const f = x.dataset.for; x.style.display = (f === 'spatial' ? c.mode === 'spatial' : f === 'stereo' ? c.mode === 'stereo' : c.behavior === 'loop') ? '' : 'none'; });
    const have = !!this.bufFor(id);
    el.querySelector('.sum').textContent = `${this.name(id)} · ${c.mode === 'stereo' ? 'stereo' : 'spatial'} · ${c.behavior === 'loop' ? 'loop' : 'one-shot'}`;
    const b = this.bufFor(id), info = el.querySelector('[data-r=info]');
    info.textContent = b ? `${b.numberOfChannels}ch · ${b.duration.toFixed(1)}s` + (c.mode === 'spatial' && b.numberOfChannels > 1 ? ' · stereo file will be mixed to mono for HRTF; use "Stereo recording" to keep it' : '') : '';
    el.querySelector('[data-act=preview]').disabled = !have;
  }
  name(id) {
    const d = this.drafts[id], e = this.engine;
    if (d.file) return `${d.file.name} (unsaved)`;
    if (d.removed) return d.cfg.useDemo ? 'built-in demo tone (unsaved)' : 'no sound assigned (unsaved)';
    if (e.user.has(id)) return d.cfg.fileName || 'custom sound';
    return d.cfg.useDemo ? 'built-in demo tone' : 'no sound assigned';
  }
  bufFor(id) {
    const d = this.drafts[id], e = this.engine;
    if (d.file) return d.buffer;
    if (!d.removed && e.user.has(id)) return e.user.get(id);
    return d.cfg.useDemo ? e.demo(id) : null;
  }
  setMsg(id, msg, ok) { const x = this.list.querySelector(`[data-id=${id}] [data-r=err]`); x.textContent = msg || ''; x.className = 'err' + (ok ? ' ok' : ''); }
  edit(e) {
    const i = e.target; if (!i.dataset || !i.dataset.k) return; const id = i.closest('details').dataset.id, d = this.drafts[id];
    d.cfg[i.dataset.k] = i.type === 'checkbox' ? i.checked : (i.tagName === 'SELECT' ? i.value : parseFloat(i.value)); this.sync(id);
  }
  async upload(e) {
    const f = e.target.files[0], id = e.target.closest('details').dataset.id, d = this.drafts[id]; if (!f) return;
    this.setMsg(id, 'Decoding…', true);
    try { await this.engine.resume(); const buf = await this.engine.decode(f);
      Object.assign(d, { file: f, buffer: buf, removed: false }); d.cfg.useDemo = false; this.setMsg(id, 'Loaded. Preview it, then press Save.', true);
    } catch (err) { this.setMsg(id, err.message); }
    e.target.value = ''; this.sync(id);
  }
  async act(a, id) {
    const d = this.drafts[id], e = this.engine; this.setMsg(id, '');
    if (a === 'remove') { Object.assign(d, { file: null, buffer: null, removed: true }); d.cfg.useDemo = false; e.stopPreview(); }
    else if (a === 'demo') { Object.assign(d, { file: null, buffer: null, removed: true }); d.cfg.useDemo = true; }
    else if (a === 'stop') e.stopPreview();
    else if (a === 'preview') { await e.resume(); const b = this.bufFor(id); if (!b) return this.setMsg(id, 'Nothing to preview: no sound assigned.'); e.preview(b, d.cfg);
      this.list.querySelectorAll('[data-act=preview]').forEach((x) => x.classList.remove('primary')); this.list.querySelector(`[data-id=${id}] [data-act=preview]`).classList.add('primary'); }
    else if (a === 'save') return this.save(id);
    this.sync(id);
  }
  async save(id) {
    const d = this.drafts[id], e = this.engine;
    try {
      if (d.file) { await storage.putBlob(id, d.file, d.file.name); e.setUser(id, d.buffer); d.cfg.fileName = d.file.name; }
      else if (d.removed) { await storage.delBlob(id); e.setUser(id, null); d.cfg.fileName = null; }
      await storage.putConfig(id, d.cfg); e.setConfig(id, d.cfg); e.refresh(id);
      d.file = null; d.removed = false; this.sync(id); this.setMsg(id, 'Saved ✓', true);
    } catch (err) { this.setMsg(id, 'Could not save (is browser storage blocked?): ' + (err.message || err)); }
  }
  async exportAll() {
    try {
      const out = { app: 'the-horse-below', version: 1, configs: {}, audio: {} }; const blobs = await storage.allBlobs();
      for (const l of LOCATIONS) out.configs[l.id] = this.engine.cfg[l.id];
      for (const [id, r] of Object.entries(blobs)) out.audio[id] = { name: r.name, data: await blobToDataURL(r.blob) };
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(out)], { type: 'application/json' }));
      a.download = 'horse-below-sounds.json'; document.body.appendChild(a); a.click(); a.remove(); this.toast('Exported configuration + audio');
    } catch (err) { this.toast('Export failed: ' + err.message); }
  }
  async importAll(file, input) {
    if (!file) return;
    try {
      const j = JSON.parse(await file.text()); if (j.app !== 'the-horse-below') throw new Error('Not a Horse Below export file.');
      for (const [id, c] of Object.entries(j.configs || {})) { if (!byId(id)) continue; this.engine.setConfig(id, c); await storage.putConfig(id, this.engine.cfg[id]); }
      for (const [id, a] of Object.entries(j.audio || {})) { if (!byId(id)) continue;
        const blob = await (await fetch(a.data)).blob(); const f = new File([blob], a.name, { type: blob.type });
        const buf = await this.engine.decode(f); await storage.putBlob(id, f, a.name); this.engine.setUser(id, buf); }
      for (const l of LOCATIONS) this.engine.refresh(l.id);
      this.render(); this.toast('Imported configuration');
    } catch (err) { this.toast('Import failed: ' + err.message); }
    input.value = '';
  }
}
