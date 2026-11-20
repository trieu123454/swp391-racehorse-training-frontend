"use client";
import { Routes } from "@/routes/Routes";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  CalendarDays,
  ClipboardList,
  HeartPulse,
  RefreshCw,
  Trophy,
  Wallet,
} from "lucide-react";
import { HorseImage, Notice, StatusBadge } from "@/components/horses/HorseUI";
import NotificationCenter from "@/components/shared/NotificationCenter";
import { errorMessage } from "@/api/horses/api";
import { useDashboardTab } from "@/shared/hooks/use-dashboard-tab";
import {
  getOwnerHorseDashboard,
  getOwnerHorses,
  getOwnershipTransferRequests,
  type OwnerDashboard,
  type OwnerHorse,
  type OwnershipTransferRequest,
} from "@/api/horse-owner/api";

type Tab = "overview" | "health" | "training" | "races" | "finance";
const workspaceTabIds: readonly Tab[] = ["overview", "health", "training", "races", "finance"];

const TABS: { id: Tab; label: string; icon: typeof Activity }[] = [
  { id: "overview", label: "Tổng quan", icon: ClipboardList },
  { id: "health", label: "Sức khỏe", icon: HeartPulse },
  { id: "training", label: "Tập luyện & video", icon: CalendarDays },
  { id: "races", label: "Thành tích", icon: Trophy },
  { id: "finance", label: "Tài chính", icon: Wallet },
];

