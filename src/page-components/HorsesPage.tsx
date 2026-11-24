"use client";
import { Routes } from "@/routes/Routes";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { APP_MUTATION_COMPLETED_EVENT } from "@/api/client";
import { useAutoRefresh } from "@/shared/hooks/use-auto-refresh";
import {
  Filter,
  Pencil,
  Search,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { useHorseUser } from "@/components/horses/HorseShell";
import { HorseImage, Modal, Notice, StatusBadge } from "@/components/horses/HorseUI";
import {
  deleteHorse as deleteHorseApi,
  errorMessage,
  getHorseStables,
  getHorseDeletionWarnings,
  horseGender,
  listHorses,
  type Horse,
  type Stable,
} from "@/api/horses/api";

const PAGE_SIZE = 9;
const horsesListCache = new Map<string, { items: Horse[]; total: number }>();
let stablesCache: Stable[] | null = null;
const HORSES_STORAGE_PREFIX = "racehorse:horses-list:v1:";
const STABLES_STORAGE_KEY = "racehorse:stables:v1";

function clearLocalHorsePageCache() {
  horsesListCache.clear();
  stablesCache = null;
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STABLES_STORAGE_KEY);
    const keys: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const k = window.sessionStorage.key(i);
      if (k && k.startsWith(HORSES_STORAGE_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => window.sessionStorage.removeItem(k));
  } catch { /* ignore */ }
}

if (typeof window !== "undefined") {
  window.addEventListener(APP_MUTATION_COMPLETED_EVENT, clearLocalHorsePageCache);
}

function readCachedHorses(key: string): { items: Horse[]; total: number } | undefined {
  const mem = horsesListCache.get(key);
  if (mem) return mem;
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.sessionStorage.getItem(HORSES_STORAGE_PREFIX + key);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { items?: Horse[]; total?: number };
    if (Array.isArray(parsed.items) && typeof parsed.total === "number") {
      const value = { items: parsed.items, total: parsed.total };
      horsesListCache.set(key, value);
      return value;
    }
  } catch { /* ignore storage errors */ }
  return undefined;
}

function writeCachedHorses(key: string, value: { items: Horse[]; total: number }) {
  horsesListCache.set(key, value);
  if (typeof window === "undefined") return;
  try { window.sessionStorage.setItem(HORSES_STORAGE_PREFIX + key, JSON.stringify(value)); } catch { /* ignore */ }
}

function readCachedStables(): Stable[] | null {
  if (stablesCache) return stablesCache;
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STABLES_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stable[];
    if (Array.isArray(parsed)) {
      stablesCache = parsed;
      return parsed;
    }
  } catch { /* ignore */ }
  return null;
}

function writeCachedStables(stables: Stable[]) {
  stablesCache = stables;
  if (typeof window === "undefined") return;
  try { window.sessionStorage.setItem(STABLES_STORAGE_KEY, JSON.stringify(stables)); } catch { /* ignore */ }
}

function paginationPages(currentPage: number, totalPages: number): (number | "ellipsis")[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  if (currentPage <= 4) return [1, 2, 3, 4, 5, "ellipsis", totalPages];
  if (currentPage >= totalPages - 3) return [1, "ellipsis", ...Array.from({ length: 5 }, (_, index) => totalPages - 4 + index)];
  return [1, "ellipsis", currentPage - 1, currentPage, currentPage + 1, "ellipsis", totalPages];
}

