// The record rendering registry — mocks2 §05, "one table, four consumers":
// the resolve view, the record editor, the approval-warning tiers, and the
// derived `bitcoin:` URI all read from here. Each entry gives a label, an icon,
// a consequence tier, a primary action (copy vs open), a browse group, and a
// value shape (how many values a key holds and what each is called).
//
// The tier is NEVER inferred from `rtype`: `addr:btc` is a payment destination,
// `addr:nostr` is an identity binding, `addr:tor` is a generic pointer. Anything
// unrecognised falls to a generic entry shown verbatim — a view that guessed a
// tier from the prefix would warn about inert records and stay silent on the one
// that moves money.

import {
  Bitcoin,
  Zap,
  EyeOff,
  Droplet,
  Anchor,
  AtSign,
  Key,
  Lock,
  Terminal,
  Globe,
  FileText,
  Hash,
  XTwitter,
  Instagram,
  Mastodon,
  Telegram,
  Discord,
  Github,
  Mail,
  IconProps,
} from "@/ui/icons";
import { RecordTier } from "@/recordTiers";

export type { RecordTier };
export type RecordAction = "copy" | "open";
export type RecordGroup = "payments" | "identity" | "socials" | "general";

// One slot in a key's value list. SIP-7 stores an ordered, unlabelled string
// list per key; the registry names the slots so the editor can build the right
// form and the resolve view can label multi-value keys (nostr = npub + relays).
export type ValueSlot = {
  label: string;
  placeholder?: string;
  optional?: boolean;
  multi?: boolean; // this slot repeats (e.g. relay hints)
};

export type RecordDef = {
  rtype: "addr" | "txt";
  key: string;
  label: string;
  Icon: (p: IconProps) => React.JSX.Element;
  color: string;
  tier: RecordTier;
  action: RecordAction;
  group: RecordGroup;
  slots: ValueSlot[];
  note?: string; // small qualifier, e.g. "BOLT 12"
};

// Palette mirrors mocks2: payments amber, lightning/identity violet, web blue,
// ark green, everything unrecognised a neutral grey.
const AMBER = "#E08A2E";
const VIOLET = "#8B5CF6";
const BLUE = "#5B9BD5";
const GREEN = "#4BB77B";
const GREY = "#8A857E";

// A single value slot is the common case.
const ONE = (label: string, placeholder?: string): ValueSlot[] => [
  { label, placeholder },
];

