# Signing requests v2 — implementation plan

Source of truth: `design-notes.md` (rationale) + `mockups.html` (reference layouts).
`docs/signing-requests.md` is v1 — **superseded** where they disagree.
Constraint: **native UI as much as possible.** Scope: **build all of it.**

---

## Core protocol mechanic (must be internalized)

The handle is a Taproot UTXO (spk `5120<key>`, value = input amount). We sign its
input with `SIGHASH_SINGLE | ANYONECANPAY`, committing to one output. **The output
value relative to the input value is the semantic:**

- **`output value == input value`** → an **ownership move**: the handle relocates to
  the signed output's spk. This is **transfer** (recipient key), **rotate** (fresh
  own key), **cancel** (same own key).
- **`output value == input value + price`** → a **sale**: the deliberate excess forces
  the buyer to add ≥ `price` of their own inputs; the seller's signed output collects
  `input + price` at the payout address, and the handle rides to the **buyer's
  appended output**. Never present `input + price` as "what you receive" — the price
  is the headline.

Safety rails (unchanged): only `SINGLE|ANYONECANPAY` is produced, only inputs whose
spk matches an owned handle are signed, never a caller-supplied key.

## Outpoint sourcing — never a chain view

A handle's current outpoint always comes from exactly one of:
1. **Request payload** (transfer/sale/rotate requests carry `outpoint{txid,vout,amount}`;
   amount is self-checking under ANYONECANPAY).
2. **Saved offer history** (§B5) — we persist what we sign; **Cancel** spends that
   known outpoint.
3. **Manual entry** — user supplies `txid:vout` + value for off-request transfer/
   sale/rotate.

We do **not** derive it from resolution/cert. (Anchor-relay outpoint data is §9 deferred.)

---

## A. Foundations (`signRequest.ts` rewrite, `format.ts`)

- **Envelope v2:** types `message | records | transfer | sale | rotate`; delete generic
  `psbt`. `exp` (unix s) **required** — reject past, show remaining validity (its job is
  making stale-request failure legible, *not* replay protection). `ref` **optional**,
  echoed verbatim in the response, **never displayed** (a shown requester string is
  spoofable — the `origin` mistake). Drop `origin` entirely.
- **URL validation** for `endpoint`/`return`: `https:` only; reject
  `http`/`javascript:`/`data:`/`file:`/custom schemes, private/loopback/link-local
  hosts, non-standard ports; dev-only `http://localhost`. Display host = URL host.
- **Replay** is per-type, not from `ref`: message = the challenge; records = `set` is an
  idempotent upsert; transfer/sale = the UTXO (spent once → all sigs dead). No seen-list.
- **`format.ts`:** BIP-177 ₿-only amounts (integers, `Intl.NumberFormat`, `₿500,000`,
  no decimals/"sats"/"BTC"; fiat omitted — no rate source, leave layout room). One
  `<ChunkedValue>` (monospace, thin-space groups, slashed-zero font feature) for keys/
  addresses/recipient/payout.

## B. Types

- **B1 message** — `digest = taggedHash("nacho/message/v1", challenge)`, `signSchnorr`.
  Response `{handle,pubkey,signature,ref}`. Screen §01 (endpoint → "Sign & send to
  <host>", else "Sign"); handle picker if absent. Nothing published.
- **B2 records** — "Approve record change"; "A request asks to add/replace/remove".
  Add/replace/remove distinct (replace shows **both** values full; remove lists each).
  **Per-key tier registry** (`recordTiers.ts`): destination(`btc`,`ln`)/identity(pgp,
  npub)/generic → warning line + recognition checkbox for the first two, none for
  generic; never infer tier from `rtype`. **Zone-changed-at-approval:** cached diff at
  scan → resolve live on approve → if different, "Records changed" + 2nd tap. Limits:
  cap `ops.length`, reject dup `(rtype,key)`, `packedByteLength` guard, ownership.
  `seq = max(now, lastSeq+1)`.
- **B3 transfer** — output value = input value → `to` spk. Recipient chunked +
  external/mine tag + recognition checkbox; irreversibility note; **danger** button.
  Outpoint from payload or manual entry. Save to history.
- **B4 sale** — price-only payload; payout prefilled from own `addr:btc` (re-read at
  sign, editable, required if unset); output = input + price; **dust-validate before
  signing**; **device auth** on approve; bearer-instrument copy; ₿ headline. Save to
  history.
- **B5 cancel / rotate** — self-transfers (output value = input value).
  Cancel → same key (outpoint from history); Rotate → freshly generated key (new
  derivation index; old genesis → tombstone; sovereign kept, records kept, no cert
  re-issue; outpoint from history/manual/rotate-request). Live-offers list on the
  handle screen from history.

## Device auth (`expo-local-authentication`, +native rebuild)

`auth.ts: authenticate(reason)` → if `hasHardwareAsync && isEnrolledAsync`, require
`authenticateAsync`; **else proceed with no check** (web/no-biometric included).
**Never name the method.** Gate **sale** (required); optional on transfer. Not on seed
storage (keeps SecureStore backup-able).

## C. Result screen + native UI

One result screen: `Send to <host>` primary **only** with a valid `endpoint` (one-shot
POST), `Copy response` always. Native headers/titles per type; SF Symbols (Android
glyph fallback); iOS grouped-inset cards; recognition = native row + `Switch`; native
OS auth prompt + native `Alert` for dust/validation. Confirmation bodies are custom RN
but styled native.

## Build order
A (envelope+format) → B1 message → B2 records → B4 sale (+device auth, rebuild) →
B3 transfer + manual entry → B5 history+cancel/rotate → C result + verify.

## Deferred (§9 — do NOT build)
Anchor-relay outpoint/spent data; response QR; relay/nostr transport; push /
handle-addressed inbound / sessions; universal links until a domain + Apple Team ID
exist (nacho:// + QR ship now).