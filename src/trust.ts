// Trust-anchor helpers shared by the native and web Fabric wrappers.
//
// Fabric verifies handles against pinned anchors on a three-tier model:
//   trusted      — pinned from a QR scanned off a *local* Veritas client (Safety
//                  ID); yields the "orange" verified badge for sovereign handles.
//   semi-trusted — an anchor fetched over HTTPS from public relays; avoids the
//                  "unverified" classification without claiming full trust.
//   observed     — best-effort latest network state; "unverified".
//
// By default we pin a semi-trusted anchor from the same two relays the
// spacesprotocol.org site uses, so resolution is meaningfully verified out of
// the box without the user having to scan anything.
// Docs: https://spacesprotocol.org/docs/developers/sdk/
import { kvGet, kvSet } from "@/db";
import { activeAnchorRelays, networkTag } from "@/config";

export type TrustAnchor = { trustId: string; height: number | null };

export type TrustState = {
  trusted: string | null;
  semiTrusted: string | null;
  observed: string | null;
};

// The subset of the Fabric client the trust helpers depend on.
export interface TrustClient {
  semiTrust(trustId: string): Promise<void>;
  trust(trustId: string): Promise<void>;
  trustFromQr(payload: string): Promise<void>;
  semiTrustFromQr(payload: string): Promise<void>;
  trusted(): string | null;
  semiTrusted(): string | null;
  observed(): string | null;
  clearTrusted(): void;
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

// Fetch the current anchor (root hash + block height) from the relay pool,
// trying each relay until one answers. Header names match the site's client.
// The /anchors response is sent with `cache-control: max-age=300`, so we bypass
// the HTTP cache (no-store + a cache-busting param) — otherwise "Refresh" keeps
// returning the same stale anchor for up to 5 minutes.
export async function fetchSemiTrustAnchor(): Promise<TrustAnchor | null> {
  for (const url of activeAnchorRelays()) {
    try {
      const bust = `${url}${url.includes("?") ? "&" : "?"}_=${Date.now()}`;
      const res = await fetch(bust, { method: "HEAD", cache: "no-store" });
      const root = res.headers.get("x-anchor-root");
      if (root) {
        const h = res.headers.get("x-anchor-height");
        return { trustId: root, height: h ? Number(h) : null };
      }
    } catch {
      // try the next relay
    }
  }
  return null;
}

let cachedAnchor: TrustAnchor | null = null;
let semiTrustPromise: Promise<TrustAnchor | null> | null = null;

// Refresh the semi-trusted anchor to the current relay tip once per session.
// This runs even when a trusted (Safety ID) anchor was restored — semiTrust()
// only touches the semi tier, so the trusted anchor is left intact while the
// semi one tracks the latest tip. `onPinned` (optional) fires after a re-pin so
// callers can persist the updated state.
export function applyDefaultSemiTrust(
  client: TrustClient,
  onPinned?: () => Promise<void>,
): Promise<TrustAnchor | null> {
  if (!semiTrustPromise) {
    semiTrustPromise = (async () => {
      try {
        const anchor = await fetchSemiTrustAnchor();
        if (anchor) {
          // Only re-pin (and persist) when the tip actually moved.
          if (client.semiTrusted() !== anchor.trustId) {
            await client.semiTrust(anchor.trustId);
            await onPinned?.();
          }
          cachedAnchor = anchor;
        }
      } catch {
        // leave semi as-is; resolution still works with whatever is pinned
      }
      if (!cachedAnchor) {
        const id = client.semiTrusted() ?? client.trusted() ?? client.observed();
        if (id) cachedAnchor = { trustId: id, height: null };
      }
      return cachedAnchor;
    })();
  }
  return semiTrustPromise;
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

// "#956,124 · 960a 3d99…d932"
export function formatAnchor(anchor: TrustAnchor): string {
  const id = anchor.trustId.replace(/^0x/, "");
  const short = `${id.slice(0, 4)} ${id.slice(4, 8)}…${id.slice(-4)}`;
  return anchor.height != null
    ? `#${anchor.height.toLocaleString()} · ${short}`
    : short;
}
