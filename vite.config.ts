// @lovable.dev/vite-tanstack-config already includes the required
// TanStack, React, Tailwind, path alias, and Nitro/Vite plugins.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts
    // (our SSR error wrapper).
    server: { entry: "server" },
  },

  // Deploy TanStack Start as a Vercel serverless application.
  nitro: {
    preset: "vercel",
  },
});