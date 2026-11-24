"use client";
import { useEffect } from "react";

export function useLinkedNotificationHorse(horses: readonly { id: string }[], select: (id: string) => void) {
  const ids = horses.map((horse) => horse.id).join(",");
  useEffect(() => {
    const sync = () => {
      const url = new URL(window.location.href), horse = url.searchParams.get("horse");
      if (horse && ids.split(",").includes(horse)) select(horse);
    };
    sync(); window.addEventListener("workspace-tab-change", sync); window.addEventListener("popstate", sync);
    return () => { window.removeEventListener("workspace-tab-change", sync); window.removeEventListener("popstate", sync); };
  }, [ids, select]);
}

/** Wait for asynchronously loaded rows before scrolling; never interpolate HTML. */
export function useNotificationTarget(pathname: string | null) {
  useEffect(() => {
    let observer: MutationObserver | undefined;
    let stop: number | undefined;
    let clear: number | undefined;
    let frame: number | undefined;
    let highlighted: Element | null = null;
    const reset = () => { observer?.disconnect(); if (frame) cancelAnimationFrame(frame); window.clearTimeout(stop); window.clearTimeout(clear); highlighted?.classList.remove("notification-target-highlight"); highlighted = null; };
    const watch = () => {
      reset();
      const url = new URL(window.location.href), id = url.searchParams.get("notificationTarget");
      if (!id) return;
      const find = () => {
        const active = document.querySelector<HTMLAnchorElement>(".horse-sidebar nav a[aria-current='page']");
        if (active && (new URL(active.href).searchParams.get("tab") ?? "overview") !== (url.searchParams.get("tab") ?? "overview")) return;
        const row = document.querySelector(`[data-notification-target="${CSS.escape(id)}"]`);
        if (!row) return;
        highlighted = row; row.classList.add("notification-target-highlight");
        row.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center", inline: "nearest" });
        observer?.disconnect(); window.clearTimeout(stop);
        url.searchParams.delete("notificationTarget");
        window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
        clear = window.setTimeout(() => { row.classList.remove("notification-target-highlight"); }, 2000);
      };
      observer = new MutationObserver(find); observer.observe(document.body, { childList: true, subtree: true });
      stop = window.setTimeout(() => observer?.disconnect(), 15000);
      frame = requestAnimationFrame(find);
    };
    watch(); window.addEventListener("workspace-tab-change", watch); window.addEventListener("popstate", watch);
    return () => { reset(); window.removeEventListener("workspace-tab-change", watch); window.removeEventListener("popstate", watch); };
  }, [pathname]);
}
