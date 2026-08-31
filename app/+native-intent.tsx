// Rewrites incoming deep-link / universal-link paths before Expo Router matches
// them. The one job here: a "link in bio" handle URL — nacho.io/@bitcoin (bare
// space) or nacho.io/alice@bitcoin — should open the Resolve tab and resolve the
// handle. The AASA on nacho.io only claims @-containing paths, so non-handle
// pages (/, /sign, /about…) never reach the app and load on the web instead.
//
// Everything else (nacho://sign?req=…, nacho://resolve?prefill=…, the
// bundle-id scheme, trust-approve, etc.) already routes correctly, so it passes
// through untouched.

const HANDLE_SLUG = /^[a-z0-9._-]*@[a-z0-9._-]+$/i;

export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}): string {
  try {
    // Universal links can arrive as a full URL; reduce to the path portion.
    let p = path;
    const url = p.match(/^https?:\/\/[^/]+(\/.*)$/i);
    if (url) p = url[1];

    // First path segment, minus query/fragment and surrounding slashes.
    const slug = decodeURIComponent(p.split(/[?#]/)[0].replace(/^\/+/, ""));

    // A bare handle slug (must contain "@": alice@bitcoin, or @bitcoin for a
    // bare space) → resolve it in-app.
    if (HANDLE_SLUG.test(slug)) {
      return `/(main)/(tabs)/resolve?prefill=${encodeURIComponent(slug.toLowerCase())}`;
    }
  } catch {
    // fall through to the original path on any parse error
  }
  return path;
}
