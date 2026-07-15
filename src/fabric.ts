// Native (iOS/Android) Fabric client — backed by the native libveritas module.
// The web build resolves src/fabric.web.ts instead.
import { Fabric } from "@spacesprotocol/fabric-react-native";
import "@spacesprotocol/fabric-react-native/signing";
import { Record, RecordSet } from "@spacesprotocol/react-native-libveritas";
import {
  resolveWith,
  ResolvedHandle,
  EditableRecord,
} from "@/fabricResolver";

let client: Fabric | null = null;

function getClient(): Fabric {
  if (!client) {
    client = new Fabric();
  }
  return client;
}

export function resolveHandle(handle: string): Promise<ResolvedHandle | null> {
  return resolveWith(getClient(), handle);
}

// Fetch the handle's certificate chain (.spacecert bytes) from certrelay.
export function exportCert(handle: string): Promise<Uint8Array> {
  return getClient().export(handle);
}

// Packs records to wire bytes. uniffi's RecordSet.toBytes() returns an
// ArrayBuffer, so we normalize to Uint8Array for the core publish() API.
function packRecordsBytes(records: EditableRecord[], seq: number): Uint8Array {
  const rs = RecordSet.pack([
    new Record.Seq({ version: BigInt(seq) }),
    ...records.map((r) =>
      r.type === "txt"
        ? new Record.Txt({ key: r.key, value: r.value })
        : new Record.Addr({ key: r.key, value: r.value }),
    ),
  ]);
  return new Uint8Array(rs.toBytes());
}

// Total wire size of the packed record set (for the editor's byte counter).
export async function packedByteLength(
  records: EditableRecord[],
  seq: number,
): Promise<number> {
  return packRecordsBytes(records, seq).length;
}

// Sign the records with the handle's key and broadcast them to certrelay.
export async function publishRecords(
  cert: Uint8Array,
  records: EditableRecord[],
  seq: number,
  secretKey: string,
): Promise<void> {
  await getClient().publish({
    cert,
    records: packRecordsBytes(records, seq),
    secretKey,
    primary: true,
  });
}

export type { ResolvedHandle };
