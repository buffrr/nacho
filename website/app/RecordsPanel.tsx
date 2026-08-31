"use client";

import { useState } from "react";
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
  { title: "Payments · Keys", groups: ["pay", "key"] },
  { title: "Links", groups: ["link"] },
  { title: "Notes", groups: ["note"] },
];

export function RecordsPanel({ records, source }: { records: Rec[]; source: string }) {
  const [tab, setTab] = useState<Tab>("all");
  const tagged = records.map((r) => ({ r, g: recordGroup(r.key, recordMeta(r.type, r.key)) }));
  const visible = tab === "all" ? tagged : tagged.filter((x) => x.g === tab);

  return (
    <div className="recpanel">
      <div className="rechead">
        <p className="recsrc">
          {records.length} record{records.length === 1 ? "" : "s"} · served by {source}
        </p>
        <div className="rectabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
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
