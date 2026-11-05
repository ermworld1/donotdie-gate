import { forwardToLand, landBound } from "./lib/land-origin";

type ServerEntry = { fetch: (request: Request, env?: unknown, ctx?: unknown) => Promise<Response> | Response };
let entry: Promise<ServerEntry> | undefined;
const getEntry = () =>
  (entry ??= import("@tanstack/react-start/server-entry").then((m) => (m.default ?? m) as ServerEntry));

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const url = new URL(request.url);
    if (landBound(url) && (request.method === "GET" || request.method === "HEAD")) {
      try {
        return await forwardToLand(request, url);
      } catch (e) {
        console.error("[gate] land forward failed", e);
        return new Response("The battlefield is restarting. Try again in a few seconds.", {
          status: 502,
          headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
        });
      }
    }
    return (await getEntry()).fetch(request, env, ctx);
  },
};
