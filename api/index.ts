// Vercel serverless entry for the Genetiq API.
// Vercel rewrites /api/* to this function (see vercel.json). The Fastify app
// is built once per warm instance; web assets are served by Vercel's static
// output, so this function does not serve the SPA.
import type { IncomingMessage, ServerResponse } from "node:http";
import { buildApp } from "../apps/api/dist/app.js";

let ready: Promise<Awaited<ReturnType<typeof buildApp>>> | null = null;

function getApp(): Promise<Awaited<ReturnType<typeof buildApp>>> {
  if (!ready) ready = buildApp({ serveWeb: false, logger: false }).then(async (app) => {
    await app.ready();
    return app;
  });
  return ready;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const app = await getApp();
  app.server.emit("request", req, res);
}
