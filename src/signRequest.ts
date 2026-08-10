import type { EditableRecord } from "@/fabricResolver";

// Parses + validates the base64url-JSON envelope carried by a signing request
// (see design-notes.md / docs/signing-v2-plan.md). Requests arrive as
// `nacho://sign?req=…` or `https://<domain>/sign?req=…` via QR or (universal)
// link. Everything here is UNTRUSTED — validation is strict and the UI still
// shows the exact effect before the user approves.

// ---- shared shapes ----------------------------------------------------------

export type Outpoint = { txid: string; vout: number; amount: number };

type CommonFields = {
  v: 1;
  exp: number; // unix seconds — required; rejected when past
  ref?: string; // opaque caller reference — echoed back, NEVER displayed
  endpoint?: string; // https only — host derived from here is the only nameable one
  return?: string; // https only
};

export type RecordOp =
  | { op: "set"; rtype: "txt" | "addr"; key: string; value: string[] }
  | { op: "delete"; key: string; rtype?: "txt" | "addr" };

export type MessageRequest = CommonFields & {
  type: "message";
  handle?: string;
  challenge: string;
};
export type RecordsRequest = CommonFields & {
  type: "records";
  handle?: string;
  ops: RecordOp[];
};
export type TransferRequest = CommonFields & {
  type: "transfer";
  handle: string;
  to: string; // recipient spk (hex)
  outpoint: Outpoint;
};
export type SaleRequest = CommonFields & {
  type: "sale";
  handle: string;
  price: number; // base units (₿); output = input + price
  outpoint: Outpoint;
};
export type RotateRequest = CommonFields & {
  type: "rotate";
  handle: string;
  outpoint: Outpoint;
};

export type SignRequest =
  | MessageRequest
  | RecordsRequest
  | TransferRequest
  | SaleRequest
  | RotateRequest;

// ---- URL detection + payload extraction ------------------------------------

export function isSignRequestUrl(raw: string): boolean {
  const s = raw.trim();
  return /^nacho:\/\/sign\b/i.test(s) || /^https?:\/\/[^/]+\/sign\b/i.test(s);
}

