"use client";

import { formatDisplayDate } from "@/lib/display-format";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Activity, AlertTriangle, ArrowLeft, ArrowRight, CalendarDays, Check, ClipboardCheck, Clock, MapPin, Package, Plus, RefreshCw, Utensils } from "lucide-react";
import { subscribeWorkspaceSync } from "@/api/horses/api";
import { Notice } from "@/components/horses/HorseUI";
import IncidentPhoto from "@/components/groom/IncidentPhoto";
import { WorkspaceSkeleton } from "@/components/shared/LoadingSkeletons";
import { useAutoRefresh } from "@/shared/hooks/use-auto-refresh";
import { useDashboardTab } from "@/shared/hooks/use-dashboard-tab";
import {
  completeGroomTrainingSession,
  completeGroomTask,
  createGroomSupplyRequest,
  getGroomCalendar,
  getGroomCalendarRange,
  getGroomDietRecords,
  getGroomIncidents,
  getGroomInventory,
  getMyGroomHorses,
  getGroomSupplyRequests,
  recordGroomInventoryUsage,
  reportGroomIncident,
  submitGroomIncidentResult,
  uploadGroomIncidentImage,
  type GroomCalendar,
  type GroomDietRecord,
  type GroomIncident,
  type GroomInventoryItem,
  type GroomHorse,
  type GroomSupplyRequest,
  type GroomWeekCalendar,
} from "@/api/groom/api";

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function plusDays(isoDate: string, days: number) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const next = new Date(y, (m || 1) - 1, (d || 1) + days);
  return dateKey(next);
}

function mondayOfWeek(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  const offset = (dt.getDay() + 6) % 7;
  return plusDays(isoDate, -offset);
}

const GROOM_SLOTS = [
  { id: 1, label: "Ca 1", range: "07:00 – 08:30" },
  { id: 2, label: "Ca 2", range: "08:45 – 10:15" },
  { id: 3, label: "Ca 3", range: "10:30 – 12:00" },
  { id: 4, label: "Ca 4", range: "12:30 – 14:00" },
  { id: 5, label: "Ca 5", range: "14:15 – 15:45" },
  { id: 6, label: "Ca 6", range: "16:15 – 17:45" },
] as const;

function slotForStartTime(startTime?: string | null): number {
  const hhmm = (startTime ?? "").slice(0, 5);
  if (!hhmm || hhmm < "08:40") return 1;
  if (hhmm < "10:25") return 2;
  if (hhmm < "12:15") return 3;
  if (hhmm < "14:10") return 4;
  if (hhmm < "16:00") return 5;
  return 6;
}

function groomDayLabel(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const day = new Date(y, (m || 1) - 1, d || 1).getDay();
  return ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"][day] ?? isoDate;
}

function groomTaskLabel(taskType: string) {
  return ({ Feeding: "Cho ăn", Cleaning: "Vệ sinh chuồng", Bathing: "Tắm ngựa", IceBath: "Chườm đá" } as Record<string, string>)[taskType] ?? taskType;
}

function groomSessionTypeLabel(sessionType: string) {
  return ({ Training: "Huấn luyện", TrialRun: "Chạy thử", Rest: "Nghỉ dưỡng" } as Record<string, string>)[sessionType] ?? sessionType;
}

function groomSurfaceLabel(surface?: string | null) {
  if (!surface) return "";
  return ({ Dirt: "Đất", Turf: "Cỏ", Synthetic: "Nhân tạo" } as Record<string, string>)[surface] ?? surface;
}

function groomStatusBadge(status: string, kind: "training" | "task"): { label: string; cls: string } {
  if (kind === "task") {
    return ({
      Pending: { label: "Chờ làm", cls: "border-amber-200 bg-amber-50 text-amber-900" },
      Completed: { label: "Đã xong", cls: "border-emerald-200 bg-emerald-50 text-emerald-800" },
      Cancelled: { label: "Đã hủy", cls: "border-slate-200 bg-slate-100 text-slate-600" },
    } as Record<string, { label: string; cls: string }>)[status] ?? { label: status, cls: "border-slate-200 bg-slate-50 text-slate-700" };
  }
  return ({
    Scheduled: { label: "Đã lên lịch", cls: "border-blue-200 bg-blue-50 text-blue-900" },
    Blocked: { label: "🔒 Tạm khóa y tế", cls: "border-rose-300 bg-rose-100 text-rose-900" },
    InProgress: { label: "Đang tập", cls: "border-sky-300 bg-sky-100 text-sky-900" },
    Completed: { label: "Hoàn thành", cls: "border-emerald-200 bg-emerald-50 text-emerald-800" },
    Missed: { label: "Bỏ lỡ", cls: "border-amber-300 bg-amber-50 text-amber-900" },
    Cancelled: { label: "Đã hủy", cls: "border-slate-200 bg-slate-100 text-slate-600" },
  } as Record<string, { label: string; cls: string }>)[status] ?? { label: status, cls: "border-slate-200 bg-slate-50 text-slate-700" };
}

