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
  // Play App Signing key SHA-256 (Play Console → App integrity). Public, not a
  // secret. Add the upload key's SHA-256 here too (comma-separated) if you ever
  // distribute upload-key-signed builds outside Play (bundletool / app-sharing).
  "E5:04:30:17:F4:44:02:8E:E4:D6:39:07:CA:4F:C0:97:D2:A9:7F:1E:4F:1E:D8:DD:84:74:AB:71:20:FD:B4:14"
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
