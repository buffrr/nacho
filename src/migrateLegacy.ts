// One-time migration from the pre-SQLite stores into the single database:
//   keystore JSON: AsyncStorage "keystore" → kv table
//   certs:         document/certs/<handle>.spacecert files → certs table
// Idempotent (runs only while the SQLite keystore is still empty) and
// best-effort — any failure leaves the app usable (data is re-addable).
import AsyncStorage from "@react-native-async-storage/async-storage";
import { File, Directory, Paths } from "expo-file-system";
import { kvGet, kvSet, certSet } from "@/db";

export async function migrateLegacyStore(): Promise<void> {
  try {
    if (await kvGet("keystore")) return; // already on the SQLite store
    const legacy = await AsyncStorage.getItem("keystore");
    if (!legacy) return;
    await kvSet("keystore", legacy);

    // Certs were <handle>.spacecert files under document/certs. Read the ones
    // for the handles this keystore knows about.
    let handles: string[] = [];
    try {
      handles = Object.keys(JSON.parse(legacy)?.handles ?? {});
    } catch {
      handles = [];
    }
    const dir = new Directory(Paths.document, "certs");
    for (const handle of handles) {
      try {
        const file = new File(dir, `${handle}.spacecert`);
        if (file.exists) {
          await certSet(handle, await file.bytes());
        }
      } catch {
        // skip unreadable cert
      }
    }
  } catch {
    // leave unmigrated; the store just starts empty
  }
}
