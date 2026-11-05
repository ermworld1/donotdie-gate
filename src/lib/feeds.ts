// Client-only live feed store for Binance + Hyperliquid. No mock data.
import {
  bucketize, findWalls, isPulled, isThin, liqSide, fmtUsd, fmtPx, topLevels, shouldPatrol, shouldFallbackPatrol, median,
  CANNON_USD, WHALE_USD, TANK_USD, FEED_STALE_MS, FLOW_WINDOW_MS, FLOW_HISTORY, type Level, type Side,
} from "./battle-logic";

export type BattleEvent =
  | { kind: "liq"; px: number; usd: number; side: "long" | "short" }
  | { kind: "cannon"; px: number; usd: number }
  | { kind: "trade"; px: number; usd: number; buy: boolean }
  | { kind: "patrol"; usd: number; window: "10s" | "60s" };

export type TapeItem = { id: number; venue: "SEA" | "LAND"; text: string; tone: "danger" | "neutral" | "up" };
export type Ghost = { px: number; sz: number; side: Side; t: number };
export type Unit = { px: number; sz: number; side: Side; wall?: boolean };

type VenueStatus = { open: boolean; lastMsg: number; everConnected: boolean };

/** Visible half-span of the shared price axis, in USD (renderer uses the same). */
export const VIEW_SPAN = 400;

export const store = {
  bn: {
    status: { open: false, lastMsg: 0, everConnected: false } as VenueStatus,
    mark: null as number | null,
    bids: [] as Level[], asks: [] as Level[],
    walls: [] as { px: number; sz: number; side: Side }[],
    ships: [] as Unit[],
    ghosts: [] as Ghost[],
    liqLong: 0, liqShort: 0, liqCount: 0, ghostsPulled: 0,
    lastLiq: null as { t: number; usd: number; px: number; side: "long" | "short" } | null,
  },
  hl: {
    status: { open: false, lastMsg: 0, everConnected: false } as VenueStatus,
    mark: null as number | null,
    mid: null as number | null,
    bids: [] as Level[], asks: [] as Level[],
    tanks: [] as Unit[],
    funding: null as number | null, oi: null as number | null,
    whaleCount: 0, whaleNotional: 0,
    biggestWhale: null as { usd: number; px: number; buy: boolean } | null,
    lastWhale: null as { t: number; usd: number } | null,
  },
  tape: [] as TapeItem[],
  alert: null as { text: string; t: number } | null,
};

type Listener = (venue: "sea" | "land", e: BattleEvent) => void;
const listeners = new Set<Listener>();
export function onBattle(fn: Listener) { listeners.add(fn); return () => { listeners.delete(fn); }; }
const emit = (v: "sea" | "land", e: BattleEvent) => { if (!document.hidden) listeners.forEach((l) => l(v, e)); };

let tapeId = 0;
function tape(venue: TapeItem["venue"], text: string, tone: TapeItem["tone"] = "neutral") {
  if (store.tape.slice(0, 6).some((t) => t.text === text)) return; // flickering levels: no spam
  store.tape.unshift({ id: ++tapeId, venue, text, tone });
  if (store.tape.length > 30) store.tape.length = 30;
}

export function isStale(s: VenueStatus) { return !s.everConnected || Date.now() - s.lastMsg > FEED_STALE_MS; }

function socket(url: string, onOpen: (ws: WebSocket) => void, onMsg: (d: any) => void, status: VenueStatus) {
  let attempt = 0; let ws: WebSocket | null = null; let closed = false; let timer: any;
  const connect = () => {
    ws = new WebSocket(url);
    ws.onopen = () => { attempt = 0; status.open = true; status.everConnected = true; onOpen(ws!); };
    ws.onmessage = (m) => { status.lastMsg = Date.now(); try { onMsg(JSON.parse(m.data)); } catch { /* ignore */ } };
    ws.onclose = () => {
      status.open = false;
      if (closed) return;
      const delay = Math.min(30_000, 1000 * 2 ** attempt++) * (0.7 + Math.random() * 0.6);
      timer = setTimeout(connect, delay);
    };
    ws.onerror = () => ws?.close();
  };
  connect();
  return { send: (o: unknown) => ws?.readyState === 1 && ws.send(JSON.stringify(o)), stop: () => { closed = true; clearTimeout(timer); ws?.close(); } };
}

// ---------- flow (ambient air) ----------
const flow = { sea: 0, land: 0 };
const flowHist = { sea: [] as number[], land: [] as number[] };
const lastPatrol = { sea: 0, land: 0 };
function tickFlow() {
  const now = Date.now();
  for (const v of ["sea", "land"] as const) {
    const f = flow[v]; flow[v] = 0;
    const st = v === "sea" ? store.bn.status : store.hl.status;
    if (isStale(st)) continue;
    if (!lastPatrol[v]) lastPatrol[v] = now; // grace period after load
    if (shouldPatrol(f, flowHist[v])) { emit(v, { kind: "patrol", usd: f, window: "10s" }); lastPatrol[v] = now; }
    flowHist[v].push(f); if (flowHist[v].length > FLOW_HISTORY) flowHist[v].shift();
    const f60 = flowHist[v].slice(-6).reduce((a, b) => a + b, 0);
    if (shouldFallbackPatrol(now, lastPatrol[v], f60)) { emit(v, { kind: "patrol", usd: f60, window: "60s" }); lastPatrol[v] = now; }
  }
}
export const flowMedian = (v: "sea" | "land") => median(flowHist[v]);

