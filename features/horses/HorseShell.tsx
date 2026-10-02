"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { CalendarDays, ChevronDown, LayoutDashboard, LogOut, Menu, Shield, X } from "lucide-react";
import { Brand } from "@/shared/components/Brand";
import { ApiRequestError, logout, validateSession } from "@/lib/api";
import { clearSession, getRefreshToken, getUser } from "@/lib/session";
import { roleLabels, routeForRole } from "@/lib/roles";
import type { AuthUser } from "@/lib/types";
import { Notice } from "./HorseUI";

const UserContext = createContext<AuthUser | null>(null);
export function useHorseUser() { return useContext(UserContext)!; }

export default function HorseShell({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [todayLabel, setTodayLabel] = useState("");
  const profileRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    setTodayLabel(new Intl.DateTimeFormat("vi-VN", {
      weekday: "long", day: "2-digit", month: "long", year: "numeric",
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
        router.replace("/change-password");
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
        router.replace("/change-password");
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
        router.replace("/login");
      } else if (!cachedUser) {
        setError("Không thể xác thực quyền truy cập. Vui lòng kiểm tra kết nối và thử lại.");
      }
    });
    return () => { active = false; };
  }, [router, attempt]);

  async function signOut() {
    try {
      const token = getRefreshToken();
      if (token) await logout(token);
    } finally {
      clearSession();
      router.replace("/login");
    }
  }

  if (!user) return <main className="horse-access">{error ? <><Notice error>{error}</Notice><button className="navy-button" onClick={() => setAttempt(value => value + 1)}>Thử lại</button><Link href="/dashboard">Về bảng điều khiển</Link></> : <p role="status">Đang xác thực quyền truy cập…</p>}</main>;

  return <UserContext.Provider value={user}><div className="horse-app">
    {open && <button className="horse-nav-overlay" aria-label="Đóng menu" onClick={() => setOpen(false)} />}
    <aside className={`horse-sidebar ${open ? "is-open" : ""}`}>
      <Link href="/" className="horse-brand"><Brand compact /></Link>
      <button className="horse-mobile-close horse-icon-button" aria-label="Đóng menu" onClick={() => setOpen(false)}><X /></button>
      <p className="horse-nav-label">TỔNG QUAN</p>
      <nav aria-label="Điều hướng quản lý">
        <Link href={routeForRole(user.roleName)} className={pathname.startsWith("/dashboard") ? "active" : ""} aria-current={pathname.startsWith("/dashboard") ? "page" : undefined}><LayoutDashboard size={19} />Bảng điều khiển</Link>
        <Link href="/horses" className={pathname.startsWith("/horses") ? "active" : ""} aria-current={pathname.startsWith("/horses") ? "page" : undefined}><Shield size={19} />Quản lý ngựa</Link>
        {user.roleName === "CLUB_MANAGER" && <Link href="/club-manager/users" className={pathname.startsWith("/club-manager") ? "active" : ""} aria-current={pathname.startsWith("/club-manager") ? "page" : undefined}><Shield size={19} />Quản lý tài khoản</Link>}
      </nav>
      <div className="horse-sidebar-note"><Shield size={25} /><p>Mỗi hồ sơ.<br />Một hành trình.</p><small>Quản lý lý lịch và phả hệ ngựa tại câu lạc bộ.</small></div>
      <div className="horse-account"><span className="horse-avatar">{user.fullName.slice(0, 1).toUpperCase()}</span><div><strong>{user.fullName}</strong><small>{roleLabels[user.roleName]}</small></div><button aria-label="Đăng xuất" title="Đăng xuất" onClick={() => void signOut().catch(() => {})}><LogOut size={18} /></button></div>
    </aside>
    <div className="horse-workspace">
      <header className="horse-topbar">
        <div className="horse-topbar-welcome">
          <button className="horse-mobile-menu horse-icon-button" aria-label="Mở menu" aria-expanded={open} onClick={() => setOpen(true)}><Menu /></button>
          <span className="horse-greeting-mark" aria-hidden="true">👋</span>
          <div className="horse-greeting-copy"><h1>Xin chào, {user.fullName}</h1><p>Chào mừng trở lại! Cùng quản lý và chăm sóc những chú ngựa của bạn.</p></div>
        </div>
        <div className="horse-topbar-actions">
          <span className="horse-date-pill"><CalendarDays size={16} /><span>{todayLabel || "Hôm nay"}</span></span>
          <div className="horse-profile-menu" ref={profileRef}>
            <button type="button" className="horse-profile-trigger" aria-expanded={profileOpen} onClick={() => setProfileOpen(value => !value)}>
              <span className="horse-profile-avatar">{user.fullName.slice(0, 1).toUpperCase()}</span>
              <span className="horse-profile-copy"><strong>{user.fullName}</strong><small>{roleLabels[user.roleName]}</small></span>
              <ChevronDown size={16} />
            </button>
            {profileOpen && <div id="horse-profile-panel" className="horse-profile-popover"><strong>{user.fullName}</strong><span>{user.email}</span><button type="button" onClick={() => { setProfileOpen(false); void signOut().catch(() => {}); }}><LogOut size={15} />Đăng xuất</button></div>}
          </div>
        </div>
      </header>
      <main className="horse-main">{children}</main>
      <footer className="horse-footer">EQUINE SOVEREIGN <span>Hồ sơ & lịch ngựa</span></footer>
    </div>
  </div></UserContext.Provider>;
}
