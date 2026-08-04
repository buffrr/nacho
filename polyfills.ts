// Must run before any @noble/* usage. react-native-get-random-values installs a
// native-backed global.crypto.getRandomValues (Hermes has none), which
// @noble/curves needs for BIP-340 Schnorr signing.
import "react-native-get-random-values";
import { Buffer } from "buffer";

// Set synchronously at module load (before any render) so code paths that use
// Buffer during the first render — e.g. key derivation — don't race an import.
if (typeof (globalThis as any).Buffer === "undefined") {
  (globalThis as any).Buffer = Buffer;
}
