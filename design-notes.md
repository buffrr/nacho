# Nacho signing requests — revision notes (v2)

Notes on what changes from the first spec and why. Written for whoever implements
this next. Rationale is included because several of these look like arbitrary
preferences and aren't.

Scope note: we are time-limited. "Deferred" at the bottom is a real list, not a
wishlist — don't build those now.

---

## 1. Sign-in is no longer a record write

**Drop** the pattern where "sign in with nacho" means `set` on `_app.<service>`.

It made every login a permanent, public, enumerable entry on the user's handle —
resolve `satoshi@bitcoin` and you get a directory of everywhere he has an
account. That's a worse privacy property than the auth systems we're replacing.
It also cost a publish round-trip per login, grew unboundedly against the byte
limit, and needed network to log in.

**Add** a `message` type instead: sign a caller-supplied challenge with the
handle key, return the signature. Nothing published, nothing public, instant.
The verifier checks the signature against the handle's pubkey, which it can
resolve.

```jsonc
{
  "v": 1,
  "type": "message",
  "handle": "satoshi@bitcoin",   // OPTIONAL — user picks an owned handle if absent
  "challenge": "…",              // opaque, caller-supplied
  "exp": 1786290000,             // REQUIRED
  "endpoint": "https://…",       // OPTIONAL — see §3
  "return": "https://…"          // OPTIONAL — https only
}
```

Records remain a request type, but for what they're actually for: persistent
public bindings the world should see. Not auth.

---

## 2. Request types are named by intent

Four types. `psbt` as a generic container is gone — see §6.

| type | what it does | untrusted fields |
|---|---|---|
| `message` | signs a challenge, proves handle ownership | `challenge` |
| `records` | adds / replaces / removes records | `ops[]` |
| `transfer` | signs handing the handle to someone else | `to` |
| `sale` | signs an offer to sell at a price | `price` |

Naming by intent means nacho **constructs** the transaction rather than accepting
one. Each type ends up with a small, specific untrusted surface instead of a
whole output set to validate.

UI never says "PSBT". Titles are "Transfer handle", "Sell handle", "Add a
record", "Sign in". PSBT stays the wire format and appears only in dev docs and
in the label of the copyable result.

---

## 3. `origin` only exists when there's an endpoint

The old spec showed a payload-supplied `origin` on every screen. That field is
free for an attacker to set, and rendering it as a domain implies attestation we
don't have.

Universal links don't help here. `https://<domain>/sign` only opens nacho for a
domain in our own AASA file — so the verified origin is always *ours*, and says
nothing about who built the payload. Treat `nacho://`, QR, and universal links as
identical in trust terms: all carry an unauthenticated payload.

**Rules:**

- Delete the decorative `origin` field. Don't show a self-declared name anywhere.
- If the request has an `endpoint`, derive the host **from that URL** and show it
  at the moment of sending: `Send to demo.nacho.app`. That host is meaningful
  because it's where data actually goes.
- No endpoint → no origin shown, and the only result action is copy.
- Don't add an "unknown source" row. The user scanned it; they know where from.
  A row that can't change a decision is noise.

**Endpoint validation** (all required):

- `https` only. Reject `http`, `javascript:`, `data:`, `file:`, custom schemes.
  Opening an arbitrary scheme lets a QR pivot into another app's deep-link handler.
- Reject private ranges, loopback, link-local, non-standard ports.
- Dev mode may relax to `http://localhost` — **only** when dev mode is on, so
  we're not tempted to weaken the production rule for local testing.

Same scheme validation applies to `return`.

---

## 4. `exp` required, `ref` optional

### `exp` — required on every request

Unix seconds. Reject when past. Show remaining validity on the confirmation
screen.

**What it's actually for: making stale-request failures legible.** It is *not*
replay protection.

- A site renders a login QR, the user wanders off, comes back twenty minutes
  later and scans. The site's pending session is long gone, so the response goes
  nowhere and the user sees an unexplained failure. With `exp` we can say "this
  request expired, refresh the page" — which is true, and matches the challenge
  having expired on their side too.
- Printed posters and forwarded chat messages have no natural end of life.
  Someone scanning a year-old code gets a request nobody is still honouring.
