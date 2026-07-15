// Native cert store — persists each handle's .spacecert in a dedicated folder
// under the app document directory (durable, included in iOS device backups).
// The web build uses certStore.web.ts (IndexedDB) instead.
import { File, Directory, Paths } from "expo-file-system";

function certsDir(): Directory {
  const dir = new Directory(Paths.document, "certs");
  if (!dir.exists) {
    dir.create();
  }
  return dir;
}

function certFile(handle: string): File {
  return new File(certsDir(), `${handle}.spacecert`);
}

export async function saveCert(
  handle: string,
  bytes: Uint8Array,
): Promise<void> {
  const file = certFile(handle);
  if (file.exists) {
    file.delete();
  }
  file.write(bytes);
}

export async function loadCert(handle: string): Promise<Uint8Array | null> {
  const file = certFile(handle);
  if (!file.exists) {
    return null;
  }
  return await file.bytes();
}

export async function hasCert(handle: string): Promise<boolean> {
  return certFile(handle).exists;
}

export async function deleteCert(handle: string): Promise<void> {
  const file = certFile(handle);
  if (file.exists) {
    file.delete();
  }
}
