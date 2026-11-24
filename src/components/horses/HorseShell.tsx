"use client";

import { Routes } from "@/routes/Routes";
import { ShieldAlert } from "lucide-react";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { CalendarDays, CheckCircle2, ChevronDown, LogOut, Menu, X } from "lucide-react";
import { useNotificationTarget } from "@/hooks/use-notification-target";
import NotificationBell from "@/components/shared/NotificationBell";
import EquineSidebar from "./EquineSidebar";
import { APP_MUTATION_COMPLETED_EVENT, ApiRequestError, NOTIFICATION_COUNT_CHANGED_EVENT, SESSION_EXPIRED_EVENT, hasValidAccessToken, logout, validateSession } from "@/api/client";
import { getPendingHorseRegistrationCount } from "@/api/club-manager/api";
import { clearSession, getLogoutRefreshToken, getUser } from "@/lib/session";
import { roleLabels, routeForRole } from "@/lib/roles";
import type { AuthUser } from "@/lib/types";
import { workspaceNavigation } from "@/lib/workspace-navigation";
import { Notice } from "./HorseUI";

const UserContext = createContext<AuthUser | null>(null);
export function useHorseUser() { return useContext(UserContext)!; }
type ToastOptions = { variant?: "success" | "warning"; durationMs?: number };
const WorkspaceToastContext = createContext<(message: string, options?: ToastOptions) => void>(() => {});
export function useWorkspaceToast() { return useContext(WorkspaceToastContext); }

