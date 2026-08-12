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
  isNotFoundResolveError,
} from "@/fabricResolver";
import { activeSeeds, loadNetConfig, onNetConfigChange } from "@/config";
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
      await ensureWasm();
      await loadNetConfig();
      const c = getClient();
      await loadTrustState(c);
      await applyDefaultSemiTrust(c, () => saveTrustState(c));
    })();
  }
  return initPromise;
}

// Rebuild the client + trust caches when the network config changes.
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
  try {
    return await resolveWith(getClient(), handle);
  } catch (e) {
    // A non-existent space can't be proven → treat as not found (see fabric.ts).
    if (isNotFoundResolveError(e)) return null;
    throw e;
  }
}

// Resolve with a throwaway client so the SDK's in-memory zone cache can't return
// a stale zone — used by the post-purchase onboarding poll. Reads the pinned
// anchors from persisted trust state. TEMP until Fabric exposes a no-cache opt.
export async function resolveHandleFresh(
  handle: string,
): Promise<ResolvedHandle | null> {
  await ensureWasm();
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
  await ensureWasm();
  const c = getClient();
  if (parsed.kind === "qr") await c.trustFromQr(parsed.payload);
  else await c.trust(parsed.id);
  await saveTrustState(c);
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
