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
import { activeSeeds, loadNetConfig, onNetConfigChange } from "@/config";

// Unlike `@spacesprotocol/fabric-web/signing`, the native signing module only
// re-exports the primitives and doesn't auto-register the Schnorr signer, so
// publish()/sign() would throw "signing module not loaded". Register it here.
Fabric.registerSigner(signSchnorr);
import {
  applyDefaultSemiTrust,
  loadTrustState,
  saveTrustState,
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
    // Seeds come from the user-editable network config (mainnet or dev set).
    // Empty → let the SDK use its built-in DEFAULT_SEEDS.
    const seeds = activeSeeds();
    client = new Fabric(seeds ? { seeds } : undefined);
  }
  return client;
}

// Restore any persisted trust state (Safety ID + anchors) once, then refresh
// the semi-trusted anchor to the current tip (persisting if it moved). Memoized
// so it runs a single time per session; awaited before every resolve. Loads the
// network config first so the client is built with the right seeds.
let initPromise: Promise<void> | null = null;
function ensureInit(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await loadNetConfig();
      const c = getClient();
      await loadTrustState(c);
      await applyDefaultSemiTrust(c, () => saveTrustState(c));
    })();
  }
  return initPromise;
}

// Rebuild the client + trust caches when the network config changes (dev-mode
// toggle or edited endpoints), so the next resolve uses the new seeds/anchors.
function resetFabric(): void {
  client = null;
  initPromise = null;
  resetTrustCache();
}
onNetConfigChange(resetFabric);

export async function resolveHandle(
  handle: string,
): Promise<ResolvedHandle | null> {
  await ensureInit();
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

// Resolve with a throwaway client so the SDK's in-memory zone cache can't return
// a stale zone — used by the post-purchase onboarding poll to detect the cert
// appearing / the sovereignty upgrade. Reads the pinned anchors from persisted
// trust state (no re-fetch). TEMP until Fabric exposes a no-cache option.
export async function resolveHandleFresh(
  handle: string,
): Promise<ResolvedHandle | null> {
  await loadNetConfig();
  const seeds = activeSeeds();
  const fresh = new Fabric(seeds ? { seeds } : undefined);
  await loadTrustState(fresh);
  return resolveWith(fresh, handle);
}

// Ensure trust state is restored + the semi anchor refreshed, returning it.
export async function ensureSemiTrust(): Promise<TrustAnchor | null> {
  await ensureInit();
  return cachedTrustAnchor();
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

export async function refreshSemiTrust(): Promise<TrustAnchor | null> {
  await ensureInit();
  resetTrustCache();
  const c = getClient();
  return applyDefaultSemiTrust(c, () => saveTrustState(c));
}

// Pin a fully-trusted Safety ID from either a `veritas://scan?id=…` QR/link or
// a bare hex Trust ID, then persist so it survives restarts. Throws if the
// input is neither.
export async function trustFromInput(input: string): Promise<void> {
  const parsed = parseTrustInput(input);
  if (!parsed) throw new Error("Unrecognized Trust ID");
  const c = getClient();
  if (parsed.kind === "qr") await c.trustFromQr(parsed.payload);
  else await c.trust(parsed.id);
  await saveTrustState(c);
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