- Marginally, it bounds the window for an intercepted request. Weak — an attacker
  would still need a user to scan and approve it.

**What it is not:** protection against a user re-scanning an old QR. That
requires deliberately scanning and deliberately approving, and publishing what it
says is arguably correct at that point. Don't justify `exp` that way.

Required because it costs callers nothing and converts a mysterious failure into
an explainable one.

### `ref` — optional, echoed verbatim

**Renamed from `nonce`.** That name was wrong and actively misleading: a nonce
means number-used-once and implies replay protection, so an implementer seeing it
will assume protection exists somewhere and skip building it where it's needed.
`ref` says what it is — the caller's reference, echoed back.

Opaque. Chosen by the caller. Returned unchanged in the response. **Nacho gives it
no meaning, never parses it, never validates it.**

**Optional, because in practice callers rarely need it.**

- With `endpoint` or `return`, a query param on the URL does the same job.
- With copy-paste, the response is already scoped to a handle and a type. A site
  with two simultaneous pending paste-backs for the same handle is thin enough not
  to design around — and the caller can solve it themselves by marking the
  challenge, the record key, or whatever content they control.

It exists because it costs one line and spares some caller from smuggling state
into a field that has a real job.

**Never display it.** An echoed, requester-controlled string is exactly the thing
that ends up rendered as a label on a confirmation screen — and then it's
spoofable text, the same mistake `origin` was making. Echo it, don't show it.

### Replay protection comes from elsewhere, per type

Neither field provides it. Each type is already covered:

| type | what prevents replay |
|---|---|
| `message` | the challenge — verifier picked it, a replayed signature is worthless against a fresh one |
| `records` | `set` is an upsert, so republishing is idempotent |
| `transfer` / `sale` | the UTXO — once spent, every signature against it is dead |

Don't add a seen-list. It's persistent state buying nothing.

Where a signature exists and a `ref` is in use, it should be covered by the
signature so a response can't be lifted and re-tagged onto a different request.
For `message` that's automatic if the caller puts their marker in the challenge.

## 5. Records

### Frame these as incoming requests, not settings actions

"Add a record" reads like something the user opened themselves. It isn't — an
outside party is instructing, and the screen should say so in its structure.

- Title: **"Approve record change"** across add / replace / remove. The specific
  operation is already visible in the diff below; the title's job is to signal
  that something is being *asked*.
- Section label: **"A request asks to add"** / "…to replace" / "…to remove",
  rather than "Adding 1 record".

This is how the untrustedness gets expressed. **Not** with a banner or a source
row — those were removed for good reason and shouldn't come back. The request's
*contents* are untrusted; its *provenance* is something the user already knows,
because they scanned it. Two different claims, and only the first belongs on
screen.

Deep links are the exception worth revisiting: a `nacho://` URL can arrive from
an email or a forwarded message, so the user may genuinely not know what invoked
it. When that path ships, a source signal earns its place there. Not for QR.

### Resolve at approval, not at scan

Don't hit the network on every scan. But that means the diff shown at scan time
was computed against a cached zone.

Flow: show cached diff → user approves → resolve live zone → recompute → **if the
real diff differs from what was displayed, show the corrected diff and require a
second tap**. Only then publish.

Costs one extra tap in the rare case, and closes the window where a stale request
silently clobbers a change made from another device.

### Adds and replaces are different operations

Never render `1 record` when a replace is happening — a count hides the
destruction.

- **Add** — new `(rtype, key)`. Green, additive.
- **Replace** — existing `(rtype, key)`. Show **old value and new value, both in
  full**. That diff is a stronger warning than any prose; someone whose payment
  address is being swapped will see their own address disappearing.
- **Remove** — `delete` without `rtype` matches broadly. Surface as
  "Removes N records" with all of them listed, not as one op.

### Value-bearing records need more than a tap

A first-time add to an empty key is the *worst* case, not the safest: no prior
value means nothing looks missing, and the handle now carries an authoritative
endpoint under the user's name. The famous-person-donation-address attack works
best on an empty key.

