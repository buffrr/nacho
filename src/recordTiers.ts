// Per-key consequence registry for record changes (design-notes.md §5). The tier
// is NEVER inferred from `rtype` — `addr:btc` is funds, `addr:nostr` is a relay
// pointer, a PGP fingerprint is identity. Unknown keys fall to `generic`. Extend
// the table forever; the invariant is that anything unrecognised is generic, not
// payment-tiered by its prefix.

export type RecordTier = "destination" | "identity" | "generic";

const REGISTRY: Record<string, RecordTier> = {
  // funds flow here
  "addr:btc": "destination",
  "addr:ln": "destination",
  "addr:lightning": "destination",
  "addr:lnurl": "destination",
  "addr:sp": "destination",
  "addr:liquid": "destination",
  // identity bindings — getting these wrong means impersonation, not lost funds
  "addr:nostr": "identity",
  "txt:npub": "identity",
  "txt:pgp": "identity",
  "txt:age": "identity",
};

export function tierFor(rtype: string, key: string): RecordTier {
  return REGISTRY[`${rtype}:${key.toLowerCase()}`] ?? "generic";
}

// The warning line for a tier, or null when nothing should be shown (generic —
// warning about inert records trains people to ignore the ones that matter).
export function warningLine(tier: RecordTier): string | null {
  switch (tier) {
    case "destination":
      return "Payments sent to your handle will go to this address.";
    case "identity":
      return "Anyone verifying you through your handle will check against this.";
    default:
      return null;
  }
}

// Destination + identity need an explicit recognition acknowledgement.
export function needsAck(tier: RecordTier): boolean {
  return tier !== "generic";
}
