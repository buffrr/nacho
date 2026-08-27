import type { EditableRecord } from "@/fabricResolver";
import type { CertState } from "@/certState";
import type { Pill } from "@/handleTile";

// Shared types + pure helpers for the owner handle view, so the iOS (swift-ui
// List, with drag-to-reorder / swipe-to-delete) and web/Android (universal
// FieldGroup) implementations stay in lockstep.

export type ListingSummary = { id: string; kind: "sale" | "transfer"; price?: number };

export type BannerTone = "error" | "success" | "muted" | "pending";

export type OwnerProfileProps = {
  handle: string;
  records: EditableRecord[];
  pubkey: string;
  numId?: string | null;
  alias?: string | null;
  seq: number;
  pill: Pill;
  sovereign: boolean;
  unverified?: boolean;
  // Unpublished-changes affordances: `dirty` drives the status caption, and
  // `changed[i]` accent-tints the i-th record's value (new/edited/moved).
  dirty?: boolean;
  changed?: boolean[];
  // Total unpublished changes for the badge (includes deletions, which have no
  // dotted row — so this can exceed the number of `changed` flags).
  changeCount?: number;
  // Legacy "…→Reorder" mode (web/Android up-down chevrons). iOS ignores it —
  // reordering there is native drag via onMoveRecord.
  reordering?: boolean;
  onMoveUp?: (index: number) => void;
  onMoveDown?: (index: number) => void;
  // Native drag (iOS): move a record from→to (splice semantics).
  onMoveRecord?: (from: number, to: number) => void;
  // Native swipe-to-delete (iOS).
  onDeleteRecord?: (index: number) => void;
  banner?: { text: string; tone: BannerTone } | null;
  copied: string | null;
  certState: CertState;
  listings: ListingSummary[];
  onEditRecord: (index: number) => void;
  onAddRecord: () => void;
  onCopy: (id: string, value: string) => void;
  onOpenCert: () => void;
  onCancelListings: () => void;
  onRefresh: () => Promise<void>;
};

export const CERT_LABEL: Record<CertState, string> = {
  provisional: "Provisional",
  confirming: "Confirming",
  final: "Final",
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function lastPublished(seq: number): string | null {
  if (seq <= 1_000_000_000) return null; // not a unix-seconds seq
  const d = new Date(seq * 1000);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export function short(v: string): string {
  return v.length <= 20 ? v : `${v.slice(0, 8)}…${v.slice(-8)}`;
}
