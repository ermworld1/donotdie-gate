import { useEffect, useState } from "react";
import { startFeeds, store } from "@/lib/feeds";

/** Starts live feeds and re-renders every `ms` so stats reflect the mutable store. */
export function useLive(ms = 500) {
  const [, set] = useState(0);
  useEffect(() => {
    const stop = startFeeds();
    const i = setInterval(() => !document.hidden && set((n) => n + 1), ms);
    return () => { clearInterval(i); stop(); };
  }, [ms]);
  return store;
}
