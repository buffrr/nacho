# nacho.io — website

Public landing + handle lookup for nacho. Standalone Next.js (App Router) app —
**independent from the React Native app** in the repo root (its own
`package.json` / `node_modules`; Metro is configured to ignore this dir).

- **No crypto/WASM deps.** Handle resolution reads the Spaces relay `peek`
  endpoint (`/peek?q=<handle>`) — a plain JSON Zone dump — server-side. This is a
  convenience lookup from one relay, *not* the app's on-device anchor-verified
  trust; the UI says so and nudges "open in the app".
- **SSR + per-handle OG images** so `nacho.io/grace@key` previews nicely.
- **Universal links**: serves the AASA at `/.well-known/apple-app-site-association`
  claiming `/*@*`, so `nacho.io/<handle>` opens the app when installed, else falls
  back to this page.

## Run

```bash
cd website
npm install
npm run dev        # http://localhost:3000  → try /grace@key
npm run build && npm run start
```

## Config (optional env)

- `NACHO_RELAY_BASE` — relay peek base (default `https://relay-orion.spacesprotocol.org`)
- `NACHO_SITE_URL` — canonical site URL for metadata (default `https://nacho.io`)

## Structure

- `app/page.tsx` — landing + search field
- `app/[handle]/page.tsx` — SSR resolve + profile + deep links
- `app/[handle]/opengraph-image.tsx` — social preview card
- `app/.well-known/apple-app-site-association/route.ts` — universal-links AASA
- `lib/peek.ts` — relay fetch + Zone parse · `lib/records.ts` — record display map

## Deploy notes

- Any Node host (Vercel etc.). Keep `/.well-known/apple-app-site-association`
  served as `application/json` over HTTPS with **no redirect** (the route handler
  already sets the content-type).
- Team `4MA7A64R76`, bundle `com.impervious.nacho`, App Store id `6755894049` —
  update these if they change (`route.ts`, `layout.tsx`, `[handle]/page.tsx`).
