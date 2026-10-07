"use client";

import { Routes } from "@/routes/Routes";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Activity, Bell, BookOpen, Boxes, CalendarDays, ChevronDown, ClipboardList, HeartPulse, History, House, LayoutDashboard, LogOut, Menu, Shield, Stethoscope, Trophy, Users, Utensils, Wallet, X } from "lucide-react";
import { Brand } from "@/components/shared/Brand";
import { ApiRequestError, SESSION_EXPIRED_EVENT, logout, validateSession } from "@/api/client";
import { clearSession, getLogoutRefreshToken, getUser } from "@/lib/session";
import { roleLabels, routeForRole } from "@/lib/roles";
import type { AuthUser } from "@/lib/types";
import { workspaceNavigation } from "@/lib/workspace-navigation";
import { Notice } from "./HorseUI";

const UserContext = createContext<AuthUser | null>(null);
export function useHorseUser() { return useContext(UserContext)!; }

export default function HorseShell({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [todayLabel, setTodayLabel] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const profileRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

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
    const sync = () => {
      setActiveTab(new URLSearchParams(window.location.search).get("tab") ?? "overview");
      setOpen(false);
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        document.querySelector(".horse-main")?.animate(
          [{ opacity: 0.55, transform: "translateY(5px)" }, { opacity: 1, transform: "translateY(0)" }],
          { duration: 220, easing: "ease-out" },
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
        router.replace(Routes.changePassword);
        return () => { active = false; };
      }
      if (cachedUser?.status === "APPROVED") setUser(cachedUser);
    } catch {
      cachedUser = null;
    }
    setError("");
    validateSession().then(current => {
      if (!active) return;
      if (current.mustChangePassword) {
        setUser(null);
        router.replace(Routes.changePassword);
        return;
      }
      if (current.status !== "APPROVED" || !["CLUB_MANAGER", "HEAD_TRAINER", "VETERINARIAN", "GROOM", "HORSE_OWNER"].includes(current.roleName)) {
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

  if (!user) return <main className="horse-access">{error ? <><Notice error>{error}</Notice><button className="navy-button" onClick={() => setAttempt(value => value + 1)}>Thử lại</button><Link href={Routes.dashboard}>Về bảng điều khiển</Link></> : <p role="status">Đang xác thực quyền truy cập…</p>}</main>;

  const icons: Record<string, typeof Activity> = { overview: LayoutDashboard, plans: BookOpen, calendar: CalendarDays, simulation: Activity, analysis: Activity, races: Trophy, incidents: Shield, care: ClipboardList, inventory: Boxes, finance: Wallet, audit: History, exams: Stethoscope, medical: HeartPulse, diet: Utensils, injuries: HeartPulse, notifications: Bell, horses: BookOpen, health: HeartPulse, training: CalendarDays };
  const dashboardRoute = routeForRole(user.roleName);
  const isDashboard = pathname === dashboardRoute;
  const navigation = workspaceNavigation[user.roleName];
  const currentLabel = isDashboard ? navigation.find(item => item.id === activeTab)?.label ?? navigation[0].label : pathname.startsWith(Routes.horses) ? "Hồ sơ ngựa" : "Quản lý tài khoản";

  return <UserContext.Provider value={user}><div className="horse-app" data-role={user.roleName}>
    <a className="skip-link" href="#workspace-content">Đến nội dung chính</a>
    {open && <button className="horse-nav-overlay" aria-label="Đóng menu" onClick={() => setOpen(false)} />}
    <aside className={`horse-sidebar ${open ? "is-open" : ""}`}>
      <Link href={Routes.home} className="horse-brand"><Brand compact /></Link>
      <button className="horse-mobile-close horse-icon-button" aria-label="Đóng menu" onClick={() => setOpen(false)}><X /></button>
      <div className="workspace-role"><span>KHÔNG GIAN LÀM VIỆC</span><strong>{roleLabels[user.roleName]}</strong></div>
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
        <Link href={Routes.horses} className={pathname.startsWith(Routes.horses) ? "active" : ""} aria-current={pathname.startsWith(Routes.horses) ? "page" : undefined}><BookOpen size={18} />Hồ sơ ngựa</Link>
        {user.roleName === "CLUB_MANAGER" && <Link href={Routes.clubManagerUsers} className={pathname.startsWith(Routes.clubManagerUsers) ? "active" : ""} aria-current={pathname.startsWith(Routes.clubManagerUsers) ? "page" : undefined}><Users size={18} />Quản lý tài khoản</Link>}
        <Link href={Routes.home}><House size={18} />Trang chủ</Link>
      </nav>
      <div className="horse-account"><span className="horse-avatar">{user.fullName.slice(0, 1).toUpperCase()}</span><div><strong>{user.fullName}</strong><small>{roleLabels[user.roleName]}</small></div><button aria-label={signingOut ? "Đang đăng xuất" : "Đăng xuất"} title={signingOut ? "Đang đăng xuất" : "Đăng xuất"} disabled={signingOut} onClick={signOut}><LogOut size={18} /></button></div>
    </aside>
    <div className="horse-workspace">
      <header className="horse-topbar">
        <div className="horse-topbar-welcome">
          <button className="horse-mobile-menu horse-icon-button" aria-label="Mở menu" aria-expanded={open} onClick={() => setOpen(true)}><Menu /></button>
          <div className="horse-greeting-copy"><p>{roleLabels[user.roleName]}</p><h1>{currentLabel}</h1></div>
        </div>
        <div className="horse-topbar-actions">
          <span className="horse-date-pill"><CalendarDays size={16} /><span>{todayLabel || "Hôm nay"}</span></span>
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
      <main id="workspace-content" className="horse-main" key={pathname}>{children}</main>
      <footer className="horse-footer">Equine <span>Chăm sóc tận tâm. Vươn xa trên đường đua.</span></footer>
    </div>
  </div></UserContext.Provider>;
}
