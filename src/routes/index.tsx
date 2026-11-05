import { Lockup, SoundToggle, SoundPill } from "@/components/Brand";
import { holdMusic } from "@/lib/music";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { BattleCanvas } from "@/components/front/BattleCanvas";
import { useLive } from "@/hooks/use-live";
import { isStale, store as S } from "@/lib/feeds";
import { fmtPx, fmtUsd } from "@/lib/battle-logic";
import { GATE_MEDIA, SEA_URL, LAND_URL } from "@/lib/gateway-paths";

const TG = "https://t.me/donotdielive";
const X = "https://x.com/donotdielive";
const BOT = "https://t.me/donotdielive_bot";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Do Not Die · Crypto Liquidation Warfare, Live" },
      { name: "description", content: "Live BTC liquidation battlefield on two fronts. At sea, Binance futures order flow. On land, every open Hyperliquid position at its liquidation price. Real data, not a heatmap." },
      { property: "og:site_name", content: "Do Not Die" },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://donotdie.live/" },
      { property: "og:title", content: "Do Not Die · Crypto Liquidation Warfare" },
      { property: "og:description", content: "Two fronts, one price. Ships are real orders, tanks are real positions. Watch who dies next, live." },
      { property: "og:image", content: "https://donotdie.live/_gate/media/og-v1.jpg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "Crypto liquidation warfare: ships at sea and tanks on land facing each other across one BTC price line" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@donotdielive" },
      { name: "twitter:title", content: "Do Not Die · Crypto Liquidation Warfare" },
      { name: "twitter:description", content: "Two fronts, one price. Ships are real orders, tanks are real positions. Watch who dies next, live." },
      { name: "twitter:image", content: "https://donotdie.live/_gate/media/og-v1.jpg" },
    ],
    links: [{ rel: "canonical", href: "https://donotdie.live/" }],
  }),
  component: Index,
});

type Store = typeof S;

function Index() {
  const s = useLive(500);
  return (
    <div className="min-h-dvh bg-ink text-sea-text">
      <TopBar />
      <main id="top">
        <Hero s={s} />
        <Front s={s} />
        <Tape s={s} />
        <WhyTwo />
      </main>
    </div>
  );
}

function TopBar() {
  return (
    <header className="sticky top-0 z-40 border-b border-sea-border bg-ink/90 backdrop-blur">
      <div className="mx-auto grid h-14 max-w-[1440px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 md:grid-cols-[1fr_auto_1fr] md:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <span className="hidden sm:block"><Lockup testId="lockup-top" /></span><span className="sm:hidden"><Lockup mark={24} text="text-lg" testId="lockup-top-sm" /></span><span className="live-dot inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-danger" aria-hidden /><span className="sr-only">live</span>
          <span className="font-mono text-[10px] font-bold text-danger">LIVE</span>
        </div>
        <nav aria-label="Theaters" className="hidden rounded-full border border-sea-border bg-sea-panel p-1 text-sm font-semibold md:flex">
          <a href={SEA_URL} className="rounded-full px-4 py-1.5 text-sea transition hover:bg-sea hover:text-sea-ground">Sea · Binance</a>
          <a href={LAND_URL} className="rounded-full px-4 py-1.5 text-land transition hover:bg-land hover:text-land-ground">Land · Hyperliquid</a>
        </nav>
        <div className="flex items-center justify-end gap-1">
          <SoundToggle />
          <a href={TG} aria-label="donotdie on Telegram" className="grid h-10 w-10 place-items-center rounded-md text-sea-muted hover:text-sea-text">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden><path d="M21.9 4.3 18.7 19.4c-.2 1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.3-5 9.1-8.2c.4-.4-.1-.6-.6-.2L6.2 13 1.4 11.5c-1-.3-1-1 .2-1.5L20.6 2.7c.9-.3 1.6.2 1.3 1.6z"/></svg>
          </a>
          <a href={X} aria-label="donotdie on X" className="grid h-10 w-10 place-items-center rounded-md text-sea-muted hover:text-sea-text">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden><path d="M18.2 2h3.4l-7.4 8.5L23 22h-6.8l-5.3-7-6.1 7H1.4l7.9-9L1 2h7l4.8 6.4L18.2 2zm-1.2 18h1.9L7.1 3.9H5.1L17 20z"/></svg>
          </a>
        </div>
      </div>
    </header>
  );
}

