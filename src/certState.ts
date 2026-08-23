import type { ZoneJson, ResolvedWithCerts } from "@/fabricResolver";

// Certificate lifecycle (see certs_mockup.html). Two certificates ever exist —
// provisional, then final — and "confirming" is the final one waiting on its
// on-chain commitment to become irreversible. We trust the protocol's
// `sovereignty` flag for finality rather than counting blocks ourselves.
export type CertState = "provisional" | "confirming" | "final";

type Onchain = { state_root?: string; block_height?: number };
// The commitment on a zone is a tagged union:
//   commitment: { status: "unknown" }                     // no commitment (leaf)
//   commitment: { status: "exists", value: { onchain: { state_root, prev_root,
//                   rolling_hash, block_height }, receipt_hash } }
// So the on-chain fields live at commitment.value.onchain, and only when status
// is "exists". (Fall back to older shapes just in case.)
const onchainOf = (zone: ZoneJson): Onchain | undefined => {
  const c = (
    zone as {
      commitment?: {
        status?: string;
        value?: { onchain?: Onchain };
        onchain?: Onchain;
      } & Onchain;
    }
  )?.commitment;
  if (!c) return undefined;
  if (c.status && c.status !== "exists") return undefined;
  return c.value?.onchain ?? c.onchain ?? (typeof c.block_height === "number" ? c : undefined);
};

// The anchor block the zone's proof was verified against — effectively the tip
// at resolution time. Used to count confirmations (anchor − commitment height).
const anchorOf = (zone: ZoneJson): number | null => {
  const a = (zone as { anchor?: number }).anchor;
  return typeof a === "number" ? a : null;
};

// Coarse state from just the sovereignty flag — used as a fallback when we only
// have the handle's cached resolution (no full cert chain), so a failed/offline
// resolveWithCerts doesn't wrongly drop the row to Provisional.
export function certStateFromSovereignty(
  sovereignty: string | null | undefined,
): CertState {
  if (sovereignty === "sovereign") return "final";
  if (sovereignty === "pending") return "confirming";
  return "provisional";
}

export function certStateOf(zone: ZoneJson): CertState {
  const byS = certStateFromSovereignty(zone.sovereignty);
  // Any non-sovereign value with an on-chain commitment is still Confirming.
  if (byS === "provisional") return onchainOf(zone) ? "confirming" : "provisional";
  return byS;
}

export function blockHeightOf(zone: ZoneJson): number | null {
  const h = onchainOf(zone)?.block_height;
  return typeof h === "number" ? h : null;
}

export function rootOf(zone: ZoneJson): string | null {
  const r = onchainOf(zone)?.state_root;
  return typeof r === "string" ? r : null;
}

// Approx commitment time from chain depth (~10 min/block), since we have no chain
// view — enough for "committed ~3h ago" / an anchored date. Null if unknown.
export function committedAtFromHeight(
  height: number | null,
  tip: number | null,
  now: number,
): number | null {
  if (height == null || tip == null) return null;
  return now - Math.max(0, tip - height) * 10 * 60 * 1000;
}

export type Commitment = {
  blockHeight: number;
  root: string | null;
  confirmations: number | null;
};

export function commitmentOf(zone: ZoneJson): Commitment | null {
  const o = onchainOf(zone);
  if (!o || typeof o.block_height !== "number") return null;
  const anchor = anchorOf(zone);
  return {
    blockHeight: o.block_height,
    root: typeof o.state_root === "string" ? o.state_root : null,
    confirmations: anchor != null ? Math.max(0, anchor - o.block_height) : null,
  };
}

// A leaf handle has no commitment of its own — it's anchored by its parent
// space's commitment (e.g. lili@test10000 is included in @test10000's commit at
// block 7131). Return the commitment that anchors this handle: its own if it has
// one, otherwise the nearest parent's, along with the zone name it came from.
export function anchoringCommitment(
  resolved: ResolvedWithCerts,
): { commitment: Commitment; zoneName: string } | null {
  const own = commitmentOf(resolved.zone);
  if (own) return { commitment: own, zoneName: resolved.handle };
  for (const p of resolved.parents) {
    const c = commitmentOf(p);
    if (c) return { commitment: c, zoneName: nameOfZone(p) };
  }
  return null;
}

export function nameOfZone(zone: ZoneJson): string {
  const canonical = typeof zone.canonical === "string" ? zone.canonical : "";
  return canonical || zone.handle || "";
}

// The certificate chain is TWO alternating row kinds (certs_mockup.html §04): a
// ZONE row (name + role + its own sovereignty state) and, between each pair of
// zones, a COMMITMENT EDGE. The commitment belongs to the EDGE, not to a zone: a
// name publishes no root of its own — it's *included in* its parent's. So the
// edge below a child carries the PARENT's commitment (root + block). N zones ⇒
// N−1 edges; a parent that hasn't committed the child yet is an empty edge.
export type ChainRow =
  | {
      kind: "zone";
      name: string;
      state: CertState;
      role: "leaf" | "parent" | "root";
    }
  | {
      kind: "edge";
      commitment: Commitment | null; // the parent zone's own commitment
      parentName: string; // the parent zone this edge points down to
      // Whether the child is actually IN the parent's committed tree. A
      // "sovereign"/"pending" child is included (the commitment proves
      // inclusion). A "dependent" child is signed by the parent but provably
      // NOT yet included — the same commitment is then a proof of EXCLUSION,
      // so the edge must say the opposite.
      included: boolean;
    };

// A child is included in its parent's commitment only when its own sovereignty
// says so. "dependent" means signed-but-not-yet-committed (exclusion proof).
function isIncludedSovereignty(sovereignty: string | undefined): boolean {
  return sovereignty === "sovereign" || sovereignty === "pending";
}

export function chainRows(resolved: ResolvedWithCerts): ChainRow[] {
  const zones = [resolved.zone, ...resolved.parents];
  const names = [resolved.handle, ...resolved.parents.map(nameOfZone)];
  const rows: ChainRow[] = [];
  const last = zones.length - 1;
  for (let i = 0; i < zones.length; i++) {
    rows.push({
      kind: "zone",
      name: names[i],
      state: certStateOf(zones[i]),
      role: i === 0 ? "leaf" : i === last ? "root" : "parent",
    });
    if (i < last) {
      // Edge below zone[i]: the commitment its PARENT (zone[i+1]) published.
      // Whether that commitment includes or provably excludes the child depends
      // on the CHILD's sovereignty.
      rows.push({
        kind: "edge",
        commitment: commitmentOf(zones[i + 1]),
        parentName: names[i + 1],
        included: isIncludedSovereignty(zones[i].sovereignty),
      });
    }
  }
  return rows;
}

// In-memory cache of the last resolveWithCerts per handle. Once a handle is
// final its chain is immutable, so we serve the cache and never re-fetch (the
// call is an expensive multi-zone query); non-final entries are refreshable.
const cache = new Map<string, ResolvedWithCerts>();
export const getCachedCerts = (handle: string): ResolvedWithCerts | null =>
  cache.get(handle) ?? null;
export const setCachedCerts = (handle: string, r: ResolvedWithCerts): void => {
  cache.set(handle, r);
};
export const isFinalCached = (handle: string): boolean => {
  const c = cache.get(handle);
  return !!c && certStateOf(c.zone) === "final";
};
