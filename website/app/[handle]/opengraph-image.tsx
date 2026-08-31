import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import { join } from "path";

export const runtime = "nodejs";
export const alt = "nacho handle";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Domain shown on the card. Keep in sync with the deployed host.
const SITE_HOST = "nacho.io";

// Vendored fonts (public/fonts) so previews render the brand type with ZERO
// network requests. Satori supports woff (not woff2).
const fontDir = join(process.cwd(), "public", "fonts");
const bricolage800 = readFileSync(join(fontDir, "bricolage-800.woff"));
const bricolage500 = readFileSync(join(fontDir, "bricolage-500.woff"));
const mono500 = readFileSync(join(fontDir, "martianmono-500.woff"));

export default async function Image({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle: raw } = await params;
  let handle = raw;
  try {
    handle = decodeURIComponent(raw);
  } catch {
    /* keep raw */
  }
  handle = handle.toLowerCase();

  const at = handle.indexOf("@");
  const before = at >= 0 ? handle.slice(0, at) : handle;
  const after = at >= 0 ? handle.slice(at + 1) : "";
  const hSize = handle.length > 22 ? 40 : handle.length > 15 ? 50 : 60;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          display: "flex",
          background: "#0c0b10",
          fontFamily: "Bricolage",
        }}
      >
        {/* dot grid across the whole canvas */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.08) 1.2px, transparent 0)",
            backgroundSize: "30px 30px",
          }}
        />
        {/* warm glow, upper-left */}
        <div
          style={{
            position: "absolute",
            left: -180,
            top: -240,
            width: 900,
            height: 780,
            display: "flex",
            background:
              "radial-gradient(ellipse at center, rgba(255,123,0,0.20), rgba(255,123,0,0) 58%)",
          }}
        />

        {/* nacho logo, top-right */}
        <div style={{ position: "absolute", top: 46, right: 58, display: "flex" }}>
          <Mark height={44} />
        </div>

        {/* inset vertical divider */}
        <div
          style={{
            position: "absolute",
            left: 605,
            top: 104,
            bottom: 104,
            width: 1,
            display: "flex",
            background: "rgba(255,255,255,0.10)",
          }}
        />

        {/* left — the pitch */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            width: 605,
            padding: "0 60px 0 64px",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 62,
              fontWeight: 800,
              lineHeight: 1.02,
              letterSpacing: -2,
              color: "#f7f4f0",
            }}
          >
            Own your address on the internet.
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 24,
              fontSize: 24,
              fontWeight: 500,
              lineHeight: 1.35,
              color: "#9a948e",
              maxWidth: 420,
            }}
          >
            One name for your socials, your site and getting paid.
          </div>
        </div>

        {/* right — the handle */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flex: 1,
            paddingLeft: 66,
          }}
        >
          <div
            style={{
              display: "flex",
              fontFamily: "Martian",
              fontSize: 19,
              fontWeight: 500,
              letterSpacing: 5,
              color: "#6b6660",
            }}
          >
            THIS HANDLE
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 22,
              fontFamily: "Martian",
              fontSize: hSize,
              fontWeight: 500,
              color: "#f7f4f0",
            }}
          >
            <span style={{ display: "flex" }}>{before}</span>
            {at >= 0 ? (
              <span style={{ display: "flex", color: "#ff7b00" }}>@</span>
            ) : null}
            <span style={{ display: "flex" }}>{after}</span>
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 20,
              fontFamily: "Martian",
              fontSize: 20,
              fontWeight: 500,
              color: "#6b6660",
            }}
          >
            {SITE_HOST}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Bricolage", data: bricolage800, weight: 800, style: "normal" },
        { name: "Bricolage", data: bricolage500, weight: 500, style: "normal" },
        { name: "Martian", data: mono500, weight: 500, style: "normal" },
      ],
    },
  );
}

// nacho logo (triangle brand-orange, wordmark near-white) — inlined with
// explicit fills so Satori needs no currentColor / font resolution.
function Mark({ height }: { height: number }) {
  const width = (height * 245) / 140;
  const ink = "#f7f4f0";
  return (
    <svg width={width} height={height} viewBox="0 0 245 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M36.239 21.244C31.0838 9.82436 41.3339 -2.52292 53.5024 0.448335L179.208 31.1425C190.465 33.8911 194.511 47.8102 186.482 56.1681L110.391 135.379C103.02 143.052 90.2317 140.848 85.8535 131.149L36.239 21.244Z" fill="#FF7B00" />
      <path d="M5.9383 50.729C7.25191 50.729 8.56535 51.0452 10.2993 52.6219L31.8453 71.9672V51.3083H41.7776V80.4304C41.7774 85.1086 38.9388 87.0528 35.7859 87.0528C34.4198 87.0528 33.1062 86.738 31.4249 85.1613L9.87892 65.816V86.4748H0V57.3007C0 52.6222 2.83786 50.729 5.9383 50.729Z" fill={ink} />
      <path d="M135.944 60.455H119.653C113.768 60.4552 109.354 63.9764 109.354 69.0224C109.354 74.0162 113.715 77.4334 119.653 77.4336H142.933L135.944 86.4748H119.653C107.462 86.4746 98.4756 78.7477 98.4756 68.5499C98.4756 58.2468 107.462 51.3085 119.653 51.3083H142.933L135.944 60.455Z" fill={ink} />
      <path d="M157.64 63.7656H178.555V51.3083H189.38V86.4748H178.555V72.9123H157.64V86.4748H146.709V51.3083H157.64V63.7656Z" fill={ink} />
      <path fillRule="evenodd" clipRule="evenodd" d="M219.304 87.0528C202.173 87.0527 193.608 81.4284 193.608 68.8649C193.608 56.3016 202.173 50.7291 219.304 50.729C236.435 50.7291 245 56.3016 245 68.8649C245 81.4284 236.435 87.0527 219.304 87.0528ZM204.433 68.8649C204.433 61.2956 208.374 59.8757 219.304 59.8757C230.234 59.8757 234.175 61.2956 234.175 68.8649C234.175 76.4345 230.234 77.9061 219.304 77.9061C208.374 77.9061 204.433 76.4345 204.433 68.8649Z" fill={ink} />
      <path fillRule="evenodd" clipRule="evenodd" d="M48.7224 77.8447L65.1481 54.6723C66.589 52.6647 68.6812 50.7314 71.9792 50.7314C75.2771 50.7314 77.3693 52.6647 78.8102 54.6723L95.2359 77.8447C97.8025 81.4653 95.2145 86.4748 90.7775 86.4748H53.1809C48.7438 86.4748 46.1558 81.4653 48.7224 77.8447ZM61.8707 77.4336L71.9792 63.1355L82.0876 77.4336H61.8707Z" fill={ink} />
    </svg>
  );
}
