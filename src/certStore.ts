// Certificate store — each handle's .spacecert bytes, kept in the single SQLite
// database (src/db.ts) so they travel with the one-file backup. Native and web
// now share this store (the old filesystem/IndexedDB split is gone).
import { certSet, certGet, certHas, certDelete } from "@/db";

export async function saveCert(
  handle: string,
  bytes: Uint8Array,
): Promise<void> {
  await certSet(handle, bytes);
}

export async function loadCert(handle: string): Promise<Uint8Array | null> {
  return certGet(handle);
}

export async function hasCert(handle: string): Promise<boolean> {
  return certHas(handle);
}

export async function deleteCert(handle: string): Promise<void> {
  await certDelete(handle);
}
