import { useEffect, useState } from "react";
import { toggleMusic, useMusicFailed, useMusicOn, wantedBefore } from "@/lib/music";
import { Link } from "@tanstack/react-router";
import { GATE_MEDIA } from "@/lib/gateway-paths";

export function Lockup({ mark = 28, text = "text-[22px]", testId }: { mark?: number; text?: string; testId?: string }) {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label="donotdie home" data-testid={testId}>
      <img src={GATE_MEDIA.mark} alt="" style={{ height: mark, width: (mark * 320) / 300 }} />
      <span aria-hidden className={`font-brand font-bold uppercase leading-none tracking-[0.5px] text-sea-text ${text}`}>DO NOT DIE</span>
    </Link>
  );
}

export function SoundToggle() {
  const on = useMusicOn();
  const failed = useMusicFailed();
  const [prev, setPrev] = useState(false);
  useEffect(() => setPrev(wantedBefore()), []);
  const hi = on || (prev && !failed);
  return (
    <button type="button" onClick={toggleMusic} disabled={failed} data-testid="sound-toggle" aria-pressed={on}
      aria-label={failed ? "Music can't play in this browser" : on ? "Turn music off" : "Turn music on"}
      title={failed ? "Music can't play in this browser" : undefined}
      className={`grid h-10 w-10 place-items-center rounded-md disabled:cursor-not-allowed disabled:opacity-40 ${hi ? "text-sea" : "text-sea-muted hover:text-sea-text"} ${prev && !on && !failed ? "ring-1 ring-sea/60" : ""}`}>
      {on ? (
        <span className="flex h-4 items-end gap-[2px]" aria-hidden>
          {[0, 1, 2, 3].map((i) => <span key={i} className="eq-bar w-[3px] rounded-sm bg-current" style={{ animationDelay: `${i * 0.15}s` }} />)}
        </span>
      ) : (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M11 5 6 9H2v6h4l5 4V5z" fill="currentColor" /><path d="m23 9-6 6M17 9l6 6" />
        </svg>
      )}
    </button>
  );
}

export function SoundPill() {
  const on = useMusicOn();
  const failed = useMusicFailed();
  if (on) return null;
  return (
    <button type="button" onClick={toggleMusic} disabled={failed} data-testid="sound-pill"
      aria-label={failed ? "Music can't play in this browser" : "Turn music on"} aria-pressed={false}
      className="self-start rounded-full border border-sea-border bg-ink/60 px-4 py-2 text-sm font-semibold text-sea-text hover:border-sea disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-sea-border sm:self-center">
      {failed ? "♪ Sound unavailable" : "♪ Sound on"}
    </button>
  );
}