export function extractReqParam(raw: string): string | null {
  const m = raw.match(/[?&]req=([^&#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function base64urlToUtf8(b64url: string): string {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(b64, "base64").toString("utf8");
}

// For the test generator / round-trip tests.
export function encodeSignRequest(req: SignRequest, base = "nacho://sign"): string {
  const b64url = Buffer.from(JSON.stringify(req), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${base}?req=${b64url}`;
}

// ---- endpoint / return URL validation --------------------------------------

// Returns the display host if valid, else throws. https-only in production;
// `http://localhost[:port]` tolerated only in dev builds. Rejects private /
// loopback / link-local hosts and non-standard ports — an arbitrary scheme or a
// LAN address lets a QR pivot into another app or an internal service.
export function validateEndpointUrl(raw: string): string {
  const m = raw.match(/^([a-z][a-z0-9+.-]*):\/\/([^/:?#]+)(?::(\d+))?/i);
  if (!m) throw new Error("Invalid endpoint URL.");
  const scheme = m[1].toLowerCase();
  const host = m[2].toLowerCase();
  const port = m[3] ? Number(m[3]) : undefined;

  const isLocalhost = host === "localhost" || host === "127.0.0.1" || host === "::1";
  const devLocal = __DEV__ && scheme === "http" && isLocalhost;

  if (scheme !== "https" && !devLocal) {
    throw new Error("Endpoint must be https.");
  }
  if (!devLocal) {
    if (isLocalhost) throw new Error("Endpoint host not allowed.");
    if (
      /^(10\.|127\.|0\.)/.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      /^169\.254\./.test(host) ||
      host.endsWith(".local")
    ) {
      throw new Error("Endpoint host not allowed.");
    }
    if (port !== undefined && port !== 443) {
      throw new Error("Endpoint port not allowed.");
    }
  }
  return host;
}

// ---- decode + validate ------------------------------------------------------

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

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

// Validate the fields common to every type; returns them normalized.
function validateCommon(o: Record<string, unknown>): CommonFields {
  if (o.v !== 1) throw new Error(`Unsupported request version (${String(o.v)}).`);
  if (typeof o.exp !== "number" || !Number.isFinite(o.exp)) {
    throw new Error("Request is missing an expiry.");
  }
  if (o.exp <= nowSeconds()) throw new Error("This request has expired.");
  const common: CommonFields = { v: 1, exp: o.exp };
  if (typeof o.ref === "string") common.ref = o.ref; // echoed, never shown
  if (typeof o.endpoint === "string") {
    validateEndpointUrl(o.endpoint); // throws if invalid
    common.endpoint = o.endpoint;
  }
  if (typeof o.return === "string") {
    validateEndpointUrl(o.return);
    common.return = o.return;
  }
  return common;
}

function validateOutpoint(raw: unknown): Outpoint {
  const x = raw as Record<string, unknown>;
  if (!x || typeof x !== "object") throw new Error("Missing outpoint.");
  if (typeof x.txid !== "string" || !/^[0-9a-fA-F]{64}$/.test(x.txid))
    throw new Error("Invalid outpoint txid.");
  if (typeof x.vout !== "number" || x.vout < 0 || !Number.isInteger(x.vout))
    throw new Error("Invalid outpoint vout.");
  if (typeof x.amount !== "number" || x.amount <= 0 || !Number.isInteger(x.amount))
    throw new Error("Invalid outpoint amount.");
  return { txid: x.txid.toLowerCase(), vout: x.vout, amount: x.amount };
}

function requireHexScript(v: unknown, label: string): string {
  if (typeof v !== "string" || !/^[0-9a-fA-F]+$/.test(v))
    throw new Error(`Invalid ${label}.`);
  return v.toLowerCase();
}

export function validateSignRequest(json: unknown): SignRequest {
  if (!json || typeof json !== "object") throw new Error("Malformed request.");
  const o = json as Record<string, unknown>;
  const common = validateCommon(o);

  switch (o.type) {
    case "message": {
      if (typeof o.challenge !== "string" || o.challenge.length === 0)
        throw new Error("Request has no challenge.");
      return {
        ...common,
        type: "message",
        challenge: o.challenge,
        ...(typeof o.handle === "string" ? { handle: o.handle } : {}),
      };
    }
    case "records":
      return { ...common, ...validateRecordsBody(o) };
    case "transfer":
      return {
        ...common,
        type: "transfer",
        handle: requireHandle(o),
        to: requireHexScript(o.to, "recipient key"),
        outpoint: validateOutpoint(o.outpoint),
      };
    case "sale":
      return {
        ...common,
        type: "sale",
        handle: requireHandle(o),
        price: requirePositiveInt(o.price, "price"),
        outpoint: validateOutpoint(o.outpoint),
      };
    case "rotate":
      return {
        ...common,
        type: "rotate",
        handle: requireHandle(o),
        outpoint: validateOutpoint(o.outpoint),
      };
    default:
      throw new Error(`Unknown request type (${String(o.type)}).`);
  }
}

function requireHandle(o: Record<string, unknown>): string {
  if (typeof o.handle !== "string" || o.handle.length === 0)
    throw new Error("Request is missing a handle.");
  return o.handle;
}

function requirePositiveInt(v: unknown, label: string): number {
  const n = typeof v === "string" ? Number(v) : v;
  if (typeof n !== "number" || !Number.isInteger(n) || n <= 0)
    throw new Error(`Invalid ${label}.`);
  return n;
}

const MAX_OPS = 20; // a request that can't be reviewed can't be consented to

function validateRecordsBody(
  o: Record<string, unknown>,
): Omit<RecordsRequest, keyof CommonFields> {
  if (!Array.isArray(o.ops) || o.ops.length === 0)
    throw new Error("Request has no record operations.");
  if (o.ops.length > MAX_OPS)
    throw new Error(`Too many operations (max ${MAX_OPS}).`);

  const seen = new Set<string>();
  const ops: RecordOp[] = o.ops.map((raw, i) => {
    if (!raw || typeof raw !== "object")
      throw new Error(`Operation ${i + 1} is malformed.`);
    const op = raw as Record<string, unknown>;
    if (typeof op.key !== "string" || op.key.length === 0)
      throw new Error(`Operation ${i + 1} is missing a key.`);

    if (op.op === "delete") {
      if (op.rtype !== undefined && op.rtype !== "txt" && op.rtype !== "addr")
        throw new Error(`Operation ${i + 1} has an invalid record type.`);
      return {
        op: "delete",
        key: op.key,
        ...(op.rtype ? { rtype: op.rtype as "txt" | "addr" } : {}),
      };
    }
    if (op.op === "set") {
      if (op.rtype !== "txt" && op.rtype !== "addr")
        throw new Error(`Operation ${i + 1} has an invalid record type.`);
      if (!isStringArray(op.value) || op.value.length === 0)
        throw new Error(`Operation ${i + 1} is missing a value.`);
      const dupKey = `${op.rtype}:${op.key}`;
      if (seen.has(dupKey))
        throw new Error(`Duplicate ${op.rtype} record "${op.key}".`);
      seen.add(dupKey);
      return { op: "set", rtype: op.rtype, key: op.key, value: op.value };
    }
    throw new Error(`Operation ${i + 1} has an unknown op (${String(op.op)}).`);
  });

  return {
    type: "records",
    ops,
    ...(typeof o.handle === "string" ? { handle: o.handle } : {}),
  };
}

// ---- record diff (records flow) --------------------------------------------

export type RecordDiff = {
  next: EditableRecord[];
  added: EditableRecord[];
  replaced: { before: EditableRecord; after: EditableRecord }[];
  removed: EditableRecord[];
};

// Apply ops to the live record set (matched by type+key). `set` upserts;
// `delete` removes by key (and type if given). Pure — returns new set + diff.
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