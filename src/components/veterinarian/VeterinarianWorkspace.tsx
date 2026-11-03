"use client";

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  CircleHelp,
  ClipboardCheck,
  Clock,
  FileHeart,
  HeartPulse,
  LockKeyhole,
  MapPin,
  Pill,
  RefreshCw,
  Search,
  ShieldAlert,
  Stethoscope,
  UnlockKeyhole,
  User,
  Utensils,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { HorseImage, Notice } from "@/components/horses/HorseUI";
import IncidentPhoto from "@/components/groom/IncidentPhoto";
import InjuryModel3D from "@/components/veterinarian/InjuryModel3D";
import { CompactId } from "@/components/shared/CompactId";
import type { Horse } from "@/api/horses/api";
import { APP_MUTATION_COMPLETED_EVENT } from "@/api/client";
import { useDashboardTab } from "@/shared/hooks/use-dashboard-tab";
import { getUser } from "@/lib/session";
import {
  veterinarianApi,
  veterinarianError,
  type AppNotification,
  type CareEvent,
  type CareSchedule,
  type DietRecord,
  type HealthExam,
  type HealthExamLog,
  type HealthOverview,
  type InjuryMarker,
  type MedicalRecord,
  type Prescription,
  type VetHorse,
  type VetStableIncident,
} from "@/api/veterinarian/api";

type WorkspaceTab = "overview" | "stables" | "exams" | "medical" | "diet" | "injuries" | "care" | "incidents" | "notifications";
const workspaceTabIds: readonly WorkspaceTab[] = ["overview", "stables", "exams", "medical", "diet", "injuries", "care", "incidents", "notifications"];

const statusLabels: Record<string, string> = {
  Healthy: "Khỏe mạnh",
  Monitoring: "Cần theo dõi",
  Injured: "Chấn thương",
  Quarantine: "Cách ly",
};
const readinessLabels: Record<string, string> = {
  Ready: "sẵn sàng thi đấu",
  NotReady: "chưa sẵn sàng thi đấu",
  Unknown: "chưa đánh giá khả năng thi đấu",
};

type NotificationActionTab = "overview" | "injuries" | "care";
type VetActionItem = {
  id: string;
  horseId: string;
  title: string;
  detail: string;
  actionLabel: string;
  actionTab: NotificationActionTab;
  priority: "urgent" | "warning";
};
type VetActivity = {
  id: string;
  horseId: string | null;
  horseName: string;
  message: string;
  createdAt: string;
  actionTab: NotificationActionTab;
};
const VET_ACTIVITY_SESSION_KEY = "racehorse:veterinarian:recent-activity";

const injuryStatusLabels: Record<InjuryMarker["recovery_status"], string> = {
  Active: "đang chấn thương",
  Recovering: "đang hồi phục",
  Recovered: "đã hồi phục",
};

const injurySeverityLabels: Record<InjuryMarker["severity"], string> = {
  Mild: "nhẹ",
  Moderate: "vừa",
  Severe: "nặng",
};

const careTypeLabels: Record<string, string> = {
  HoofCheck: "Kiểm tra móng",
  Deworming: "Tẩy giun",
  Vaccination: "Tiêm phòng",
  MedicalCheckup: "Khám định kỳ",
};

function latestInjuriesByBodyPart(markers: InjuryMarker[]) {
  const ordered = [...markers].sort((left, right) => Date.parse(right.marked_at) - Date.parse(left.marked_at));
  const latest = new Map<string, InjuryMarker>();
  for (const marker of ordered) {
    const key = marker.body_part.trim().toLocaleLowerCase("vi");
    if (!latest.has(key)) latest.set(key, marker);
  }
  return [...latest.values()];
}

function buildVetActionItems(
  horses: VetHorse[],
  injuriesByHorse: Map<string, InjuryMarker[]>,
  schedules: CareSchedule[],
) {
  const items: VetActionItem[] = [];

  for (const horse of horses) {
    const latestInjuries = latestInjuriesByBodyPart(injuriesByHorse.get(horse.id) ?? []);
    const activeInjuries = latestInjuries.filter((marker) => marker.recovery_status !== "Recovered");

    for (const marker of activeInjuries) {
      const severe = marker.severity === "Severe";
      items.push({
        id: `injury-${horse.id}-${marker.id}`,
        horseId: horse.id,
        title: `${horse.horse_name} · ${marker.body_part}`,
        detail: marker.recovery_status === "Active"
          ? `Chấn thương mức ${injurySeverityLabels[marker.severity]} hiện ${injuryStatusLabels[marker.recovery_status]}. Cần chăm sóc và cập nhật đánh giá.`
          : `Chấn thương mức ${injurySeverityLabels[marker.severity]} hiện ${injuryStatusLabels[marker.recovery_status]}. Cần theo dõi và cập nhật lần đánh giá tiếp theo.`,
        actionLabel: "Cập nhật chấn thương",
        actionTab: "injuries",
        priority: severe ? "urgent" : "warning",
      });
    }

    if (horse.current_status === "Quarantine" || (horse.current_status !== "Healthy" && activeInjuries.length === 0)) {
      const status = statusLabels[horse.current_status] ?? horse.current_status;
      items.push({
        id: `health-${horse.id}`,
        horseId: horse.id,
        title: `${horse.horse_name} · ${status}`,
        detail: horse.current_status === "Quarantine"
          ? "Kiểm tra tình trạng cách ly và cập nhật sức khỏe trước khi đưa ngựa trở lại hoạt động."
          : "Trạng thái sức khỏe cần được đánh giá và cập nhật sau khi chăm sóc.",
        actionLabel: "Cập nhật sức khỏe",
        actionTab: "overview",
        priority: horse.current_status === "Injured" || horse.current_status === "Quarantine" ? "urgent" : "warning",
      });
    }

    if (horse.current_status === "Healthy" && (horse.readiness_status !== "Ready" || horse.is_training_locked)) {
      items.push({
        id: `readiness-${horse.id}`,
        horseId: horse.id,
        title: `${horse.horse_name} · Đã khỏe mạnh, cần xác nhận trạng thái`,
        detail: horse.is_training_locked
          ? "Hồ sơ đã ghi nhận khỏe mạnh nhưng lịch tập vẫn đang khóa. Kiểm tra kết quả khám và mở khóa nếu đủ điều kiện."
          : "Hồ sơ đã ghi nhận khỏe mạnh nhưng chưa sẵn sàng thi đấu. Cập nhật trạng thái sau khi xác nhận.",
        actionLabel: "Rà soát sức khỏe",
        actionTab: "overview",
        priority: "warning",
      });
    }
  }

  for (const schedule of schedules) {
    if (schedule.event_status === "Completed" || (!schedule.is_overdue && schedule.next_due_date > today())) continue;
    const horse = horses.find((item) => item.id === schedule.horse_id);
    if (!horse) continue;
    items.push({
      id: `care-${schedule.id}`,
      horseId: schedule.horse_id,
      title: `${horse.horse_name} · ${careTypeLabels[schedule.care_type] ?? schedule.care_type}`,
      detail: `${schedule.is_overdue ? "Lịch chăm sóc đã quá hạn" : "Lịch chăm sóc đến hạn hôm nay"} (${displayDate(schedule.next_due_date)}). ${schedule.calendar_event_id ? "Hãy hoàn thành lịch hẹn hoặc xác nhận đã chăm sóc." : "Hãy đặt lịch hoặc xác nhận đã chăm sóc."}`,
      actionLabel: "Mở lịch chăm sóc",
      actionTab: "care",
      priority: "urgent",
    });
  }

  const priorityOrder = { urgent: 0, warning: 1 };
  return items.sort((left, right) => priorityOrder[left.priority] - priorityOrder[right.priority] || left.title.localeCompare(right.title, "vi"));
}

async function fetchVetActionItems(horses: VetHorse[]) {
  const horsesToInspect = horses.filter((horse) => horse.current_status === "Injured" || horse.is_training_locked);
  const [schedulesResult, ...injuryResults] = await Promise.allSettled([
    veterinarianApi.schedules(),
    ...horsesToInspect.map((horse) => veterinarianApi.injuries(horse.id)),
  ]);
  const injuriesByHorse = new Map<string, InjuryMarker[]>();
  const failures: string[] = [];
  injuryResults.forEach((result, index) => {
    if (result.status === "fulfilled") injuriesByHorse.set(horsesToInspect[index].id, result.value.data);
    else failures.push(horsesToInspect[index].horse_name);
  });
  const schedules = schedulesResult.status === "fulfilled" ? schedulesResult.value.data : [];
  if (schedulesResult.status === "rejected") failures.push("lịch chăm sóc");
  return {
    items: buildVetActionItems(horses, injuriesByHorse, schedules),
    error: failures.length ? "Một số dữ liệu sức khỏe hoặc lịch chăm sóc chưa tải được; hãy làm mới để thử lại." : "",
  };
}

function formatNotificationMessage(message: string, horses: VetHorse[]) {
  const simulationAlert = message.match(/^Training simulation for horse ([\w-]+) exceeded a configured monitoring threshold; review the sensor readings\.?$/i);
  if (simulationAlert) {
    const horseId = simulationAlert[1];
    const horse = horses.find((item) => item.id === horseId);
    const horseName = horse?.horse_name ?? `mã ${horseId.slice(0, 8)}`;
    return {
      message: `Chỉ số cảm biến trong buổi tập của ngựa ${horseName} vượt ngưỡng theo dõi. Bác sĩ cần kiểm tra dữ liệu và đánh giá nguy cơ chấn thương.`,
      horseId: horse?.id ?? null,
    };
  }
  return { message, horseId: null };
}

export default function VeterinarianWorkspace() {
  const [overview, setOverview] = useState<HealthOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [tab, selectTab] = useDashboardTab(workspaceTabIds, "overview");
  const [notice, setNotice] = useState("");
  const [unread, setUnread] = useState(0);
  const [actionCount, setActionCount] = useState(0);
  const [actionItems, setActionItems] = useState<VetActionItem[]>([]);
  const [actionItemsLoading, setActionItemsLoading] = useState(true);
  const [actionItemsError, setActionItemsError] = useState("");
  const [openIncidentCount, setOpenIncidentCount] = useState(0);
  const [recentActivities, setRecentActivities] = useState<VetActivity[]>([]);
  const [activityHistoryReady, setActivityHistoryReady] = useState(false);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [result, incidents] = await Promise.all([
        veterinarianApi.overview(),
        veterinarianApi.incidents("Open").catch(() => null),
      ]);
      setOverview(result);
      if (incidents) setOpenIncidentCount(incidents.data.length);
      setSelectedId((current) => result.horses.some((horse) => horse.id === current)
        ? current
        : result.horses[0]?.id ?? "");
      return result;
    } catch (reason) {
      setError(veterinarianError(reason));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUnread = useCallback(async () => {
    try {
      const result = await veterinarianApi.notifications(true);
      setUnread(result.unread_count);
    } catch {
      // The notifications view reports its own loading and error state.
    }
  }, []);

  useEffect(() => { void loadOverview(); }, [loadOverview]);
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(VET_ACTIVITY_SESSION_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setRecentActivities(parsed.filter((item): item is VetActivity => Boolean(
            item && typeof item === "object"
            && typeof item.id === "string"
            && (item.horseId === null || typeof item.horseId === "string")
            && typeof item.horseName === "string"
            && typeof item.message === "string"
            && typeof item.createdAt === "string"
            && ["overview", "injuries", "care"].includes(item.actionTab),
          )).slice(0, 12));
        }
      }
    } catch {
      // Keep the workspace usable if this browser blocks or corrupts session storage.
    }
    setActivityHistoryReady(true);
  }, []);
  useEffect(() => {
    if (!activityHistoryReady) return;
    try {
      sessionStorage.setItem(VET_ACTIVITY_SESSION_KEY, JSON.stringify(recentActivities));
    } catch {
      // Activity notices still remain visible until this workspace is closed.
    }
  }, [activityHistoryReady, recentActivities]);
  useEffect(() => {
    void loadUnread();
    const timer = window.setInterval(() => void loadUnread(), 60_000);
    return () => window.clearInterval(timer);
  }, [loadUnread]);
  const horses = useMemo(() => overview?.horses ?? [], [overview]);
  const horse = horses.find((item) => item.id === selectedId) ?? null;
  const loadActionItems = useCallback(async (targetHorses: VetHorse[]) => {
    setActionItemsLoading(true);
    setActionItemsError("");
    try {
      const result = await fetchVetActionItems(targetHorses);
      setActionItems(result.items);
      setActionCount(result.items.length);
      setActionItemsError(result.error);
    } catch (reason) {
      setActionItemsError(veterinarianError(reason));
    } finally {
      setActionItemsLoading(false);
    }
  }, []);
  useEffect(() => {
    if (!overview) return;
    void loadActionItems(overview.horses);
  }, [overview, loadActionItems]);
  useEffect(() => {
    let timer: number | undefined;
    const refreshAfterMutation = (event: Event) => {
      const path = (event as CustomEvent<{ path?: string }>).detail?.path ?? "";
      if (path.includes("/api/notifications")) return;
      void loadUnread();
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void (async () => {
          const refreshedOverview = await loadOverview();
          await loadActionItems(refreshedOverview?.horses ?? horses);
        })();
      }, 180);
    };
    window.addEventListener(APP_MUTATION_COMPLETED_EVENT, refreshAfterMutation);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(APP_MUTATION_COMPLETED_EVENT, refreshAfterMutation);
    };
  }, [horses, loadActionItems, loadOverview, loadUnread]);
  const stableGroups = useMemo(() => {
    const groups = new Map<string, VetHorse[]>();
    for (const item of horses) {
      const location = item.stable_box ? `Khu ${item.stable_box.section} · Chuồng ${item.stable_box.box_code}` : "Chưa xếp chuồng";
      groups.set(location, [...(groups.get(location) ?? []), item]);
    }
    return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right, "vi"));
  }, [horses]);
  const visibleHorses = horses.filter((item) => {
    const query = search.trim().toLocaleLowerCase("vi");
    return item.horse_name.toLocaleLowerCase("vi").includes(query)
      || item.id.toLocaleLowerCase("vi").includes(query)
      || item.stable_box?.box_code.toLocaleLowerCase("vi").includes(query);
  });

  function changed(message: string) {
    setNotice(message);
    const activity: VetActivity = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      horseId: horse?.id ?? null,
      horseName: horse?.horse_name ?? "Đàn ngựa",
      message,
      createdAt: new Date().toISOString(),
      actionTab: tab === "injuries" ? "injuries" : tab === "care" ? "care" : "overview",
    };
    setRecentActivities((current) => [activity, ...current].slice(0, 12));
  }

  function openNotificationAction(horseId: string, nextTab: NotificationActionTab) {
    setSelectedId(horseId);
    selectTab(nextTab);
    setNotice("");
  }

  return (
    <section className="dashboard-workspace mx-auto w-full" aria-label="Không gian bác sĩ thú y">
      {error && <div className="mt-5"><Notice error>{error}</Notice></div>}
      {notice && <div className="mt-5"><Notice>{notice}</Notice></div>}

      {tab !== "stables" && <div className="relative mt-4 w-full max-w-2xl">
        <label className="flex items-center gap-2 rounded-xl border border-equine-line bg-white px-3 py-2.5 shadow-sm"><Search size={16} className="shrink-0 text-slate-500" /><span className="sr-only">Tìm ngựa theo tên hoặc mã số</span><input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full border-0 bg-transparent text-sm outline-none" placeholder="Tìm theo tên hoặc mã số ngựa..." /></label>
        {search.trim() && <div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-[65vh] space-y-2 overflow-y-auto rounded-xl border border-equine-line bg-white p-2 shadow-lg">
          {loading && !overview ? <Notice>Đang tìm ngựa...</Notice> : visibleHorses.length === 0 ? <Notice>Không tìm thấy ngựa phù hợp.</Notice> : visibleHorses.map((item) => <HorseChoice key={item.id} horse={item} selected={item.id === selectedId} onClick={() => { setSelectedId(item.id); setSearch(""); setNotice(""); }} />)}
        </div>}
      </div>}

      {tab === "stables" ? (
        <div className="mt-5 max-w-[430px]">
          <StableMapPanel
            horses={horses}
            stableGroups={stableGroups}
            selectedId={selectedId}
            openIncidentCount={openIncidentCount}
            unread={unread}
            actionCount={actionCount}
            onIncident={() => { selectTab("incidents"); setNotice(""); }}
            onNotifications={() => { selectTab("notifications"); setNotice(""); }}
            onRefresh={() => { void loadOverview(); void loadUnread(); }}
            onSelectHorse={(id) => { setSelectedId(id); selectTab("overview"); setNotice(""); }}
          />
        </div>
      ) : (
      <div className="mt-4 min-w-0">
          {horse && <>
            <HorseSummary horse={horse} />
            <div className="mt-4">
              {tab === "overview" && <HorseStatusPanel horse={horse} onChanged={changed} />}
              {tab === "exams" && <ExamsPanel horse={horse} onChanged={changed} />}
              {tab === "medical" && <MedicalPanel horse={horse} onChanged={changed} />}
              {tab === "diet" && <DietPanel horse={horse} onChanged={changed} />}
              {tab === "injuries" && <InjuriesPanel horse={horse} onChanged={changed} />}
              {tab === "care" && <CarePanel horses={horses} selectedHorse={horse} onChanged={changed} />}
              {tab === "incidents" && <StableIncidentsPanel onOpenHorse={(id) => { setSelectedId(id); selectTab("overview"); }} />}
              {tab === "notifications" && <NotificationsPanel horses={horses} activities={recentActivities} initialActionItems={actionItems} actionsLoading={actionItemsLoading} actionsError={actionItemsError} onUnread={setUnread} onActionCount={setActionCount} onOpenAction={openNotificationAction} />}
            </div>
          </>}
          {!horse && !loading && <div className="rounded-lg border border-equine-line bg-white p-6 shadow-sm"><Notice>Chưa có ngựa đang hoạt động để quản lý sức khỏe.</Notice></div>}
          {!horse && !loading && tab === "incidents" && <div className="mt-4"><StableIncidentsPanel onOpenHorse={(id) => { setSelectedId(id); selectTab("overview"); }} /></div>}
          {!horse && !loading && tab === "notifications" && <div className="mt-4"><NotificationsPanel horses={horses} activities={recentActivities} initialActionItems={actionItems} actionsLoading={actionItemsLoading} actionsError={actionItemsError} onUnread={setUnread} onActionCount={setActionCount} onOpenAction={openNotificationAction} /></div>}
      </div>
      )}
    </section>
  );
}

