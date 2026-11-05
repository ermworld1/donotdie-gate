// donotdie.live is served by this Vercel project. It owns only / and /_gate/*.
// Everything else goes to the other two apps (see scripts/vercel-routes.mjs):
//   /sea/*      → No Man's Sea (Vercel project market-seas)
//   all else    → the land server on the droplet (map, /hype, /api/*, /_lg/*, bots)
export const LAND_ORIGIN = (process.env.LAND_ORIGIN || "https://origin.donotdie.live").replace(/\/+$/, "");

// Request headers worth passing to the land server when this app forwards a request.
const PASS = ["accept", "accept-language", "user-agent", "referer", "x-forwarded-for", "x-real-ip"];
// Response headers that no longer match after fetch() has decoded the body.
const DROP = ["content-encoding", "content-length", "transfer-encoding", "connection"];

// A bare "/" is the gateway. "/" with any query (?ref=, ?play, ?embed=1, ?cinema=1, ?overlay=1 …)
// has always opened the land map, so those go to the land server with the query intact.
export function landBound(url: URL): boolean {
  return url.pathname === "/" && url.search.length > 1;
}

export async function forwardToLand(request: Request, url: URL): Promise<Response> {
  const headers = new Headers();
  for (const k of PASS) {
    const v = request.headers.get(k);
    if (v) headers.set(k, v);
  }
  headers.set("x-forwarded-host", url.host);
  headers.set("x-forwarded-proto", "https");
  const r = await fetch(LAND_ORIGIN + url.pathname + url.search, {
    method: request.method,
    headers,
    redirect: "manual",
  });
  const out = new Headers(r.headers);
  for (const k of DROP) out.delete(k);
  return new Response(r.body, { status: r.status, statusText: r.statusText, headers: out });
}