// ---------- Binance ----------
const raw = { bids: new Map<number, number>(), asks: new Map<number, number>() };
let prevTracked = new Map<string, Unit>();

function rebuildBinance() {
  const toLv = (m: Map<number, number>) => [...m.entries()].map(([px, sz]) => ({ px, sz }));
  store.bn.bids = bucketize(toLv(raw.bids), "bid");
  store.bn.asks = bucketize(toLv(raw.asks), "ask");
  const mark = store.bn.mark; if (!mark) return;
  const wallKeys = new Set(store.bn.walls.map((w) => `${w.side}${w.px}`));
  store.bn.ships = [
    ...topLevels(store.bn.bids, mark, VIEW_SPAN).map((l) => ({ ...l, side: "bid" as const })),
    ...topLevels(store.bn.asks, mark, VIEW_SPAN).map((l) => ({ ...l, side: "ask" as const })),
  ].map((u) => ({ ...u, wall: wallKeys.has(`${u.side}${u.px}`) }));
}

/** Runs on each full-book snapshot: walls (>3x median) + top-3 ships are tracked for ghosts. */
function detectWalls() {
  const bn = store.bn; const mark = bn.mark; if (!mark) return;
  const walls = findWalls(bn.bids, bn.asks);
  bn.walls = walls; rebuildBinance();
  const tracked = new Map<string, Unit>();
  for (const w of walls) tracked.set(`${w.side}${w.px}`, { ...w, wall: true });
  for (const s of bn.ships) tracked.set(`${s.side}${s.px}`, s);
  const lo = bn.bids.at(-1)?.px ?? mark, hi = bn.asks.at(-1)?.px ?? mark;
  const sizeAt = (side: Side, px: number) => (side === "bid" ? bn.bids : bn.asks).find((l) => l.px === px)?.sz ?? 0;
  for (const [k, w] of prevTracked) {
    if (tracked.has(k)) continue;
    if (!isPulled(w, mark, sizeAt(w.side, w.px), w.sz, { lo, hi })) continue;
    bn.ghosts.push({ px: w.px, sz: w.sz, side: w.side, t: performance.now() }); bn.ghostsPulled++;
    tape("SEA", `${w.side === "bid" ? "Bid" : "Ask"} ${w.wall ? "wall" : "level"} ${fmtPx(w.px)} pulled · ${w.sz.toFixed(0)} BTC`, "danger");
    const hlSame = w.side === "bid" ? store.hl.bids : store.hl.asks;
    const hlOpp = w.side === "bid" ? store.hl.asks : store.hl.bids;
    if (w.wall && Math.abs(w.px - mark) / mark <= 0.005 && store.hl.mark && isThin(hlSame, hlOpp, store.hl.mark)) {
      store.alert = { t: Date.now(), text: `Binance ${w.side} wall ${fmtPx(w.px)} pulled (${w.sz.toFixed(0)} BTC) · Hyperliquid ${w.side}s thin ${w.side === "bid" ? "below" : "above"}` };
    }
  }
  for (const w of walls) if (!prevTracked.get(`${w.side}${w.px}`)?.wall) tape("SEA", `${w.side === "bid" ? "Bid" : "Ask"} wall up ${fmtPx(w.px)} · ${w.sz.toFixed(0)} BTC`);
  prevTracked = tracked;
  bn.ghosts = bn.ghosts.filter((g) => performance.now() - g.t < 20_000);
}

async function pollBinanceDepth() {
  try {
    const r = await fetch("https://fapi.binance.com/fapi/v1/depth?symbol=BTCUSDT&limit=1000");
    if (!r.ok) return;
    const j = await r.json();
    raw.bids = new Map(j.bids.map(([p, q]: [string, string]) => [+p, +q]));
    raw.asks = new Map(j.asks.map(([p, q]: [string, string]) => [+p, +q]));
    rebuildBinance(); detectWalls();
  } catch { /* keep last frame */ }
}

function applyDepth20(b: [string, string][], a: [string, string][]) {
  const patch = (m: Map<number, number>, lv: [string, string][], side: Side) => {
    if (!lv.length) return;
    const ps = lv.map((l) => +l[0]); const lo = Math.min(...ps), hi = Math.max(...ps);
    for (const k of [...m.keys()]) if (k >= lo && k <= hi) m.delete(k);
    for (const [p, q] of lv) if (+q > 0) m.set(+p, +q);
    const best = side === "bid" ? hi : lo;
    for (const k of [...m.keys()]) if (side === "bid" ? k > best : k < best) m.delete(k);
  };
  patch(raw.bids, b, "bid"); patch(raw.asks, a, "ask");
  rebuildBinance();
}

