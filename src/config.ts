// Runtime, user-editable network configuration (persisted in the DB), edited in
// the Settings screen. A single endpoint set — prefilled with the mainnet
// defaults we ship — so a user can:
//   • point the semi-trusted anchor fetch at different relays,
//   • override the certrelay bootstrap seeds (resilience if nodes are down /
//     attacked),
//   • point the API at a local server for development,
// all without rebuilding.
import { kvGet, kvSet } from "@/db";

export type NetConfig = {
  // Legacy field. The semi-trusted anchor is now managed by Fabric's signed
  // pool loader (see trust.ts / semi-trust.md), NOT this list. Kept only so
  // networkTag() stays stable — dropping it would rename the persisted trust
  // keys and orphan pinned anchors. The editable pool lives in the Fabric client.
  anchorRelays: string[];
  // Certrelay bootstrap seeds (peer discovery + resolve/publish). Empty → the
  // SDK's built-in DEFAULT_SEEDS.
  seeds: string[];
  // atbitcoin API base URL (…/api) for search / reserve / claim.
  apiUrl: string;
};

export const DEFAULT_NET_CONFIG: NetConfig = {
  anchorRelays: [
    "https://relay-cosmos.spacesprotocol.org/anchors",
    "https://relay-pulsar.spacesprotocol.org/anchors",
  ],
  seeds: [
    "https://relay-cosmos.spacesprotocol.org",
    "https://relay-atlas.spacesprotocol.org",
  ],
  apiUrl: "https://atbitcoin.com/api",
};

const KV_KEY = "net_config";

let current: NetConfig = DEFAULT_NET_CONFIG;
let loadPromise: Promise<void> | null = null;

function merge(saved: Partial<NetConfig> | null): NetConfig {
  if (!saved) return DEFAULT_NET_CONFIG;
  return {
    anchorRelays: saved.anchorRelays ?? DEFAULT_NET_CONFIG.anchorRelays,
    seeds: saved.seeds ?? DEFAULT_NET_CONFIG.seeds,
    apiUrl: saved.apiUrl ?? DEFAULT_NET_CONFIG.apiUrl,
  };
}

// Load the persisted config once. Idempotent; safe to await before any use.
export function loadNetConfig(): Promise<void> {
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const json = await kvGet(KV_KEY);
        current = merge(json ? (JSON.parse(json) as Partial<NetConfig>) : null);
      } catch {
        current = DEFAULT_NET_CONFIG;
      }
    })();
  }
  return loadPromise;
}

export function getNetConfig(): NetConfig {
  return current;
}

// Fired when the config changes so dependents (the Fabric client) can rebuild.
const listeners = new Set<() => void>();
export function onNetConfigChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export async function saveNetConfig(next: NetConfig): Promise<void> {
  current = next;
  try {
    await kvSet(KV_KEY, JSON.stringify(next));
  } catch {
    // keep the in-memory value even if persistence fails
  }
  listeners.forEach((fn) => fn());
}

// Revert the network config (seeds + API URL) to the built-in defaults — used by
// "Delete everything" so a wipe doesn't leave a custom/local endpoint behind.
export async function resetNetConfig(): Promise<void> {
  await saveNetConfig(DEFAULT_NET_CONFIG);
}

// undefined → the SDK's built-in DEFAULT_SEEDS.
export function activeSeeds(): string[] | undefined {
  return current.seeds.length ? current.seeds : undefined;
}

export function activeApiUrl(): string {
  return current.apiUrl || DEFAULT_NET_CONFIG.apiUrl;
}

// A short, stable tag of the active endpoints, used to namespace persisted trust
// anchors so they don't carry across when the app is pointed at a different
// network (e.g. mainnet ↔ a local chain).
export function networkTag(): string {
  const s = JSON.stringify([current.anchorRelays, current.seeds]);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
