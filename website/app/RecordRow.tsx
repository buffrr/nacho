"use client";

import { useState } from "react";
import type { MouseEvent } from "react";
import { Icon } from "@/lib/icons";
import { recordMeta, glyphBackground, recordDesc } from "@/lib/records";
import type { Rec } from "./ProfileCard";

// Long opaque values (keys, BOLT12 offers) → middle-ellipsis; short ones as-is.
function preview(v: string): string {
  if (v.length <= 30) return v;
  return `${v.slice(0, 20)}…${v.slice(-8)}`;
}

export function RecordRow({ r }: { r: Rec }) {
  const [copied, setCopied] = useState(false);
  const m = recordMeta(r.type, r.key);
  const val = r.value.join(", ");
  const desc = recordDesc(r.key);
  const href = m.href ? m.href(r.value[0]) : null;

  async function copy(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(val);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="rec">
      <span className="ic" style={{ background: glyphBackground(m) }}>
        <Icon name={m.icon} size={16} />
      </span>
      <span className="rec-tx">
        <span className="rn">{m.label}</span>
        {desc ? <span className="rd">{desc}</span> : null}
      </span>
      <span className="rv">{preview(val)}</span>
      {href ? (
        <a className="recbtn" href={href} target="_blank" rel="noopener noreferrer" aria-label={`Open ${m.label}`} title="Open">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 17 17 7M17 7H8M17 7v9" />
          </svg>
        </a>
      ) : (
        <button type="button" className="recbtn" onClick={copy} aria-label={copied ? "Copied" : `Copy ${m.label}`} title={copied ? "Copied" : "Copy"}>
          {copied ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="11" height="11" rx="2.5" />
              <path d="M5 15V5a2 2 0 0 1 2-2h10" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}
