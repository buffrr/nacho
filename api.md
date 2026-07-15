# atbitcoin API — Nacho client integration

This document covers every server endpoint the Nacho mobile app is expected to hit, plus the Universal Link scheme for opening the app from web claim URLs.

## Base URLs

| Env | URL |
|---|---|
| Mainnet | `https://atbitcoin.com` |
| Testnet | `https://testnet.atbitcoin.com` |
| Local | `http://127.0.0.1:8888` |

All endpoints are unauthenticated (public). Every request/response body is JSON unless noted. Handles are always fully-qualified (`alice@bitcoin`) — never bare local parts.

## Two supported flows

Nacho supports two purchase paths:

1. **In-app purchase (IAP)** — buyer never touches the web. Nacho generates a keypair up front, reserves the handle, drives Apple/Google IAP, claims the handle with the resulting purchase receipt.
2. **Web-purchase redemption** — buyer paid on `atbitcoin.com` and got a claim code by email or on the success page. They open Nacho, paste (or Universal-Link) the code, Nacho generates a keypair and binds it.

Both paths land in the same `spaces` row on the server. A given handle is only ever bound once.

---

## Flow 1 — In-app purchase (IAP)

### Step 1a — Check handle availability

```
POST /api/spaces/status
```

Body:
```json
{ "handles": ["alice@bitcoin", "bob@bitcoin"] }
```

Response (`200 OK`):
```json
[
  { "status": "available", "handle": "alice@bitcoin", "price": 2500, "product_id": "atbitcoin_handle_mainnet" },
  { "status": "taken",     "handle": "bob@bitcoin", "script_pubkey": "0014…" }
]
```

Status values:

| Status | Meaning |
|---|---|
| `available` | Purchasable now. Includes `price` (cents) and `product_id` (SKU for StoreKit/Play Billing). |
| `taken` | Owned. `script_pubkey` returned if the owner has bound one. |
| `preallocated` | Reserved by an operator (blacklist); cannot be purchased. |
| `reserved` | Held by a pending payment (5-min window). |
| `processing_payment` | Payment settling; treat as taken. |
| `invalid` | Local part is malformed for the TLD (e.g. `xy@bitcoin` — too short). |
| `unknown` | TLD is not enabled (e.g. `alice@nostr` while only `bitcoin` is live). |

At most 50 handles per request.

### Step 1b — Reserve

```
POST /api/reserve
```

Body:
```json
{
  "handle": "alice@bitcoin",
  "script_pubkey": "0014deadbeef…",
  "payment_type": "iap"
}
```

Response (`200 OK`):
```json
{
  "deadline": 1723452000,
  "handle_status": { "status": "reserved", "handle": "alice@bitcoin" },
  "product_id": "atbitcoin_handle_mainnet"
}
```

Nacho should now drive the platform IAP with `product_id` and, once the receipt/JWS is available, call `/api/claim`.

Errors: `400` invalid handle, `409` handle already taken/reserved.

### Step 1c — Claim after IAP purchase

```
POST /api/claim
```

Body:
```json
{
  "handle": "alice@bitcoin",
  "script_pubkey": "0014deadbeef…",
  "payment_method": "google_iap",           // or "apple_iap"
  "purchase_token": "<StoreKit JWS or Play Store token>"
}
```

Response (`200 OK`):
```json
{ "handle_status": { "status": "taken", "handle": "alice@bitcoin" } }
```

- **Apple**: `purchase_token` is the JWS transaction from StoreKit 2. The server verifies the certificate chain against Apple's Root CA G3 and matches the bundle ID.
- **Google**: `purchase_token` is the Play Billing purchase token. The server verifies via the Android Publisher API.
- Idempotent: retrying with the same `(handle, script_pubkey, purchase_token)` returns `taken` without re-billing.
- Reusing the same token for a different `handle` or a different `script_pubkey` is rejected — the token is bound at first use.

Errors: `400` bad request/invalid token, `402` refunded transaction, `409` handle conflict.

