// Single-file data store for the public keystore, certificates, and cached
// records — one SQLite database (`nacho.db`) that backs up as a single portable
// `.sqlite` file (native: the file itself; web: `serializeAsync()` bytes).
//
// SECRETS DO NOT LIVE HERE. Private keys / mnemonic stay in expo-secure-store
// (Keychain/Keystore) so the exported database is safe to hand around as the
// "public backup". See src/Store.tsx.
//
// The same expo-sqlite API drives native and web (web is backed by a bundled
// SQLite WASM build), so this file is platform-agnostic.
import * as SQLite from "expo-sqlite";

const DB_NAME = "nacho.db";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function initSchema(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS kv (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS certs (
      handle TEXT PRIMARY KEY NOT NULL,
      bytes BLOB NOT NULL
    );
    CREATE TABLE IF NOT EXISTS records (
      handle TEXT PRIMARY KEY NOT NULL,
      json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
}

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await initSchema(db);
      return db;
    })();
  }
  return dbPromise;
}

// ── Key/value (the keystore JSON lives here under key "keystore") ────────────

export async function kvGet(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM kv WHERE key = ?",
    key,
  );
  return row?.value ?? null;
}

export async function kvSet(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)",
    key,
    value,
  );
}

export async function kvRemove(key: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM kv WHERE key = ?", key);
}

// ── Certificates (.spacecert bytes, keyed by handle) ─────────────────────────

function toBytes(v: Uint8Array | ArrayBuffer | null | undefined): Uint8Array | null {
  if (!v) return null;
  return v instanceof Uint8Array ? v : new Uint8Array(v);
}

export async function certSet(handle: string, bytes: Uint8Array): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "INSERT OR REPLACE INTO certs (handle, bytes) VALUES (?, ?)",
    handle,
    bytes,
  );
}

export async function certGet(handle: string): Promise<Uint8Array | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ bytes: Uint8Array }>(
    "SELECT bytes FROM certs WHERE handle = ?",
    handle,
  );
  return toBytes(row?.bytes);
}

export async function certHas(handle: string): Promise<boolean> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>(
    "SELECT 1 AS n FROM certs WHERE handle = ?",
    handle,
  );
  return !!row;
}

export async function certDelete(handle: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM certs WHERE handle = ?", handle);
}

// ── Cached records (per handle; forward-compatible, not yet wired to resolve) ─

export async function recordsGet(handle: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ json: string }>(
    "SELECT json FROM records WHERE handle = ?",
    handle,
  );
  return row?.json ?? null;
}

export async function recordsSet(
  handle: string,
  json: string,
  updatedAt: number,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "INSERT OR REPLACE INTO records (handle, json, updated_at) VALUES (?, ?, ?)",
    handle,
    json,
    updatedAt,
  );
}

export async function recordsDelete(handle: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM records WHERE handle = ?", handle);
}

// Cached record count per handle (from the records cache), for the list subtitles.
export async function recordsCounts(): Promise<Record<string, number>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ handle: string; json: string }>(
    "SELECT handle, json FROM records",
  );
  const out: Record<string, number> = {};
  for (const row of rows) {
    try {
      const parsed = JSON.parse(row.json);
      out[row.handle] = Array.isArray(parsed.records)
        ? parsed.records.length
        : 0;
    } catch {
      out[row.handle] = 0;
    }
  }
  return out;
}

// ── Backup / restore (single .sqlite file) ───────────────────────────────────

// Raw bytes of the whole database — the exported single-file backup.
export async function exportDbBytes(): Promise<Uint8Array> {
  const db = await getDb();
  return await db.serializeAsync();
}

// Restore from an exported `.sqlite` file. We deserialize into an in-memory
// database and copy its rows into the live store (works identically on native +
// web, no file-path juggling). Existing rows with the same key are overwritten.
export async function importDbBytes(bytes: Uint8Array): Promise<void> {
  const mem = await SQLite.deserializeDatabaseAsync(bytes);
  try {
    const db = await getDb();
    const kvRows = await safeAll<{ key: string; value: string }>(
      mem,
      "SELECT key, value FROM kv",
    );
    const certRows = await safeAll<{ handle: string; bytes: Uint8Array }>(
      mem,
      "SELECT handle, bytes FROM certs",
    );
    const recRows = await safeAll<{
      handle: string;
      json: string;
      updated_at: number;
    }>(mem, "SELECT handle, json, updated_at FROM records");

    if (kvRows.length === 0) {
      throw new Error("Not a Nacho backup (no keystore table).");
    }

    await db.withTransactionAsync(async () => {
      for (const r of kvRows) {
        await db.runAsync(
          "INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)",
          r.key,
          r.value,
        );
      }
      for (const c of certRows) {
        const b = toBytes(c.bytes);
        if (b) {
          await db.runAsync(
            "INSERT OR REPLACE INTO certs (handle, bytes) VALUES (?, ?)",
            c.handle,
            b,
          );
        }
      }
      for (const r of recRows) {
        await db.runAsync(
          "INSERT OR REPLACE INTO records (handle, json, updated_at) VALUES (?, ?, ?)",
          r.handle,
          r.json,
          r.updated_at,
        );
      }
    });
  } finally {
    await mem.closeAsync();
  }
}

// Read the keystore JSON directly from serialized backup bytes without touching
// the live store — used to validate/preview a file before the user commits.
export async function readKeystoreFromBytes(
  bytes: Uint8Array,
): Promise<string | null> {
  const mem = await SQLite.deserializeDatabaseAsync(bytes);
  try {
    const row = await mem.getFirstAsync<{ value: string }>(
      "SELECT value FROM kv WHERE key = ?",
      "keystore",
    );
    return row?.value ?? null;
  } catch {
    return null;
  } finally {
    await mem.closeAsync();
  }
}

// getAllAsync against a table that may not exist in an older/foreign backup.
async function safeAll<T>(
  db: SQLite.SQLiteDatabase,
  sql: string,
): Promise<T[]> {
  try {
    return await db.getAllAsync<T>(sql);
  } catch {
    return [];
  }
}
