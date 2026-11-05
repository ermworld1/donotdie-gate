// Client-only background music controller. Sound OFF by default; never autoplays.
import { useSyncExternalStore } from "react";
import { GATE_MEDIA } from "./gateway-paths";

const KEY = "donotdie:sound";
const VOL = 0.35;
let audio: HTMLAudioElement | null = null;
let on = false;
let failed = false; // this browser can't play the file (missing codec, bad response)
let held = false; // paused by trailer or hidden tab
let raf = 0;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

export function wantedBefore(): boolean {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
}
function remember(v: boolean) { try { localStorage.setItem(KEY, v ? "1" : "0"); } catch { /* ignore */ } }

function el() {
  if (!audio) {
    audio = new Audio();
    audio.preload = "none";
    audio.loop = true;
    audio.volume = 0;
    audio.src = GATE_MEDIA.music;
  }
  return audio;
}
function fade(to: number, ms: number, done?: () => void) {
  const a = el(); cancelAnimationFrame(raf);
  const from = a.volume, t0 = performance.now();
  const step = (t: number) => {
    // rAF timestamps can be earlier than t0, so k must be clamped or volume goes negative and throws.
    const k = clamp01((t - t0) / ms);
    a.volume = clamp01(from + (to - from) * k);
    if (k < 1) raf = requestAnimationFrame(step); else done?.();
  };
  raf = requestAnimationFrame(step);
}
function start() {
  const a = el();
  let p: Promise<void> | undefined;
  try { p = a.play(); } catch { p = Promise.reject(new DOMException("play failed", "NotSupportedError")); }
  if (!p) return;
  p.then(() => { if (on && !held) fade(VOL, 1500); }).catch((e: unknown) => {
    const name = e instanceof DOMException ? e.name : "";
    if (name === "AbortError") return; // interrupted by our own pause(); the user's choice still stands
    if (name !== "NotAllowedError") failed = true; // NotAllowed = autoplay policy, can retry on next tap
    on = false; emit();
  });
}
function stop() { if (audio) fade(0, 500, () => audio?.pause()); }

export function setMusic(v: boolean) {
  if (v && failed) return;
  on = v; remember(v); emit();
  if (v && !held) start(); else if (!v) stop();
}
export const toggleMusic = () => setMusic(!on);
/** Trailer modal / hidden tab: pause without forgetting the choice. */
export function holdMusic(h: boolean) {
  held = h;
  if (!on || !audio) return;
  if (h) { cancelAnimationFrame(raf); audio.pause(); } else start();
}
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => holdMusic(document.hidden));
}
export function useMusicOn() {
  return useSyncExternalStore(subscribe, () => on, () => false);
}
export function useMusicFailed() {
  return useSyncExternalStore(subscribe, () => failed, () => false);
}
