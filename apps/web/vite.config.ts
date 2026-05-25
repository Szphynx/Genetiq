import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Resolve the workspace core from source so the web build never depends
      // on workspace symlinks or core's prebuilt dist (robust on Vercel).
      "@genetiq/core": fileURLToPath(new URL("../../packages/core/src/index.ts", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.GENETIQ_API ?? "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
});
