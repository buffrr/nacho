import type { NextRequest } from "next/server";
import { peek, displayRecords, isSovereign, normalizeHandle } from "@/lib/peek";

// Client-side lookup endpoint for the landing page's inline resolver. Proxies the
// relay peek (server-side, so no CORS) and returns a compact shape.
export const revalidate = 60;

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const handle = normalizeHandle(q);
  if (!handle) {
    return Response.json({ error: "invalid" }, { status: 400 });
  }
  const zone = await peek(handle);
  if (!zone) {
    return Response.json({ handle, found: false });
  }
  return Response.json({
    handle,
    found: true,
    sovereign: isSovereign(zone),
    records: displayRecords(zone).map((r) => ({
      type: r.type,
      key: r.key,
      value: r.value,
    })),
  });
}
