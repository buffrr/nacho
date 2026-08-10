// BIP-177 ₿-only amount formatting + request-validity helpers. No "sats"/"BTC"
// in the UI; integers only, locale-grouped. See design-notes.md §7.

function groupDigits(n: number): string {
  try {
    return new Intl.NumberFormat().format(n);
  } catch {
    // Hermes without full Intl — fall back to plain thousands grouping.
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
}

// `₿500,000`. Base units only — never decimals, never "sats"/"BTC".
export function formatBtc(baseUnits: number): string {
  return `₿${groupDigits(baseUnits)}`;
}

// Human remaining validity from a unix-seconds expiry: "in 4m 12s" / "in 2h 3m".
export function remainingValidity(exp: number, nowMs = Date.now()): string {
  const s = Math.floor(exp - nowMs / 1000);
  if (s <= 0) return "expired";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `in ${h}h ${m}m`;
  if (m > 0) return `in ${m}m ${sec}s`;
  return `in ${sec}s`;
}