function Hero({ s }: { s: Store }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const vid = useRef<HTMLVideoElement>(null);
  const [vidErr, setVidErr] = useState(false);
  const close = () => { vid.current?.pause(); dlg.current?.close(); };
  const openTrailer = () => {
    holdMusic(true);
    dlg.current?.showModal();
    const v = vid.current;
    if (!v) return;
    if (v.error) { setVidErr(true); return; }
    setVidErr(false);
    v.play().catch((e: unknown) => {
      const name = e instanceof DOMException ? e.name : "";
      // AbortError: closed before it started. NotAllowedError: controls are visible, the user can press play.
      if (name !== "AbortError" && name !== "NotAllowedError") setVidErr(true);
    });
  };
  return (
    <section className="relative isolate overflow-hidden">
      <video className="absolute inset-0 -z-10 h-full w-full object-cover" src={GATE_MEDIA.hero} poster={GATE_MEDIA.poster} autoPlay muted loop playsInline aria-hidden />
      <div className="hero-overlay absolute inset-0 -z-10" />
      <div className="mx-auto flex min-h-[78vh] max-w-[1440px] flex-col justify-end px-4 pb-14 pt-28 md:px-6 md:pb-20">
        <Lockup mark={56} text="text-4xl md:text-5xl" testId="lockup-hero" />
        <p className="text-legible mt-3 flex items-center gap-2 text-sm font-medium text-land-text"><span className="live-dot inline-block h-2 w-2 rounded-full bg-land" aria-hidden />Live from Binance &amp; Hyperliquid</p>
        <p className="text-legible mt-6 font-mono text-xs font-bold tracking-[0.3em] text-danger">BTC · TWO FRONTS · LIVE</p>
        <h1 className="mt-3 max-w-4xl font-display text-6xl uppercase leading-[0.9] text-sea-text md:text-[9rem]">Crypto liquidation warfare</h1>
        <p className="text-legible mt-4 max-w-xl text-lg text-sea-text md:text-xl">Two fronts. One price. Watch who dies next.</p>
        <p data-testid="hero-proof" className="text-legible mt-2 max-w-xl text-sm font-medium text-sea-text/90 md:text-base">Not a heatmap. Nothing on the map is a model: real positions on land, real orders at sea.</p>
        <blockquote className="text-legible mt-4 max-w-xl border-l-2 border-danger pl-4 font-brand text-lg italic text-sea-text">“We shall fight on land, at sea and in the air. We shall live.”</blockquote>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <a href={SEA_URL} className="rounded-md bg-sea px-7 py-4 text-center font-display text-2xl uppercase text-sea-ground transition hover:bg-sea-hi">Enter the Sea</a>
          <a href={LAND_URL} className="rounded-md bg-land px-7 py-4 text-center font-display text-2xl uppercase text-land-ground transition hover:bg-land-teal">Enter the Land</a>
          <button type="button" onClick={openTrailer} data-testid="trailer-open" className="flex items-center justify-center gap-3 rounded-md border border-sea-border bg-ink/60 px-6 py-4 font-semibold text-sea-text hover:border-sea-text">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-danger" aria-hidden><svg viewBox="0 0 10 10" className="h-3 w-3 fill-current"><path d="M2 1l7 4-7 4z"/></svg></span>
            Watch trailer
          </button>
          <SoundPill />
        </div>
        <PriceStrip s={s} />
      </div>
      <dialog ref={dlg} onClose={() => { vid.current?.pause(); holdMusic(document.hidden); }} onClick={(e) => e.target === dlg.current && close()} aria-label="donotdie trailer"
        className="m-auto w-[min(1100px,94vw)] rounded-lg border border-sea-border bg-ink p-0 backdrop:bg-ink/90">
        <div className="relative">
          <video ref={vid} src={GATE_MEDIA.trailer} poster={GATE_MEDIA.poster} controls playsInline preload="none" onError={() => setVidErr(true)} className="block aspect-video w-full bg-ink" />
          {vidErr && (
            <div role="alert" data-testid="trailer-error" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink/90 p-6 text-center">
              <p className="font-semibold text-sea-text">This browser can't play the trailer.</p>
              <a href={GATE_MEDIA.trailer} download className="rounded-md bg-sea px-5 py-2.5 font-semibold text-sea-ground hover:bg-sea-hi">Download trailer (MP4)</a>
            </div>
          )}
          <button type="button" onClick={close} aria-label="Close trailer" data-testid="trailer-close" className="absolute right-2 top-2 grid h-10 w-10 place-items-center rounded-full bg-ink/80 text-sea-text hover:bg-danger">✕</button>
        </div>
      </dialog>
    </section>
  );
}

