import { kvGet, kvSet } from "@/db";
import type { VerificationBadge } from "@/fabricResolver";

// A local log of handles the user has resolved (the "Recents" tab). Purely a
// convenience history — deletable, never authoritative — so it lives in the kv
// table (part of the .sqlite backup) rather than carrying any trust weight. The
// trust status shown is a snapshot from the last resolve; opening a recent
// re-resolves for a fresh answer.

export type ResolveHistoryEntry = {
  handle: string;
  badge: VerificationBadge; // orange | unverified | none
  sovereignty: string; // sovereign | dependent | pending | …
  recordCount: number;
  updatedAt: number; // ms epoch of the last resolve
};

const KEY = "resolve-history";
const LIMIT = 200; // cap the log so it can't grow unbounded

export async function listHistory(): Promise<ResolveHistoryEntry[]> {
  const j = await kvGet(KEY);
  if (!j) return [];
  try {
    const all = JSON.parse(j) as ResolveHistoryEntry[];
    return Array.isArray(all) ? all : [];
  } catch {
    return [];
  }
}

// Upsert an entry to the front (most-recent-first), refreshing its snapshot.
export async function recordResolve(
  entry: Omit<ResolveHistoryEntry, "updatedAt">,
): Promise<void> {
  const all = await listHistory();
  const rest = all.filter((e) => e.handle !== entry.handle);
  rest.unshift({ ...entry, updatedAt: Date.now() });
  await kvSet(KEY, JSON.stringify(rest.slice(0, LIMIT)));
}

export async function removeHistory(handle: string): Promise<void> {
  const all = await listHistory();
  await kvSet(KEY, JSON.stringify(all.filter((e) => e.handle !== handle)));
}

export async function clearHistory(): Promise<void> {
  await kvSet(KEY, JSON.stringify([]));
}