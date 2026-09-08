// Android App Links — the Android counterpart of the iOS AASA. Lets
// nacho.io/<handle> (paths containing "@") open the nacho Android app when
// installed, and fall back to this website otherwise. Served at
// /.well-known/assetlinks.json with `application/json`.
//
// The SHA-256 fingerprint MUST be the certificate that SIGNS the installed app.
// With Play App Signing that is the "app signing key certificate" (Play Console
// → Test and release → App integrity). Include the upload key's SHA-256 too so
// builds installed outside Play (internal-app-sharing, direct APK) also verify.
// These fingerprints are public, not secrets. Set them via env in prod, or
// paste them into the fallback list below.
export const dynamic = "force-static";

const SHA256_FINGERPRINTS = (
  process.env.ANDROID_CERT_SHA256 ??
  // TODO: replace with the real fingerprint(s) from Play Console → App integrity
  // (app-signing key, and optionally the upload key), colon-separated hex.
  "REPLACE_WITH_PLAY_APP_SIGNING_SHA256"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const ASSETLINKS = [
  {
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: "com.impervious.nacho",
      sha256_cert_fingerprints: SHA256_FINGERPRINTS,
    },
  },
];

export function GET() {
  return new Response(JSON.stringify(ASSETLINKS), {
    headers: {
      "content-type": "application/json",
      "cache-control": "public, max-age=3600",
    },
  });
}