function StableMapPanel({
  horses,
  stableGroups,
  selectedId,
  openIncidentCount,
  unread,
  actionCount,
  onIncident,
  onNotifications,
  onRefresh,
  onSelectHorse,
}: {
  horses: VetHorse[];
  stableGroups: [string, VetHorse[]][];
  selectedId: string | null;
  openIncidentCount: number;
  unread: number;
  actionCount: number;
  onIncident: () => void;
  onNotifications: () => void;
  onRefresh: () => void;
  onSelectHorse: (id: string) => void;
}) {
  return <section className="overflow-hidden rounded-lg border border-equine-line bg-white shadow-sm" aria-label="Sơ đồ chuồng trại">
    <div className="flex items-center justify-between gap-2 border-b border-equine-line px-3 py-2.5">
      <div className="min-w-0">
        <h2 className="font-sans text-sm font-semibold text-equine-navy">Sơ đồ chuồng trại</h2>
        <p className="mt-0.5 text-[11px] text-slate-500">{horses.length} ngựa · {stableGroups.length} vị trí</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button type="button" title="Sự cố" aria-label={`Sự cố cần xử lý: ${openIncidentCount}`} onClick={onIncident} className="relative grid h-8 w-8 place-items-center rounded-md text-rose-700 hover:bg-rose-50"><AlertTriangle size={15} /><span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-rose-100 px-1 text-[9px] font-bold">{openIncidentCount}</span></button>
        <button type="button" title="Thông báo" aria-label={`Thông báo: ${unread} chưa đọc, ${actionCount} việc cần xử lý`} onClick={onNotifications} className="relative grid h-8 w-8 place-items-center rounded-md text-equine-navy hover:bg-equine-mist"><Bell size={15} /><span className={`absolute -right-1 -top-1 min-w-4 rounded-full px-1 text-[9px] font-bold ${unread ? "bg-rose-100 text-rose-700" : "bg-equine-mist text-slate-600"}`}>{unread}</span>{actionCount > 0 && <span className="absolute -bottom-0.5 -right-1 h-2 w-2 rounded-full bg-amber-500" />}</button>
        <button type="button" title="Làm mới" aria-label="Làm mới dữ liệu" className="grid h-8 w-8 place-items-center rounded-md text-equine-navy hover:bg-equine-mist" onClick={onRefresh}><RefreshCw size={14} /></button>
      </div>
    </div>
    <div className="max-h-[min(70vh,560px)] space-y-2 overflow-y-auto p-2.5">
      {stableGroups.map(([location, occupants]) => <div key={location} className="rounded-md border border-equine-line bg-[#f8fafc] p-2">
        <p className="mb-1.5 truncate text-[10px] font-bold uppercase tracking-wide text-slate-500">{location}</p>
        <div className="space-y-1.5">{occupants.map((item) => <button type="button" key={item.id} onClick={() => onSelectHorse(item.id)} aria-pressed={item.id === selectedId} className={`flex w-full items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-left transition ${item.id === selectedId ? "border-equine-navy bg-slate-100 font-semibold text-equine-navy shadow-sm" : "border-equine-line bg-white hover:bg-slate-50"}`}>
          <span className="truncate text-xs font-semibold text-equine-navy">{item.horse_name}{item.is_training_locked ? " · Khóa" : ""}</span>
          <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${item.current_status === "Injured" || item.current_status === "Quarantine" ? "bg-rose-100 text-rose-800" : item.current_status === "Monitoring" ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-800"}`}>{statusLabels[item.current_status] ?? item.current_status}</span>
        </button>)}</div>
      </div>)}
      {!stableGroups.length && <p className="rounded-md bg-equine-mist px-3 py-4 text-center text-xs text-slate-500">Chưa có vị trí chuồng.</p>}
    </div>
  </section>;
}

function HorseChoice({ horse, selected, onClick }: { horse: VetHorse; selected: boolean; onClick: () => void }) {
  const statusClass = horse.current_status === "Injured" || horse.current_status === "Quarantine" ? "border-rose-200 bg-rose-50" : horse.current_status === "Monitoring" ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50";
  return <button type="button" onClick={onClick} aria-pressed={selected} className={`w-full rounded-lg border p-3 text-left transition ${selected ? "border-equine-navy bg-slate-50 shadow-sm ring-1 ring-equine-navy/20" : "border-equine-line hover:bg-slate-50"}`}>
    <div className="flex items-center gap-3"><div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-equine-mist"><HorseImage horse={horse as unknown as Horse} /></div><div className="min-w-0 flex-1"><p className="truncate font-semibold text-equine-navy">{horse.horse_name}</p><p className="truncate text-xs text-slate-500">{horse.stable_box ? `${horse.stable_box.box_code} · Khu ${horse.stable_box.section}` : "Chưa xếp chuồng"}</p></div><span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${statusClass}`}>{statusLabels[horse.current_status] ?? horse.current_status}</span></div>
    {horse.is_training_locked && <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-rose-700"><LockKeyhole size={12} /> Đang khóa huấn luyện</p>}
  </button>;
}

function HorseSummary({ horse }: { horse: VetHorse }) {
  return <article className="flex flex-col gap-3 rounded-lg border border-equine-line bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:p-4">
    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md bg-equine-mist"><HorseImage horse={horse as unknown as Horse} /></div>
    <div className="min-w-0 flex-1"><p className="eyebrow text-[10px]">Hồ sơ sức khỏe</p><h2 className="mt-0.5 font-sans text-xl font-semibold text-equine-navy">{horse.horse_name}</h2><p className="mt-1 text-sm text-slate-600">{horse.stable_box ? `Chuồng ${horse.stable_box.box_code} · Khu ${horse.stable_box.section}` : "Chưa gán chuồng"} · {statusLabels[horse.current_status] ?? horse.current_status}</p></div>
    {horse.is_training_locked && <div className={`rounded-md border px-3 py-2 text-sm ${horse.lock_level === "Critical" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}><p className="flex items-center gap-2 font-bold"><LockKeyhole size={15} /> Khóa {horse.lock_level}</p><p className="mt-1 max-w-sm text-xs">{horse.lock_reason}</p></div>}
  </article>;
}

function SectionCard({ title, description, icon: Icon, children, action }: { title: string; description?: string; icon: typeof Activity; children: ReactNode; action?: ReactNode }) {
  return <section className="rounded-lg border border-equine-line bg-white p-4 shadow-sm sm:p-5"><div className="mb-4 flex flex-col gap-3 border-b border-equine-line pb-4 sm:flex-row sm:items-start sm:justify-between"><div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-equine-mist text-equine-navy"><Icon size={19} /></span><div><div className="flex items-center gap-2"><h3 className="font-sans text-lg font-semibold text-equine-navy">{title}</h3>{description && <details className="relative text-slate-500"><summary className="grid h-8 w-8 cursor-pointer list-none place-items-center rounded-md hover:bg-slate-100" aria-label={`Giải thích ${title}`} title={`Giải thích ${title}`}><CircleHelp size={16} /></summary><p className="absolute left-0 z-20 mt-1 w-64 max-w-[70vw] rounded-md border border-equine-line bg-white p-3 text-xs leading-5 text-slate-700 shadow-lg">{description}</p></details>}</div></div></div>{action}</div>{children}</section>;
}

function Field({ label, name, type = "text", required = false, defaultValue, maxLength, min, max, step, placeholder, disabled }: { label: string; name: string; type?: string; required?: boolean; defaultValue?: string | number | null; maxLength?: number; min?: number; max?: number; step?: string; placeholder?: string; disabled?: boolean }) {
  const isTime = type === "time";
  return <label className="block"><span className="field-label">{label}{required && <span className="text-rose-600"> *</span>}</span><input name={name} type={isTime ? "text" : type} required={required} maxLength={isTime ? 5 : maxLength} min={min} max={max} step={step} pattern={isTime ? "([01][0-9]|2[0-3]):[0-5][0-9]" : undefined} title={isTime ? "Nhập giờ theo dạng 24 giờ, ví dụ 08:30" : undefined} defaultValue={defaultValue ?? ""} placeholder={isTime ? "HH:mm" : placeholder} disabled={disabled} className="field-control px-3" /></label>;
}

function TextAreaField({ label, name, required = false, defaultValue, rows = 3, maxLength }: { label: string; name: string; required?: boolean; defaultValue?: string | null; rows?: number; maxLength?: number }) {
  return <label className="block"><span className="field-label">{label}{required && <span className="text-rose-600"> *</span>}</span><textarea name={name} required={required} defaultValue={defaultValue ?? ""} rows={rows} maxLength={maxLength} className="field-control resize-y px-3 py-2" /></label>;
}

function SelectField({ label, name, options, defaultValue, required = false }: { label: string; name: string; options: { value: string; label: string }[]; defaultValue?: string; required?: boolean }) {
  return <label className="block"><span className="field-label">{label}{required && <span className="text-rose-600"> *</span>}</span><select name={name} defaultValue={defaultValue ?? options[0]?.value} required={required} className="field-control px-3">{options.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>;
}

type InjuryCoordinateFields = { coordinate_x: string; coordinate_y: string; coordinate_z: string };

function CoordinateFields({ value, onChange }: { value: InjuryCoordinateFields; onChange: (next: InjuryCoordinateFields) => void }) {
  const labels: { key: keyof InjuryCoordinateFields; label: string }[] = [
    { key: "coordinate_x", label: "X · dọc thân" },
    { key: "coordinate_y", label: "Y · độ cao" },
    { key: "coordinate_z", label: "Z · bên gần/xa" },
  ];
  return <div className="grid grid-cols-3 gap-2 sm:col-span-2">
    <p className="text-xs text-slate-500 sm:col-span-3">Chọn trên mô hình hoặc nhập X, Y.</p>
    {labels.map(({ key, label }) => <label key={key} className="block"><span className="field-label">{label}</span><input name={key} type="number" step="0.001" min={-999.999} max={999.999} value={value[key]} onChange={(event) => onChange({ ...value, [key]: event.target.value })} className="field-control px-3" /></label>)}
  </div>;
}

function formValues(form: HTMLFormElement, numeric: string[] = [], optional: string[] = []) {
  const values = Object.fromEntries(new FormData(form).entries()) as Record<string, FormDataEntryValue>;
  const result: Record<string, unknown> = {};
  Object.entries(values).forEach(([key, value]) => {
    if (value === "" && optional.includes(key)) return;
    result[key] = numeric.includes(key) && value !== "" ? Number(value) : value;
  });
  return result;
}

function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function displayDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: value.includes("T") ? "short" : undefined }).format(date);
}

function ErrorLine({ children }: { children: string }) {
  return children ? <div className="mt-3"><Notice error>{children}</Notice></div> : null;
}

function Empty({ children }: { children: string }) {
  return <p className="rounded-xl bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">{children}</p>;
}

function HorseStatusPanel({ horse, onChanged }: { horse: VetHorse; onChanged: (message: string) => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggestLock, setSuggestLock] = useState(false);
  const [sessions, setSessions] = useState<{ training_schedule_id?: string; event_date?: string; start_time?: string; session_type?: string }[]>([]);
  async function updateStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setSuggestLock(false);
    const values = formValues(event.currentTarget);
    try {
      const status = String(values.current_status);
      const readiness = String(values.readiness_status);
      const result = await veterinarianApi.updateHealthStatus(horse.id, status, readiness, String(values.note ?? ""));
      setSuggestLock(["Injured", "Quarantine"].includes(status));
      setSessions(result.upcoming_sessions ?? []);
      const lockNotice = result.is_training_locked && ["Injured", "Quarantine"].includes(status) ? " Huấn luyện đang bị khóa." : "";
      onChanged(`Đã cập nhật sức khỏe: ${statusLabels[status] ?? status}; ${readinessLabels[readiness] ?? readiness}.${lockNotice}`);
    }
    catch (reason) { setError(veterinarianError(reason)); }
    finally { setBusy(false); }
  }
  async function lock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try { const result = await veterinarianApi.lockTraining(horse.id, formValues(event.currentTarget) as { lock_level: string; lock_reason: string }); setSessions(result.upcoming_sessions as typeof sessions); onChanged(result.was_locked ? "Đã cập nhật thông tin khóa huấn luyện." : "Đã khóa huấn luyện và gửi thông báo cho Huấn luyện viên trưởng."); }
    catch (reason) { setError(veterinarianError(reason)); }
    finally { setBusy(false); }
  }
  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try { const values = formValues(event.currentTarget); const result = await veterinarianApi.unlockTraining(horse.id, String(values.reason)); onChanged(result.suggest_status_update ? "Đã mở khóa. Hãy kiểm tra trạng thái sức khỏe của ngựa." : "Đã mở khóa huấn luyện và gửi thông báo."); }
    catch (reason) { setError(veterinarianError(reason)); }
    finally { setBusy(false); }
  }
  return <div className="space-y-4">
    <SectionCard title="Trạng thái sức khỏe" description="Cập nhật trạng thái sau khi khám. Trạng thái sức khỏe và khóa huấn luyện được quản lý riêng." icon={HeartPulse}>
      <form onSubmit={updateStatus} className="grid gap-3 sm:grid-cols-2 sm:items-end"><SelectField label="Trạng thái mới" name="current_status" defaultValue={horse.current_status} required options={[{ value: "Healthy", label: "Khỏe mạnh" }, { value: "Monitoring", label: "Cần theo dõi" }, { value: "Injured", label: "Chấn thương" }, { value: "Quarantine", label: "Cách ly" }]} /><SelectField label="Sẵn sàng thi đấu" name="readiness_status" defaultValue={horse.readiness_status ?? "Unknown"} required options={[{ value: "Ready", label: "Sẵn sàng" }, { value: "NotReady", label: "Chưa sẵn sàng" }, { value: "Unknown", label: "Chưa đánh giá" }]} /><Field label="Ghi chú kiểm tra (không bắt buộc)" name="note" maxLength={500} placeholder="Lý do thay đổi..." /><button className="gold-button h-12" disabled={busy}><Check size={15} /> Lưu trạng thái</button></form>
      {suggestLock && <p className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900"><AlertTriangle size={16} /> Trạng thái này tự động khóa lịch huấn luyện sắp tới. Hãy xử lý các lịch bị chặn trước khi mở khóa.</p>}
    </SectionCard>
    <SectionCard title="Khóa huấn luyện" description="Khóa sẽ chặn việc tạo lịch huấn luyện và thông báo cho các Huấn luyện viên trưởng đang hoạt động." icon={LockKeyhole}>
      {horse.is_training_locked ? <div className="space-y-4"><div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"><strong>Đang khóa · {horse.lock_level}</strong><p className="mt-1">{horse.lock_reason}</p></div><form onSubmit={unlock} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"><Field label="Lý do mở khóa" name="reason" required maxLength={500} placeholder="Ví dụ: đã hồi phục, kết quả kiểm tra bình thường" /><button className="soft-button h-12 border-emerald-200 bg-emerald-50 px-4 text-emerald-800" disabled={busy}><UnlockKeyhole size={15} /> Mở khóa</button></form></div> : <form onSubmit={lock} className="grid gap-3 md:grid-cols-[180px_1fr_auto] md:items-end"><SelectField label="Mức cảnh báo" name="lock_level" required options={[{ value: "Warning", label: "Warning · Cam" }, { value: "Critical", label: "Critical · Đỏ" }]} /><Field label="Lý do khóa" name="lock_reason" required maxLength={255} placeholder="Mô tả ngắn tình trạng cần ngừng tập" /><button className="soft-button h-12 border-rose-200 bg-rose-50 px-4 text-rose-800" disabled={busy}><ShieldAlert size={15} /> Khóa huấn luyện</button></form>}
      {sessions.length > 0 && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="font-semibold text-amber-900">Lịch tập sắp tới cần được xử lý</p><ul className="mt-2 space-y-1 text-sm text-amber-900">{sessions.map((item) => <li key={item.training_schedule_id}>{displayDate(item.event_date)} {item.start_time ?? ""} · {item.session_type ?? "Training"}</li>)}</ul></div>}
    </SectionCard>
    <ErrorLine>{error}</ErrorLine>
  </div>;
}

const examFields = [
  { name: "temperature_c", label: "Nhiệt độ (°C)", type: "number", required: true, min: 30, max: 45, step: "0.1" },
  { name: "heart_rate", label: "Nhịp tim (lần/phút)", type: "number", required: true, min: 10, max: 250, step: "1" },
  { name: "respiratory_rate", label: "Nhịp thở (lần/phút)", type: "number", required: true, min: 3, max: 100, step: "1" },
  { name: "mucous_membrane_color", label: "Màu niêm mạc", type: "text", maxLength: 50 },
  { name: "capillary_refill_sec", label: "Thời gian làm đầy mao mạch (giây)", type: "number", min: 0, max: 10, step: "0.1" },
  { name: "skin_turgor", label: "Độ đàn hồi da", type: "text", maxLength: 50 },
  { name: "jugular_pulse", label: "Mạch tĩnh mạch cảnh", type: "text", maxLength: 50 },
  { name: "digital_pulse", label: "Mạch ngón", type: "text", maxLength: 50 },
  { name: "gut_sounds", label: "Âm ruột", type: "text", maxLength: 50 },
  { name: "defecation_frequency", label: "Tần suất đại tiện", type: "text", maxLength: 50 },
  { name: "urination_frequency", label: "Tần suất tiểu tiện", type: "text", maxLength: 50 },
  { name: "body_condition_score", label: "Điểm thể trạng (1–9)", type: "number", min: 1, max: 9, step: "0.1" },
  { name: "hoof_temperature", label: "Nhiệt độ móng", type: "text", maxLength: 50 },
];
const examLongFields = [
  { name: "gait_assessment", label: "Đánh giá dáng đi" },
  { name: "hematology_result", label: "Kết quả huyết học" },
  { name: "biochemistry_result", label: "Kết quả sinh hóa" },
  { name: "fecal_test_result", label: "Kết quả xét nghiệm phân" },
  { name: "notes", label: "Ghi chú" },
];
const examNumericNames = ["temperature_c", "heart_rate", "respiratory_rate", "capillary_refill_sec", "body_condition_score"];
const examOptionalNames = examFields.filter((field) => !field.required).map((field) => field.name).concat(examLongFields.map((field) => field.name));

function localDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function readExamForm(form: HTMLFormElement, editing: boolean) {
  const result = formValues(form, examNumericNames, editing ? [] : examOptionalNames);
  if (editing) {
    examOptionalNames.forEach((name) => {
      if (result[name] === "") result[name] = null;
    });
  }
  const date = result.exam_date;
  if (typeof date === "string" && date) result.exam_date = new Date(date).toISOString();
  else delete result.exam_date;
  return result;
}

function ExamForm({ initial, editing, onSubmit, onCancel, busy }: { initial?: HealthExam | null; editing: boolean; onSubmit: (data: Record<string, unknown>) => Promise<void>; onCancel?: () => void; busy: boolean }) {
  return <form key={`${initial?.id ?? "new"}-${editing ? "edit" : "create"}`} onSubmit={async (event) => { event.preventDefault(); await onSubmit(readExamForm(event.currentTarget, editing)); }} className="space-y-4">
    <Field label="Thời điểm khám" name="exam_date" type="datetime-local" defaultValue={localDateTime(initial?.exam_date)} />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{examFields.map((field) => <Field key={field.name} {...field} defaultValue={initial?.[field.name as keyof HealthExam] as string | number | null | undefined} />)}</div>
    <div className="grid gap-3 md:grid-cols-2">{examLongFields.map((field) => <TextAreaField key={field.name} {...field} rows={2} defaultValue={initial?.[field.name as keyof HealthExam] as string | null | undefined} />)}</div>
    <div className="flex flex-wrap gap-2"><button className="gold-button" disabled={busy}><Check size={15} />{editing ? "Lưu chỉnh sửa" : "Lưu hồ sơ khám"}</button>{onCancel && <button type="button" className="soft-button h-11 px-4" disabled={busy} onClick={onCancel}>Hủy</button>}</div>
  </form>;
}

function ExamsPanel({ horse, onChanged }: { horse: VetHorse; onChanged: (message: string) => void }) {
  const [response, setResponse] = useState<{ data: HealthExam[]; total: number }>({ data: [], total: 0 });
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<HealthExam | null>(null);
  const [logs, setLogs] = useState<HealthExamLog[]>([]);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [alerts, setAlerts] = useState<HealthExam["alerts"]>([]);

  const load = useCallback(async (nextPage = 1, append = false) => {
    setLoading(true); setError("");
    try {
      const result = await veterinarianApi.exams(horse.id, nextPage);
      setResponse((current) => ({ data: append ? [...current.data, ...result.data] : result.data, total: result.total }));
      setPage(nextPage);
    } catch (reason) { setError(veterinarianError(reason)); }
    finally { setLoading(false); }
  }, [horse.id]);
  useEffect(() => { setDetail(null); setLogs([]); setResponse({ data: [], total: 0 }); setCreating(false); void load(); }, [load]);

  async function openExam(id: string) {
    setError(""); setLoading(true); setDetail(null); setLogs([]);
    const [examResult, historyResult] = await Promise.allSettled([veterinarianApi.exam(id), veterinarianApi.examLogs(id)]);
    const failures: string[] = [];
    if (examResult.status === "fulfilled") {
      setDetail(examResult.value); setAlerts(examResult.value.alerts ?? []); setEditing(false); setCreating(false);
    } else failures.push(`Chi tiết lần khám: ${veterinarianError(examResult.reason)}`);
    if (historyResult.status === "fulfilled") setLogs(historyResult.value.data);
    else failures.push(`Lịch sử chỉnh sửa: ${veterinarianError(historyResult.reason)}`);
    setError(failures.join(" · "));
    setLoading(false);
  }
  async function save(data: Record<string, unknown>) {
    setBusy(true); setError(""); setAlerts([]);
    try {
      const result = editing && detail ? await veterinarianApi.updateExam(detail.id, data) : await veterinarianApi.createExam(horse.id, data as never);
      const exam = result && "exam" in result ? result.exam : result as HealthExam;
      const changed = result && "changed" in result ? result.changed : true;
      if (exam && "id" in exam) setDetail(exam);
      setAlerts(result.alerts ?? exam?.alerts ?? []);
      setCreating(false); setEditing(false); await load();
      if (exam && "id" in exam) await openExam(exam.id);
      onChanged(editing ? (changed ? "Đã cập nhật hồ sơ khám và lưu lịch sử chỉnh sửa." : "Hồ sơ không thay đổi.") : "Đã tạo hồ sơ khám.");
    } catch (reason) { setError(veterinarianError(reason)); }
    finally { setBusy(false); }
  }

  return <SectionCard title="Hồ sơ khám bệnh" description="Ghi nhận sinh hiệu, kết quả khám và xem lại lịch sử chỉnh sửa." icon={Stethoscope} action={<button type="button" className="gold-button h-10 px-3" onClick={() => { setCreating((value) => !value); setDetail(null); setEditing(false); setError(""); }}><Stethoscope size={15} /> Khám mới</button>}>
    <ErrorLine>{error}</ErrorLine>
    {alerts && alerts.length > 0 && <div className="my-3 space-y-2">{alerts.map((alert) => <p key={alert.field} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"><AlertTriangle size={14} className="mr-2 inline" />{alert.field}: {alert.value} · ngưỡng tham khảo {alert.normal_range}</p>)}</div>}
    {creating && <div className="mb-5 rounded-xl border border-equine-line bg-slate-50 p-4"><h4 className="mb-4 font-semibold text-equine-navy">Lần khám mới</h4><ExamForm editing={false} busy={busy} onSubmit={save} onCancel={() => setCreating(false)} /></div>}
    {detail && <div className="mb-5 rounded-xl border border-equine-line bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h4 className="font-semibold text-equine-navy">Chi tiết lần khám</h4><CompactId id={detail.id} /></div><p className="text-sm text-slate-500">{displayDate(detail.exam_date)} · {detail.doctor?.name ?? "Bác sĩ"}</p>{detail.last_edited_at && <p className="mt-1 text-xs text-slate-500">Sửa gần nhất: {displayDate(detail.last_edited_at)} · {detail.last_edited_by?.name ?? "Bác sĩ"}</p>}</div><button type="button" className="soft-button h-9 px-3" onClick={() => setEditing((value) => !value)}> {editing ? "Đóng chỉnh sửa" : "Chỉnh sửa"}</button></div>
      {editing ? <div className="mt-4"><ExamForm initial={detail} editing busy={busy} onSubmit={save} onCancel={() => setEditing(false)} /></div> : <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{[...examFields, ...examLongFields].map((field) => { const value = detail[field.name as keyof HealthExam]; return value === undefined || value === null || value === "" ? null : <p key={field.name} className="rounded-lg bg-white px-3 py-2 text-sm"><span className="block text-xs text-slate-500">{field.label}</span><span className="whitespace-pre-wrap font-medium text-slate-800">{String(value)}</span></p>; })}</div>}
      <div className="mt-4 border-t border-equine-line pt-3"><p className="mb-2 flex items-center gap-2 text-sm font-semibold text-equine-navy"><ClipboardCheck size={15} /> Lịch sử sửa ({logs.length})</p>{logs.length === 0 ? <p className="text-xs text-slate-500">Hồ sơ chưa có lần chỉnh sửa.</p> : <div className="space-y-2">{logs.map((log) => <div key={log.id} className="rounded-lg bg-white p-3 text-xs"><p className="font-semibold">{log.edited_by?.name ?? "Bác sĩ"} · {displayDate(log.edited_at)}</p><ul className="mt-1 space-y-1">{log.changes.map((change) => <li key={change.field}>{change.field}: {String(change.old_value ?? "—")} → {String(change.new_value ?? "—")}</li>)}</ul></div>)}</div>}</div>
    </div>}
    {loading && response.data.length === 0 ? <Notice>Đang tải lịch sử khám...</Notice> : error ? null : response.data.length === 0 ? <Empty>Chưa có hồ sơ khám. Hãy tạo lần khám đầu tiên.</Empty> : <div className="space-y-2">{response.data.map((exam) => <button key={exam.id} type="button" onClick={() => void openExam(exam.id)} className="flex w-full flex-col gap-2 rounded-xl border border-equine-line p-3 text-left hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><p className="font-semibold text-equine-navy">{displayDate(exam.exam_date)}</p><CompactId id={exam.id} /></div><p className="text-xs text-slate-500">{exam.doctor?.name ?? "Bác sĩ"}{exam.has_edits ? " · Đã chỉnh sửa" : ""}</p></div><div className="flex gap-3 text-sm"><span>{exam.temperature_c ?? "—"} °C</span><span>{exam.heart_rate ?? "—"} bpm</span><span>{exam.respiratory_rate ?? "—"} lần/phút</span></div></button>)}</div>}
    {response.data.length < response.total && <button type="button" className="soft-button mt-3 h-10 px-4" disabled={loading} onClick={() => void load(page + 1, true)}>Tải thêm hồ sơ</button>}
  </SectionCard>;
}

function MedicalPanel({ horse, onChanged }: { horse: VetHorse; onChanged: (message: string) => void }) {
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [exams, setExams] = useState<HealthExam[]>([]);
  const [details, setDetails] = useState<Record<string, MedicalRecord>>({});
  const [openRecord, setOpenRecord] = useState("");
  const [editingRecord, setEditingRecord] = useState("");
  const [prescribingRecord, setPrescribingRecord] = useState("");
  const [editingPrescription, setEditingPrescription] = useState<Prescription | null>(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [medicalNotice, setMedicalNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const [recordsResult, prescriptionsResult, examsResult] = await Promise.allSettled([
      veterinarianApi.records(horse.id), veterinarianApi.prescriptions(horse.id), veterinarianApi.exams(horse.id),
    ]);
    const failures: string[] = [];
    if (recordsResult.status === "fulfilled") setRecords(recordsResult.value.data);
    else { setRecords([]); failures.push(`Chẩn đoán: ${veterinarianError(recordsResult.reason)}`); }
    if (prescriptionsResult.status === "fulfilled") setPrescriptions(prescriptionsResult.value.data);
    else { setPrescriptions([]); failures.push(`Đơn thuốc: ${veterinarianError(prescriptionsResult.reason)}`); }
    if (examsResult.status === "fulfilled") setExams(examsResult.value.data);
    else { setExams([]); failures.push(`Lần khám: ${veterinarianError(examsResult.reason)}`); }
    setError(failures.join(" · "));
    setLoading(false);
  }, [horse.id]);
  useEffect(() => { setRecords([]); setPrescriptions([]); setExams([]); setDetails({}); setOpenRecord(""); void load(); }, [load]);

  async function loadRecordDetail(id: string) {
    if (details[id]) return;
    try { const detail = await veterinarianApi.record(id); setDetails((current) => ({ ...current, [id]: detail })); }
    catch (reason) { setError(veterinarianError(reason)); }
  }
  async function toggleRecord(record: MedicalRecord) {
    if (openRecord === record.id) { setOpenRecord(""); return; }
    setOpenRecord(record.id); setError("");
    await loadRecordDetail(record.id);
  }
  async function createRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const values = formValues(event.currentTarget, [], ["health_exam_id", "treatment_plan"]);
      await veterinarianApi.createRecord(horse.id, values as { health_exam_id?: string; diagnosis: string; treatment_plan?: string });
      setCreating(false); await load(); onChanged("Đã tạo chẩn đoán và phác đồ điều trị.");
    } catch (reason) { setError(veterinarianError(reason)); }
    finally { setBusy(false); }
  }
  async function saveRecord(event: FormEvent<HTMLFormElement>, recordId: string) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const values = formValues(event.currentTarget, [], ["treatment_plan"]);
      await veterinarianApi.updateRecord(recordId, values as { diagnosis: string; treatment_plan?: string });
      setEditingRecord(""); setDetails((current) => { const updated = { ...current }; delete updated[recordId]; return updated; }); await load(); onChanged("Đã cập nhật chẩn đoán.");
    } catch (reason) { setError(veterinarianError(reason)); }
    finally { setBusy(false); }
  }
  async function createPrescription(event: FormEvent<HTMLFormElement>, recordId: string) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const values = formValues(event.currentTarget, [], ["dosage", "frequency", "route", "end_date", "notes"]);
      const result = await veterinarianApi.createPrescription(recordId, values);
      setMedicalNotice(result.warnings?.length ? "Đơn thuốc đã tạo, nhưng có đơn cùng thuốc đang chồng ngày. Hãy kiểm tra danh sách đơn." : "Đã tạo đơn thuốc.");
      setPrescribingRecord(""); await load(); onChanged(result.warnings?.length ? "Đã tạo đơn thuốc kèm cảnh báo trùng thuốc." : "Đã tạo đơn thuốc.");
    } catch (reason) { setError(veterinarianError(reason)); }
    finally { setBusy(false); }
  }
  async function updatePrescription(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editingPrescription) return;
    setBusy(true); setError("");
    try {
      const values = formValues(event.currentTarget, [], ["dosage", "frequency", "route", "end_date", "notes"]);
      await veterinarianApi.updatePrescription(editingPrescription.id, values as Partial<Prescription>);
      setEditingPrescription(null); await load(); onChanged("Đã cập nhật trạng thái hoặc nội dung đơn thuốc.");
    } catch (reason) { setError(veterinarianError(reason)); }
    finally { setBusy(false); }
  }
  async function closePrescription(item: Prescription, status: "Completed" | "Stopped") {
    setBusy(true); setError("");
    try { await veterinarianApi.updatePrescription(item.id, { status }); await load(); onChanged(status === "Completed" ? "Đã kết thúc đơn thuốc." : "Đã dừng đơn thuốc."); }
    catch (reason) { setError(veterinarianError(reason)); }
    finally { setBusy(false); }
  }

  return <div className="space-y-4">
    <SectionCard title="Chẩn đoán & phác đồ" description="Gắn chẩn đoán với lần khám của cùng ngựa; đơn thuốc được kê từ hồ sơ chẩn đoán." icon={FileHeart} action={<button type="button" className="gold-button h-10 px-3" onClick={() => setCreating((value) => !value)}>+ Chẩn đoán</button>}>
      <ErrorLine>{error}</ErrorLine>{medicalNotice && <div className="mb-3"><Notice>{medicalNotice}</Notice></div>}
      {creating && <form onSubmit={createRecord} className="mb-4 space-y-3 rounded-xl border border-equine-line bg-slate-50 p-4"><h4 className="font-semibold text-equine-navy">Tạo chẩn đoán</h4><label className="block"><span className="field-label">Lần khám liên quan (không bắt buộc)</span><select name="health_exam_id" defaultValue="" className="field-control px-3"><option value="">Không gắn lần khám</option>{exams.map((exam) => <option key={exam.id} value={exam.id}>{displayDate(exam.exam_date)} · {exam.temperature_c ?? "—"} °C</option>)}</select></label><TextAreaField label="Chẩn đoán" name="diagnosis" required /><TextAreaField label="Phác đồ điều trị" name="treatment_plan" rows={3} /><div className="flex gap-2"><button className="gold-button" disabled={busy}>Lưu chẩn đoán</button><button type="button" className="soft-button h-11 px-4" onClick={() => setCreating(false)}>Hủy</button></div></form>}
      {loading ? <Notice>Đang tải hồ sơ điều trị...</Notice> : error.includes("Chẩn đoán:") ? null : records.length === 0 ? <Empty>Chưa có chẩn đoán cho ngựa này.</Empty> : <div className="space-y-2">{records.map((record) => {
        const detail = details[record.id];
        return <article key={record.id} className="rounded-xl border border-equine-line p-3">
          <div className="flex flex-wrap items-start justify-between gap-2"><button type="button" className="min-w-0 flex-1 text-left" onClick={() => void toggleRecord(record)}><p className="font-semibold text-equine-navy">{record.diagnosis}</p><p className="mt-1 text-xs text-slate-500">{displayDate(record.created_at)}{record.health_exam_id ? " · Có lần khám liên quan" : ""}</p></button><div className="flex gap-2"><button type="button" className="soft-button h-9 px-3 text-xs" onClick={() => { setEditingRecord(editingRecord === record.id ? "" : record.id); setOpenRecord(record.id); void loadRecordDetail(record.id); }}>Sửa</button><button type="button" className="soft-button h-9 px-3 text-xs" onClick={() => { setPrescribingRecord(prescribingRecord === record.id ? "" : record.id); setOpenRecord(record.id); void loadRecordDetail(record.id); }}>Kê thuốc</button></div></div>
          {openRecord === record.id && detail && <div className="mt-3 border-t border-equine-line pt-3">{editingRecord === record.id ? <form className="space-y-3" onSubmit={(event) => void saveRecord(event, record.id)}><TextAreaField label="Chẩn đoán" name="diagnosis" required defaultValue={detail.diagnosis} /><TextAreaField label="Phác đồ điều trị" name="treatment_plan" defaultValue={detail.treatment_plan} /><div className="flex gap-2"><button className="gold-button h-10" disabled={busy}>Lưu</button><button type="button" className="soft-button h-10 px-3" onClick={() => setEditingRecord("")}>Hủy</button></div></form> : <><p className="whitespace-pre-wrap text-sm text-slate-700">{detail.treatment_plan || "Chưa ghi phác đồ điều trị."}</p><p className="mt-2 text-xs text-slate-500">{detail.prescriptions?.length ?? 0} đơn thuốc · {detail.injury_markers?.length ?? 0} điểm chấn thương liên quan</p></>}
            {prescribingRecord === record.id && <form className="mt-4 space-y-3 rounded-xl bg-slate-50 p-3" onSubmit={(event) => void createPrescription(event, record.id)}><h4 className="font-semibold text-equine-navy">Đơn thuốc mới</h4><div className="grid gap-3 sm:grid-cols-2"><Field label="Tên thuốc" name="drug_name" required maxLength={150} /><Field label="Liều dùng" name="dosage" maxLength={100} /><Field label="Tần suất" name="frequency" maxLength={100} /><SelectField label="Đường dùng" name="route" options={[{ value: "Oral", label: "Uống (Oral)" }, { value: "IV", label: "Tĩnh mạch (IV)" }, { value: "IM", label: "Tiêm bắp (IM)" }, { value: "Topical", label: "Bôi ngoài da" }, { value: "Other", label: "Khác" }]} /><Field label="Ngày bắt đầu" name="start_date" type="date" required defaultValue={today()} /><Field label="Ngày kết thúc" name="end_date" type="date" /></div><TextAreaField label="Ghi chú" name="notes" rows={2} /><div className="flex gap-2"><button className="gold-button h-10" disabled={busy}>Tạo đơn thuốc</button><button type="button" className="soft-button h-10 px-3" onClick={() => setPrescribingRecord("")}>Hủy</button></div></form>}
          </div>}
        </article>;
      })}</div>}
    </SectionCard>

    <SectionCard title="Đơn thuốc" description="Đơn đã kết thúc chỉ xem được; cần điều chỉnh thì tạo đơn mới." icon={Pill}>
      {loading || error.includes("Đơn thuốc:") ? null : prescriptions.length === 0 ? <Empty>Chưa có đơn thuốc.</Empty> : <div className="space-y-2">{prescriptions.map((item) => <article key={item.id} className="rounded-xl border border-equine-line p-3"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-equine-navy">{item.drug_name} <span className={`ml-2 rounded-full px-2 py-1 text-[10px] ${item.status === "Active" ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{item.status}</span></p><p className="mt-1 text-xs text-slate-500">{item.dosage || "Chưa ghi liều"} · {item.frequency || "Chưa ghi tần suất"} · {item.start_date ?? "—"} → {item.end_date ?? "Chưa kết thúc"}</p></div>{item.status === "Active" && <div className="flex flex-wrap gap-2"><button type="button" className="soft-button h-9 px-3 text-xs" onClick={() => setEditingPrescription(editingPrescription?.id === item.id ? null : item)}>Sửa đơn</button><button type="button" className="soft-button h-9 border-emerald-200 bg-emerald-50 px-3 text-xs text-emerald-800" disabled={busy} onClick={() => void closePrescription(item, "Completed")}>Hoàn thành</button><button type="button" className="soft-button h-9 border-rose-200 bg-rose-50 px-3 text-xs text-rose-800" disabled={busy} onClick={() => void closePrescription(item, "Stopped")}>Dừng</button></div>}</div>
        {item.warnings?.map((warning) => <p key={warning.code} className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900"><AlertTriangle size={13} className="mr-1 inline" />Có đơn thuốc cùng hoạt chất/tên thuốc đang chồng ngày.</p>)}
        {editingPrescription?.id === item.id && <form onSubmit={(event) => void updatePrescription(event)} className="mt-3 grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-2"><Field label="Liều dùng" name="dosage" defaultValue={item.dosage} maxLength={100} /><Field label="Tần suất" name="frequency" defaultValue={item.frequency} maxLength={100} /><Field label="Đường dùng" name="route" defaultValue={item.route} maxLength={50} /><Field label="Ngày kết thúc" name="end_date" type="date" defaultValue={item.end_date} /><SelectField label="Trạng thái" name="status" defaultValue={item.status} options={[{ value: "Active", label: "Đang dùng" }, { value: "Completed", label: "Hoàn thành" }, { value: "Stopped", label: "Đã dừng" }]} /><TextAreaField label="Ghi chú" name="notes" defaultValue={item.notes} rows={2} /><div className="flex gap-2 sm:col-span-2"><button className="gold-button h-10" disabled={busy}>Lưu đơn</button><button type="button" className="soft-button h-10 px-3" onClick={() => setEditingPrescription(null)}>Hủy</button></div></form>}
      </article>)}</div>}
    </SectionCard>
  </div>;
}

function DietPanel({ horse, onChanged }: { horse: VetHorse; onChanged: (message: string) => void }) {
  const [records, setRecords] = useState<DietRecord[]>([]);
  const [includeHistory, setIncludeHistory] = useState(true);
  const [activeOn, setActiveOn] = useState(today());
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<DietRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const result = await veterinarianApi.diets(horse.id, includeHistory, activeOn);
      const active = includeHistory ? result.data : result.data.filter((item) => (!item.effective_date || item.effective_date <= activeOn) && (!item.end_date || item.end_date >= activeOn));
      setRecords(active);
    } catch (reason) { setError(veterinarianError(reason)); }
    finally { setLoading(false); }
  }, [activeOn, horse.id, includeHistory]);
  useEffect(() => { void load(); }, [load]);

  async function save(event: FormEvent<HTMLFormElement>, item?: DietRecord) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const values = formValues(event.currentTarget, ["quantity_kg"], ["feeding_frequency", "special_instructions", "end_date"]);
      if (item) await veterinarianApi.updateDiet(item.id, values);
      else await veterinarianApi.createDiet(horse.id, values);
      setCreating(false); setEditing(null); await load(); onChanged(item ? "Đã cập nhật khẩu phần." : "Đã tạo khẩu phần.");
    } catch (reason) { setError(veterinarianError(reason)); }
    finally { setBusy(false); }
  }
  async function endToday(item: DietRecord) {
    setBusy(true); setError("");
    try { await veterinarianApi.updateDiet(item.id, { end_date: today() }); await load(); onChanged("Đã kết thúc khẩu phần từ hôm nay."); }
    catch (reason) { setError(veterinarianError(reason)); }
    finally { setBusy(false); }
  }

  return <SectionCard title="Khẩu phần ăn" description="Một ngựa có thể có nhiều loại thức ăn. Cùng loại thức ăn không được chồng khoảng ngày." icon={Utensils} action={<button type="button" className="gold-button h-10 px-3" onClick={() => { setCreating((value) => !value); setEditing(null); }}>+ Khẩu phần</button>}>
    <ErrorLine>{error}</ErrorLine>
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={includeHistory} onChange={(event) => setIncludeHistory(event.target.checked)} /> Hiện cả lịch sử</label>{!includeHistory && <label className="block"><span className="field-label">Đang hiệu lực vào ngày</span><input type="date" value={activeOn} onChange={(event) => setActiveOn(event.target.value)} className="field-control px-3" /></label>}</div>
    {(creating || editing) && <form key={editing?.id ?? "new-diet"} onSubmit={(event) => void save(event, editing ?? undefined)} className="mb-4 grid gap-3 rounded-xl border border-equine-line bg-slate-50 p-4 sm:grid-cols-2"><h4 className="font-semibold text-equine-navy sm:col-span-2">{editing ? "Chỉnh sửa khẩu phần" : "Thêm khẩu phần"}</h4><Field label="Loại thức ăn" name="feed_type" required maxLength={100} defaultValue={editing?.feed_type} /><Field label="Khối lượng (kg)" name="quantity_kg" type="number" required min={0.01} step="0.01" defaultValue={editing?.quantity_kg} /><Field label="Tần suất cho ăn" name="feeding_frequency" maxLength={50} defaultValue={editing?.feeding_frequency} /><Field label="Ngày bắt đầu hiệu lực" name="effective_date" type="date" required defaultValue={editing?.effective_date ?? today()} /><Field label="Ngày kết thúc" name="end_date" type="date" defaultValue={editing?.end_date} /><TextAreaField label="Hướng dẫn đặc biệt" name="special_instructions" defaultValue={editing?.special_instructions} rows={2} /><div className="flex gap-2 sm:col-span-2"><button className="gold-button h-10" disabled={busy}>{editing ? "Lưu thay đổi" : "Tạo khẩu phần"}</button><button type="button" className="soft-button h-10 px-3" onClick={() => { setCreating(false); setEditing(null); }}>Hủy</button></div></form>}
    {loading ? <Notice>Đang tải khẩu phần...</Notice> : error ? null : records.length === 0 ? <Empty>Không có khẩu phần trong khoảng thời gian này.</Empty> : <div className="space-y-2">{records.map((item) => <article key={item.id} className="flex flex-col gap-3 rounded-xl border border-equine-line p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-equine-navy">{item.feed_type} · {item.quantity_kg} kg</p><p className="mt-1 text-sm text-slate-600">{item.feeding_frequency || "Chưa ghi tần suất"} · {item.effective_date ?? "—"} → {item.end_date ?? "Đang áp dụng"}</p>{item.special_instructions && <p className="mt-1 whitespace-pre-wrap text-xs text-slate-500">{item.special_instructions}</p>}</div><div className="flex gap-2"><button type="button" className="soft-button h-9 px-3 text-xs" onClick={() => { setEditing(item); setCreating(false); }}>Sửa</button>{!item.end_date && <button type="button" className="soft-button h-9 border-amber-200 bg-amber-50 px-3 text-xs text-amber-900" disabled={busy} onClick={() => void endToday(item)}>Kết thúc hôm nay</button>}</div></article>)}</div>}
  </SectionCard>;
}

