import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { kvGet, kvSet, kvRemove, certDelete, recordsDelete } from "@/db";
import { clearHistory } from "@/resolveHistory";
import { migrateLegacyStore } from "@/migrateLegacy";
import { loadNetConfig, resetNetConfig } from "@/config";
import { wipeTrust } from "@/fabric";
import { CertData, isCertData, areCertDataEqual } from "@/cert";
import {
  xpubFromXprv,
  pubFromPrv,
  pubFromPath,
  prvFromPath,
  p2trScriptFromPub,
  isValidPrivkeyHex,
} from "@/keys";

// SecureStore keys must match [A-Za-z0-9._-]; handles contain "@" and ".", so
// encode them to a safe, reversible key for per-handle private keys.
function handlePrvStoreKey(handle: string): string {
  const b64 = Buffer.from(handle, "utf8").toString("base64");
  return (
    "hprv_" + b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
  );
}

const getSecureStorage = () => {
  if (Platform.OS === "web") {
    return {
      async getXprv(): Promise<string | null> {
        return await AsyncStorage.getItem("xprv");
      },
      async setXprv(value: string): Promise<void> {
        await AsyncStorage.setItem("xprv", value);
      },
      async removeXprv(): Promise<void> {
        await AsyncStorage.removeItem("xprv");
      },
      async getMnemonic(): Promise<string | null> {
        return await AsyncStorage.getItem("mnemonic");
      },
      async setMnemonic(value: string): Promise<void> {
        await AsyncStorage.setItem("mnemonic", value);
      },
      async removeMnemonic(): Promise<void> {
        await AsyncStorage.removeItem("mnemonic");
      },
      async getHandlePrivkey(handle: string): Promise<string | null> {
        return await AsyncStorage.getItem(handlePrvStoreKey(handle));
      },
      async setHandlePrivkey(handle: string, value: string): Promise<void> {
        await AsyncStorage.setItem(handlePrvStoreKey(handle), value);
      },
      async removeHandlePrivkey(handle: string): Promise<void> {
        await AsyncStorage.removeItem(handlePrvStoreKey(handle));
      },
    };
  }

  return {
    async getXprv(): Promise<string | null> {
      try {
        return await SecureStore.getItemAsync("xprv", {
          authenticationPrompt: "Access your private key",
          requireAuthentication: false,
        });
      } catch (error) {
        console.error("Failed to get xprv:", error);
        throw error;
      }
    },
    async setXprv(value: string): Promise<void> {
      try {
        await SecureStore.setItemAsync("xprv", value, {
          authenticationPrompt: "Secure your private key",
          requireAuthentication: false,
        });
      } catch (error) {
        console.error("Failed to set xprv:", error);
        throw error;
      }
    },
    async removeXprv(): Promise<void> {
      await SecureStore.deleteItemAsync("xprv");
    },
    async getMnemonic(): Promise<string | null> {
      try {
        return await SecureStore.getItemAsync("mnemonic", {
          authenticationPrompt: "Access your seed phrase",
          requireAuthentication: false,
        });
      } catch (error) {
        console.error("Failed to get mnemonic:", error);
        throw error;
      }
    },
    async setMnemonic(value: string): Promise<void> {
      try {
        await SecureStore.setItemAsync("mnemonic", value, {
          authenticationPrompt: "Secure your seed phrase",
          requireAuthentication: false,
        });
      } catch (error) {
        console.error("Failed to set mnemonic:", error);
        throw error;
      }
    },
    async getHandlePrivkey(handle: string): Promise<string | null> {
      try {
        return await SecureStore.getItemAsync(handlePrvStoreKey(handle), {
          authenticationPrompt: "Access your private key",
          requireAuthentication: false,
        });
      } catch (error) {
        console.error("Failed to get handle private key:", error);
        throw error;
      }
    },
    async setHandlePrivkey(handle: string, value: string): Promise<void> {
      try {
        await SecureStore.setItemAsync(handlePrvStoreKey(handle), value, {
          authenticationPrompt: "Secure your private key",
          requireAuthentication: false,
        });
      } catch (error) {
        console.error("Failed to set handle private key:", error);
        throw error;
      }
    },
    async removeHandlePrivkey(handle: string): Promise<void> {
      await SecureStore.deleteItemAsync(handlePrvStoreKey(handle));
    },
    async removeMnemonic(): Promise<void> {
      await SecureStore.deleteItemAsync("mnemonic");
    },
  };
};

