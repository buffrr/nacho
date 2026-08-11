import "@/nobleSetup"; // wire hashes.sha256 for @noble/secp256k1 sync signing
import { sha256 } from "@noble/hashes/sha2.js";
import {
  utf8ToBytes,
  hexToBytes,
  bytesToHex,
  concatBytes,
} from "@noble/hashes/utils.js";
import { schnorr } from "@noble/secp256k1";

// Signs a sign-in `message` challenge with the handle key. The challenge is
// domain-separated with a tagged hash so a sign-in signature can never be
// replayed as a transfer/sale/zone signature (which hash different preimages).
// Verifier resolves the handle's pubkey and checks the BIP-340 signature.
const TAG = "nacho/message/v1";

function taggedHash(tag: string, msg: Uint8Array): Uint8Array {
  const t = sha256(utf8ToBytes(tag));
  return sha256(concatBytes(t, t, msg));
}

export type MessageResponse = {
  type: "message";
  handle: string;
  pubkey: string; // x-only hex
  signature: string; // 64-byte BIP-340 hex
  ref?: string;
};

export function signMessage(
  handle: string,
  challenge: string,
  secretKeyHex: string,
  ref?: string,
): MessageResponse {
  const key = hexToBytes(secretKeyHex);
  const digest = taggedHash(TAG, utf8ToBytes(challenge));
  const signature = bytesToHex(schnorr.sign(digest, key));
  const pubkey = bytesToHex(schnorr.getPublicKey(key));
  return { type: "message", handle, pubkey, signature, ...(ref ? { ref } : {}) };
}
