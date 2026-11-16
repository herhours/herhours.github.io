// The work in progress and the shorts already made, kept on this phone only (IndexedDB).
// 10-11 iPhone test: closing the app mid-way lost everything, and people wanted a list of what they had made.
// Nothing here leaves the phone. Storage can be blocked (private mode) - then every call quietly does nothing.
const DB = 'hh-shorts';
let dbp = null;
function db() {
  return dbp ||= new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('kv'); r.result.createObjectStore('made', { keyPath: 'id' }); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function run(store, mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode);
    const q = fn(t.objectStore(store));
    t.oncomplete = () => res(q?.result);
    t.onerror = t.onabort = () => rej(t.error);
  });
}

// 11-16 영샘 아이폰(iOS 26.6 사파리, sheet log): opening the saved work gave `photo fail … An error occured reading the Blob
// argument to createImageBitmap` for every photo - "저장이 안 된다". WebKit can hand back a Blob from IndexedDB that no longer
// reads. So photos and the person's own music go in as plain bytes (ArrayBuffer + type + name) and are made Blobs/Files again
// on the way out. Work saved the old way (Blobs) is passed through as it is.
const toBytes = async (b) => (b instanceof Blob ? { buf: await b.arrayBuffer(), type: b.type || '', name: b.name || '' } : b);
const fromBytes = (p, fallbackType) => (p && p.buf instanceof ArrayBuffer
  ? (p.name ? new File([p.buf], p.name, { type: p.type || fallbackType }) : new Blob([p.buf], { type: p.type || fallbackType }))
  : p);
async function pack(w) {
  if (!w) return w;
  const out = { ...w };
  if (w.photos?.length) out.photos = await Promise.all(w.photos.map(toBytes));
  if (w.audio) out.audio = await toBytes(w.audio);
  if (w.thumb) out.thumb = await toBytes(w.thumb);
  return out;
}
const unpack = (w) => (w ? { ...w, photos: (w.photos || []).map((p) => fromBytes(p, 'image/jpeg')), audio: fromBytes(w.audio, 'audio/mpeg'), thumb: fromBytes(w.thumb, 'image/jpeg') } : w);

export const getDraft = () => run('kv', 'readonly', (s) => s.get('draft')).then(unpack).catch(() => null);
export const putDraft = (w) => pack(w).then((p) => run('kv', 'readwrite', (s) => s.put(p, 'draft'))).catch(() => {});
export const dropDraft = () => run('kv', 'readwrite', (s) => s.delete('draft')).catch(() => {});

export const listMade = () => run('made', 'readonly', (s) => s.getAll()).then((a) => (a || []).map(unpack).sort((x, y) => y.at - x.at)).catch(() => []);
export const dropMade = (id) => run('made', 'readwrite', (s) => s.delete(id)).catch(() => {});
// each entry carries its photos (~4MB), so only the latest few are kept
export async function addMade(w, keep = 8) {
  try {
    const p = await pack(w);
    await run('made', 'readwrite', (s) => s.put(p));
    for (const old of (await listMade()).slice(keep)) await dropMade(old.id);
    // ask once not to be cleared under storage pressure (Safari otherwise may, for a site not added to the home screen)
    navigator.storage?.persist?.().catch(() => {});
  } catch {}
}
