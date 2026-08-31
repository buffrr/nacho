const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // This app lives in a subdir of the RN repo (which has its own lockfile), so
  // pin file-tracing to website/ — otherwise Next infers the repo root.
  outputFileTracingRoot: path.join(__dirname),
};

module.exports = nextConfig;
