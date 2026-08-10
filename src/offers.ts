import { kvGet, kvSet } from "@/db";
import type { Outpoint } from "@/signRequest";

// Local record of every sale/transfer offer we've SIGNED, so the handle screen
// can list live offers and Cancel can spend the exact outpoint an offer commits
// to — all without a chain view (design-notes.md §6/§9). Stored in the kv table
// (already part of the .sqlite backup). Optimistic: we mark an offer cancelled
// when the user signs the cancel tx; we can't confirm it was broadcast.

export type Offer = {
  id: string;
  handle: string;
  kind: "sale" | "transfer";
  outpoint: Outpoint;
  price?: number; // sale only
  to?: string; // transfer recipient spk
  psbtB64: string;
  createdAt: number;
  status: "live" | "cancelled";
};

const key = (handle: string) => `offers:${handle}`;

export async function listOffers(handle: string): Promise<Offer[]> {
  const j = await kvGet(key(handle));
  if (!j) return [];
  try {
    return JSON.parse(j) as Offer[];
  } catch {
    return [];
  }
}

export async function liveOffers(handle: string): Promise<Offer[]> {
  return (await listOffers(handle)).filter((o) => o.status === "live");
}

export async function addOffer(offer: Offer): Promise<void> {
  const all = await listOffers(offer.handle);
  all.unshift(offer);
  await kvSet(key(offer.handle), JSON.stringify(all));
}

// Mark every live offer cancelled (called when the user signs a cancel tx).
export async function markAllCancelled(handle: string): Promise<void> {
  const all = await listOffers(handle);
  const next = all.map((o) => ({ ...o, status: "cancelled" as const }));
  await kvSet(key(handle), JSON.stringify(next));
}
