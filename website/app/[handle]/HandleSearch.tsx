"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function HandleSearch() {
  const [value, setValue] = useState("");
  const router = useRouter();

  function go(e: React.FormEvent) {
    e.preventDefault();
    const handle = value.trim().toLowerCase();
    if (handle) router.push(`/${handle}`);
  }

  return (
    <form className="psearch" role="search" autoComplete="off" onSubmit={go}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <input
        type="search"
        placeholder="Look up a handle"
        spellCheck={false}
        autoCapitalize="none"
        autoCorrect="off"
        aria-label="Look up a handle"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    </form>
  );
}