export default function HorsesPage() {
  const user = useHorseUser();
  const isOwner = user.roleName === "HORSE_OWNER";
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [stableFilter, setStableFilter] = useState("ALL");
  const [pageNumber, setPageNumber] = useState(1);
  const cacheKey = `${user.id}|${pageNumber}|${search}|${isOwner ? "OWNER" : stableFilter}|${statusFilter}`;
  const cachedPage = readCachedHorses(cacheKey);
  const [total, setTotal] = useState(cachedPage?.total ?? 0);
  const [reloadKey, setReloadKey] = useState(0);
  const [horses, setHorses] = useState<Horse[]>(cachedPage?.items ?? []);
  const [stableOptions, setStableOptions] = useState<Stable[]>(() => readCachedStables() ?? []);
  const [loading, setLoading] = useState(!cachedPage);
  const [error, setError] = useState("");
  const [deleteHorse, setDeleteHorse] = useState<Horse | null>(null);
  const [deleteWarning, setDeleteWarning] = useState<{ scheduledTraining: number; medicalRecords: number; activePrescriptions: number } | null>(null);

  useEffect(() => {
    const handleOwnerChange = () => setReloadKey((current) => current + 1);
    window.addEventListener("horse-owner-horses-changed", handleOwnerChange);
    return () => window.removeEventListener("horse-owner-horses-changed", handleOwnerChange);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPageNumber(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const fetchHorses = useCallback(async (silent = false) => {
    const cached = horsesListCache.get(cacheKey);
    if (!silent && !cached) setLoading(true);
    if (!silent) setError("");
    let outOfRange = false;
    try {
      const result = await listHorses({
        page: pageNumber,
        size: PAGE_SIZE,
        search: search || undefined,
        stableBoxId: isOwner || stableFilter === "ALL" ? undefined : stableFilter,
        currentStatus: statusFilter === "ALL" ? undefined : statusFilter,
      });
      const lastPage = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
      setTotal(result.total);
      if (pageNumber > lastPage) {
        outOfRange = true;
        setPageNumber(lastPage);
        return;
      }
      writeCachedHorses(cacheKey, { items: result.items, total: result.total });
      setHorses(result.items);
    } catch (reason) {
      if (!silent) setError(errorMessage(reason));
    } finally {
      if (!outOfRange) setLoading(false);
    }
  }, [cacheKey, isOwner, pageNumber, search, stableFilter, statusFilter]);

  useEffect(() => {
    const cached = readCachedHorses(cacheKey);
    if (cached) {
      setHorses(cached.items);
      setTotal(cached.total);
      setLoading(false);
    }
    void fetchHorses(Boolean(cached));
  }, [cacheKey, fetchHorses, reloadKey]);

  useAutoRefresh(() => fetchHorses(true), { intervalMs: 25_000 });

  useEffect(() => {
    if (isOwner || readCachedStables()) return;
    let active = true;
    getHorseStables().then((stables) => {
      writeCachedStables(stables);
      if (active) setStableOptions(stables);
    }).catch((reason) => {
      if (active) setError(errorMessage(reason));
    });
    return () => { active = false; };
  }, [isOwner]);

  async function handleDeleteConfirm() {
    if (!deleteHorse) return;
    try {
      await deleteHorseApi(deleteHorse.id);
      setHorses((current) => current.filter((horse) => horse.id !== deleteHorse.id));
      setTotal((current) => Math.max(0, current - 1));
      setReloadKey((current) => current + 1);
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

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pages = paginationPages(pageNumber, totalPages);

  return (
    <>
      <div className="mx-auto max-w-[1240px]">
        <div className="mb-6 flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-sans text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              {isOwner ? "Hồ sơ ngựa của bạn" : "Quản lý hồ sơ & lý lịch ngựa"}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {isOwner
                ? "Tra cứu danh sách ngựa thuộc quyền sở hữu, trạng thái sức khỏe và vị trí chuồng trại."
                : "Tra cứu danh sách, trạng thái sức khỏe và phân bổ chuồng trại toàn hệ thống."}
            </p>
          </div>
          {user.roleName === "CLUB_MANAGER" && (
            <Link className="gold-button self-start sm:self-center" href={Routes.dashboardTab(Routes.dashboardRole("club-manager"), "horse-requests")}>
              Xem yêu cầu đăng ký
            </Link>
          )}
          {isOwner && (
            <Link className="gold-button self-start sm:self-center" href={Routes.dashboardTab(Routes.dashboardRole("horse-owner"), "horse-requests")}>
              Gửi yêu cầu đăng ký ngựa
            </Link>
          )}
        </div>

        {/* Filter Bar */}
              <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Bộ lọc tìm kiếm</span>
                  {(searchInput || statusFilter !== "ALL" || (!isOwner && stableFilter !== "ALL")) && (
                    <button
                      type="button"
                      className="text-xs font-medium text-teal-700 hover:underline"
                      onClick={() => { setSearchInput(""); setSearch(""); setStatusFilter("ALL"); setStableFilter("ALL"); setPageNumber(1); }}
                    >
                      Xóa bộ lọc
                    </button>
                  )}
                </div>
                <div className={`grid gap-3 ${isOwner ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
                  <label className="flex items-center gap-2.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus-within:border-slate-800 focus-within:bg-white focus-within:ring-2 focus-within:ring-slate-800/10">
                    <Search size={16} className="text-slate-400 shrink-0" />
                    <input
                      value={searchInput}
                      onChange={(event) => setSearchInput(event.target.value)}
                      className="w-full border-0 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                      placeholder="Tìm theo tên, giống, chip hoặc hộ chiếu..."
                    />
                  </label>

                  <label className="flex items-center gap-2.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus-within:border-slate-800 focus-within:bg-white focus-within:ring-2 focus-within:ring-slate-800/10">
                    <Filter size={16} className="text-slate-400 shrink-0" />
                    <select
                      value={statusFilter}
                      onChange={(event) => { setStatusFilter(event.target.value); setPageNumber(1); }}
                      className="w-full border-0 bg-transparent text-sm text-slate-800 outline-none cursor-pointer"
                    >
                      <option value="ALL">Tất cả trạng thái</option>
                      <option value="Healthy">Khỏe mạnh</option>
                      <option value="Monitoring">Cần theo dõi</option>
                      <option value="Quarantine">Cách ly</option>
                      <option value="Injured">Chấn thương</option>
                    </select>
                  </label>

                  {!isOwner && (
                    <label className="flex items-center gap-2.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus-within:border-slate-800 focus-within:bg-white focus-within:ring-2 focus-within:ring-slate-800/10">
                      <ShieldAlert size={16} className="text-slate-400 shrink-0" />
                      <select
                        value={stableFilter}
                        onChange={(event) => { setStableFilter(event.target.value); setPageNumber(1); }}
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
                  )}
                </div>
              </div>

          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Hiển thị <strong className="font-semibold text-slate-800">{horses.length}</strong> / {total} hồ sơ ngựa
            </p>
          </div>

          {loading ? (
            <Notice>Đang tải danh sách hồ sơ ngựa…</Notice>
          ) : error ? (
            <Notice error>{error}</Notice>
          ) : horses.length === 0 ? (
            <Notice>
              Không tìm thấy ngựa phù hợp với tiêu chí lọc. Vui lòng thử từ khóa khác hoặc xóa bộ lọc.
            </Notice>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {horses.map((horse) => {
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
                          <h2 className="truncate font-sans text-lg font-semibold text-slate-900">
                            {horse.horse_name}
                          </h2>
                          <p className="truncate text-xs text-slate-500">
                            {horse.breed ?? "Chưa cập nhật giống"}{horseGender(horse.gender) ? ` · ${horseGender(horse.gender)}` : ""}
                          </p>
                        </div>
                        <StatusBadge horse={horse} />
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                        <div className="rounded-lg bg-slate-50 p-2.5">
                          <span className="block text-[11px] font-medium uppercase tracking-wider text-slate-400">Chuồng</span>
                          <span className="mt-0.5 block truncate font-semibold text-slate-800">{horse.box_code ?? horse.stable_box_id ?? "—"}</span>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2.5">
                          <span className="block text-[11px] font-medium uppercase tracking-wider text-slate-400">
                            {isOwner ? "Năm sinh" : "Chủ sở hữu"}
                          </span>
                          <span className="mt-0.5 block truncate font-semibold text-slate-800">
                            {isOwner ? (horse.birth_year ?? "—") : (owner?.full_name ?? "Chưa có")}
                          </span>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2.5">
                          <span className="block text-[11px] font-medium uppercase tracking-wider text-slate-400">Cân nặng</span>
                          <span className="mt-0.5 block truncate font-semibold text-slate-800">{horse.current_weight_kg == null ? "—" : `${horse.current_weight_kg} kg`}</span>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2.5">
                          <span className="block text-[11px] font-medium uppercase tracking-wider text-slate-400">Tập luyện</span>
                          <span className={`mt-0.5 block truncate font-semibold ${horse.is_training_locked ? "text-amber-700" : "text-emerald-700"}`}>
                            {horse.is_training_locked ? "Đang khóa" : "Sẵn sàng"}
                          </span>
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

          {!loading && !error && totalPages > 1 && (
            <nav className="mt-6 flex flex-wrap items-center justify-center gap-2" aria-label="Phân trang danh sách ngựa">
              <button
                type="button"
                className="soft-button !min-h-[36px] !px-3 !text-xs"
                disabled={pageNumber <= 1}
                onClick={() => setPageNumber((current) => Math.max(1, current - 1))}
              >
                Trước
              </button>
              {pages.map((page, index) => page === "ellipsis" ? (
                <span key={`ellipsis-${index}`} className="px-1 text-sm text-slate-500" aria-hidden="true">…</span>
              ) : (
                <button
                  key={page}
                  type="button"
                  aria-label={`Trang ${page}`}
                  aria-current={page === pageNumber ? "page" : undefined}
                  className={page === pageNumber
                    ? "gold-button !min-h-[36px] !min-w-[36px] !px-2 !text-xs"
                    : "soft-button !min-h-[36px] !min-w-[36px] !px-2 !text-xs"}
                  onClick={() => setPageNumber(page)}
                >
                  {page}
                </button>
              ))}
              <button
                type="button"
                className="soft-button !min-h-[36px] !px-3 !text-xs"
                disabled={pageNumber >= totalPages}
                onClick={() => setPageNumber((current) => Math.min(totalPages, current + 1))}
              >
                Sau
              </button>
            </nav>
          )}
      </div>

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