function InjuriesPanel({ horse, onChanged }: { horse: VetHorse; onChanged: (message: string) => void }) {
  const [markers, setMarkers] = useState<InjuryMarker[]>([]);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [latestOnly, setLatestOnly] = useState(false);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [suggestLock, setSuggestLock] = useState(false);
  const [assessmentFor, setAssessmentFor] = useState<InjuryMarker | null>(null);
  const [draftCoordinates, setDraftCoordinates] = useState<InjuryCoordinateFields>({ coordinate_x: "", coordinate_y: "", coordinate_z: "" });
  const selectedCoordinates = {
    coordinate_x: draftCoordinates.coordinate_x === "" ? null : Number(draftCoordinates.coordinate_x),
    coordinate_y: draftCoordinates.coordinate_y === "" ? null : Number(draftCoordinates.coordinate_y),
    coordinate_z: draftCoordinates.coordinate_z === "" ? null : Number(draftCoordinates.coordinate_z),
  };
  const latestByBodyPart = useMemo(() => {
    const latest = new Map<string, InjuryMarker>();
    for (const marker of markers) {
      const key = marker.body_part.trim().toLocaleLowerCase();
      if (!latest.has(key)) latest.set(key, marker);
    }
    return Array.from(latest.values());
  }, [markers]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const [injuriesResult, recordsResult] = await Promise.allSettled([
      veterinarianApi.injuries(horse.id, latestOnly), veterinarianApi.records(horse.id),
    ]);
    const failures: string[] = [];
    if (injuriesResult.status === "fulfilled") setMarkers(injuriesResult.value.data);
    else { setMarkers([]); failures.push(`Điểm chấn thương: ${veterinarianError(injuriesResult.reason)}`); }
    if (recordsResult.status === "fulfilled") setRecords(recordsResult.value.data);
    else { setRecords([]); failures.push(`Chẩn đoán liên quan: ${veterinarianError(recordsResult.reason)}`); }
    setError(failures.join(" · "));
    setLoading(false);
  }, [horse.id, latestOnly]);
  useEffect(() => { void load(); }, [load]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setSuggestLock(false);
    try {
      const values = formValues(event.currentTarget, ["coordinate_x", "coordinate_y", "coordinate_z"], ["medical_record_id", "coordinate_x", "coordinate_y", "coordinate_z", "description"]);
      if (("coordinate_x" in values) !== ("coordinate_y" in values)) {
        setError("Cần nhập cả tọa độ X và Y để lưu vị trí trên mô hình.");
        return;
      }
      await veterinarianApi.createInjury(horse.id, values);
      setCreating(false); setAssessmentFor(null); setDraftCoordinates({ coordinate_x: "", coordinate_y: "", coordinate_z: "" }); await load();
      if (values.recovery_status !== "Recovered") {
        const lockReason = `Chấn thương ${String(values.body_part)}: ${String(values.description || values.severity)}`.slice(0, 255);
        try {
          const status = await veterinarianApi.updateHealthStatus(horse.id, "Injured", "NotReady", lockReason);
          if (!status.is_training_locked) {
            await veterinarianApi.lockTraining(horse.id, {
              lock_level: values.severity === "Severe" ? "Critical" : "Warning",
              lock_reason: lockReason,
            });
          }
        } catch (reason) {
          setError(`Đã lưu chấn thương nhưng không thể tự động cập nhật trạng thái và khóa huấn luyện: ${veterinarianError(reason)}`);
          onChanged(`Đã ghi nhận chấn thương tại ${String(values.body_part)}; cần kiểm tra lại trạng thái sức khỏe và khóa huấn luyện.`);
          return;
        }
        setSuggestLock(true);
        onChanged(`Đã ghi nhận chấn thương tại ${String(values.body_part)}, mức ${injurySeverityLabels[String(values.severity) as InjuryMarker["severity"]] ?? String(values.severity)}. Ngựa đã chuyển sang Chấn thương, chưa sẵn sàng và khóa huấn luyện.`);
      } else {
        onChanged(`Đã cập nhật đánh giá chấn thương tại ${String(values.body_part)}: ${injuryStatusLabels[String(values.recovery_status) as InjuryMarker["recovery_status"]] ?? "đã ghi nhận"}. Xác nhận trạng thái sức khỏe trước khi cho ngựa hoạt động lại.`);
      }
    } catch (reason) { setError(veterinarianError(reason)); }
    finally { setBusy(false); }
  }

  return <SectionCard title="Chấn thương & phục hồi" description="Đánh dấu trên mô hình 3D và lưu từng lần đánh giá để theo dõi tiến triển." icon={Activity} action={<button type="button" className="gold-button h-10 px-3" onClick={() => { setAssessmentFor(null); setDraftCoordinates({ coordinate_x: "", coordinate_y: "", coordinate_z: "" }); setCreating((value) => !value); setSuggestLock(false); }}>+ Đánh dấu</button>}>
    <ErrorLine>{error}</ErrorLine>
    {!creating && latestByBodyPart.some((marker) => marker.recovery_status !== "Recovered") && <div className="mb-4 flex flex-wrap gap-2">{latestByBodyPart.filter((marker) => marker.recovery_status !== "Recovered").map((marker) => <button key={marker.id} type="button" className="soft-button h-9 px-3 text-xs" onClick={() => { setAssessmentFor(marker); setCreating(false); setDraftCoordinates({ coordinate_x: marker.coordinate_x == null ? "" : String(marker.coordinate_x), coordinate_y: marker.coordinate_y == null ? "" : String(marker.coordinate_y), coordinate_z: marker.coordinate_z == null ? "" : String(marker.coordinate_z) }); }}>{marker.body_part}: đánh giá phục hồi</button>)}</div>}
    {(!loading || creating || assessmentFor) && !error.includes("Điểm chấn thương:") && <InjuryModel3D markers={markers} placementMode={creating || Boolean(assessmentFor)} selectedCoordinates={selectedCoordinates} onSelectLocation={(coordinates) => setDraftCoordinates({ coordinate_x: coordinates.coordinate_x == null ? "" : coordinates.coordinate_x.toFixed(3), coordinate_y: coordinates.coordinate_y == null ? "" : coordinates.coordinate_y.toFixed(3), coordinate_z: coordinates.coordinate_z == null ? "" : coordinates.coordinate_z.toFixed(3) })} />}
    {assessmentFor && <form key={assessmentFor.id} onSubmit={(event) => void create(event)} className="mb-4 mt-4 grid gap-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4 sm:grid-cols-2"><h4 className="font-semibold text-equine-navy sm:col-span-2">Đánh giá phục hồi mới</h4><Field label="Vị trí cơ thể" name="body_part" required maxLength={50} defaultValue={assessmentFor.body_part} /><SelectField label="Mức độ" name="severity" required defaultValue={assessmentFor.severity} options={[{ value: "Mild", label: "Nhẹ · Mild" }, { value: "Moderate", label: "Vừa · Moderate" }, { value: "Severe", label: "Nặng · Severe" }]} /><SelectField label="Tình trạng phục hồi" name="recovery_status" defaultValue={assessmentFor.recovery_status === "Active" ? "Recovering" : "Recovered"} options={[{ value: "Active", label: "Đang chấn thương" }, { value: "Recovering", label: "Đang hồi phục" }, { value: "Recovered", label: "Đã hồi phục" }]} /><label className="block sm:col-span-2"><span className="field-label">Chẩn đoán liên quan</span><select name="medical_record_id" defaultValue={assessmentFor.medical_record_id ?? ""} className="field-control px-3"><option value="">Không gắn chẩn đoán</option>{records.map((record) => <option key={record.id} value={record.id}>{record.diagnosis}</option>)}</select></label><CoordinateFields value={draftCoordinates} onChange={setDraftCoordinates} /><div className="sm:col-span-2"><TextAreaField label="Mô tả" name="description" rows={3} defaultValue={assessmentFor.description} /></div><div className="flex gap-2 sm:col-span-2"><button className="gold-button h-10" disabled={busy}>Lưu đánh giá phục hồi</button><button type="button" className="soft-button h-10 px-3" onClick={() => { setAssessmentFor(null); setDraftCoordinates({ coordinate_x: "", coordinate_y: "", coordinate_z: "" }); }}>Hủy</button></div></form>}
    <label className="mb-4 inline-flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={latestOnly} onChange={(event) => setLatestOnly(event.target.checked)} /> Chỉ điểm mới nhất của mỗi vị trí</label>
    {creating && <form onSubmit={(event) => void create(event)} className="mb-4 mt-4 grid gap-3 rounded-xl border border-equine-line bg-slate-50 p-4 sm:grid-cols-2"><h4 className="font-semibold text-equine-navy sm:col-span-2">Đánh giá chấn thương mới</h4><Field label="Vị trí cơ thể" name="body_part" required maxLength={50} placeholder="Ví dụ: Chân trước trái" /><SelectField label="Mức độ" name="severity" required options={[{ value: "Mild", label: "Nhẹ · Mild" }, { value: "Moderate", label: "Vừa · Moderate" }, { value: "Severe", label: "Nặng · Severe" }]} /><SelectField label="Tình trạng phục hồi" name="recovery_status" options={[{ value: "Active", label: "Đang chấn thương" }, { value: "Recovering", label: "Đang hồi phục" }, { value: "Recovered", label: "Đã hồi phục" }]} /><label className="block sm:col-span-2"><span className="field-label">Chẩn đoán liên quan</span><select name="medical_record_id" defaultValue="" className="field-control px-3"><option value="">Không gắn chẩn đoán</option>{records.map((record) => <option key={record.id} value={record.id}>{record.diagnosis}</option>)}</select></label><CoordinateFields value={draftCoordinates} onChange={setDraftCoordinates} /><div className="sm:col-span-2"><TextAreaField label="Mô tả" name="description" rows={3} /></div><div className="flex gap-2 sm:col-span-2"><button className="gold-button h-10" disabled={busy}>Lưu đánh giá</button><button type="button" className="soft-button h-10 px-3" onClick={() => { setCreating(false); setDraftCoordinates({ coordinate_x: "", coordinate_y: "", coordinate_z: "" }); }}>Hủy</button></div></form>}
    {suggestLock && <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle size={15} className="mr-1 inline" />Ngựa đã chuyển sang trạng thái Chấn thương, sẵn sàng thi đấu bị đặt thành Chưa sẵn sàng và lịch tập đã khóa.</p>}
    {loading ? <Notice>Đang tải điểm chấn thương...</Notice> : error.includes("Điểm chấn thương:") ? null : markers.length === 0 ? (!creating && !assessmentFor ? <Empty>Chưa có đánh giá chấn thương.</Empty> : null) : <div className="mt-4 space-y-3">{markers.map((marker) => <article key={marker.id} className={`rounded-xl border p-4 ${marker.recovery_status === "Recovered" ? "border-emerald-200 bg-emerald-50/60" : marker.severity === "Severe" ? "border-rose-200 bg-rose-50/50" : "border-equine-line"}`}><div className="flex flex-wrap items-start justify-between gap-2"><div><h4 className="font-semibold text-equine-navy">{marker.body_part}</h4><p className="mt-1 text-xs text-slate-500">{displayDate(marker.marked_at)} · {marker.coordinate_x == null ? "Chưa đặt tọa độ" : `X ${marker.coordinate_x}, Y ${marker.coordinate_y}${marker.coordinate_z == null ? "" : `, Z ${marker.coordinate_z}`}`}</p></div><div className="flex gap-2"><span className="rounded-full bg-white px-2 py-1 text-xs font-semibold">{marker.severity}</span><span className="rounded-full bg-white px-2 py-1 text-xs font-semibold">{marker.recovery_status}</span></div></div>{marker.description && <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{marker.description}</p>}</article>)}</div>}
  </SectionCard>;
}

