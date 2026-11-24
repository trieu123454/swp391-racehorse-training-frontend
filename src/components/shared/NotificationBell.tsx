"use client";

import { AlertTriangle, Bell, BellOff, CalendarPlus, Check, CheckCheck, LockKeyhole, LockKeyholeOpen, RefreshCw, ShieldAlert, Trash2, UserRoundCog, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { APP_MUTATION_COMPLETED_EVENT, authenticatedRequest, NOTIFICATION_COUNT_CHANGED_EVENT, validateSession } from "@/api/client";
import { getAccessToken } from "@/lib/session";
import { notificationExactTime, notificationGroup, notificationHref, notificationIsAccount, notificationKind, notificationPresentation, notificationRelativeTime, type BellNotification, type NotificationTarget } from "@/lib/notifications";
import type { AuthUser } from "@/types/auth";

type Page = { data: BellNotification[]; total: number; unread_count: number };
const icons = { overdue: AlertTriangle, assigned: CalendarPlus, reassigned: UserRoundCog, incident: ShieldAlert, general: Bell, role: UserRoundCog, locked: LockKeyhole, unlocked: LockKeyholeOpen, account: UserRoundCog };
const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080").replace(/\/+$/, "");

export default function NotificationBell({ user }: { user: AuthUser }) {
  const [open, setOpen] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(true);
  const [limit, setLimit] = useState(20);
  const [page, setPage] = useState<Page>({ data: [], total: 0, unread_count: 0 });
  const [allTotal, setAllTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [scrollEdges, setScrollEdges] = useState({ top: false, bottom: false });
  const list = useRef<HTMLDivElement>(null);
  const [, setClock] = useState(0);
  const [position, setPosition] = useState({ top: 64, right: 12 });
  const bell = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const previous = useRef<{ unread: number; latest: string | null } | null>(null);
  const loadedFilter = useRef(unreadOnly);
  const revision = useRef({ value: 0 });
  const router = useRouter();
  const pathname = usePathname();
  const updateScroll = useCallback(() => {
    const el = list.current;
    if (!el) return;
    setScrollEdges({ top: el.scrollTop > 1, bottom: el.scrollTop + el.clientHeight < el.scrollHeight - 1 });
  }, []);
  useEffect(() => { if (!open || !list.current) return; const observer = new ResizeObserver(updateScroll); observer.observe(list.current); const frame = requestAnimationFrame(updateScroll); return () => { observer.disconnect(); cancelAnimationFrame(frame); }; }, [open, page, updateScroll]);

  const close = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => bell.current?.focus());
  }, []);
  const refresh = useCallback(async () => {
    const version = ++revision.current.value;
    try {
      const [results, latest] = await Promise.all([
        Promise.all(Array.from({ length: Math.ceil(limit / 20) }, (_, index) => authenticatedRequest<Page>(`/api/notifications?unread_only=${unreadOnly}&page=${index + 1}&limit=20`, { cache: "no-store" }))),
        authenticatedRequest<Page>("/api/notifications?unread_only=false&page=1&limit=1", { cache: "no-store" }),
      ]);
      const result = { ...results[0], data: [...new Map(results.flatMap((result) => result.data).map((item) => [item.id, item])).values()] };
      if (version !== revision.current.value) return;
      const next = { unread: result.unread_count, latest: latest.data[0]?.id ?? null };
      if (previous.current && next.latest !== previous.current.latest && next.unread > 0 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        bell.current?.animate([{ transform: "rotate(0)" }, { transform: "rotate(-12deg)" }, { transform: "rotate(12deg)" }, { transform: "rotate(-8deg)" }, { transform: "rotate(0)" }], { duration: 480 });
      }
      previous.current = next;
      setPage(result); setAllTotal(latest.total); setError("");
    } catch (reason) {
      if (version === revision.current.value) setError(reason instanceof Error ? reason.message : "Không tải được thông báo.");
    } finally { if (version === revision.current.value) setLoading(false); }
  }, [limit, unreadOnly]);

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    const state = revision.current;
    if (loadedFilter.current !== unreadOnly) { loadedFilter.current = unreadOnly; setPage((current) => ({ ...current, data: [], total: 0 })); }
    setLoading(true); void refresh(); return () => { ++state.value; };
  }, [refresh, unreadOnly]);
  useEffect(() => {
    const controller = new AbortController();
    let reconnect: number | undefined;
    let stopped = false;
    let lastVersion = "";
    const connect = async () => {
      let retryDelay = 1000;
      try {
        await validateSession();
        const response = await fetch(`${apiBase}/api/notifications/stream`, { headers: { Authorization: `Bearer ${getAccessToken()}`, Accept: "text/event-stream" }, signal: controller.signal });
        if (response.status === 401) { await validateSession(true); throw new Error("Reconnect"); }
        if (!response.ok || !response.body) throw new Error("Stream unavailable");
        const reader = response.body.getReader();
        const decoder = new TextDecoder(); let buffer = "";
        while (!stopped) {
          const { value, done } = await reader.read(); if (done) break;
          buffer = (buffer + decoder.decode(value, { stream: true })).replace(/\r\n/g, "\n");
          let boundary: number;
          while ((boundary = buffer.indexOf("\n\n")) >= 0) {
            const block = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
            const data = block.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\n");
            if (data && data !== lastVersion) { lastVersion = data; void refreshRef.current(); }
          }
        }
      } catch { retryDelay = 10_000; /* Never put credentials in a URL. */ }
      if (!stopped) reconnect = window.setTimeout(() => { void refreshRef.current(); void connect(); }, retryDelay);
    };
    void connect();
    const sync = () => { if (!document.hidden) void refreshRef.current(); };
    const clock = window.setInterval(() => setClock((value) => value + 1), 60_000);
    window.addEventListener(APP_MUTATION_COMPLETED_EVENT, sync);
    window.addEventListener(NOTIFICATION_COUNT_CHANGED_EVENT, sync);
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    return () => { stopped = true; controller.abort(); window.clearTimeout(reconnect); window.clearInterval(clock); window.removeEventListener(APP_MUTATION_COMPLETED_EVENT, sync); window.removeEventListener(NOTIFICATION_COUNT_CHANGED_EVENT, sync); window.removeEventListener("focus", sync); document.removeEventListener("visibilitychange", sync); };
  }, []);

  useEffect(() => {
    const legacy = () => {
      const url = new URL(window.location.href);
      if (url.searchParams.get("notifications") !== "open") return;
      url.searchParams.delete("notifications");
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
      setUnreadOnly(true); setLimit(20); setOpen(true);
    };
    legacy();
    window.addEventListener("workspace-tab-change", legacy);
    window.addEventListener("popstate", legacy);
    window.addEventListener("racehorse:open-notifications", legacy);
    return () => { window.removeEventListener("workspace-tab-change", legacy); window.removeEventListener("popstate", legacy); window.removeEventListener("racehorse:open-notifications", legacy); };
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const update = () => { const rect = bell.current?.getBoundingClientRect(); if (rect) setPosition({ top: Math.max(8, rect.bottom + 8), right: Math.max(12, window.innerWidth - rect.right) }); };
    update(); void refreshRef.current();
    const frame = requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>("button")?.focus());
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !panel.current?.contains(event.target) && !bell.current?.contains(event.target)) close(); };
    const keys = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close(); }
      if (event.key === "Tab") {
        const elements = [...(panel.current?.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], [tabindex='0']") ?? [])].filter((element) => element.getClientRects().length);
        const first = elements[0], last = elements.at(-1);
        if (!panel.current?.contains(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first)?.focus(); }
        else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener("pointerdown", outside); window.addEventListener("keydown", keys); window.addEventListener("resize", update); window.addEventListener("scroll", update, true);
    return () => { document.body.style.overflow = overflow; cancelAnimationFrame(frame); window.removeEventListener("pointerdown", outside); window.removeEventListener("keydown", keys); window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); };
  }, [open, close]);

  async function mutate(path: string, method: string): Promise<boolean> {
    setBusy(true); setError("");
    try { await authenticatedRequest(path, { method }); await refresh(); window.dispatchEvent(new Event(NOTIFICATION_COUNT_CHANGED_EVENT)); return true; }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Không cập nhật được thông báo."); return false; }
    finally {
      setBusy(false);
      requestAnimationFrame(() => { if (panel.current && !panel.current.contains(document.activeElement)) panel.current.querySelector<HTMLElement>("[role='tab'][aria-selected='true']")?.focus(); });
    }
  }
  async function visit(item: BellNotification) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const target = await authenticatedRequest<NotificationTarget>(`/api/notifications/${encodeURIComponent(item.id)}/target`);
      if (!item.is_read) await authenticatedRequest(`/api/notifications/${encodeURIComponent(item.id)}/read`, { method: "PATCH" });
      await refresh();
      const href = notificationIsAccount(item) && !item.link ? null : notificationHref(item, target, user.roleName);
      close();
      if (href && new URL(href, window.location.origin).pathname === window.location.pathname) {
        window.history.pushState(null, "", href); window.dispatchEvent(new Event("workspace-tab-change"));
      } else if (href) router.push(href);
      window.dispatchEvent(new Event(NOTIFICATION_COUNT_CHANGED_EVENT));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không mở được nội dung thông báo."); }
    finally { setBusy(false); }
  }

  return <>
    <button ref={bell} type="button" className="notification-bell" aria-label={`Thông báo, ${page.unread_count} chưa đọc`} aria-expanded={open} aria-haspopup="dialog" aria-controls={open ? "header-notifications" : undefined} onClick={() => { if (open) close(); else { setUnreadOnly(true); setLimit(20); setOpen(true); } }}>
      <Bell size={18} />{page.unread_count > 0 && <span aria-hidden="true" className="notification-bell-badge">{page.unread_count >= 10 ? "9+" : page.unread_count}</span>}
    </button>
    {open && createPortal(<>
      <div className="notification-sheet-backdrop" aria-hidden="true" onClick={close} />
      <div ref={panel} id="header-notifications" role="dialog" aria-modal="true" aria-label="Thông báo" className="notification-popover" style={{ top: position.top, right: position.right }}>
        <div className="notification-panel-heading"><h2>Thông báo</h2>{page.unread_count > 0 && <button type="button" disabled={busy} onClick={() => void mutate("/api/notifications/read-all", "POST")}><CheckCheck size={14} />Đánh dấu tất cả đã đọc</button>}<button className="notification-mobile-close" type="button" aria-label="Đóng thông báo" onClick={close}><X size={16} /></button></div>
        <div className="notification-tabs" role="tablist" aria-label="Lọc thông báo">
          <button type="button" role="tab" aria-selected={unreadOnly} onClick={() => { setUnreadOnly(true); setLimit(20); }}>Chưa đọc ({page.unread_count})</button>
          <button type="button" role="tab" aria-selected={!unreadOnly} onClick={() => { setUnreadOnly(false); setLimit(20); }}>Tất cả</button>
        </div>
        <div ref={list} onScroll={updateScroll} className={`notification-list ${scrollEdges.top ? "has-scroll-top" : ""} ${scrollEdges.bottom ? "has-scroll-bottom" : ""}`} aria-busy={loading}>
          {error && <div role="alert" className="p-3 text-xs text-rose-700">{error}<button type="button" className="ml-2 underline" onClick={() => void refresh()}>Thử lại</button></div>}
          {loading && !page.data.length ? <p role="status" className="p-6 text-center text-sm text-slate-500"><RefreshCw size={16} className="mr-2 inline animate-spin" />Đang tải…</p> : !page.data.length && !error ? <div className="notification-empty"><BellOff size={32} /><p>Bạn đã xem hết thông báo</p></div> : ["Hôm nay", "Trước đó"].map((group) => {
            const items = page.data.filter((item) => (notificationGroup(item) === "Hôm nay" ? "Hôm nay" : "Trước đó") === group).sort((a, b) => b.created_at.localeCompare(a.created_at));
            return items.length > 0 && <section key={group}><h3 className="notification-group-title">{group}</h3>{items.map((item) => {
              const kind = notificationKind(item), Icon = icons[kind];
              const { title, description } = notificationPresentation(item);
              return <article key={item.id} className={`notification-item ${item.is_read ? "" : "is-unread"}`}>
                <button type="button" disabled={busy} className="notification-item-open" onClick={() => void visit(item)}>
                  {!item.is_read && <span className="notification-unread-dot" aria-label="Chưa đọc" />}
                  <Icon size={18} className={kind === "overdue" || kind === "incident" ? "text-rose-600" : "text-blue-600"} />
                  <span className="min-w-0 flex-1"><strong className="notification-item-title block truncate text-xs">{title}</strong><span className="notification-item-description" title={description}>{description || "Thông tin liên quan đã được cập nhật."}</span><time className="mt-1 block text-[11px] text-slate-400" title={notificationExactTime(item.created_at)} dateTime={item.created_at}>{notificationRelativeTime(item.created_at)}</time></span>
                </button>
                <div className="notification-item-actions">{!item.is_read && <button type="button" aria-label="Đánh dấu đã đọc" title="Đánh dấu đã đọc" disabled={busy} onClick={() => void mutate(`/api/notifications/${encodeURIComponent(item.id)}/read`, "PATCH")}><Check size={14} /></button>}<button type="button" aria-label="Xóa thông báo" title="Xóa" disabled={busy} onClick={() => void mutate(`/api/notifications/${encodeURIComponent(item.id)}`, "DELETE")}><Trash2 size={14} /></button></div>
              </article>;
            })}</section>;
          })}
        </div>
        {(page.data.length < page.total || (unreadOnly && allTotal > page.total)) && <button type="button" className="notification-load-more" disabled={loading || busy} onClick={() => { if (page.data.length < page.total) setLimit((value) => value + 20); else { setUnreadOnly(false); setLimit(20); } }}>Xem thông báo cũ</button>}
      </div>
    </>, document.body)}
  </>;
}
