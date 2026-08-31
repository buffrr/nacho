import type { Metadata } from "next";
import type { ReactNode } from "react";
import { peek, displayRecords, isSovereign, seqUpdatedAt, normalizeHandle } from "@/lib/peek";
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
  const description = `${handle} · own your internet address.`;
  return {
    title: handle,
    description,
    openGraph: { title: handle, description, type: "profile" },
    twitter: { title: handle, description },
  };
}

export default async function HandlePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { handle: raw } = await params;
  const handle = normalizeHandle(raw);

  let body: ReactNode;

  if (!handle) {
    body = <NotFound handle={raw} invalid />;
  } else {
    const zone = await peek(handle);
    if (!zone) {
      body = <NotFound handle={handle} />;
    } else {
      const data: Data = {
        handle,
        found: true,
        sovereign: isSovereign(zone),
        updatedAt: seqUpdatedAt(zone),
        records: displayRecords(zone),
      };
      body = (
        <>
          <ProfileCard data={data} />
          <p className="pnote">
            Open in the nacho app to verify records are legitimate yourself.
          </p>
        </>
      );
    }
  }

  return (
    <div className="lp lp-sub">
      <Bg />
      <nav>
        <a className="logo" href="/" aria-label="nacho">
          <Logo height={53} />
        </a>
        <HandleSearch />
        <a className="btn btn-p" href={APP_STORE_URL}>
          Get the app
        </a>
      </nav>

      <main>
        <div className="phandle">{body}</div>
      </main>

      <Footer />
    </div>
  );
}

function NotFound({ handle, invalid }: { handle: string; invalid?: boolean }) {
  const hue = hueFor(handle);
  return (
    <div className="card">
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
