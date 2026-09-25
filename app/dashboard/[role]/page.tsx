"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Activity,
  Filter,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { HorseImage, Notice, StatusBadge } from "@/components/HorseUI";
import HorseShell, { useHorseUser } from "@/components/HorseShell";
import { validateSession } from "@/lib/api";
import { errorMessage, getHorseStables, listHorses, type Horse, type Stable } from "@/lib/horses";
import { roleForSlug, roleLabels, routeForRole } from "@/lib/roles";
import type { AuthUser } from "@/lib/types";

export default function RoleDashboardPage() {
  const { role } = useParams<{ role: string }>();
  const router = useRouter();
  useEffect(() => {
    let active = true;
    validateSession()
      .then((current) => {
        if (!active) return;
        if (roleForSlug(role) !== current.roleName) {
          router.replace(routeForRole(current.roleName));
        }
      })
      .catch(() => {
        if (active) router.replace("/login");
      });
    return () => {
      active = false;
    };
  }, [role, router]);

  return <HorseShell><RoleDashboardContent /></HorseShell>;
}

function RoleDashboardContent() {
  const user = useHorseUser();

  return (
    <section className="dashboard-workspace">
        <p className="eyebrow">Bảng điều khiển chuyên biệt</p>
        <h1 className="mt-2 font-sans text-4xl font-semibold text-equine-navy">
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
        {user.roleName === "CLUB_MANAGER" || user.roleName === "HEAD_TRAINER" || user.roleName === "VETERINARIAN" || user.roleName === "GROOM" || user.roleName === "HORSE_OWNER" ? <HorseDashboardPanel user={user} /> : (
          <div className="mt-10 rounded-md border border-equine-gold/25 bg-white p-5 text-sm text-slate-600">
            Chức năng chuyên môn của vai trò này sẽ được hiển thị tại đây khi phân hệ tương ứng được triển khai.
          </div>
        )}
    </section>
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

function HorseDashboardPanel({ user }: { user: AuthUser }) {
  const [horses, setHorses] = useState<Horse[]>([]);
  const [stables, setStables] = useState<Stable[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [stable, setStable] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      listHorses({ search: search.trim() || undefined, currentStatus: status === "ALL" ? undefined : status, stableBoxId: stable === "ALL" ? undefined : stable }),
      getHorseStables(),
    ]).then(([page, nextStables]) => {
      if (!active) return;
      setHorses(page.items);
      setStables(nextStables);
    }).catch((reason) => { if (active) setError(errorMessage(reason)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [search, stable, status]);

  return (
    <section className="mt-10" aria-labelledby="horse-workspace-title">
      <div className="flex flex-col gap-4 border-b border-equine-line pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Flow 1 · Làm việc trực tiếp</p>
          <h2 id="horse-workspace-title" className="mt-2 font-sans text-3xl font-semibold text-equine-navy">Hồ sơ ngựa</h2>
          <p className="mt-2 text-sm text-slate-600">Danh sách đã được lọc theo quyền của tài khoản này.</p>
        </div>
        {user.roleName === "CLUB_MANAGER" && <Link href="/horses/new" className="gold-button self-start"><Plus size={17} /> Thêm ngựa mới</Link>}
      </div>

      {user.roleName !== "HORSE_OWNER" && <div className="mt-5 grid gap-3 rounded-2xl border border-equine-line bg-white p-4 shadow-sm md:grid-cols-[1.4fr_1fr_1fr]">
        <label className="flex items-center gap-3 rounded-xl border border-equine-line bg-[#f7f9ff] px-3 py-2.5"><Search size={16} className="text-slate-500" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full border-0 bg-transparent text-sm outline-none" placeholder="Tìm theo tên ngựa..." /></label>
        <label className="flex items-center gap-3 rounded-xl border border-equine-line bg-[#f7f9ff] px-3 py-2.5"><Filter size={16} className="text-slate-500" /><select value={status} onChange={(event) => setStatus(event.target.value)} className="w-full border-0 bg-transparent text-sm outline-none"><option value="ALL">Tất cả trạng thái</option><option value="Healthy">Khỏe mạnh</option><option value="Under Observation">Cần theo dõi</option><option value="Injured">Chấn thương</option><option value="Quarantine">Cách ly</option></select></label>
        <select value={stable} onChange={(event) => setStable(event.target.value)} className="rounded-xl border border-equine-line bg-[#f7f9ff] px-3 text-sm outline-none"><option value="ALL">Tất cả chuồng</option>{stables.map((item) => <option key={item.id} value={item.id}>{item.box_code} - {item.section}</option>)}</select>
      </div>}

      <div className="mt-5">{error ? <Notice error>{error}</Notice> : loading ? <Notice>Đang tải hồ sơ ngựa...</Notice> : horses.length === 0 ? <Notice>Chưa có hồ sơ ngựa phù hợp.</Notice> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{horses.map((horse) => <article key={horse.id} className="horse-card overflow-hidden rounded-2xl border border-equine-line bg-white shadow-sm"><div className="h-44 bg-[#eef2ff]"><HorseImage horse={horse} /></div><div className="space-y-3 p-4"><div className="flex items-start justify-between gap-2"><div><h3 className="font-sans text-xl font-semibold text-equine-navy">{horse.horse_name}</h3><p className="text-sm text-slate-600">{horse.breed ?? "Chưa cập nhật"}</p></div><StatusBadge horse={horse} /></div><div className="text-sm text-slate-600"><p><strong>Chuồng:</strong> {horse.box_code ?? horse.stable_box_id}</p><p><strong>Chủ:</strong> {horse.owner_name ?? "Chưa gán"}</p></div><div className="flex flex-wrap gap-2 pt-1"><Link href={`/horses/${horse.id}`} className="soft-button h-10 px-4 text-equine-navy">Xem chi tiết</Link>{user.roleName === "CLUB_MANAGER" && <Link href={`/horses/${horse.id}/edit`} className="soft-button h-10 px-4 text-slate-700"><Pencil size={14} /> Sửa</Link>}</div></div></article>)}</div>}</div>
    </section>
  );
}
