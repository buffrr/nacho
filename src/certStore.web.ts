// Web cert store — persists each handle's .spacecert in IndexedDB (the correct
// browser primitive for large binary blobs; localStorage is far too small).
// The native build uses certStore.ts (filesystem) instead.
const DB_NAME = "nacho";
const STORE = "certs";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveCert(
  handle: string,
  bytes: Uint8Array,
): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(bytes, handle);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function loadCert(handle: string): Promise<Uint8Array | null> {
  const db = await openDb();
  try {
    return await new Promise<Uint8Array | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(handle);
      req.onsuccess = () => {
        const value = req.result;
        if (!value) {
          resolve(null);
        } else if (value instanceof Uint8Array) {
          resolve(value);
        } else {
          resolve(new Uint8Array(value as ArrayBuffer));
        }
      };
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function hasCert(handle: string): Promise<boolean> {
  return (await loadCert(handle)) !== null;
}

export async function deleteCert(handle: string): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(handle);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
