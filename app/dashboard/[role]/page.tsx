"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Activity,
  CalendarDays,
  ClipboardList,
  HeartPulse,
  LogOut,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Brand } from "@/components/Brand";
import { logout as logoutApi } from "@/lib/api";
import { roleForSlug, roleLabels, routeForRole } from "@/lib/roles";
import { clearSession, getRefreshToken, getUser } from "@/lib/session";
import type { AuthUser } from "@/lib/types";

export default function RoleDashboardPage() {
  const { role } = useParams<{ role: string }>();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const current = getUser();
    if (!current) {
      router.replace("/login");
      return;
    }
    if (roleForSlug(role) !== current.roleName) {
      router.replace(routeForRole(current.roleName));
      return;
    }
    setUser(current);
  }, [role, router]);

  async function handleLogout() {
    const refreshToken = getRefreshToken();
    try {
      if (refreshToken) await logoutApi(refreshToken);
    } finally {
      clearSession();
      router.replace("/");
    }
  }

  if (!user)
    return (
      <main className="grid min-h-screen place-items-center bg-equine-paper text-sm text-slate-600">
        Đang xác thực quyền truy cập...
      </main>
    );

  return (
    <main className="min-h-screen bg-equine-paper">
      <header className="border-b border-white/10 bg-equine-navy text-white">
        <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12">
          <Link href="/">
            <Brand compact light />
          </Link>
          <button
            className="flex items-center gap-2 rounded-md border border-white/20 px-4 py-2 text-xs font-bold uppercase text-white/80 hover:bg-white/10"
            onClick={handleLogout}
            type="button"
          >
            <LogOut size={16} /> Đăng xuất
          </button>
        </div>
      </header>
      <section className="mx-auto max-w-[1200px] px-5 py-12 sm:px-8">
        <p className="eyebrow">Bảng điều khiển chuyên biệt</p>
        <h1 className="mt-2 font-serif text-4xl font-semibold text-equine-navy">
          Xin chào, {user.fullName}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Bạn đang đăng nhập với vai trò{" "}
          <strong>{roleLabels[user.roleName]}</strong>.
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <Info icon={UserRound} label="Thành viên" value={user.email} />
          <Info
            icon={ShieldCheck}
            label="Vai trò"
            value={roleLabels[user.roleName]}
          />
          <Info
            icon={Activity}
            label="Trạng thái"
            value={user.status === "APPROVED" ? "Đã phê duyệt" : user.status}
          />
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Feature
            icon={CalendarDays}
            title="Lịch làm việc"
            text="Theo dõi lịch trình và nhiệm vụ được phân công."
          />
          <Feature
            icon={ClipboardList}
            title="Hồ sơ chuyên môn"
            text="Truy cập dữ liệu phù hợp với quyền của bạn."
          />
          <Feature
            icon={HeartPulse}
            title="Thông báo hệ thống"
            text="Các cảnh báo quan trọng sẽ xuất hiện tại đây."
          />
        </div>
        <p className="mt-10 rounded-md border border-equine-gold/25 bg-white p-5 text-sm text-slate-600">
          Phần dashboard nghiệp vụ sẽ được phát triển ở giai đoạn tiếp theo.
          Luồng đăng nhập, phân quyền và đăng xuất hiện đã sẵn sàng.
        </p>
      </section>
    </main>
  );
}

function Info({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
}) {
  return (
    <div className="border border-equine-line bg-white p-5">
      <Icon className="text-equine-gold" size={20} />
      <p className="mt-4 text-[10px] font-bold uppercase text-slate-500">
        {label}
      </p>
      <p className="mt-1 break-words font-semibold text-equine-navy">{value}</p>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof UserRound;
  title: string;
  text: string;
}) {
  return (
    <div className="bg-equine-navy p-6 text-white">
      <Icon className="text-equine-champagne" size={22} />
      <h2 className="mt-5 font-serif text-xl">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-white/65">{text}</p>
    </div>
  );
}
