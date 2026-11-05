// Canvas renderer for the Sea (Binance) and Land (Hyperliquid) battlefields.
import { store, isStale, VIEW_SPAN, type BattleEvent, type Unit } from "./feeds";
import { JET_USD, BOMBER_USD, BIG_CANNON_USD, WHALE_USD, GHOST_FADE_MS, fmtUsd, type Level } from "./battle-logic";

export const C = {
  base: "#07090C", danger: "#F6465D",
  sea: { gold: "#F0B90B", hi: "#FCD535", ground: "#0B0E11", panel: "#181A20", border: "#2B3139", muted: "#848E9C", text: "#EAECEF" },
  land: { mint: "#97FCE4", teal: "#50D2C1", ground: "#0F1A1F", panel: "#13252C", border: "#1F3A40", muted: "#7FA8A8", text: "#E6F7F4" },
};

// Shared y-axis (y = price). Both canvases step it; guarded once per frame.
export const view = { center: 0, halfSpan: VIEW_SPAN, lastT: 0 };
export function stepView(t: number) {
  if (t === view.lastT) return; const dt = Math.min(0.1, (t - view.lastT) / 1000 || 0); view.lastT = t;
  const target = store.bn.mark ?? store.hl.mark; if (!target) return;
  if (!view.center || Math.abs(target - view.center) > view.halfSpan * 2) view.center = target;
  else view.center += (target - view.center) * (1 - Math.exp(-dt * 3));
}
const yOf = (px: number, h: number) => h / 2 - ((px - view.center) / view.halfSpan) * (h / 2);

type Sprite = { kind: string; t0: number; x: number; y: number; tx: number; ty: number; usd: number; dir: number; big?: boolean; label?: string | undefined; n?: number };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; r: number; smoke?: boolean };

export type Layout = { mode: "full" | "sea" | "land" };
const SPINE = 96;
const CAP = 120;
const U = 1.8; // unit scale
const unitLen = (sz: number, k: number) => U * k * (18 + 16 * Math.log10(1 + sz));
type Box = { x0: number; x1: number; y0: number; y1: number };
const hit = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
/** Push box along dir until it clears every placed box. Returns x shift. */
function dodge(b: Box, placed: Box[], dir: -1 | 1): number {
  let shift = 0;
  for (let guard = 0; guard < 20; guard++) {
    const o = placed.find((p) => hit({ ...b, x0: b.x0 + shift, x1: b.x1 + shift }, p));
    if (!o) break;
    shift = dir < 0 ? o.x0 - b.x1 - 4 : o.x1 - b.x0 + 4;
  }
  return shift;
}
/** Place a unit inside its lane [laneMin, laneMax]: dodge sideways, else stack to the nearest free vertical slot. */
export function placeUnit(b: Box, placed: Box[], dir: -1 | 1, laneMin: number, laneMax: number, h: number): { dx: number; dy: number } {
  const inLane = (x0: number, x1: number) => x0 >= laneMin && x1 <= laneMax;
  const dx = dodge(b, placed, dir);
  if (inLane(b.x0 + dx, b.x1 + dx)) return { dx, dy: 0 };
  // clamp into the lane, then search vertical slots
  let cx = 0; if (b.x0 < laneMin) cx = laneMin - b.x0; if (b.x1 + cx > laneMax) cx = laneMax - b.x1;
  const step = b.y1 - b.y0 + 4;
  for (let n = 1; n <= 10; n++) for (const sgn of [-1, 1]) {
    const dy = sgn * n * step; const c = { x0: b.x0 + cx, x1: b.x1 + cx, y0: b.y0 + dy, y1: b.y1 + dy };
    if (c.y0 < 0 || c.y1 > h) continue;
    const extra = dodge(c, placed, dir);
    if (inLane(c.x0 + extra, c.x1 + extra)) return { dx: cx + extra, dy };
  }
  return { dx: cx, dy: 0 };
}
export type Lanes = { sea?: number | undefined; land?: number | undefined; avoid?: Box[] };