const REGISTRY: RecordDef[] = [
  // ── Payments — funds flow to these ────────────────────────────────────────
  { rtype: "addr", key: "btc", label: "Bitcoin address", Icon: Bitcoin, color: AMBER, tier: "destination", action: "copy", group: "payments", slots: ONE("Address", "bc1…") },
  { rtype: "addr", key: "sp", label: "Silent payment", Icon: EyeOff, color: AMBER, tier: "destination", action: "copy", group: "payments", slots: ONE("Silent payment code", "sp1…") },
  { rtype: "addr", key: "ln", label: "Lightning offer", Icon: Zap, color: VIOLET, tier: "destination", action: "copy", group: "payments", note: "BOLT 12", slots: ONE("Offer", "lno1…") },
  { rtype: "addr", key: "liquid", label: "Liquid", Icon: Droplet, color: BLUE, tier: "destination", action: "copy", group: "payments", slots: ONE("Address", "lq1…") },
  { rtype: "addr", key: "ark", label: "Ark", Icon: Anchor, color: GREEN, tier: "destination", action: "copy", group: "payments", slots: ONE("Address", "ark1…") },

  // ── Identity — getting these wrong is impersonation, not lost funds ────────
  {
    rtype: "addr", key: "nostr", label: "Nostr", Icon: AtSign, color: VIOLET, tier: "identity", action: "open", group: "identity",
    slots: [
      { label: "Public key", placeholder: "npub1…" },
      { label: "Relay hints", placeholder: "wss://…", optional: true, multi: true },
    ],
  },
  { rtype: "addr", key: "pgp", label: "PGP fingerprint", Icon: Key, color: GREY, tier: "identity", action: "copy", group: "identity", slots: ONE("Fingerprint") },
  { rtype: "addr", key: "ssh", label: "SSH key", Icon: Terminal, color: GREY, tier: "identity", action: "copy", group: "identity", slots: ONE("Public key") },
  { rtype: "addr", key: "age", label: "age key", Icon: Lock, color: GREY, tier: "identity", action: "copy", group: "identity", slots: ONE("Recipient", "age1…") },
  { rtype: "addr", key: "did", label: "DID", Icon: Key, color: GREY, tier: "identity", action: "copy", group: "identity", slots: ONE("DID", "did:…") },

  // ── Socials — profiles on other services (a wrong one is impersonation) ────
  { rtype: "txt", key: "x", label: "X", Icon: XTwitter, color: GREY, tier: "identity", action: "open", group: "socials", slots: ONE("Username or URL", "@handle") },
  { rtype: "txt", key: "instagram", label: "Instagram", Icon: Instagram, color: "#E1306C", tier: "identity", action: "open", group: "socials", slots: ONE("Username", "@handle") },
  { rtype: "txt", key: "mastodon", label: "Mastodon", Icon: Mastodon, color: "#6364FF", tier: "identity", action: "open", group: "socials", slots: ONE("Address", "@user@server") },
  { rtype: "txt", key: "telegram", label: "Telegram", Icon: Telegram, color: "#229ED9", tier: "identity", action: "open", group: "socials", slots: ONE("Username", "@handle") },
  { rtype: "txt", key: "discord", label: "Discord", Icon: Discord, color: "#5865F2", tier: "identity", action: "copy", group: "socials", slots: ONE("Username") },
  { rtype: "txt", key: "github", label: "GitHub", Icon: Github, color: GREY, tier: "identity", action: "open", group: "socials", slots: ONE("Username") },
  { rtype: "txt", key: "email", label: "Email", Icon: Mail, color: BLUE, tier: "identity", action: "copy", group: "socials", slots: ONE("Address", "you@example.com") },

  // ── General — pointers and free text ──────────────────────────────────────
  { rtype: "txt", key: "website", label: "Website", Icon: Globe, color: BLUE, tier: "generic", action: "open", group: "general", slots: ONE("URL", "https://…") },
  { rtype: "txt", key: "note", label: "Note", Icon: FileText, color: GREY, tier: "generic", action: "copy", group: "general", slots: [{ label: "Text", multi: true }] },
  { rtype: "addr", key: "tor", label: "Onion address", Icon: Globe, color: GREY, tier: "generic", action: "open", group: "general", slots: ONE("Address", ".onion") },
  { rtype: "addr", key: "hyper", label: "HyperDHT key", Icon: Hash, color: GREY, tier: "generic", action: "copy", group: "general", slots: ONE("Key") },
  { rtype: "addr", key: "bep44", label: "BEP 44 key", Icon: Hash, color: GREY, tier: "generic", action: "copy", group: "general", slots: ONE("Key") },
];

// Aliases → canonical key (so a resolved zone using `lightning`/`bitcoin`/etc.
// still lands on the right entry). Only for LOOKUP; we never rewrite the key.
const ALIASES: Record<string, string> = {
  bitcoin: "btc",
  onchain: "btc",
  lightning: "ln",
  bolt12: "ln",
  lnurl: "ln",
  silent: "sp",
  lq: "liquid",
  npub: "nostr",
  url: "website",
  web: "website",
  twitter: "x",
  ig: "instagram",
  tg: "telegram",
  gh: "github",
  mail: "email",
};

const byKey = new Map<string, RecordDef>();
for (const def of REGISTRY) byKey.set(`${def.rtype}:${def.key}`, def);

// The generic fallback for an unrecognised key — shown verbatim, no tier.
function genericDef(rtype: string, key: string): RecordDef {
  return {
    rtype: rtype === "addr" ? "addr" : "txt",
    key,
    label: key, // shown verbatim in monospace by the row renderer
    Icon: FileText,
    color: GREY,
    tier: "generic",
    action: "copy",
    group: "general",
    slots: [{ label: "Value", multi: true }],
  };
}

