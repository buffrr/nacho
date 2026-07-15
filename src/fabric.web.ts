// Web Fabric client — backed by the WASM libveritas module. The native build
// resolves src/fabric.ts instead.
//
// wasm-bindgen's default loader fetches its .wasm via `import.meta.url`, which
// Metro can't resolve. We instead bundle the .wasm as an asset and initialize
// libveritas explicitly here; once initialized, Fabric's own no-arg init early
// returns and never touches the import.meta path.
import { Fabric, Record, RecordSet } from "@spacesprotocol/fabric-web";
import "@spacesprotocol/fabric-web/signing";
import initLibveritas from "@spacesprotocol/libveritas";
import wasmUrl from "@spacesprotocol/libveritas/libveritas_bg.wasm";
import {
  resolveWith,
  ResolvedHandle,
  EditableRecord,
} from "@/fabricResolver";

let client: Fabric | null = null;
let wasmReady: Promise<void> | null = null;

function ensureWasm(): Promise<void> {
  if (!wasmReady) {
    wasmReady = (async () => {
      try {
        const asset = wasmUrl as unknown as
          | string
          | { uri?: string; default?: string };
        const url =
          typeof asset === "string"
            ? asset
            : (asset?.uri ?? asset?.default ?? "");
        await initLibveritas(url);
      } catch (e) {
        console.warn("libveritas wasm init:", e);
      }
    })();
  }
  return wasmReady;
}

function getClient(): Fabric {
  if (!client) {
    client = new Fabric();
  }
  return client;
}

export async function resolveHandle(
  handle: string,
): Promise<ResolvedHandle | null> {
  await ensureWasm();
  return resolveWith(getClient(), handle);
}

// Fetch the handle's certificate chain (.spacecert bytes) from certrelay.
export async function exportCert(handle: string): Promise<Uint8Array> {
  await ensureWasm();
  return getClient().export(handle);
}

function packRecords(records: EditableRecord[], seq: number) {
  return RecordSet.pack([
    Record.seq(BigInt(seq)),
    ...records.map((r) =>
      r.type === "txt"
        ? Record.txt(r.key, r.value)
        : Record.addr(r.key, r.value),
    ),
  ]);
}

// Total wire size of the packed record set (for the editor's byte counter).
export async function packedByteLength(
  records: EditableRecord[],
  seq: number,
): Promise<number> {
  await ensureWasm();
  return packRecords(records, seq).toBytes().length;
}

// Sign the records with the handle's key and broadcast them to certrelay.
export async function publishRecords(
  cert: Uint8Array,
  records: EditableRecord[],
  seq: number,
  secretKey: string,
): Promise<void> {
  await ensureWasm();
  await getClient().publish({
    cert,
    records: packRecords(records, seq),
    secretKey,
    primary: true,
  });
}

export type { ResolvedHandle };
