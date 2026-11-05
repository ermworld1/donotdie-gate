import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";
import { GATE_ASSETS_DIR, GATE_SERVER_FN_BASE } from "./src/lib/gateway-paths";

// Built assets live under /_gate/* so Caddy can route / and /_gate/* to this app
// while every other path on donotdie.live stays with the Land and Sea apps.
export default defineConfig({
  build: { assetsDir: GATE_ASSETS_DIR },
  plugins: [
    tsConfigPaths(),
    tailwindcss(),
    tanstackStart({ serverFns: { base: GATE_SERVER_FN_BASE } }),
    nitro({ preset: process.env.NITRO_PRESET ?? (process.env.VERCEL ? "vercel" : "node-server") }),
    viteReact(),
  ],
});
