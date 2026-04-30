import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: ["{app,lib}/**/*.test.ts"],
    // Placeholders so modules that read env at import time (or under their
    // first call) can load under vitest. SERVICE_ROLE_KEY is read lazily by
    // getServiceClient() — a test that exercises a Supabase-touching helper
    // would otherwise throw on the first call. Tests must NOT make real
    // Supabase calls with these fake values; mock the client instead.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    },
  },
});