We can't enumerate every address format. But the payload declares its own key
names, and the prefixes we do know cover most real attacks. For those:

- Show the **full value, chunked**, same treatment as the transfer recipient key.
  **No suffix matching.** Matching the last few characters is a *comparison* aid —
  it works in a wallet send flow because the user has a known-good address on
  another screen. Here they're seeing it for the first time and have nothing to
  compare against, so they need the whole thing legible. It also sidesteps the
  question of how many characters are enough, which has no good answer against a
  vanity-generated collision.
- Require an explicit acknowledgement, worded generically so it works across
  every address type: **"I've read this address and it's the one I meant to add."**

**Warning copy, tiered by consequence.** The tier is **not** derived from `rtype`.
`addr` carries no default meaning: `addr:btc` is a payment destination,
`addr:nostr` is a relay pointer, a PGP fingerprint is an identity binding. Getting
the last one wrong means impersonation, not lost funds — different consequence,
different sentence.

So this needs a **per-key registry**: known key names mapped to a tier and a copy
line. Anything not in the table falls to the generic tier.

| tier | examples | line | acknowledgement |
|---|---|---|---|
| **Destination** | `btc`, `ln` — funds flow here | Payments sent to your handle will go to this address. | yes |
| **Identity binding** | PGP fingerprint, npub, signing keys | Anyone verifying you through your handle will check against this. | yes |
| **Generic** | everything else, incl. unknown keys | Apps reading your handle will use this value. | no |

The registry is a table you extend forever, and that's fine. The property that
matters: **anything unrecognised lands on the generic line** rather than
inheriting payment language from its rtype. Never guess a key's meaning from its
prefix.

Avoid hedging ("can impact", "may affect") — the effect is certain. Avoid
"updating", which implies a prior value; the empty-key case is the dangerous one.

Don't warn generically on every record. `_app.demo` is inert, and warning about
inert things trains people to ignore warnings that matter.

### Limits

- Cap `ops.length`. A request that can't be reviewed can't be consented to.
- Reject duplicate `(rtype, key)` within one request — ordering makes the diff
  ambiguous.
- Enforce `packedByteLength` before allowing publish.
- Reject unknown `rtype`, empty keys, malformed values, and ops on handles the
  user doesn't own or can't publish for.

### seq

`seq = now` in seconds collides on two publishes in the same second, and clock
skew ahead of real time burns seq space the user can't recover until wall-clock
catches up. Use `max(now, lastSeq + 1)`.

---

## 6. Transfer and sale

Both produce `SIGHASH_SINGLE | ANYONECANPAY` signatures. Existing safety rails
stay: only that sighash is produced, only inputs whose spk matches an owned
handle are signed, never a caller-supplied key.

### The outpoint can be trusted, because it's self-checking

BIP-341 with `ANYONECANPAY` commits, for the input being signed: outpoint,
**amount**, scriptPubKey, nSequence. A caller who lies about the amount gets a
signature that fails validation against the real UTXO. The transaction can't be
broadcast.

So: **if the signature is usable at all, the declared amount was true.** Display
it as fact, not as a claim.

We have no chain view, so a stale outpoint produces a valid-looking signature that
will never complete. **This is an internal caveat — don't surface it.** Telling
users we can't verify an outpoint explains our infrastructure gap, not their
situation, and invites the question of why not. If it becomes a real support
problem, fix it with anchor relay data (see Deferred), not with copy.

### What to say instead: irreversibility

Signing does not move the handle. The signature is `SINGLE|ANYONECANPAY`, so it's
a bearer instrument — **the handle moves when someone broadcasts it.** That's what
the warning has to be about:

> Once this transaction is broadcast, the handle is theirs. There is no way to
> undo it.

Applies to external transfers and sales. Not to cancel/rotate, where the
destination is the user's own key.

### Talking about chain delay

Never say "we can't see the chain." Users hear it as a defect. State the delay in
terms of the app:

> Offers stay valid until it confirms, and can take up to a day to clear here.

Check the figure against the certificate pipeline before shipping — an external
transfer surfaces in nacho when the cert pipeline notices the rebinding, not when
the transaction confirms, so the honest number may be longer than "a few hours."