function StableIncidentsPanel({ onOpenHorse }: { onOpenHorse: (id: string) => void }) {
  const [status, setStatus] = useState("Open");
  const [incidents, setIncidents] = useState<VetStableIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setIncidents((await veterinarianApi.incidents(status)).data); }
    catch (reason) { setError(veterinarianError(reason)); }
    finally { setLoading(false); }
  }, [status]);
  useEffect(() => { void load(); }, [load]);

  async function claim(incidentId: string) {
    setBusy(true); setError(""); setNotice("");
    try { await veterinarianApi.claimEmergencyIncident(incidentId); setNotice("Đã tiếp nhận sự cố khẩn cấp."); await load(); }
    catch (reason) { setError(veterinarianError(reason)); }
    finally { setBusy(false); }
  }

  async function submitResult(event: FormEvent<HTMLFormElement>, incidentId: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const resultNote = String(new FormData(form).get("result_note") ?? "").trim();
    setBusy(true); setError(""); setNotice("");
    try { await veterinarianApi.submitIncidentResult(incidentId, resultNote); setNotice("Đã gửi kết quả để Club Manager xem xét đóng sự cố."); await load(); }
    catch (reason) { setError(veterinarianError(reason)); }
    finally { setBusy(false); }
  }

  return <SectionCard title="Báo cáo sự cố từ Groom" description="Tiếp nhận sự cố khẩn cấp hoặc xử lý báo cáo được Club Manager giao." icon={AlertTriangle} action={<select aria-label="Lọc sự cố" value={status} onChange={(event) => setStatus(event.target.value)} className="field-control h-10 px-3"><option value="Open">Đang xử lý</option><option value="Pending">Chưa phân công</option><option value="InProgress">Đang thực hiện</option><option value="AwaitingClosure">Chờ đóng</option><option value="Resolved">Đã đóng</option><option value="All">Tất cả</option></select>}>
    <ErrorLine>{error}</ErrorLine>{notice && <Notice>{notice}</Notice>}
    {loading ? <Notice>Đang tải báo cáo sự cố...</Notice> : error ? null : incidents.length === 0 ? <Empty>Không có báo cáo ở trạng thái này.</Empty> : <div className="grid gap-3 lg:grid-cols-2">{incidents.map((incident) => <article key={incident.id} className={`rounded-xl border p-4 ${incident.is_emergency ? "border-rose-300 bg-rose-50/40" : "border-equine-line bg-white"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2"><div><h4 className="font-semibold text-equine-navy">{incident.horse_name}</h4><p className="mt-1 text-xs text-slate-500">{incident.box_code ? `Khu ${incident.section} · Chuồng ${incident.box_code} · ` : ""}{incident.groom_name ?? "Groom"} · {new Date(incident.created_at).toLocaleString("vi-VN")}</p></div><div className="flex gap-2"><span className="rounded-full bg-white px-2 py-1 text-xs font-semibold">{incident.status}</span>{incident.is_emergency && <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-bold text-rose-800">KHẨN CẤP</span>}</div></div>
      <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{incident.issue_description}</p>
      <IncidentPhoto incidentId={incident.id} imageUrl={incident.image_url} />
      {incident.assignee_name && <p className="mt-3 text-sm font-semibold text-equine-navy">Phụ trách: {incident.assignee_name} · {incident.assigned_role}</p>}
      {incident.assignment_note && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-blue-50 p-3 text-sm text-blue-900"><strong>Ghi chú giao việc:</strong> {incident.assignment_note}</p>}
      {incident.result_note && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900"><strong>Kết quả xử lý:</strong> {incident.result_note}</p>}
      {incident.is_emergency && incident.status === "Pending" && !incident.assigned_to && <button type="button" className="soft-button mt-3 border-rose-200 bg-rose-100 text-rose-900" disabled={busy} onClick={() => void claim(incident.id)}>Tiếp nhận sự cố khẩn cấp</button>}
      {incident.assigned_to_me && incident.status === "InProgress" && <form onSubmit={(event) => void submitResult(event, incident.id)} className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3">
        <label className="block"><span className="field-label">Kết quả xử lý</span><textarea className="field-control min-h-20 px-3 py-2" name="result_note" maxLength={2000} required /></label>
        <button className="soft-button" disabled={busy}>Gửi kết quả cho Club Manager</button>
      </form>}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-slate-500">{statusLabels[incident.current_status] ?? incident.current_status} · {incident.readiness_status}</span><button type="button" className="soft-button h-9 px-3 text-xs" onClick={() => onOpenHorse(incident.horse_id)}>Mở hồ sơ y tế</button></div>
    </article>)}</div>}
  </SectionCard>;
}
function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateFromKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addCalendarDays(value: string, days: number) {
  const date = dateFromKey(value);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

function mondayOfWeek(value: string) {
  const date = dateFromKey(value);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return dateKey(date);
}

function getISOWeekNumber(d: Date): number {
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}

function formatDayMonth(value: string) {
  const parts = value.split("-").map(Number);
  const day = parts[2];
  const month = parts[1];
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`;
}

function vietnameseDayName(value: string) {
  const d = dateFromKey(value);
  const day = d.getDay();
  if (day === 0) return "Chủ nhật";
  return `Thứ ${day + 1}`;
}

interface TimetableSlot {
  id: number;
  label: string;
  timeRange: string;
  startTime: string;
  endTime: string;
}

const TIMETABLE_SLOTS: TimetableSlot[] = [
  { id: 1, label: "1", timeRange: "07h00 - 08h30", startTime: "07:00", endTime: "08:30" },
  { id: 2, label: "2", timeRange: "08h45 - 10h15", startTime: "08:45", endTime: "10:15" },
  { id: 3, label: "3", timeRange: "10h30 - 12h00", startTime: "10:30", endTime: "12:00" },
  { id: 4, label: "4", timeRange: "12h30 - 14h00", startTime: "12:30", endTime: "14:00" },
  { id: 5, label: "5", timeRange: "14h15 - 15h45", startTime: "14:15", endTime: "15:45" },
  { id: 6, label: "6", timeRange: "16h15 - 17h45", startTime: "16:15", endTime: "17:45" },
];

function getEventSlot(event: CalendarCareItem): number {
  if (!event.start_time) return 1;
  const [hStr, mStr] = event.start_time.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr || "0", 10);
  const total = h + m / 60;
  if (total < 8.625) return 1;
  if (total < 10.375) return 2;
  if (total < 12.25) return 3;
  if (total < 14.125) return 4;
  if (total < 16.0) return 5;
  return 6;
}

function formatTimeDisplay(start: string | null | undefined, end: string | null | undefined) {
  if (!start) return "07h00 - 08h30";
  const s = start.slice(0, 5).replace(":", "h");
  const e = end ? end.slice(0, 5).replace(":", "h") : "";
  return e ? `${s} - ${e}` : s;
}

function formatDoctorName(
  event: CalendarCareItem,
  schedule?: CareSchedule,
  currentUser?: { id?: number | string; fullName?: string; name?: string } | null,
): string {
  const doctorName =
    event.assigned_doctor?.name ??
    schedule?.doctor_name ??
    schedule?.assigned_doctor?.name ??
    (currentUser?.fullName || currentUser?.name);

  if (!doctorName || typeof doctorName !== "string") {
    return "Bác sĩ thú y";
  }
  const trimmed = doctorName.trim();
  if (!trimmed) return "Bác sĩ thú y";
  if (/^(bs|bác sĩ|dr|b\.s)\.?\s+/i.test(trimmed)) {
    return trimmed;
  }
  return `BS. ${trimmed}`;
}

function isEventOverdue(event: CalendarCareItem, schedule?: CareSchedule): boolean {
  if (event.context || event.status !== "Scheduled") return false;

  const curDate = today();
  const eventDate = event.due_date ?? event.event_date;

  // 1. Nếu ngày hẹn trước ngày hôm nay -> Chắc chắn quá hạn
  if (eventDate < curDate) return true;

  // 2. Nếu ngày hẹn là ngày hôm nay -> Kiểm tra đã quá giờ kết thúc ca (end_time) hoặc giờ bắt đầu ca (start_time) chưa
  if (eventDate === curDate) {
    const now = new Date();
    const curTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    const endTime = event.end_time?.slice(0, 5);
    const startTime = event.start_time?.slice(0, 5);

    if (endTime) {
      return curTime > endTime;
    }
    if (startTime) {
      return curTime > startTime;
    }
  }

  // 3. Nếu backend đánh dấu quy tắc này là is_overdue
  if (schedule?.is_overdue) return true;

  return false;
}

function isScheduleOverdue(schedule: CareSchedule): boolean {
  if (schedule.event_status === "Completed" && !schedule.frequency_days) return false;
  if (schedule.is_overdue) return true;

  const curDate = today();
  if (schedule.next_due_date < curDate) return true;

  if (schedule.next_due_date === curDate) {
    const now = new Date();
    const curTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    if (schedule.event?.end_time) {
      return curTime > schedule.event.end_time.slice(0, 5);
    }
    if (schedule.event?.start_time) {
      return curTime > schedule.event.start_time.slice(0, 5);
    }
    if (curTime > "17:45") return true;
  }

  return false;
}

function isAssignedDoctor(
  event: CalendarCareItem,
  schedule?: CareSchedule,
  currentUser?: { id?: number | string; fullName?: string; name?: string } | null,
): boolean {
  if (!currentUser) return false;

  const currentUserId = String(currentUser.id ?? "");
  const currentName = (currentUser.fullName ?? currentUser.name ?? "").trim().toLowerCase();

  // 1. So sánh ID bác sĩ
  const eventDocId = event.assigned_doctor?.id != null ? String(event.assigned_doctor.id) : null;
  const schedDocId = schedule?.assigned_doctor_id != null
    ? String(schedule.assigned_doctor_id)
    : schedule?.assigned_doctor?.id != null
    ? String(schedule.assigned_doctor.id)
    : null;

  if (currentUserId && (eventDocId === currentUserId || schedDocId === currentUserId)) {
    return true;
  }

  // 2. So sánh tên bác sĩ (chuẩn hóa bỏ tiền tố BS/Bác sĩ)
  const docName = (event.assigned_doctor?.name ?? schedule?.doctor_name ?? schedule?.assigned_doctor?.name ?? "")
    .trim()
    .toLowerCase();

  if (docName && currentName) {
    const cleanDoc = docName.replace(/^(bs|bác sĩ|dr|b\.s)\.?\s+/i, "").trim();
    const cleanCur = currentName.replace(/^(bs|bác sĩ|dr|b\.s)\.?\s+/i, "").trim();
    if (cleanDoc && cleanCur && (cleanDoc === cleanCur || cleanDoc.includes(cleanCur) || cleanCur.includes(cleanDoc))) {
      return true;
    }
  }

  // Nếu cả event và schedule đều không có thông tin bác sĩ phụ trách, mặc định cho phép
  if (!eventDocId && !schedDocId && !docName) {
    return true;
  }

  return false;
}

type CalendarCareItem = CareEvent & { is_periodic_due?: boolean; due_date?: string };

function CarePanel({ horses, selectedHorse, onChanged }: { horses: VetHorse[]; selectedHorse: VetHorse; onChanged: (message: string) => void }) {
  const [schedules, setSchedules] = useState<CareSchedule[]>([]);
  const [events, setEvents] = useState<CareEvent[]>([]);
  const [contextEvents, setContextEvents] = useState<CareEvent[]>([]);
  const [weekStart, setWeekStart] = useState(() => mondayOfWeek(today()));
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [horseFilter, setHorseFilter] = useState("all");
  const [includeContext, setIncludeContext] = useState(true);
  const [bookNow, setBookNow] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [bookId, setBookId] = useState("");
  const [moveId, setMoveId] = useState("");
  const [completeId, setCompleteId] = useState("");
  const currentUser = useMemo(() => getUser(), []);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const from = weekStart;
  const to = addCalendarDays(weekStart, 6);
  const currentWeekStart = mondayOfWeek(today());
  const [showAllSlots, setShowAllSlots] = useState(false);

  const weekOptions = useMemo(() => {
    const options = [];
    const curr = dateFromKey(currentWeekStart);
    for (let i = -8; i <= 12; i++) {
      const monday = new Date(curr);
      monday.setDate(monday.getDate() + i * 7);
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);
      const key = dateKey(monday);
      const weekNum = getISOWeekNumber(monday);
      const year = monday.getFullYear();
      const mStr = `${String(monday.getDate()).padStart(2, "0")}/${String(monday.getMonth() + 1).padStart(2, "0")}`;
      const sStr = `${String(sunday.getDate()).padStart(2, "0")}/${String(sunday.getMonth() + 1).padStart(2, "0")}`;
      options.push({ key, weekNum, year, label: `Week ${weekNum}, ${year}`, fullLabel: `Week ${weekNum}, ${year} (${mStr} - ${sStr})` });
    }
    return options;
  }, [currentWeekStart]);
  const calendarItems = useMemo<CalendarCareItem[]>(() => {
    const dueItems = schedules.flatMap((schedule): CalendarCareItem[] => {
      if (!schedule.frequency_days && schedule.event_status === "Completed") return [];
      const overdue = (Boolean(schedule.is_overdue) || schedule.next_due_date < today()) && (schedule.event_status !== "Completed" || Boolean(schedule.frequency_days));
      const dueIsThisWeek = schedule.next_due_date >= from && schedule.next_due_date <= to;
      const pinOverdueToToday = weekStart === currentWeekStart && schedule.next_due_date < from && overdue;
      if (!dueIsThisWeek && !pinOverdueToToday) return [];
      const linkedEvents = events.filter((event) =>
        event.schedule_id === schedule.id || Boolean(schedule.calendar_event_id && schedule.calendar_event_id === (event.event_id ?? event.id)),
      );
      const dueDateIsShown = linkedEvents.some((event) => event.event_date === schedule.next_due_date);
      const appointmentIsBooked = Boolean(schedule.calendar_event_id) && !["Cancelled", "Completed"].includes(schedule.event_status ?? "");
      if (dueDateIsShown || appointmentIsBooked) return [];

      const horseName = horses.find((horse) => horse.id === schedule.horse_id)?.horse_name ?? schedule.horse_name ?? "Ngựa";
      return [{
        id: `periodic-${schedule.id}`,
        event_id: `periodic-${schedule.id}`,
        event_date: pinOverdueToToday ? today() : schedule.next_due_date,
        due_date: schedule.next_due_date,
        start_time: null,
        end_time: null,
        status: "Scheduled",
        event_type: "PeriodicCare",
        care_type: schedule.care_type,
        title: schedule.care_type,
        horse_name: horseName,
        horse: { id: schedule.horse_id, horse_name: horseName },
        schedule_id: schedule.id,
        is_periodic_due: true,
        assigned_doctor: schedule.assigned_doctor ?? (schedule.doctor_name ? { name: schedule.doctor_name } : null),
      }];
    });
    const items: CalendarCareItem[] = [
      ...events.map((event) => ({ ...event, context: false })),
      ...dueItems,
      ...(includeContext ? contextEvents.map((event) => ({ ...event, context: true })) : []),
    ];
    return items.filter((event) => {
      if (horseFilter === "all") return true;
      const eventHorseId = event.horse?.id ?? schedules.find((schedule) => schedule.id === event.schedule_id)?.horse_id;
      return eventHorseId === horseFilter;
    });
  }, [contextEvents, currentWeekStart, events, from, horseFilter, horses, includeContext, schedules, to, weekStart]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => {
      const date = addCalendarDays(weekStart, index);
      const dayEvents = calendarItems
        .filter((event) => event.event_date === date)
        .sort((left, right) => {
          const rank = (item: CalendarCareItem) => item.context ? 3 : item.status === "Scheduled" ? 0 : item.status === "Completed" ? 1 : 2;
          return rank(left) - rank(right) || (left.start_time ?? "").localeCompare(right.start_time ?? "");
        });
      return { date, events: dayEvents };
    }),
    [calendarItems, weekStart],
  );
  const weeklyCareEvents = weekDays.flatMap((day) => day.events).filter((event) => !event.context && event.status !== "Cancelled");
  const weeklyCompletedCount = weeklyCareEvents.filter((event) => event.status === "Completed").length;
  const weeklyOverdueCount = weeklyCareEvents.filter((event) => {
    const schedule = schedules.find((item) => item.id === event.schedule_id || Boolean(item.calendar_event_id && item.calendar_event_id === (event.event_id ?? event.id)));
    return isEventOverdue(event, schedule);
  }).length;
  const filteredSchedules = schedules.filter((schedule) => horseFilter === "all" || schedule.horse_id === horseFilter);
  const weeklyDueRuleCount = filteredSchedules.filter((schedule) =>
    (schedule.frequency_days || schedule.event_status !== "Completed") && ((schedule.next_due_date >= from && schedule.next_due_date <= to) || (weekStart === currentWeekStart && (Boolean(schedule.is_overdue) || schedule.next_due_date < today()) && schedule.next_due_date < from)),
  ).length;

  const activeSlots = useMemo(() => {
    const usedSlotIds = new Set<number>();
    weekDays.forEach((day) => {
      day.events.forEach((event) => {
        usedSlotIds.add(getEventSlot(event));
      });
    });
    const filtered = TIMETABLE_SLOTS.filter((slot) => usedSlotIds.has(slot.id));
    if (filtered.length === 0) {
      return [TIMETABLE_SLOTS[0], TIMETABLE_SLOTS[1], TIMETABLE_SLOTS[2]];
    }
    return filtered;
  }, [weekDays]);

  const displaySlots = showAllSlots ? TIMETABLE_SLOTS : activeSlots;

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const [scheduleResult, calendarResult] = await Promise.allSettled([
      veterinarianApi.schedules(), veterinarianApi.calendar(from, to, includeContext, scope),
    ]);
    const failures: string[] = [];
    if (scheduleResult.status === "fulfilled") setSchedules(scheduleResult.value.data);
    else { setSchedules([]); failures.push(`Quy tắc chăm sóc: ${veterinarianError(scheduleResult.reason)}`); }
    if (calendarResult.status === "fulfilled") {
      setEvents(calendarResult.value.data); setContextEvents(calendarResult.value.context_events ?? []);
    } else { setEvents([]); setContextEvents([]); failures.push(`Lịch chăm sóc: ${veterinarianError(calendarResult.reason)}`); }
    setError(failures.join(" · "));
    setLoading(false);
  }, [from, includeContext, scope, to]);
  useEffect(() => { void load(); }, [load]);

  async function createSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    const form = event.currentTarget;
    const formData = new FormData(form);
    const book = formData.get("book_event") === "on";
    const values = formValues(form, ["frequency_days"], ["frequency_days", "last_done_date", "notes", "start_time", "end_time"]);
    values.book_event = book;
    if (book) {
      const slotRange = formData.get("slot_time_range") as string;
      if (slotRange && slotRange.includes("|")) {
        const [s, e] = slotRange.split("|");
        values.start_time = s;
        values.end_time = e;
      }
    }
    try {
      await veterinarianApi.createSchedule(values); setCreateOpen(false); await load();
      onChanged(book ? "Đã tạo lịch chăm sóc và hẹn thông báo." : "Đã lưu quy tắc chăm sóc; lịch chưa được chốt ca.");
      setNotice(book ? "Lịch đã được chốt ca. Thông báo sẽ hiện trước ngày hẹn." : "Quy tắc đã lưu, chưa chốt ca hoặc tạo thông báo.");
    } catch (reason) { setError(veterinarianError(reason)); }
    finally { setBusy(false); }
  }
  async function act(action: () => Promise<unknown>, message: string) {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await action();
      const warnings = result && typeof result === "object" && "warnings" in result ? (result as { warnings?: unknown[] }).warnings : undefined;
      const feedback = warnings?.length ? `${message} Lần tiếp theo chưa được chốt; hãy kiểm tra cảnh báo và đặt lịch sau.` : message;
      setBookId(""); setMoveId(""); setCompleteId(""); await load(); onChanged(feedback); setNotice(feedback);
    }
    catch (reason) { setError(veterinarianError(reason)); }
    finally { setBusy(false); }
  }
  async function submitBook(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const slotRange = formData.get("slot_time_range") as string;
    let startTime = (formData.get("start_time") as string) || "";
    let endTime = (formData.get("end_time") as string) || "";
    if (slotRange && slotRange.includes("|")) {
      const [s, e] = slotRange.split("|");
      startTime = s;
      endTime = e;
    }
    const values: Record<string, unknown> = {
      event_date: formData.get("event_date"),
      start_time: startTime,
      end_time: endTime,
    };
    await act(() => veterinarianApi.bookSchedule(id, values), "Đã chốt ca làm việc và tạo thông báo nhắc.");
  }
  async function submitMove(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const slotRange = formData.get("slot_time_range") as string;
    let startTime = (formData.get("start_time") as string) || "";
    let endTime = (formData.get("end_time") as string) || "";
    if (slotRange && slotRange.includes("|")) {
      const [s, e] = slotRange.split("|");
      startTime = s;
      endTime = e;
    }
    const values: Record<string, unknown> = {
      event_date: formData.get("event_date"),
      start_time: startTime,
      end_time: endTime,
    };
    await act(() => veterinarianApi.moveSchedule(id, values), "Đã dời ca làm việc và cập nhật thông báo.");
  }
  async function submitComplete(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const nextSlot = formData.get("next_slot_time_range") as string;
    const values: Record<string, unknown> = {
      done_date: formData.get("done_date"),
    };
    if (nextSlot && nextSlot.includes("|")) {
      const [s, e] = nextSlot.split("|");
      values.next_start_time = s;
      values.next_end_time = e;
    }
    await act(() => veterinarianApi.completeSchedule(id, values), "Đã ghi nhận hoàn thành lịch chăm sóc.");
  }
  async function cancel(id: string) {
    if (!window.confirm("Hủy lịch chăm sóc này? Quy tắc vẫn được giữ để bạn có thể đặt lịch lại.")) return;
    await act(() => veterinarianApi.cancelSchedule(id), "Đã hủy lịch. Quy tắc vẫn còn trong danh sách.");
  }

  return <SectionCard title="Lịch chăm sóc" description="Lịch tuần gồm cả lịch hẹn và việc định kỳ đến hạn. Có thể xem theo ngựa, chốt giờ, dời lịch và xác nhận hoàn thành." icon={CalendarDays} action={<button type="button" className="gold-button h-10 px-3" aria-expanded={createOpen} onClick={() => setCreateOpen((value) => !value)}>{createOpen ? "Đóng biểu mẫu" : "+ Tạo lịch định kỳ"}</button>}>
    <ErrorLine>{error}</ErrorLine>
    {notice && <div className="mb-3"><Notice>{notice}</Notice></div>}
    {createOpen && <form onSubmit={(event) => void createSchedule(event)} className="mb-5 grid gap-3 rounded-xl border border-equine-line bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-3">
      <div className="sm:col-span-2 lg:col-span-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-semibold text-equine-navy">Thêm việc chăm sóc vào lịch</h4>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900">
            Ngựa đang chọn: <span className="font-bold text-amber-950">{selectedHorse.horse_name}</span>
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">Việc sẽ xuất hiện đúng ngày đến hạn. Có thể lưu chu kỳ trước rồi chốt giờ sau.</p>
      </div>
      <input type="hidden" name="horse_id" value={selectedHorse.id} />
      <SelectField label="Loại chăm sóc" name="care_type" required options={[{ value: "HoofCheck", label: "Kiểm tra móng" }, { value: "Deworming", label: "Tẩy giun" }, { value: "Vaccination", label: "Tiêm phòng" }, { value: "MedicalCheckup", label: "Khám định kỳ" }]} />
      <Field label="Chu kỳ lặp (ngày) · bỏ trống nếu làm một lần" name="frequency_days" type="number" min={1} step="1" />
      <Field label="Ngày đến hạn" name="next_due_date" type="date" required defaultValue={today()} />
      <Field label="Lần gần nhất" name="last_done_date" type="date" />
      <div className="sm:col-span-2 lg:col-span-2">
        <TextAreaField label="Ghi chú" name="notes" rows={2} />
      </div>
      <label className="flex min-h-11 items-center gap-2 rounded-xl border border-equine-line bg-white px-3 py-2 text-sm sm:col-span-2 lg:col-span-3"><input type="checkbox" name="book_event" checked={bookNow} onChange={(event) => setBookNow(event.target.checked)} /> Chốt ca ngay và tạo nhắc nhở</label>
      {bookNow ? (
        <label className="block sm:col-span-2 lg:col-span-3">
          <span className="field-label text-xs font-bold text-slate-800">Chọn ca làm việc <span className="text-rose-600">*</span></span>
          <select
            name="slot_time_range"
            defaultValue={`${TIMETABLE_SLOTS[0].startTime}|${TIMETABLE_SLOTS[0].endTime}`}
            required
            className="field-control h-10 px-3 text-xs font-bold text-slate-900 border-slate-300 bg-white"
          >
            {TIMETABLE_SLOTS.map((s) => (
              <option key={s.id} value={`${s.startTime}|${s.endTime}`}>
                Ca {s.id}: {s.timeRange}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="rounded-lg bg-white px-3 py-2 text-xs text-slate-600 sm:col-span-2 lg:col-span-3">Lịch sẽ hiện là “Chưa chốt ca”. Bạn có thể đặt ca trực tiếp trên thời khóa biểu khi cần.</p>
      )}
      <div className="flex gap-2 sm:col-span-2 lg:col-span-3"><button className="gold-button h-10" disabled={busy}>{bookNow ? "Tạo lịch và nhắc nhở" : "Lưu lịch định kỳ"}</button><button type="button" className="soft-button h-10 px-3" onClick={() => setCreateOpen(false)}>Hủy</button></div>
    </form>}

    {/* TOP SELECTOR BAR: "Chọn tuần" & Navigation */}
    <div className="mb-5 rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-900">Chọn tuần</label>
          <div className="relative w-full sm:w-80">
            <select
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
              className="w-full appearance-none rounded-lg border border-slate-300 bg-white py-2.5 pl-3.5 pr-10 text-sm font-bold text-slate-950 shadow-sm transition hover:border-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 cursor-pointer"
            >
              {weekOptions.map((opt) => (
                <option key={opt.key} value={opt.key} className="text-slate-900 font-semibold">
                  {opt.fullLabel}
                </option>
              ))}
            </select>
            <CalendarDays className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-700" size={18} />
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 active:bg-slate-100"
              onClick={() => setWeekStart(addCalendarDays(weekStart, -7))}
            >
              <ArrowLeft size={14} /> Tuần trước
            </button>
            <button
              type="button"
              className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold shadow-sm transition ${
                weekStart === currentWeekStart
                  ? "bg-[#1D4ED8] text-white hover:bg-blue-800 active:bg-blue-900"
                  : "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
              }`}
              onClick={() => setWeekStart(currentWeekStart)}
            >
              <CalendarDays size={14} /> Tuần hiện tại
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 active:bg-slate-100"
              onClick={() => setWeekStart(addCalendarDays(weekStart, 7))}
            >
              Tuần sau <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-2.5">
          <label className="block min-w-36">
            <span className="field-label text-xs font-bold text-slate-800">Lọc theo ngựa</span>
            <select value={horseFilter} onChange={(event) => setHorseFilter(event.target.value)} className="field-control h-9 px-2.5 text-xs font-medium text-slate-900 border-slate-300">
              <option value="all">Tất cả ngựa</option>
              {horses.map((horse) => <option key={horse.id} value={horse.id}>{horse.horse_name}</option>)}
            </select>
          </label>
          <label className="block min-w-36">
            <span className="field-label text-xs font-bold text-slate-800">Phạm vi bác sĩ</span>
            <select value={scope} onChange={(event) => setScope(event.target.value as "mine" | "all")} className="field-control h-9 px-2.5 text-xs font-medium text-slate-900 border-slate-300">
              <option value="mine">Lịch của tôi</option>
              <option value="all">Tất cả bác sĩ</option>
            </select>
          </label>
          <label className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 text-xs font-medium text-slate-800">
            <input type="checkbox" checked={includeContext} onChange={(event) => setIncludeContext(event.target.checked)} className="rounded text-blue-600 accent-blue-600" />
            Hiện lịch tập & đua
          </label>
        </div>
      </div>
    </div>

    {/* Quick stats banner */}
    <div className="mb-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 shadow-xs">
        <p className="text-xs font-semibold text-slate-600">Cần thực hiện</p>
        <p className="mt-0.5 text-xl font-extrabold text-slate-950">{weeklyCareEvents.filter((event) => event.status === "Scheduled").length}</p>
      </div>
      <div className="rounded-lg border border-rose-300 bg-rose-50 px-3.5 py-2.5 shadow-xs">
        <p className="text-xs font-semibold text-rose-800">Quá hạn</p>
        <p className="mt-0.5 text-xl font-extrabold text-rose-900">{weeklyOverdueCount}</p>
      </div>
      <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3.5 py-2.5 shadow-xs">
        <p className="text-xs font-semibold text-emerald-800">Đã hoàn thành</p>
        <p className="mt-0.5 text-xl font-extrabold text-emerald-950">{weeklyCompletedCount}</p>
      </div>
      <div className="rounded-lg border border-blue-300 bg-blue-50 px-3.5 py-2.5 shadow-xs">
        <p className="text-xs font-semibold text-blue-800">Lịch định kỳ đến hạn</p>
        <p className="mt-0.5 text-xl font-extrabold text-blue-950">{weeklyDueRuleCount}</p>
      </div>
    </div>

    {/* Tracked Rules Accordion */}
    <details className="mb-5 rounded-xl border border-slate-300 bg-white shadow-xs">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-bold text-slate-900 transition hover:bg-slate-50">
        Quy tắc định kỳ đang theo dõi ({filteredSchedules.length}) <span className="ml-1 text-xs font-medium text-slate-600">· mở để xem ngày đến hạn</span>
      </summary>
      <div className="divide-y divide-slate-200 border-t border-slate-200 px-4">
        {loading ? <p className="py-3 text-sm font-medium text-slate-600">Đang tải quy tắc...</p> : filteredSchedules.length === 0 ? <p className="py-3 text-sm font-medium text-slate-600">Chưa có lịch định kỳ cho ngựa này.</p> : [...filteredSchedules].sort((left, right) => left.next_due_date.localeCompare(right.next_due_date)).map((schedule) => {
          const horseName = horses.find((horse) => horse.id === schedule.horse_id)?.horse_name ?? schedule.horse_name ?? "Ngựa";
          const isOverdue = isScheduleOverdue(schedule);
          const isCompletedOnce = !schedule.frequency_days && schedule.event_status === "Completed";
          return <div key={schedule.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0"><p className="font-semibold text-slate-900">{horseName} · {careTypeLabels[schedule.care_type] ?? schedule.care_type}</p><p className="mt-0.5 text-xs text-slate-700 font-medium">{schedule.frequency_days ? `Lặp mỗi ${schedule.frequency_days} ngày` : "Một lần"} · Đến hạn {displayDate(schedule.next_due_date)}{schedule.last_done_date ? ` · Gần nhất ${displayDate(schedule.last_done_date)}` : ""}{schedule.doctor_name ? ` · BS: ${schedule.doctor_name}` : ""}</p>{schedule.notes && <p className="mt-0.5 truncate text-xs text-slate-600">{schedule.notes}</p>}</div>
            <div className="flex shrink-0 items-center gap-2"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${isOverdue ? "bg-rose-600 text-white border border-rose-700 shadow-xs" : schedule.event_status === "Scheduled" ? "bg-blue-100 text-blue-900 border border-blue-300" : isCompletedOnce ? "bg-emerald-100 text-emerald-900 border border-emerald-300" : "bg-slate-200 text-slate-800"}`}>{isOverdue ? "Quá hạn" : schedule.event_status === "Scheduled" ? "Đã đặt ca" : isCompletedOnce ? "Đã hoàn thành" : "Chưa chốt ca"}</span><button type="button" className="soft-button h-8 px-2.5 text-xs font-semibold text-slate-800" onClick={() => setWeekStart(schedule.next_due_date < today() ? currentWeekStart : mondayOfWeek(schedule.next_due_date))}>Xem trên lịch</button></div>
          </div>;
        })}
      </div>
    </details>

    {/* MAIN TIMETABLE CARD: "Thời khóa biểu tuần" */}
    <div className="rounded-xl border border-slate-300 bg-white shadow-sm overflow-hidden mb-6">
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
        <div>
          <h3 className="text-lg font-black text-slate-900">Thời khóa biểu tuần</h3>
          <p className="mt-0.5 text-xs font-semibold text-slate-700">
            Tuần ({formatDayMonth(weekStart)} - {formatDayMonth(to)})
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowAllSlots(!showAllSlots)}
            className="text-xs font-bold text-blue-700 hover:text-blue-900 hover:underline"
          >
            {showAllSlots ? "Thu gọn ca trống" : "Hiện đủ 6 ca"}
          </button>
          <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-900">
            {weeklyCareEvents.length} việc trong tuần
          </span>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-slate-600 font-medium">
          <Notice>Đang tải lịch trong tuần...</Notice>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-300">
                <th className="w-20 border-r border-slate-300 bg-slate-100 p-3 text-center text-xs font-black text-slate-900 uppercase tracking-wide">
                  Slot
                </th>
                {weekDays.map((day) => {
                  const isToday = day.date === today();
                  const dayName = vietnameseDayName(day.date);
                  const dateStr = formatDayMonth(day.date);
                  return (
                    <th
                      key={day.date}
                      className={`border-r border-slate-300 p-3 text-center transition-colors ${
                        isToday
                          ? "bg-[#C3E6CB] text-[#0A4125] font-black border-b-2 border-emerald-700"
                          : "bg-slate-100 text-slate-900 font-bold"
                      }`}
                    >
                      <div className="flex flex-col items-center justify-center">
                        <span className="text-xs font-black">{dayName} ({dateStr})</span>
                        {isToday && (
                          <span className="mt-0.5 inline-block rounded bg-emerald-800 px-1.5 py-0.2 text-[9px] font-black text-white uppercase tracking-wider">
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
              {displaySlots.map((slot) => (
                <tr key={slot.id} className="transition-colors hover:bg-slate-50/60">
                  <td className="border-r border-slate-300 bg-slate-100/90 p-3 text-center align-middle font-black text-slate-950">
                    <span className="text-lg font-black text-slate-950">{slot.id}</span>
                    <p className="mt-0.5 text-[11px] font-bold text-slate-700 whitespace-nowrap">{slot.timeRange}</p>
                  </td>
                  {weekDays.map((day) => {
                    const isToday = day.date === today();
                    const cellEvents = day.events.filter((event) => getEventSlot(event) === slot.id);
                    return (
                      <td
                        key={`${slot.id}-${day.date}`}
                        className={`border-r border-slate-300 p-2.5 align-top transition-colors ${
                          isToday ? "bg-[#F3FAF5]" : "bg-white"
                        }`}
                      >
                        {cellEvents.length === 0 ? (
                          <div className="flex h-full min-h-[96px] items-center justify-center text-base font-bold text-slate-500 select-none">
                            -
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {cellEvents.map((event, index) => {
                              const schedule = schedules.find((item) => item.id === event.schedule_id || Boolean(item.calendar_event_id && item.calendar_event_id === (event.event_id ?? event.id)));
                              const scheduleId = event.schedule_id ?? schedule?.id;
                              const isCompleted = event.status === "Completed";
                              const isCancelled = event.status === "Cancelled";
                              const isOverdue = isEventOverdue(event, schedule);
                              const isMyCareEvent = scope === "mine" || isAssignedDoctor(event, schedule, currentUser);
                              const canManage = !event.context && Boolean(scheduleId) && isMyCareEvent;
                              const canComplete = canManage && event.status === "Scheduled" && event.event_date <= today();
                              const canBook = canManage && (Boolean(event.is_periodic_due) || isCancelled || schedule?.event_status === "Cancelled");
                              const hasBookedEvent = !event.is_periodic_due && event.status === "Scheduled";
                              const horse = horses.find((h) => h.id === event.horse?.id || h.id === schedule?.horse_id);
                              const horseName = horse?.horse_name ?? event.horse?.horse_name ?? event.horse_name ?? "Ngựa";
                              const rawName = event.care_type ?? event.event_type ?? event.title ?? "Chăm sóc";
                              const eventName = careTypeLabels[rawName] ?? rawName;
                              const horseLocation = horse?.stable_box ? `Khu ${horse.stable_box.section ?? "A"} · Chuồng ${horse.stable_box.box_code}` : "Khu chuồng trại · Ô khám";
                              const timeStr = formatTimeDisplay(event.start_time, event.end_time);
                              const doctorName = formatDoctorName(event, schedule, currentUser);
                              const currentSlotObj = TIMETABLE_SLOTS.find((s) => s.id === getEventSlot(event)) ?? TIMETABLE_SLOTS[0];
                              const defaultSlotValue = `${currentSlotObj.startTime}|${currentSlotObj.endTime}`;

                              return (
                                <article
                                  key={event.event_id ?? event.id ?? `${day.date}-${index}`}
                                  className={`rounded-lg p-2.5 shadow-xs transition hover:shadow-md ${
                                    event.context
                                      ? "border border-slate-300 bg-slate-50"
                                      : isCompleted
                                      ? "border border-emerald-300 bg-emerald-50/80"
                                      : isOverdue
                                      ? "border-2 border-rose-600 bg-rose-50 shadow-md ring-2 ring-rose-500/20"
                                      : isCancelled
                                      ? "border border-slate-300 bg-slate-50"
                                      : "border border-blue-300 bg-white"
                                  }`}
                                >
                                  {/* Title & Badge */}
                                  <div className="flex items-start justify-between gap-1.5">
                                    <div className={`flex items-start gap-1 font-bold break-words leading-tight text-xs ${isOverdue ? "text-rose-950 font-black" : "text-[#0A389C]"}`}>
                                      {isOverdue ? (
                                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-600 mt-0.5" />
                                      ) : (
                                        <BookOpen className="h-3.5 w-3.5 shrink-0 text-[#0A389C] mt-0.5" />
                                      )}
                                      <span>{eventName} - {horseName}</span>
                                    </div>
                                    {isCompleted && (
                                      <span className="inline-flex shrink-0 items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-black text-emerald-900 bg-emerald-100 border border-emerald-400">
                                        <Check size={10} /> Có mặt
                                      </span>
                                    )}
                                    {isOverdue && (
                                      <span className="inline-flex shrink-0 items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-black text-white bg-rose-600 border border-rose-700 shadow-xs">
                                        <AlertTriangle size={9} /> Quá hạn
                                      </span>
                                    )}
                                    {event.is_periodic_due && !isOverdue && (
                                      <span className="inline-flex shrink-0 items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-black text-amber-950 bg-amber-100 border border-amber-400">
                                        Đến hạn
                                      </span>
                                    )}
                                    {event.context && (
                                      <span className="inline-flex shrink-0 items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold text-slate-800 bg-slate-200 border border-slate-300">
                                        Tham khảo
                                      </span>
                                    )}
                                  </div>

                                  {/* Time */}
                                  <div className={`mt-1.5 flex items-center gap-1.5 text-[11px] font-bold ${isOverdue ? "text-rose-900 font-extrabold" : "text-amber-900"}`}>
                                    <Clock className={`h-3 w-3 shrink-0 ${isOverdue ? "text-rose-600" : "text-amber-700"}`} />
                                    <span>{timeStr}</span>
                                    <span className="text-slate-400">·</span>
                                    <span className={isOverdue ? "text-rose-700 font-bold" : "text-slate-700 font-semibold"}>
                                      {event.context ? "Offline" : isOverdue ? "Đã quá ca" : "Trực tiếp"}
                                    </span>
                                  </div>

                                  {/* Location */}
                                  <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-800">
                                    <MapPin className="h-3 w-3 shrink-0 text-slate-600" />
                                    <span className="truncate">{horseLocation}</span>
                                  </div>

                                  {/* Staff / Doctor */}
                                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-slate-800">
                                    <User className="h-3 w-3 shrink-0 text-slate-600" />
                                    <span className="truncate">{doctorName}</span>
                                  </div>

                                  {/* Action Buttons */}
                                  {canManage ? (
                                    <div className="mt-2 flex flex-wrap gap-1 border-t border-slate-200 pt-1.5">
                                      {canBook && (
                                        <button
                                          type="button"
                                          className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-900 hover:bg-blue-200 border border-blue-300"
                                          onClick={() => { setBookId(bookId === scheduleId ? "" : scheduleId!); setMoveId(""); setCompleteId(""); }}
                                        >
                                          {isCancelled || schedule?.event_status === "Cancelled" ? "Đặt lại" : "Chốt ca"}
                                        </button>
                                      )}
                                      {event.status === "Scheduled" && scheduleId && (
                                        <>
                                          {hasBookedEvent && (
                                            <>
                                              <button
                                                type="button"
                                                className={`rounded px-2 py-0.5 text-[10px] font-bold border transition ${
                                                  isOverdue
                                                    ? "bg-rose-600 text-white hover:bg-rose-700 border-rose-700 shadow-xs"
                                                    : "bg-slate-200 text-slate-900 hover:bg-slate-300 border-slate-300"
                                                }`}
                                                onClick={() => { setMoveId(moveId === scheduleId ? "" : scheduleId); setBookId(""); setCompleteId(""); }}
                                              >
                                                Dời lịch
                                              </button>
                                              <button
                                                type="button"
                                                className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-900 hover:bg-rose-200 border border-rose-300"
                                                disabled={busy}
                                                onClick={() => void cancel(scheduleId)}
                                              >
                                                Hủy
                                              </button>
                                            </>
                                          )}
                                          {canComplete && (
                                            <button
                                              type="button"
                                              className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-950 hover:bg-emerald-200 border border-emerald-300"
                                              onClick={() => { setCompleteId(completeId === scheduleId ? "" : scheduleId); setBookId(""); setMoveId(""); }}
                                            >
                                              Hoàn thành
                                            </button>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  ) : !event.context && Boolean(scheduleId) ? (
                                    <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-1.5 text-[10px] text-slate-500 font-semibold italic">
                                      <span>Lịch của {doctorName}</span>
                                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] not-italic font-bold text-slate-600 border border-slate-200">Chỉ xem</span>
                                    </div>
                                  ) : null}

                                  {/* Forms */}
                                  {scheduleId && bookId === scheduleId && (
                                    <form onSubmit={(submitEvent) => void submitBook(submitEvent, scheduleId)} className="mt-2 grid gap-2 rounded-lg border border-blue-300 bg-blue-50/90 p-2.5 text-left shadow-xs">
                                      <div className="flex items-center justify-between text-xs font-bold text-blue-900">
                                        <span>Chốt ca lịch hẹn</span>
                                        <button type="button" className="text-[10px] text-slate-500 hover:text-slate-800" onClick={() => setBookId("")}>✕</button>
                                      </div>
                                      <Field label="Ngày hẹn" name="event_date" type="date" required defaultValue={event.event_date} />
                                      <label className="block">
                                        <span className="field-label text-xs font-bold text-slate-800">Chọn ca làm việc <span className="text-rose-600">*</span></span>
                                        <select
                                          name="slot_time_range"
                                          defaultValue={defaultSlotValue}
                                          required
                                          className="field-control h-8 px-2 text-xs font-bold text-slate-900 border-slate-300 bg-white"
                                        >
                                          {TIMETABLE_SLOTS.map((s) => (
                                            <option key={s.id} value={`${s.startTime}|${s.endTime}`}>
                                              Ca {s.id}: {s.timeRange}
                                            </option>
                                          ))}
                                        </select>
                                      </label>
                                      <div className="flex gap-1.5 pt-1">
                                        <button className="gold-button h-8 flex-1 text-[11px] font-bold" disabled={busy}>Lưu ca và tạo nhắc</button>
                                        <button type="button" className="soft-button h-8 px-2 text-[11px] font-semibold text-slate-700" onClick={() => setBookId("")}>Hủy</button>
                                      </div>
                                    </form>
                                  )}
                                  {scheduleId && moveId === scheduleId && (
                                    <form onSubmit={(submitEvent) => void submitMove(submitEvent, scheduleId)} className="mt-2 grid gap-2 rounded-lg border border-slate-300 bg-slate-100 p-2.5 text-left shadow-xs">
                                      <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                                        <span>Dời sang ca khác</span>
                                        <button type="button" className="text-[10px] text-slate-500 hover:text-slate-800" onClick={() => setMoveId("")}>✕</button>
                                      </div>
                                      <Field label="Ngày mới" name="event_date" type="date" required defaultValue={event.event_date} />
                                      <label className="block">
                                        <span className="field-label text-xs font-bold text-slate-800">Chọn ca làm việc mới <span className="text-rose-600">*</span></span>
                                        <select
                                          name="slot_time_range"
                                          defaultValue={defaultSlotValue}
                                          required
                                          className="field-control h-8 px-2 text-xs font-bold text-slate-900 border-slate-300 bg-white"
                                        >
                                          {TIMETABLE_SLOTS.map((s) => (
                                            <option key={s.id} value={`${s.startTime}|${s.endTime}`}>
                                              Ca {s.id}: {s.timeRange}
                                            </option>
                                          ))}
                                        </select>
                                      </label>
                                      <div className="flex gap-1.5 pt-1">
                                        <button className="gold-button h-8 flex-1 text-[11px] font-bold" disabled={busy}>Lưu thay đổi</button>
                                        <button type="button" className="soft-button h-8 px-2 text-[11px] font-semibold text-slate-700" onClick={() => setMoveId("")}>Hủy</button>
                                      </div>
                                    </form>
                                  )}
                                  {scheduleId && completeId === scheduleId && (
                                    <form onSubmit={(submitEvent) => void submitComplete(submitEvent, scheduleId)} className="mt-2 grid gap-2 rounded-lg border border-emerald-300 bg-emerald-50/90 p-2.5 text-left shadow-xs">
                                      <div className="flex items-center justify-between text-xs font-bold text-emerald-950">
                                        <span>Xác nhận hoàn thành</span>
                                        <button type="button" className="text-[10px] text-slate-500 hover:text-slate-800" onClick={() => setCompleteId("")}>✕</button>
                                      </div>
                                      <Field label="Ngày thực hiện" name="done_date" type="date" required defaultValue={today()} />
                                      <label className="block">
                                        <span className="field-label text-xs font-bold text-slate-800">Ca lần kế tiếp (tùy chọn)</span>
                                        <select
                                          name="next_slot_time_range"
                                          defaultValue=""
                                          className="field-control h-8 px-2 text-xs font-semibold text-slate-900 border-slate-300 bg-white"
                                        >
                                          <option value="">-- Để trống nếu chưa chốt ca --</option>
                                          {TIMETABLE_SLOTS.map((s) => (
                                            <option key={s.id} value={`${s.startTime}|${s.endTime}`}>
                                              Ca {s.id}: {s.timeRange}
                                            </option>
                                          ))}
                                        </select>
                                      </label>
                                      <div className="flex gap-1.5 pt-1">
                                        <button className="gold-button h-8 flex-1 text-[11px] font-bold" disabled={busy}>Xác nhận hoàn thành</button>
                                        <button type="button" className="soft-button h-8 px-2 text-[11px] font-semibold text-slate-700" onClick={() => setCompleteId("")}>Hủy</button>
                                      </div>
                                    </form>
                                  )}
                                </article>
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
      )}
    </div>
  </SectionCard>;
}

function NotificationsPanel({
  horses,
  activities,
  initialActionItems = [],
  actionsLoading = false,
  actionsError = "",
  onUnread,
  onActionCount,
  onOpenAction,
}: {
  horses: VetHorse[];
  activities: VetActivity[];
  initialActionItems?: VetActionItem[];
  actionsLoading?: boolean;
  actionsError?: string;
  onUnread: (count: number) => void;
  onActionCount: (count: number) => void;
  onOpenAction: (horseId: string, nextTab: NotificationActionTab) => void;
}) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [actions, setActions] = useState<VetActionItem[]>(initialActionItems);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setActions(initialActionItems);
    onActionCount(initialActionItems.length);
  }, [initialActionItems, onActionCount]);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const result = await veterinarianApi.notifications(unreadOnly); setNotifications(result.data); setUnread(result.unread_count); onUnread(result.unread_count); }
    catch (reason) { setError(veterinarianError(reason)); }
    finally { setLoading(false); }
  }, [onUnread, unreadOnly]);
  useEffect(() => { void load(); }, [load]);

  async function markRead(id: string) {
    setBusy(true); setError("");
    try { await veterinarianApi.readNotification(id); await load(); }
    catch (reason) { setError(veterinarianError(reason)); }
    finally { setBusy(false); }
  }
  async function markAll() {
    setBusy(true); setError("");
    try { await veterinarianApi.readAllNotifications(); await load(); }
    catch (reason) { setError(veterinarianError(reason)); }
    finally { setBusy(false); }
  }
  return <SectionCard title="Thông báo" description="Việc cần chăm sóc và cập nhật sức khỏe được tổng hợp từ hồ sơ ngựa; thông báo tự làm mới mỗi phút." icon={Bell} action={<div className="flex gap-2"><button type="button" className="soft-button h-9 px-3 text-xs" onClick={() => setUnreadOnly((value) => !value)}>{unreadOnly ? "Xem tất cả" : "Chưa đọc"}</button><button type="button" className="soft-button h-9 px-3 text-xs" disabled={busy || unread === 0} onClick={() => void markAll()}>Đọc tất cả</button></div>}>
    <ErrorLine>{error}</ErrorLine>
    {activities.length > 0 && <section className="mb-5 rounded-xl border border-sky-200 bg-sky-50/50 p-3 sm:p-4" aria-label="Hoạt động gần đây">
      <div className="mb-3"><h4 className="font-semibold text-equine-navy">Hoạt động gần đây</h4></div>
      <div className="space-y-2">{activities.slice(0, 8).map((activity) => <article key={activity.id} className="flex flex-col gap-3 rounded-lg border border-sky-100 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0"><p className="font-semibold text-equine-navy">{activity.horseName}</p><p className="mt-1 text-sm text-slate-700">{activity.message}</p><p className="mt-1 text-xs text-slate-500">{new Date(activity.createdAt).toLocaleString("vi-VN")}</p></div>
        {activity.horseId && <button type="button" className="soft-button h-9 shrink-0 px-3 text-xs" onClick={() => onOpenAction(activity.horseId!, activity.actionTab)}>Mở hồ sơ</button>}
      </article>)}</div>
    </section>}
    <section className="mb-5 rounded-xl border border-equine-line bg-white p-3 sm:p-4 shadow-sm" aria-label="Việc cần xử lý">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div><h4 className="font-semibold text-equine-navy">Việc cần xử lý</h4></div>
        {!actionsLoading && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{actions.length} việc</span>}
      </div>
      <ErrorLine>{actionsError}</ErrorLine>
      {actionsLoading ? <Notice>Đang kiểm tra hồ sơ sức khỏe và lịch chăm sóc...</Notice> : actions.length === 0 ? <p className="rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-500">Hiện không có chấn thương hoặc lịch chăm sóc nào cần xử lý.</p> : <div className="space-y-2">{actions.map((item) => <article key={item.id} className={`flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between ${item.priority === "urgent" ? "border-rose-200 bg-rose-50/60" : "border-equine-line bg-slate-50"}`}>
        <div className="min-w-0"><p className="font-semibold text-equine-navy">{item.title}</p><p className="mt-1 text-sm text-slate-600">{item.detail}</p></div>
        <button type="button" className="soft-button h-9 shrink-0 px-3 text-xs" onClick={() => onOpenAction(item.horseId, item.actionTab)}>{item.actionLabel}</button>
      </article>)}</div>}
    </section>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-t border-equine-line pt-4"><div><h4 className="font-semibold text-equine-navy">Thông báo đã đến hạn</h4></div></div>
    {loading ? <Notice>Đang tải thông báo...</Notice> : notifications.length === 0 ? <Empty>{unreadOnly ? "Không có thông báo chưa đọc." : "Chưa có thông báo đã đến hạn."}</Empty> : <div className="space-y-2">{notifications.map((item) => {
      const formatted = formatNotificationMessage(item.message, horses);
      return <article key={item.id} className={`flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between ${item.is_read ? "border-equine-line bg-white" : "border-blue-200 bg-blue-50/40"}`}>
        <div><p className="text-sm font-medium text-equine-navy">{formatted.message}</p><p className="mt-1 text-xs text-slate-500">{displayDate(item.scheduled_at ?? item.created_at)}{item.is_read ? " · Đã đọc" : " · Chưa đọc"}</p></div>
        <div className="flex shrink-0 gap-2">{formatted.horseId && <button type="button" className="soft-button h-9 px-3 text-xs" onClick={() => onOpenAction(formatted.horseId!, "overview")}>Mở hồ sơ ngựa</button>}{!item.is_read && <button type="button" className="soft-button h-9 px-3 text-xs" disabled={busy} onClick={() => void markRead(item.id)}>Đánh dấu đã đọc</button>}</div>
      </article>;
    })}</div>}
  </SectionCard>;
}
