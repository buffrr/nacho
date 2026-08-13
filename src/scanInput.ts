import { isSignRequestUrl } from "@/signRequest";

// Interpret text coming from a QR scan or the clipboard. It may be a handle
// (satoshi@bitcoin), a payment URI (bitcoin:/lightning:), a raw BOLT11 invoice,
// or a nacho signing request (nacho://sign / https://<domain>/sign). The Scan
// screen routes handles to Resolve, opens URIs, and sends sign requests to the
// confirmation screen.
export type ScanInput =
  | { kind: "handle"; value: string }
  | { kind: "uri"; value: string }
  | { kind: "sign"; value: string }
  | { kind: "trust"; value: string }
  | { kind: "unknown"; value: string };

const HANDLE_RE = /^[a-z0-9._-]+@[a-z0-9._-]+$/i;

export function interpret(raw: string): ScanInput {
  const text = raw.trim();
  if (!text) return { kind: "unknown", value: text };

  // A Veritas Trust ID (`veritas://scan?id=…`). Critical — pinning it changes how
  // every handle is verified — so the Scan screen must route it to an explicit
  // approval, never pin it silently. Checked first so it can't fall through.
  if (/^veritas:\/\//i.test(text)) return { kind: "trust", value: text };

  // A signing request (checked next — its URL would otherwise fall through as
  // "unknown"). The envelope is validated later, on the confirmation screen.
  if (isSignRequestUrl(text)) return { kind: "sign", value: text };

  const lower = text.toLowerCase();
  if (
    lower.startsWith("bitcoin:") ||
    lower.startsWith("lightning:") ||
    lower.startsWith("lnbc") ||
    lower.startsWith("lnurl")
  ) {
    // Normalise a bare invoice into a lightning: URI so it can be opened.
    const value =
      lower.startsWith("lnbc") || lower.startsWith("lnurl")
        ? `lightning:${text}`
        : text;
    return { kind: "uri", value };
  }

  // A handle may arrive wrapped in a scheme (e.g. "handle:satoshi@bitcoin").
  const stripped = text.replace(/^[a-z]+:/i, "");
  if (HANDLE_RE.test(stripped)) {
    return { kind: "handle", value: stripped.toLowerCase() };
  }

  return { kind: "unknown", value: text };
}

// OCR grammar: recognized frames come back as noisy lines of text, so unlike a
// checksum-validated QR payload we must find a token that strictly parses as a
// handle. URIs are intentionally NOT accepted from OCR (a mis-read address/
// invoice has no checksum feedback here); handles are self-correcting because
// resolution confirms them, and the Scan screen additionally requires two
// consecutive identical matches. Returns the first handle found, else null.
export function matchOcrLines(lines: string[]): ScanInput | null {
  for (const line of lines) {
    for (const rawToken of line.split(/\s+/)) {
      // Trim punctuation/quotes OCR often glues onto the token edges.
      const token = rawToken
        .replace(/^[^a-z0-9]+/i, "")
        .replace(/[^a-z0-9._@-]+$/i, "");
      if (!token.includes("@")) continue;
      const res = interpret(token);
      if (res.kind === "handle") return res;
    }
  }
  return null;
}
