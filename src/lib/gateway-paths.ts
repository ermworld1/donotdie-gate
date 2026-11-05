// The Caddy gateway owns only / and /_gate/*; theater links leave this router.
export const GATE_ASSETS_DIR = "_gate";
export const GATE_SERVER_FN_BASE = "/_gate/_serverFn";
export const SEA_URL = "https://donotdie.live/sea";
export const LAND_URL = "https://donotdie.live/land";
export const GATE_MEDIA = {
  hero: "/_gate/media/hero-loop.mp4",
  poster: "/_gate/media/poster.jpg",
  trailer: "/_gate/media/trailer.mp4",
  music: "/_gate/media/battle-loop.m4a",
  mark: "/_gate/media/donotdie-mark.svg",
  favicon: "/_gate/favicon.svg",
} as const;

export function isGatewayRequest(pathname: string): boolean {
  return pathname === "/" || pathname.startsWith("/_gate/");
}