function groomHorseStatusBadge(status: string): { label: string; cls: string } {
  return ({
    Healthy: { label: "Khỏe mạnh", cls: "border-emerald-200 bg-emerald-50 text-emerald-800" },
    Monitoring: { label: "Cần theo dõi", cls: "border-amber-200 bg-amber-50 text-amber-900" },
    "Under Observation": { label: "Đang theo dõi", cls: "border-amber-200 bg-amber-50 text-amber-900" },
    Injured: { label: "Chấn thương", cls: "border-rose-200 bg-rose-50 text-rose-800" },
    Quarantine: { label: "Cách ly", cls: "border-purple-200 bg-purple-50 text-purple-800" },
    Sick: { label: "Đang ốm", cls: "border-rose-200 bg-rose-50 text-rose-800" },
  } as Record<string, { label: string; cls: string }>)[status] ?? { label: status, cls: "border-slate-200 bg-slate-50 text-slate-700" };
}

function groomIncidentStatusBadge(status: string): { label: string; cls: string } {
  return ({
    Open: { label: "Mới báo cáo", cls: "border-amber-200 bg-amber-50 text-amber-900" },
    Pending: { label: "Chờ xử lý", cls: "border-amber-200 bg-amber-50 text-amber-900" },
    InProgress: { label: "Đang xử lý", cls: "border-sky-200 bg-sky-50 text-sky-900" },
    AwaitingClosure: { label: "Chờ đóng", cls: "border-indigo-200 bg-indigo-50 text-indigo-900" },
    Resolved: { label: "Đã xử lý", cls: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  } as Record<string, { label: string; cls: string }>)[status] ?? { label: status, cls: "border-slate-200 bg-slate-100 text-slate-700" };
}

function groomSupplyStatusBadge(status: string): { label: string; cls: string } {
  return ({
    Pending: { label: "Chờ duyệt", cls: "border-amber-200 bg-amber-50 text-amber-900" },
    Approved: { label: "Đã duyệt", cls: "border-emerald-200 bg-emerald-50 text-emerald-800" },
    PartiallyApproved: { label: "Duyệt một phần", cls: "border-sky-200 bg-sky-50 text-sky-900" },
    Rejected: { label: "Từ chối", cls: "border-rose-200 bg-rose-50 text-rose-800" },
  } as Record<string, { label: string; cls: string }>)[status] ?? { label: status, cls: "border-slate-200 bg-slate-100 text-slate-700" };
}

const groomTabs = ["overview", "calendar", "horses", "diet", "inventory", "incidents"] as const;

export default function GroomWorkspace() {
  const [tab, setTab] = useDashboardTab(groomTabs, "overview");
  const [date, setDate] = useState(() => dateKey(new Date()));
  const [weekFrom, setWeekFrom] = useState(() => mondayOfWeek(dateKey(new Date())));
  const weekTo = useMemo(() => plusDays(weekFrom, 6), [weekFrom]);
  const [horses, setHorses] = useState<GroomHorse[]>([]);
  const [calendar, setCalendar] = useState<GroomCalendar | null>(null);
  const [weekCalendar, setWeekCalendar] = useState<GroomWeekCalendar | null>(null);
  const [diets, setDiets] = useState<(GroomDietRecord & { horse_name: string; box_code: string | null })[]>([]);
  const [inventory, setInventory] = useState<GroomInventoryItem[]>([]);
  const [incidents, setIncidents] = useState<GroomIncident[]>([]);
  const [supplyRequests, setSupplyRequests] = useState<GroomSupplyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const horseById = useMemo(() => new Map(horses.map((horse) => [horse.id, horse])), [horses]);
  const trainingEvents = calendar?.events.filter((event) => event.type === "training") ?? [];
  const careTasks = calendar?.events.filter((event) => event.type === "care_task") ?? [];
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => plusDays(weekFrom, i)), [weekFrom]);
  const weekTrainingEvents = useMemo(() => (weekCalendar?.events ?? []).filter((event) => event.type === "training"), [weekCalendar]);
  const weekCareTasks = useMemo(() => (weekCalendar?.events ?? []).filter((event) => event.type === "care_task"), [weekCalendar]);
  const weekBlockedCount = useMemo(
    () => weekTrainingEvents.filter((event) => event.status === "Blocked" || event.is_training_locked).length,
    [weekTrainingEvents],
  );
  const activeIncidentCount = incidents.filter((item) => ["Open", "Pending", "InProgress", "AwaitingClosure"].includes(item.status)).length;

  const load = useCallback(async () => {
    setError("");
    try {
      const assigned = await getMyGroomHorses();
      const [dailyCalendar, weeklyCalendar, dietPages, inventoryPage, incidentPage, requestPage] = await Promise.all([
        getGroomCalendar(date),
        getGroomCalendarRange(weekFrom, weekTo),
        Promise.all(assigned.data.map((horse) => getGroomDietRecords(horse.id, date))),
        getGroomInventory(), getGroomIncidents(), getGroomSupplyRequests(),
      ]);
      setHorses(assigned.data);
      setCalendar(dailyCalendar);
      setWeekCalendar(weeklyCalendar);
      setDiets(dietPages.flatMap((page, index) => page.data.map((diet) => ({
        ...diet, horse_name: assigned.data[index].horse_name,
        box_code: assigned.data[index].stable_box?.box_code ?? null,
      }))));
      setInventory(inventoryPage.data);
      setIncidents(incidentPage.data);
      setSupplyRequests(requestPage.data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tải lịch chăm sóc.");
    } finally {
      setLoading(false);
    }
  }, [date, weekFrom, weekTo]);

  useEffect(() => { void load(); }, [load]);
  useAutoRefresh(load, { enabled: !busy, intervalMs: 10_000, minGapMs: 2_000 });
  useEffect(() => {
    const refreshSilently = () => { void load(); };
    const unsubscribe = subscribeWorkspaceSync((detail) => {
      if (detail.kind === "schedule" || detail.kind === "horse-health" || detail.kind === "horse-profile") refreshSilently();
    });
    window.addEventListener("racehorse:notification-arrived", refreshSilently);
    return () => {
      unsubscribe();
      window.removeEventListener("racehorse:notification-arrived", refreshSilently);
    };
  }, [load]);

  async function markTaskComplete(id: string) {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await completeGroomTask(id);
      setNotice(result.already_completed ? "Công việc này đã được hoàn thành." : "Đã xác nhận hoàn thành công việc chăm sóc.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể hoàn thành công việc.");
    } finally {
      setBusy(false);
    }
  }

  async function markTrainingComplete(id: string) {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await completeGroomTrainingSession(id);
      setNotice(result.already_completed ? "Buổi tập này đã được xác nhận hoàn thành." : "Đã xác nhận buổi tập đã thực hiện và gửi cập nhật cho Head Trainer.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể xác nhận buổi tập.");
    } finally { setBusy(false); }
  }

  async function incident(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true); setError(""); setNotice("");
    try {
      const selectedFile = values.get("image_file");
      if (selectedFile instanceof File && selectedFile.size > 0) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(selectedFile.type) || selectedFile.size > 5 * 1024 * 1024) {
          setError("Ảnh sự cố phải là JPG, PNG hoặc WebP và không vượt quá 5 MB.");
          return;
        }
      }
      const imagePath = selectedFile instanceof File && selectedFile.size > 0
        ? (await uploadGroomIncidentImage(selectedFile)).imagePath
        : undefined;
      await reportGroomIncident(
        String(values.get("horse_id")),
        String(values.get("issue_description")),
        imagePath,
        values.get("is_emergency") === "on",
      );
      form.reset();
      await load();
      setNotice(values.get("is_emergency") === "on"
        ? "Đã gửi báo cáo khẩn cấp cho bác sĩ thú y, Club Manager và chủ ngựa; huấn luyện viên phụ trách kế hoạch/lịch tập cũng được báo."
        : "Đã gửi báo cáo cho Club Manager và chủ ngựa; huấn luyện viên được báo nếu đang phụ trách kế hoạch hoặc lịch tập của ngựa.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể gửi báo cáo sự cố.");
    } finally {
      setBusy(false);
    }
  }

  async function submitIncidentResult(event: FormEvent<HTMLFormElement>, incidentId: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const resultNote = String(new FormData(form).get("result_note") ?? "").trim();
    setBusy(true); setError(""); setNotice("");
    try {
      await submitGroomIncidentResult(incidentId, resultNote);
      setNotice("Đã gửi kết quả để Club Manager xem xét đóng sự cố.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể gửi kết quả xử lý.");
    } finally { setBusy(false); }
  }

  async function requestSupply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true); setError(""); setNotice("");
    try {
      await createGroomSupplyRequest({
        item_id: String(values.get("item_id")),
        quantity_requested: Number(values.get("quantity_requested")),
        reason: String(values.get("reason") ?? "").trim() || undefined,
      });
      form.reset();
      setNotice("Đã gửi đề xuất bổ sung vật tư cho Club Manager.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể gửi đề xuất vật tư.");
    } finally { setBusy(false); }
  }

  async function recordInventoryUsage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await recordGroomInventoryUsage({
        item_id: String(values.get("item_id")),
        quantity: Number(values.get("quantity")),
        reason: String(values.get("reason") ?? "").trim() || undefined,
      });
      form.reset();
      setNotice(`Đã ghi nhận sử dụng ${Math.abs(result.quantity_change)} đơn vị. Tồn còn ${result.quantity_after}.`);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể ghi nhận lượng vật tư đã sử dụng.");
    } finally { setBusy(false); }
  }

  const todayIso = dateKey(new Date());
  const dateShort = date === todayIso ? "hôm nay" : formatDisplayDate(date);
  return <section className="mt-4 space-y-5" aria-label="Chăm sóc ngựa">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
      <div className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setTab("overview")}
          className={`inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-xs font-semibold transition ${
            tab === "overview" ? "bg-[#1040C5] text-white shadow-xs" : "text-slate-600 hover:bg-white hover:text-slate-900"
          }`}
        >
          <ClipboardCheck size={14} /> Việc {dateShort} ({careTasks.length + trainingEvents.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("calendar")}
          className={`inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-xs font-semibold transition ${
            tab === "calendar" ? "bg-[#1040C5] text-white shadow-xs" : "text-slate-600 hover:bg-white hover:text-slate-900"
          }`}
        >
          <CalendarDays size={14} /> Lịch làm việc cả tuần ({weekTrainingEvents.length + weekCareTasks.length})
        </button>
      </div>
      <div className="flex items-center gap-2">
        <input
          aria-label="Ngày công việc"
          type="date"
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none transition focus:border-blue-500"
          value={date}
          onChange={(event) => {
            const nextDate = event.target.value;
            if (!nextDate) return;
            setDate(nextDate);
            setWeekFrom(mondayOfWeek(nextDate));
          }}
        />
        <button
          type="button"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          onClick={() => void load()}
          disabled={busy}
        >
          <RefreshCw size={14} /> Làm mới
        </button>
      </div>
    </div>
    {error && <Notice error>{error}</Notice>}{notice && <Notice>{notice}</Notice>}

    {loading && !calendar && horses.length === 0 ? <WorkspaceSkeleton label="Đang tải lịch chăm sóc…" /> : <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <button
          type="button"
          onClick={() => setTab("horses")}
          className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-3.5 text-left shadow-2xs transition hover:border-blue-300 hover:shadow-sm"
        >
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Ngựa được giao</span>
          <strong className="mt-1.5 text-xl font-extrabold tabular-nums text-equine-navy">{horses.length}</strong>
        </button>
        <button
          type="button"
          onClick={() => setTab("overview")}
          className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-3.5 text-left shadow-2xs transition hover:border-blue-300 hover:shadow-sm"
        >
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Việc chăm sóc ({dateShort})</span>
          <strong className="mt-1.5 text-xl font-extrabold tabular-nums text-amber-700">{careTasks.length}</strong>
        </button>
        <button
          type="button"
          onClick={() => setTab("overview")}
          className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-3.5 text-left shadow-2xs transition hover:border-blue-300 hover:shadow-sm"
        >
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Buổi tập ({dateShort})</span>
          <strong className="mt-1.5 text-xl font-extrabold tabular-nums text-blue-700">{trainingEvents.length}</strong>
        </button>
        <button
          type="button"
          onClick={() => setTab("calendar")}
          className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-3.5 text-left shadow-2xs transition hover:border-blue-300 hover:shadow-sm"
        >
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Lịch tập tuần này</span>
          <div className="mt-1.5 flex flex-wrap items-baseline gap-1.5">
            <strong className="text-xl font-extrabold tabular-nums text-equine-navy">{weekTrainingEvents.length} buổi</strong>
            {weekBlockedCount > 0 && (
              <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-800">{weekBlockedCount} khóa</span>
            )}
          </div>
        </button>
        <button
          type="button"
          onClick={() => setTab("incidents")}
          className="col-span-2 flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-3.5 text-left shadow-2xs transition hover:border-blue-300 hover:shadow-sm sm:col-span-1"
        >
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Sự cố đang xử lý</span>
          <strong className={`mt-1.5 text-xl font-extrabold tabular-nums ${activeIncidentCount > 0 ? "text-rose-700" : "text-slate-700"}`}>
            {activeIncidentCount}
          </strong>
        </button>
      </div>

    <section hidden={tab !== "horses"} id="groom-horses" className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs sm:p-5">
      <div className="mb-3.5 flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <h3 className="font-sans text-base font-bold text-equine-navy">Chuồng phụ trách ({horses.length})</h3>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {horses.map((horse) => {
          const badge = groomHorseStatusBadge(horse.current_status);
          return (
            <article key={horse.id} className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 transition hover:border-slate-300">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  {horse.stable_box ? `Khu ${horse.stable_box.section ?? "—"} · Chuồng ${horse.stable_box.box_code}` : "Chưa xếp chuồng"}
                </p>
                <p className="mt-1.5 text-sm font-bold text-equine-navy">{horse.horse_name}</p>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badge.cls}`}>{badge.label}</span>
                {horse.is_training_locked && (
                  <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-800">
                    🔒 Khóa tập
                  </span>
                )}
              </div>
            </article>
          );
        })}
        {!horses.length && <p className="text-sm text-slate-500 sm:col-span-2 lg:col-span-4">Chưa có ngựa được phân công trong phạm vi lịch hiện tại.</p>}
      </div>
    </section>

    <div hidden={tab !== "overview"} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50/60 px-4 py-2.5 text-xs text-blue-950">
        <span>
          Tổng hợp tuần <strong>{formatDisplayDate(weekFrom)} → {formatDisplayDate(weekTo)}</strong>:{" "}
          <strong>{weekTrainingEvents.length}</strong> buổi tập hỗ trợ · <strong>{weekCareTasks.length}</strong> việc chăm sóc chuồng
          {weekBlockedCount > 0 && <> · <strong className="text-rose-700">{weekBlockedCount} buổi đang tạm khóa y tế</strong></>}
        </span>
        <button type="button" onClick={() => setTab("calendar")} className="shrink-0 whitespace-nowrap rounded-lg border border-blue-300 bg-white px-2.5 py-1 text-[11px] font-bold text-blue-900 transition hover:bg-blue-100">
          Mở bảng lịch tuần →
        </button>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <section id="care-tasks" className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs sm:p-5">
          <h3 className="mb-4 flex items-center gap-2 font-sans text-base font-bold text-equine-navy"><ClipboardCheck size={18} /> Việc chăm sóc · {formatDisplayDate(date)}</h3>
          <div className="space-y-3">
            {careTasks.map((task) => {
              if (task.type !== "care_task") return null;
              const horse = horseById.get(task.horse.id);
              const badge = groomStatusBadge(task.status, "task");
              return <article key={task.task_id} className="flex flex-col gap-3 rounded-xl border border-slate-200 border-l-4 border-l-amber-500 bg-white p-3.5 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-equine-navy">{groomTaskLabel(task.task_type)} · {task.horse.horse_name}</p>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badge.cls}`}>{badge.label}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{horse?.stable_box?.box_code ? `Chuồng ${horse.stable_box.box_code} · ` : ""}{formatDisplayDate(date)}</p>
                </div>
                {task.status === "Pending" && date <= todayIso && (
                  <button
                    type="button"
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-emerald-300 bg-emerald-50 px-3 text-xs font-semibold text-emerald-900 transition hover:bg-emerald-100 disabled:opacity-50"
                    disabled={busy}
                    onClick={() => void markTaskComplete(task.task_id)}
                  >
                    <Check size={14} /> Hoàn thành
                  </button>
                )}
              </article>;
            })}
            {!careTasks.length && <p className="rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500">Chưa có việc chăm sóc trong ngày {formatDisplayDate(date)}.</p>}
          </div>
        </section>
        <section id="training-support" className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs sm:p-5">
          <h3 className="mb-4 flex items-center gap-2 font-sans text-base font-bold text-equine-navy"><CalendarDays size={18} /> Buổi tập cần hỗ trợ · {formatDisplayDate(date)}</h3>
          <div className="space-y-3">
            {trainingEvents.map((event) => {
              if (event.type !== "training") return null;
              const isLocked = event.status === "Blocked" || Boolean(event.is_training_locked);
              const badge = groomStatusBadge(event.status, "training");
              const boxCode = event.box_code ?? horseById.get(event.horse.id)?.stable_box?.box_code ?? null;
              const surface = groomSurfaceLabel(event.track_surface);
              return <article key={event.event_id} className={`rounded-xl border border-l-4 p-3.5 ${isLocked ? "border-rose-200 border-l-rose-600 bg-rose-50/40" : event.status === "Completed" ? "border-emerald-200 border-l-emerald-600 bg-emerald-50/30" : "border-slate-200 border-l-blue-600 bg-white"}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-equine-navy">{event.horse.horse_name}</p>
                    <p className="mt-0.5 text-xs font-medium text-slate-700">{groomSessionTypeLabel(event.session_type)}{event.plan_stage_name ? ` · ${event.plan_stage_name}` : ""}</p>
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badge.cls}`}>{badge.label}</span>
                </div>
                <p className="mt-1.5 text-xs text-slate-500">
                  {event.start_time ?? "Chưa đặt giờ"}{event.end_time ? `–${event.end_time}` : ""}
                  {surface ? ` · Sân ${surface}` : ""}
                  {boxCode ? ` · Chuồng ${boxCode}` : ""}
                </p>
                {event.note && <p className="mt-2 text-sm text-slate-600">{event.note}</p>}
                {isLocked && (
                  <p className="mt-2.5 rounded-lg border border-rose-200 bg-rose-100/70 px-2.5 py-1.5 text-xs font-semibold text-rose-900">
                    🔒 Ngựa đang bị khóa y tế/chấn thương{event.lock_reason ? ` (${event.lock_reason})` : ""} — tạm hoãn buổi tập.
                  </p>
                )}
                {!isLocked && event.sensor_running && <p className="mt-3 text-xs text-equine-navy">Đang thu chỉ số. Lưu trước khi hoàn thành.</p>}
                {event.status === "Completed" ? <p className="mt-3 text-xs font-semibold text-emerald-700">✓ Buổi tập đã được xác nhận.</p>
                  : !isLocked && !event.sensor_running && (event.status === "InProgress" || (event.session_type === "Rest" && event.status === "Scheduled"))
                    && new Date(`${event.event_date}T${event.end_time ?? "00:00"}:00+07:00`) <= new Date()
                    && (
                      <button
                        type="button"
                        className="mt-3 inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                        disabled={busy}
                        onClick={() => void markTrainingComplete(event.training_schedule_id)}
                      >
                        <Check size={14} /> Xác nhận đã tập
                      </button>
                    )}
              </article>;
            })}
            {!trainingEvents.length && <p className="rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500">Chưa có buổi tập trong ngày {formatDisplayDate(date)}.</p>}
          </div>
        </section>
      </div>
    </div>

    <section hidden={tab !== "calendar"} id="groom-weekly-calendar" className="scroll-mt-24 space-y-3.5 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="flex items-center gap-2 font-sans text-base font-bold text-equine-navy">
              <CalendarDays size={18} /> Lịch làm việc tuần ({formatDisplayDate(weekFrom)} → {formatDisplayDate(weekTo)})
            </h3>
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-800">{weekTrainingEvents.length} buổi tập</span>
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">{weekCareTasks.length} việc chăm sóc</span>
            {weekBlockedCount > 0 && (
              <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-bold text-rose-800">🔒 {weekBlockedCount} tạm khóa</span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-500">Theo dõi toàn bộ buổi tập hỗ trợ và công việc chăm sóc chuồng theo từng khung giờ.</p>
        </div>
        <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            className="inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-md px-2.5 text-xs font-semibold text-slate-700 transition hover:bg-white"
            onClick={() => setWeekFrom((curr) => plusDays(curr, -7))}
          >
            <ArrowLeft size={13} /> Tuần trước
          </button>
          <button
            type="button"
            className="inline-flex h-7 items-center whitespace-nowrap rounded-md bg-white px-2.5 text-xs font-semibold text-equine-navy shadow-2xs transition hover:bg-slate-100"
            onClick={() => setWeekFrom(mondayOfWeek(todayIso))}
          >
            Tuần hiện tại
          </button>
          <button
            type="button"
            className="inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-md px-2.5 text-xs font-semibold text-slate-700 transition hover:bg-white"
            onClick={() => setWeekFrom((curr) => plusDays(curr, 7))}
          >
            Tuần sau <ArrowRight size={13} />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[980px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="w-28 border-r border-slate-200 p-2.5 text-center text-[11px] font-extrabold uppercase tracking-wide text-slate-600">Khung giờ</th>
              {weekDays.map((day) => {
                const isToday = day === todayIso;
                return (
                  <th key={day} className={`border-r border-slate-200 p-2.5 text-center last:border-r-0 ${isToday ? "border-b-2 border-b-emerald-600 bg-emerald-50 text-emerald-950" : "text-slate-800"}`}>
                    <div className="flex flex-col items-center">
                      <span className="font-bold">{groomDayLabel(day)} ({day.slice(8, 10)}/{day.slice(5, 7)})</span>
                      {isToday && <span className="mt-0.5 rounded bg-emerald-700 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">Hôm nay</span>}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {GROOM_SLOTS.map((slot) => (
              <tr key={slot.id} className="align-top">
                <td className="border-r border-slate-200 bg-slate-50/70 p-2.5 text-center">
                  <strong className="block font-bold text-equine-navy">{slot.label}</strong>
                  <span className="text-[11px] text-slate-500">{slot.range}</span>
                </td>
                {weekDays.map((day) => {
                  const items = weekTrainingEvents.filter(
                    (event) => event.type === "training" && event.event_date === day && slotForStartTime(event.start_time) === slot.id,
                  );
                  return (
                    <td key={day} className={`min-w-[132px] border-r border-slate-200 p-2 last:border-r-0 ${day === todayIso ? "bg-emerald-50/20" : "bg-white"}`}>
                      {items.length === 0 ? (
                        <div className="py-3 text-center text-[11px] text-slate-300">—</div>
                      ) : (
                        <div className="space-y-1.5">
                          {items.map((item) => {
                            if (item.type !== "training") return null;
                            const isLocked = item.status === "Blocked" || Boolean(item.is_training_locked);
                            const badge = groomStatusBadge(item.status, "training");
                            const boxCode = item.box_code ?? horseById.get(item.horse.id)?.stable_box?.box_code ?? null;
                            const canComplete = !isLocked && !item.sensor_running
                              && (item.status === "InProgress" || (item.session_type === "Rest" && item.status === "Scheduled"))
                              && new Date(`${item.event_date}T${item.end_time ?? "00:00"}:00+07:00`) <= new Date();
                            return (
                              <div key={item.training_schedule_id} className={`rounded-lg border border-l-4 p-2 shadow-2xs ${isLocked ? "border-rose-200 border-l-rose-600 bg-rose-50/70" : item.status === "Completed" ? "border-emerald-200 border-l-emerald-600 bg-emerald-50/60" : "border-slate-200 border-l-blue-600 bg-slate-50/50"}`}>
                                <strong className="block truncate font-bold text-slate-900">🐎 {item.horse.horse_name}</strong>
                                <span className={`mt-1 inline-flex rounded border px-1.5 py-0.5 text-[10px] font-bold ${badge.cls}`}>{badge.label}</span>
                                <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-700">
                                  <Clock size={11} /> {item.start_time ?? "—"}{item.end_time ? `–${item.end_time}` : ""}
                                </p>
                                {boxCode && (
                                  <p className="flex items-center gap-1 text-[11px] font-medium text-equine-navy">
                                    <MapPin size={11} /> Chuồng {boxCode}
                                  </p>
                                )}
                                <p className="text-[10px] text-slate-500">
                                  {groomSessionTypeLabel(item.session_type)}{item.track_surface ? ` · ${groomSurfaceLabel(item.track_surface)}` : ""}
                                </p>
                                {isLocked && item.lock_reason && (
                                  <p className="mt-1 rounded bg-rose-100/80 px-1.5 py-0.5 text-[10px] text-rose-800">{item.lock_reason}</p>
                                )}
                                {canComplete && (
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void markTrainingComplete(item.training_schedule_id)}
                                    className="mt-1.5 inline-flex h-7 w-full items-center justify-center gap-1 rounded bg-emerald-600 px-2 text-[10px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                                  >
                                    <Check size={11} /> Xác nhận đã tập
                                  </button>
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
            <tr className="align-top bg-amber-50/20">
              <td className="border-r border-slate-200 bg-amber-50/80 p-2.5 text-center">
                <strong className="block font-bold text-amber-950">Chăm sóc</strong>
                <span className="text-[11px] text-amber-800">Trong ngày</span>
              </td>
              {weekDays.map((day) => {
                const tasksForDay = weekCareTasks.filter((t) => t.type === "care_task" && (t.event_date ?? date) === day);
                return (
                  <td key={day} className="min-w-[132px] border-r border-slate-200 p-2 last:border-r-0">
                    {tasksForDay.length === 0 ? (
                      <div className="py-2.5 text-center text-[11px] text-slate-300">—</div>
                    ) : (
                      <div className="space-y-1.5">
                        {tasksForDay.map((task) => {
                          if (task.type !== "care_task") return null;
                          const badge = groomStatusBadge(task.status, "task");
                          const boxCode = task.box_code ?? horseById.get(task.horse.id)?.stable_box?.box_code ?? null;
                          return (
                            <div key={task.task_id} className="rounded-lg border border-slate-200 border-l-4 border-l-amber-500 bg-white p-2 shadow-2xs">
                              <strong className="block truncate font-bold text-equine-navy">{groomTaskLabel(task.task_type)}</strong>
                              <p className="truncate text-[11px] text-slate-700">
                                🐎 {task.horse.horse_name}{boxCode ? ` · ${boxCode}` : ""}
                              </p>
                              <span className={`mt-1 inline-flex rounded border px-1.5 py-0.5 text-[10px] font-bold ${badge.cls}`}>{badge.label}</span>
                              {task.status === "Pending" && day <= todayIso && (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void markTaskComplete(task.task_id)}
                                  className="mt-1.5 inline-flex h-7 w-full items-center justify-center gap-1 rounded border border-emerald-300 bg-emerald-50 px-2 text-[10px] font-bold text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
                                >
                                  <Check size={11} /> Hoàn thành
                                </button>
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
          </tbody>
        </table>
      </div>
    </section>
    <section hidden={tab !== "incidents"} id="incident-report" className="scroll-mt-24 rounded-lg border border-amber-200 bg-white p-4 shadow-sm sm:p-5">
      <h3 className="mb-3 flex items-center gap-2 font-sans text-lg font-semibold text-equine-navy"><AlertTriangle size={18} /> Báo cáo sự cố</h3>
      {horses.length === 0 ? <p className="text-sm text-slate-500">Chỉ báo cáo ngựa phụ trách.</p> : <form onSubmit={incident} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 sm:items-end">
        <label className="block"><span className="field-label">Ngựa được phân công</span><select className="field-control px-3" name="horse_id" required>{horses.map((horse) => <option key={horse.id} value={horse.id}>{horse.horse_name}</option>)}</select></label>
        <label className="block"><span className="field-label">Mô tả sự cố</span><textarea className="field-control min-h-12 px-3 py-2" name="issue_description" maxLength={1000} required /></label>
        <label className="block"><span className="field-label">Ảnh sự cố (JPG, PNG, WebP · tối đa 5 MB)</span><input className="field-control px-3" name="image_file" type="file" accept="image/jpeg,image/png,image/webp" /></label>
        <label className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800"><input name="is_emergency" type="checkbox" className="h-4 w-4 accent-rose-700" /> Sự cố khẩn cấp · báo bác sĩ ngay</label>
        <button className="gold-button" disabled={busy}><Activity size={15} /> Gửi báo cáo</button>
      </form>}
    </section>
    <div hidden={tab !== "diet" && tab !== "inventory"} className="space-y-5">
      <section hidden={tab !== "diet"} id="diet-records" className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs sm:p-5">
        <h3 className="mb-4 flex items-center gap-2 font-sans text-base font-bold text-equine-navy"><Utensils size={18} /> Khẩu phần đang áp dụng · {formatDisplayDate(date)}</h3>
        <div className="space-y-2.5">{diets.map((diet) => <article key={diet.id} className="rounded-xl border border-slate-200 p-3.5">
          <div className="flex flex-wrap justify-between gap-2"><p className="font-bold text-equine-navy">{diet.horse_name}{diet.box_code ? ` · Chuồng ${diet.box_code}` : ""}</p><span className="text-xs text-slate-500">{diet.effective_date ? formatDisplayDate(diet.effective_date) : "—"} → {diet.end_date ? formatDisplayDate(diet.end_date) : "Đang áp dụng"}</span></div>
          <p className="mt-1 text-sm text-slate-700">{diet.feed_type} · {diet.quantity_kg} kg · {diet.feeding_frequency || "Chưa ghi giờ ăn"}</p>
          <span className={`mt-2 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${diet.diet_type === "TREATMENT" ? "bg-violet-50 text-violet-800" : "bg-emerald-50 text-emerald-800"}`}>{diet.diet_type === "TREATMENT" ? "Khẩu phần điều trị · Bác sĩ thú y" : "Khẩu phần thường · Huấn luyện viên"}</span>
          {diet.special_instructions && <p className="mt-1.5 whitespace-pre-wrap text-xs text-slate-500">{diet.special_instructions}</p>}
        </article>)}{!diets.length && <p className="rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500">Không có khẩu phần được duyệt áp dụng cho ngày này.</p>}</div>
      </section>
      <section hidden={tab !== "inventory"} id="inventory" className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs sm:p-5">
        <h3 className="mb-4 flex items-center gap-2 font-sans text-base font-bold text-equine-navy"><Package size={18} /> Vật tư khu vực</h3>
        <div className="mb-4 space-y-2">{inventory.map((item) => <article key={item.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm ${item.is_low_stock || item.status === "EXPIRED" ? "border-amber-200 bg-amber-50/70" : "border-slate-200"}`}>
          <span className="font-semibold text-equine-navy">{item.item_code} · {item.item_name} · {item.category ?? "Khác"}</span><span className="text-xs text-slate-600">Tồn {item.quantity_in_stock} {item.unit ?? "đơn vị"} · Dùng được {item.usable_quantity}{item.nearest_expiry_date ? ` · Hạn gần nhất ${formatDisplayDate(item.nearest_expiry_date)}` : ""} · <strong>{({ SUFFICIENT: "Còn đủ", LOW_STOCK: "Sắp thiếu", OUT_OF_STOCK: "Hết hàng", EXPIRING: "Sắp hết hạn", EXPIRED: "Có lô hết hạn", INACTIVE: "Ngừng sử dụng" })[item.status]}</strong></span>
        </article>)}{!inventory.length && <p className="text-sm text-slate-500">Chưa có danh mục vật tư.</p>}</div>
        {inventory.some((item) => item.usable_quantity > 0) && <form onSubmit={recordInventoryUsage} className="mb-4 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3.5 sm:grid-cols-2">
          <label className="block"><span className="field-label">Vật tư đã sử dụng</span><select className="field-control px-3" name="item_id" required>{inventory.filter((item) => item.usable_quantity > 0).map((item) => <option key={item.id} value={item.id}>{item.item_name} · khả dụng {item.usable_quantity} {item.unit}</option>)}</select></label>
          <label className="block"><span className="field-label">Số lượng đã dùng</span><input className="field-control px-3" name="quantity" type="number" min="0.01" step="0.01" required /></label>
          <label className="block sm:col-span-2"><span className="field-label">Công việc / ghi chú (không bắt buộc)</span><input className="field-control px-3" name="reason" maxLength={500} /></label>
          <button className="soft-button sm:col-span-2" disabled={busy}><Package size={15} /> Xác nhận đã sử dụng</button>
        </form>}
        {inventory.length > 0 && <form onSubmit={requestSupply} className="grid gap-2 sm:grid-cols-2">
          <label className="block"><span className="field-label">Vật tư cần bổ sung</span><select className="field-control px-3" name="item_id" required>{inventory.map((item) => <option key={item.id} value={item.id}>{item.item_name} · còn {item.quantity_in_stock} {item.unit ?? ""}</option>)}</select></label>
          <label className="block"><span className="field-label">Số lượng</span><input className="field-control px-3" name="quantity_requested" type="number" min="0.01" step="0.01" required /></label>
          <label className="block sm:col-span-2"><span className="field-label">Lý do</span><input className="field-control px-3" name="reason" maxLength={2000} /></label>
          <button className="gold-button sm:col-span-2" disabled={busy}><Plus size={15} /> Đề xuất bổ sung</button>
        </form>}
        <div className="mt-4 space-y-2">{supplyRequests.slice(0, 5).map((request) => {
          const supplyBadge = groomSupplyStatusBadge(request.status);
          return (
            <div key={request.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <span>{request.item_name} · đề xuất {request.quantity_requested}{request.quantity_approved != null ? ` · duyệt ${request.quantity_approved}` : ""}</span>
              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${supplyBadge.cls}`}>{supplyBadge.label}</span>
            </div>
          );
        })}</div>
      </section>
    </div>
    <section hidden={tab !== "incidents"} id="reported-incidents" className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs sm:p-5">
      <h3 className="mb-4 flex items-center gap-2 font-sans text-base font-bold text-equine-navy"><AlertTriangle size={18} /> Sự cố đã báo cáo / được giao</h3>
      <div className="grid gap-3 sm:grid-cols-2">{incidents.map((item) => {
        const incidentBadge = groomIncidentStatusBadge(item.status);
        return <article data-notification-target={item.id} key={item.id} className={`rounded-xl border p-3.5 ${item.is_emergency ? "border-rose-200 bg-rose-50/30" : "border-slate-200 bg-white"}`}>
          <div className="flex items-center justify-between gap-2"><p className="font-bold text-equine-navy">{item.horse_name}</p><span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${incidentBadge.cls}`}>{incidentBadge.label}</span></div>
          {item.is_emergency && <p className="mt-2 inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-800">KHẨN CẤP · Đã báo bác sĩ thú y</p>}
          <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-700">{item.issue_description}</p>
          {item.assignee_name && <p className="mt-2 text-xs font-semibold text-equine-navy">Phụ trách: {item.assignee_name} · {item.assigned_role}</p>}
          {item.assignment_note && <p className="mt-1.5 whitespace-pre-wrap rounded-lg bg-blue-50 p-3 text-xs text-blue-900"><strong>Ghi chú giao việc:</strong> {item.assignment_note}</p>}
          {item.result_note && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-emerald-50 p-3 text-xs text-emerald-900"><strong>Kết quả:</strong> {item.result_note}</p>}
          <IncidentPhoto incidentId={item.id} imageUrl={item.image_url} />
          {item.assigned_to_me && item.status === "InProgress" && <form onSubmit={(event) => void submitIncidentResult(event, item.id)} className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <label className="block"><span className="field-label">Kết quả xử lý</span><textarea className="field-control min-h-20 px-3 py-2" name="result_note" maxLength={2000} required /></label>
            <button className="soft-button" disabled={busy}>Gửi kết quả cho Club Manager</button>
          </form>}
          <p className="mt-2 text-[11px] text-slate-400">{formatDisplayDate(item.created_at, true)}</p>
        </article>;
      })}{!incidents.length && <p className="text-sm text-slate-500">Chưa có sự cố được báo cáo hoặc giao cho bạn.</p>}</div>
    </section>
    </>}
  </section>;
}
