import { HandleStatus } from "@/api";

// price is only ever set for the purchasable ("Available") state, so a badge and
// its price can never disagree.
export type StatusBadge = { label: string; color: string; price?: number };

export const STATUS_COLOR = {
  green: "#10B981",
  orange: "#FF7B00",
  red: "#FF4D4D",
  gray: "#6B6B6B",
};

// Whether an on-chain status belongs to our own key. Returns null when the
// status carries no script (e.g. available/unknown) so we can't compare.
export function scriptMatchesStatus(
  status: HandleStatus,
  ourScript: string,
): boolean | null {
  if ("script_pubkey" in status) {
    return status.script_pubkey === ourScript;
  }
  return null;
}

// Badge derived from a resolved handle's certrelay sovereignty. Unknown values
// are shown verbatim so a fuller protocol enum won't break the UI.
export function sovereigntyBadge(sovereignty: string): StatusBadge {
  switch (sovereignty) {
    case "sovereign":
      return { label: "Sovereign", color: STATUS_COLOR.green };
    case "dependent":
      return { label: "Temporary cert", color: STATUS_COLOR.orange };
    case "pending":
      return { label: "Pending", color: STATUS_COLOR.gray };
    default:
      return { label: sovereignty, color: STATUS_COLOR.gray };
  }
}

// Human-readable explanation of a sovereignty state, for the detail view.
export function sovereigntyDescription(sovereignty: string): string | null {
  switch (sovereignty) {
    case "sovereign":
      return "Anchored to its own space on-chain.";
    case "dependent":
      return "Temporary certificate issued by an operator.";
    case "pending":
      return "Awaiting on-chain finalization.";
    default:
      return null;
  }
}

export function getHandleBadge(params: {
  status: HandleStatus["status"] | null;
  hasCert: boolean;
  scriptMatches: boolean | null;
  price?: number;
}): StatusBadge {
  const { status, hasCert, scriptMatches, price } = params;

  // Registered to our key (we hold the certificate, or the on-chain key matches).
  // Ownership wins over any stale "available"/price the server might report.
  if (hasCert) {
    return { label: "Owned", color: STATUS_COLOR.green };
  }
  if (status === null) {
    return { label: "Checking…", color: STATUS_COLOR.gray };
  }

  const ownedByOther =
    scriptMatches === false &&
    (status === "taken" ||
      status === "reserved" ||
      status === "processing_payment");
  if (ownedByOther) {
    return { label: "Taken", color: STATUS_COLOR.red };
  }

  switch (status) {
    case "taken":
      return { label: "Owned", color: STATUS_COLOR.green };
    case "reserved":
    case "processing_payment":
      return { label: "Reserved", color: STATUS_COLOR.orange };
    case "available":
      // The only state that carries a price.
      return { label: "Available", color: STATUS_COLOR.orange, price };
    case "preallocated":
      return { label: "Preallocated", color: STATUS_COLOR.gray };
    case "invalid":
    case "unknown":
    default:
      return { label: "Not registered", color: STATUS_COLOR.gray };
  }
}
