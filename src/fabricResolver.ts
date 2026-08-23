// Platform-agnostic Fabric resolution logic shared by the native and web
// wrappers (src/fabric.ts and src/fabric.web.ts). Kept decoupled from the
// concrete package via a structural type so the same code drives both the
// react-native-libveritas and WASM backends.

export type VerificationBadge = "orange" | "unverified" | "none";

// Records are heterogeneous (seq/txt/addr carry key+value, sig carries a
// signature, etc.). We keep the raw shape and let the UI render per-type.
export type FabricRecord = {
  type: string;
  key?: string;
  value?: string[];
  version?: number;
  sig?: string;
  [k: string]: unknown;
};

export type ZoneJson = {
  handle: string;
  canonical?: string;
  alias?: string | null;
  sovereignty?: string;
  script_pubkey?: string;
  num_id?: string;
  anchor?: number;
  records?: FabricRecord[];
  [k: string]: unknown;
};

export type ResolvedHandle = {
  handle: string;
  badge: VerificationBadge;
  zone: ZoneJson;
};

// A single editable SIP-7 record (key/value types). seq is handled separately.
export type EditableRecord = {
  type: "txt" | "addr";
  key: string;
  value: string[];
};

// Pull the editable records and current sequence number out of a resolved zone.
export function editableFromZone(zone: ZoneJson): {
  records: EditableRecord[];
  seq: number;
} {
  const records: EditableRecord[] = [];
  let seq = 0;
  for (const r of zone.records ?? []) {
    if (r.type === "seq") {
      seq = Number(r.version ?? 0);
    } else if (
      (r.type === "txt" || r.type === "addr") &&
      typeof r.key === "string"
    ) {
      records.push({
        type: r.type,
        key: r.key,
        value: Array.isArray(r.value) ? r.value.map(String) : [],
      });
    }
  }
  return { records, seq };
}

// True only when a resolve failed because the queried name is *provably* absent
// — the relay returned a valid proof that simply doesn't cover the name, and
// libveritas raises a "<name> not found in proof" (or "… not found for …")
// VerificationFailed. That's a genuine not-found, so the UI can show the clean
// not-found state instead of a scary "verification error".
//
// This is deliberately NARROW and must stay that way: a verification failure on
// a name that DOES exist — a tampered or forged proof, a root/anchor mismatch,
// an incomplete proof ("Root mismatch", "proof is invalid", "Incomplete proof")
// — carries a *different* message and MUST keep surfacing as an error rather
// than being masked as "not found". Network/relay/decode failures (no peers,
// http error, relay 5xx) don't match either, so they propagate too. Do NOT
// widen this to the bare VerificationFailed tag — that tag covers both cases.
export function isNotFoundResolveError(e: unknown): boolean {
  const msg = String((e as { message?: unknown } | null)?.message ?? e ?? "");
  return /not found in proof|not found for /i.test(msg);
}

// Pull a human-meaningful reason out of a resolve/verify error for display.
//
// libveritas' VeritasError carries the real detail in `.inner.msg` (e.g. "root
// mismatch", "name not found in proof", "incomplete proof"). But fabric-core
// wraps verify failures as `verification error: ${e}` (FabricError with no
// `cause`), which flattens the object to just its enum name —
// "verification error: Error: VeritasError.VerificationFailed" — so the inner
// detail is usually gone by the time we catch it. We therefore: (1) defensively
// look for a surviving `inner.msg`/`cause` in case some path preserves it, then
// (2) unwrap the redundant "verification error: Error:" noise, and (3) map the
// bare variant to a readable sentence when that's all we have.
export function verifyErrorDetail(e: unknown): string {
  const err = e as
    | { inner?: { msg?: unknown }; cause?: any; message?: unknown }
    | null
    | undefined;
  const innerMsg =
    (typeof err?.inner?.msg === "string" && err.inner.msg) ||
    (typeof err?.cause?.inner?.msg === "string" && err.cause.inner.msg) ||
    (typeof err?.cause?.message === "string" && err.cause.message) ||
    "";
  let msg = innerMsg || (typeof err?.message === "string" ? err.message : String(e));
  msg = msg
    .replace(/verification error:\s*/gi, "")
    .replace(/\b(?:Fabric)?Error:\s*/g, "")
    .trim();
  if (!innerMsg) {
    if (/VeritasError\.VerificationFailed/i.test(msg))
      return "Proof failed to verify against the trust anchor — it may be stale, incomplete, or tampered.";
    if (/VeritasError\.InvalidInput/i.test(msg))
      return "Malformed response — the proof couldn’t be parsed.";
  }
  return msg || "Verification failed.";
}

// The message to SHOW for a resolve/verify failure. libveritas' reasons (now
// surfaced verbatim via fabric ≥ 0.2.9) carry the specifics worth seeing — e.g.
// "anchor <root> is stale, oldest is <height>" tells you exactly which block
// heights disagree — so we show them as-is (sentence-cased), NOT a lossy
// generic sentence. Only the fallback (pre-0.2.9 / no detail) gets a canned
// line, handled inside verifyErrorDetail.
export function verifyErrorMessage(e: unknown): string {
  const detail = verifyErrorDetail(e);
  return detail
    ? detail.charAt(0).toUpperCase() + detail.slice(1)
    : "Couldn’t verify against a trust anchor.";
}

// A stale trust anchor is fixable by refreshing to the current tip — the UI uses
// this to offer "Refresh & try again" instead of a plain retry.
export function isStaleAnchorError(e: unknown): boolean {
  return /\bstale\b/i.test(verifyErrorDetail(e));
}

interface FabricZoneLike {
  handle: string;
  toJson(): any;
}

export interface FabricLike {
  resolve(handle: string): Promise<FabricZoneLike | null>;
  badge(zone: FabricZoneLike): VerificationBadge;
}

export async function resolveWith(
  fabric: FabricLike,
  handle: string,
): Promise<ResolvedHandle | null> {
  const zone = await fabric.resolve(handle);
  if (!zone) {
    return null;
  }
  const badge = fabric.badge(zone);
  const json = (zone.toJson() ?? {}) as ZoneJson;
  return { handle: zone.handle, badge, zone: json };
}

// Resolution + the full certificate chain in one round trip (fabric 0.2.8).
// `parents` are the parent-space zones ordered [parent, grandparent, …, TLD],
// each with its own commitment/sovereignty (read from its ZoneJson). `certs` is
// the exportable `.spacecert` chain. Use this when we don't yet hold a final
// cert; once final, stop calling it (it's an expensive multi-zone fetch).
export type ResolvedWithCerts = {
  handle: string;
  badge: VerificationBadge;
  zone: ZoneJson;
  parents: ZoneJson[];
  certs: Uint8Array;
};

export interface FabricWithCertsLike extends FabricLike {
  resolveWithCerts(handle: string): Promise<{
    zone: FabricZoneLike;
    parents: FabricZoneLike[];
    certs: Uint8Array;
  } | null>;
}

export async function resolveWithCertsWith(
  fabric: FabricWithCertsLike,
  handle: string,
): Promise<ResolvedWithCerts | null> {
  const res = await fabric.resolveWithCerts(handle);
  if (!res) return null;
  return {
    handle: res.zone.handle,
    badge: fabric.badge(res.zone),
    zone: (res.zone.toJson() ?? {}) as ZoneJson,
    parents: (res.parents ?? []).map((p) => (p.toJson() ?? {}) as ZoneJson),
    certs: res.certs,
  };
}
