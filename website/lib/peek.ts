// Public handle resolution for the website — reads the Spaces relay `peek`
// endpoint (a plain JSON dump of the Zone), so the site needs no crypto/WASM
// deps. This is a convenience lookup served by ONE relay; it is NOT the
// on-device, anchor-verified trust the nacho app provides. The UI reflects that
// (it nudges "open in the app to verify").

const RELAY_BASE =
  process.env.NACHO_RELAY_BASE?.replace(/\/$/, "") ??
  "https://relay-orion.spacesprotocol.org";

// Short host label for the "served by" line (e.g. relay-orion.spacesprotocol.org).
export const RELAY_HOST = (() => {
  try {
    return new URL(RELAY_BASE).host;
  } catch {
    return "a Spaces relay";
  }
})();

export type ZoneRecord = {
  type: string; // "addr" | "txt" | "seq" | "sig" | …
  key?: string;
  value?: string[];
  version?: number; // present on the "seq" row — a unix-seconds publish time
};

export type Zone = {
  handle: string;
  canonical?: string;
  sovereignty?: string; // "sovereign" | "dependent" | "unknown"
  num_id?: string | null;
  alias?: string | null;
  anchor?: number; // Bitcoin block height the zone is anchored at
  script_pubkey?: string;
  records: ZoneRecord[];
};

// A displayable record (has a key + at least one value; drops seq/sig meta rows).
export type DisplayRecord = { type: string; key: string; value: string[] };

const HANDLE_RE = /^[a-z0-9._-]*@[a-z0-9._-]+$/i;

export function normalizeHandle(raw: string): string | null {
  const h = decodeURIComponent(raw ?? "").trim().toLowerCase();
  return HANDLE_RE.test(h) ? h : null;
}

// Fetch the zone for a handle, or null if it doesn't resolve. Never throws to
// the caller — a network/parse failure is treated as "not found" for the page,
// which then shows the not-found / buy state.
export async function peek(handle: string): Promise<Zone | null> {
  const h = normalizeHandle(handle);
  if (!h) return null;
  try {
    const res = await fetch(
      `${RELAY_BASE}/peek?q=${encodeURIComponent(h)}`,
      // Cache at the edge for a minute — zones change rarely and this is a public
      // read; keeps SSR + OG-image generation snappy without going stale.
      { next: { revalidate: 60 } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as unknown;
    const arr = Array.isArray(data) ? data : [data];
    const zone = arr.find(
      (z): z is Zone =>
        !!z && typeof z === "object" && Array.isArray((z as Zone).records),
    );
    return zone ?? null;
  } catch {
    return null;
  }
}

// Extract the user-facing records (addr/txt with a key + value), preserving order.
export function displayRecords(zone: Zone): DisplayRecord[] {
  return zone.records.filter(
    (r): r is DisplayRecord =>
      typeof r.key === "string" &&
      r.key.length > 0 &&
      Array.isArray(r.value) &&
      r.value.length > 0 &&
      (r.type === "addr" || r.type === "txt"),
  );
}

export function isSovereign(zone: Zone): boolean {
  return zone.sovereignty === "sovereign";
}

// The zone's last-published time (unix seconds) from the `seq` row, if it's a
// plausible timestamp. This is a freshness signal ("updated 2d ago") — NOT a
// verification claim (the web read is a single relay, not anchor-verified).
export function seqUpdatedAt(zone: Zone): number | null {
  const v = zone.records.find((r) => r.type === "seq")?.version;
  return typeof v === "number" && v > 1_000_000_000 && v < 4_000_000_000
    ? v
    : null;
}
