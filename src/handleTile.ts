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
      case "dependent":
        return { label: "Registered", ...blue };
      case "pending":
        return { label: "Pending inclusion", ...amber };
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

export type AvatarColors = { bg: string; fg: string };

// Deterministic tinted avatar (pastel background + saturated glyph) per handle.
// bg comes from the theme so it adapts to light/dark; fg is a fixed saturated
// tone that reads on both, index-matched to bg so the pair always agrees.
const AVATAR_FG = [
  "#088C70", // teal
  "#C2410C", // orange
  "#7C3AED", // lavender
  "#A16207", // gold
  "#2567CA", // blue
  "#C81E78", // pink
];

export function avatarColors(c: Colors, handle: string): AvatarColors {
  const bgs = [
    c.tileTealBg,
    c.tileOrangeBg,
    c.tileLavenderBg,
    c.tileGoldBg,
    c.tileBlueBg,
    c.tilePinkBg,
  ];
  let h = 0;
  for (let i = 0; i < handle.length; i++) {
    h = (h * 31 + handle.charCodeAt(i)) >>> 0;
  }
  const i = h % bgs.length;
  return { bg: bgs[i], fg: AVATAR_FG[i] };
}
