const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // This app lives in a subdir of the RN repo (which has its own lockfile), so
  // pin file-tracing to website/ — otherwise Next infers the repo root.
  outputFileTracingRoot: path.join(__dirname),
  // The canonical policy lives at /privacy. Redirect the legacy URL that the Play
  // Console privacy-policy field pointed at so it keeps resolving.
  async redirects() {
    return [
      { source: "/privacy-policy.html", destination: "/privacy", permanent: true },
    ];
  },
};

module.exports = nextConfig;
