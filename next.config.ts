import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // apify-client (used by the instagram + apifyWeb ingest connectors) does an
  // internal dynamic require(specifier) — when Next bundles it for the
  // app/api/ingest route the bundler can't resolve it, crashing every
  // Apify-backed source with "Cannot find module as expression is too dynamic".
  // Externalizing leaves it as a runtime require from node_modules, which resolves.
  serverExternalPackages: ["apify-client"],
};

export default nextConfig;