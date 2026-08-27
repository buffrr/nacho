// Trust-anchor helpers shared by the native and web Fabric wrappers.
//
// Fabric verifies handles against pinned anchors on a three-tier model:
//   trusted      — pinned from a QR scanned off a *local* Veritas client (Safety
//                  ID); yields the "orange" verified badge for sovereign handles.
//   semi-trusted — an anchor agreed by a pinned pool of relays that each SIGN
//                  their (root, height). Fabric's loader fetches every relay,
//                  verifies the signature against its pinned key, and pins only a
//                  root that meets quorum; a transient miss keeps the good anchor.
//   observed     — best-effort latest network state; "unverified".
//
// The default pool (DEFAULT_SEMI_TRUSTED) is a 3-of-4 majority of the production
// relays, so resolution is signature-verified out of the box without the user
// scanning anything. Power users can edit the pool + quorum from the Trust page.
// Docs: https://spacesprotocol.org/docs/developers/sdk/
import type {
  SemiTrustedRelay,
  Quorum,
  SemiTrustConfig,
  SemiTrustResult,
} from "@spacesprotocol/fabric-core";
import { kvGet, kvSet, kvRemove } from "@/db";
import { networkTag } from "@/config";

export type { SemiTrustedRelay, Quorum, SemiTrustConfig, SemiTrustResult };

export type TrustAnchor = { trustId: string; height: number | null };

export type TrustState = {
  trusted: string | null;
  semiTrusted: string | null;
  observed: string | null;
};

// The subset of the Fabric client the trust helpers depend on. The semi-trusted
// tier is now driven entirely by the SDK's signed-pool loader.
export interface TrustClient {
  semiTrust(trustId: string): Promise<void>;
  trust(trustId: string): Promise<void>;
  trustFromQr(payload: string): Promise<void>;
  semiTrustFromQr(payload: string): Promise<void>;
  trusted(): string | null;
  semiTrusted(): string | null;
  observed(): string | null;
  clearTrusted(): void;
  // Signed semi-trusted pool loader (fabric ≥ 0.2.8).
  refreshSemiTrusted(): Promise<SemiTrustResult>;
  semiTrustedPool(): SemiTrustConfig;
  setSemiTrustedPool(relays: SemiTrustedRelay[], quorum: Quorum): void;
}

// Adds Fabric's own state persistence (anchors + zone cache) on top.
export interface PersistableTrustClient extends TrustClient {
  saveState(): string;
  loadState(json: string): void;
}

// The pinned Fabric trust state (trusted Safety ID, semi-trusted, observed,
// zone cache) lives in the kv table under this key so a scanned Safety ID
// survives restarts and rides along in the single-file backup. Namespaced by
// network (dev/mainnet) so a dev/regtest run doesn't load mainnet anchors (which
// would show e.g. a ~900k mainnet tip against a local chain) — computed at call
// time since the dev-mode toggle can change at runtime.
function stateKey(): string {
  return `fabric_state:${networkTag()}`;
}

// Restore the persisted Fabric state once, before any resolve/pin. No-op if
// nothing is saved or the blob is unusable (we just start fresh).
export async function loadTrustState(
  client: PersistableTrustClient,
): Promise<void> {
  try {
    const json = await kvGet(stateKey());
    if (json) client.loadState(json);
  } catch {
    // start with no pinned trust
  }
}

// Persist the current Fabric state (call after any trust()/semiTrust() change).
export async function saveTrustState(
  client: PersistableTrustClient,
): Promise<void> {
  try {
    await kvSet(stateKey(), client.saveState());
  } catch {
    // best-effort; state stays for the session either way
  }
}

