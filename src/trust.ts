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

export const SEMI_TRUST_RELAYS = [
  "https://relay-cosmos.spacesprotocol.org/anchors",
  "https://relay-pulsar.spacesprotocol.org/anchors",
];

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
export async function fetchSemiTrustAnchor(): Promise<TrustAnchor | null> {
  for (const url of SEMI_TRUST_RELAYS) {
    try {
      const res = await fetch(url, { method: "HEAD" });
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

// Pin the default semi-trusted anchor once. Idempotent and safe to await from
// every resolve — the network fetch + pin happen a single time per session.
export function applyDefaultSemiTrust(
  client: TrustClient,
): Promise<TrustAnchor | null> {
  if (!semiTrustPromise) {
    semiTrustPromise = (async () => {
      try {
        if (!client.semiTrusted() && !client.trusted()) {
          const anchor = await fetchSemiTrustAnchor();
          if (anchor) {
            await client.semiTrust(anchor.trustId);
            cachedAnchor = anchor;
          }
        }
      } catch {
        // leave unpinned; resolution still works as "observed"
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