const secureStorage = getSecureStorage();

// Marker for a stored certificate. The bytes live in the cert store (filesystem
// / IndexedDB); this just records that we have one and which sovereignty it was
// captured at, so we can replace a temporary "dependent" cert with the final
// "sovereign" one without re-downloading on every status check.
export type CertRef = { savedAt: number; sovereignty: string };

function isCertRef(obj: unknown): obj is CertRef {
  if (!obj || typeof obj !== "object") {
    return false;
  }
  const r = obj as Record<string, unknown>;
  return typeof r.savedAt === "number" && typeof r.sovereignty === "string";
}

// Cached result of resolving a handle on the certrelay network (Fabric).
export type HandleResolution =
  | { found: false; updatedAt: number }
  | {
      found: true;
      sovereignty: string;
      scriptPubkey?: string;
      // True when the resolve returned but could NOT be verified against any
      // trust anchor — the data may be forged, so we don't act on it silently.
      unverified?: boolean;
      updatedAt: number;
    };

// Set when a handle was bought through nacho's in-app purchase, so we can show
// the reassuring "Purchase complete / issuing certificate" state (vs the plain
// "waiting for certificate" for handles registered elsewhere).
export type PurchaseInfo = {
  amountCents?: number;
  orderId?: string;
};

// A handle's key is either derived from the keystore seed (a BIP-32 path) or an
// externally imported keypair (the public key, with the private key held in
// secure storage).
export type HandleData =
  | {
      source: "derived";
      path: string;
      cert?: CertData;
      resolution?: HandleResolution;
      certRef?: CertRef;
      // Whether the user has walked through the post-purchase onboarding states
      // (issuing → ready-to-use → sovereign). `false` on a freshly created
      // handle; undefined on pre-existing ones (treated as already onboarded).
      onboarded?: boolean;
      // Present when bought via nacho IAP (drives the "Purchase complete" state).
      purchase?: PurchaseInfo;
      // Candidate derivation paths from key rotations that haven't been observed
      // on-chain yet. The active key is unchanged until a re-resolve shows the
      // handle actually moved to one of these — then it's promoted (see
      // setHandleResolution). An unbroadcast rotate stays inert.
      pendingPaths?: string[];
    }
  | {
      source: "imported";
      pubkey: string;
      cert?: CertData;
      resolution?: HandleResolution;
      certRef?: CertRef;
      onboarded?: boolean;
      purchase?: PurchaseInfo;
      pendingPaths?: string[];
    };

function isHandleResolution(obj: unknown): obj is HandleResolution {
  if (!obj || typeof obj !== "object") {
    return false;
  }
  const r = obj as Record<string, unknown>;
  if (typeof r.updatedAt !== "number") {
    return false;
  }
  if (r.found === true) {
    if (typeof r.sovereignty !== "string") {
      return false;
    }
    return r.scriptPubkey === undefined || typeof r.scriptPubkey === "string";
  }
  return r.found === false;
}

function isHandleData(obj: unknown): obj is HandleData {
  const normalized = normalizeHandleData(obj);
  return normalized !== null;
}

