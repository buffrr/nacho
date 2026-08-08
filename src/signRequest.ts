import type { EditableRecord } from "@/fabricResolver";

// Parses and validates the base64url-JSON envelope carried by a signing request
// (see docs/signing-requests.md). Requests arrive as `nacho://sign?req=…` or
// `https://<domain>/sign?req=…`, delivered by a QR scan or a (universal) link.
// Everything here is UNTRUSTED input — validation is strict and the UI must
// still show the exact effect before the user approves.

export type RecordOp =
  | { op: "set"; rtype: "txt" | "addr"; key: string; value: string[] }
  | { op: "delete"; key: string; rtype?: "txt" | "addr" };

export type RecordsRequest = {
  v: 1;
  type: "records";
  handle?: string;
  ops: RecordOp[];
  origin?: string;
  nonce?: string;
  return?: string;
};

export type PsbtInput = {
  txid: string;
  vout: number;
  amount: number; // sats — committed by the taproot sighash, shown to the user
  script: string; // hex spk; must equal an owned handle's 5120<xonly>
};
export type PsbtOutput = {
  amount: number; // sats
  script: string; // hex spk
};
export type PsbtRequest = {
  v: 1;
  type: "psbt";
  sign: PsbtInput[];
  outputs: PsbtOutput[];
  version?: number;
  locktime?: number;
  origin?: string;
  nonce?: string;
};

export type SignRequest = RecordsRequest | PsbtRequest;

// A QR/deeplink whose shape could be a signing request. The envelope is still
// validated on decode, so a false positive here just yields a clear error.
export function isSignRequestUrl(raw: string): boolean {
  const s = raw.trim();
  return (
    /^nacho:\/\/sign\b/i.test(s) || /^https?:\/\/[^/]+\/sign\b/i.test(s)
  );
}

