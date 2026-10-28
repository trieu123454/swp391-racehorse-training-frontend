"use client";
import { Routes } from "@/routes/Routes";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Filter,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { useHorseUser } from "@/components/horses/HorseShell";
import { HorseImage, Modal, Notice, StatusBadge } from "@/components/horses/HorseUI";
import HorseRegistrationPanel from "@/components/horse-owner/HorseRegistrationPanel";
import {
  deleteHorse as deleteHorseApi,
  errorMessage,
  getHorseStables,
  getHorseDeletionWarnings,
  listHorses,
  type Horse,
  type Stable,
} from "@/api/horses/api";

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
      <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-[1240px]">
          {/* Header */}
          <div className="mb-6 flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="eyebrow">Hồ sơ chiến mã</p>
              <h1 className="mt-1 font-sans text-2xl font-normal tracking-tight text-slate-900 sm:text-3xl">
                {user.roleName === "HORSE_OWNER" ? "Hồ sơ ngựa của bạn" : "Quản lý hồ sơ & lý lịch ngựa"}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {user.roleName === "HORSE_OWNER"
                  ? "Theo dõi thông tin, cân nặng và trạng thái huấn luyện ngựa của bạn."
                  : "Tra cứu danh sách, trạng thái sức khỏe và phân bổ chuồng trại toàn hệ thống."}
              </p>
            </div>
            {user.roleName === "CLUB_MANAGER" && (
              <Link className="gold-button self-start sm:self-center" href={Routes.horseNew}>
                <Plus size={16} /> Thêm ngựa mới
              </Link>
            )}
          </div>

          {user.roleName === "HORSE_OWNER" && <div className="mb-6"><HorseRegistrationPanel /></div>}

          {/* Filter Bar */}
          <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-normal uppercase tracking-wider text-slate-500">Bộ lọc tìm kiếm</span>
              {(searchInput || statusFilter !== "ALL" || stableFilter !== "ALL") && (
                <button
                  type="button"
                  className="text-xs font-normal text-teal-700 hover:underline"
                  onClick={() => { setSearchInput(""); setSearch(""); setStatusFilter("ALL"); setStableFilter("ALL"); }}
                >
                  Xóa bộ lọc
                </button>
              )}
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="flex items-center gap-2.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus-within:border-slate-800 focus-within:bg-white focus-within:ring-2 focus-within:ring-slate-800/10">
                <Search size={16} className="text-slate-400 shrink-0" />
                <input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  className="w-full border-0 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                  placeholder="Tìm theo tên hoặc giống..."
                />
              </label>

              <label className="flex items-center gap-2.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus-within:border-slate-800 focus-within:bg-white focus-within:ring-2 focus-within:ring-slate-800/10">
                <Filter size={16} className="text-slate-400 shrink-0" />
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="w-full border-0 bg-transparent text-sm text-slate-800 outline-none cursor-pointer"
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="Healthy">Khỏe mạnh</option>
                  <option value="Monitoring">Cần theo dõi</option>
                  <option value="Quarantine">Cách ly</option>
                  <option value="Injured">Chấn thương</option>
                  <option value="Sick">Đang bệnh</option>
                </select>
              </label>

              <label className="flex items-center gap-2.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus-within:border-slate-800 focus-within:bg-white focus-within:ring-2 focus-within:ring-slate-800/10">
                <ShieldAlert size={16} className="text-slate-400 shrink-0" />
                <select
                  value={stableFilter}
                  onChange={(event) => setStableFilter(event.target.value)}
                  className="w-full border-0 bg-transparent text-sm text-slate-800 outline-none cursor-pointer"
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
          </div>

          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs font-normal text-slate-500">
              Hiển thị <strong className="text-slate-800 font-normal">{visibleHorses.length}</strong> hồ sơ ngựa
            </p>
          </div>

          {error && <div className="mb-5"><Notice error>{error}</Notice></div>}

          {loading ? (
            <Notice>Đang tải danh sách hồ sơ ngựa…</Notice>
          ) : visibleHorses.length === 0 ? (
            <Notice>
              Không tìm thấy ngựa phù hợp với tiêu chí lọc. Vui lòng thử từ khóa khác hoặc xóa bộ lọc.
            </Notice>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {visibleHorses.map((horse) => {
                const owner = horse.owner_name ? { full_name: horse.owner_name } : undefined;
                return (
                  <article
                    key={horse.id}
                    className="horse-card overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
                  >
                    <div className="relative h-48 w-full overflow-hidden bg-slate-100">
                      <HorseImage horse={horse} />
                    </div>
                    <div className="space-y-3.5 p-4">
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="min-w-0">
                          <h2 className="truncate font-sans text-lg font-normal text-slate-900">
                            {horse.horse_name}
                          </h2>
                          <p className="truncate text-xs text-slate-500">{horse.breed ?? "Chưa cập nhật giống"}</p>
                        </div>
                        <StatusBadge horse={horse} />
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                        <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100">
                          <span className="block text-[10px] font-normal uppercase tracking-wider text-slate-400">Chuồng</span>
                          <strong className="block truncate font-normal text-slate-800 mt-0.5">{horse.box_code ?? horse.stable_box_id ?? "—"}</strong>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100">
                          <span className="block text-[10px] font-normal uppercase tracking-wider text-slate-400">Chủ sở hữu</span>
                          <strong className="block truncate font-normal text-slate-800 mt-0.5">{owner?.full_name ?? "Chưa có"}</strong>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100">
                          <span className="block text-[10px] font-normal uppercase tracking-wider text-slate-400">Cân nặng</span>
                          <strong className="block truncate font-normal text-slate-800 mt-0.5">{horse.current_weight_kg == null ? "—" : `${horse.current_weight_kg} kg`}</strong>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100">
                          <span className="block text-[10px] font-normal uppercase tracking-wider text-slate-400">Tập luyện</span>
                          <strong className={`block truncate font-normal mt-0.5 ${horse.is_training_locked ? "text-amber-700" : "text-emerald-700"}`}>
                            {horse.is_training_locked ? "Đang khóa" : "Sẵn sàng"}
                          </strong>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                        <Link className="gold-button flex-1 !min-h-[36px] !text-xs" href={Routes.horse(horse.id)}>
                          Xem chi tiết
                        </Link>
                        {user.roleName === "CLUB_MANAGER" && (
                          <>
                            <Link className="soft-button !min-h-[36px] !px-3 !text-xs" href={Routes.horseEdit(horse.id)}>
                              <Pencil size={13} /> Sửa
                            </Link>
                            <button
                              type="button"
                              className="table-delete-button"
                              onClick={() => void openDeleteDialog(horse)}
                              aria-label={`Xóa hồ sơ ${horse.horse_name}`}
                              title={`Xóa hồ sơ ${horse.horse_name}`}
                            >
                              <Trash2 size={14} />
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

        </div>
      </main>

      {deleteHorse && (
        <Modal title="Xác nhận xóa hồ sơ ngựa" onClose={() => setDeleteHorse(null)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-600 leading-relaxed">
              Bạn đang thực hiện xóa mềm (soft delete) cho ngựa <strong className="text-slate-900">{deleteHorse.horse_name}</strong>.
              Hồ sơ lịch sử sẽ được bảo lưu và chỉ ẩn khỏi danh sách hiển thị mặc định.
            </p>
            {deleteWarning && (deleteWarning.scheduledTraining > 0 || deleteWarning.medicalRecords > 0 || deleteWarning.activePrescriptions > 0) && (
              <Notice error>
                Hồ sơ này đang có {deleteWarning.scheduledTraining} lịch tập, {deleteWarning.medicalRecords} hồ sơ y tế và {deleteWarning.activePrescriptions} đơn thuốc đang hoạt động.
              </Notice>
            )}
            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button type="button" className="soft-button !text-xs" onClick={() => setDeleteHorse(null)}>
                Hủy
              </button>
              <button type="button" className="danger-button !text-xs" onClick={handleDeleteConfirm}>
                Xác nhận xóa
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
