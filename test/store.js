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

export const getDraft = () => run('kv', 'readonly', (s) => s.get('draft')).catch(() => null);
export const putDraft = (w) => run('kv', 'readwrite', (s) => s.put(w, 'draft')).catch(() => {});
export const dropDraft = () => run('kv', 'readwrite', (s) => s.delete('draft')).catch(() => {});

export const listMade = () => run('made', 'readonly', (s) => s.getAll()).then((a) => (a || []).sort((x, y) => y.at - x.at)).catch(() => []);
export const dropMade = (id) => run('made', 'readwrite', (s) => s.delete(id)).catch(() => {});
// each entry carries its photos (~4MB), so only the latest few are kept
export async function addMade(w, keep = 8) {
  try {
    await run('made', 'readwrite', (s) => s.put(w));
    for (const old of (await listMade()).slice(keep)) await dropMade(old.id);
    // ask once not to be cleared under storage pressure (Safari otherwise may, for a site not added to the home screen)
    navigator.storage?.persist?.().catch(() => {});
  } catch {}
}