// A Trust ID can arrive two ways: the `veritas://scan?id=…` QR/link a local
// Veritas client emits, or the bare 32-byte hex id (e.g. copied from the anchor
// row). Classify the input so the caller can route it to trustFromQr vs trust.
export function parseTrustInput(
  input: string,
): { kind: "qr"; payload: string } | { kind: "id"; id: string } | null {
  const s = input.trim();
  if (!s) return null;
  if (/^veritas:\/\//i.test(s)) return { kind: "qr", payload: s };
  const hex = s.replace(/^0x/i, "").toLowerCase();
  if (/^[0-9a-f]{64}$/.test(hex)) return { kind: "id", id: hex };
  return null;
}

// ── Semi-trusted pool persistence (§4 of semi-trust.md) ──────────────────────
// fabric.saveState() persists anchors + zone cache but NOT the pool config, so a
// custom pool would revert to DEFAULT_SEMI_TRUSTED on reconstruction. We persist
// it ourselves, namespaced by network like the rest of the trust state, and
// re-apply it on startup BEFORE the first refresh.
function poolKey(): string {
  return `semi_trust_pool:${networkTag()}`;
}

export async function loadSemiTrustPool(client: TrustClient): Promise<void> {
  try {
    const raw = await kvGet(poolKey());
    if (raw) {
      const { relays, quorum } = JSON.parse(raw) as SemiTrustConfig;
      client.setSemiTrustedPool(relays, quorum);
    }
  } catch {
    // keep the SDK default pool
  }
}

export async function saveSemiTrustPool(client: TrustClient): Promise<void> {
  try {
    await kvSet(poolKey(), JSON.stringify(client.semiTrustedPool()));
  } catch {
    // best-effort; the pool stays for the session either way
  }
}

// Agreeing relays required for a quorum over a pool of size `n` — mirrors the
// SDK so the settings UI can show "needs 3 of 4" before saving.
export function quorumRequired(quorum: Quorum, n: number): number {
  if (quorum === "all") return n;
  if (quorum === "majority") return Math.floor(n / 2) + 1;
  return Math.max(1, Math.min(n, quorum.atLeast));
}

// Trust-on-first-use pubkey discovery for an "Add source" flow: the anchors
// endpoint advertises its signing key in the `X-Anchor-Pubkey` header (the same
// header fabric reads when verifying), so we HEAD it directly. We do NOT hit
// `/stats` — that's a full-certrelay endpoint an anchors-only server may not
// serve. This is NOT out-of-band pinning; the UI shows the key to verify.
export async function fetchRelayPubkey(url: string): Promise<string | null> {
  try {
    const base = url.replace(/\/+$/, "").replace(/\/anchors$/, "");
    const res = await fetch(`${base}/anchors`, { method: "HEAD", cache: "no-store" });
    const pk = (res.headers.get("x-anchor-pubkey") ?? "").toLowerCase();
    return /^[0-9a-f]{64}$/.test(pk) ? pk : null;
  } catch {
    return null;
  }
}

let cachedAnchor: TrustAnchor | null = null;
let semiTrustPromise: Promise<TrustAnchor | null> | null = null;

// Run the SDK's signed-pool loader: fetch every relay, verify signatures, and
// pin the quorum root. Updates our display cache and (only on a re-pin) fires
// `onPinned` to persist. Returns the vote breakdown for UI feedback. On a
// quorum-miss the SDK keeps the existing anchor, so we never clear a good one.
export async function refreshSemiTrustNow(
  client: TrustClient,
  onPinned?: () => Promise<void>,
): Promise<SemiTrustResult> {
  const r = await client.refreshSemiTrusted();
  if (r.quorumMet && r.trustId) {
    cachedAnchor = { trustId: r.trustId, height: r.height };
    await onPinned?.();
  } else if (!cachedAnchor) {
    // Nothing repinned this run — fall back to whatever is already pinned.
    const id = client.semiTrusted() ?? client.trusted() ?? client.observed();
    if (id) cachedAnchor = { trustId: id, height: null };
  }
  return r;
}

// Refresh the semi-trusted anchor once per session (memoized). Runs even when a
// trusted Safety ID was restored — the semi tier is independent, so the trusted
// anchor is left intact while the semi one tracks the tip.
export function applyDefaultSemiTrust(
  client: TrustClient,
  onPinned?: () => Promise<void>,
): Promise<TrustAnchor | null> {
  if (!semiTrustPromise) {
    semiTrustPromise = (async () => {
      try {
        await refreshSemiTrustNow(client, onPinned);
      } catch {
        // leave semi as-is; resolution still works with whatever is pinned
        if (!cachedAnchor) {
          const id = client.semiTrusted() ?? client.trusted() ?? client.observed();
          if (id) cachedAnchor = { trustId: id, height: null };
        }
      }
      return cachedAnchor;
    })();
  }
  return semiTrustPromise;
}

// ── Disabling the fallback tier ──────────────────────────────────────────────
// fabric ≤ 0.2.8 has no clearSemiTrusted(), and the semi anchor is persisted
// under anchors.semi_trusted, so a plain rebuild would restore it. To truly turn
// the fallback off we (a) record a flag that makes init skip the loader, and
// (b) strip the pinned semi anchor out of the saved state. The caller rebuilds
// the client afterwards so the in-memory anchor is dropped too.
function semiDisabledKey(): string {
  return `semi_trust_disabled:${networkTag()}`;
}

export async function isSemiTrustDisabled(): Promise<boolean> {
  try {
    return (await kvGet(semiDisabledKey())) === "1";
  } catch {
    return false;
  }
}

export async function setSemiTrustDisabled(
  client: PersistableTrustClient,
  disabled: boolean,
): Promise<void> {
  try {
    await kvSet(semiDisabledKey(), disabled ? "1" : "0");
  } catch {
    // flag is best-effort
  }
  if (disabled) {
    try {
      const obj = JSON.parse(client.saveState()) as {
        anchors?: { semi_trusted?: unknown[] };
      };
      if (obj.anchors) obj.anchors.semi_trusted = [];
      await kvSet(stateKey(), JSON.stringify(obj));
    } catch {
      // if we can't strip it, the flag still prevents re-pinning on refresh
    }
    cachedAnchor = null;
  }
}

export function trustStateOf(client: TrustClient): TrustState {
  return {
    trusted: client.trusted(),
    semiTrusted: client.semiTrusted(),
    observed: client.observed(),
  };
}

// The Fabric client keeps per-tier anchor entries (each carrying a block height)
// in a private field. There's no public height accessor, so we read it
// defensively — display-only, and it degrades to null if the SDK shape changes.
type AnchorEntry = { height?: number; block?: { height?: number } };

function anchorEntriesOf(
  client: TrustClient,
  kind: "trusted" | "semiTrusted",
): AnchorEntry[] | null {
  const entries = (client as unknown as { anchorEntries?: Record<string, unknown> })
    .anchorEntries?.[kind];
  return Array.isArray(entries) ? (entries as AnchorEntry[]) : null;
}

function maxHeight(entries: AnchorEntry[] | null): number | null {
  if (!entries || entries.length === 0) return null;
  let max: number | null = null;
  for (const e of entries) {
    const h = e?.block?.height ?? e?.height;
    if (typeof h === "number") max = max == null ? h : Math.max(max, h);
  }
  return max;
}

// The pinned trusted (Safety ID) anchor, with its block height if we can read it.
export function trustedAnchorOf(client: TrustClient): TrustAnchor | null {
  const trustId = client.trusted();
  if (!trustId) return null;
  return { trustId, height: maxHeight(anchorEntriesOf(client, "trusted")) };
}

// Current chain tip as seen by our anchors — the semi-trusted anchor tracks the
// relay tip, so it's the reference for how stale a trusted anchor has become.
export function tipHeightOf(client: TrustClient): number | null {
  return (
    cachedAnchor?.height ??
    maxHeight(anchorEntriesOf(client, "semiTrusted")) ??
    maxHeight(anchorEntriesOf(client, "trusted"))
  );
}

export function cachedTrustAnchor(): TrustAnchor | null {
  return cachedAnchor;
}

// Allow the anchor to be re-fetched (e.g. Settings "refresh").
export function resetTrustCache(): void {
  cachedAnchor = null;
  semiTrustPromise = null;
}

// Erase all persisted trust state for the active network (pinned anchors, the
// custom pool, and the fallback-disabled flag) so the next init reverts to the
// SDK defaults (DEFAULT_SEMI_TRUSTED). Used by "Delete everything".
export async function wipeTrustStorage(): Promise<void> {
  for (const key of [stateKey(), poolKey(), semiDisabledKey()]) {
    try {
      await kvRemove(key);
    } catch {
      // best-effort
    }
  }
  resetTrustCache();
}

// "#956,124 · 960a 3d99…d932"
export function formatAnchor(anchor: TrustAnchor): string {
  const id = anchor.trustId.replace(/^0x/, "");
  const short = `${id.slice(0, 4)} ${id.slice(4, 8)}…${id.slice(-4)}`;
  return anchor.height != null
    ? `#${anchor.height.toLocaleString()} · ${short}`
    : short;
}
