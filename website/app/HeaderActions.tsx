"use client";

import { useEffect, useState } from "react";

const APP_STORE_URL = "https://apps.apple.com/app/id6755894049";

export function HeaderActions({ handle }: { handle: string }) {
  const [copied, setCopied] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);

  const linkUrl = () =>
    typeof window !== "undefined"
      ? window.location.href
      : `https://nacho.io/${handle}`;

  async function copyHandle() {
    try {
      await navigator.clipboard.writeText(handle);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  async function share() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: handle, url: linkUrl() });
      } catch {
        /* cancelled */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(linkUrl());
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    if (!verifyOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setVerifyOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [verifyOpen]);

  return (
    <>
      <div className="pactions">
        <button type="button" className="pbtn" onClick={copyHandle}>
          {copied ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="11" height="11" rx="2.5" />
              <path d="M5 15V5a2 2 0 0 1 2-2h10" />
            </svg>
          )}
          <span>{copied ? "Copied" : "Copy handle"}</span>
        </button>

        <button type="button" className="pbtn pbtn-icon" onClick={share} aria-label="Share" title="Share">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v13" />
            <path d="m7 8 5-5 5 5" />
            <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
          </svg>
        </button>

        <button type="button" className="pbtn pbtn-icon" onClick={() => setVerifyOpen(true)} aria-label="Verify" title="Verify">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3 5 6v5c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        </button>
      </div>

      {verifyOpen && (
        <div className="modalbg" role="dialog" aria-modal="true" aria-label="Verify this handle" onClick={() => setVerifyOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="modalx" onClick={() => setVerifyOpen(false)} aria-label="Close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
            <div className="micon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3 5 6v5c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </div>
            <h3>Verify this handle</h3>
            <p>
              This page reads a single relay. To confirm{" "}
              <span className="mhandle">{handle}</span> is anchored on Bitcoin,
              open it in the nacho app and verify against your own trust anchor.
            </p>
            <a className="btn btn-p" href={APP_STORE_URL}>
              Get the app
            </a>
            <button type="button" className="mlater" onClick={() => setVerifyOpen(false)}>
              Maybe later
            </button>
          </div>
        </div>
      )}
    </>
  );
}
