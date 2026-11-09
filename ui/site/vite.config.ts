import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

export default defineConfig({
  // GitHub Pages serves a project site under a path of its own; the deploy
  // workflow passes that path in, and a build without it answers on `/`.
  base: process.env.SITE_BASE_PATH ?? "/",
  build: { assetsInlineLimit: 0 },
  plugins: [react()],
});
