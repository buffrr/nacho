import { ResolvedHandle } from "@/fabricResolver";
import { recordsGet } from "@/db";

// App Review demo handles (@example) never resolve on-chain — they're local-only
// (see the @example bypass in ShowHandle). Any screen that resolves a handle
// (the Search tab, the read-only HandleView opened from Recents/Shop) MUST route
// these through the local cache instead of the network, or the real relays
// answer "no such space" and the demo handle reads as "not registered".
export const isExample = (name: string) => /@example$/i.test(name.trim());

// Build a resolved profile straight from the records we saved locally when the
// owner published/seeded. Can't match a real handle, so it never affects
// production resolution.
export async function resolveExampleFromCache(
  name: string,
): Promise<ResolvedHandle | null> {
  const json = await recordsGet(name);
  // No cached row at all → the example handle was never created here, so it's a
  // genuine "not found" (buyable). A row that exists but is malformed / missing
  // its `records` key must NOT throw us into not-found — the handle IS ours, it
  // just has no records to show. Default to an empty (but resolved) profile so a
  // records-less cache entry never reads as "not registered".
  if (!json) return null;
  let records: { type: "txt" | "addr"; key: string; value: string[] }[] = [];
  try {
    const parsed = JSON.parse(json) as { records?: typeof records };
    if (Array.isArray(parsed.records)) records = parsed.records;
  } catch {
    // malformed JSON — treat as an empty (but resolved) example profile
  }
  return {
    // "orange" → the profile's trust caption reads "Verified with your trust
    // anchor" (nice for screenshots), not the fallback-sources wording.
    handle: name,
    badge: "orange",
    // "sovereign" → the demo profile shows the green Sovereign seal, presenting
    // @example as the ideal fully-proven handle (nice for screenshots). It's a
    // local demo zone, so this only ever affects @example.
    zone: { handle: name, sovereignty: "sovereign", records: records.map((r) => ({ ...r })) },
  };
}
