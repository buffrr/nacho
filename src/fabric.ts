// Native (iOS/Android) Fabric client — backed by the native libveritas module.
// The web build resolves src/fabric.web.ts instead.
import { Fabric, DEFAULT_SEMI_TRUSTED } from "@spacesprotocol/fabric-react-native";
import type {
  SemiTrustConfig,
  SemiTrustResult,
  SemiTrustedRelay,
  Quorum,
} from "@spacesprotocol/fabric-react-native";
import { signSchnorr } from "@spacesprotocol/fabric-react-native/signing";
import { Record, RecordSet } from "@spacesprotocol/react-native-libveritas";
import {
  resolveWith,
  resolveWithCertsWith,
  ResolvedHandle,
  ResolvedWithCerts,
  EditableRecord,
  isNotFoundResolveError,
} from "@/fabricResolver";
import { activeSeeds, loadNetConfig, onNetConfigChange } from "@/config";

// Unlike `@spacesprotocol/fabric-web/signing`, the native signing module only
// re-exports the primitives and doesn't auto-register the Schnorr signer, so
// publish()/sign() would throw "signing module not loaded". Register it here.
Fabric.registerSigner(signSchnorr);
import {
  applyDefaultSemiTrust,
  refreshSemiTrustNow,
  loadSemiTrustPool,
  saveSemiTrustPool,
  isSemiTrustDisabled,
  setSemiTrustDisabled,
  fetchRelayPubkey,
  quorumRequired,
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
      // Re-apply the persisted pool config BEFORE the first refresh (saveState
      // doesn't carry it — see semi-trust.md §4).
      await loadSemiTrustPool(c);
      // Skip the fallback loader entirely if the user disabled it.
      if (!(await isSemiTrustDisabled())) {
        await applyDefaultSemiTrust(c, () => saveTrustState(c));
      }
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
  let resolved: ResolvedHandle | null;
  try {
    resolved = await resolveWith(getClient(), handle);
  } catch (e) {
    // A name that's provably absent from the proof → not found (see helper).
    // A real verification failure on an existing name still throws.
    if (isNotFoundResolveError(e)) return null;
    throw e;
  }
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

// Resolution + full certificate chain in one round trip (fabric 0.2.8). More
// expensive than resolve() — call it for the certificate view when we don't yet
// hold a final cert, and via pull-to-refresh; don't poll it once a handle is
// final. `fresh` uses a throwaway client to bypass the SDK's zone cache.
export async function resolveHandleWithCerts(
  handle: string,
  fresh = false,
): Promise<ResolvedWithCerts | null> {
  await ensureInit();
  const client = fresh
    ? await (async () => {
        const seeds = activeSeeds();
        const c = new Fabric(seeds ? { seeds } : undefined);
        await loadTrustState(c);
        return c;
      })()
    : getClient();
  try {
    return await resolveWithCertsWith(client, handle);
  } catch (e) {
    if (isNotFoundResolveError(e)) return null;
    throw e;
  }
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

// Re-run the signed-pool loader against the CURRENT pool and report the vote
// breakdown (agreed/total). The pinned anchor is updated as a side effect —
// read it with getTrustAnchor() after this resolves.
export async function refreshSemiTrust(): Promise<SemiTrustResult> {
  await ensureInit();
  resetTrustCache();
  const c = getClient();
  return refreshSemiTrustNow(c, () => saveTrustState(c));
}

// ── Semi-trusted pool editing (Trust page) ──────────────────────────────────
export function getSemiTrustPool(): SemiTrustConfig {
  return getClient().semiTrustedPool();
}

// Swap the pool + quorum, persist the config, then re-verify. Returns the vote
// result so the UI can show "3/4 agreed"; the anchor cache is updated on quorum.
export async function applySemiTrustPool(
  relays: SemiTrustedRelay[],
  quorum: Quorum,
): Promise<SemiTrustResult> {
  await ensureInit();
  const c = getClient();
  c.setSemiTrustedPool(relays, quorum);
  await saveSemiTrustPool(c);
  resetTrustCache();
  return refreshSemiTrustNow(c, () => saveTrustState(c));
}

// Whether the fallback (semi-trusted) tier is on. Off → no anchor is pinned and
// responses rely solely on a scanned Trust ID (else unverified).
export function isFallbackEnabled(): Promise<boolean> {
  return isSemiTrustDisabled().then((d) => !d);
}

// Toggle the fallback tier. Persists the flag (stripping any pinned anchor when
// disabling), rebuilds the client, and re-pins when re-enabling.
export async function setFallbackEnabled(enabled: boolean): Promise<void> {
  await ensureInit();
  await setSemiTrustDisabled(getClient(), !enabled);
  resetFabric(); // drop the in-memory client (and its pinned semi anchor)
  await ensureInit(); // rebuild; the loader runs only when enabled
}

// Re-exports so the Trust page needs only one import surface.
export { DEFAULT_SEMI_TRUSTED, fetchRelayPubkey, quorumRequired };
export type { SemiTrustConfig, SemiTrustResult, SemiTrustedRelay, Quorum };

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

export type { ResolvedHandle, ResolvedWithCerts };
