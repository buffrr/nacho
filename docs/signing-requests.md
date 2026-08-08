# Nacho signing requests

A format that lets an external app or website ask a nacho user to **change a
record** (the "sign in with nacho" primitive) or **sign a PSBT input**. The
request is handed to nacho as a QR code or a link; nacho shows a confirmation of
the exact effect and acts only on explicit approval.

## Transport

One envelope, delivered two interchangeable ways:

```
nacho://sign?req=<base64url(JSON)>            # custom scheme (QR, app-to-app)
https://<domain>/sign?req=<base64url(JSON)>   # universal link (web "Sign in with nacho")
```

Both resolve to the same in-app route (`app/(main)/sign.tsx`). The `req` value is
the base64url encoding (no padding) of the UTF-8 JSON envelope below. A QR simply
encodes one of these URIs.

### Envelope

```jsonc
{
  "v": 1,                       // format version; nacho rejects unknown versions
  "type": "records" | "psbt",   // routes the request
  "origin": "example.com",      // OPTIONAL — shown to the user, NOT trusted
  "nonce": "…",                 // OPTIONAL — opaque, echoed back in `return`
  // …type-specific fields…
}
```

**Trust model.** Requests are unauthenticated by design. The trust gate is the
**user's approval**: nacho must render the exact effect (record diff, or the
input→output binding) plus `origin`, and must never publish, sign, or open a
return link without a tap. Everything in the envelope is untrusted data.

---

## Type A — record operations ("sign in with nacho")

```jsonc
{
  "v": 1,
  "type": "records",
  "handle": "satoshi@bitcoin",   // OPTIONAL — if absent, the user picks an owned handle
  "ops": [
    { "op": "set",    "rtype": "txt",  "key": "_app.example", "value": ["uid:1234"] },
    { "op": "set",    "rtype": "addr", "key": "btc",          "value": ["bc1…"] },
    { "op": "delete", "key": "_app.example" }               // rtype optional on delete
  ],
  "origin": "example.com",
  "return": "https://example.com/cb?token=…"  // OPTIONAL deep link back to the caller
}
```

**Semantics**
- `set` **upserts** by `(rtype, key)`: replaces the value if a record with that
  type+key exists, otherwise appends it.
- `delete` removes every record matching `key` (and `rtype` if given).
- nacho resolves the handle's **current** zone, applies the ops to the full
  record set, and publishes at `seq = now` (unix seconds) — publishing is a full
  replacement, so we always rebuild from the live zone.

**Flow**
1. Decode → validate → resolve the target handle (or prompt to pick one the user owns).
2. Show an **added / replaced / removed** diff plus `origin` and the target handle.
3. On approval: `publishRecords(exportCert(handle), newRecords, now, getSigningKey(handle))`.
4. Offer **"Return to example.com"** (opens `return`, user-tapped) or **Done**.

The requesting app confirms success by **resolving the handle** and observing the
record (trustless); `return` is only a UX convenience.

**Validation / limits**
- Reject ops targeting a handle the user doesn't own or can't publish (no cert).
- Enforce the record-set byte limit (`packedByteLength`) before allowing publish.
- Reject unknown `rtype`, empty keys, or malformed values.

---

## Type B — PSBT signing (`SIGHASH_SINGLE | ANYONECANPAY`)

The caller supplies the ingredients (JSON builder form); nacho constructs the
transaction, signs **only inputs whose script_pubkey is one of our handles**, and
returns a **signed PSBT** for the caller to combine.

```jsonc
{
  "v": 1,
  "type": "psbt",
  "version": 2,                 // OPTIONAL tx version (default 2)
  "locktime": 0,                // OPTIONAL (default 0)
  "sign": [                     // OUR input(s) to sign, in order → indices 0..n-1
    { "txid": "…", "vout": 0, "amount": 100000, "script": "5120<our-xonly>" }
  ],
  "outputs": [                  // tx outputs; input i is bound to output i (SINGLE)
    { "amount": 98000, "script": "5120<dest-xonly>" }   // dest: ours or the caller's
  ],
  "origin": "example.com"
}
```

**Why this shape.** `SIGHASH_SINGLE | ANYONECANPAY` signs exactly **our input i**
and commits it to **the output at the same index i**. `ANYONECANPAY` means only
our input is committed, so the counterparty can freely **append** their own
inputs/outputs afterward (classic offer/swap construction). nacho therefore
places our inputs first (indices `0..n-1`), each bound to `outputs[i]`;
`outputs.length` must be `>= sign.length`.

**Flow**
1. Decode → for each `sign[i]`, match `script` against `scriptForHandle()` of an
   owned handle; **reject** if any input isn't ours.
2. Build the tx (our inputs + the outputs), compute the BIP-341
   `SINGLE|ANYONECANPAY` sighash per input, and **schnorr-sign untweaked** with
   the handle key (`signSchnorr`) — the output key in `5120<xonly>` *is* the
   handle key, so no taproot tweak is applied.
3. Attach the key-path witness (64-byte sig + `0x03` sighash byte) and serialize
   to a PSBT.
4. Show, per input: **"Signing `<amount>` from `<handle>`, bound to output
   `<amount>` → `<addr/spk>`"**, flagged as a partial (ANYONECANPAY) signature.
5. On approval: reveal **"Copy signed PSBT."**

**Safety rails**
- Only `SIGHASH_SINGLE | ANYONECANPAY` is produced; any other sighash is refused.
- nacho signs **only** inputs whose spk matches an owned handle; never a
  caller-supplied key.
- The prevout `amount` is required (it's committed by the taproot sighash) and is
  shown to the user.

**Dependencies.** `@scure/btc-signer` (same @scure/@noble ecosystem) for tx build,
taproot sighash, and PSBT serialization; the final signature uses the existing
`signSchnorr` / `@noble/secp256k1` primitive.

---

## Deep-link / universal-link wiring

- Custom scheme `nacho://` already exists (`app.json` `scheme`).
- Universal links: add `ios.associatedDomains: ["applinks:<domain>"]` and Android
  `autoVerify` https intent filters; host `/.well-known/apple-app-site-association`
  and `/.well-known/assetlinks.json` on `<domain>`.
- Route `app/(main)/sign.tsx` reads `req` (via `useLocalSearchParams`), gated
  behind a configured keystore (prompt to set up if not). Handle both cold start
  (`getInitialURL`) and warm (`Linking` subscription) — expo-router covers both
  when the route matches.