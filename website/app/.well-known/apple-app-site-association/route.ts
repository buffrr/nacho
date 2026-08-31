// Apple App Site Association — enables universal links so nacho.io/<handle>
// (any path containing "@") opens the nacho app when installed, and falls back
// to this website otherwise. Served with `application/json` and no extension,
// exactly as Apple requires. Non-@ paths (/, /about, …) are NOT claimed, so
// they always load on the web.
//
// TEAMID.bundleId — Team 4MA7A64R76, bundle com.impervious.nacho.
export const dynamic = "force-static";

const AASA = {
  applinks: {
    details: [
      {
        appIDs: ["4MA7A64R76.com.impervious.nacho"],
        components: [
          { "/": "/*@*", comment: "handle slugs (contain @) open in-app" },
        ],
      },
    ],
  },
};

export function GET() {
  return new Response(JSON.stringify(AASA), {
    headers: {
      "content-type": "application/json",
      "cache-control": "public, max-age=3600",
    },
  });
}
