"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Filter,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  User,
} from "lucide-react";
import { useHorseUser } from "@/components/HorseShell";
import { HorseImage, Modal, Notice, StatusBadge } from "@/components/HorseUI";
import { routeForRole } from "@/lib/roles";
import {
  deleteHorse as deleteHorseApi,
  errorMessage,
  getHorseStables,
  getHorseDeletionWarnings,
  listHorses,
  type Horse,
  type Stable,
} from "@/lib/horses";

export default function HorsesPage() {
  const user = useHorseUser();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [stableFilter, setStableFilter] = useState("ALL");
  const [horses, setHorses] = useState<Horse[]>([]);
  const [stableOptions, setStableOptions] = useState<Stable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteHorse, setDeleteHorse] = useState<Horse | null>(null);
  const [deleteWarning, setDeleteWarning] = useState<{ scheduledTraining: number; medicalRecords: number; activePrescriptions: number } | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([
      listHorses({
        search: search || undefined,
        stableBoxId: stableFilter === "ALL" ? undefined : stableFilter,
        currentStatus: statusFilter === "ALL" ? undefined : statusFilter,
      }),
      getHorseStables(),
    ]).then(([page, stables]) => {
      if (!active) return;
      setHorses(page.items);
      setStableOptions(stables);
    }).catch((reason) => {
      if (active) setError(errorMessage(reason));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [search, stableFilter, statusFilter]);

  const visibleHorses = useMemo(() => {
    const personalOnly = user.roleName === "HORSE_OWNER";
    return horses.filter((horse) => {
      if (personalOnly && horse.owner_id !== user.id) return false;
      const matchesSearch =
        !search ||
        horse.horse_name.toLowerCase().includes(search.toLowerCase()) ||
        (horse.breed ?? "").toLowerCase().includes(search.toLowerCase());
      const matchesStatus =
        statusFilter === "ALL" || horse.current_status === statusFilter;
      const matchesStable =
        stableFilter === "ALL" || horse.stable_box_id === stableFilter;
      return matchesSearch && matchesStatus && matchesStable;
    });
  }, [horses, search, stableFilter, statusFilter, user.id, user.roleName]);

  async function handleDeleteConfirm() {
    if (!deleteHorse) return;
    try {
      await deleteHorseApi(deleteHorse.id);
      setHorses((current) => current.filter((horse) => horse.id !== deleteHorse.id));
      setDeleteHorse(null);
      setDeleteWarning(null);
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }

  async function openDeleteDialog(horse: Horse) {
    setDeleteHorse(horse);
    try {
      setDeleteWarning(await getHorseDeletionWarnings(horse.id));
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }

  return (
    <>
      <main className="min-h-screen bg-equine-paper p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-[1200px]">
          <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-equine-line bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="eyebrow">Flow 1</p>
              <h1 className="mt-2 font-sans text-3xl font-semibold text-equine-navy">
                Quản lý hồ sơ & lý lịch ngựa
              </h1>
            </div>
            {user.roleName === "CLUB_MANAGER" && (
              <Link className="gold-button" href="/horses/new">
                <Plus size={17} /> Thêm ngựa mới
              </Link>
            )}
          </div>

          {user.roleName !== "HORSE_OWNER" && <div className="mb-6 rounded-2xl border border-equine-line bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-equine-navy">Tìm kiếm và lọc hồ sơ</p>
                <p className="text-xs text-slate-500">Có thể kết hợp nhiều điều kiện cùng lúc.</p>
              </div>
              {(searchInput || statusFilter !== "ALL" || stableFilter !== "ALL") && <button type="button" className="text-sm font-semibold text-equine-navy underline" onClick={() => { setSearchInput(""); setSearch(""); setStatusFilter("ALL"); setStableFilter("ALL"); }}>Xóa bộ lọc</button>}
            </div>
            <div className="grid gap-3 md:grid-cols-3">
            <label className="flex items-center gap-3 rounded-xl border border-equine-line bg-[#f7f9ff] px-3 py-2.5">
              <Search size={16} className="text-slate-500" />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                className="w-full border-0 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-500"
                placeholder="Tìm theo tên hoặc giống..."
              />
            </label>

            <label className="flex items-center gap-3 rounded-xl border border-equine-line bg-[#f7f9ff] px-3 py-2.5">
              <Filter size={16} className="text-slate-500" />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="w-full border-0 bg-transparent text-sm text-slate-700 outline-none"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="Healthy">Khỏe mạnh</option>
                <option value="Under Observation">Cần theo dõi</option>
                <option value="Quarantine">Cách ly</option>
                <option value="Injured">Chấn thương</option>
                <option value="Sick">Đang bệnh</option>
              </select>
            </label>

            <label className="flex items-center gap-3 rounded-xl border border-equine-line bg-[#f7f9ff] px-3 py-2.5">
              <ShieldAlert size={16} className="text-slate-500" />
              <select
                value={stableFilter}
                onChange={(event) => setStableFilter(event.target.value)}
                className="w-full border-0 bg-transparent text-sm text-slate-700 outline-none"
              >
                <option value="ALL">Tất cả chuồng</option>
                {stableOptions.map((stable) => (
                  <option key={stable.id} value={stable.id}>
                    {stable.box_code} - {stable.section}
                  </option>
                ))}
              </select>
            </label>
            </div>
          </div>}

          <div className="mb-5 flex items-center justify-between">
            <p className="text-sm text-slate-600">
              Hiển thị <strong>{visibleHorses.length}</strong> hồ sơ
            </p>
          </div>

          {error && <div className="mb-5"><Notice error>{error}</Notice></div>}
          {loading ? (
            <Notice>Đang tải danh sách hồ sơ ngựa...</Notice>
          ) : visibleHorses.length === 0 ? (
            <Notice>
              Không có ngựa phù hợp. Hãy thử tìm kiếm với từ khóa khác hoặc thêm ngựa mới.
            </Notice>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleHorses.map((horse) => {
                        const owner = horse.owner_name ? { full_name: horse.owner_name } : undefined;
                return (
                  <article
                    key={horse.id}
                    className="horse-card overflow-hidden rounded-2xl border border-equine-line bg-white shadow-sm"
                  >
                    <div className="h-52 overflow-hidden rounded-t-2xl bg-[#f7f3ec]">
                      <HorseImage horse={horse} />
                    </div>
                    <div className="space-y-4 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h2 className="font-sans text-xl font-semibold text-equine-navy">
                            {horse.horse_name}
                          </h2>
                          <p className="text-sm text-slate-600">{horse.breed ?? "Chưa cập nhật"}</p>
                        </div>
                        <StatusBadge horse={horse} />
                      </div>

                      <div className="space-y-2 text-sm text-slate-600">
                        <p>
                          <strong>Chuồng:</strong> {horse.box_code ?? horse.stable_box_id}
                        </p>
                        <p>
                          <strong>Chủ sở hữu:</strong> {owner?.full_name ?? "Chưa có"}
                        </p>
                        <p>
                          <strong>Khóa huấn luyện:</strong>{" "}
                          {horse.is_training_locked ? "Có" : "Không"}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2 pt-2">
                        <Link className="soft-button border-equine-line bg-[#f7f9ff] text-equine-navy" href={`/horses/${horse.id}`}>
                          Xem chi tiết
                        </Link>
                        {user.roleName === "CLUB_MANAGER" && (
                          <>
                            <Link className="soft-button border-equine-line bg-white text-slate-700" href={`/horses/${horse.id}/edit`}>
                              <Pencil size={15} /> Sửa
                            </Link>
                            <button
                              type="button"
                              className="soft-button border-red-200 bg-red-50 text-red-600"
                              onClick={() => void openDeleteDialog(horse)}
                            >
                              <Trash2 size={15} /> Xóa
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <div className="mt-8 rounded-2xl border border-dashed border-equine-line bg-white p-5 text-sm text-slate-600">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-equine-navy">
                <User size={18} />
                <span>Quyền truy cập</span>
              </div>
              <Link href={routeForRole(user.roleName)} className="inline-flex items-center gap-2 text-sm font-medium text-equine-navy">
                Về dashboard <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </div>
      </main>

      {deleteHorse && (
        <Modal title="Xác nhận xóa hồ sơ" onClose={() => setDeleteHorse(null)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Bạn đang thực hiện soft delete cho ngựa <strong>{deleteHorse.horse_name}</strong>.
              Hồ sơ lịch sử sẽ được giữ lại và chỉ ẩn khỏi danh sách mặc định.
            </p>
            {deleteWarning && (deleteWarning.scheduledTraining > 0 || deleteWarning.medicalRecords > 0 || deleteWarning.activePrescriptions > 0) && (
              <Notice error>
                Hồ sơ này đang có {deleteWarning.scheduledTraining} lịch tập, {deleteWarning.medicalRecords} hồ sơ y tế và {deleteWarning.activePrescriptions} đơn thuốc đang hoạt động.
              </Notice>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className="soft-button border-equine-line bg-white text-slate-700" onClick={() => setDeleteHorse(null)}>
                Hủy
              </button>
              <button type="button" className="gold-button" onClick={handleDeleteConfirm}>
                Xác nhận xóa
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
