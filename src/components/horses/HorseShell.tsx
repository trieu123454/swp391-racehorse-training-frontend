"use client";

import { Routes } from "@/routes/Routes";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Activity, ArrowUpRight, Bell, BookOpen, Boxes, CalendarDays, CheckCircle2, ChevronDown, ClipboardList, FilePlus2, HeartPulse, History, House, LayoutDashboard, LogOut, Menu, Shield, Stethoscope, Trophy, Users, Utensils, Wallet, Warehouse, X } from "lucide-react";
import { Brand } from "@/components/shared/Brand";
import { APP_MUTATION_COMPLETED_EVENT, ApiRequestError, NOTIFICATION_COUNT_CHANGED_EVENT, SESSION_EXPIRED_EVENT, authenticatedRequest, logout, validateSession } from "@/api/client";
import { clearSession, getLogoutRefreshToken, getUser } from "@/lib/session";
import { roleLabels, routeForRole } from "@/lib/roles";
import type { AuthUser } from "@/lib/types";
import { workspaceNavigation } from "@/lib/workspace-navigation";
import { Notice } from "./HorseUI";

const UserContext = createContext<AuthUser | null>(null);
export function useHorseUser() { return useContext(UserContext)!; }
const WorkspaceToastContext = createContext<(message: string) => void>(() => {});
export function useWorkspaceToast() { return useContext(WorkspaceToastContext); }

