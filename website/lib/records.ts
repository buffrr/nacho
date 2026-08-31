import type { IconName } from "./icons";

// Record presentation mirroring the app's registry (src/recordRegistry.ts):
// same labels, colours, gradients and icons, so the web profile matches the app.
// Unknown keys fall back to a neutral "file" glyph with the raw key as label.

export type RecordMeta = {
  label: string;
  icon: IconName;
  color: string; // solid squircle colour (used when no gradient)
  gradient?: [string, string] | string[]; // squircle gradient (top-left → bottom-right)
  href?: (v: string) => string; // external profile / link
  pay?: (v: string) => string; // bitcoin: / lightning: URI
};

const AMBER = "#E08A2E";
const VIOLET = "#8B5CF6";
const BLUE = "#5B9BD5";
const GREEN = "#4BB77B";
const GREY = "#8A857E";

const strip = (v: string) => v.replace(/^@+/, "").trim();
const httpsify = (v: string) => (/^https?:\/\//i.test(v) ? v : `https://${v}`);
// user@server → https://server/@user
const masto = (v: string) => {
  const m = strip(v).match(/^([^@]+)@(.+)$/);
  return m ? `https://${m[2]}/@${m[1]}` : httpsify(v);
};

const MAP: Record<string, RecordMeta> = {
  "addr:btc": { label: "Bitcoin address", icon: "bitcoin", color: AMBER, pay: (v) => `bitcoin:${v}` },
  "addr:sp": { label: "Silent payment", icon: "eyeoff", color: AMBER, pay: (v) => `bitcoin:${v}` },
  "addr:ln": { label: "Lightning offer", icon: "zap", color: VIOLET, pay: (v) => `lightning:${v}` },
  "addr:liquid": { label: "Liquid", icon: "droplet", color: BLUE },
  "addr:ark": { label: "Ark", icon: "anchor", color: GREEN },
  "addr:nostr": { label: "Nostr", icon: "nostr", color: "#8E30EB", gradient: ["#7A2FE0", "#B54DFF"], href: (v) => `https://njump.me/${v}` },
  "txt:nostr": { label: "Nostr", icon: "nostr", color: "#8E30EB", gradient: ["#7A2FE0", "#B54DFF"], href: (v) => `https://njump.me/${v}` },
  "addr:pgp": { label: "PGP fingerprint", icon: "key", color: GREY },
  "addr:ssh": { label: "SSH key", icon: "terminal", color: GREY },
  "addr:age": { label: "age key", icon: "lock", color: GREY },
  "addr:did": { label: "DID", icon: "key", color: GREY },
  "txt:x": { label: "X", icon: "x", color: "#000000", gradient: ["#000000", "#232427"], href: (v) => `https://x.com/${strip(v)}` },
  "txt:twitter": { label: "X", icon: "x", color: "#000000", gradient: ["#000000", "#232427"], href: (v) => `https://x.com/${strip(v)}` },
  "txt:bluesky": { label: "Bluesky", icon: "bluesky", color: "#0085FF", gradient: ["#0074E4", "#48B0FF"], href: (v) => `https://bsky.app/profile/${strip(v)}` },
  "txt:instagram": { label: "Instagram", icon: "instagram", color: "#D62976", gradient: ["#FEDA75", "#FA7E1E", "#D62976", "#962FBF", "#4F5BD5"], href: (v) => `https://instagram.com/${strip(v)}` },
  "txt:mastodon": { label: "Mastodon", icon: "mastodon", color: "#6364FF", gradient: ["#5A4BDA", "#8A8CFF"], href: masto },
  "txt:telegram": { label: "Telegram", icon: "telegram", color: "#229ED9", gradient: ["#1C93C4", "#2FB0F0"], href: (v) => `https://t.me/${strip(v)}` },
  "txt:discord": { label: "Discord", icon: "discord", color: "#5865F2", gradient: ["#4752C4", "#7983F6"] },
  "txt:github": { label: "GitHub", icon: "github", color: "#181717", gradient: ["#181717", "#464646"], href: (v) => `https://github.com/${strip(v)}` },
  "txt:email": { label: "Email", icon: "mail", color: BLUE, gradient: ["#4E86BE", "#7BB4E8"], href: (v) => `mailto:${v}` },
  "txt:website": { label: "Website", icon: "globe", color: BLUE, href: (v) => httpsify(v) },
  "txt:note": { label: "Note", icon: "file", color: GREY },
  "txt:notes": { label: "Notes", icon: "file", color: GREY },
  "addr:tor": { label: "Onion address", icon: "globe", color: GREY, href: (v) => `http://${v}` },
  "addr:hyper": { label: "HyperDHT key", icon: "hash", color: GREY },
  "addr:bep44": { label: "BEP 44 key", icon: "hash", color: GREY },
};

export function recordMeta(type: string, key: string): RecordMeta {
  return (
    MAP[`${type}:${key}`] ??
    MAP[`txt:${key}`] ??
    MAP[`addr:${key}`] ?? { label: key, icon: "file", color: GREY }
  );
}

// CSS background for a record squircle — the registry gradient, or a subtle
// derived one from the solid colour so every glyph reads as a filled tile.
export function glyphBackground(m: RecordMeta): string {
  if (m.gradient && m.gradient.length >= 2) {
    return m.gradient.length === 2
      ? `linear-gradient(135deg, ${m.gradient[0]}, ${m.gradient[1]})`
      : `linear-gradient(135deg, ${m.gradient.join(", ")})`;
  }
  return `linear-gradient(135deg, ${shade(m.color, -0.1)}, ${shade(m.color, 0.16)})`;
}

// Lighten (+) / darken (−) a #rrggbb hex by a fraction.
function shade(hex: string, amt: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  const clamp = (x: number) => Math.max(0, Math.min(255, Math.round(x)));
  const r = clamp(((n >> 16) & 255) + 255 * amt);
  const g = clamp(((n >> 8) & 255) + 255 * amt);
  const b = clamp((n & 255) + 255 * amt);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