function PriceStrip({ s }: { s: Store }) {
  const bn = s.bn.mark, hl = s.hl.mid;
  const spread = bn != null && hl != null ? bn - hl : null;
  const bps = spread != null && bn ? (spread / bn) * 1e4 : null;
  const px = (n: number | null) => (n == null ? "syncing…" : `$${n.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`);
  return (
    <div aria-live="off" className="mt-8 inline-flex max-w-full flex-wrap items-center gap-x-6 gap-y-2 self-start rounded-md border border-sea-border bg-ink/70 px-4 py-2.5 font-mono text-sm backdrop-blur">
      <span className="flex items-center gap-2 text-danger"><span className="live-dot inline-block h-2 w-2 rounded-full bg-danger" aria-hidden />LIVE</span>
      <span className="text-sea-muted">Binance mark <span className="font-bold text-sea">{px(bn)}</span></span>
      <span className="text-land-muted">Hyperliquid mid <span className="font-bold text-land">{px(hl)}</span></span>
      <span className="text-sea-muted">Spread <span className="font-bold text-sea-text">{spread == null ? "—" : `${spread >= 0 ? "+" : "−"}$${Math.abs(spread).toFixed(1)} · ${Math.abs(bps!).toFixed(1)} bps`}</span></span>
    </div>
  );
}

function Badge({ s, tone }: { s: Store["bn"]["status"]; tone: "sea" | "land" }) {
  const stale = isStale(s);
  if (s.open && !stale) return <span className={`shrink-0 whitespace-nowrap font-mono text-[10px] font-bold ${tone === "sea" ? "text-sea" : "text-land"}`}>● LIVE</span>;
  return <span role="status" className="shrink-0 whitespace-nowrap rounded border border-danger px-1.5 py-0.5 font-mono text-[10px] font-bold text-danger">{s.open ? "STALE · LAST FRAME" : "RECONNECTING…"}</span>;
}


const ago = (t: number) => { const d = Math.max(0, Math.round((Date.now() - t) / 1000)); return d < 90 ? `${d}s ago` : `${Math.round(d / 60)}m ago`; };
function Waiting({ text, tone }: { text: string; tone: "sea" | "land" }) {
  return <span className={`font-mono text-base ${tone === "sea" ? "text-sea-text" : "text-land-text"}`}>{text}<span className={`caret-blink ml-0.5 ${tone === "sea" ? "text-sea" : "text-land"}`} aria-hidden>▍</span></span>;
}
const biggestLevel = (bids: { px: number; sz: number }[], asks: { px: number; sz: number }[], mark: number | null) =>
  mark ? [...bids, ...asks].filter((l) => Math.abs(l.px - mark) <= 400).sort((a, b) => b.sz - a.sz)[0] : undefined;

function SeaPanel({ s, compact = false }: { s: Store; compact?: boolean }) {
  const bn = s.bn; const liq = bn.liqLong + bn.liqShort; const big = biggestLevel(bn.bids, bn.asks, bn.mark);
  const isWall = big && bn.walls.some((w) => w.px === big.px);
  return (
    <div className="rounded-lg border border-sea-border bg-sea-panel/90 p-5 backdrop-blur">
      <div className="flex items-start justify-between gap-2"><p className="min-w-0 font-mono text-[11px] font-bold tracking-widest text-sea">THE SEA · BINANCE BTC PERPS</p><Badge s={bn.status} tone="sea" /></div>
      {!compact && <h2 className="mt-2 font-display text-4xl uppercase leading-none text-sea-text">Walls, ghosts and forced sells</h2>}
      <dl className="mt-4 space-y-3">
        <div><dt className="text-xs text-sea-muted">Liquidated · session (Binance-reported)</dt>
          {bn.lastLiq ? <>
            <dd className="font-mono text-3xl font-bold text-sea-text">{fmtUsd(liq)}</dd>
            <dd className="font-mono text-xs text-sea-muted">Longs <span className="text-danger">{fmtUsd(bn.liqLong)}</span> · Shorts <span className="text-sea-hi">{fmtUsd(bn.liqShort)}</span> · {bn.liqCount} orders</dd>
            <dd className="font-mono text-xs text-sea-muted">Last liquidation: <span className="text-sea-text">{fmtUsd(bn.lastLiq.usd)} {bn.lastLiq.side}</span> · {ago(bn.lastLiq.t)}</dd>
          </> : <dd className="py-1"><Waiting text="Waiting for first forced order…" tone="sea" /></dd>}
        </div>
        {!compact && <div className="grid grid-cols-2 gap-3">
          <div><dt className="text-xs text-sea-muted">{isWall ? "Biggest wall" : "Biggest level"}</dt><dd className="font-mono text-sm font-bold text-sea">{big ? `${big.sz.toFixed(0)} BTC @ ${fmtPx(big.px)}` : <Waiting text="Reading book" tone="sea" />}</dd></div>
          <div><dt className="text-xs text-sea-muted">Ghosts pulled</dt><dd className="font-mono text-sm font-bold text-sea-text">{bn.ghostsPulled}</dd></div>
        </div>}
      </dl>
      <a href={SEA_URL} className="mt-5 block rounded-md bg-sea px-4 py-3 text-center font-display text-xl uppercase text-sea-ground hover:bg-sea-hi">Enter the Sea →</a>
      {!compact && <p className="mt-3 text-xs text-sea-muted">Fog of war: Binance hides who. You see size, walls and forced orders as Binance reports them.</p>}
    </div>
  );
}

