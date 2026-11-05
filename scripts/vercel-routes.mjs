// After `vite build` on Vercel: add edge rewrites to .vercel/output/config.json so donotdie.live
// can be served by this project alone. They sit after the filesystem check (this app's /_gate/*
// files win) and before the catch-all that sends / to this app's server function.
//   /sea, /sea/*  → market-seas (No Man's Sea)
//   anything else except / and /_gate/* → the land server on the droplet
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const file = ".vercel/output/config.json";
if (!existsSync(file)) {
  console.log("[vercel-routes] no Vercel output, nothing to do");
  process.exit(0);
}
const LAND = (process.env.LAND_ORIGIN || "https://168-144-255-97.sslip.io").replace(/\/+$/, "");
const SEA = (process.env.SEA_ORIGIN || "https://market-seas.vercel.app").replace(/\/+$/, "");

const cfg = JSON.parse(readFileSync(file, "utf8"));
const routes = cfg.routes || [];
const fs = routes.findIndex((r) => r.handle === "filesystem");
if (fs < 0) throw new Error("[vercel-routes] no filesystem handle in config.json");
const ours = [
  { src: "^/sea(/.*)?$", dest: `${SEA}/sea$1` },
  { src: "^/(?!_gate/)(.+)$", dest: `${LAND}/$1` },
];
const kept = routes.filter((r) => !ours.some((o) => o.src === r.src));
kept.splice(kept.findIndex((r) => r.handle === "filesystem") + 1, 0, ...ours);
cfg.routes = kept;
writeFileSync(file, JSON.stringify(cfg, null, 2));
console.log("[vercel-routes] land →", LAND, "· sea →", SEA);
