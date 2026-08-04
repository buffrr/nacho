// Interpret text coming from a QR scan or the clipboard. It may be a handle
// (satoshi@bitcoin), a payment URI (bitcoin:/lightning:), or a raw BOLT11
// invoice. The Scan screen routes handles to Resolve and opens URIs directly.
export type ScanInput =
  | { kind: "handle"; value: string }
  | { kind: "uri"; value: string }
  | { kind: "unknown"; value: string };

const HANDLE_RE = /^[a-z0-9._-]+@[a-z0-9._-]+$/i;

export function interpret(raw: string): ScanInput {
  const text = raw.trim();
  if (!text) return { kind: "unknown", value: text };

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