**Mock tokens for local dev**:

| Prefix | Behavior |
|---|---|
| `test_valid_purchase_*` | Google Play mock — successful purchase |
| `test_apple_valid_*` | Apple mock — successful JWS |
| `test_apple_refunded_*` | Apple mock — refunded transaction (`402`) |

Mocks only work when the server is running with `test_*` tokens allowed (default in dev/testnet).

---

## Flow 2 — Web-purchase redemption

Buyer already paid on the web. Their success page or receipt email shows a URL and a short code:

- URL: `https://atbitcoin.com/claim/{token}` (opaque hex, ~64 chars)
- Short code: `ABCD-EFGH-JKLM` (12 chars, Crockford base32, hyphenated — for typing into the app)

### Redeem

```
POST /api/claim-code
```

Body:
```json
{
  "code": "ABCD-EFGH-JKLM",             // URL token OR short code — server accepts either
  "script_pubkey": "0014deadbeef…"
}
```

Response (`200 OK`):
```json
{ "handle": "alice@bitcoin", "status": "taken" }
```

Errors:

| HTTP | Body | Meaning |
|---|---|---|
| `400` | `{"error": "Invalid code"}` | Not a recognized token or short code |
| `400` | `{"error": "Invalid script_pubkey"}` | Malformed pubkey hex |
| `402` | `{"error": "Payment not yet settled"}` | Buyer's payment is still pending — retry in a few seconds |
| `409` | `{"error": "Handle already claimed"}` | Someone (maybe the same buyer) already redeemed this code |

Idempotent client-side: if the first response is `200`, the handle is bound; if the network drops mid-request but the server processed the write, a retry will get `409` — safe to treat as success.

---

## Universal Link registration

When the user taps `https://atbitcoin.com/claim/{token}` on their phone, iOS/Android should intercept and open Nacho directly. The web fallback (a page with a `script_pubkey` form) exists for users without Nacho.

**iOS** — host `apple-app-site-association` at `https://atbitcoin.com/.well-known/apple-app-site-association`:

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAMID.com.impervious.nacho",
        "paths": ["/claim/*"]
      }
    ]
  }
}
```

**Android** — host `assetlinks.json` at `https://atbitcoin.com/.well-known/assetlinks.json`:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.impervious.nacho",
    "sha256_cert_fingerprints": ["<Nacho signing cert SHA-256>"]
  }
}]
```

Once Nacho advertises the `/claim/*` intent filter and these files are live, tapping a claim URL opens Nacho, and Nacho reads the `{token}` path segment and passes it directly to `/api/claim-code`.

Send us the Team ID + package name + cert fingerprint and we'll deploy the association files.

---

## Reference: full endpoint list Nacho uses

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/spaces/status` | POST | Bulk availability + price + product ID |
| `/api/reserve` | POST | Pre-IAP reservation |
| `/api/claim` | POST | Bind pubkey after IAP purchase |
| `/api/claim-code` | POST | Bind pubkey using a web-issued claim code |
| `/claim/{token}` | GET | Universal Link target; server-side fallback UI if the app isn't installed |

Not for Nacho (web-only or server-only): `/api/cart/*`, `/api/webhook`, `/api/apple-notifications`, `/api/google-purchases`, `/api/resend-codes`.

---

## Error response conventions

Server errors on JSON endpoints always return:
```json
{ "error": "human-readable string" }
```

Common status codes:

| Code | Meaning |
|---|---|
| `200` | Success |
| `400` | Bad request (invalid input, malformed handle, invalid pubkey) |
| `402` | Payment required / not yet settled (retry after buyer settles) |
| `409` | Conflict (handle already taken, token already consumed) |
| `429` | Rate-limited (`/api/resend-codes` only) |
| `500` | Server error |

---

## Contact

- Backend: `contact@atbitcoin.com`
- Universal Link association: send us `appID` (iOS) and `package_name` + `sha256_cert_fingerprints` (Android) to deploy.
