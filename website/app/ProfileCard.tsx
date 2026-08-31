import qrcode from "qrcode-generator";
import { Icon } from "@/lib/icons";
import { recordMeta } from "@/lib/records";
import { HeaderActions } from "./HeaderActions";
import { RecordRow } from "./RecordRow";

const APP_STORE_URL = "https://apps.apple.com/app/id6755894049";

export type Rec = { type: string; key: string; value: string[] };
export type Data = {
  handle: string;
  found: boolean;
  sovereign?: boolean;
  updatedAt?: number | null;
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

export function ProfileCard({ data }: { data: Data }) {
  const handle = data.handle;
  const hue = hueFor(handle);
  const av = `linear-gradient(180deg, hsl(${hue} 12% 40%), hsl(${hue} 20% 22%))`;
  const recs = data.records ?? [];
  const payRec = recs.find((r) => recordMeta(r.type, r.key).pay);
  const payMeta = payRec ? recordMeta(payRec.type, payRec.key) : null;
  const payUri = payRec && payMeta?.pay ? payMeta.pay(payRec.value[0]) : null;
  const payLabel = payMeta?.label.includes("Lightning")
    ? "Pay with Lightning"
    : "Pay with Bitcoin";
  const openInApp = `nacho://resolve?prefill=${encodeURIComponent(handle)}`;

  return (
    <div className="card">
      {/* identity header */}
      <div className="phead">
        <div className="av av-sm" style={{ background: av }}>
          {initials(handle)}
        </div>
        <div className="pident">
          <div className="rhandle">{handle}</div>
          <div className="pstatus">
            <svg className="pstatus-i" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            <span className="pstatus-t">
              {data.sovereign ? "Sovereign" : "Registered"}
            </span>
            {data.updatedAt ? (
              <span className="pstatus-m"> · updated {ago(data.updatedAt)}</span>
            ) : null}
          </div>
        </div>
        <HeaderActions handle={handle} />
      </div>

      {/* pay row */}
      {payUri ? (
        <div className="payrow">
          <a className="paybig" href={payUri}>
            <span className="paybig-i">
              <Icon name={payMeta!.icon} size={20} />
            </span>
            <span className="paybig-t">
              <span className="paybig-h">{payLabel}</span>
              <span className="paybig-s">Opens a wallet on this device</span>
            </span>
            <span className="paybig-a">↗</span>
          </a>
          <div className="qrchip">
            <Qr text={payUri} size={116} />
            <span className="qrlbl">Scan to pay</span>
          </div>
        </div>
      ) : null}

      {/* records */}
      <div className="reclabel">Records</div>
      <div className="reclist">
        {recs.map((r, i) => (
          <RecordRow r={r} i={i} key={i} />
        ))}
      </div>

      <a className="openapp" href={openInApp}>
        Open in the nacho app ↗
      </a>
    </div>
  );
}

// Server-rendered QR (no client JS, no network). Dark modules on a white tile so
// wallet cameras get the contrast they need even inside the dark card.
function Qr({ text, size = 116 }: { text: string; size?: number }) {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const pad = 2;
  const cell = size / (n + pad * 2);
  let d = "";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) {
        const x = ((c + pad) * cell).toFixed(2);
        const y = ((r + pad) * cell).toFixed(2);
        const s = cell.toFixed(2);
        d += `M${x},${y}h${s}v${s}h-${s}z`;
      }
    }
  }
  return (
    <svg className="qrsvg" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <rect width={size} height={size} rx="12" fill="#ffffff" />
      <path d={d} fill="#0b0b0d" />
    </svg>
  );
}

export { APP_STORE_URL };
