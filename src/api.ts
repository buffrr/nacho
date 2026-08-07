import { Cert, CertData, isCert, isCertData } from "@/cert";
import { activeApiUrl } from "@/config";

// The API base comes from the user-editable network config (mainnet or dev set),
// read at call time so a dev-mode toggle / edited URL takes effect immediately.
// Callers run after startup (which loads the config), so it's populated.

export async function fetchProposedHandles(query: string): Promise<string[]> {
  try {
    const response = await fetch(`${activeApiUrl()}/proposed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(`HTTP status: ${response.status}`);
    }

    const data = await response.json();
    return data.available_subspaces || [];
  } catch (error) {
    console.error("Failed to fetch proposed handlers:", error);
    return [];
  }
}

export type HandleStatus = (
  | {
      handle: string;
      status: "available" | "unknown" | "invalid" | "preallocated";
      product_id?: string;
    }
  | {
      handle: string;
      status: "reserved" | "processing_payment";
      script_pubkey: string;
    }
  | {
      handle: string;
      status: "taken";
    }
  | {
      handle: string;
      status: "taken";
      script_pubkey: string;
    }
  | {
      handle: string;
      status: "taken";
      script_pubkey: string;
      certificate: Cert;
    }
) & { price?: number };

export function isHandleStatus(obj: unknown): obj is HandleStatus {
  if (!obj || typeof obj !== "object") {
    return false;
  }
  const h = obj as Record<string, unknown>;
  if (typeof h.handle !== "string") {
    return false;
  }
  if (
    h.status !== "available" &&
    h.status !== "unknown" &&
    h.status !== "invalid" &&
    h.status !== "preallocated" &&
    h.status !== "reserved" &&
    h.status !== "processing_payment" &&
    h.status !== "taken"
  ) {
    return false;
  }
  if (h.status === "reserved" || h.status === "processing_payment") {
    return typeof h.script_pubkey === "string";
  }
  if (h.status === "taken") {
    if (h.certificate !== undefined) {
      return typeof h.script_pubkey === "string" && isCert(h.certificate);
    }
    return h.script_pubkey === undefined || typeof h.script_pubkey === "string";
  }
  return true;
}

export async function fetchHandlesStatuses(
  handles: string[],
): Promise<HandleStatus[]> {
  try {
    const response = await fetch(`${activeApiUrl()}/spaces/status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ handles }),
    });
    if (!response.ok) {
      throw new Error(`HTTP status: ${response.status}`);
    }
    const statuses = await response.json();
    if (!Array.isArray(statuses)) {
      throw new Error("Invalid API response");
    }
    for (const status of statuses) {
      if (!isHandleStatus(status)) {
        throw new Error("Invalid API response");
      }
    }
    return statuses;
  } catch (error) {
    console.error("Failed to fetch handlers status:", error);
    return [];
  }
}

export async function fetchHandleStatus(
  handle: string,
): Promise<HandleStatus> {
  const status = (await fetchHandlesStatuses([handle]))[0];
  if (status !== undefined) {
    return status;
  }
  return { handle, status: "unknown" };
}

// A single result from the /search endpoint: one candidate handle (the name
// expanded across each top-level space the operator offers) with its status.
// `available` matches carry price (cents) + product_id; `invalid` (too short /
// bad chars) carry neither.
export type SearchMatch = {
  handle: string;
  status: HandleStatus["status"];
  price?: number;
  product_id?: string;
};

// GET /api/search?q=<name|name@space> → matches across the operator's spaces in
// one call (replaces the old proposed-handles + per-handle status two-step for
// the Shop). Returns [] on empty query / error / non-2xx (e.g. 400 "q required").
export async function searchHandles(query: string): Promise<SearchMatch[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const response = await fetch(
      `${activeApiUrl()}/search?q=${encodeURIComponent(q)}`,
    );
    if (!response.ok) return [];
    const data = await response.json();
    const matches = (data as { matches?: unknown })?.matches;
    if (!Array.isArray(matches)) return [];
    return matches.filter(
      (m): m is SearchMatch =>
        !!m &&
        typeof (m as SearchMatch).handle === "string" &&
        typeof (m as SearchMatch).status === "string",
    );
  } catch (error) {
    console.error("Failed to search handles:", error);
    return [];
  }
}

