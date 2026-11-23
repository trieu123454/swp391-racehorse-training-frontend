"use client";

import { useEffect, useRef } from "react";
import { SWR_CACHE_UPDATED_EVENT } from "@/api/client";

/**
 * Silently refreshes workspace data when the user returns to the tab/window,
 * when stale-while-revalidate finishes updating the cache, or on a gentle interval.
 */
export function useAutoRefresh(
  callback: () => void | Promise<unknown>,
  options: { intervalMs?: number; minGapMs?: number; enabled?: boolean } = {},
) {
  const { intervalMs = 25_000, minGapMs = 4_000, enabled = true } = options;
  const callbackRef = useRef(callback);
  const inFlightRef = useRef(false);
  const lastRunRef = useRef(0);

  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) return;

    const trigger = (force = false) => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (inFlightRef.current) return;
      if (!force && now - lastRunRef.current < minGapMs) return;
      lastRunRef.current = now;
      inFlightRef.current = true;
      Promise.resolve(callbackRef.current())
        .catch(() => {})
        .finally(() => { inFlightRef.current = false; });
    };

    const onFocus = () => trigger(false);
    const onSwrUpdated = () => trigger(true);
    const onVisibility = () => { if (document.visibilityState === "visible") trigger(false); };
    const timer = window.setInterval(() => trigger(true), intervalMs);

    window.addEventListener("focus", onFocus);
    window.addEventListener(SWR_CACHE_UPDATED_EVENT, onSwrUpdated);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(SWR_CACHE_UPDATED_EVENT, onSwrUpdated);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, intervalMs, minGapMs]);
}