function onBinance(msg: any) {
  const d = msg.data; if (!d) return; const s: string = String(msg.stream).toLowerCase();
  if (s.endsWith("markprice@1s")) store.bn.mark = +d.p;
  else if (s.includes("depth20")) applyDepth20(d.b, d.a);
  else if (s.endsWith("forceorder")) {
    const o = d.o; const px = +(o.ap || o.p); const usd = px * +(o.z || o.q); const side = liqSide(o.S);
    if (side === "long") store.bn.liqLong += usd; else store.bn.liqShort += usd;
    store.bn.liqCount++; store.bn.lastLiq = { t: Date.now(), usd, px, side };
    tape("SEA", `${side.toUpperCase()} liquidated ${fmtUsd(usd)} @ ${fmtPx(px)}`, "danger");
    emit("sea", { kind: "liq", px, usd, side });
  } else if (s.endsWith("aggtrade")) {
    const usd = +d.p * +d.q; flow.sea += usd;
    if (usd >= CANNON_USD) emit("sea", { kind: "cannon", px: +d.p, usd });
  }
}

// ---------- Hyperliquid ----------
let skipTradeSnapshot = true;
function onHyper(msg: any) {
  const hl = store.hl;
  if (msg.channel === "l2Book") {
    const [b, a] = msg.data.levels as [{ px: string; sz: string }[]?, { px: string; sz: string }[]?];
    if (!b || !a) return;
    hl.bids = bucketize(b.map((l) => ({ px: +l.px, sz: +l.sz })), "bid");
    hl.asks = bucketize(a.map((l) => ({ px: +l.px, sz: +l.sz })), "ask");
    if (b[0] && a[0]) { hl.mid = (+b[0].px + +a[0].px) / 2; hl.mark ??= hl.mid; }
    const m = store.bn.mark ?? hl.mark;
    if (m) hl.tanks = [
      ...topLevels(hl.bids, m, VIEW_SPAN).map((l) => ({ ...l, side: "bid" as const })),
      ...topLevels(hl.asks, m, VIEW_SPAN).map((l) => ({ ...l, side: "ask" as const })),
    ];
  } else if (msg.channel === "activeAssetCtx") {
    const c = msg.data.ctx; hl.funding = +c.funding; hl.mark = +c.markPx; hl.oi = +c.openInterest * +c.markPx;
  } else if (msg.channel === "trades") {
    // First trades message after (re)subscribing is a historical snapshot: not session data.
    if (skipTradeSnapshot) { skipTradeSnapshot = false; return; }
    for (const t of msg.data as { px: string; sz: string; side: string }[]) {
      const px = +t.px, usd = px * +t.sz, buy = t.side === "B";
      flow.land += usd;
      if (usd >= TANK_USD) emit("land", { kind: "trade", px, usd, buy });
      if (usd >= WHALE_USD) {
        hl.whaleCount++; hl.whaleNotional += usd; hl.lastWhale = { t: Date.now(), usd };
        if (!hl.biggestWhale || usd > hl.biggestWhale.usd) hl.biggestWhale = { usd, px, buy };
        tape("LAND", `Whale ${buy ? "buy" : "sell"} ${fmtUsd(usd)} @ ${fmtPx(px)}`, buy ? "up" : "danger");
      }
    }
  }
}

let started = 0; let stops: (() => void)[] = [];
export function startFeeds() {
  if (started++) return () => {};
  // Binance splits futures streams by route: depth on /public, trades/liqs/mark on /market.
  const bn = socket(
    "wss://fstream.binance.com/market/stream?streams=btcusdt@forceOrder/btcusdt@aggTrade/btcusdt@markPrice@1s",
    () => {}, onBinance, store.bn.status,
  );
  const bnDepth = socket(
    "wss://fstream.binance.com/public/stream?streams=btcusdt@depth20@500ms",
    () => {}, onBinance, { open: false, lastMsg: 0, everConnected: false },
  );
  const hl = socket("wss://api.hyperliquid.xyz/ws", (ws) => {
    skipTradeSnapshot = true;
    for (const sub of [{ type: "l2Book", coin: "BTC", nSigFigs: 4 }, { type: "trades", coin: "BTC" }, { type: "activeAssetCtx", coin: "BTC" }])
      ws.send(JSON.stringify({ method: "subscribe", subscription: sub }));
  }, onHyper, store.hl.status);
  pollBinanceDepth();
  const poll = setInterval(() => { if (!document.hidden) pollBinanceDepth(); }, 3000);
  const ping = setInterval(() => hl.send({ method: "ping" }), 30_000);
  const fl = setInterval(tickFlow, FLOW_WINDOW_MS);
  stops = [bn.stop, bnDepth.stop, hl.stop, () => clearInterval(poll), () => clearInterval(ping), () => clearInterval(fl)];
  return () => { if (--started === 0) stops.forEach((f) => f()); };
}