### Transfer

```jsonc
{ "v": 1, "type": "transfer", "handle": "…", "to": "5120…", "exp": …, "ref": "…" }
```

- `to` is the only untrusted field, and it can't be eliminated — the recipient is
  external by definition. Render it as an address, chunked, never raw hex. Prompt:
  does this match what the recipient gave you?
- If `to` matches one of the user's own handles or keys, **say so loudly**.
  Self-transfer is the safe case, and it's the mechanism behind both
  user-initiated actions below.
- **nacho computes the output amount from the input amount.** Don't take it from
  the payload — a lower value there is the requester skimming the difference.

Worth considering: transfer may not need to be a request type at all. If the user
initiates from the handle screen and scans/pastes the *recipient's* key, our
untrusted-payload surface reduces to sales only. Lower priority than shipping.

### Two user-initiated self-transfers

Same mechanism, different consequences, so **two separate actions with different
labels**. One label can't be honest about both.

| action | destination | effect |
|---|---|---|
| **Cancel offers** | same key | invalidates outstanding signatures, nothing else changes |
| **Rotate key** | a fresh key | invalidates offers *and* rebinds the handle |

- Rotation must generate a genuinely new key. Rotating within the same
  seed/keystore accomplishes nothing.
- Protocol side: the old genesis key becomes a tombstone linked to the new key.
  No certificate re-issuance, so **the handle does not return to the
  waiting-for-certificate state**. Nothing for the UI to warn about — don't
  invent a scary confirmation for it.
- Both emit a PSBT the user copies into their own wallet to broadcast. We have no
  chain view, so we can't confirm either landed. Say so.

### Sale

```jsonc
{ "v": 1, "type": "sale", "handle": "…", "price": 500000, "exp": …, "ref": "…" }
```

- Payload carries **only the price**. Nothing else in it is spoofable.
- Payout address is **never** taken from the payload. Prefill from the user's own
  `addr:btc` record if set — they already declared where they want money. Show
  which record it came from. Re-read at sign time rather than caching. Allow edit;
  require entry if unset.
- The handle rolls to the output the buyer appends. **We cannot know who ends up
  owning it.** Copy names the amount inline:
  **"Anyone who pays ₿500,000 can take ownership of this handle."** Don't write
  "whoever completes this transaction" — vaguer, and it buries the number that
  makes the sentence concrete.

**Output value.** The payment output is `input value + price` — the asking price
can't equal the input value, so the handle's own value rides along on top. A ₿100,000,000
handle sold for ₿1 produces a ₿100,000,001 output.

Mostly internal, but it surfaces in one place: **never show the raw output value
as what the user receives.** Lead with the price as the headline number. If the
raw output appears anywhere, label it as including the handle's own value
returned.

**Dust.** Two outputs must clear dust and both can fail:

- The payment output (`input + price`) — safe in practice, but validate.
- The buyer's appended output carrying the handle — constrains which handle UTXO
  values can be sold at all.

Validate **before** signing. A user who taps approve and then hits a dust error
has already spent the biometric prompt and thinks something worse went wrong.

### Signed offers are bearer instruments

Once approved, anyone holding the signature can complete the sale — today or in a
year, at today's price. `exp` doesn't help; nothing in the sighash commits to
time. The only invalidation is spending the UTXO.

- Copy must state it: **"This offer stays valid until you cancel it."**
- Provide **Cancel offer**: emits a self-transfer PSBT for the user to copy into
  an assembler and broadcast. nacho has no chain view, so we can't confirm it
  landed — say so.
- Gate sale approval behind **device authentication**. Full-screen confirmation
  with price and payout address. Highest-consequence thing the app does.

**Never name the auth method in our own UI.** Face ID, Touch ID, fingerprint,
face unlock, iris, pattern, PIN — it varies by platform, device, and what the
user actually enrolled. A button reading "Sign offer · Face ID" is wrong on
Android, wrong on a Touch ID iPhone, and wrong for anyone who only has a passcode.

- Button says **"Sign offer"**. The OS prompt names the method itself.
- `expo-local-authentication` reports what's available and enrolled; use it to
  decide *whether* to prompt, not to compose a label.
