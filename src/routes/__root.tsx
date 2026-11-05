import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";

import appCss from "../styles.css?url";
import { GATE_MEDIA } from "../lib/gateway-paths";

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4 text-center">
      <div>
        <h1 className="font-display text-7xl text-sea-text">404</h1>
        <p className="mt-2 text-sea-muted">This page doesn't exist.</p>
        <a href="/" className="mt-6 inline-block rounded-md bg-sea px-4 py-2 font-semibold text-sea-ground">Go home</a>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#07090C" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@700&family=Big+Shoulders+Display:wght@800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap" },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: GATE_MEDIA.favicon, type: "image/svg+xml" },
    ],
  }),
  shellComponent: RootShell,
  component: Outlet,
  notFoundComponent: NotFound,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
