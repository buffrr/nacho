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
