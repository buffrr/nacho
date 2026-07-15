import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
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
      updatedAt: number;
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
    }
  | {
      source: "imported";
      pubkey: string;
      cert?: CertData;
      resolution?: HandleResolution;
      certRef?: CertRef;
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
  } = {};
  if (handle.cert !== undefined) {
    extra.cert = handle.cert as CertData;
  }
  if (isHandleResolution(handle.resolution)) {
    extra.resolution = handle.resolution;
  }
  if (isCertRef(handle.certRef)) {
    extra.certRef = handle.certRef;
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

// The next unused derivation path for a new handle (max derived index + 1).
function nextDerivedPath(handles: HandlesMap): string {
  let maxIndex = -1;
  for (const handleData of Object.values(handles)) {
    if (
      handleData.source === "derived" &&
      handleData.path.startsWith(DERIVATION_PREFIX)
    ) {
      const indexStr = handleData.path.slice(DERIVATION_PREFIX.length);
      const index = parseInt(indexStr, 10);
      if (!isNaN(index) && index.toString() === indexStr && index > maxIndex) {
        maxIndex = index;
      }
    }
  }
  return DERIVATION_PREFIX + (maxIndex + 1).toString();
}

export type HandlesMap = Record<string, HandleData>;

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
  importKeypair: (handle: string, privkeyHex: string) => Promise<void>;
  removeHandle: (handle: string) => Promise<void>;
  setHandleCertData: (handle: string, cert: CertData | null) => Promise<void>;
  setHandleResolution: (
    handle: string,
    resolution: HandleResolution,
  ) => Promise<void>;
  setCertRef: (handle: string, certRef: CertRef | null) => Promise<void>;
};

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const [xpub, setXpub] = useState<string | null>(null);
  const [handles, setHandles] = useState<HandlesMap | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const keystoreJson = await AsyncStorage.getItem("keystore");
      if (keystoreJson) {
        const keystore = migrateKeystore(JSON.parse(keystoreJson));
        if (keystore) {
          setXpub(keystore.xpub);
          setHandles(keystore.handles);
        }
      }
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
    let handlesValue = handles;
    if (handlesToSave !== undefined) {
      setHandles(handlesToSave);
      handlesValue = handlesToSave;
    }

    if (xpubValue === null) {
      throw new Error("Cannot save keystore without an xpub");
    }
    if (handlesValue === null) {
      throw new Error("Cannot save keystore without handles");
    }

    const keystore: Keystore = { xpub: xpubValue, handles: handlesValue };
    await AsyncStorage.setItem("keystore", JSON.stringify(keystore));
  };

  const getXprv = async (): Promise<string | null> => {
    return await secureStorage.getXprv();
  };

  const getMnemonic = async (): Promise<string | null> => {
    return await secureStorage.getMnemonic();
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
    if (handles === null) {
      throw new Error("Cannot create handle without handles");
    }
    if (handle in handles) {
      return;
    }

    await saveKeystore({
      ...handles,
      [handle]: {
        source: "derived",
        path: nextDerivedPath(handles),
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
    if (handles === null) {
      throw new Error("Cannot remove handle without handles");
    }
    const handleData = handles[handle];
    if (handleData === undefined) {
      return;
    }

    if (handleData.source === "imported") {
      await secureStorage.removeHandlePrivkey(handle);
    }

    const { [handle]: removed, ...remainingHandles } = handles;

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
    if (handles === null) {
      throw new Error("Cannot create handle without handles");
    }
    const handleData = handles[handle];
    if (handleData === undefined) {
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
      ...handles,
      [handle]: updatedHandleData,
    });
  };

  const setHandleResolution = async (
    handle: string,
    resolution: HandleResolution,
  ): Promise<void> => {
    if (handles === null) {
      return;
    }
    const handleData = handles[handle];
    if (handleData === undefined) {
      return;
    }
    await saveKeystore({
      ...handles,
      [handle]: { ...handleData, resolution },
    });
  };

  const setCertRef = async (
    handle: string,
    certRef: CertRef | null,
  ): Promise<void> => {
    if (handles === null) {
      return;
    }
    const handleData = handles[handle];
    if (handleData === undefined) {
      return;
    }
    const updated = { ...handleData };
    if (certRef === null) {
      delete updated.certRef;
    } else {
      updated.certRef = certRef;
    }
    await saveKeystore({ ...handles, [handle]: updated });
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
        importKeypair,
        removeHandle,
        setHandleCertData,
        setHandleResolution,
        setCertRef,
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