export default function HorseOwnerWorkspace() {
  const [horses, setHorses] = useState<OwnerHorse[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [dashboard, setDashboard] = useState<OwnerDashboard | null>(null);
  const [tab, selectTab] = useDashboardTab(workspaceTabIds, "overview");
  const [year, setYear] = useState(new Date().getFullYear());
  const [loadingHorses, setLoadingHorses] = useState(true);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [transferRequests, setTransferRequests] = useState<OwnershipTransferRequest[]>([]);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

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
      setLoadingDashboard(true);
      setDashboard(null);
    }
    setError("");
    try {
      const result = await getOwnerHorseDashboard(selectedId, year);
      setDashboard(result);
      setUpdatedAt(new Date());
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      if (!silent) setLoadingDashboard(false);
    }
  }, [selectedId, year]);

  useEffect(() => {
    void refreshDashboard();
    const interval = window.setInterval(() => void refreshDashboard(true), 30_000);
    return () => window.clearInterval(interval);
  }, [refreshDashboard]);

  const currentHorse = dashboard?.horse.id === selectedId
    ? dashboard.horse
    : horses.find((horse) => horse.id === selectedId) ?? null;
  const recentMetrics = useMemo(() => dashboard?.training_metrics ?? [], [dashboard]);
  const latestWeight = recentMetrics.find((item) => item.body_weight_kg != null)?.body_weight_kg
    ?? currentHorse?.current_weight_kg
    ?? null;
  const selectedTab = TABS.find((item) => item.id === tab)!;
  const TabIcon = selectedTab.icon;

  return (
    <section className="mt-5 space-y-6" aria-label="Theo dõi ngựa">
      <div className="flex justify-end border-b border-equine-line pb-5">
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>{updatedAt ? `Cập nhật ${formatDateTime(updatedAt.toISOString())}` : "Tự cập nhật mỗi 30 giây"}</span>
          <button type="button" className="soft-button h-10 px-3" disabled={!selectedId || loadingDashboard} onClick={() => void refreshDashboard()} aria-label="Làm mới thông tin">
            <RefreshCw size={15} className={loadingDashboard ? "animate-spin" : ""} /> Làm mới
          </button>
        </div>
      </div>

      {error && <Notice error>{error}</Notice>}
      <NotificationCenter />
      {transferRequests.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-950 shadow-sm">
          <div>
            <p className="font-semibold">Bạn có {transferRequests.length} yêu cầu chuyển quyền sở hữu đang chờ xác nhận</p>
            <p className="mt-0.5 text-xs text-amber-800">
              {transferRequests.map((item) => item.horse_name).join(", ")} · Club Manager đã xem xét hồ sơ và cần bạn xác nhận đồng ý hoặc từ chối.
            </p>
          </div>
          <Link href={Routes.horses} className="gold-button !min-h-[36px] !px-3.5 !text-xs">
            Mở Yêu cầu hồ sơ để xác nhận
          </Link>
        </div>
      )}
      {loadingHorses ? <Notice>Đang tải ngựa thuộc sở hữu của bạn...</Notice> : horses.length === 0 ? (
        <div className="rounded-lg border border-equine-line bg-white p-6 shadow-sm">
          <Notice>Bạn chưa có ngựa được liên kết. Mở mục Yêu cầu hồ sơ để gửi yêu cầu đăng ký mới hoặc liên kết hồ sơ ngựa có sẵn.</Notice>
          <div className="mt-4">
            <Link href={Routes.horses} className="gold-button">Mở Yêu cầu hồ sơ</Link>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {horses.map((horse) => (
              <button key={horse.id} type="button" onClick={() => { setSelectedId(horse.id); selectTab("overview"); }}
                aria-pressed={selectedId === horse.id}
                className={`flex min-w-0 items-center gap-3 rounded-lg border p-3 text-left shadow-sm transition ${selectedId === horse.id ? "border-equine-navy bg-slate-50 ring-1 ring-equine-navy/20" : "border-equine-line bg-white hover:border-equine-teal/50"}`}>
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-equine-mist"><HorseImage horse={horse} /></div>
                <div className="min-w-0 flex-1"><p className="truncate font-semibold text-equine-navy">{horse.horse_name}</p><p className="truncate text-xs text-slate-500">{horse.breed ?? "Chưa cập nhật giống"} · {horse.box_code ?? "Chưa xếp chuồng"}</p></div>
                <StatusBadge horse={horse} />
              </button>
            ))}
          </div>

          {currentHorse && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-equine-line bg-white px-4 py-3 shadow-sm">
              <div className="text-sm text-slate-600"><strong className="text-equine-navy">{currentHorse.horse_name}</strong>{currentHorse.section ? ` · Khu ${currentHorse.section}` : ""}{updatedAt ? <span className="ml-2 text-xs text-slate-400">· Làm mới mỗi 30 giây</span> : null}</div>
              <Link href={Routes.horse(currentHorse.id)} className="text-sm font-semibold text-equine-navy underline underline-offset-4">Mở hồ sơ lý lịch</Link>
            </div>
          )}

          {loadingDashboard && !dashboard ? <Notice>Đang tải dữ liệu của {currentHorse?.horse_name}...</Notice> : dashboard?.horse.id === selectedId ? (
            <div className="space-y-5">
              <div className="flex items-center gap-2 text-equine-navy"><TabIcon size={19} /><h3 className="font-sans text-xl font-semibold">{selectedTab.label}</h3></div>
              {tab === "overview" && <OverviewPanel dashboard={dashboard} latestWeight={latestWeight} />}
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

function OverviewPanel({ dashboard, latestWeight }: { dashboard: OwnerDashboard; latestWeight: number | null }) {
  const horse = dashboard.horse;
  const nextSession = [...dashboard.training_schedules]
    .filter((item) => item.event_date >= new Date().toISOString().slice(0, 10) && item.status !== "Cancelled" && item.status !== "Completed")
    .sort((a, b) => a.event_date.localeCompare(b.event_date))[0];
  const earned = dashboard.race_history.reduce((sum, item) => sum + (item.prize_amount ?? 0), 0);
  return (
    <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
      <Panel title="Hồ sơ & dòng dõi" icon={ClipboardList}>
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoTile label="Giống" value={horse.breed ?? "Chưa cập nhật"} />
          <InfoTile label="Năm sinh" value={horse.birth_year == null ? "Chưa cập nhật" : String(horse.birth_year)} />
          <InfoTile label="Tên cha" value={horse.pedigree_father ?? "Chưa cập nhật"} />
          <InfoTile label="Tên mẹ" value={horse.pedigree_mother ?? "Chưa cập nhật"} />
          <InfoTile label="Microchip" value={horse.microchip_number ?? "Chưa cập nhật"} />
          <InfoTile label="Hộ chiếu ngựa" value={horse.passport_number ?? "Chưa cập nhật"} />
          <InfoTile label="Chiều cao đến vai" value={horse.height_cm == null ? "Chưa cập nhật" : `${horse.height_cm} cm`} />
          <InfoTile label="Chuồng" value={horse.box_code ?? "Chưa xếp chuồng"} />
          <InfoTile label="Chủ sở hữu" value={horse.owner_name ?? "Bạn"} />
        </div>
      </Panel>
      <div className="space-y-5">
        <Panel title="Sức khỏe & sẵn sàng thi đấu" icon={Activity}>
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoTile label="Tình trạng sức khỏe" value={healthLabel(horse.current_status)} />
            <InfoTile label="Sẵn sàng thi đấu" value={readinessLabel(horse.readiness_status)} />
            <InfoTile label="Cân nặng gần nhất" value={latestWeight == null ? "Chưa có dữ liệu" : `${latestWeight} kg`} />
            <InfoTile label="Huấn luyện" value={horse.is_training_locked ? "Đang tạm khóa" : "Không bị khóa"} />
          </div>
          {horse.is_training_locked && horse.lock_reason && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Lý do tạm khóa: {horse.lock_reason}</p>}
        </Panel>
        <Panel title="Sắp tới & thành tích" icon={CalendarDays}>
          {nextSession ? <p className="text-sm text-slate-700"><strong>{nextSession.session_type ?? "Buổi tập"}</strong> · {formatDate(nextSession.event_date)}{nextSession.start_time ? ` lúc ${formatTime(nextSession.start_time)}` : ""}{nextSession.track_surface ? ` · ${nextSession.track_surface}` : ""}</p> : <Empty>Chưa có lịch tập sắp tới.</Empty>}
          <p className="mt-3 text-sm text-slate-600">{dashboard.race_history.length} lần ghi danh thi đấu · {money(earned)} tiền thưởng đã ghi nhận</p>
        </Panel>
      </div>
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
        <InfoTile label="Khóa huấn luyện" value={horse.is_training_locked ? horse.lock_level ?? "Đang khóa" : "Không khóa"} detail={horse.is_training_locked ? horse.lock_reason ?? undefined : undefined} />
      </div>
      <Panel title="Chỉ số khám gần đây" icon={HeartPulse}>
        {dashboard.health_exams.length === 0 ? <Empty>Chưa có lần khám nào được ghi nhận.</Empty> : <div className="space-y-3">{dashboard.health_exams.map((exam) => (
          <article key={exam.id} className="rounded-xl border border-equine-line bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-semibold text-equine-navy">{formatDateTime(exam.exam_date)}{exam.doctor_name ? ` · Bác sĩ ${exam.doctor_name}` : ""}</h4>{exam.body_condition_score != null && <span className="rounded-full bg-equine-mist px-3 py-1 text-xs font-semibold">Điểm thể trạng {exam.body_condition_score}/5</span>}</div>
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
      <Panel title="Lịch tập luyện" icon={CalendarDays}>
        {dashboard.training_schedules.length === 0 ? <Empty>Chưa có lịch tập luyện được công bố.</Empty> : <div className="space-y-2">{dashboard.training_schedules.map((item) => <article key={item.id} className="flex flex-col gap-2 rounded-xl border border-equine-line p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-equine-navy">{item.title ?? sessionLabel(item.session_type)}</p><p className="mt-1 text-sm text-slate-600">{formatDate(item.event_date)}{item.start_time ? ` · ${formatTime(item.start_time)}` : ""}{item.end_time ? `–${formatTime(item.end_time)}` : ""}{item.track_surface ? ` · ${item.track_surface}` : ""}{item.stage_name ? ` · ${item.stage_name}` : ""}</p></div><span className="w-fit rounded-full bg-equine-mist px-3 py-1 text-xs font-semibold text-equine-navy">{scheduleStatus(item.status)}</span></article>)}</div>}
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
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">Báo cáo định kỳ</p><h4 className="mt-1 font-sans text-xl font-semibold text-equine-navy">Thu chi theo tháng</h4></div><label className="text-sm font-medium text-slate-600">Năm báo cáo<select aria-label="Năm báo cáo" value={year} onChange={(event) => onYearChange(Number(event.target.value))} className="field-control ml-2 inline-flex h-10 w-28 px-3">{Array.from({ length: new Date().getFullYear() - 1999 }, (_, index) => new Date().getFullYear() - index).map((item) => <option key={item} value={item}>{item}</option>)}</select></label></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><InfoTile label="Chi phí nuôi dưỡng" value={money(totals.care_cost)} /><InfoTile label="Chi phí y tế" value={money(totals.medical_cost)} /><InfoTile label="Tổng chi phí đã phân loại" value={money(totals.total_expenses)} /><InfoTile label="Doanh thu tiền thưởng" value={money(totals.prize_income)} /></div>
      {totals.other_amount > 0 && <p className="rounded-xl border border-equine-line bg-white p-3 text-xs text-slate-500">Chưa phân loại: {money(totals.other_amount)}.</p>}
      <Panel title="Tổng hợp từng tháng" icon={Wallet}>
        {report.monthly.length === 0 ? <Empty>Chưa có giao dịch tài chính cho năm {year}.</Empty> : <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr><th className="pb-3 pr-4">Kỳ</th><th className="pb-3 pr-4">Nuôi dưỡng</th><th className="pb-3 pr-4">Y tế</th><th className="pb-3 pr-4">Tiền thưởng</th><th className="pb-3">Khác</th></tr></thead><tbody>{report.monthly.map((month) => <tr key={month.billing_period} className="border-t border-equine-line"><td className="py-3 pr-4 font-semibold">{month.billing_period}</td><td className="py-3 pr-4">{money(month.care_cost)}</td><td className="py-3 pr-4">{money(month.medical_cost)}</td><td className="py-3 pr-4">{money(month.prize_income)}</td><td className="py-3">{money(month.other_amount)}</td></tr>)}</tbody></table></div>}
      </Panel>
      <Panel title="Các khoản đã ghi nhận" icon={ClipboardList}>
        {report.transactions.length === 0 ? <Empty>Chưa có khoản thu chi trong kỳ.</Empty> : <div className="space-y-2">{report.transactions.map((transaction) => <article key={transaction.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-equine-line p-3"><div><p className="font-semibold text-equine-navy">{financialCategory(transaction.category)} · {transaction.transaction_type}</p><p className="mt-1 text-xs text-slate-500">Kỳ {transaction.billing_period} · {formatDateTime(transaction.created_at)}</p></div><strong className="text-sm text-equine-navy">{money(transaction.amount)}</strong></article>)}</div>}
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
  return <section className="rounded-lg border border-equine-line bg-white p-4 shadow-sm sm:p-5"><h2 className="mb-4 flex items-center gap-2 font-sans text-lg font-normal text-equine-navy"><Icon size={18} />{title}</h2>{children}</section>;
}

function InfoTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="rounded-lg border border-equine-line bg-[#f8fafc] p-4"><p className="text-xs font-normal uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 break-words text-sm font-semibold text-equine-navy">{value}</p>{detail && <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>}</div>;
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg bg-[#f8fafc] p-4 text-sm text-slate-500">{children}</p>;
}

function healthLabel(value: string) {
  return ({ Healthy: "Khỏe mạnh", Injured: "Chấn thương", Quarantine: "Cách ly", Monitoring: "Đang theo dõi", "Under Observation": "Cần theo dõi", Sick: "Đang bệnh" } as Record<string, string>)[value] ?? value;
}

function readinessLabel(value: string | null | undefined) {
  return ({ Ready: "Sẵn sàng", NotReady: "Chưa sẵn sàng", Unknown: "Chưa đánh giá" } as Record<string, string>)[value ?? ""] ?? "Chưa đánh giá";
}

function sessionLabel(value: string | null | undefined) {
  return ({ TrialRun: "Đua thử", Race: "Đua thử", Training: "Tập luyện" } as Record<string, string>)[value ?? ""] ?? value ?? "Buổi tập";
}

function scheduleStatus(value: string | null) {
  return ({ Scheduled: "Đã lên lịch", Blocked: "Bị chặn do khóa y tế", InProgress: "Đang diễn ra", Completed: "Hoàn thành", Cancelled: "Đã hủy" } as Record<string, string>)[value ?? ""] ?? value ?? "Chưa xác định";
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

function money(value: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(date);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(date);
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
