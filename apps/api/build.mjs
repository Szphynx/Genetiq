import { build } from "esbuild";
import { fileURLToPath } from "node:url";

// Bundle @genetiq/core from source so the API build/runtime never depends on
// workspace symlinks or core's dist (which is what breaks on Vercel). Other
// deps (fastify, etc.) stay external and load from node_modules at runtime.
const coreSrc = fileURLToPath(new URL("../../packages/core/src/index.ts", import.meta.url));

await build({
  entryPoints: ["src/server.ts", "src/app.ts"],
  outdir: "dist",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  packages: "external",
  alias: { "@genetiq/core": coreSrc },
  logLevel: "info",
});
