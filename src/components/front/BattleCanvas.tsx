import { useEffect, useRef } from "react";
import { createBattle, type Lanes, type Layout } from "@/lib/battle-render";
import { onBattle } from "@/lib/feeds";

/**
 * Battlefield canvas. In full mode an extra top canvas (above the panels) carries aircraft,
 * and `[data-panel="sea"|"land"]` siblings are measured so parked units stay in the open lane.
 */
export function BattleCanvas({ mode, className, label, withAir = false }: { mode: Layout["mode"]; className?: string; label: string; withAir?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const airRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lanes: Lanes = {};
    const host = canvas.parentElement!;
    const measure = () => {
      const c = canvas.getBoundingClientRect();
      const sea = host.querySelector<HTMLElement>('[data-panel="sea"]')?.getBoundingClientRect();
      const land = host.querySelector<HTMLElement>('[data-panel="land"]')?.getBoundingClientRect();
      lanes.sea = sea ? sea.right - c.left : undefined;
      lanes.land = land ? land.left - c.left : undefined;
      lanes.avoid = [...host.querySelectorAll<HTMLElement>("[data-avoid]")].map((el) => {
        const r = el.getBoundingClientRect();
        return { x0: r.left - c.left - 6, x1: r.right - c.left + 6, y0: r.top - c.top - 6, y1: r.bottom - c.top + 6 };
      });
    };
    measure();
    const ro = new ResizeObserver(measure); ro.observe(host);
    host.querySelectorAll("[data-panel],[data-avoid]").forEach((el) => ro.observe(el));
    const b = createBattle(canvas, { mode }, reduced, { air: withAir ? airRef.current : null, lanes });
    const off = onBattle(b.onEvent);
    return () => { off(); b.stop(); ro.disconnect(); };
  }, [mode, withAir]);
  return (
    <>
      <canvas ref={ref} className={className} role="img" aria-label={label} />
      {withAir && <canvas ref={airRef} aria-hidden className="pointer-events-none absolute inset-0 z-20 h-full w-full" />}
    </>
  );
}
