"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { ArrowUpRight, LayoutDashboard, LogOut, Menu, Shield, X } from "lucide-react";
import { Brand } from "./Brand";
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
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    let active = true;
    let cachedUser: AuthUser | null = null;
    try {
      cachedUser = getUser();
      if (cachedUser?.status === "APPROVED") setUser(cachedUser);
    } catch {
      cachedUser = null;
    }
    setError("");
    validateSession().then(current => {
      if (!active) return;
      if (current.status !== "APPROVED" || !["CLUB_MANAGER", "HEAD_TRAINER", "VETERINARIAN", "GROOM", "HORSE_OWNER"].includes(current.roleName)) {
        setUser(null);
        setError("Tài khoản của bạn chưa có quyền truy cập quản lý ngựa."); return;
      }
      setUser(current);
    }).catch(err => {
      if (!active) return;
      if (err instanceof ApiRequestError && err.status === 401) {
        setUser(null);
        router.replace("/login");
      } else if (!cachedUser) {
        setError("Không thể xác thực quyền truy cập. Vui lòng kiểm tra kết nối và thử lại.");
      }
    });
    return () => { active = false; };
  }, [router, attempt]);
  async function signOut() {
    try { const token = getRefreshToken(); if (token) await logout(token); }
    finally { clearSession(); router.replace("/login"); }
  }
  if (!user) return <main className="horse-access">{error ? <><Notice error>{error}</Notice><button className="navy-button" onClick={() => setAttempt(x => x + 1)}>Thử lại</button><Link href="/dashboard">Về bảng điều khiển</Link></> : <p role="status">Đang xác thực quyền truy cập…</p>}</main>;
  return <UserContext.Provider value={user}><div className="horse-app">
    {open && <button className="horse-nav-overlay" aria-label="Đóng menu" onClick={() => setOpen(false)} />}
    <aside className={`horse-sidebar ${open ? "is-open" : ""}`}>
      <Link href="/" className="horse-brand"><Brand compact light /></Link>
      <button className="horse-mobile-close horse-icon-button" aria-label="Đóng menu" onClick={() => setOpen(false)}><X /></button>
      <p className="horse-nav-label">KHÔNG GIAN QUẢN LÝ</p>
      <nav aria-label="Điều hướng quản lý"><Link href={routeForRole(user.roleName)} className={pathname.startsWith("/dashboard") ? "active" : ""} aria-current={pathname.startsWith("/dashboard") ? "page" : undefined}><LayoutDashboard size={19} />Bảng điều khiển</Link><Link href="/horses" className={pathname.startsWith("/horses") ? "active" : ""} aria-current={pathname.startsWith("/horses") ? "page" : undefined}><Shield size={19} />Quản lý ngựa</Link>{user.roleName === "CLUB_MANAGER" && <Link href="/club-manager/users" className={pathname.startsWith("/club-manager") ? "active" : ""} aria-current={pathname.startsWith("/club-manager") ? "page" : undefined}><Shield size={19} />Quản lý tài khoản</Link>}</nav>
      <div className="horse-sidebar-note"><Shield size={25} /><p>Mỗi hồ sơ.<br />Một hành trình.</p><small>Quản lý lý lịch và phả hệ ngựa tại câu lạc bộ.</small></div>
      <div className="horse-account"><span className="horse-avatar">{user.fullName.slice(0, 1).toUpperCase()}</span><div><strong>{user.fullName}</strong><small>{roleLabels[user.roleName]}</small></div><button aria-label="Đăng xuất" title="Đăng xuất" onClick={() => void signOut().catch(() => {})}><LogOut size={18} /></button></div>
    </aside>
    <div className="horse-workspace"><header className="horse-topbar"><button className="horse-mobile-menu horse-icon-button" aria-label="Mở menu" aria-expanded={open} onClick={() => setOpen(true)}><Menu /></button><div><span>Equine Sovereign</span><b>/</b><strong>{pathname.startsWith("/club-manager") ? "Quản lý tài khoản" : pathname.startsWith("/dashboard") ? "Bảng điều khiển" : "Quản lý ngựa"}</strong></div><Link href="/">Trang chủ <ArrowUpRight size={15} /></Link></header>
      <main className="horse-main">{children}</main><footer className="horse-footer">EQUINE SOVEREIGN <span>Hồ sơ & lý lịch ngựa</span></footer>
    </div>
  </div></UserContext.Provider>;
}
