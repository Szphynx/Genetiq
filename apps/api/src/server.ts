import { buildApp } from "./app.js";

// Standalone server. On a single host (Docker/Render/Fly/VPS) it also serves
// the built web SPA when GENETIQ_SERVE_WEB is set (or a web dist is present).
const serveWeb = process.env.GENETIQ_SERVE_WEB !== "false";
const port = Number(process.env.PORT ?? 8787);

const app = await buildApp({ serveWeb });

try {
  await app.listen({ port, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
