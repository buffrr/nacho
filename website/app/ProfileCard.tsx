import qrcode from "qrcode-generator";
import { Icon } from "@/lib/icons";
import { recordMeta } from "@/lib/records";
import { CardActions } from "./CardActions";
import { PayBlock } from "./PayBlock";
import { CopyChip } from "./CopyChip";
import { RecordsPanel } from "./RecordsPanel";

const APP_STORE_URL = "https://apps.apple.com/app/id6755894049";

export type Rec = { type: string; key: string; value: string[] };
export type Data = {
  handle: string;
  found: boolean;
  sovereign?: boolean;
  updatedAt?: number | null;
  anchor?: number | null;
  pubkey?: string | null;
  numId?: string | null;
  alias?: string | null;
  relayHost?: string;
  records?: Rec[];
};

// avatar hue: FNV-1a over the handle → the app's hue palette
const HUES = [251, 220, 195, 170, 145, 120, 280, 310, 340, 5];
export function hueFor(s: string) {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return HUES[h % HUES.length];
}
export const initials = (h: string) =>
  h.split("@")[0].replace(/^@/, "").slice(0, 2) || "@";

function ago(sec: number): string {
  const d = Math.floor(Date.now() / 1000) - sec;
  if (d < 90) return "just now";
  if (d < 3600) return `${Math.round(d / 60)}m ago`;
  if (d < 86400) return `${Math.round(d / 3600)}h ago`;
  if (d < 2592000) return `${Math.round(d / 86400)}d ago`;
  return `${Math.round(d / 2592000)}mo ago`;
}
const commas = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const short = (v: string) => (v.length <= 34 ? v : `${v.slice(0, 22)}…${v.slice(-8)}`);

export function ProfileCard({ data }: { data: Data }) {
  const handle = data.handle;
  const hue = hueFor(handle);
  const av = `linear-gradient(145deg, hsl(${hue} 20% 46%), hsl(${hue} 26% 26%))`;
  const recs = data.records ?? [];
  const relayHost = data.relayHost ?? "a Spaces relay";

  const payRec = recs.find((r) => recordMeta(r.type, r.key).pay);
  const payMeta = payRec ? recordMeta(payRec.type, payRec.key) : null;
  const payUri = payRec && payMeta?.pay ? payMeta.pay(payRec.value[0]) : null;
  const payLabel = payMeta?.label.includes("Lightning")
    ? "Pay with Lightning"
    : "Pay with Bitcoin";
  const isBolt12 = payRec?.key === "ln";
  const openInApp = `nacho://resolve?prefill=${encodeURIComponent(handle)}`;

  return (
    <div className="pcols">
      {/* LEFT — sticky identity */}
      <aside className="side">
        <div className="sidecard">
          <div className="av" style={{ background: av }}>
            {initials(handle)}
          </div>
          <div className="rhandle">{handle}</div>
          <p className="status">
            <svg className="seal" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 .8 9.8 2 12 1.7l.9 2 2 .9-.3 2.2L15.8 8l-1.2 1.2.3 2.2-2 .9-.9 2-2.2-.3L8 15.2 6.8 14l-2.2.3-.9-2-2-.9.3-2.2L.8 8 2 6.8l-.3-2.2 2-.9.9-2L6.8 2 8 .8Zm3.1 5.1a.7.7 0 0 0-1 0L7.2 8.8 5.9 7.5a.7.7 0 1 0-1 1l1.8 1.8c.3.3.7.3 1 0l3.4-3.4a.7.7 0 0 0 0-1Z" />
            </svg>
            <b>{data.sovereign ? "Sovereign" : "Registered"}</b>
            {data.updatedAt ? <> · updated {ago(data.updatedAt)}</> : null}
          </p>
          <div className="trust">
            <dl className="trust-list">
              {data.pubkey ? (
                <div className="trust-row">
                  <dt>Public key</dt>
                  <dd>
                    <CopyChip
                      value={data.pubkey}
                      display={
                        data.pubkey.length > 21
                          ? `${data.pubkey.slice(0, 20)}…`
                          : data.pubkey
                      }
                    />
                  </dd>
                </div>
              ) : null}
              {data.numId ? (
                <div className="trust-row">
                  <dt>Num id</dt>
                  <dd>
                    <CopyChip
                      value={data.numId}
                      display={
                        data.numId.length > 21
                          ? `${data.numId.slice(0, 20)}…`
                          : data.numId
                      }
                    />
                  </dd>
                </div>
              ) : null}
              {data.alias ? (
                <div className="trust-row">
                  <dt>Alias</dt>
                  <dd>{data.alias}</dd>
                </div>
              ) : null}
              {data.anchor ? (
                <div className="trust-row">
                  <dt>Anchored</dt>
                  <dd>block {commas(data.anchor)}</dd>
                </div>
              ) : null}
            </dl>
          </div>

          {payUri && payRec ? (
            <PayBlock
              payUri={payUri}
              payLabel={payLabel}
              icon={<Icon name={payMeta!.icon} size={18} />}
              qr={<Qr text={payUri} size={188} />}
              scanStr={short(payRec.value[0])}
              isBolt12={isBolt12}
            />
          ) : null}

          <CardActions handle={handle} />
        </div>
      </aside>

      {/* RIGHT — records */}
      <div className="main">
        <RecordsPanel records={recs} source={relayHost} />
        <div className="mainfoot">
          <p className="pnote">
            Open the nacho app to verify
            the records are legitimate against your own trust anchor.
          </p>
          <a className="openapp" href={openInApp}>
            Open in the nacho app ↗
          </a>
        </div>
      </div>
    </div>
  );
}

// Server-rendered QR (no client JS, no network). Dark modules on a white tile.
function Qr({ text, size = 188 }: { text: string; size?: number }) {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const pad = 2;
  const total = n + pad * 2;
  let d = "";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) d += `M${c + pad},${r + pad}h1v1h-1z`;
    }
  }
  return (
    <svg className="qrsvg" width={size} height={size} viewBox={`0 0 ${total} ${total}`} aria-hidden="true">
      <rect width={total} height={total} rx="2" fill="#ffffff" />
      <path d={d} fill="#0b0b0d" />
    </svg>
  );
}

export { APP_STORE_URL };
