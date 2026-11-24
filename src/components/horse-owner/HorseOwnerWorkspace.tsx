"use client";
import { formatDoctorDisplayName } from "@/lib/display-format";
import { Routes } from "@/routes/Routes";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAutoRefresh } from "@/shared/hooks/use-auto-refresh";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardList,
  Filter,
  HeartPulse,
  RefreshCw,
  Search,
  Stethoscope,
  Trophy,
  Wallet,
  X,
} from "lucide-react";
import { HorseImage, Notice, StatusBadge } from "@/components/horses/HorseUI";
import HorseRegistrationPanel from "@/components/horse-owner/HorseRegistrationPanel";
import { errorMessage, horseGender } from "@/api/horses/api";
import { useLinkedNotificationHorse } from "@/hooks/use-notification-target";
import { useDashboardTab } from "@/shared/hooks/use-dashboard-tab";
import {
  getOwnerHorseDashboard,
  getOwnerHorses,
  getOwnershipTransferRequests,
  type OwnerDashboard,
  type OwnerHorse,
  type OwnershipTransferRequest,
} from "@/api/horse-owner/api";

type Tab = "overview" | "health" | "training" | "races" | "finance" | "horse-requests";
const workspaceTabIds: readonly Tab[] = ["overview", "health", "training", "races", "finance", "horse-requests"];