export default function HorseShell({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checkedCache, setCheckedCache] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [desktop, setDesktop] = useState(true);
  const closeSidebar = useCallback(() => setOpen(false), []);
  useEffect(() => {
    try { setCollapsed(localStorage.getItem("equine:sidebar-collapsed") === "true"); } catch { /* Storage may be disabled. */ }
    const media = window.matchMedia("(min-width: 1024px)");
    const sync = () => { setDesktop(media.matches); setOpen(false); };
    sync(); media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  const toggleSidebar = () => {
    if (!desktop) { setOpen((current) => !current); return; }
    setCollapsed((current) => {
      try { localStorage.setItem("equine:sidebar-collapsed", String(!current)); } catch { /* Keep the in-memory choice. */ }
      return !current;
    });
  };
  const [signingOut, setSigningOut] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [headerScrolled, setHeaderScrolled] = useState(false);
  useEffect(() => {
    const sync = () => setHeaderScrolled(window.scrollY > 0);
    sync();
    window.addEventListener("scroll", sync, { passive: true });
    return () => window.removeEventListener("scroll", sync);
  }, []);
  const [toastMessage, setToastMessage] = useState("");
  const [toastVariant, setToastVariant] = useState<"success" | "warning">("success");
  const [pendingHorseRequestCount, setPendingHorseRequestCount] = useState(0);
  const [todayLabel, setTodayLabel] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const profileRef = useRef<HTMLDivElement>(null);
  const toastTimerRef = useRef<number | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useNotificationTarget(pathname);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const handleExpiredSession = () => {
      setUser(null);
      router.replace(Routes.login);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpiredSession);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpiredSession);
  }, [router]);
  useEffect(() => {
    const sync = (event?: Event) => {
      setActiveTab(new URLSearchParams(window.location.search).get("tab") ?? "overview");
      setOpen(false);
      if (event && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        document.querySelector(".horse-main")?.animate(
          [{ opacity: 0.85, transform: "translateY(6px)" }, { opacity: 1, transform: "translateY(0)" }],
          { duration: 140, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
        );
      }
    };
    sync();
    window.addEventListener("popstate", sync);
    window.addEventListener("workspace-tab-change", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("workspace-tab-change", sync);
    };
  }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", close);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", close); };
  }, [open]);
  useEffect(() => {
    setTodayLabel(new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh",
    }).format(new Date()));
  }, []);
  const showToast = useCallback((message: string, options?: ToastOptions) => {
    setToastVariant(options?.variant ?? "success");
    setToastMessage(message);
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage("");
      toastTimerRef.current = null;
    }, options?.durationMs ?? 5000);
  }, []);
  const dismissToast = useCallback(() => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = null;
    setToastMessage("");
  }, []);
  useEffect(() => () => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
  }, []);
  const loadHeaderCounts = useCallback(async () => {
    if (user?.roleName === "CLUB_MANAGER") {
      try {
        const pending = await getPendingHorseRegistrationCount();
        setPendingHorseRequestCount(pending.count);
      } catch {
        // Keep the last known count when pending registration count is unavailable.
      }
    }
  }, [user?.roleName]);
  useEffect(() => {
    if (user?.roleName !== "CLUB_MANAGER") return;
    void loadHeaderCounts();
    const refresh = () => void loadHeaderCounts();
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const interval = window.setInterval(refresh, 60_000);
    window.addEventListener(APP_MUTATION_COMPLETED_EVENT, refresh);
    window.addEventListener(NOTIFICATION_COUNT_CHANGED_EVENT, refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener(APP_MUTATION_COMPLETED_EVENT, refresh);
      window.removeEventListener(NOTIFICATION_COUNT_CHANGED_EVENT, refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [loadHeaderCounts, user]);
  useEffect(() => {
    if (!profileOpen) return;
    function closeMenus(event: PointerEvent) {
      if (profileOpen && !profileRef.current?.contains(event.target as Node)) setProfileOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setProfileOpen(false);
      }
    }
    document.addEventListener("pointerdown", closeMenus);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeMenus);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [profileOpen]);
  useEffect(() => {
    let active = true;
    let cachedUser: AuthUser | null = null;
    try {
      cachedUser = getUser();
      if (cachedUser?.mustChangePassword) {
        setCheckedCache(true);
        router.replace(Routes.changePassword);
        return () => { active = false; };
      }
      if (
        hasValidAccessToken() &&
        cachedUser?.status === "APPROVED" &&
        ["CLUB_MANAGER", "HEAD_TRAINER", "VETERINARIAN", "HEAD_VETERINARIAN", "GROOM", "HORSE_OWNER"].includes(cachedUser.roleName)
      ) {
        setUser(cachedUser);
      }
    } catch {
      cachedUser = null;
    }
    setCheckedCache(true);
    setError("");
    validateSession().then(current => {
      if (!active) return;
      if (current.mustChangePassword) {
        setUser(null);
        router.replace(Routes.changePassword);
        return;
      }
      if (current.status !== "APPROVED" || !["CLUB_MANAGER", "HEAD_TRAINER", "VETERINARIAN", "HEAD_VETERINARIAN", "GROOM", "HORSE_OWNER"].includes(current.roleName)) {
        setUser(null);
        setError("Tài khoản của bạn chưa có quyền truy cập quản lý ngựa.");
        return;
      }
      setUser(current);
    }).catch(reason => {
      if (!active) return;
      if (reason instanceof ApiRequestError && [400, 401, 403].includes(reason.status)) {
        setUser(null);
        router.replace(Routes.login);
      } else if (!cachedUser || !hasValidAccessToken()) {
        setUser(null);
        setError("Không thể xác thực quyền truy cập. Vui lòng kiểm tra kết nối và thử lại.");
      }
    });
    return () => { active = false; };
  }, [router, attempt]);

  useEffect(() => {
    if (!user) return;
    const legacy = () => {
      const url = new URL(window.location.href);
      if (url.searchParams.get("tab") !== "notifications" && !url.pathname.endsWith("/notifications")) return;
      const href = `${routeForRole(user.roleName)}?notifications=open`;
      if (url.pathname === routeForRole(user.roleName)) {
        window.history.replaceState(null, "", href);
        window.dispatchEvent(new Event("workspace-tab-change"));
      } else router.replace(href);
    };
    legacy(); window.addEventListener("workspace-tab-change", legacy); window.addEventListener("popstate", legacy);
    return () => { window.removeEventListener("workspace-tab-change", legacy); window.removeEventListener("popstate", legacy); };
  }, [user, pathname, router]);

  function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    const token = getLogoutRefreshToken();
    setUser(null);
    clearSession();
    router.replace(Routes.login);
    if (token) void logout(token).catch(() => {});
  }

  if (!user) {
    return (
      <main className="horse-access" aria-busy={!error}>
        {error ? (
          <>
            <Notice error>{error}</Notice>
            <button className="navy-button" onClick={() => setAttempt(value => value + 1)}>Thử lại</button>
            <Link href={Routes.dashboard}>Về bảng điều khiển</Link>
          </>
        ) : checkedCache ? (
          <p role="status">Đang xác thực quyền truy cập…</p>
        ) : null}
      </main>
    );
  }

  const dashboardRoute = routeForRole(user.roleName);
  const isDashboard = pathname === dashboardRoute;
  const navigation = workspaceNavigation[user.roleName];
  const currentLabel = isDashboard
    ? (navigation.find(item => item.id === activeTab)?.label ?? navigation[0].label)
    : pathname?.startsWith(Routes.horses)
      ? "Hồ sơ ngựa"
      : "Quản lý tài khoản";


  return <UserContext.Provider value={user}><WorkspaceToastContext.Provider value={showToast}><div className="horse-app" data-role={user.roleName}>
    <a className="skip-link" href="#workspace-content">Đến nội dung chính</a>
    <EquineSidebar user={user} collapsed={collapsed} desktop={desktop} open={open} pathname={pathname ?? ""} activeTab={activeTab} pendingRequests={pendingHorseRequestCount} signingOut={signingOut} onClose={closeSidebar} onSignOut={signOut} />
    <div className="horse-workspace">
      <header className={`horse-topbar${headerScrolled ? " is-scrolled" : ""}`}>
        <div className="horse-topbar-welcome">
          <button className="equine-sidebar-toggle horse-icon-button" aria-label={desktop ? (collapsed ? "Mở rộng menu" : "Thu gọn menu") : (open ? "Đóng menu" : "Mở menu")} aria-expanded={desktop ? !collapsed : open} aria-controls="equine-sidebar" onClick={toggleSidebar}><Menu /></button>
          <div className="horse-greeting-copy"><h1>{currentLabel}</h1></div>
        </div>
        <div className="horse-topbar-actions">
          <span className="horse-date-pill"><CalendarDays size={16} /><span>{todayLabel || "Hôm nay"}</span></span>
          <NotificationBell key={user.id} user={user} />
          <div className="horse-profile-menu" ref={profileRef}>
            <button type="button" className="horse-profile-trigger" aria-expanded={profileOpen} onClick={() => {  setProfileOpen(value => !value); }}>
              <span className="horse-profile-avatar">{user.fullName.slice(0, 1).toUpperCase()}</span>
              <span className="horse-profile-copy"><strong>{user.fullName}</strong><small>{roleLabels[user.roleName]}</small></span>
              <ChevronDown size={16} />
            </button>
            {profileOpen && <div id="horse-profile-panel" className="horse-profile-popover"><strong>{user.fullName}</strong><span>{user.email}</span><button type="button" disabled={signingOut} onClick={signOut}><LogOut size={15} />{signingOut ? "Đang đăng xuất…" : "Đăng xuất"}</button></div>}
          </div>
        </div>
      </header>
      {toastMessage && <div role="status" aria-live="polite" className={`fixed right-4 top-[5.75rem] z-[80] flex w-[calc(100vw_-_2rem)] max-w-md items-start gap-3 rounded-lg border bg-white px-4 py-3 text-sm shadow-xl sm:right-6 ${toastVariant === "warning" ? "border-amber-300 text-amber-950" : "border-emerald-200 text-emerald-950"}`}>
        {toastVariant === "warning" ? <ShieldAlert size={18} className="mt-0.5 shrink-0 text-amber-600" /> : <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" />}
        <p className="min-w-0 max-h-[60vh] flex-1 overflow-y-auto whitespace-pre-line">{toastMessage}</p>
        <button type="button" className="shrink-0 rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Đóng thông báo" onClick={dismissToast}><X size={15} /></button>
      </div>}
      <main id="workspace-content" className="horse-main" key={pathname}>{children}</main>
    </div>
  </div></WorkspaceToastContext.Provider></UserContext.Provider>;
}