// Pull the `req=` payload out of a sign URL (already URL-decoded).
export function extractReqParam(raw: string): string | null {
  const m = raw.match(/[?&]req=([^&#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function base64urlToUtf8(b64url: string): string {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(b64, "base64").toString("utf8");
}

// Encode an envelope back to a `nacho://sign?req=…` URL (for the test generator
// and for round-trip tests).
export function encodeSignRequest(req: SignRequest, base = "nacho://sign"): string {
  const json = JSON.stringify(req);
  const b64url = Buffer.from(json, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${base}?req=${b64url}`;
}

// Decode + validate a `req` payload (the base64url string, not the whole URL).
export function decodeSignRequest(req: string): SignRequest {
  let json: unknown;
  try {
    json = JSON.parse(base64urlToUtf8(req));
  } catch {
    throw new Error("Malformed request — not valid base64url JSON.");
  }
  return validateSignRequest(json);
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

export function validateSignRequest(json: unknown): SignRequest {
  if (!json || typeof json !== "object") {
    throw new Error("Malformed request.");
  }
  const o = json as Record<string, unknown>;
  if (o.v !== 1) {
    throw new Error(`Unsupported request version (${String(o.v)}).`);
  }
  if (o.type === "records") return validateRecordsRequest(o);
  if (o.type === "psbt") return validatePsbtRequest(o);
  throw new Error(`Unknown request type (${String(o.type)}).`);
}

function validateRecordsRequest(o: Record<string, unknown>): RecordsRequest {
  if (!Array.isArray(o.ops) || o.ops.length === 0) {
    throw new Error("Request has no record operations.");
  }
  const ops: RecordOp[] = o.ops.map((raw, i) => {
    if (!raw || typeof raw !== "object") {
      throw new Error(`Operation ${i + 1} is malformed.`);
    }
    const op = raw as Record<string, unknown>;
    if (typeof op.key !== "string" || op.key.length === 0) {
      throw new Error(`Operation ${i + 1} is missing a key.`);
    }
    if (op.op === "delete") {
      if (op.rtype !== undefined && op.rtype !== "txt" && op.rtype !== "addr") {
        throw new Error(`Operation ${i + 1} has an invalid record type.`);
      }
      return {
        op: "delete",
        key: op.key,
        ...(op.rtype ? { rtype: op.rtype as "txt" | "addr" } : {}),
      };
    }
    if (op.op === "set") {
      if (op.rtype !== "txt" && op.rtype !== "addr") {
        throw new Error(`Operation ${i + 1} has an invalid record type.`);
      }
      if (!isStringArray(op.value) || op.value.length === 0) {
        throw new Error(`Operation ${i + 1} is missing a value.`);
      }
      return { op: "set", rtype: op.rtype, key: op.key, value: op.value };
    }
    throw new Error(`Operation ${i + 1} has an unknown op (${String(op.op)}).`);
  });

  return {
    v: 1,
    type: "records",
    ops,
    ...(typeof o.handle === "string" ? { handle: o.handle } : {}),
    ...(typeof o.origin === "string" ? { origin: o.origin } : {}),
    ...(typeof o.nonce === "string" ? { nonce: o.nonce } : {}),
    ...(typeof o.return === "string" ? { return: o.return } : {}),
  };
}

function validatePsbtRequest(o: Record<string, unknown>): PsbtRequest {
  const parseInput = (raw: unknown, i: number): PsbtInput => {
    const x = raw as Record<string, unknown>;
    if (!x || typeof x !== "object") throw new Error(`Input ${i + 1} is malformed.`);
    if (typeof x.txid !== "string" || !/^[0-9a-fA-F]{64}$/.test(x.txid))
      throw new Error(`Input ${i + 1} has an invalid txid.`);
    if (typeof x.vout !== "number" || x.vout < 0)
      throw new Error(`Input ${i + 1} has an invalid vout.`);
    if (typeof x.amount !== "number" || x.amount <= 0)
      throw new Error(`Input ${i + 1} has an invalid amount.`);
    if (typeof x.script !== "string" || !/^[0-9a-fA-F]+$/.test(x.script))
      throw new Error(`Input ${i + 1} has an invalid script.`);
    return { txid: x.txid, vout: x.vout, amount: x.amount, script: x.script.toLowerCase() };
  };
  const parseOutput = (raw: unknown, i: number): PsbtOutput => {
    const x = raw as Record<string, unknown>;
    if (!x || typeof x !== "object") throw new Error(`Output ${i + 1} is malformed.`);
    if (typeof x.amount !== "number" || x.amount < 0)
      throw new Error(`Output ${i + 1} has an invalid amount.`);
    if (typeof x.script !== "string" || !/^[0-9a-fA-F]+$/.test(x.script))
      throw new Error(`Output ${i + 1} has an invalid script.`);
    return { amount: x.amount, script: x.script.toLowerCase() };
  };

  if (!Array.isArray(o.sign) || o.sign.length === 0)
    throw new Error("Request has no inputs to sign.");
  if (!Array.isArray(o.outputs) || o.outputs.length === 0)
    throw new Error("Request has no outputs.");
  const sign = o.sign.map(parseInput);
  const outputs = o.outputs.map(parseOutput);
  // SIGHASH_SINGLE binds input i to output i, so there must be an output per input.
  if (outputs.length < sign.length)
    throw new Error("Each signed input needs a matching output (SIGHASH_SINGLE).");

  return {
    v: 1,
    type: "psbt",
    sign,
    outputs,
    ...(typeof o.version === "number" ? { version: o.version } : {}),
    ...(typeof o.locktime === "number" ? { locktime: o.locktime } : {}),
    ...(typeof o.origin === "string" ? { origin: o.origin } : {}),
    ...(typeof o.nonce === "string" ? { nonce: o.nonce } : {}),
  };
}

// The diff produced by applying record ops to the current zone, for the
// confirmation UI and to compute the record set to publish.
export type RecordDiff = {
  next: EditableRecord[];
  added: EditableRecord[];
  replaced: { before: EditableRecord; after: EditableRecord }[];
  removed: EditableRecord[];
};

// Apply `ops` to the live record set (matched by type+key). `set` upserts;
// `delete` removes by key (and type if given). Pure — returns the new set + diff.
export function applyOps(current: EditableRecord[], ops: RecordOp[]): RecordDiff {
  const next = current.map((r) => ({ ...r, value: [...r.value] }));
  const added: EditableRecord[] = [];
  const replaced: { before: EditableRecord; after: EditableRecord }[] = [];
  const removed: EditableRecord[] = [];

  for (const op of ops) {
    if (op.op === "set") {
      const idx = next.findIndex((r) => r.type === op.rtype && r.key === op.key);
      const after: EditableRecord = { type: op.rtype, key: op.key, value: op.value };
      if (idx >= 0) {
        replaced.push({ before: next[idx], after });
        next[idx] = after;
      } else {
        added.push(after);
        next.push(after);
      }
    } else {
      for (let i = next.length - 1; i >= 0; i--) {
        const r = next[i];
        if (r.key === op.key && (op.rtype === undefined || r.type === op.rtype)) {
          removed.push(r);
          next.splice(i, 1);
        }
      }
    }
  }

  return { next, added, replaced, removed };
}