export default function HorseOwnerWorkspace() {
  const [horses, setHorses] = useState<OwnerHorse[]>([]);
  const [selectedId, setSelectedId] = useState("");
  useLinkedNotificationHorse(horses, setSelectedId);
  const [dashboard, setDashboard] = useState<OwnerDashboard | null>(null);
  const [tab, selectTab] = useDashboardTab(workspaceTabIds, "overview");
  const [year, setYear] = useState(new Date().getFullYear());
  const [loadingHorses, setLoadingHorses] = useState(true);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [transferRequests, setTransferRequests] = useState<OwnershipTransferRequest[]>([]);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [horseQuery, setHorseQuery] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    searchInputRef.current?.focus();
    const handlePointerDown = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setPickerOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPickerOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [pickerOpen]);

  useEffect(() => {
    let active = true;
    const refreshHorses = () => {
      void getOwnershipTransferRequests()
        .then((items) => { if (active) setTransferRequests(items); })
        .catch(() => {});
      return getOwnerHorses()
        .then((result) => {
          if (!active) return;
          setHorses(result.items);
          setSelectedId((current) => result.items.some((horse) => horse.id === current)
            ? current
            : result.items[0]?.id || "");
        })
        .catch((reason) => { if (active) setError(errorMessage(reason)); })
        .finally(() => { if (active) setLoadingHorses(false); });
    };
    const handleUpdate = () => { void refreshHorses(); };
    window.addEventListener("horse-owner-horses-changed", handleUpdate);
    window.addEventListener("focus", handleUpdate);
    void refreshHorses();
    return () => {
      active = false;
      window.removeEventListener("horse-owner-horses-changed", handleUpdate);
      window.removeEventListener("focus", handleUpdate);
    };
  }, []);

  const refreshDashboard = useCallback(async (silent = false) => {
    if (!selectedId) return;
    if (!silent) {
      setLoadingDashboard((current) => dashboard?.horse.id === selectedId ? current : true);
    }
    setError("");
    try {
      const result = await getOwnerHorseDashboard(selectedId, year);
      setDashboard(result);
      setUpdatedAt(new Date());
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoadingDashboard(false);
    }
  }, [dashboard?.horse.id, selectedId, year]);

  useEffect(() => {
    void refreshDashboard();
  }, [refreshDashboard]);
  useAutoRefresh(() => refreshDashboard(true), { intervalMs: 25_000 });

  const currentHorse = dashboard?.horse.id === selectedId
    ? dashboard.horse
    : horses.find((horse) => horse.id === selectedId) ?? null;
  const filteredHorses = useMemo(() => {
    const q = horseQuery.trim().toLowerCase();
    if (!q) return horses;
    return horses.filter((horse) =>
      [horse.horse_name, horse.breed, horse.box_code, horse.section, horse.microchip_number, horse.passport_number]
        .some((field) => field?.toLowerCase().includes(q)),
    );
  }, [horses, horseQuery]);
  const recentMetrics = useMemo(() => dashboard?.training_metrics ?? [], [dashboard]);
  const latestWeight = recentMetrics.find((item) => item.body_weight_kg != null)?.body_weight_kg
    ?? currentHorse?.current_weight_kg
    ?? null;
  if (tab === "horse-requests") {
    return (
      <section className="space-y-5" aria-label="Yêu cầu hồ sơ ngựa">
        <HorseRegistrationPanel />
      </section>
    );
  }

  return (
    <section className="space-y-5" aria-label="Theo dõi ngựa">
      {error && <Notice error>{error}</Notice>}
      {transferRequests.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-950 shadow-sm">
          <div>
            <p className="font-semibold">Bạn có {transferRequests.length} yêu cầu chuyển quyền sở hữu đang chờ xác nhận</p>
            <p className="mt-0.5 text-xs text-amber-800">
              {transferRequests.map((item) => item.horse_name).join(", ")} · Club Manager đã xem xét hồ sơ và cần bạn xác nhận đồng ý hoặc từ chối.
            </p>
          </div>
          <button type="button" onClick={() => selectTab("horse-requests")} className="gold-button !min-h-[36px] !px-3.5 !text-xs">
            Mở Yêu cầu hồ sơ để xác nhận
          </button>
        </div>
      )}
      {loadingHorses ? <Notice>Đang tải ngựa thuộc sở hữu của bạn...</Notice> : horses.length === 0 ? (
        <div className="rounded-lg border border-equine-line bg-white p-6 shadow-sm">
          <Notice>Bạn chưa có ngựa được liên kết. Mở mục Yêu cầu hồ sơ để gửi yêu cầu đăng ký mới hoặc liên kết hồ sơ ngựa có sẵn.</Notice>
          <div className="mt-4">
            <button type="button" onClick={() => selectTab("horse-requests")} className="gold-button">Mở Yêu cầu hồ sơ</button>
          </div>
        </div>
      ) : tab === "overview" ? (
        <OwnerHorsesOverview
          horses={horses}
          onSelectHorse={(id) => {
            setSelectedId(id);
            selectTab("training");
          }}
        />
      ) : (
        <>
          {currentHorse && (
            <div className="flex flex-col gap-3 rounded-lg border border-equine-line bg-white p-3.5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
              <div className="relative min-w-0 flex-1" ref={pickerRef}>
                <button
                  type="button"
                  onClick={() => setPickerOpen((open) => !open)}
                  aria-expanded={pickerOpen}
                  aria-haspopup="listbox"
                  className="flex w-full max-w-xl items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-2 pr-3 text-left transition hover:border-equine-blue/50 hover:bg-white"
                >
                  <div className="h-11 w-11 shrink-0 overflow-hidden rounded-md bg-equine-mist">
                    <HorseImage horse={currentHorse} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold text-equine-navy">{currentHorse.horse_name}</span>
                      <StatusBadge horse={currentHorse} />
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {currentHorse.breed ?? "Chưa cập nhật giống"} · {currentHorse.box_code ?? "Chưa xếp chuồng"}
                      {currentHorse.section ? ` · Khu ${currentHorse.section}` : ""}
                    </p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600">
                    {horses.length > 1 ? `Đổi (${horses.length})` : "1 ngựa"}
                    <ChevronDown size={14} className={`transition-transform ${pickerOpen ? "rotate-180" : ""}`} />
                  </span>
                </button>

                {pickerOpen && (
                  <div className="absolute left-0 top-full z-40 mt-2 w-full max-w-xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
                    <div className="border-b border-slate-100 p-2.5">
                      <div className="relative flex items-center">
                        <Search size={15} className="pointer-events-none absolute left-3 text-slate-400" />
                        <input
                          ref={searchInputRef}
                          type="text"
                          value={horseQuery}
                          onChange={(event) => setHorseQuery(event.target.value)}
                          placeholder="Tìm ngựa theo tên, giống, mã chuồng..."
                          aria-label="Tìm kiếm ngựa của bạn"
                          className="field-control !min-h-[36px] w-full pl-9 pr-8 text-xs"
                        />
                        {horseQuery && (
                          <button
                            type="button"
                            onClick={() => { setHorseQuery(""); searchInputRef.current?.focus(); }}
                            aria-label="Xóa từ khóa tìm kiếm"
                            className="absolute right-2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div role="listbox" aria-label="Danh sách ngựa của bạn" className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
                      {filteredHorses.length === 0 ? (
                        <p className="p-4 text-center text-xs text-slate-500">
                          Không tìm thấy ngựa phù hợp với “{horseQuery}”.
                        </p>
                      ) : (
                        filteredHorses.map((horse) => {
                          const isSelected = horse.id === selectedId;
                          return (
                            <button
                              key={horse.id}
                              type="button"
                              role="option"
                              aria-selected={isSelected}
                              onClick={() => {
                                setSelectedId(horse.id);
                                setPickerOpen(false);
                                setHorseQuery("");
                              }}
                              className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition ${
                                isSelected ? "bg-blue-50/70" : "hover:bg-slate-50"
                              }`}
                            >
                              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-equine-mist">
                                <HorseImage horse={horse} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-equine-navy">{horse.horse_name}</p>
                                <p className="truncate text-xs text-slate-500">
                                  {horse.breed ?? "Chưa cập nhật giống"} · {horse.box_code ?? "Chưa xếp chuồng"}
                                </p>
                              </div>
                              <StatusBadge horse={horse} />
                              {isSelected && <Check size={15} className="shrink-0 text-equine-blue" />}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5 lg:justify-end">
                <span className="text-xs text-slate-400">
                  {updatedAt ? `Cập nhật ${formatDateTime(updatedAt.toISOString())}` : "Tự cập nhật mỗi 30 giây"}
                </span>
                <Link href={Routes.horse(currentHorse.id)} className="soft-button !min-h-[34px] !px-3 !text-xs">
                  Mở hồ sơ lý lịch
                </Link>
                <button type="button" className="soft-button !min-h-[34px] !px-3 !text-xs" disabled={!selectedId || loadingDashboard} onClick={() => void refreshDashboard()} aria-label="Làm mới thông tin">
                  <RefreshCw size={14} className={loadingDashboard ? "animate-spin" : ""} /> Làm mới
                </button>
              </div>
            </div>
          )}

          {loadingDashboard && !dashboard ? <Notice>Đang tải dữ liệu của {currentHorse?.horse_name}...</Notice> : dashboard?.horse.id === selectedId ? (
            <div className="space-y-5">
              {tab === "health" && <HealthPanel dashboard={dashboard} latestWeight={latestWeight} />}
              {tab === "training" && <TrainingPanel dashboard={dashboard} />}
              {tab === "races" && <RacePanel dashboard={dashboard} />}
              {tab === "finance" && <FinancePanel dashboard={dashboard} year={year} onYearChange={setYear} />}
            </div>
          ) : !error ? <Notice>Chưa có dữ liệu để hiển thị.</Notice> : null}
        </>
      )}
    </section>
  );
}

function OwnerHorsesOverview({
  horses,
  onSelectHorse,
}: {
  horses: OwnerHorse[];
  onSelectHorse: (horseId: string) => void;
}) {
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const filtered = useMemo(() => {
    const q = searchInput.trim().toLowerCase();
    return horses.filter((horse) => {
      if (statusFilter !== "ALL" && horse.current_status !== statusFilter) return false;
      if (!q) return true;
      return [
        horse.horse_name,
        horse.breed,
        horse.box_code,
        horse.section,
        horse.microchip_number,
        horse.passport_number,
      ].some((field) => field?.toLowerCase().includes(q));
    });
  }, [horses, searchInput, statusFilter]);

  return (
    <div className="space-y-5">
      {/* Filter Bar matching HorsesPage style */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Bộ lọc tìm kiếm</span>
          {(searchInput || statusFilter !== "ALL") && (
            <button
              type="button"
              className="text-xs font-medium text-equine-blue hover:underline"
              onClick={() => { setSearchInput(""); setStatusFilter("ALL"); }}
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex items-center gap-2.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus-within:border-equine-blue focus-within:bg-white focus-within:ring-2 focus-within:ring-equine-blue/15">
            <Search size={16} className="shrink-0 text-slate-400" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="w-full border-0 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
              placeholder="Tìm theo tên, giống, chuồng, chip hoặc hộ chiếu..."
            />
          </label>
          <label className="flex items-center gap-2.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus-within:border-equine-blue focus-within:bg-white focus-within:ring-2 focus-within:ring-equine-blue/15">
            <Filter size={16} className="shrink-0 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="w-full cursor-pointer border-0 bg-transparent text-sm text-slate-800 outline-none"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="Healthy">Khỏe mạnh</option>
              <option value="Monitoring">Cần theo dõi</option>
              <option value="Quarantine">Cách ly</option>
              <option value="Injured">Chấn thương</option>
            </select>
          </label>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Hiển thị <strong className="font-semibold text-slate-800">{filtered.length}</strong> / {horses.length} hồ sơ ngựa
      </p>

      {filtered.length === 0 ? (
        <Notice>Không tìm thấy ngựa phù hợp với tiêu chí lọc. Vui lòng thử từ khóa khác hoặc xóa bộ lọc.</Notice>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((horse) => (
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
                    <span className="mt-0.5 block truncate font-semibold text-slate-800">{horse.box_code ?? "—"}</span>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2.5">
                    <span className="block text-[11px] font-medium uppercase tracking-wider text-slate-400">Năm sinh</span>
                    <span className="mt-0.5 block truncate font-semibold text-slate-800">{horse.birth_year ?? "—"}</span>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2.5">
                    <span className="block text-[11px] font-medium uppercase tracking-wider text-slate-400">Cân nặng</span>
                    <span className="mt-0.5 block truncate font-semibold text-slate-800">
                      {horse.current_weight_kg == null ? "—" : `${horse.current_weight_kg} kg`}
                    </span>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2.5">
                    <span className="block text-[11px] font-medium uppercase tracking-wider text-slate-400">Tập luyện</span>
                    <span className={`mt-0.5 block truncate font-semibold ${horse.is_training_locked ? "text-amber-700" : "text-emerald-700"}`}>
                      {horse.is_training_locked ? "Đang khóa" : "Sẵn sàng"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 border-t border-slate-100 pt-2">
                  <Link className="gold-button flex-1 !min-h-[36px] !text-xs" href={Routes.horse(horse.id)}>
                    Xem chi tiết
                  </Link>
                  <button
                    type="button"
                    className="soft-button !min-h-[36px] !px-3 !text-xs"
                    onClick={() => onSelectHorse(horse.id)}
                  >
                    Lịch tập
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function HealthPanel({ dashboard, latestWeight }: { dashboard: OwnerDashboard; latestWeight: number | null }) {
  const horse = dashboard.horse;
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <InfoTile label="Cân nặng hiện tại" value={latestWeight == null ? "Chưa có dữ liệu" : `${latestWeight} kg`} detail="Từ lần cân gần nhất hoặc hồ sơ ngựa" />
        <InfoTile label="Sẵn sàng thi đấu" value={readinessLabel(horse.readiness_status)} />
        <InfoTile label="Trạng thái sức khỏe" value={healthLabel(horse.current_status)} />
        <InfoTile label="Khóa huấn luyện" value={horse.is_training_locked ? lockLevelLabel(horse.lock_level) : "Không khóa"} detail={horse.is_training_locked ? horse.lock_reason ?? undefined : undefined} />
      </div>
      <Panel title="Lịch y tế & chăm sóc định kỳ" icon={Stethoscope}>
        <OwnerScheduleCalendar
          trainingSchedules={dashboard.training_schedules}
          careSchedules={dashboard.care_schedules ?? []}
          defaultShowTraining={false}
          defaultShowCare={true}
        />
      </Panel>
      <Panel title="Chỉ số khám gần đây" icon={HeartPulse}>
        {dashboard.health_exams.length === 0 ? <Empty>Chưa có lần khám nào được ghi nhận.</Empty> : <div className="space-y-3">{dashboard.health_exams.map((exam) => (
          <article key={exam.id} className="rounded-xl border border-equine-line bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-semibold text-equine-navy">{formatDateTime(exam.exam_date)}{exam.doctor_name ? ` · Bác sĩ ${formatDoctorDisplayName(exam.doctor_name)}` : ""}</h4>{exam.body_condition_score != null && <span className="rounded-full bg-equine-mist px-3 py-1 text-xs font-semibold">Điểm thể trạng {exam.body_condition_score}/5</span>}</div>
            <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-3"><p>Thân nhiệt: <strong>{exam.temperature_c == null ? "—" : `${exam.temperature_c} °C`}</strong></p><p>Nhịp tim: <strong>{exam.heart_rate == null ? "—" : `${exam.heart_rate} lần/phút`}</strong></p><p>Nhịp thở: <strong>{exam.respiratory_rate == null ? "—" : `${exam.respiratory_rate} lần/phút`}</strong></p></div>
            {exam.gait_assessment && <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">Đánh giá dáng đi: {exam.gait_assessment}</p>}
          </article>
        ))}</div>}
      </Panel>
      <Panel title="Lịch sử cân nặng & chỉ số vận động" icon={Activity}>
        {dashboard.training_metrics.length === 0 ? <Empty>Chưa có chỉ số tập luyện hoặc cân nặng theo dõi.</Empty> : <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr><th className="pb-3 pr-4">Thời điểm</th><th className="pb-3 pr-4">Cân nặng</th><th className="pb-3 pr-4">Nhịp tim tối đa</th><th className="pb-3 pr-4">Tốc độ TB</th><th className="pb-3">Thể lực</th></tr></thead><tbody>{dashboard.training_metrics.map((metric) => <tr key={metric.id} className="border-t border-equine-line"><td className="py-3 pr-4">{formatDateTime(metric.recorded_at)}{metric.is_simulated && <small className="ml-1 text-violet-700">· Mô phỏng</small>}</td><td className="py-3 pr-4">{metric.body_weight_kg == null ? "—" : `${metric.body_weight_kg} kg`}</td><td className="py-3 pr-4">{metric.max_heart_rate == null ? "—" : `${metric.max_heart_rate} lần/phút`}</td><td className="py-3 pr-4">{metric.avg_speed_kmh == null ? "—" : `${metric.avg_speed_kmh} km/h`}</td><td className="py-3">{metric.stamina_score ?? "—"}</td></tr>)}</tbody></table></div>}
      </Panel>
    </div>
  );
}

function TrainingPanel({ dashboard }: { dashboard: OwnerDashboard }) {
  return (
    <div className="space-y-5">
      <Panel title="Lịch tập luyện & Lịch y tế theo tuần" icon={CalendarDays}>
        <OwnerScheduleCalendar
          trainingSchedules={dashboard.training_schedules}
          careSchedules={dashboard.care_schedules ?? []}
          defaultShowTraining={true}
          defaultShowCare={true}
        />
      </Panel>
      <Panel title="Video đua thử & tập luyện" icon={Activity}>
        {dashboard.training_videos.length === 0 ? <Empty>Chưa có video nào được chia sẻ cho chủ ngựa.</Empty> : <div className="grid gap-4 md:grid-cols-2">{dashboard.training_videos.map((video) => <VideoCard key={video.id} video={video} />)}</div>}
      </Panel>
      <Panel title="Nhật ký nhận xét của huấn luyện viên" icon={ClipboardList}>
        {dashboard.training_metrics.filter((item) => item.trainer_review?.trim()).length === 0 ? <Empty>Chưa có nhận xét huấn luyện được ghi nhận.</Empty> : <div className="space-y-3">{dashboard.training_metrics.filter((item) => item.trainer_review?.trim()).map((item) => <article key={item.id} className="rounded-xl border border-equine-line bg-[#f7f9ff] p-4"><p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{item.trainer_review}</p><p className="mt-2 text-xs text-slate-500">{item.recorded_by_name ? `${item.recorded_by_name} · ` : ""}{formatDateTime(item.recorded_at)}</p></article>)}</div>}
      </Panel>
    </div>
  );
}

const TIMETABLE_SLOTS = [
  { id: 1, label: "Ca 1", timeRange: "06:00 – 09:00" },
  { id: 2, label: "Ca 2", timeRange: "09:00 – 12:00" },
  { id: 3, label: "Ca 3", timeRange: "14:00 – 16:30" },
  { id: 4, label: "Ca 4", timeRange: "16:30 – 19:00" },
] as const;

function slotForTime(startTime: string | null | undefined): number {
  if (!startTime) return 1;
  const hour = Number(startTime.slice(0, 2));
  if (Number.isNaN(hour) || hour < 9) return 1;
  if (hour < 13) return 2;
  if (hour < 16) return 3;
  return 4;
}

function mondayOfWeek(dateIso: string) {
  const date = new Date(`${dateIso}T12:00:00`);
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(dateIso: string, delta: number) {
  const date = new Date(`${dateIso}T12:00:00`);
  date.setDate(date.getDate() + delta);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function weekdayShortLabel(dateIso: string) {
  const labels = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
  return labels[new Date(`${dateIso}T12:00:00`).getDay()] ?? "";
}

function OwnerScheduleCalendar({
  trainingSchedules,
  careSchedules,
  defaultShowTraining,
  defaultShowCare,
}: {
  trainingSchedules: OwnerDashboard["training_schedules"];
  careSchedules: NonNullable<OwnerDashboard["care_schedules"]>;
  defaultShowTraining: boolean;
  defaultShowCare: boolean;
}) {
  const todayStr = localTodayIso();
  const [weekStart, setWeekStart] = useState(() => mondayOfWeek(todayStr));
  const [showTraining, setShowTraining] = useState(defaultShowTraining);
  const [showCare, setShowCare] = useState(defaultShowCare);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const daySet = useMemo(() => new Set(days), [days]);

  const weekTrainingCount = useMemo(
    () => trainingSchedules.filter((item) => daySet.has(item.event_date)).length,
    [trainingSchedules, daySet],
  );
  const weekCareCount = useMemo(
    () => careSchedules.filter((item) => daySet.has(item.event_date)).length,
    [careSchedules, daySet],
  );

  const nearestEventDate = useMemo(() => {
    const allDates = [
      ...(showTraining ? trainingSchedules.map((i) => i.event_date) : []),
      ...(showCare ? careSchedules.map((i) => i.event_date) : []),
    ].filter(Boolean);
    if (allDates.length === 0) return null;
    const upcoming = allDates.filter((d) => d >= todayStr).sort();
    if (upcoming.length > 0) return upcoming[0];
    return [...allDates].sort().at(-1) ?? null;
  }, [trainingSchedules, careSchedules, showTraining, showCare, todayStr]);

  const weekRangeLabel = `${days[0].slice(8, 10)}/${days[0].slice(5, 7)} – ${days[6].slice(8, 10)}/${days[6].slice(5, 7)}/${days[6].slice(0, 4)}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-equine-navy">
            Tuần {weekRangeLabel}
          </span>
          <button type="button" className="soft-button !min-h-[32px] !px-2.5 !text-xs" onClick={() => setWeekStart(addDays(weekStart, -7))}>
            <ArrowLeft size={13} /> Tuần trước
          </button>
          <button type="button" className="soft-button !min-h-[32px] !px-2.5 !text-xs" onClick={() => setWeekStart(mondayOfWeek(todayStr))}>
            Tuần hiện tại
          </button>
          <button type="button" className="soft-button !min-h-[32px] !px-2.5 !text-xs" onClick={() => setWeekStart(addDays(weekStart, 7))}>
            Tuần sau <ArrowRight size={13} />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50/60 px-2.5 py-1.5 text-xs font-semibold text-blue-900">
            <input type="checkbox" checked={showTraining} onChange={(e) => setShowTraining(e.target.checked)} className="rounded border-blue-300" />
            Lịch tập ({weekTrainingCount})
          </label>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-purple-200 bg-purple-50/70 px-2.5 py-1.5 text-xs font-semibold text-purple-900">
            <input type="checkbox" checked={showCare} onChange={(e) => setShowCare(e.target.checked)} className="rounded border-purple-300" />
            Lịch Y tế ({weekCareCount})
          </label>
        </div>
      </div>

      {weekTrainingCount === 0 && weekCareCount === 0 && nearestEventDate && !daySet.has(nearestEventDate) && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600">
          <span>Tuần này chưa có lịch được xếp cho ngựa.</span>
          <button
            type="button"
            className="font-semibold text-equine-blue hover:underline"
            onClick={() => setWeekStart(mondayOfWeek(nearestEventDate))}
          >
            Xem tuần có lịch gần nhất ({formatDate(nearestEventDate)})
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-300">
        <table className="w-full min-w-[920px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-300">
              <th className="w-24 border-r border-slate-300 bg-slate-100 p-2.5 text-center font-semibold uppercase tracking-wide text-slate-800">
                Khung giờ
              </th>
              {days.map((day) => {
                const isToday = day === todayStr;
                return (
                  <th
                    key={day}
                    className={`border-r border-slate-300 p-2.5 text-center last:border-r-0 ${
                      isToday ? "border-b-2 border-emerald-700 bg-[#C3E6CB] text-[#0A4125]" : "bg-slate-100 text-slate-800"
                    }`}
                  >
                    <div className="flex flex-col items-center">
                      <span className="font-semibold">
                        {weekdayShortLabel(day)} ({day.slice(8, 10)}/{day.slice(5, 7)})
                      </span>
                      {isToday && (
                        <span className="mt-0.5 rounded bg-emerald-800 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                          Hôm nay
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-300">
            {TIMETABLE_SLOTS.map((slot) => (
              <tr key={slot.id} className="transition-colors hover:bg-slate-50/50">
                <td className="border-r border-slate-300 bg-slate-100/80 p-2.5 text-center align-middle text-slate-900">
                  <span className="block text-sm font-semibold">{slot.label}</span>
                  <span className="mt-0.5 block whitespace-nowrap text-[11px] text-slate-600">{slot.timeRange}</span>
                </td>
                {days.map((day) => {
                  const cellTraining = showTraining
                    ? trainingSchedules.filter((item) => item.event_date === day && slotForTime(item.start_time) === slot.id)
                    : [];
                  const cellCare = showCare
                    ? careSchedules.filter((item) => item.event_date === day && slotForTime(item.start_time) === slot.id)
                    : [];
                  return (
                    <td
                      key={`${slot.id}-${day}`}
                      className={`border-r border-slate-300 p-2 align-top last:border-r-0 ${day === todayStr ? "bg-[#F3FAF5]" : "bg-white"}`}
                    >
                      {cellTraining.length === 0 && cellCare.length === 0 ? (
                        <div className="flex min-h-[74px] items-center justify-center text-sm text-slate-300 select-none">—</div>
                      ) : (
                        <div className="space-y-1.5">
                          {cellCare.map((care) => {
                            const isCompleted = care.status === "Completed";
                            const isOverdue = care.status === "Scheduled" && care.event_date < todayStr;
                            return (
                              <div
                                key={`care-${care.id}`}
                                className={`rounded-md border p-2 text-[11px] ${
                                  isOverdue
                                    ? "border-rose-300 bg-rose-50/90 text-rose-950"
                                    : isCompleted
                                      ? "border-emerald-300 bg-emerald-50/80 text-emerald-950"
                                      : "border-purple-300 bg-purple-50/90 text-purple-950"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-1">
                                  <strong className="font-semibold leading-snug">
                                    🩺 {careTypeLabel(care.care_type, care.title)}
                                  </strong>
                                  <span
                                    className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold ${
                                      isOverdue
                                        ? "bg-rose-600 text-white"
                                        : isCompleted
                                          ? "bg-emerald-200 text-emerald-900"
                                          : "bg-purple-200 text-purple-900"
                                    }`}
                                  >
                                    {isOverdue ? "Quá hạn" : isCompleted ? "Đã khám" : "Lịch Y tế"}
                                  </span>
                                </div>
                                {care.start_time && (
                                  <p className="mt-1 text-[10px] opacity-80">
                                    {formatTime(care.start_time)}{care.end_time ? ` – ${formatTime(care.end_time)}` : ""}
                                  </p>
                                )}
                                {care.doctor_name && <p className="mt-0.5 truncate text-[10px] opacity-80">BS. {care.doctor_name}</p>}
                              </div>
                            );
                          })}

                          {cellTraining.map((item) => {
                            const isCompleted = item.status === "Completed";
                            const isCancelled = item.status === "Cancelled";
                            const isMissed = item.status === "Missed" || item.status === "Blocked";
                            return (
                              <div
                                key={`train-${item.id}`}
                                className={`rounded-md border p-2 text-[11px] ${
                                  isCancelled
                                    ? "border-slate-200 bg-slate-100 text-slate-500 line-through"
                                    : isCompleted
                                      ? "border-emerald-300 bg-emerald-50/85 text-emerald-950"
                                      : isMissed
                                        ? "border-amber-300 bg-amber-50/90 text-amber-950"
                                        : "border-blue-200 bg-blue-50/85 text-blue-950"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-1">
                                  <strong className="font-semibold leading-snug">
                                    {item.title ?? sessionLabel(item.session_type)}
                                  </strong>
                                  <span className="shrink-0 rounded bg-white/80 px-1.5 py-0.5 text-[9px] font-semibold">
                                    {scheduleStatus(item.status)}
                                  </span>
                                </div>
                                <p className="mt-1 text-[10px] opacity-80">
                                  {item.start_time ? `${formatTime(item.start_time)}${item.end_time ? `–${formatTime(item.end_time)}` : ""}` : slot.timeRange}
                                  {item.track_surface ? ` · ${trackSurfaceLabel(item.track_surface)}` : ""}
                                </p>
                                {item.assigned_groom_name && (
                                  <p className="mt-0.5 truncate text-[10px] opacity-80">Groom: {item.assigned_groom_name}</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RacePanel({ dashboard }: { dashboard: OwnerDashboard }) {
  const [raceFilter, setRaceFilter] = useState<"ALL" | "OFFICIAL" | "SIMULATED">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "COMPLETED" | "ACTIVE" | "CANCELLED">("ALL");
  const [yearFilter, setYearFilter] = useState<string>("ALL");

  const officialEntries = useMemo(
    () => dashboard.race_history.filter((race) => !race.is_simulated),
    [dashboard.race_history],
  );
  const simulatedEntries = useMemo(
    () => dashboard.race_history.filter((race) => race.is_simulated),
    [dashboard.race_history],
  );
  const activeOfficialEntries = useMemo(
    () => officialEntries.filter((race) => (race.entry_status === "Registered" || race.entry_status === "Blocked") && race.race_status !== "Cancelled"),
    [officialEntries],
  );
  const completedOfficial = useMemo(
    () => officialEntries.filter((race) => race.entry_status === "Completed"),
    [officialEntries],
  );
  const winsCount = useMemo(
    () => completedOfficial.filter((race) => race.result_position === 1).length,
    [completedOfficial],
  );
  const podiumCount = useMemo(
    () => completedOfficial.filter((race) => race.result_position != null && race.result_position <= 3).length,
    [completedOfficial],
  );
  const bestRank = useMemo(() => {
    const ranks = completedOfficial
      .map((race) => race.result_position)
      .filter((rank): rank is number => typeof rank === "number" && rank >= 1);
    return ranks.length > 0 ? Math.min(...ranks) : null;
  }, [completedOfficial]);
  const officialWinnings = useMemo(
    () => completedOfficial.reduce((sum, race) => sum + (race.prize_amount ?? 0), 0),
    [completedOfficial],
  );

  const years = useMemo(() => {
    const set = new Set<string>();
    for (const race of dashboard.race_history) {
      if (race.race_date?.length >= 4) set.add(race.race_date.slice(0, 4));
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [dashboard.race_history]);

  const filteredRaces = useMemo(() => {
    return dashboard.race_history.filter((race) => {
      if (raceFilter === "OFFICIAL" && race.is_simulated) return false;
      if (raceFilter === "SIMULATED" && !race.is_simulated) return false;
      if (yearFilter !== "ALL" && !race.race_date?.startsWith(yearFilter)) return false;

      const isActive = (race.entry_status === "Registered" || race.entry_status === "Blocked") && race.race_status !== "Cancelled";
      const isCancelled = race.entry_status === "Cancelled" || race.race_status === "Cancelled";
      if (statusFilter === "COMPLETED" && race.entry_status !== "Completed") return false;
      if (statusFilter === "ACTIVE" && !isActive) return false;
      if (statusFilter === "CANCELLED" && !isCancelled) return false;
      return true;
    });
  }, [dashboard.race_history, raceFilter, statusFilter, yearFilter]);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <InfoTile label="Giải đấu chính thức" value={String(officialEntries.length)} detail={`${completedOfficial.length} lượt đã có kết quả`} />
        <InfoTile label="Vô địch (Hạng 1)" value={String(winsCount)} detail={`${podiumCount} lần vào Top 3`} />
        <InfoTile label="Thành tích tốt nhất" value={bestRank == null ? "—" : `Hạng ${bestRank}`} detail="Chỉ tính giải chính thức" />
        <InfoTile label="Tổng tiền thưởng chính thức" value={money(officialWinnings)} detail="Loại trừ lượt chạy mô phỏng" />
        <InfoTile label="Lượt chạy mô phỏng 3D" value={String(simulatedEntries.length)} detail="Huấn luyện nội bộ" />
      </div>

      {activeOfficialEntries.length > 0 && (
        <Panel title="Lịch thi đấu chính thức sắp tới & Đang đăng ký" icon={CalendarDays}>
          <div className="grid gap-3 md:grid-cols-2">
            {activeOfficialEntries.map((race) => {
              const isBlocked = race.entry_status === "Blocked";
              return (
                <article
                  key={`upcoming-${race.entry_id}`}
                  className={`rounded-xl border p-4 ${isBlocked ? "border-rose-200 bg-rose-50/40" : "border-sky-200 bg-sky-50/40"}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h4 className="font-semibold text-equine-navy">{race.race_name}</h4>
                      <p className="mt-1 text-xs text-slate-600">
                        {formatDate(race.race_date)}
                        {race.location ? ` · ${race.location}` : ""}
                        {race.distance_meters ? ` · ${race.distance_meters.toLocaleString("vi-VN")} m` : ""}
                        {race.grade ? ` · Hạng giải ${race.grade}` : ""}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${isBlocked ? "bg-rose-100 text-rose-800" : "bg-sky-100 text-sky-800"}`}>
                      {isBlocked ? "Tạm khóa y tế" : "Đã đăng ký"}
                    </span>
                  </div>
                  <p className="mt-2.5 text-xs text-slate-600">
                    {isBlocked
                      ? "Tạm khóa do trạng thái y tế; bác sĩ thú y sẽ kiểm tra lại trước khi Head Trainer khôi phục lịch thi đấu."
                      : "Đã đăng ký · Sẵn sàng thi đấu theo lịch chính thức."}
                  </p>
                </article>
              );
            })}
          </div>
        </Panel>
      )}

      <Panel title="Lịch sử & Kết quả thi đấu" icon={Trophy}>
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-equine-line bg-slate-50/70 p-3.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {([
              ["ALL", `Tất cả (${dashboard.race_history.length})`],
              ["OFFICIAL", `Giải chính thức (${officialEntries.length})`],
              ["SIMULATED", `Đua thử 3D (${simulatedEntries.length})`],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setRaceFilter(key)}
                className={raceFilter === key ? "gold-button !min-h-[34px] !px-3 !text-xs" : "soft-button !min-h-[34px] !px-3 !text-xs"}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-medium text-slate-600">
              Trạng thái
              <select
                aria-label="Lọc theo trạng thái thi đấu"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as "ALL" | "COMPLETED" | "ACTIVE" | "CANCELLED")}
                className="field-control ml-2 inline-flex h-9 w-40 bg-white px-2 text-xs"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="COMPLETED">Đã có kết quả</option>
                <option value="ACTIVE">Đang mở / Tạm khóa</option>
                <option value="CANCELLED">Đã hủy</option>
              </select>
            </label>
            {years.length > 0 && (
              <label className="text-xs font-medium text-slate-600">
                Năm
                <select
                  aria-label="Lọc theo năm thi đấu"
                  value={yearFilter}
                  onChange={(event) => setYearFilter(event.target.value)}
                  className="field-control ml-2 inline-flex h-9 w-28 bg-white px-2 text-xs"
                >
                  <option value="ALL">Tất cả</option>
                  {years.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
            )}
          </div>
        </div>

        {filteredRaces.length === 0 ? (
          <Empty>Chưa có bản ghi thi đấu phù hợp bộ lọc hiện tại.</Empty>
        ) : (
          <div className="space-y-3">
            {filteredRaces.map((race) => {
              const isBlocked = race.entry_status === "Blocked";
              const isCancelled = race.entry_status === "Cancelled" || race.race_status === "Cancelled";
              const isCompleted = race.entry_status === "Completed";
              const rankLabel = race.result_position == null
                ? entryStatus(race.entry_status)
                : race.result_position === 1 && !race.is_simulated
                  ? "Hạng 1 · Vô địch"
                  : race.result_position === 2 && !race.is_simulated
                    ? "Hạng 2 · Á quân"
                    : `Hạng ${race.result_position}`;
              const badgeCls = isBlocked
                ? "bg-rose-50 text-rose-700 border-rose-200"
                : isCancelled
                  ? "bg-slate-100 text-slate-600 border-slate-200"
                  : race.result_position === 1 && !race.is_simulated
                    ? "bg-amber-100 text-amber-900 border-amber-300"
                    : (race.result_position === 2 || race.result_position === 3) && !race.is_simulated
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-equine-mist text-equine-navy border-slate-200";
              const prizeText = race.is_simulated
                ? "Không áp dụng (Đua thử nội bộ)"
                : isCompleted
                  ? money(race.prize_amount ?? 0)
                  : isCancelled
                    ? "Đã hủy đăng ký"
                    : "Chờ kết quả sau ngày thi đấu";

              return (
                <article key={race.entry_id} className="rounded-xl border border-equine-line bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-semibold text-equine-navy">{race.race_name}</h4>
                        {race.is_simulated && <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-800">Mô phỏng</span>}
                        {race.race_status === "Cancelled" && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">Giải đã hủy</span>}
                      </div>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-bold ${badgeCls}`}>{rankLabel}</span>
                  </div>

                  <div className="mt-3 grid gap-2 rounded-lg bg-slate-50 p-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <span className="block text-[11px] uppercase tracking-wide text-slate-400">Ngày thi đấu</span>
                      <strong className="mt-0.5 block text-slate-800">{formatDate(race.race_date)}</strong>
                    </div>
                    <div>
                      <span className="block text-[11px] uppercase tracking-wide text-slate-400">Địa điểm</span>
                      <strong className="mt-0.5 block text-slate-800">{race.location || "Chưa cập nhật"}</strong>
                    </div>
                    <div>
                      <span className="block text-[11px] uppercase tracking-wide text-slate-400">Cự ly & Hạng giải</span>
                      <strong className="mt-0.5 block text-slate-800">
                        {race.distance_meters ? `${race.distance_meters.toLocaleString("vi-VN")} m` : "—"}
                        {race.grade ? ` · Hạng ${race.grade}` : ""}
                      </strong>
                    </div>
                    <div>
                      <span className="block text-[11px] uppercase tracking-wide text-slate-400">Tiền thưởng / Ghi nhận</span>
                      <strong className="mt-0.5 block text-equine-navy">{prizeText}</strong>
                    </div>
                  </div>

                  {isBlocked && (
                    <p className="mt-2.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                      Lượt đăng ký này đang tạm khóa do bác sĩ thú y đặt trạng thái theo dõi/chấn thương cho ngựa.
                    </p>
                  )}

                  {race.cancel_reason && (
                    <p className="mt-2.5 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700">
                      <strong>Lý do hủy:</strong> {race.cancel_reason}
                    </p>
                  )}
                  {race.description && <p className="mt-2 text-xs text-slate-500">{race.description}</p>}
                </article>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}

function FinancePanel({ dashboard, year, onYearChange }: { dashboard: OwnerDashboard; year: number; onYearChange: (year: number) => void }) {
  const report = dashboard.financial_report;
  const totals = report.totals;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">Báo cáo định kỳ</p><h4 className="mt-1 font-sans text-xl font-semibold text-equine-navy">Thu chi theo tháng</h4></div><label className="text-sm font-medium text-slate-600">Năm báo cáo<select aria-label="Năm báo cáo" value={year} onChange={(event) => onYearChange(Number(event.target.value))} className="field-control ml-2 inline-flex h-10 w-28 px-3">{Array.from({ length: 5 }, (_, index) => new Date().getFullYear() - index).map((item) => <option key={item} value={item}>{item}</option>)}</select></label></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><InfoTile label="Chi phí nuôi dưỡng" value={money(totals.care_cost)} /><InfoTile label="Chi phí y tế" value={money(totals.medical_cost)} /><InfoTile label="Tổng chi phí đã phân loại" value={money(totals.total_expenses)} /><InfoTile label="Doanh thu tiền thưởng" value={money(totals.prize_income)} /></div>
      {totals.other_amount > 0 && <p className="rounded-xl border border-equine-line bg-white p-3 text-xs text-slate-500">Chưa phân loại: {money(totals.other_amount)}.</p>}
      <Panel title="Tổng hợp từng tháng" icon={Wallet}>
        {report.monthly.length === 0 ? <Empty>Chưa có giao dịch tài chính cho năm {year}.</Empty> : <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr><th className="pb-3 pr-4">Kỳ</th><th className="pb-3 pr-4">Nuôi dưỡng</th><th className="pb-3 pr-4">Y tế</th><th className="pb-3 pr-4">Tiền thưởng</th><th className="pb-3">Khác</th></tr></thead><tbody>{report.monthly.map((month) => <tr key={month.billing_period} className="border-t border-equine-line"><td className="py-3 pr-4 font-semibold">{month.billing_period}</td><td className="py-3 pr-4">{money(month.care_cost)}</td><td className="py-3 pr-4">{money(month.medical_cost)}</td><td className="py-3 pr-4">{money(month.prize_income)}</td><td className="py-3">{money(month.other_amount)}</td></tr>)}</tbody></table></div>}
      </Panel>
      <Panel title="Các khoản đã ghi nhận" icon={ClipboardList}>
        {report.transactions.length === 0 ? <Empty>Chưa có khoản thu chi trong kỳ.</Empty> : <div className="space-y-2">{report.transactions.map((transaction) => <article key={transaction.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-equine-line p-3"><div><p className="font-semibold text-equine-navy">{transactionLabel(transaction.category, transaction.transaction_type)}</p><p className="mt-1 text-xs text-slate-500">Kỳ {transaction.billing_period} · {formatDateTime(transaction.created_at)}</p></div><strong className="text-sm text-equine-navy">{money(transaction.amount)}</strong></article>)}</div>}
      </Panel>
    </div>
  );
}

function VideoCard({ video }: { video: OwnerDashboard["training_videos"][number] }) {
  const url = safeHttpUrl(video.video_url);
  const embed = url ? videoEmbedUrl(url) : null;
  const isFile = url ? /\.(mp4|webm|ogg)(\?.*)?$/i.test(url) : false;
  return <article className="overflow-hidden rounded-lg border border-equine-line bg-white shadow-sm">
    {embed ? <iframe className="aspect-video w-full bg-slate-950" src={embed} title={video.description ?? "Video tập luyện của ngựa"} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /> : isFile ? <video className="aspect-video w-full bg-slate-950" controls preload="metadata"><source src={url!} /></video> : <div className="grid aspect-video place-items-center bg-equine-mist text-sm text-slate-500">Video buổi tập</div>}
    <div className="space-y-2 p-4"><p className="font-semibold text-equine-navy">{video.description ?? sessionLabel(video.session_type)}</p><p className="text-xs text-slate-500">{sessionLabel(video.session_type)} · {formatDateTime(video.uploaded_at)}{video.uploaded_by_name ? ` · ${video.uploaded_by_name}` : ""}</p>{url ? <a href={url} target="_blank" rel="noreferrer" className="inline-flex text-sm font-semibold text-equine-navy underline underline-offset-4">Mở video</a> : <p className="text-xs text-rose-700">Đường dẫn video không hợp lệ.</p>}</div>
  </article>;
}

function Panel({ title, icon: Icon, children }: { title: string; icon: typeof Activity; children: ReactNode }) {
  return <section className="rounded-lg border border-equine-line bg-white p-4 shadow-sm sm:p-5"><h2 className="mb-4 flex items-center gap-2 font-sans text-lg font-semibold text-equine-navy"><Icon size={18} />{title}</h2>{children}</section>;
}

function InfoTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="rounded-lg border border-equine-line bg-[#f8fafc] p-4"><p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 break-words text-sm font-semibold text-equine-navy">{value}</p>{detail && <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>}</div>;
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg bg-[#f8fafc] p-4 text-sm text-slate-500">{children}</p>;
}

function localTodayIso() {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date());
}

function healthLabel(value: string) {
  return ({ Healthy: "Khỏe mạnh", Injured: "Chấn thương", Quarantine: "Cách ly", Monitoring: "Đang theo dõi", "Under Observation": "Cần theo dõi", Sick: "Đang bệnh" } as Record<string, string>)[value] ?? value;
}

function careTypeLabel(careType: string | null | undefined, title: string | null | undefined) {
  const map: Record<string, string> = {
    Deworming: "Tẩy giun định kỳ",
    Vaccination: "Tiêm phòng vắc-xin",
    HoofCare: "Chăm sóc móng",
    DentalCheck: "Khám răng",
    GeneralCheckup: "Khám sức khỏe định kỳ",
    Physiotherapy: "Vật lý trị liệu",
  };
  return (careType && map[careType]) || title || careType || "Chăm sóc y tế";
}

function lockLevelLabel(value: string | null | undefined) {
  return ({ Warning: "Cảnh báo (tạm khóa)", Critical: "Khóa khẩn cấp" } as Record<string, string>)[value ?? ""] ?? "Đang tạm khóa";
}

function trackSurfaceLabel(value: string | null | undefined) {
  return ({ Dirt: "Sân đất", Turf: "Sân cỏ", Grass: "Sân cỏ", Synthetic: "Sân tổng hợp" } as Record<string, string>)[value ?? ""] ?? value ?? "";
}

function readinessLabel(value: string | null | undefined) {
  return ({ Ready: "Sẵn sàng", NotReady: "Chưa sẵn sàng", Unknown: "Chưa đánh giá" } as Record<string, string>)[value ?? ""] ?? "Chưa đánh giá";
}

function sessionLabel(value: string | null | undefined) {
  return ({ TrialRun: "Đua thử", Race: "Đua thử", Training: "Tập luyện", Rest: "Nghỉ hồi phục" } as Record<string, string>)[value ?? ""] ?? value ?? "Buổi tập";
}

function scheduleStatus(value: string | null) {
  return ({ Scheduled: "Đã lên lịch", Blocked: "Bị chặn do khóa y tế", InProgress: "Đang diễn ra", Completed: "Hoàn thành", Missed: "Bỏ lỡ", Cancelled: "Đã hủy" } as Record<string, string>)[value ?? ""] ?? value ?? "Chưa xác định";
}

function entryStatus(value: string | null) {
  return ({
    Registered: "Đã đăng ký",
    Blocked: "Tạm khóa y tế",
    Completed: "Đã hoàn thành",
    Cancelled: "Đã hủy",
  } as Record<string, string>)[value ?? ""] ?? value ?? "Chưa có kết quả";
}

function financialCategory(value: string) {
  return ({ CARE: "Nuôi dưỡng", MEDICAL: "Y tế", PRIZE: "Tiền thưởng", OTHER: "Khoản khác" } as Record<string, string>)[value] ?? value;
}

function transactionLabel(category: string, type: string) {
  const cat = financialCategory(category);
  const norm = type.trim().toLowerCase();
  if (!norm || ["care", "medical", "prize", "other"].includes(norm)) return cat;
  return `${cat} · ${type}`;
}

function money(value: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatTime(value: string) {
  return value.slice(0, 5);
}

function safeHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function videoEmbedUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "youtu.be") return `https://www.youtube-nocookie.com/embed/${parsed.pathname.slice(1)}`;
    if (parsed.hostname.endsWith("youtube.com")) {
      const id = parsed.searchParams.get("v");
      if (id) return `https://www.youtube-nocookie.com/embed/${id}`;
      const match = parsed.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/);
      if (match) return `https://www.youtube-nocookie.com/embed/${match[1]}`;
    }
    if (parsed.hostname.endsWith("vimeo.com")) {
      const id = parsed.pathname.split("/").filter(Boolean).at(-1);
      if (id && /^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`;
    }
    return null;
  } catch {
    return null;
  }
}
