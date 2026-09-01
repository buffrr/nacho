"use client";

import { useState } from "react";
import type { ReactNode } from "react";

export function PayBlock({
  payUri,
  payLabel,
  icon,
  qr,
  scanStr,
  isBolt12,
}: {
  payUri: string;
  payLabel: string;
  icon: ReactNode;
  qr: ReactNode;
  scanStr: string;
  isBolt12: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="payrow">
        <a className="pay" href={payUri}>
          <span className="bi">{icon}</span>
          {payLabel}
        </a>
        <button
          type="button"
          className={`payqr-btn${open ? " on" : ""}`}
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Hide QR code" : "Show QR code"}
          aria-expanded={open}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="5" height="5" rx="1" />
            <rect x="16" y="3" width="5" height="5" rx="1" />
            <rect x="3" y="16" width="5" height="5" rx="1" />
            <path d="M21 16h-3a2 2 0 0 0-2 2v3" />
            <path d="M21 21v.01" />
            <path d="M12 7v3a2 2 0 0 1-2 2H7" />
            <path d="M3 12h.01" />
            <path d="M12 3h.01" />
            <path d="M12 16v.01" />
            <path d="M16 12h1" />
            <path d="M21 12v.01" />
            <path d="M12 21v-1" />
          </svg>
        </button>
      </div>

      {open ? (
        <div className="scancard">
          <div className="scan-top">
            <span className="scan-lab">Scan to pay</span>
            {isBolt12 ? <span className="scan-badge">BOLT12</span> : null}
          </div>
          <div className="scan-qr">{qr}</div>
          <p className="scan-str">{scanStr}</p>
        </div>
      ) : null}
    </>
  );
}
