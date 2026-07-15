import * as bip39 from "@scure/bip39";
import { HDKey } from "@scure/bip32";
import { wordlist } from "@scure/bip39/wordlists/english";
import { randomBytes } from "@noble/hashes/utils.js";
import * as secp256k1 from "@noble/secp256k1";
import type { HandleData } from "@/Store";

export function generateMnemonic(): string {
  const entropy = randomBytes(16);
  return bip39.entropyToMnemonic(entropy, wordlist);
}

export function validateMnemonic(mnemonic: string): boolean {
  return bip39.validateMnemonic(mnemonic, wordlist);
}

export function xprvFromMnemonic(mnemonic: string): string {
  const seed = bip39.mnemonicToSeedSync(mnemonic, "");
  const hdkey = HDKey.fromMasterSeed(seed);
  return hdkey.privateExtendedKey;
}

export function xpubFromMnemonic(mnemonic: string): string {
  const seed = bip39.mnemonicToSeedSync(mnemonic, "");
  const hdkey = HDKey.fromMasterSeed(seed);
  return hdkey.publicExtendedKey;
}

export function xpubFromXprv(xprv: string): string {
  const hdkey = HDKey.fromExtendedKey(xprv);
  return hdkey.publicExtendedKey;
}

export function prvkeyFromXprv(xprv: string, path: string): string {
  const hdkey = HDKey.fromExtendedKey(xprv);
  const derived = hdkey.derive(path);

  if (!derived.privateKey) {
    throw new Error("Unable to derive private key");
  }

  return Buffer.from(derived.privateKey).toString("hex");
}

export function pubFromPath(xpub: string, path: string): string {
  const hdkey = HDKey.fromExtendedKey(xpub);
  const derived = hdkey.derive(path);
  if (!derived.publicKey) {
    throw new Error("Unable to derive public key");
  }
  return Buffer.from(derived.publicKey).toString("hex").slice(2, 66);
}

export function prvFromPath(xprv: string, path: string): string {
  const hdkey = HDKey.fromExtendedKey(xprv);
  const derived = hdkey.derive(path);
  if (!derived.privateKey) {
    throw new Error("Unable to derive private key");
  }
  return Buffer.from(derived.privateKey).toString("hex");
}

export function p2trScriptFromPub(pub: string): string {
  return "5120" + pub;
}

// X-only public key (64 hex) from a raw private key hex, mirroring the format
// pubFromPath produces (compressed pubkey minus its parity byte).
export function pubFromPrv(prvHex: string): string {
  const pub = secp256k1.getPublicKey(Buffer.from(prvHex, "hex"), true);
  return Buffer.from(pub).toString("hex").slice(2, 66);
}

export function isValidPrivkeyHex(value: string): boolean {
  if (!/^[0-9a-fA-F]{64}$/.test(value)) {
    return false;
  }
  try {
    secp256k1.getPublicKey(Buffer.from(value, "hex"), true);
    return true;
  } catch {
    return false;
  }
}

// Resolves the x-only public key for a handle regardless of whether its key is
// seed-derived or an imported keypair.
export function pubkeyForHandle(xpub: string, handleData: HandleData): string {
  return handleData.source === "imported"
    ? handleData.pubkey
    : pubFromPath(xpub, handleData.path);
}

export function scriptForHandle(xpub: string, handleData: HandleData): string {
  return p2trScriptFromPub(pubkeyForHandle(xpub, handleData));
}