function LandPanel({ s, compact = false }: { s: Store; compact?: boolean }) {
  const hl = s.hl;
  return (
    <div className="rounded-lg border border-land-border bg-land-panel/90 p-5 backdrop-blur">
      <div className="flex items-start justify-between gap-2"><p className="min-w-0 font-mono text-[11px] font-bold tracking-widest text-land">THE LAND · HYPERLIQUID BTC &amp; HYPE</p><Badge s={hl.status} tone="land" /></div>
      {!compact && <h2 className="mt-2 font-display text-4xl uppercase leading-none text-land-text">Every whale. Every death price.</h2>}
      <dl className="mt-4 space-y-3">
        <div><dt className="text-xs text-land-muted">Whale fills · session <span className="text-land-muted">(over $250K)</span></dt>
          {hl.lastWhale ? <>
            <dd className="font-mono text-3xl font-bold text-land-text">{hl.whaleCount} <span className="text-lg text-land">· {fmtUsd(hl.whaleNotional)}</span></dd>
            <dd className="font-mono text-xs text-land-muted">Last whale fill: <span className="text-land-text">{fmtUsd(hl.lastWhale.usd)}</span> · {ago(hl.lastWhale.t)}</dd>
            {hl.biggestWhale && <dd className="font-mono text-xs text-land-muted">Biggest whale fill: <span className="text-land">{fmtUsd(hl.biggestWhale.usd)} {hl.biggestWhale.buy ? "buy" : "sell"} @ {fmtPx(hl.biggestWhale.px)}</span></dd>}
          </> : <dd className="py-1"><Waiting text="Waiting for first whale fill…" tone="land" /></dd>}
        </div>
        {!compact && <div className="grid grid-cols-2 gap-3">
          <div><dt className="text-xs text-land-muted">Funding (1h)</dt><dd className="font-mono text-sm font-bold text-land">{hl.funding == null ? <Waiting text="Syncing" tone="land" /> : `${(hl.funding * 100).toFixed(4)}%`}</dd></div>
          <div><dt className="text-xs text-land-muted">Open interest</dt><dd className="font-mono text-sm font-bold text-land-text">{hl.oi == null ? <Waiting text="Syncing" tone="land" /> : fmtUsd(hl.oi)}</dd></div>
        </div>}
      </dl>
      <a href={LAND_URL} className="mt-5 block rounded-md bg-land px-4 py-3 text-center font-display text-xl uppercase text-land-ground hover:bg-land-teal">Enter the Land →</a>
      {!compact && <p className="mt-3 text-xs text-land-muted">Clear sight: every position on Hyperliquid is public.</p>}
    </div>
  );
}

function Alert({ s }: { s: Store }) {
  const a = s.alert && Date.now() - s.alert.t < 120_000 ? s.alert : null;
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-2 rounded-lg border border-danger bg-ink/95 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
      <span className="font-mono text-[11px] font-bold tracking-widest text-danger">CROSS-FRONT</span>
      <span className="min-w-0 flex-1 font-mono text-sm text-sea-text">{a ? a.text : "Watching for pulled Binance walls near price while Hyperliquid is thin on the same side…"}</span>
      <a href={BOT} className="shrink-0 font-semibold text-danger underline-offset-4 hover:underline">Hyperliquid liq alerts →</a>
    </div>
  );
}

function useIsMobile() {
  const [m, set] = useState<boolean | null>(null);
  useEffect(() => { const q = window.matchMedia("(max-width: 767px)"); const f = () => set(q.matches); f(); q.addEventListener("change", f); return () => q.removeEventListener("change", f); }, []);
  return m;
}

