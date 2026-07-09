// Minimal offline mutation queue for the 3 actions the spec calls out as
// must-work-offline: check-in, step completion, inbox capture. A failed
// fetch (network down) is queued in IndexedDB instead of thrown, then
// replayed in order once the browser fires 'online'.
const DB_NAME = 'onefocus-offline';
const STORE = 'queue';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueue(entry) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).add({ ...entry, createdAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAll() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function remove(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

let flushing = false;
export async function flush() {
  if (flushing || !navigator.onLine) return;
  flushing = true;
  try {
    const items = await getAll();
    for (const item of items.sort((a, b) => a.createdAt - b.createdAt)) {
      try {
        const res = await fetch('/api' + item.path, {
          method: item.method,
          headers: { 'Content-Type': 'application/json' },
          body: item.body ? JSON.stringify(item.body) : undefined,
        });
        if (res.ok || res.status < 500) await remove(item.id);
      } catch {
        break; // still offline or server unreachable — stop, retry on next online event
      }
    }
  } finally {
    flushing = false;
  }
}

export async function pendingCount() {
  const items = await getAll();
  return items.length;
}

window.addEventListener('online', flush);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) flush();
});