// Validates and upgrades a stored handle entry to the current shape. Legacy
// entries (pre-`source`, always seed-derived) are normalized to
// `source: "derived"`. Returns null if the entry is unusable.
function normalizeHandleData(obj: unknown): HandleData | null {
  if (!obj || typeof obj !== "object") {
    return null;
  }
  const handle = obj as Record<string, unknown>;

  if (handle.cert !== undefined && !isCertData(handle.cert)) {
    return null;
  }
  const extra: {
    cert?: CertData;
    resolution?: HandleResolution;
    certRef?: CertRef;
    onboarded?: boolean;
    purchase?: PurchaseInfo;
    pendingPaths?: string[];
  } = {};
  if (Array.isArray(handle.pendingPaths)) {
    const paths = handle.pendingPaths.filter(
      (p): p is string =>
        typeof p === "string" && /^m(\/(?:0|[1-9]\d*))+$/.test(p),
    );
    if (paths.length) extra.pendingPaths = paths;
  }
  if (handle.cert !== undefined) {
    extra.cert = handle.cert as CertData;
  }
  if (isHandleResolution(handle.resolution)) {
    extra.resolution = handle.resolution;
  }
  if (isCertRef(handle.certRef)) {
    extra.certRef = handle.certRef;
  }
  if (typeof handle.onboarded === "boolean") {
    extra.onboarded = handle.onboarded;
  }
  if (handle.purchase && typeof handle.purchase === "object") {
    const p = handle.purchase as PurchaseInfo;
    const info: PurchaseInfo = {};
    if (typeof p.amountCents === "number") info.amountCents = p.amountCents;
    if (typeof p.orderId === "string") info.orderId = p.orderId;
    extra.purchase = info;
  }

  // Imported keypair.
  if (handle.source === "imported" || typeof handle.pubkey === "string") {
    if (typeof handle.pubkey !== "string" || !/^[0-9a-f]{64}$/i.test(handle.pubkey)) {
      return null;
    }
    return { source: "imported", pubkey: handle.pubkey, ...extra };
  }

  // Derived (explicit or legacy).
  if (
    typeof handle.path !== "string" ||
    !/^m(\/(?:0|[1-9]\d*))+$/.test(handle.path)
  ) {
    return null;
  }
  return { source: "derived", path: handle.path, ...extra };
}

const DERIVATION_PREFIX = "m/35053/0/0/";

// The next unused derivation path for a new handle / rotation (max index + 1).
// Considers both active paths and any pending rotation candidates so indexes are
// never reused.
function nextDerivedPath(handles: HandlesMap): string {
  let maxIndex = -1;
  const consider = (path: string) => {
    if (!path.startsWith(DERIVATION_PREFIX)) return;
    const indexStr = path.slice(DERIVATION_PREFIX.length);
    const index = parseInt(indexStr, 10);
    if (!isNaN(index) && index.toString() === indexStr && index > maxIndex) {
      maxIndex = index;
    }
  };
  for (const handleData of Object.values(handles)) {
    if (handleData.source === "derived") consider(handleData.path);
    for (const p of handleData.pendingPaths ?? []) consider(p);
  }
  return DERIVATION_PREFIX + (maxIndex + 1).toString();
}

export type HandlesMap = Record<string, HandleData>;

// A stable fingerprint of the backup-worthy state: each cert-backed handle plus
// its cert sovereignty. It changes when a new cert-backed handle is added or a
// cert finalizes (temp → sovereign), which is exactly when the .sqlite backup
// goes stale and the user should re-export it. Handles with no cert yet aren't
// included — there's nothing to lose until the cert lands (demo @example handles
// never have one, so they never nag).
export function backupSignature(handles: HandlesMap | null): string {
  if (!handles) return "";
  return Object.entries(handles)
    .filter(([, d]) => !!(d.certRef || d.cert))
    .map(([name, d]) => `${name}:${d.certRef?.sovereignty ?? "cert"}`)
    .sort()
    .join("|");
}

export type Keystore = {
  xpub: string;
  handles: HandlesMap;
};

function isHandlesMap(obj: unknown): obj is HandlesMap {
  if (!obj || typeof obj !== "object") {
    return false;
  }
  for (const handleData of Object.values(obj as Record<string, unknown>)) {
    if (!isHandleData(handleData)) {
      return false;
    }
  }
  return true;
}

