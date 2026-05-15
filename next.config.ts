import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // apify-client v9 uses `dynamicNodeImport(specifier)` which compiles to
  // `require(<runtime-string>)` — Turbopack/Webpack can't statically analyze
  // that and throws "Cannot find module as expression is too dynamic" at
  // runtime, killing every Instagram ingest run. Externalizing the package
  // makes Next.js resolve it from node_modules at runtime instead of bundling
  // it, sidestepping the analysis entirely.
  serverExternalPackages: ["apify-client"],
};

export default nextConfig;
