// Pure, testable rules for the gateway battlefield.
export type Level = { px: number; sz: number };
export type Side = "bid" | "ask";

export const BUCKET_USD = 10;
export const WALL_MULTIPLE = 3;
export const WHALE_USD = 250_000; // Land: big tank + labelled whale fill
export const BOMBER_USD = 1_000_000; // Land: bomber run
export const JET_USD = 100_000; // Sea: big rocket + jet flyover
export const CANNON_USD = 50_000; // Sea: cannon flash from nearest ship
export const BIG_CANNON_USD = 250_000;
export const TANK_USD = 50_000; // Land: tank rolls in and fires
export const FLOW_WINDOW_MS = 10_000;
export const FLOW_HISTORY = 30; // 30 x 10s = 5 min rolling window
export const UNITS_PER_SIDE = 3;
export const CROSS_FRONT_PCT = 0.005;
export const FEED_STALE_MS = 10_000;
export const GHOST_FADE_MS = 20_000;

/** Aggregate raw levels into $BUCKET buckets (bids floor, asks ceil). */
export function bucketize(levels: Level[], side: Side, bucket = BUCKET_USD): Level[] {
  const m = new Map<number, number>();
  for (const l of levels) {
    const k = side === "bid" ? Math.floor(l.px / bucket) * bucket : Math.ceil(l.px / bucket) * bucket;
    m.set(k, (m.get(k) ?? 0) + l.sz);
  }
  return [...m.entries()].map(([px, sz]) => ({ px, sz })).sort((a, b) => (side === "bid" ? b.px - a.px : a.px - b.px));
}

export function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** Walls: levels larger than 3x the median level size across both sides. */
export function findWalls(bids: Level[], asks: Level[]): { px: number; sz: number; side: Side }[] {
  const med = median([...bids, ...asks].map((l) => l.sz));
  if (med <= 0) return [];
  return [
    ...bids.filter((l) => l.sz > WALL_MULTIPLE * med).map((l) => ({ ...l, side: "bid" as const })),
    ...asks.filter((l) => l.sz > WALL_MULTIPLE * med).map((l) => ({ ...l, side: "ask" as const })),
  ];
}

/** A wall is "pulled" if it vanished while price never traded through it and it is still inside the visible book range. */
export function isPulled(
  wall: { px: number; side: Side },
  mark: number,
  stillPresentSz: number,
  prevSz: number,
  bookRange: { lo: number; hi: number },
): boolean {
  if (stillPresentSz >= prevSz / WALL_MULTIPLE) return false;
  if (wall.px < bookRange.lo || wall.px > bookRange.hi) return false;
  const filled = wall.side === "bid" ? mark <= wall.px : mark >= wall.px;
  return !filled;
}

/** Binance forceOrder: SELL order = a long was liquidated. */
export function liqSide(orderSide: string): "long" | "short" {
  return orderSide === "SELL" ? "long" : "short";
}

export function depthWithin(levels: Level[], mark: number, pct = CROSS_FRONT_PCT): number {
  return levels.filter((l) => Math.abs(l.px - mark) / mark <= pct).reduce((a, l) => a + l.sz, 0);
}

/** Same-side Hyperliquid book is thin if it holds under 60% of the opposite side within the band. */
export function isThin(same: Level[], opposite: Level[], mark: number): boolean {
  const s = depthWithin(same, mark);
  const o = depthWithin(opposite, mark);
  return o > 0 && s < 0.6 * o;
}

export function fmtUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}
export const fmtPx = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });

/** Biggest N levels (by size) within +-span of mark. */
export function topLevels(levels: Level[], mark: number, span: number, n = UNITS_PER_SIDE): Level[] {
  return levels.filter((l) => Math.abs(l.px - mark) <= span).sort((a, b) => b.sz - a.sz).slice(0, n);
}

/** Ambient patrol: last 10s flow above the rolling 5-min median (needs a few samples first). */
export function shouldPatrol(flow: number, history: number[]): boolean {
  if (history.length < 3 || flow <= 0) return false;
  return flow > median(history);
}

export const PATROL_FALLBACK_MS = 20_000;
/** Fallback patrol: no patrol in the last 20s and the last 60s actually traded. */
export function shouldFallbackPatrol(now: number, lastPatrol: number, flow60: number): boolean {
  return flow60 > 0 && now - lastPatrol >= PATROL_FALLBACK_MS;
}