export function isKeystore(obj: unknown): obj is Keystore {
  if (!obj || typeof obj !== "object") {
    return false;
  }
  const keystore = obj as Record<string, unknown>;
  if (typeof keystore.xpub !== "string") {
    return false;
  }
  return isHandlesMap(keystore.handles);
}

// Normalizes a stored/imported keystore to the current shape, upgrading from:
//   - the legacy network-keyed format ({ handles: { mainnet, testnet4 } }),
//     keeping the mainnet handles only; and
//   - pre-`source` handle entries (always seed-derived).
// Returns null if it isn't a usable keystore.
export function migrateKeystore(obj: unknown): Keystore | null {
  if (!obj || typeof obj !== "object") {
    return null;
  }
  const keystore = obj as Record<string, unknown>;
  if (typeof keystore.xpub !== "string") {
    return null;
  }
  const handles = keystore.handles;
  if (!handles || typeof handles !== "object") {
    return null;
  }

  // Legacy network-keyed shape: pull the mainnet map; otherwise it's flat.
  const handlesObj = handles as Record<string, unknown>;
  const rawMap =
    handlesObj.mainnet !== undefined || handlesObj.testnet4 !== undefined
      ? handlesObj.mainnet
      : handlesObj;

  if (rawMap === undefined) {
    return { xpub: keystore.xpub, handles: {} };
  }
  if (!rawMap || typeof rawMap !== "object") {
    return null;
  }

  const normalized: HandlesMap = {};
  for (const [name, value] of Object.entries(rawMap as Record<string, unknown>)) {
    const handleData = normalizeHandleData(value);
    if (!handleData) {
      return null;
    }
    normalized[name] = handleData;
  }
  return { xpub: keystore.xpub, handles: normalized };
}