- Have a fallback path for devices with nothing enrolled — device passcode, or
  proceed without if that's the call. Don't leave the sale flow unreachable.

### Multiple live offers are fine

No double-spend risk; first to broadcast wins. A seller can deliberately publish
descending offers as a Dutch auction. **Don't warn about this.**

What the seller needs is visibility, not a warning. nacho signed them, so it can
list them locally: "2 live offers: 500k, 300k." Purely local state, no chain view
needed. Doubles as the entry point to Cancel.

---

## 7. Formatting amounts and keys

Follow the Bitcoin Design Guide:
<https://bitcoin.design/guide/designing-products/units-and-symbols/>

### Amounts — use the ₿-only format (BIP-177)

Integers only, no decimals, no "sats" anywhere in the UI.

| don't | do |
|---|---|
| `0.00500000 BTC` | `₿500,000` |
| `500,000 sats` | `₿500,000` |
| `3.25 BTC` | `₿325,000,000` (or `₿325M`) |

The guide's rationale applies directly to us: leading zeroes are hard to parse,
"sats" alongside "BTC" is an education hurdle for new users, and wallets that
switch between decimal and integer depending on magnitude are unpredictable.

Practices:

- Label with **₿**, prefix or postfix per locale.
- **Fiat below the bitcoin figure** for clarity. If we have no price source at
  launch, omit it rather than showing a stale number — but leave room in the
  layout.
- `BTC` still means 100M base units if it appears in dev-facing text. It should
  not appear in the UI.
- Locale-aware digit group and decimal separators (`Intl.NumberFormat`).
- Our prices are small integers, so this is a straight win. `₿500,000` is
  readable at a glance; `0.00500000 BTC` isn't.

Adoption as of Jan 2026 includes Bitkit, Wallet of Satoshi, Cash App, Blitz,
Lexe, Alby Hub, and Square's point-of-sale. This is no longer an unusual choice.

### Keys and addresses

Same guide, visual styling section:

- **Monospace**, so characters are comparable across lines.
- **Slashed zeros.** Users must distinguish `0` from `O` in keys and addresses.
  Note `0`, `O`, `I`, `l` aren't valid in addresses at all, but users don't know
  that, so the slashed zero still helps.
- **Digit / character groups** separated by a thin space. Already applied to the
  transfer recipient key and address records.
- **Trailing zeros** retained in right-aligned lists so amounts compare cleanly.

---

## 8. Result screen

One screen for all types. Two actions:

- **`Send to <host>`** — primary, only when the request had a valid `endpoint`.
  Host derived from the endpoint URL. One-shot; we do not keep sessions.
- **`Copy response`** — always present. Only action when there's no endpoint.

An absent endpoint means the requester *can't* consume a POST, so it's not a
preference — don't show a Send button that will silently 404.

Response QR is a later addition (covers desktop-site-and-phone, where there's no
shared clipboard). Not now.

---

## 9. Deferred — do not build now

- Anchor relays serving current outpoint + spent status. Would remove the
  unverifiable-outpoint problem, let us confirm a cancel landed, and let us show
  whether an offer is still live. Worth doing; not now.
- Live offer tracking and Cancel offer. **First thing to add after shipping.**
  Minimum viable version: record that an offer exists and show a line on the
  handle screen so someone can go looking before they list again.
- Response QR on the result screen.
- Relay transport (nostr / NIP-46 shape). Endpoint + copy covers current needs.
- Push notifications, handle-addressed inbound requests, sessions. All out of
  scope: they need a device-token service, and they reintroduce a spam surface.
  Everything we ship is user-initiated, which means nacho is open by definition.

---

## 10. Deep-link wiring (unchanged)

- Custom scheme `nacho://` already in `app.json`.
- Universal links: `ios.associatedDomains: ["applinks:<domain>"]`, Android
  `autoVerify` https intent filters, host `apple-app-site-association` and
  `assetlinks.json`.
- Route `app/(main)/sign.tsx`, gated behind a configured keystore. Handle cold
  start (`getInitialURL`) and warm (`Linking` subscription).
- Remember: universal links carry no more trust than a QR. See §3.