export type PurchaseSupport = "supported" | "unsupported" | "unknown";

// Whether a handle can be bought directly through the atbitcoin purchase rail.
// The operator only returns a concrete status (available/taken/...) for spaces it
// actually handles; "unknown"/"invalid" mean it doesn't recognize the space, so
// those take the create-request path. A missing status means we couldn't reach
// the server.
//
// NOTE: this is a heuristic over the current API. If the server later exposes an
// explicit capability signal, this is the single place to change.
export function purchaseSupportFromStatus(
  status: HandleStatus["status"] | null,
): PurchaseSupport {
  switch (status) {
    case "available":
    case "taken":
    case "reserved":
    case "processing_payment":
    case "preallocated":
      return "supported";
    case "invalid":
    case "unknown":
      return "unsupported";
    default:
      return "unknown";
  }
}

export type PurchaseInfo = {
  support: PurchaseSupport;
  price?: number;
};

export async function checkPurchaseInfo(
  handle: string,
): Promise<PurchaseInfo> {
  try {
    const response = await fetch(`${activeApiUrl()}/spaces/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handles: [handle] }),
    });
    // The operator returns 400 when it doesn't support the space/extension.
    if (response.status === 400) {
      return { support: "unsupported" };
    }
    if (!response.ok) {
      return { support: "unknown" };
    }
    const data = await response.json();
    const raw = Array.isArray(data) ? data[0] : undefined;
    const status = isHandleStatus(raw) ? raw.status : null;
    const price =
      raw && typeof raw.price === "number" ? (raw.price as number) : undefined;
    return { support: purchaseSupportFromStatus(status), price };
  } catch (error) {
    console.error("Failed to check purchase info:", error);
    return { support: "unknown" };
  }
}

// Prices are returned in USD cents.
export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export async function reserveHandle(
  handle: string,
  script_pubkey: string,
): Promise<
  | {
      deadline: number;
      handle_status: HandleStatus;
      product_id: string;
    }
  | { error: string }
> {
  try {
    const response = await fetch(`${activeApiUrl()}/reserve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        handle,
        script_pubkey,
        payment_type: "iap",
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return { error: text.trim() };
    }

    const data = await response.json();
    if (
      typeof data.deadline !== "number" ||
      !isHandleStatus(data.handle_status) ||
      typeof data.product_id !== "string"
    ) {
      throw new Error("Invalid API response");
    }
    return data;
  } catch (error) {
    console.error("Failed to reserve handle:", error);
    return { error: "Network error" };
  }
}

export async function claimHandleIAP(
  handle: string,
  script_pubkey: string,
  purchase_token: string,
  payment_method: "google_iap" | "apple_iap" | "test",
): Promise<{
  handle_status: HandleStatus;
  error?: string;
}> {
  try {
    const response = await fetch(`${activeApiUrl()}/claim`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        handle,
        script_pubkey,
        purchase_token,
        payment_method,
      }),
    });

    const data = await response.json();
    if (
      !isHandleStatus(data.handle_status) ||
      (data.error !== undefined && typeof data.error !== "string")
    ) {
      throw new Error("Invalid API response");
    }

    return data;
  } catch (error) {
    console.error("Failed to claim handle:", error);
    return {
      handle_status: { handle, status: "unknown" },
      error: "Network error",
    };
  }
}

export type ClaimCodeResult =
  | { ok: true; handle: string; status: string }
  | { ok: false; error: string; httpStatus: number };

// Web-purchase redemption: bind our key to a handle the buyer already paid for
// on the web, using a claim code (URL token or short code). Returns the handle
// the code was issued for.
export async function claimCode(
  code: string,
  script_pubkey: string,
): Promise<ClaimCodeResult> {
  try {
    const response = await fetch(`${activeApiUrl()}/claim-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, script_pubkey }),
    });
    const data = await response.json().catch(() => ({}) as any);
    if (response.ok && typeof data.handle === "string") {
      return {
        ok: true,
        handle: data.handle,
        status: typeof data.status === "string" ? data.status : "taken",
      };
    }
    return {
      ok: false,
      error: typeof data.error === "string" ? data.error : "Failed to redeem code",
      httpStatus: response.status,
    };
  } catch (error) {
    console.error("Failed to redeem claim code:", error);
    return { ok: false, error: "Network error", httpStatus: 0 };
  }
}
