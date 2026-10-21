// IndexedDB persistence: 'configs' (id -> settings) and 'blobs' (id -> {blob,name,type}).
let dbp;
const open = () => dbp || (dbp = new Promise((res, rej) => {
  const r = indexedDB.open('horse-below', 1);
  r.onupgradeneeded = () => { r.result.createObjectStore('configs'); r.result.createObjectStore('blobs'); };
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
}));
const run = async (store, mode, fn) => {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(store, mode);
    const out = fn(t.objectStore(store));
    t.oncomplete = () => res(out && out.result);
    t.onerror = t.onabort = () => rej(t.error);
  });
};
const entries = async (store) => {
  const db = await open();
  return new Promise((res, rej) => {
    const o = {}; const req = db.transaction(store).objectStore(store).openCursor();
    req.onsuccess = () => { const c = req.result; if (c) { o[c.key] = c.value; c.continue(); } else res(o); };
    req.onerror = () => rej(req.error);
  });
};
export const storage = {
  putConfig: (id, c) => run('configs', 'readwrite', (s) => s.put(c, id)),
  allConfigs: () => entries('configs'),
  putBlob: (id, blob, name) => run('blobs', 'readwrite', (s) => s.put({ blob, name, type: blob.type }, id)),
  delBlob: (id) => run('blobs', 'readwrite', (s) => s.delete(id)),
  allBlobs: () => entries('blobs'),
};