export default function HorseShell({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checkedCache, setCheckedCache] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [todayLabel, setTodayLabel] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const profileRef = useRef<HTMLDivElement>(null);
  const toastTimerRef = useRef<number | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const currentPathname = pathname ?? "";

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
          [{ opacity: 0, transform: "translateY(48px)" }, { opacity: 1, transform: "translateY(0)" }],
          { duration: 200, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
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
  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage("");
      toastTimerRef.current = null;
    }, 5000);
  }, []);
  const dismissToast = useCallback(() => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = null;
    setToastMessage("");
  }, []);
  useEffect(() => () => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
  }, []);
  const loadUnreadNotificationCount = useCallback(async () => {
    try {
      const result = await authenticatedRequest<{ unread_count: number }>("/api/notifications?page=1&limit=1");
      setUnreadNotificationCount(result.unread_count);
    } catch {
      // Keep the last known count when notifications are temporarily unavailable.
    }
  }, []);
  useEffect(() => {
    if (!user) return;
    void loadUnreadNotificationCount();
    const refresh = () => void loadUnreadNotificationCount();
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
  }, [loadUnreadNotificationCount, user]);
  useEffect(() => {
    if (!profileOpen) return;
    function closeProfile(event: PointerEvent) {
      if (!profileRef.current?.contains(event.target as Node)) setProfileOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setProfileOpen(false);
    }
    document.addEventListener("pointerdown", closeProfile);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeProfile);
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
      if (reason instanceof ApiRequestError && reason.status === 401) {
        setUser(null);
        router.replace(Routes.login);
      } else if (!cachedUser) {
        setError("Không thể xác thực quyền truy cập. Vui lòng kiểm tra kết nối và thử lại.");
      }
    });
    return () => { active = false; };
  }, [router, attempt]);

  function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    const token = getLogoutRefreshToken();
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

  const icons: Record<string, typeof Activity> = { overview: LayoutDashboard, stables: Warehouse, plans: BookOpen, calendar: CalendarDays, simulation: Activity, analysis: Activity, races: Trophy, incidents: Shield, care: ClipboardList, inventory: Boxes, finance: Wallet, audit: History, exams: Stethoscope, medical: HeartPulse, diet: Utensils, injuries: HeartPulse, notifications: Bell, horses: BookOpen, health: HeartPulse, training: CalendarDays };
  const dashboardRoute = routeForRole(user.roleName);
  const isDashboard = pathname === dashboardRoute;
  const navigation = workspaceNavigation[user.roleName];
  const currentLabel = isDashboard ? navigation.find(item => item.id === activeTab)?.label ?? navigation[0].label : pathname?.startsWith(Routes.horses) ? "Hồ sơ ngựa" : "Quản lý tài khoản";

  function openNotifications() {
    const targetTab = navigation.find(item => item.id === "notifications")?.id ?? "overview";
    const targetHref = Routes.dashboardTab(dashboardRoute, targetTab);
    if (pathname === dashboardRoute) {
      if (`${window.location.pathname}${window.location.search}` === targetHref) {
        document.getElementById("notification-center")?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      window.history.pushState(null, "", targetHref);
      window.dispatchEvent(new Event("workspace-tab-change"));
      return;
    }
    router.push(targetHref);
  }

  return <UserContext.Provider value={user}><WorkspaceToastContext.Provider value={showToast}><div className="horse-app" data-role={user.roleName}>
    <a className="skip-link" href="#workspace-content">Đến nội dung chính</a>
    {open && <button className="horse-nav-overlay" aria-label="Đóng menu" onClick={() => setOpen(false)} />}
    <aside className={`horse-sidebar ${open ? "is-open" : ""}`}>
      <div className="horse-sidebar-header shrink-0">
        <Link href={Routes.home} className="horse-brand" aria-label="Equine - Về trang chủ"><Brand /></Link>
        <button className="horse-mobile-close horse-icon-button" aria-label="Đóng menu" onClick={() => setOpen(false)}><X /></button>
        <div className="workspace-role"><strong>{roleLabels[user.roleName]}</strong></div>
      </div>
      <div className="horse-sidebar-scroll flex-1 min-h-0 overflow-y-auto">
        <p className="horse-nav-label">CÔNG VIỆC</p>
        <nav aria-label="Điều hướng quản lý">
          {navigation.map(item => {
            const Icon = icons[item.id] ?? LayoutDashboard;
            const selected = isDashboard && (navigation.some(entry => entry.id === activeTab) ? activeTab : "overview") === item.id;
            const href = Routes.dashboardTab(dashboardRoute, item.id);
            return <Link key={item.id} href={href} className={selected ? "active" : ""} aria-current={selected ? "page" : undefined} onClick={event => {
              if (!isDashboard || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
              event.preventDefault();
              if (window.location.pathname + window.location.search !== href) window.history.pushState(null, "", href);
              window.dispatchEvent(new Event("workspace-tab-change"));
            }}><Icon size={18} /><span>{item.label}</span></Link>;
          })}
        </nav>
        <p className="horse-nav-label">QUẢN LÝ CHUNG</p>
        <nav aria-label="Hồ sơ và hệ thống">
          {user.roleName === "HORSE_OWNER" ? (
            <Link href={Routes.horses} className={`owner-registration-nav ${currentPathname.startsWith(Routes.horses) ? "active" : ""}`} aria-current={currentPathname.startsWith(Routes.horses) ? "page" : undefined}>
              <span className="owner-registration-nav-icon"><FilePlus2 size={17} /></span>
              <span className="owner-registration-nav-copy"><strong>Yêu cầu hồ sơ</strong></span>
              <ArrowUpRight className="owner-registration-nav-arrow" size={15} />
            </Link>
          ) : (
            <Link href={Routes.horses} className={currentPathname.startsWith(Routes.horses) ? "active" : ""} aria-current={currentPathname.startsWith(Routes.horses) ? "page" : undefined}><BookOpen size={18} />Hồ sơ ngựa</Link>
          )}
          {user.roleName === "CLUB_MANAGER" && <Link href={Routes.clubManagerUsers} className={currentPathname.startsWith(Routes.clubManagerUsers) ? "active" : ""} aria-current={currentPathname.startsWith(Routes.clubManagerUsers) ? "page" : undefined}><Users size={18} />Quản lý tài khoản</Link>}
          <Link href={Routes.home}><House size={18} />Trang chủ</Link>
        </nav>
      </div>
      <div className="horse-sidebar-footer shrink-0 mt-auto">
        <div className="horse-account"><span className="horse-avatar">{user.fullName.slice(0, 1).toUpperCase()}</span><div><strong>{user.fullName}</strong><small>{roleLabels[user.roleName]}</small></div><button aria-label={signingOut ? "Đang đăng xuất" : "Đăng xuất"} title={signingOut ? "Đang đăng xuất" : "Đăng xuất"} disabled={signingOut} onClick={signOut}><LogOut size={18} /></button></div>
      </div>
    </aside>
    <div className="horse-workspace">
      <header className="horse-topbar">
        <div className="horse-topbar-welcome">
          <button className="horse-mobile-menu horse-icon-button" aria-label="Mở menu" aria-expanded={open} onClick={() => setOpen(true)}><Menu /></button>
          <div className="horse-greeting-copy"><h1>{currentLabel}</h1></div>
        </div>
        <div className="horse-topbar-actions">
          <span className="horse-date-pill"><CalendarDays size={16} /><span>{todayLabel || "Hôm nay"}</span></span>
          <button type="button" onClick={openNotifications} className="relative grid h-10 w-10 shrink-0 place-items-center rounded-md border border-slate-200 bg-white text-equine-navy transition-colors hover:bg-slate-50" aria-label={`Thông báo: ${unreadNotificationCount} chưa đọc`} title="Mở thông báo">
            <Bell size={18} />
            <span aria-hidden="true" className={`absolute -right-1 -top-1 min-w-5 rounded-full px-1 text-center text-[10px] font-bold leading-5 ${unreadNotificationCount > 0 ? "bg-rose-600 text-white" : "bg-slate-200 text-slate-600"}`}>{unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}</span>
          </button>
          <div className="horse-profile-menu" ref={profileRef}>
            <button type="button" className="horse-profile-trigger" aria-expanded={profileOpen} onClick={() => setProfileOpen(value => !value)}>
              <span className="horse-profile-avatar">{user.fullName.slice(0, 1).toUpperCase()}</span>
              <span className="horse-profile-copy"><strong>{user.fullName}</strong><small>{roleLabels[user.roleName]}</small></span>
              <ChevronDown size={16} />
            </button>
            {profileOpen && <div id="horse-profile-panel" className="horse-profile-popover"><strong>{user.fullName}</strong><span>{user.email}</span><button type="button" disabled={signingOut} onClick={signOut}><LogOut size={15} />{signingOut ? "Đang đăng xuất…" : "Đăng xuất"}</button></div>}
          </div>
        </div>
      </header>
      {toastMessage && <div role="status" aria-live="polite" className="fixed right-4 top-[5.75rem] z-[80] flex w-[calc(100vw_-_2rem)] max-w-md items-start gap-3 rounded-lg border border-emerald-200 bg-white px-4 py-3 text-sm text-emerald-950 shadow-xl sm:right-6">
        <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" />
        <p className="min-w-0 flex-1">{toastMessage}</p>
        <button type="button" className="shrink-0 rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Đóng thông báo" onClick={dismissToast}><X size={15} /></button>
      </div>}
      <main id="workspace-content" className="horse-main" key={pathname}>{children}</main>
    </div>
  </div></WorkspaceToastContext.Provider></UserContext.Provider>;
}
