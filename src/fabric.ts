// Native (iOS/Android) Fabric client — backed by the native libveritas module.
// The web build resolves src/fabric.web.ts instead.
import { Fabric } from "@spacesprotocol/fabric-react-native";
import { signSchnorr } from "@spacesprotocol/fabric-react-native/signing";
import { Record, RecordSet } from "@spacesprotocol/react-native-libveritas";
import {
  resolveWith,
  ResolvedHandle,
  EditableRecord,
} from "@/fabricResolver";

// Unlike `@spacesprotocol/fabric-web/signing`, the native signing module only
// re-exports the primitives and doesn't auto-register the Schnorr signer, so
// publish()/sign() would throw "signing module not loaded". Register it here.
Fabric.registerSigner(signSchnorr);
import {
  applyDefaultSemiTrust,
  trustStateOf,
  trustedAnchorOf,
  tipHeightOf,
  parseTrustInput,
  cachedTrustAnchor,
  resetTrustCache,
  TrustAnchor,
  TrustState,
} from "@/trust";

let client: Fabric | null = null;

function getClient(): Fabric {
  if (!client) {
    client = new Fabric();
  }
  return client;
}

export async function resolveHandle(
  handle: string,
): Promise<ResolvedHandle | null> {
  await applyDefaultSemiTrust(getClient());
  const resolved = await resolveWith(getClient(), handle);
  // TEMP diagnostic: why does native badge grace@key as "unverified" while web
  // returns "none"? Logs the badge, pinned trust state, and whether the native
  // zone carries an anchor_hash (badge() returns "unverified" if it's missing).
  if (__DEV__) {
    console.log(
      "[nacho/trust]",
      JSON.stringify({
        handle,
        badge: resolved?.badge,
        trust: trustStateOf(getClient()),
        anchor_hash: (resolved?.zone as { anchor_hash?: unknown })?.anchor_hash,
        zoneKeys: resolved?.zone ? Object.keys(resolved.zone) : null,
        sovereignty: resolved?.zone?.sovereignty,
      }),
    );
  }
  return resolved;
}

// Ensure the default semi-trusted anchor is pinned, returning it for display.
export function ensureSemiTrust(): Promise<TrustAnchor | null> {
  return applyDefaultSemiTrust(getClient());
}

export function getTrustState(): TrustState {
  return trustStateOf(getClient());
}

export function getTrustAnchor(): TrustAnchor | null {
  return cachedTrustAnchor();
}

// The pinned trusted (Safety ID) anchor with its height, or null if none scanned.
export function getTrustedAnchor(): TrustAnchor | null {
  return trustedAnchorOf(getClient());
}

// Current tip height (from the semi-trusted anchor) — for trusted-anchor staleness.
export function getTipHeight(): number | null {
  return tipHeightOf(getClient());
}

export function refreshSemiTrust(): Promise<TrustAnchor | null> {
  resetTrustCache();
  return ensureSemiTrust();
}

// Pin a fully-trusted Safety ID from either a `veritas://scan?id=…` QR/link or
// a bare hex Trust ID. Throws if the input is neither.
export async function trustFromInput(input: string): Promise<void> {
  const parsed = parseTrustInput(input);
  if (!parsed) throw new Error("Unrecognized Trust ID");
  if (parsed.kind === "qr") await getClient().trustFromQr(parsed.payload);
  else await getClient().trust(parsed.id);
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
