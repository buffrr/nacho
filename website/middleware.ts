import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Pre-registration claim links: /claim?id=<preCode> hands off to atbitcoin's
// event redemption flow at /tabconf/<preCode>. Done in middleware (not a
// next.config redirect) so the original ?id= query isn't carried onto the
// destination URL. Temporary (307) — the target is event-scoped and may change.
export function middleware(req: NextRequest) {
  const preCode = req.nextUrl.searchParams.get("id")?.trim();
  if (preCode) {
    return NextResponse.redirect(
      `https://atbitcoin.com/tabconf/${encodeURIComponent(preCode)}`,
      307,
    );
  }
  // No id → fall through (nothing to claim).
  return NextResponse.next();
}

export const config = {
  matcher: "/claim",
};