type StoreContextType = {
  xpub: string | null;
  handles: HandlesMap | null;
  getXprv: () => Promise<string | null>;
  getMnemonic: () => Promise<string | null>;
  getSigningKey: (handle: string) => Promise<string | null>;
  setupKeystore: (
    xprv: string,
    handles: HandlesMap,
    mnemonic?: string,
  ) => Promise<void>;
  createHandle: (handle: string) => Promise<void>;
  nextScriptPubkey: () => string | null;
  // The handle entry we *would* derive next, computed without persisting — lets
  // a purchase flow derive/show a key before committing the handle to the store.
  nextHandleData: () => HandleData | null;
  importKeypair: (handle: string, privkeyHex: string) => Promise<void>;
  removeHandle: (handle: string) => Promise<void>;
  // Generate + persist a new candidate key for a rotation (see HandleData.pendingPaths).
  // Returns the new key's derivation path, x-only pubkey, and p2tr script.
  addPendingRotation: (
    handle: string,
  ) => Promise<{ path: string; pubkey: string; script: string } | null>;
  setHandleCertData: (handle: string, cert: CertData | null) => Promise<void>;
  setHandleResolution: (
    handle: string,
    resolution: HandleResolution,
  ) => Promise<void>;
  setCertRef: (handle: string, certRef: CertRef | null) => Promise<void>;
  setHandleOnboarded: (handle: string, value: boolean) => Promise<void>;
  setHandlePurchase: (handle: string, purchase: PurchaseInfo) => Promise<void>;
  // Whether the user has confirmed backing up their seed phrase. Drives the
  // backup nudge (shown once they own a cert-backed handle). Sticky once true.
  seedBackedUp: boolean;
  markSeedBackedUp: () => Promise<void>;
  // The .sqlite backup file is stale relative to the current keystore — a new
  // cert-backed handle was added, or a cert finalized (temp → sovereign), since
  // the last file export. Re-drives the backup nudge even after the seed is saved.
  backupStale: boolean;
  markBackupSaved: () => Promise<void>;
  // Dev/testing: reset the app to fresh onboarding (keeps network config).
  wipeEverything: () => Promise<void>;
};

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const [xpub, setXpub] = useState<string | null>(null);
  const [handles, setHandles] = useState<HandlesMap | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [seedBackedUp, setSeedBackedUp] = useState(false);
  // Signature of the keystore state captured at the last .sqlite backup. When it
  // differs from the current signature, the backup file is stale.
  const [backupSig, setBackupSig] = useState<string>("");
  // Always-latest handles, updated synchronously in saveKeystore, so the
  // per-handle setters merge into the current map instead of a stale render
  // closure (which caused resolution/certRef writes to clobber each other and
  // the sovereignty pill to flap).
  const handlesRef = useRef<HandlesMap | null>(null);
  const currentHandles = () => handlesRef.current ?? handles;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load the user's network config before anything resolves / hits the API.
      await loadNetConfig();
      // Fold any pre-SQLite data (AsyncStorage keystore + old cert store) into
      // the database once, then read from it.
      await migrateLegacyStore();
      const keystoreJson = await kvGet("keystore");
      if (keystoreJson) {
        const keystore = migrateKeystore(JSON.parse(keystoreJson));
        if (keystore) {
          setXpub(keystore.xpub);
          setHandles(keystore.handles);
          handlesRef.current = keystore.handles;
        }
      }
      if ((await kvGet("seedBackedUp")) === "1") setSeedBackedUp(true);
      setBackupSig((await kvGet("backupSig")) ?? "");
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setIsLoaded(true);
    }
  };

  const saveKeystore = async (handlesToSave?: HandlesMap, xpubToSave?: string) => {
    let xpubValue = xpub;
    if (xpubToSave !== undefined) {
      setXpub(xpubToSave);
      xpubValue = xpubToSave;
    }
    let handlesValue = handlesToSave ?? handlesRef.current ?? handles;
    if (handlesToSave !== undefined) {
      setHandles(handlesToSave);
      handlesValue = handlesToSave;
      handlesRef.current = handlesToSave;
    }

    if (xpubValue === null) {
      throw new Error("Cannot save keystore without an xpub");
    }
    if (handlesValue === null) {
      throw new Error("Cannot save keystore without handles");
    }

    const keystore: Keystore = { xpub: xpubValue, handles: handlesValue };
    await kvSet("keystore", JSON.stringify(keystore));
  };

  const getXprv = async (): Promise<string | null> => {
    return await secureStorage.getXprv();
  };

  const getMnemonic = async (): Promise<string | null> => {
    return await secureStorage.getMnemonic();
  };

  const markSeedBackedUp = async (): Promise<void> => {
    setSeedBackedUp(true);
    await kvSet("seedBackedUp", "1");
  };

  // Current backup-worthy signature vs. the one captured at the last file export.
  const currentBackupSig = backupSignature(handles);
  const backupStale = currentBackupSig !== "" && currentBackupSig !== backupSig;

  const markBackupSaved = async (): Promise<void> => {
    const sig = backupSignature(currentHandles());
    setBackupSig(sig);
    await kvSet("backupSig", sig);
  };

  // Dev/testing: wipe the keystore, every handle's secrets/cert/records, the
  // backup flag and the resolve history — resetting the app to fresh onboarding.
  // Network config (relays/API) is intentionally kept. Best-effort: individual
  // failures don't abort the wipe.
  const wipeEverything = async (): Promise<void> => {
    const base = currentHandles() ?? {};
    for (const handle of Object.keys(base)) {
      try {
        await secureStorage.removeHandlePrivkey(handle);
      } catch {
        // no imported key for this handle — fine
      }
      await certDelete(handle);
      await recordsDelete(handle);
    }
    try {
      await secureStorage.removeXprv();
    } catch {
      // ignore
    }
    try {
      await secureStorage.removeMnemonic();
    } catch {
      // ignore
    }
    await kvRemove("keystore");
    await kvRemove("seedBackedUp");
    await kvRemove("backupSig");
    try {
      await clearHistory();
    } catch {
      // ignore
    }
    try {
      // Revert the network config (seeds + API URL) to defaults so a wipe
      // doesn't keep a custom/local endpoint.
      await resetNetConfig();
      // Revert trust state to fabric's defaults (drops any pinned anchor, custom
      // pool, or fallback-disabled flag) so a fresh keystore isn't left with
      // "fallback sources not set".
      await wipeTrust();
    } catch {
      // ignore
    }
    handlesRef.current = null;
    setHandles(null);
    setXpub(null);
    setSeedBackedUp(false);
    setBackupSig("");
  };

  const setupKeystore = async (
    xprv: string,
    handles: HandlesMap,
    mnemonic?: string,
  ): Promise<void> => {
    await secureStorage.setXprv(xprv);
    if (mnemonic) {
      await secureStorage.setMnemonic(mnemonic);
    }
    await saveKeystore(handles, xpubFromXprv(xprv));
  };

  const createHandle = async (handle: string): Promise<void> => {
    const base = currentHandles();
    if (base === null) {
      throw new Error("Cannot create handle without handles");
    }
    if (handle in base) {
      return;
    }

    await saveKeystore({
      ...base,
      [handle]: {
        source: "derived",
        path: nextDerivedPath(base),
        // New handle → show the post-purchase onboarding states until dismissed.
        onboarded: false,
      },
    });
  };

  // The script for the next handle we'd derive, computed without persisting —
  // used to bind a key during reserve / web-redemption before the handle exists.
  const nextScriptPubkey = (): string | null => {
    if (xpub === null || handles === null) {
      return null;
    }
    return p2trScriptFromPub(pubFromPath(xpub, nextDerivedPath(handles)));
  };

  const nextHandleData = (): HandleData | null => {
    if (handles === null) {
      return null;
    }
    return { source: "derived", path: nextDerivedPath(handles) };
  };

  const importKeypair = async (
    handle: string,
    privkeyHex: string,
  ): Promise<void> => {
    if (handles === null) {
      throw new Error("Cannot import keypair without handles");
    }
    if (handle in handles) {
      throw new Error("Handle already exists");
    }
    if (!isValidPrivkeyHex(privkeyHex)) {
      throw new Error("Invalid private key");
    }

    const pubkey = pubFromPrv(privkeyHex);
    await secureStorage.setHandlePrivkey(handle, privkeyHex.toLowerCase());
    await saveKeystore({
      ...handles,
      [handle]: {
        source: "imported",
        pubkey,
      },
    });
  };

  const removeHandle = async (handle: string): Promise<void> => {
    const base = currentHandles();
    if (base === null) {
      throw new Error("Cannot remove handle without handles");
    }
    const handleData = base[handle];
    if (handleData === undefined) {
      return;
    }

    if (handleData.source === "imported") {
      await secureStorage.removeHandlePrivkey(handle);
    }

    // Drop the handle's cert + cached records so they don't linger in the DB
    // (and the single-file backup) after removal.
    await certDelete(handle);
    await recordsDelete(handle);

    const { [handle]: removed, ...remainingHandles } = base;

    await saveKeystore(remainingHandles);
  };

  const getSigningKey = async (handle: string): Promise<string | null> => {
    if (handles === null) {
      return null;
    }
    const handleData = handles[handle];
    if (handleData === undefined) {
      return null;
    }
    if (handleData.source === "imported") {
      return await secureStorage.getHandlePrivkey(handle);
    }
    const xprv = await secureStorage.getXprv();
    if (!xprv) {
      return null;
    }
    return prvFromPath(xprv, handleData.path);
  };

  const setHandleCertData = async (
    handle: string,
    cert: CertData | null,
  ): Promise<void> => {
    const base = currentHandles();
    const handleData = base?.[handle];
    if (!base || handleData === undefined) {
      return;
    }

    if (handleData.cert && cert && areCertDataEqual(handleData.cert, cert)) {
      return;
    }

    const updatedHandleData = { ...handleData };

    if (cert === null) {
      delete updatedHandleData.cert;
    } else {
      updatedHandleData.cert = cert;
    }

    await saveKeystore({
      ...base,
      [handle]: updatedHandleData,
    });
  };

  const setHandleResolution = async (
    handle: string,
    resolution: HandleResolution,
  ): Promise<void> => {
    const base = currentHandles();
    const handleData = base?.[handle];
    if (!base || handleData === undefined) {
      return;
    }
    let updated: HandleData = { ...handleData, resolution };
    // Rotation reconciliation: if the chain now shows the handle on a pending
    // candidate key, promote it to the active key and clear the candidates. An
    // unbroadcast rotate never matches, so it stays inert.
    if (
      resolution.found &&
      resolution.scriptPubkey &&
      handleData.pendingPaths?.length &&
      xpub
    ) {
      const match = handleData.pendingPaths.find(
        (p) => p2trScriptFromPub(pubFromPath(xpub, p)) === resolution.scriptPubkey,
      );
      if (match) {
        updated = {
          source: "derived",
          path: match,
          resolution,
          ...(handleData.cert ? { cert: handleData.cert } : {}),
          ...(handleData.certRef ? { certRef: handleData.certRef } : {}),
          ...(handleData.onboarded !== undefined
            ? { onboarded: handleData.onboarded }
            : {}),
          ...(handleData.purchase ? { purchase: handleData.purchase } : {}),
        };
      }
    }
    await saveKeystore({ ...base, [handle]: updated });
  };

  const addPendingRotation = async (
    handle: string,
  ): Promise<{ path: string; pubkey: string; script: string } | null> => {
    const base = currentHandles();
    const handleData = base?.[handle];
    if (!base || handleData === undefined || !xpub) {
      return null;
    }
    const path = nextDerivedPath(base);
    const pubkey = pubFromPath(xpub, path);
    const script = p2trScriptFromPub(pubkey);
    const pendingPaths = [...(handleData.pendingPaths ?? []), path];
    await saveKeystore({ ...base, [handle]: { ...handleData, pendingPaths } });
    return { path, pubkey, script };
  };

  const setCertRef = async (
    handle: string,
    certRef: CertRef | null,
  ): Promise<void> => {
    const base = currentHandles();
    const handleData = base?.[handle];
    if (!base || handleData === undefined) {
      return;
    }
    const updated = { ...handleData };
    if (certRef === null) {
      delete updated.certRef;
    } else {
      updated.certRef = certRef;
    }
    await saveKeystore({ ...base, [handle]: updated });
  };

  const setHandleOnboarded = async (
    handle: string,
    value: boolean,
  ): Promise<void> => {
    const base = currentHandles();
    const handleData = base?.[handle];
    if (!base || handleData === undefined) {
      return;
    }
    await saveKeystore({
      ...base,
      [handle]: { ...handleData, onboarded: value },
    });
  };

  const setHandlePurchase = async (
    handle: string,
    purchase: PurchaseInfo,
  ): Promise<void> => {
    const base = currentHandles();
    const handleData = base?.[handle];
    if (!base || handleData === undefined) {
      return;
    }
    await saveKeystore({
      ...base,
      [handle]: { ...handleData, purchase },
    });
  };

  if (!isLoaded) {
    return null;
  }

  return (
    <StoreContext.Provider
      value={{
        xpub,
        handles,
        getXprv,
        getMnemonic,
        getSigningKey,
        setupKeystore,
        createHandle,
        nextScriptPubkey,
        nextHandleData,
        importKeypair,
        removeHandle,
        addPendingRotation,
        setHandleCertData,
        setHandleResolution,
        setCertRef,
        setHandleOnboarded,
        setHandlePurchase,
        seedBackedUp,
        markSeedBackedUp,
        backupStale,
        markBackupSaved,
        wipeEverything,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = (): StoreContextType => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error("useStore must be used within StoreProvider");
  }
  return context;
};