// Look up the definition for a record. `known` is false when we fell back to the
// generic entry — the renderer shows the key verbatim for those.
export function lookupRecord(
  rtype: string,
  rawKey: string,
): { def: RecordDef; known: boolean } {
  const key = rawKey.toLowerCase();
  const canonical = ALIASES[key] ?? key;
  const hit =
    byKey.get(`${rtype}:${canonical}`) ??
    // some keys (e.g. tor/hyper) are addr in the spec but a caller may store txt
    byKey.get(`addr:${canonical}`) ??
    byKey.get(`txt:${canonical}`);
  if (hit) return { def: hit, known: true };
  return { def: genericDef(rtype, rawKey), known: false };
}

// The registry, grouped for the Add-record picker (payments / identity / general).
export function registryGroups(): Record<RecordGroup, RecordDef[]> {
  const out: Record<RecordGroup, RecordDef[]> = {
    payments: [],
    identity: [],
    socials: [],
    general: [],
  };
  for (const def of REGISTRY) out[def.group].push(def);
  return out;
}

export function allRecordDefs(): RecordDef[] {
  return REGISTRY;
}

// The openable URL for a record whose primary action is "open". Social handles
// are stored bare (e.g. `@alice`), so we build the profile URL per service;
// website/tor values are already URLs (we just ensure a scheme). Returns null
// when there's nothing sensible to open (e.g. a Nostr npub, a Discord username),
// in which case the caller falls back to copy.
export function recordLink(def: RecordDef, raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  const isUrl = /^[a-z][a-z0-9+.-]*:\/\//i.test(v);
  const handle = v.replace(/^@+/, "");
  switch (def.key) {
    case "x":
      return isUrl ? v : `https://x.com/${handle}`;
    case "instagram":
      return isUrl ? v : `https://instagram.com/${handle}`;
    case "telegram":
      return isUrl ? v : `https://t.me/${handle}`;
    case "github":
      return isUrl ? v : `https://github.com/${handle}`;
    case "mastodon": {
      // `@user@server` (or `user@server`) → https://server/@user
      if (isUrl) return v;
      const parts = v.replace(/^@/, "").split("@");
      return parts.length === 2 && parts[0] && parts[1]
        ? `https://${parts[1]}/@${parts[0]}`
        : null;
    }
    case "website":
    case "tor":
      return isUrl ? v : `https://${v}`;
    default:
      // Unknown "open" record: open it only if it's already a URL.
      return isUrl ? v : null;
  }
}

// ── Derived `bitcoin:` URI (mocks2 §01 "handoff, not copy") ─────────────────
// Compose every destination-tier payment record into one BIP-21 URI so a single
// "Pay" action opens the user's wallet and it picks the rail it prefers. Returns
// null when there's nothing payable.
export function paymentUri(
  records: { rtype: string; key: string; value: string }[],
): string | null {
  let btc: string | undefined;
  let sp: string | undefined;
  let ln: string | undefined;
  for (const r of records) {
    if (r.rtype !== "addr" || !r.value) continue;
    const { def, known } = lookupRecord(r.rtype, r.key);
    if (!known || def.tier !== "destination") continue;
    if (def.key === "btc" && !btc) btc = r.value;
    else if (def.key === "sp" && !sp) sp = r.value;
    else if (def.key === "ln" && !ln) ln = r.value;
  }
  const params: string[] = [];
  if (sp) params.push(`sp=${encodeURIComponent(sp)}`);
  if (ln) params.push(`lightning=${encodeURIComponent(ln)}`);
  if (btc) return `bitcoin:${btc}${params.length ? `?${params.join("&")}` : ""}`;
  // No on-chain address but an offer / SP code still gives a usable URI.
  if (ln) return `lightning:${ln}`;
  if (sp) return `bitcoin:${sp}`;
  return null;
}