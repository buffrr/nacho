import type { Metadata } from "next";
import { Suspense } from "react";
import { peek, displayRecords, isSovereign, seqUpdatedAt, normalizeHandle, RELAY_HOST } from "@/lib/peek";
import { Logo } from "../Logo";
import { ProfileCard, APP_STORE_URL, initials, hueFor, type Data } from "../ProfileCard";
import { HandleSearch } from "./HandleSearch";

type Params = { handle: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { handle: raw } = await params;
  const handle = normalizeHandle(raw) ?? raw;
  // No relay fetch here — keep previews free of network requests.
  const description = "Own your address on the internet.";
  return {
    title: handle,
    description,
    openGraph: { title: handle, description, type: "profile" },
    // `card` must be set here — a child `twitter` object replaces the root's,
    // so without it the page falls back to the small `summary` card (tiny
    // thumbnail on Telegram/X instead of the large banner).
    twitter: { card: "summary_large_image", title: handle, description },
  };
}

export default async function HandlePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { handle: raw } = await params;
  const handle = normalizeHandle(raw);

  // The relay `peek` is the slow part. Render the shell (nav + frame) instantly
  // and stream the profile inside a Suspense boundary — this lets the router
  // transition immediately on navigation instead of blocking on the fetch,
  // showing a skeleton in place until the zone resolves.
  return (
    <div className="lp lp-sub">
      <Bg />
      <nav>
        <div className="navinner">
          <a className="logo" href="/" aria-label="nacho">
            <Logo height={44} />
          </a>
          <HandleSearch />
          <a className="btn btn-p" href={APP_STORE_URL}>
            Get the app
          </a>
        </div>
      </nav>

      <main>
        <div className="phandle">
          {handle ? (
            <Suspense key={handle} fallback={<ProfileSkeleton handle={handle} />}>
              <HandleBody handle={handle} />
            </Suspense>
          ) : (
            <NotFound handle={raw} invalid />
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

async function HandleBody({ handle }: { handle: string }) {
  const zone = await peek(handle);
  if (!zone) return <NotFound handle={handle} />;
  const data: Data = {
    handle,
    found: true,
    sovereign: isSovereign(zone),
    updatedAt: seqUpdatedAt(zone),
    anchor: typeof zone.anchor === "number" ? zone.anchor : null,
    pubkey: zone.script_pubkey ?? null,
    numId: zone.num_id ?? null,
    alias: zone.alias ?? null,
    relayHost: RELAY_HOST,
    records: displayRecords(zone),
  };
  return <ProfileCard data={data} />;
}

// Streamed placeholder shown while the relay peek is in flight. Reuses the
// ProfileCard layout classes so nothing shifts when real data arrives; the
// avatar + handle are already known, so only the details shimmer.
function ProfileSkeleton({ handle }: { handle: string }) {
  const hue = hueFor(handle);
  const av = `linear-gradient(145deg, hsl(${hue} 20% 46%), hsl(${hue} 26% 26%))`;
  return (
    <div className="pcols">
      <aside className="side">
        <div className="sidecard">
          <div className="av" style={{ background: av }}>
            {initials(handle)}
          </div>
          <div className="rhandle">{handle}</div>
          <p className="status">
            <span className="sk sk-line" style={{ width: 150 }} />
          </p>
          <div className="trust">
            <dl className="trust-list">
              <div className="trust-row">
                <dt>Public key</dt>
                <dd>
                  <span className="sk sk-line" style={{ width: 140 }} />
                </dd>
              </div>
              <div className="trust-row">
                <dt>Anchored</dt>
                <dd>
                  <span className="sk sk-line" style={{ width: 90 }} />
                </dd>
              </div>
            </dl>
          </div>
          <div className="payrow">
            <span className="sk sk-pay" />
            <span className="sk sk-qr" />
          </div>
          <div className="cardactions">
            <span className="sk sk-line" style={{ width: 48 }} />
            <span className="sk sk-line" style={{ width: 48 }} />
            <span className="sk sk-line" style={{ width: 48 }} />
          </div>
        </div>
      </aside>
      <div className="main">
        <div className="recskel" aria-hidden="true">
          <span className="sk sk-tabs" />
          <span className="sk sk-sec" />
          <span className="sk sk-row" />
          <span className="sk sk-row" />
          <span className="sk sk-sec" />
          <span className="sk sk-row" />
          <span className="sk sk-row" />
        </div>
      </div>
    </div>
  );
}

function NotFound({ handle, invalid }: { handle: string; invalid?: boolean }) {
  const hue = hueFor(handle);
  return (
    <div className="card nfcard">
      <div className="card-top">
        <div
          className="av"
          style={{ background: `linear-gradient(180deg, hsl(${hue} 6% 30%), hsl(${hue} 8% 18%))` }}
        >
          {initials(handle)}
        </div>
        <div className="rhandle">{handle}</div>
        <div className="rverif" style={{ color: "var(--fg3)" }}>
          {invalid ? "Not a valid handle" : "Could be available"}
        </div>
      </div>
      <div className="empty">
        <div className="eh">
          {invalid ? "That isn't a handle" : `${handle} could be available`}
        </div>
        <p className="ed">
          {invalid
            ? "Handles look like name@example — e.g. grace@key."
            : "We couldn't find this handle — it may be unregistered. Check if it's available to buy and claim it:"}
        </p>
        {invalid ? null : (
          <div className="emptybtns">
            <a
              className="btn btn-p"
              href="https://atbitcoin.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              Check on atbitcoin.com
            </a>
            <a className="btn btn-g" href={APP_STORE_URL}>
              Check in the app
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function Bg() {
  return (
    <div className="bg" aria-hidden="true">
      <div className="glow" />
      <div className="dots" />
      <svg className="grain">
        <filter id="n">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves={3} />
        </filter>
        <rect width="100%" height="100%" filter="url(#n)" />
      </svg>
    </div>
  );
}

function Footer() {
  return (
    <footer>
      <div className="fin">
        <p>nacho — handles on the Spaces protocol</p>
        <div className="fl">
          <a href="/">Home</a>
          <a href="https://spacesprotocol.org" target="_blank" rel="noopener noreferrer">
            Spaces protocol
          </a>
        </div>
      </div>
    </footer>
  );
}