export function createBattle(canvas: HTMLCanvasElement, layout: Layout, reduced: boolean, opts: { air?: HTMLCanvasElement | null; lanes?: Lanes } = {}) {
  const mainCtx = canvas.getContext("2d")!; let ctx = mainCtx;
  const airCtx = opts.air?.getContext("2d") ?? null; const lanes = opts.lanes ?? {};
  const airs: (Sprite & { venue: "sea" | "land" })[] = [];
  const k = layout.mode === "full" ? 1 : 0.45;
  let w = 0, h = 0, dpr = 1, raf = 0, terrain: HTMLCanvasElement | null = null, stopped = false;
  const sea: Sprite[] = [], land: Sprite[] = []; const parts: Particle[] = [];
  let seaMaxLen = 0, landMaxLen = 0, maxSz = 1, maxHl = 1;
  const shipPos = new Map<string, { x: number; y: number; L: number }>();

  const regions = () => {
    if (layout.mode === "full") { const s = w / 2 - SPINE / 2; return { sea: [0, s], spine: [s, s + SPINE], land: [s + SPINE, w] } as const; }
    if (layout.mode === "sea") return { sea: [0, w - 56], spine: [w - 56, w], land: null } as const;
    return { sea: null, spine: [0, 56], land: [56, w] } as const;
  };

  const resize = () => {
    dpr = Math.min(2, window.devicePixelRatio || 1); w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr; terrain = null;
    if (opts.air) { opts.air.width = w * dpr; opts.air.height = h * dpr; }
  };

  // ---------- particles ----------
  const explode = (x: number, y: number, power: number, accent: string) => {
    const n = Math.min(70, 10 + power * 30);
    for (let i = 0; i < n && parts.length < 900; i++) {
      const a = Math.random() * Math.PI * 2, s = (40 + Math.random() * 160) * (0.6 + power * 0.4) * k;
      const c = i % 3 === 0 ? accent : i % 3 === 1 ? C.danger : C.sea.hi;
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: 0.35 + Math.random() * 0.6, color: c, r: (1 + Math.random() * 2.2) * k });
    }
    for (let i = 0; i < 4 + power * 3; i++)
      parts.push({ x: x + (Math.random() - 0.5) * 10, y: y + (Math.random() - 0.5) * 10, vx: (Math.random() - 0.5) * 20, vy: -8 - Math.random() * 14, life: 0, max: 1.4 + Math.random(), color: "rgba(120,120,128,1)", r: (5 + Math.random() * 6) * k * (0.7 + power * 0.3), smoke: true });
    parts.push({ x, y, vx: 0, vy: 0, life: 0, max: 0.22, color: "flash", r: (18 + power * 14) * k });
  };
  const smokeTrail = (x: number, y: number) => {
    if (parts.length < 900) parts.push({ x, y, vx: (Math.random() - 0.5) * 6, vy: -4 - Math.random() * 4, life: 0, max: 0.9, color: "rgba(150,150,160,1)", r: 2.5 * k, smoke: true });
  };

  // ---------- unit positions ----------
  const shipAnchor = (u: Unit, x1: number, t: number) => {
    const barLen = (u.sz / maxSz) * seaMaxLen; const L = unitLen(u.sz, k);
    return { x: x1 - barLen - L / 2 - 6 * k, y: yOf(u.px, h) - 4 * k + Math.sin(t / 700 + u.px) * 1.5 * k, L };
  };
  const nearestShip = (px: number) => {
    let best: Unit | null = null;
    for (const u of store.bn.ships) if (!best || Math.abs(u.px - px) < Math.abs(best.px - px)) best = u;
    return best;
  };

  const onEvent = (venue: "sea" | "land", e: BattleEvent) => {
    if (reduced) return; const r = regions(); const now = performance.now();
    if (venue === "sea" && r.sea && sea.length < CAP) {
      const [x0, x1] = r.sea;
      if (e.kind === "liq") {
        const ty = yOf(e.px, h); const big = e.usd >= JET_USD;
        sea.push({ kind: "rocket", t0: now, x: x0 - 10, y: ty + (Math.random() - 0.5) * 140, tx: x1 - 20 - Math.random() * Math.min(220, (x1 - x0) * 0.45), ty, usd: e.usd, dir: 1, big, label: `${fmtUsd(e.usd)} ${e.side}` });
        if (big) airs.length < 12 && airs.push({ venue: "sea", kind: "jet", t0: now, x: x0 - 60, y: h * (0.12 + Math.random() * 0.25), tx: x1 + 60, ty: 0, usd: e.usd, dir: 1 });
      } else if (e.kind === "cannon") {
        const ship = nearestShip(e.px); if (!ship) return;
        sea.push({ kind: "shell", t0: now, x: 0, y: 0, tx: x1, ty: yOf(e.px, h), usd: e.usd, dir: 1, big: e.usd >= BIG_CANNON_USD, label: `${ship.side}${ship.px}` });
      } else if (e.kind === "patrol") {
        airs.length < 12 && airs.push({ venue: "sea", kind: "patrol", t0: now, x: x0 - 50, y: h * (0.1 + Math.random() * 0.7), tx: x1 + 50, ty: 0, usd: e.usd, dir: 1, label: `${e.window} flow ${fmtUsd(e.usd)}` });
      }
    }
    if (venue === "land" && r.land && land.length < CAP) {
      const [x0, x1] = r.land;
      if (e.kind === "trade") {
        const ty = yOf(e.px, h); const big = e.usd >= WHALE_USD;
        land.push({ kind: "tank", t0: now, x: x1 + 30, y: ty, tx: x0 + 40 + Math.random() * Math.min(280, (x1 - x0) * 0.55), ty, usd: e.usd, dir: e.buy ? -1 : 1, big, label: big ? `${fmtUsd(e.usd)} ${e.buy ? "buy" : "sell"}` : undefined });
        if (e.usd >= BOMBER_USD) airs.length < 12 && airs.push({ venue: "land", kind: "bomber", t0: now, x: x1 + 90, y: ty, tx: x0 - 90, ty, usd: e.usd, dir: -1, n: 0 });
      } else if (e.kind === "patrol") {
        airs.length < 12 && airs.push({ venue: "land", kind: "patrol", t0: now, x: x1 + 50, y: h * (0.1 + Math.random() * 0.7), tx: x0 - 50, ty: 0, usd: e.usd, dir: -1, label: `${e.window} flow ${fmtUsd(e.usd)}` });
      }
    }
  };

  const buildTerrain = (x0: number, x1: number) => {
    const t = document.createElement("canvas"); t.width = w * dpr; t.height = h * dpr; const g = t.getContext("2d")!; g.scale(dpr, dpr);
    g.fillStyle = C.land.ground; g.fillRect(x0, 0, x1 - x0, h);
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(80,210,193,${0.02 + rnd() * 0.04})`; g.beginPath(); g.ellipse(x0 + rnd() * (x1 - x0), rnd() * h, 20 + rnd() * 90, 10 + rnd() * 50, rnd() * 3, 0, 7); g.fill(); }
    for (let i = 0; i < 90; i++) { g.fillStyle = "rgba(0,0,0,0.35)"; g.beginPath(); g.arc(x0 + rnd() * (x1 - x0), rnd() * h, 1 + rnd() * 3, 0, 7); g.fill(); }
    g.strokeStyle = "rgba(31,58,64,0.9)"; g.lineWidth = 3;
    for (let q = 0; q < 4; q++) { const bx = x0 + (x1 - x0) * (0.3 + q * 0.17); g.beginPath(); for (let y = 0; y <= h; y += 22) g.lineTo(bx + ((y / 22) % 2) * 10 - 5 + rnd() * 4, y); g.stroke(); }
    terrain = t;
  };

  const bars = (levels: Level[], xSpine: number, dir: -1 | 1, maxLen: number, color: string, alpha: number, mx: number) => {
    const rowH = Math.max(2, (10 / view.halfSpan) * (h / 2) - 1);
    ctx.fillStyle = color;
    for (const l of levels) {
      const y = yOf(l.px, h); if (y < -10 || y > h + 10) continue;
      const len = Math.max(1, (l.sz / mx) * maxLen);
      ctx.globalAlpha = alpha; ctx.fillRect(dir < 0 ? xSpine - len : xSpine, y - rowH / 2, len, rowH);
    }
    ctx.globalAlpha = 1;
  };

  // ---------- silhouettes ----------
  const font = (px: number, wt = 700) => `${wt} ${Math.max(8, Math.round(px * (k < 1 ? 0.85 : 1)))}px 'JetBrains Mono', monospace`;

  /** Warship facing right (toward the spine). L = hull length. */
  const ship = (x: number, y: number, L: number, t: number, ghost: boolean, alpha: number, wall: boolean, label: string) => {
    ctx.save(); ctx.translate(x, y); ctx.globalAlpha = alpha; const H = Math.max(4, L * 0.16);
    if (!ghost) { // wake
      ctx.strokeStyle = "rgba(234,236,239,0.18)"; ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) { const o = ((t / 400 + i / 3) % 1); ctx.globalAlpha = alpha * (1 - o) * 0.9;
        ctx.beginPath(); ctx.moveTo(-L / 2 - o * L * 0.6, H * 0.6 - o * 4); ctx.quadraticCurveTo(-L / 2 + 4, H * 0.5, -L / 2 - o * L * 0.6, H * 0.6 + o * 4 + 3); ctx.stroke(); }
      ctx.globalAlpha = alpha;
    }
    ctx.beginPath(); ctx.moveTo(-L / 2, -H * 0.3); ctx.lineTo(L / 2 - H * 0.2, -H * 0.3); ctx.lineTo(L / 2 + H * 0.8, 0); ctx.lineTo(L / 2 - H * 0.4, H * 0.7); ctx.lineTo(-L / 2 + H * 0.3, H * 0.7); ctx.closePath();
    if (ghost) { ctx.setLineDash([4, 3]); ctx.strokeStyle = C.sea.muted; ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]); }
    else {
      ctx.fillStyle = "#3b3420"; ctx.fill(); ctx.strokeStyle = wall ? C.sea.hi : C.sea.gold; ctx.lineWidth = wall ? 1.6 : 1; ctx.stroke();
      ctx.fillStyle = wall ? C.sea.hi : C.sea.gold;
      ctx.fillRect(-L * 0.12, -H * 1.3, L * 0.22, H); // superstructure
      ctx.fillRect(-L * 0.04, -H * 2.1, L * 0.06, H * 0.8); // bridge
      ctx.fillRect(-L * 0.01, -H * 2.9, 1, H * 0.8); // mast
      for (const gx of [L * 0.28, -L * 0.3]) { // turrets + barrels
        ctx.beginPath(); ctx.arc(gx, -H * 0.4, H * 0.42, Math.PI, 0); ctx.fill();
        ctx.fillRect(gx, -H * 0.62, H * 1.1 * (gx > 0 ? 1 : -1), 1.4);
      }
    }
    ctx.restore();
    pill(label, x, ghost ? y + H * 2.4 + 8 : y - H * 3.2 - 4, ghost ? C.sea.muted : wall ? C.sea.hi : C.sea.gold, 10);
  };

  /** Top-down tank. hullAng: hull heading, turretAng: turret heading (0 = right). */
  const tank = (x: number, y: number, s: number, hullAng: number, turretAng: number, col: string) => {
    ctx.save(); ctx.translate(x, y);
    ctx.save(); ctx.rotate(hullAng);
    ctx.fillStyle = "#081c1c"; ctx.fillRect(-12 * s, -8 * s, 24 * s, 16 * s);
    ctx.fillStyle = col; ctx.globalAlpha *= 0.85; ctx.fillRect(-13 * s, -10 * s, 26 * s, 3.5 * s); ctx.fillRect(-13 * s, 6.5 * s, 26 * s, 3.5 * s);
    ctx.fillStyle = "#081c1c"; for (let i = -12; i < 13; i += 4) { ctx.fillRect(i * s, -10 * s, 1, 3.5 * s); ctx.fillRect(i * s, 6.5 * s, 1, 3.5 * s); }
    ctx.globalAlpha /= 0.85; ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.strokeRect(-12 * s, -8 * s, 24 * s, 16 * s);
    ctx.restore();
    ctx.rotate(turretAng); ctx.fillStyle = col; ctx.fillRect(0, -1.3 * s, 20 * s, 2.6 * s); ctx.fillRect(18 * s, -2 * s, 3 * s, 4 * s);
    ctx.beginPath(); ctx.arc(0, 0, 5.5 * s, 0, 7); ctx.fill(); ctx.fillStyle = "#081c1c"; ctx.beginPath(); ctx.arc(-1 * s, 0, 2 * s, 0, 7); ctx.fill();
    ctx.restore();
  };

  /** Contrail behind, ground shadow below, then the aircraft. */
  const aircraft = (draw: (x: number, y: number, col: string, shadow: boolean) => void, x: number, y: number, dir: number, col: string, trail: number) => {
    const g = ctx.createLinearGradient(x, y, x - dir * trail, y);
    g.addColorStop(0, "rgba(234,236,239,0.35)"); g.addColorStop(1, "rgba(234,236,239,0)");
    ctx.strokeStyle = g; ctx.lineWidth = 2.5 * k; ctx.beginPath(); ctx.moveTo(x - dir * 20 * k, y - 4 * k); ctx.lineTo(x - dir * trail, y - 4 * k);
    ctx.moveTo(x - dir * 20 * k, y + 4 * k); ctx.lineTo(x - dir * trail, y + 4 * k); ctx.stroke();
    ctx.save(); ctx.globalAlpha *= 0.35; draw(x + dir * 18 * k, y + 46 * k, "#000000", true); ctx.restore();
    draw(x, y, col, false);
  };
  /** Swept-wing jet, nose toward +x scaled by dir. */
  const jet = (x: number, y: number, dir: number, s: number, col: string, flat = false) => {
    ctx.save(); ctx.translate(x, y); ctx.scale(dir * s, s); ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = flat ? 0 : 10;
    ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(6, -2); ctx.lineTo(-4, -14); ctx.lineTo(-8, -14); ctx.lineTo(-4, -2); ctx.lineTo(-12, -2); ctx.lineTo(-17, -7); ctx.lineTo(-19, -7);
    ctx.lineTo(-16, 0); ctx.lineTo(-19, 7); ctx.lineTo(-17, 7); ctx.lineTo(-12, 2); ctx.lineTo(-4, 2); ctx.lineTo(-8, 14); ctx.lineTo(-4, 14); ctx.lineTo(6, 2); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0; if (!flat) { ctx.fillStyle = "rgba(246,70,93,0.8)"; ctx.fillRect(-22, -1, 4, 2); } ctx.restore();
  };

  /** Four-engine bomber with long straight wings. */
  const bomber = (x: number, y: number, dir: number, s: number, col: string, flat = false) => {
    ctx.save(); ctx.translate(x, y); ctx.scale(dir * s, s); ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = flat ? 0 : 12;
    ctx.beginPath(); ctx.ellipse(0, 0, 26, 3.5, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(6, -2); ctx.lineTo(-2, -34); ctx.lineTo(-8, -34); ctx.lineTo(-6, -2); ctx.lineTo(-6, 2); ctx.lineTo(-8, 34); ctx.lineTo(-2, 34); ctx.lineTo(6, 2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(-26, -11); ctx.lineTo(-29, -11); ctx.lineTo(-27, 0); ctx.lineTo(-29, 11); ctx.lineTo(-26, 11); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = flat ? col : "#0b2a2a";
    for (const ey of [-24, -12, 12, 24]) { ctx.fillRect(1 - Math.abs(ey) * 0.18, ey - 1.8, 8, 3.6); }
    ctx.restore();
  };

  const rocket = (x: number, y: number, ang: number, s: number) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(s, s);
    ctx.fillStyle = C.sea.text; ctx.fillRect(-9, -1.6, 12, 3.2);
    ctx.fillStyle = C.danger; ctx.beginPath(); ctx.moveTo(3, -1.6); ctx.lineTo(7, 0); ctx.lineTo(3, 1.6); ctx.fill();
    ctx.fillStyle = C.sea.muted; ctx.fillRect(-9, -3.5, 3, 2); ctx.fillRect(-9, 1.5, 3, 2);
    ctx.fillStyle = C.sea.hi; ctx.shadowColor = C.sea.hi; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(-11, 0, 2, 0, 7); ctx.fill();
    ctx.restore();
  };

  /** Dashed tether from a unit's real price level to where it was stacked. */
  const leader = (fx: number, fy: number, tx: number, ty: number, col: string) => {
    ctx.save(); ctx.globalAlpha *= 0.55; ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(tx, fy); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.setLineDash([]); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(fx, fy, 2, 0, 7); ctx.fill(); ctx.restore();
  };
  const pill = (txt: string, x: number, y: number, col: string, size = 10) => {
    ctx.font = font(size); ctx.textAlign = "center"; const m = ctx.measureText(txt).width; const ph = size + 6;
    ctx.fillStyle = "rgba(7,9,12,0.85)"; ctx.beginPath(); ctx.roundRect(x - m / 2 - 5, y - ph + 3, m + 10, ph, ph / 2); ctx.fill();
    ctx.fillStyle = col; ctx.fillText(txt, x, y - 1);
  };
  const label = (txt: string, x: number, y: number, col: string, size = 11) => {
    ctx.font = font(size); ctx.textAlign = "center";
    ctx.fillStyle = "rgba(7,9,12,0.7)"; const m = ctx.measureText(txt).width; ctx.fillRect(x - m / 2 - 3, y - size + 1, m + 6, size + 3);
    ctx.fillStyle = col; ctx.fillText(txt, x, y);
  };

  const frame = (t: number) => {
    raf = requestAnimationFrame(frame);
    if (document.hidden) return;
    stepView(t);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = C.base; ctx.fillRect(0, 0, w, h);
    const r = regions(); const now = performance.now(); const dt = 1 / 60;
    maxSz = Math.max(1, ...store.bn.bids.map((l) => l.sz), ...store.bn.asks.map((l) => l.sz));
    maxHl = Math.max(1, ...store.hl.bids.map((l) => l.sz), ...store.hl.asks.map((l) => l.sz));
    const at = reduced ? 0 : t;

    // ---- SEA ----
    if (r.sea) {
      const [x0, x1] = r.sea; const dim = isStale(store.bn.status);
      ctx.save(); ctx.beginPath(); ctx.rect(x0, 0, x1 - x0, h); ctx.clip();
      ctx.fillStyle = C.sea.ground; ctx.fillRect(x0, 0, x1 - x0, h);
      ctx.strokeStyle = "rgba(240,185,11,0.06)"; ctx.lineWidth = 1;
      for (let y = 10; y < h; y += 26) { ctx.beginPath(); for (let x = x0; x <= x1; x += 12) ctx.lineTo(x, y + Math.sin(x / 40 + at / 900 + y) * 3); ctx.stroke(); }
      if (dim) ctx.globalAlpha = 0.35;
      seaMaxLen = Math.min(320, (x1 - x0) * (layout.mode === "full" ? 0.3 : 0.45));
      bars(store.bn.asks, x1, -1, seaMaxLen, C.sea.gold, 0.4, maxSz);
      bars(store.bn.bids, x1, -1, seaMaxLen, C.sea.hi, 0.85, maxSz);
      const base = dim ? 0.35 : 1;
      const placed: Box[] = [...(lanes.avoid ?? [])]; shipPos.clear();
      for (const u of [...store.bn.ships].sort((a, b) => b.sz - a.sz)) {
        const p = shipAnchor(u, x1, at); const H = Math.max(4, p.L * 0.16);
        const lw = (`${u.wall ? "WALL " : ""}${u.sz.toFixed(0)} BTC`.length * 6.2 + 12) / 2;
        const box = { x0: Math.min(p.x - p.L / 2 - 6, p.x - lw), x1: Math.max(p.x + p.L / 2 + H, p.x + lw), y0: p.y - H * 3.2 - 18, y1: p.y + H };
        const { dx, dy } = placeUnit(box, placed, -1, (lanes.sea ?? x0) + 8, x1 - 2, h);
        placed.push({ x0: box.x0 + dx, x1: box.x1 + dx, y0: box.y0 + dy, y1: box.y1 + dy });
        shipPos.set(`${u.side}${u.px}`, { x: p.x + dx, y: p.y + dy, L: p.L });
        if (dy) leader(x1 - (u.sz / maxSz) * seaMaxLen, p.y + 4 * k, p.x + dx, p.y + dy, C.sea.gold);
        ship(p.x + dx, p.y + dy, p.L, at, false, base, !!u.wall, `${u.wall ? "WALL " : ""}${u.sz.toFixed(0)} BTC`);
      }
      for (const g of store.bn.ghosts) { // after live ships so ghosts never cover them
        const a = 1 - (now - g.t) / GHOST_FADE_MS; if (a <= 0) continue;
        const p = shipAnchor({ ...g }, x1, 0); const H = Math.max(4, p.L * 0.16);
        const box = { x0: Math.min(p.x - p.L / 2 - 6, p.x - 50), x1: Math.max(p.x + p.L / 2 + H, p.x + 50), y0: p.y - H, y1: p.y + H * 2.4 + 12 };
        const { dx, dy } = placeUnit(box, placed, -1, (lanes.sea ?? x0) + 8, x1 - 2, h);
        placed.push({ x0: box.x0 + dx, x1: box.x1 + dx, y0: box.y0 + dy, y1: box.y1 + dy });
        ship(p.x + dx, p.y + dy, p.L, at, true, a * base, false, "ghost · pulled");
      }
      ctx.globalAlpha = 1;
      for (let i = sea.length - 1; i >= 0; i--) {
        const s = sea[i]!; const age = (now - s.t0) / 1000;
        if (s.kind === "rocket") {
          const T = 1.1; const p = Math.min(1, age / T); const sc = (s.big ? 1.6 : 1) * k;
          const x = s.x + (s.tx - s.x) * p, y = s.y + (s.ty - s.y) * p - Math.sin(p * Math.PI) * 40 * k;
          if (p < 1) {
            const p2 = Math.min(1, p + 0.02); const nx = s.x + (s.tx - s.x) * p2, ny = s.y + (s.ty - s.y) * p2 - Math.sin(p2 * Math.PI) * 40 * k;
            rocket(x, y, Math.atan2(ny - y, nx - x), sc); smokeTrail(x - 8 * sc, y);
          } else if (!s.n) { s.n = 1; explode(s.tx, s.ty, Math.min(2.5, 0.6 + Math.log10(1 + s.usd / 10_000)), C.sea.gold); }
          if (p >= 1) { ctx.globalAlpha = Math.max(0, 1 - (age - T) / 3); label(s.label!, s.tx, s.ty - 16 * k, C.danger, s.big ? 12 : 10); ctx.globalAlpha = 1; }
          if (age > T + 3) sea.splice(i, 1);
        } else if (s.kind === "shell") {
          if (!s.n) { const p0 = shipPos.get(s.label!) ?? { x: x1 - 60, y: s.ty, L: 30 }; s.x = p0.x + p0.L * 0.3; s.y = p0.y - 6 * k; s.n = 1;
            parts.push({ x: s.x + 8, y: s.y, vx: 0, vy: 0, life: 0, max: 0.18, color: "flash", r: (s.big ? 16 : 10) * k }); }
          const T = 0.7; const p = Math.min(1, age / T); const x = s.x + (s.tx - s.x) * p, y = s.y + (s.ty - s.y) * p - Math.sin(p * Math.PI) * 50 * k;
          if (p < 1) { ctx.fillStyle = C.sea.hi; ctx.shadowColor = C.sea.hi; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(x, y, (s.big ? 2.6 : 1.8) * k, 0, 7); ctx.fill(); ctx.shadowBlur = 0; }
          else { explode(s.tx - 4, s.ty, s.big ? 1 : 0.4, C.sea.gold); sea.splice(i, 1); }
        }
      }
      ctx.restore();
    }

    // ---- LAND ----
    if (r.land) {
      const [x0, x1] = r.land; const dim = isStale(store.hl.status);
      if (!terrain) buildTerrain(x0, x1);
      ctx.save(); ctx.beginPath(); ctx.rect(x0, 0, x1 - x0, h); ctx.clip();
      ctx.drawImage(terrain!, 0, 0, w, h);
      if (dim) ctx.globalAlpha = 0.35;
      landMaxLen = Math.min(320, (x1 - x0) * (layout.mode === "full" ? 0.3 : 0.45));
      bars(store.hl.asks, x0, 1, landMaxLen, C.land.teal, 0.45, maxHl);
      bars(store.hl.bids, x0, 1, landMaxLen, C.land.mint, 0.85, maxHl);
      const placedT: Box[] = [...(lanes.avoid ?? [])];
      for (const u of [...store.hl.tanks].sort((a, b) => b.sz - a.sz)) {
        const sc = U * k * (0.6 + 0.35 * Math.log10(1 + u.sz)); const bl = (u.sz / maxHl) * landMaxLen;
        const bx = x0 + bl + 24 * sc, by = yOf(u.px, h);
        const lw = (`${u.sz.toFixed(1)} BTC`.length * 6.2 + 12) / 2;
        const box = { x0: Math.min(bx - 22 * sc, bx - lw), x1: Math.max(bx + 14 * sc, bx + lw), y0: by - 11 * sc - 18, y1: by + 11 * sc };
        const pl = placeUnit(box, placedT, 1, x0 + 2, (lanes.land ?? x1) - 8, h);
        const x = bx + pl.dx; const y = yOf(u.px, h) + pl.dy;
        placedT.push({ x0: box.x0 + pl.dx, x1: box.x1 + pl.dx, y0: box.y0 + pl.dy, y1: box.y1 + pl.dy });
        const tur = Math.PI + Math.sin(at / 1600 + u.px) * 0.3;
        const col = u.side === "bid" ? C.land.mint : C.land.teal;
        if (pl.dy) leader(x0 + bl, by, x, y, col);
        tank(x, y, sc, Math.PI, tur, col);
        pill(`${u.sz.toFixed(1)} BTC`, x, y - 11 * sc - 4, col, 10);
      }
      ctx.globalAlpha = 1;
      for (let i = land.length - 1; i >= 0; i--) {
        const s = land[i]!; const age = (now - s.t0) / 1000;
        if (s.kind === "tank") {
          const sc = U * k * (s.big ? 1.15 : 0.65 + 0.25 * Math.log10(s.usd / 50_000 + 1));
          const T = 1.6; const p = Math.min(1, age / T); const e = 1 - (1 - p) ** 3; const x = s.x + (s.tx - s.x) * e;
          const fade = age > 7 ? Math.max(0, 1 - (age - 7)) : 1; if (fade <= 0) { land.splice(i, 1); continue; }
          const col = s.dir < 0 ? C.land.mint : C.danger;
          ctx.globalAlpha = fade; tank(x, s.y, sc, Math.PI, Math.PI, col);
          if (s.label) pill(s.label, x, s.y + (s.dir < 0 ? 22 : -14) * sc, col, 11);
          if (p >= 1 && !s.n) { s.n = 1; parts.push({ x: x - 22 * sc, y: s.y, vx: 0, vy: 0, life: 0, max: 0.18, color: "flash", r: 12 * sc }); }
          if (p >= 1 && age < T + 0.5) { const q = (age - T) / 0.5; const sx = x - 22 * sc + (x0 + 8 - (x - 22 * sc)) * q;
            ctx.fillStyle = C.land.mint; ctx.fillRect(sx, s.y - 1, 6 * k, 2); }
          if (age >= T + 0.5 && s.n === 1) { s.n = 2; explode(x0 + 10, s.y, s.big ? 1.4 : 0.6, C.land.mint); }
          ctx.globalAlpha = 1;
        }
      }
      ctx.restore();
    }

    // ---- particles ----
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]!; p.life += dt; if (p.life > p.max) { parts.splice(i, 1); continue; }
      const a = 1 - p.life / p.max;
      if (p.color === "flash") {
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(0.35, `rgba(246,70,93,${a})`); g.addColorStop(1, "rgba(246,70,93,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 + p.life * 3), 0, 7); ctx.fill(); continue;
      }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.smoke) { p.r += 6 * dt; ctx.globalAlpha = a * 0.28; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); continue; }
      p.vx *= 0.94; p.vy *= 0.94;
      ctx.globalAlpha = a; ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.r * 1.6, p.r);
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;

    // ---- SPINE ----
    const [s0, s1] = r.spine; const cx = (s0 + s1) / 2;
    ctx.fillStyle = "#0d1014"; ctx.fillRect(s0, 0, s1 - s0, h);
    ctx.strokeStyle = C.sea.border; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(s0 + 0.5, 0); ctx.lineTo(s0 + 0.5, h); ctx.moveTo(s1 - 0.5, 0); ctx.lineTo(s1 - 0.5, h); ctx.stroke();
    if (view.center) {
      ctx.font = "500 10px 'JetBrains Mono', monospace"; ctx.textAlign = "center";
      const lo = Math.floor((view.center - view.halfSpan) / 100) * 100;
      for (let p = lo; p <= view.center + view.halfSpan + 100; p += 100) {
        const y = yOf(p, h); ctx.fillStyle = "#3a434d"; ctx.fillRect(s0, y, 6, 1); ctx.fillRect(s1 - 6, y, 6, 1);
        ctx.fillStyle = C.sea.muted; if (s1 - s0 > 70) ctx.fillText(p.toLocaleString("en-US"), cx, y + 3);
      }
      const mk = store.bn.mark ?? store.hl.mark;
      if (mk) {
        const y = yOf(mk, h); const pw = Math.min(s1 - s0 - 6, 88);
        ctx.strokeStyle = "rgba(246,70,93,0.35)"; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = C.danger; ctx.beginPath(); ctx.roundRect(cx - pw / 2, y - 12, pw, 24, 12); ctx.fill();
        ctx.fillStyle = "#ffffff"; ctx.font = `700 ${pw < 60 ? 9 : 12}px 'JetBrains Mono', monospace`; ctx.fillText(mk.toLocaleString("en-US", { maximumFractionDigits: pw < 60 ? 0 : 1 }), cx, y + 4);
      }
    }
    // ---- AIR (own layer above panels when available) ----
    if (airCtx) { airCtx.setTransform(dpr, 0, 0, dpr, 0, 0); airCtx.clearRect(0, 0, w, h); ctx = airCtx; }
    for (let i = airs.length - 1; i >= 0; i--) {
      const s = airs[i]!; const age = (now - s.t0) / 1000;
      const D = s.kind === "jet" ? 2.2 : s.kind === "bomber" ? 4 : 9; const p = age / D;
      if (p > 1) { airs.splice(i, 1); continue; }
      const x = s.x + (s.tx - s.x) * p;
      if (s.kind === "bomber") {
        const lr = r.land; aircraft((ax, ay, c, f) => bomber(ax, ay, -1, 1.6 * k, c, f), x, s.y - 50 * k, -1, C.land.text, 200 * k);
        if (lr && Math.floor(age * 5) > s.n! && x > lr[0] + 30 && x < lr[1]) { s.n!++; explode(x, s.y + (Math.random() - 0.5) * 50 * k, 1.2, C.land.mint); }
      } else if (s.venue === "sea") {
        const js = (s.kind === "jet" ? 2.8 : 2.5) * k;
        aircraft((ax, ay, c, f) => jet(ax, ay, 1, js, c, f), x, s.y, 1, s.kind === "jet" ? C.sea.text : C.sea.hi, 160 * k);
        if (s.label) pill(s.label, x - 10 * k, s.y + 44 * k, C.sea.hi, 10);
      } else {
        aircraft((ax, ay, c, f) => jet(ax, ay, -1, 2.5 * k, c, f), x, s.y, -1, C.land.mint, 160 * k);
        if (s.label) pill(s.label, x + 10 * k, s.y + 44 * k, C.land.mint, 10);
      }
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx = mainCtx;
    if (reduced) { cancelAnimationFrame(raf); raf = 0; setTimeout(() => { if (!stopped) raf = requestAnimationFrame(frame); }, 1000); }
  };

  const ro = new ResizeObserver(resize); ro.observe(canvas); resize();
  raf = requestAnimationFrame(frame);
  return { onEvent, stop: () => { stopped = true; cancelAnimationFrame(raf); ro.disconnect(); } };
}