function Front({ s }: { s: Store }) {
  const mobile = useIsMobile();
  if (mobile === null) return <section className="h-[760px]" aria-label="The front" />;
  if (mobile) return (
    <section aria-label="The front" className="space-y-4 px-4 py-8">
      <div className="overflow-hidden rounded-lg border border-sea-border bg-sea-ground">
        <BattleCanvas mode="sea" className="block h-64 w-full" label="Live Binance BTC order book battlefield" />
        <div className="p-3"><SeaPanel s={s} compact /></div>
      </div>
      <Alert s={s} />
      <div className="overflow-hidden rounded-lg border border-land-border bg-land-ground">
        <BattleCanvas mode="land" className="block h-64 w-full" label="Live Hyperliquid BTC order book battlefield" />
        <div className="p-3"><LandPanel s={s} compact /></div>
      </div>
    </section>
  );
  return (
    <section aria-label="The front" className="relative mx-auto h-[760px] max-w-[1440px] border-y border-sea-border">
      <BattleCanvas mode="full" withAir className="absolute inset-0 h-full w-full" label="Live battlefield: Binance order book on the left, Hyperliquid on the right, sharing the BTC price axis" />
      <div className="pointer-events-none absolute inset-y-0 left-0 flex w-[min(340px,26%)] items-start p-5"><div data-panel="sea" className="pointer-events-auto w-full"><SeaPanel s={s} /></div></div>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex w-[min(340px,26%)] items-start p-5"><div data-panel="land" className="pointer-events-auto w-full"><LandPanel s={s} /></div></div>
      <div data-avoid className="absolute bottom-5 left-1/2 w-[min(760px,60%)] -translate-x-1/2"><Alert s={s} /></div>
    </section>
  );
}

function Tape({ s }: { s: Store }) {
  const items = s.tape;
  const row = (k: string) => items.map((t) => (
    <li key={k + t.id} className="flex shrink-0 items-center gap-2 px-5">
      <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold ${t.venue === "SEA" ? "border-sea text-sea" : "border-land text-land"}`}>{t.venue}</span>
      <span className={`font-mono text-sm ${t.tone === "danger" ? "text-danger" : t.tone === "up" ? "text-land" : "text-sea-text"}`}>{t.text}</span>
    </li>
  ));
  return (
    <section aria-label="Live tape" className="overflow-hidden border-b border-sea-border bg-sea-ground py-3">
      {items.length === 0 ? <p className="px-6 font-mono text-sm text-sea-muted">LIVE TAPE · waiting for the first shots from Binance and Hyperliquid…</p> :
        <ul className="tape-track flex w-max">{row("a")}{row("b")}</ul>}
    </section>
  );
}

function WhyTwo() {
  return (
    <section className="mx-auto max-w-[1440px] px-4 py-20 md:px-6">
      <h2 className="font-display text-5xl uppercase text-sea-text md:text-7xl">Why two fronts</h2>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <article className="rounded-lg border border-sea-border bg-sea-panel p-6">
          <p className="font-mono text-xs font-bold tracking-widest text-sea">THE SEA · BINANCE</p>
          <h3 className="mt-2 font-display text-3xl uppercase text-sea-text">Deepest book. Anonymous.</h3>
          <p className="mt-2 text-sea-muted">Binance's BTC perp book, anonymous. You can't see who, but you see the walls they build, the ones they pull, and forced liquidations as Binance reports them.</p>
          <a href={SEA_URL} className="mt-4 inline-block font-semibold text-sea hover:text-sea-hi">Enter the Sea →</a>
        </article>
        <article className="rounded-lg border border-land-border bg-land-panel p-6">
          <p className="font-mono text-xs font-bold tracking-widest text-land">THE LAND · HYPERLIQUID</p>
          <h3 className="mt-2 font-display text-3xl uppercase text-land-text">Transparent positions.</h3>
          <p className="mt-2 text-land-muted">On-chain perps: every position, size and liquidation price is public. Track the whales by wallet and know where they die.</p>
          <a href={LAND_URL} className="mt-4 inline-block font-semibold text-land hover:text-land-teal">Enter the Land →</a>
        </article>
      </div>
      <div className="mt-10 flex flex-col items-start justify-between gap-4 rounded-lg border border-danger/60 bg-sea-ground p-6 md:flex-row md:items-center">
        <div><h3 className="font-display text-3xl uppercase text-sea-text">Get the kill feed on Telegram</h3><p className="text-sea-muted">Every big liquidation cascade, posted the minute it happens. Free alerts before your own Hyperliquid position dies.</p></div>
        <a href={TG} className="rounded-md bg-danger px-6 py-3 font-display text-xl uppercase text-sea-text hover:opacity-90">Join Telegram</a>
      </div>
      <div className="mt-10"><Lockup testId="lockup-footer" /></div>
      <p className="mt-4 text-xs text-sea-muted">Not financial advice. Not affiliated with Binance or Hyperliquid.</p>
    </section>
  );
}
