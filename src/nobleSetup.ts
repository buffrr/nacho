import { hashes } from "@noble/secp256k1";
import { sha256 } from "@noble/hashes/sha2.js";
import { hmac } from "@noble/hashes/hmac.js";

// @noble/secp256k1 v3's SYNC APIs (schnorr.sign, sign, verify) require a hash
// implementation to be wired in — otherwise they throw "hashes.sha256 not set".
// (The async APIs use WebCrypto; we use sync.) Import this module once before any
// signing. Idempotent.
if (!hashes.sha256) hashes.sha256 = (m) => sha256(m);
if (!hashes.hmacSha256) hashes.hmacSha256 = (k, m) => hmac(sha256, k, m);
