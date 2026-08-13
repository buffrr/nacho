import type { Colors } from "@/theme";
import type { HandleStatus } from "@/api";
import type { HandleResolution } from "@/Store";

// A v2 status pill: label with a foreground color on a tinted background.
export type Pill = { label: string; fg: string; bg: string };

export function handlePill(
  c: Colors,
  args: {
    resolution?: HandleResolution;
    keyMismatch: boolean;
    hasCert: boolean;
    status?: HandleStatus["status"] | null;
    scriptMatches: boolean | null;
  },
): Pill {
  const { resolution, keyMismatch, hasCert, status, scriptMatches } = args;
  const green = { fg: c.statusGreenFg, bg: c.statusGreenBg };
  const blue = { fg: c.statusBlueFg, bg: c.statusBlueBg };
  const amber = { fg: c.statusAmberFg, bg: c.statusAmberBg };
  const grey = { fg: c.statusGreyFg, bg: c.statusGreyBg };
  const red = { fg: c.dangerText, bg: c.dangerBg };

  if (keyMismatch) {
    return { label: "Different key", ...red };
  }
  if (resolution?.found) {
    switch (resolution.sovereignty) {
      case "sovereign":
        return { label: "Sovereign", ...green };
      // Registered but not yet anchored on-chain — shown neutrally as
      // "Registered"; the "Anchored: Not yet" detail carries the nuance.
      case "dependent":
      case "pending":
        return { label: "Registered", ...blue };
      default:
        return { label: resolution.sovereignty, ...grey };
    }
  }
  if (hasCert) {
    return { label: "Registered", ...blue };
  }
  if (status === "taken" && scriptMatches) {
    return { label: "Import certificate", ...grey };
  }
  if (status === "reserved" || status === "processing_payment") {
    return { label: "Pending inclusion", ...amber };
  }
  if (status === "available") {
    return { label: "Available", ...green };
  }
  return { label: "Not registered", ...grey };
}

// ── v2 list tile ─────────────────────────────────────────────────────────────
// img_11: rows no longer carry a status pill. Instead an inline status icon sits
// next to the name and a muted subtitle line carries either the record count or
// the current status. `attention` rows get an orange highlight to draw the eye.
export type TileStatus =
  | "sovereign" // final cert, proven on-chain → green shield
  | "anchoring" // registered / temp cert, not yet sovereign → amber clock
  | "waiting" // owned but no cert yet → grey, no inline icon
  | "attention" // needs the user to act (import a cert) → amber alert + highlight
  | "none"; // nothing notable

export type TileInfo = {
  status: TileStatus;
  subtitle: string;
  attention: boolean;
};

// Compact "2m", "3h", "5d" relative age for the "Waiting for certificate" line.
function ago(ts: number | undefined): string | null {
  if (!ts) return null;
  const secs = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function handleTileInfo(args: {
  resolution?: HandleResolution;
  keyMismatch: boolean;
  hasCert: boolean;
  isImported: boolean;
  recordCount: number;
}): TileInfo {
  const { resolution, keyMismatch, hasCert, isImported, recordCount } = args;
  const records =
    recordCount > 0
      ? `${recordCount} record${recordCount === 1 ? "" : "s"}`
      : "No records yet";

  if (keyMismatch) {
    return {
      status: "attention",
      subtitle: "Different key — import to use",
      attention: true,
    };
  }
  if (resolution?.found) {
    if (resolution.sovereignty === "sovereign") {
      return { status: "sovereign", subtitle: records, attention: false };
    }
    // pending / dependent → still anchoring to Bitcoin.
    return { status: "anchoring", subtitle: records, attention: false };
  }
  if (hasCert) {
    // Have a cert but haven't re-resolved yet — treat as anchoring.
    return { status: "anchoring", subtitle: records, attention: false };
  }
  if (isImported) {
    return {
      status: "attention",
      subtitle: "No certificate — import to use",
      attention: true,
    };
  }
  const checked = ago(resolution?.updatedAt);
  return {
    status: "waiting",
    subtitle: checked
      ? `Waiting for certificate · ${checked}`
      : "Waiting for certificate",
    attention: false,
  };
}

// A single calm avatar gradient for every handle — the desaturated tone
// iMessage/Contacts uses for an initial avatar: a vertical gradient, lighter at
// the top. Dark mode is the grey-purple (bottom #2D283F → top #555265); light
// mode is the airy blue (bottom #7580BA → top #A6BFDE). <Avatar> draws the first
// stop at the TOP, so `from` is the lighter top colour. Dropping per-handle
// colours reads calmer and more mature (the handle string is the identity).
const AVATAR_DARK: [string, string] = ["#555265", "#2D283F"];
const AVATAR_LIGHT: [string, string] = ["#A6BFDE", "#7580BA"];

// Signature takes a handle (kept for callers) plus the colour scheme; the colour
// is constant per scheme, independent of the handle.
export function avatarGradient(
  _handle: string,
  scheme: "light" | "dark" = "dark",
): [string, string] {
  return scheme === "light" ? AVATAR_LIGHT : AVATAR_DARK;
}
