"use client";

import { useEffect, useRef } from "react";
import { APP_MUTATION_COMPLETED_EVENT, SWR_CACHE_UPDATED_EVENT } from "@/api/client";

/**
 * Silently refreshes workspace data when the user returns to the tab/window,
 * when stale-while-revalidate finishes updating the cache, when another tab mutates data,
 * or on a gentle interval.
 */
export function useAutoRefresh(
  callback: () => void | Promise<unknown>,
  options: { intervalMs?: number; minGapMs?: number; enabled?: boolean } = {},
) {
  const { intervalMs = 25_000, minGapMs = 4_000, enabled = true } = options;
  const callbackRef = useRef(callback);
  const inFlightRef = useRef(false);
  const lastRunRef = useRef(0);
  const pendingRefreshRef = useRef(false);

  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) return;

    const trigger = (force = false) => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (inFlightRef.current) return;
      if (!force && now - lastRunRef.current < minGapMs) return;
      pendingRefreshRef.current = false;
      lastRunRef.current = now;
      inFlightRef.current = true;
      Promise.resolve(callbackRef.current())
        .catch(() => {})
        .finally(() => { inFlightRef.current = false; });
    };

    const onFocus = () => {
      if (pendingRefreshRef.current) trigger(true);
      else trigger(false);
    };
    const onSwrUpdated = (event: Event) => {
      const paths = (event as CustomEvent<{ paths?: string[] }>).detail?.paths;
      // A refreshed image URL must not reload every mounted workspace's data.
      if (paths?.length && paths.every((path) => /\/image(?:\?|$)/.test(path) || path.startsWith("/api/notifications"))) return;
      trigger(true);
    };
    const onCrossTabMutation = (event: Event) => {
      const detail = (event as CustomEvent<{ path?: string; crossTab?: boolean }>).detail;
      if (!detail?.crossTab) return;
      if (document.visibilityState === "visible") trigger(true);
      else pendingRefreshRef.current = true;
    };
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      if (pendingRefreshRef.current) trigger(true);
      else trigger(false);
    };
    const timer = window.setInterval(() => trigger(true), intervalMs);

    window.addEventListener("focus", onFocus);
    window.addEventListener(SWR_CACHE_UPDATED_EVENT, onSwrUpdated);
    window.addEventListener(APP_MUTATION_COMPLETED_EVENT, onCrossTabMutation);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(SWR_CACHE_UPDATED_EVENT, onSwrUpdated);
      window.removeEventListener(APP_MUTATION_COMPLETED_EVENT, onCrossTabMutation);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, intervalMs, minGapMs]);
}
