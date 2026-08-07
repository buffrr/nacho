// One-time migration from the pre-SQLite web stores into the single database:
//   keystore JSON: AsyncStorage "keystore" → kv table
//   certs:         IndexedDB nacho/certs (keyed by handle) → certs table
// Idempotent and best-effort — see migrateLegacy.ts (native) for the rationale.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { kvGet, kvSet, certSet } from "@/db";

const IDB_NAME = "nacho";
const IDB_STORE = "certs";

export async function migrateLegacyStore(): Promise<void> {
  try {
    if (await kvGet("keystore")) return;
    const legacy = await AsyncStorage.getItem("keystore");
    if (!legacy) return;
    await kvSet("keystore", legacy);

    for (const { handle, bytes } of await readLegacyCerts()) {
      try {
        await certSet(handle, bytes);
      } catch {
        // skip
      }
    }
  } catch {
    // leave unmigrated
  }
}

async function readLegacyCerts(): Promise<
  { handle: string; bytes: Uint8Array }[]
> {
  if (typeof indexedDB === "undefined") return [];
  const db = await new Promise<IDBDatabase | null>((resolve) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      // If the store doesn't exist there's nothing to migrate; create so the
      // open resolves, then we'll read an empty store.
      if (!req.result.objectStoreNames.contains(IDB_STORE)) {
        req.result.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
  if (!db) return [];
  try {
    if (!db.objectStoreNames.contains(IDB_STORE)) return [];
    return await new Promise((resolve) => {
      const out: { handle: string; bytes: Uint8Array }[] = [];
      const tx = db.transaction(IDB_STORE, "readonly");
      const store = tx.objectStore(IDB_STORE);
      const cursorReq = store.openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor) {
          resolve(out);
          return;
        }
        const value = cursor.value;
        const bytes =
          value instanceof Uint8Array
            ? value
            : new Uint8Array(value as ArrayBuffer);
        out.push({ handle: String(cursor.key), bytes });
        cursor.continue();
      };
      cursorReq.onerror = () => resolve(out);
    });
  } finally {
    db.close();
  }
}
