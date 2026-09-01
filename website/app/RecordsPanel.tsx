"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { recordMeta, recordGroup } from "@/lib/records";
import type { RecordGroup } from "@/lib/records";
import { RecordRow } from "./RecordRow";
import type { Rec } from "./ProfileCard";

type Tab = "all" | "pay" | "key" | "link";
const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pay", label: "Pay" },
  { id: "key", label: "Keys" },
  { id: "link", label: "Links" },
];
const SECTIONS: { title: string; groups: RecordGroup[] }[] = [
  { title: "Payments and keys", groups: ["pay", "key"] },
  { title: "Links", groups: ["link"] },
  { title: "Note", groups: ["note"] },
];

export function RecordsPanel({ records, source }: { records: Rec[]; source: string }) {
  const [tab, setTab] = useState<Tab>("all");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [thumb, setThumb] = useState<{ x: number; w: number }>({ x: 0, w: 0 });

  const positionThumb = () => {
    const i = TABS.findIndex((t) => t.id === tab);
    const el = tabRefs.current[i];
    if (el) setThumb({ x: el.offsetLeft - 2, w: el.offsetWidth });
  };
  useLayoutEffect(positionThumb, [tab]);
  useEffect(() => {
    window.addEventListener("resize", positionThumb);
    return () => window.removeEventListener("resize", positionThumb);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const tagged = records.map((r) => ({ r, g: recordGroup(r.key, recordMeta(r.type, r.key)) }));
  const visible = tab === "all" ? tagged : tagged.filter((x) => x.g === tab);

  return (
    <div className="recpanel">
      <div className="rechead">
        <p className="recsrc">

        </p>
        <div className="rectabs" role="tablist" aria-label="Filter records">
          <span
            className="seg-thumb"
            style={{ transform: `translateX(${thumb.x}px)`, width: thumb.w }}
          />
          {TABS.map((t, i) => (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`rectab${tab === t.id ? " on" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {SECTIONS.map((sec) => {
        const rows = visible.filter((x) => sec.groups.includes(x.g));
        if (!rows.length) return null;
        return (
          <div className="recsec" key={sec.title}>
            <p className="recsec-h">{sec.title}</p>
            <div className="recgroup">
              {rows.map((x, i) => (
                <RecordRow r={x.r} key={i} />
              ))}
            </div>
          </div>
        );
      })}

      {visible.length === 0 ? <p className="recempty">No {tab} records.</p> : null}
    </div>
  );
}
