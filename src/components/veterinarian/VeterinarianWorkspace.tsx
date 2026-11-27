"use client";

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  Check,
  CircleHelp,
  ListFilter,
  X,
  ClipboardCheck,
  Clock,
  FileHeart,
  HeartPulse,
  LockKeyhole,
  MapPin,
  Pill,
  ShieldAlert,
  Stethoscope,
  UnlockKeyhole,
  User,
  Users,
  Utensils,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { HorseImage, Modal, Notice } from "@/components/horses/HorseUI";
import { PanelListSkeleton, WorkspaceSkeleton } from "@/components/shared/LoadingSkeletons";
import HorseSearchPicker from "@/components/shared/HorseSearchPicker";
import IncidentPhoto from "@/components/groom/IncidentPhoto";
import ExamHorsePicker from "./ExamHorsePicker";
import ExamHistoryViews from "./ExamHistoryViews";
import dynamic from "next/dynamic";
const InjuryModel3D = dynamic(() => import("@/components/veterinarian/InjuryModel3D"), {
  ssr: false,
  loading: () => <p role="status" className="p-5 text-sm text-slate-500">Đang tải mô hình 3D…</p>,
});
import StableWorkspace from "./StableWorkspace";
import { createInjuryWorkflow } from "@/lib/injury-workflow";
import { formatDisplayDate, formatDoctorDisplayName, formatStableSection } from "@/lib/display-format";
import { activeRecurringRules, buildCareProjections, careRulesForDoctor } from "@/lib/care-projections";
import { careCalendarTarget } from "@/lib/care-calendar-navigation";
import { CompactId } from "@/components/shared/CompactId";
import { StatTile } from "@/components/shared/StatTile";
import type { Horse } from "@/api/horses/api";
import { APP_MUTATION_COMPLETED_EVENT, ApiRequestError } from "@/api/client";
import { useDashboardTab } from "@/shared/hooks/use-dashboard-tab";
import { getUser } from "@/lib/session";
import { useWorkspaceToast } from "@/components/horses/HorseShell";
import {
  veterinarianApi,
  veterinarianError,
  type CareEvent,
  type CareSchedule,
  type DietRecord,
  type HealthExam,
  type HealthExamLog,
  type HealthOverview,
  type InjuryMarker,
  type InjuryTimelineEntry,
  type InjuryTimelineStatus,
  type MedicalRecord,
  type Prescription,
  type VetHorse,
  type VetStableIncident,
} from "@/api/veterinarian/api";

type WorkspaceTab = "overview" | "dispatch" | "stables" | "exams" | "medical" | "diet" | "injuries" | "care" | "incidents" | "notifications";
const workspaceTabIds: readonly WorkspaceTab[] = ["overview", "dispatch", "stables", "exams", "medical", "diet", "injuries", "care", "incidents", "notifications"];

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


const careTypeLabels: Record<string, string> = {
  HoofCheck: "Kiểm tra móng",
  Deworming: "Tẩy giun",
  Vaccination: "Tiêm phòng",
  MedicalCheckup: "Khám định kỳ",
  Training: "Huấn luyện",
  TrialRun: "Chạy thử",
  Rest: "Nghỉ dưỡng sức",
  Race: "Giải đua",
};

export default function VeterinarianWorkspace({ isHeadVet }: { isHeadVet?: boolean } = {}) {
  const showToast = useWorkspaceToast();
  const currentUser = useMemo(() => getUser(), []);
  const headVet = isHeadVet ?? (currentUser?.roleName === "HEAD_VETERINARIAN");
  const [overview, setOverview] = useState<HealthOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedHorseId] = useState("");
  const setSelectedId = useCallback((id: string) => {
    setSelectedHorseId(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("horse", id);
    else url.searchParams.delete("horse");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);
  const [tab, selectTab] = useDashboardTab(workspaceTabIds, "overview");
  const [autoOpenExam, setAutoOpenExam] = useState(false);
  const [linkedScheduleId, setLinkedScheduleId] = useState<string | undefined>(undefined);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await veterinarianApi.overview();
      setOverview(result);
      setSelectedHorseId((current) => {
        const linkedId = new URLSearchParams(window.location.search).get("horse");
        const candidate = current || linkedId;
        return result.horses.some((horse) => horse.id === candidate) ? candidate! : result.horses[0]?.id ?? "";
      });
      return result;
    } catch (reason) {
      setError(veterinarianError(reason));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadOverview(); }, [loadOverview]);
  const horses = useMemo(() => overview?.horses ?? [], [overview]);
  const horse = horses.find((item) => item.id === selectedId) ?? null;
  useEffect(() => {
    let timer: number | undefined;
    const refreshAfterMutation = (event: Event) => {
      const path = (event as CustomEvent<{ path?: string }>).detail?.path ?? "";
      if (path.includes("/api/notifications")) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => { void loadOverview(); }, 180);
    };
    window.addEventListener(APP_MUTATION_COMPLETED_EVENT, refreshAfterMutation);
    return () => { window.clearTimeout(timer); window.removeEventListener(APP_MUTATION_COMPLETED_EVENT, refreshAfterMutation); };
  }, [loadOverview]);
  useEffect(() => {
    const selectLinkedHorse = () => {
      const horseId = new URLSearchParams(window.location.search).get("horse");
      if (horseId && horses.some((horse) => horse.id === horseId)) setSelectedId(horseId);
    };
    selectLinkedHorse();
    window.addEventListener("workspace-tab-change", selectLinkedHorse);
    window.addEventListener("popstate", selectLinkedHorse);
    return () => {
      window.removeEventListener("workspace-tab-change", selectLinkedHorse);
      window.removeEventListener("popstate", selectLinkedHorse);
    };
  }, [horses, setSelectedId]);
  function changed(message: string) {
    showToast(message);
  }

  const isSingleHorseTab = !["stables", "dispatch", "care", "incidents", "notifications"].includes(tab);

  return (
    <section className="dashboard-workspace mx-auto w-full" aria-label="Không gian bác sĩ thú y">
      {error && <div className="mt-5"><Notice error>{error}</Notice></div>}

      {isSingleHorseTab && tab !== "exams" && (
        <HorseSearchPicker
          horses={horses}
          selectedId={selectedId}
          onSelect={setSelectedId}
          loading={loading && !overview}
          showFilters={true}
          placeholder="Tìm theo tên, chuồng, mã chip hoặc mã số ngựa..."
          ariaLabel="Tìm ngựa theo tên, chuồng hoặc mã số"
          className="mt-4 max-w-4xl"
        />
      )}

      {tab === "stables" ? (
        <StableWorkspace
          horses={horses} loading={loading} onRefresh={() => { void loadOverview(); }} onOpen={(id) => { setSelectedId(id); selectTab("overview"); }} />
      ) : (
      <div className="mt-4 min-w-0">
          {(tab === "dispatch" || tab === "care") && horse && (
            <CarePanel
              horses={horses}
              selectedHorse={horse}
              onChanged={changed}
              isHeadVet={headVet}
              viewMode={tab === "dispatch" ? "dispatch" : "care"}
              onSwitchView={(nextView) => selectTab(nextView)}
              onSelectHorse={(id) => setSelectedId(id)}
              onGoToExam={(horseId, scheduleId) => {
                if (horseId) setSelectedId(horseId);
                setLinkedScheduleId(scheduleId);
                setAutoOpenExam(true);
                selectTab("exams");
              }}
            />
          )}
          {tab === "incidents" && <StableIncidentsPanel onOpenHorse={(id) => { setSelectedId(id); selectTab("overview"); }} />}
          {isSingleHorseTab && horse && <>
            {tab !== "exams" && <HorseSummary horse={horse} />}
            <div className="mt-4">
              {tab === "overview" && <HorseStatusPanel key={horse.id} horse={horse} onChanged={changed} onOpenInjuries={() => selectTab("injuries")} />}
              {tab === "exams" && (
                <ExamsPanel
                  key={horse.id}
                  onOpenInjuries={() => selectTab("injuries")}
                  horses={horses}
                  onSelectHorse={setSelectedId}
                  horse={horse}
                  onChanged={changed}
                  autoOpenCreate={autoOpenExam}
                  linkedScheduleId={linkedScheduleId}
                  onResetAutoOpen={() => {
                    setAutoOpenExam(false);
                    setLinkedScheduleId(undefined);
                  }}
                />
              )}
              {tab === "medical" && <MedicalPanel horse={horse} onChanged={changed} />}
              {tab === "diet" && <DietPanel horse={horse} onChanged={changed} />}
              {tab === "injuries" && <InjuriesPanel key={horse.id} horse={horse} onChanged={changed} onRefresh={loadOverview} />}
            </div>
          </>}
          {!horse && loading && !["stables", "incidents", "notifications"].includes(tab) && <WorkspaceSkeleton label="Đang tải hồ sơ sức khỏe..." />}
          {!horse && !loading && !["incidents", "notifications"].includes(tab) && <div className="rounded-lg border border-equine-line bg-white p-6 shadow-sm"><Notice>Chưa có ngựa đang hoạt động để quản lý sức khỏe.</Notice></div>}
      </div>
      )}
    </section>
  );
}

function HorseSummary({ horse }: { horse: VetHorse }) {
  return <article data-notification-target={horse.id} className="flex flex-col gap-3 rounded-lg border border-equine-line bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:p-4">
    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md bg-equine-mist"><HorseImage horse={horse as unknown as Horse} priority /></div>
    <div className="min-w-0 flex-1"><p className="eyebrow text-[10px]">Hồ sơ sức khỏe</p><h2 className="mt-0.5 font-sans text-xl font-semibold text-equine-navy">{horse.horse_name}</h2><p className="mt-1 text-sm text-slate-600">{horse.stable_box ? `Chuồng ${horse.stable_box.box_code} · Khu ${horse.stable_box.section}` : "Chưa gán chuồng"} · {statusLabels[horse.current_status] ?? horse.current_status}</p></div>
    {horse.is_training_locked && <div className={`rounded-md border px-3 py-2 text-sm ${horse.lock_level === "Critical" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}><p className="flex items-center gap-2 font-bold"><LockKeyhole size={15} /> Khóa {horse.lock_level}</p><p className="mt-1 max-w-sm text-xs">{horse.lock_reason}</p></div>}
  </article>;
}

function SectionCard({ title, description, icon: Icon, children, action, className = "" }: { title: string; description?: string; icon: typeof Activity; children: ReactNode; action?: ReactNode; className?: string }) {
  return <section className={`rounded-lg border border-equine-line bg-white p-4 shadow-sm sm:p-5 ${className}`}><div className="mb-4 flex flex-col gap-3 border-b border-equine-line pb-4 sm:flex-row sm:items-start sm:justify-between"><div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-equine-mist text-equine-navy"><Icon size={19} /></span><div><div className="flex items-center gap-2"><h3 className="font-sans text-lg font-semibold text-equine-navy">{title}</h3>{description && <details className="relative text-slate-500"><summary className="grid h-8 w-8 cursor-pointer list-none place-items-center rounded-md hover:bg-slate-100" aria-label={`Giải thích ${title}`} title={description}><CircleHelp size={16} /></summary><p className="absolute left-0 z-20 mt-1 w-64 max-w-[70vw] rounded-md border border-equine-line bg-white p-3 text-xs leading-5 text-slate-700 shadow-lg">{description}</p></details>}</div></div></div>{action}</div>{children}</section>;
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
  return formatDisplayDate(value, Boolean(value?.includes("T")));
}

function ErrorLine({ children }: { children: string }) {
  return children ? <div className="mt-3"><Notice error>{children}</Notice></div> : null;
}

function Empty({ children }: { children: string }) {
  return <p className="rounded-xl bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">{children}</p>;
}

function HorseStatusPanel({ horse, onChanged, onOpenInjuries }: { horse: VetHorse; onChanged: (message: string) => void; onOpenInjuries: () => void }) {
  const [error, setError] = useState("");
  const [needsInjuryReview, setNeedsInjuryReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [suggestLock, setSuggestLock] = useState(false);
  const [sessions, setSessions] = useState<{ training_schedule_id?: string; event_date?: string; start_time?: string; session_type?: string }[]>([]);
  async function updateStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setSuggestLock(false); setNeedsInjuryReview(false);
    const values = formValues(event.currentTarget);
    try {
      const status = String(values.current_status);
      const readiness = String(values.readiness_status);
      if (["Injured", "Quarantine"].includes(status) && readiness === "Ready") {
        setError("Ngựa chấn thương hoặc cách ly chưa thể sẵn sàng thi đấu. Hãy chọn Chưa sẵn sàng hoặc Chưa đánh giá.");
        return;
      }
      const result = await veterinarianApi.updateHealthStatus(horse.id, status, readiness, String(values.note ?? ""));
      setSuggestLock(["Injured", "Quarantine"].includes(status));
      setSessions(result.upcoming_sessions ?? []);
      const lockNotice = result.is_training_locked && ["Injured", "Quarantine"].includes(status) ? " Huấn luyện đang bị khóa." : "";
      const relocationNotice = result.stable_relocation?.message ? ` ${result.stable_relocation.message}` : "";
      onChanged(`Đã cập nhật sức khỏe: ${statusLabels[status] ?? status}; ${readinessLabels[readiness] ?? readiness}.${lockNotice}${relocationNotice}`);
    }
    catch (reason) {
      setError(veterinarianError(reason));
      setNeedsInjuryReview(reason instanceof ApiRequestError && reason.code === "ACTIVE_INJURY_MARKER");
    }
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
    {error && <div role="alert"><ErrorLine>{error}</ErrorLine>{needsInjuryReview && <button type="button" className="soft-button mt-2" onClick={onOpenInjuries}>Mở mục Chấn thương để cập nhật hồi phục</button>}</div>}
    <SectionCard title="Trạng thái sức khỏe" description="Cập nhật trạng thái sau khi khám. Trạng thái sức khỏe và khóa huấn luyện được quản lý riêng." icon={HeartPulse}>
      <form onSubmit={updateStatus} className="grid gap-3 sm:grid-cols-2 sm:items-end"><SelectField label="Trạng thái mới" name="current_status" defaultValue={horse.current_status} required options={[{ value: "Healthy", label: "Khỏe mạnh" }, { value: "Monitoring", label: "Cần theo dõi" }, { value: "Injured", label: "Chấn thương" }, { value: "Quarantine", label: "Cách ly" }]} /><SelectField label="Sẵn sàng thi đấu" name="readiness_status" defaultValue={horse.readiness_status ?? "Unknown"} required options={[{ value: "Ready", label: "Sẵn sàng" }, { value: "NotReady", label: "Chưa sẵn sàng" }, { value: "Unknown", label: "Chưa đánh giá" }]} /><Field label="Ghi chú kiểm tra (không bắt buộc)" name="note" maxLength={500} placeholder="Lý do thay đổi..." /><button className="gold-button h-12" disabled={busy}><Check size={15} /> Lưu trạng thái</button></form>
      {suggestLock && <p className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900"><AlertTriangle size={16} /> Trạng thái này tự động khóa lịch huấn luyện sắp tới. Hãy xử lý các lịch bị chặn trước khi mở khóa.</p>}
    </SectionCard>
    <SectionCard title="Khóa huấn luyện" description="Khóa sẽ chặn việc tạo lịch huấn luyện và thông báo cho các Huấn luyện viên trưởng đang hoạt động." icon={LockKeyhole}>
      {horse.is_training_locked ? <div className="space-y-4"><div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"><strong>Đang khóa · {horse.lock_level}</strong><p className="mt-1">{horse.lock_reason}</p></div><form onSubmit={unlock} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"><Field label="Lý do mở khóa" name="reason" required maxLength={500} placeholder="Ví dụ: đã hồi phục, kết quả kiểm tra bình thường" /><button className="soft-button h-12 border-emerald-200 bg-emerald-50 px-4 text-emerald-800" disabled={busy}><UnlockKeyhole size={15} /> Mở khóa</button></form></div> : <form onSubmit={lock} className="grid gap-3 md:grid-cols-[180px_1fr_auto] md:items-end"><SelectField label="Mức cảnh báo" name="lock_level" required options={[{ value: "Warning", label: "Warning · Cam" }, { value: "Critical", label: "Critical · Đỏ" }]} /><Field label="Lý do khóa" name="lock_reason" required maxLength={255} placeholder="Mô tả ngắn tình trạng cần ngừng tập" /><button className="soft-button h-12 border-rose-200 bg-rose-50 px-4 text-rose-800" disabled={busy}><ShieldAlert size={15} /> Khóa huấn luyện</button></form>}
      {sessions.length > 0 && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="font-semibold text-amber-900">Lịch tập sắp tới cần được xử lý</p><ul className="mt-2 space-y-1 text-sm text-amber-900">{sessions.map((item) => <li key={item.training_schedule_id}>{displayDate(item.event_date)} {item.start_time ?? ""} · {item.session_type ?? "Training"}</li>)}</ul></div>}
    </SectionCard>
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

function ExamForm({
  initial,
  editing,
  onSubmit,
  onCancel,
  busy,
  pendingSchedule,
  autoCompleteCare,
  onToggleAutoCompleteCare,
}: {
  initial?: HealthExam | null;
  editing: boolean;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  onCancel?: () => void;
  busy: boolean;
  pendingSchedule?: CareSchedule | null;
  autoCompleteCare?: boolean;
  onToggleAutoCompleteCare?: (val: boolean) => void;
}) {
  return (
    <form
      key={`${initial?.id ?? "new"}-${editing ? "edit" : "create"}`}
      onSubmit={async (event) => {
        event.preventDefault();
        await onSubmit(readExamForm(event.currentTarget, editing));
      }}
      className="space-y-4"
    >
      {!editing && pendingSchedule && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/80 p-3.5 text-xs text-indigo-950 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-1.5 font-bold">
            <span className="flex items-center gap-1.5 text-indigo-900">
              <CalendarCheck size={16} className="text-indigo-600" />
              Lịch &quot;Khám định kỳ&quot; cần thực hiện
            </span>
            <span className="rounded bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-900 border border-indigo-300">
              Hạn: {pendingSchedule.next_due_date}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-indigo-700">
            Hệ thống nhận diện lịch khám định kỳ đang chờ của ngựa này trên thời khóa biểu.
          </p>
          <label className="mt-2.5 flex items-center gap-2 font-bold text-indigo-950 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoCompleteCare ?? true}
              onChange={(e) => onToggleAutoCompleteCare?.(e.target.checked)}
              className="h-4 w-4 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span>Tự động đánh dấu hoàn thành ca khám định kỳ này trên Lịch chăm sóc sau khi lưu</span>
          </label>
        </div>
      )}
      <Field label="Thời điểm khám" name="exam_date" type="datetime-local" defaultValue={localDateTime(initial?.exam_date)} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {examFields.map((field) => (
          <Field key={field.name} {...field} defaultValue={initial?.[field.name as keyof HealthExam] as string | number | null | undefined} />
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {examLongFields.map((field) => (
          <TextAreaField key={field.name} {...field} rows={2} defaultValue={initial?.[field.name as keyof HealthExam] as string | null | undefined} />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="gold-button" disabled={busy}>
          <Check size={15} />
          {editing ? "Lưu chỉnh sửa" : "Lưu hồ sơ khám"}
        </button>
        {onCancel && (
          <button type="button" className="soft-button h-11 px-4" disabled={busy} onClick={onCancel}>
            Hủy
          </button>
        )}
      </div>
    </form>
  );
}

function ExamsPanel({
  onOpenInjuries,
  horses,
  onSelectHorse,
  horse,
  onChanged,
  autoOpenCreate,
  linkedScheduleId,
  onResetAutoOpen,
}: {
  onOpenInjuries: () => void;
  horses: VetHorse[];
  onSelectHorse: (id: string) => void;
  horse: VetHorse;
  onChanged: (message: string) => void;
  autoOpenCreate?: boolean;
  linkedScheduleId?: string;
  onResetAutoOpen?: () => void;
}) {
  const [response, setResponse] = useState<{ data: HealthExam[]; total: number }>({ data: [], total: 0 });
  const [diagnoses, setDiagnoses] = useState<MedicalRecord[]>([]);
  const [diagnosesLoading, setDiagnosesLoading] = useState(true);
  const [diagnosesError, setDiagnosesError] = useState("");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<HealthExam | null>(null);
  const [logs, setLogs] = useState<HealthExamLog[]>([]);
  const [creating, setCreating] = useState(Boolean(autoOpenCreate));
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const showExamToast = useWorkspaceToast();
  const formatAlerts = (alerts: HealthExam["alerts"]) => (alerts ?? []).map((alert) => {
    const label = examFields.find((field) => field.name === alert.field)?.label ?? alert.field;
    return `${label}: ${alert.value} · ngưỡng tham khảo ${alert.normal_range}`;
  }).join("\n");
  const [pendingSchedule, setPendingSchedule] = useState<CareSchedule | null>(null);
  const [autoCompleteCare, setAutoCompleteCare] = useState(true);
  const [diagnosisExamId, setDiagnosisExamId] = useState("");
  const [diagnosisBusy, setDiagnosisBusy] = useState(false);
  const [examInjuries, setExamInjuries] = useState<InjuryMarker[]>([]);
  const [injuryHistoryError, setInjuryHistoryError] = useState("");
  useEffect(() => {
    let active = true;
    const loadInjuries = async () => {
      try {
        const result = await veterinarianApi.injuries(horse.id);
        if (active) { setExamInjuries(result.data); setInjuryHistoryError(""); }
      } catch (reason) {
        if (active) setInjuryHistoryError(veterinarianError(reason));
      }
    };
    void loadInjuries();
    window.addEventListener(APP_MUTATION_COMPLETED_EVENT, loadInjuries);
    return () => { active = false; window.removeEventListener(APP_MUTATION_COMPLETED_EVENT, loadInjuries); };
  }, [horse.id]);
  const examEditorRef = useRef<HTMLDivElement>(null);
  const openExamId = detail?.id;
  useEffect(() => {
    if (openExamId || creating) {
      examEditorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      examEditorRef.current?.focus({ preventScroll: true });
    }
  }, [openExamId, creating]);

  const diagnosesByExam = useMemo(() => {
    const grouped = new Map<string, MedicalRecord[]>();
    for (const record of diagnoses) {
      if (!record.health_exam_id) continue;
      grouped.set(record.health_exam_id, [...(grouped.get(record.health_exam_id) ?? []), record]);
    }
    return grouped;
  }, [diagnoses]);
  const standaloneDiagnoses = useMemo(() => diagnoses.filter((record) => !record.health_exam_id), [diagnoses]);

  useEffect(() => {
    if (autoOpenCreate) {
      setCreating(true);
      setDetail(null);
      setEditing(false);
      setError("");
      onResetAutoOpen?.();
    }
  }, [autoOpenCreate, onResetAutoOpen]);

  useEffect(() => {
    let active = true;
    veterinarianApi
      .schedules()
      .then((res) => {
        if (!active) return;
        const list = res.data ?? [];
        if (linkedScheduleId) {
          const target = list.find((s) => s.id === linkedScheduleId);
          if (target) {
            setPendingSchedule(target);
            return;
          }
        }
        const checkup = list.find(
          (s) =>
            s.horse_id === horse.id &&
            s.care_type === "MedicalCheckup" &&
            s.event_status !== "Completed" &&
            s.next_due_date <= today(),
        );
        setPendingSchedule(checkup ?? null);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [horse.id, linkedScheduleId]);

  const load = useCallback(async (nextPage = 1, append = false) => {
    setLoading(true); setError("");
    try {
      const result = await veterinarianApi.exams(horse.id, nextPage);
      setResponse((current) => ({ data: append ? [...current.data, ...result.data] : result.data, total: result.total }));
      setPage(nextPage);
    } catch (reason) { setError(veterinarianError(reason)); }
    finally { setLoading(false); }
  }, [horse.id]);
  const loadDiagnoses = useCallback(async () => {
    setDiagnosesLoading(true);
    setDiagnosesError("");
    try {
      const result = await veterinarianApi.records(horse.id);
      setDiagnoses(result.data);
    } catch (reason) {
      setDiagnoses([]);
      setDiagnosesError(veterinarianError(reason));
    } finally {
      setDiagnosesLoading(false);
    }
  }, [horse.id]);
  useEffect(() => {
    setDetail(null);
    setLogs([]);
    setResponse({ data: [], total: 0 });
    setDiagnoses([]);
    setDiagnosisExamId("");
    if (!autoOpenCreate) setCreating(false);
    void load();
    void loadDiagnoses();
  }, [autoOpenCreate, load, loadDiagnoses]);

  async function openExam(id: string, notifyAlerts = true) {
    setError(""); setLoading(true); setDetail(null); setLogs([]);
    const [examResult, historyResult] = await Promise.allSettled([veterinarianApi.exam(id), veterinarianApi.examLogs(id)]);
    const failures: string[] = [];
    if (examResult.status === "fulfilled") {
      setDetail(examResult.value); setEditing(false); setCreating(false);
      const warning = formatAlerts(examResult.value.alerts);
      if (notifyAlerts && warning) showExamToast(`Cảnh báo chỉ số · ${horse.horse_name}\n${warning}`, { variant: "warning", durationMs: 12000 });
    } else failures.push(`Chi tiết lần khám: ${veterinarianError(examResult.reason)}`);
    if (historyResult.status === "fulfilled") setLogs(historyResult.value.data);
    else failures.push(`Lịch sử chỉnh sửa: ${veterinarianError(historyResult.reason)}`);
    setError(failures.join(" · "));
    setLoading(false);
  }
  async function save(data: Record<string, unknown>) {
    setBusy(true); setError("");
    try {
      const result = editing && detail ? await veterinarianApi.updateExam(detail.id, data) : await veterinarianApi.createExam(horse.id, data as never);
      const exam = result && "exam" in result ? result.exam : result as HealthExam;
      const changed = result && "changed" in result ? result.changed : true;
      if (exam && "id" in exam) setDetail(exam);
      const warning = formatAlerts(result.alerts ?? exam?.alerts);
      setCreating(false); setEditing(false); await load();
      if (exam && "id" in exam) await openExam(exam.id, false);

      let msg = editing ? (changed ? "Đã cập nhật hồ sơ khám và lưu lịch sử chỉnh sửa." : "Hồ sơ không thay đổi.") : "Đã tạo hồ sơ khám.";

      if (!editing && autoCompleteCare && pendingSchedule) {
        try {
          await veterinarianApi.completeSchedule(pendingSchedule.id, {
            done_date: today(),
          });
          msg = "Đã tạo hồ sơ khám và tự động xác nhận hoàn thành ca khám định kỳ trên lịch chăm sóc.";
          setPendingSchedule(null);
        } catch (scheduleErr) {
          console.warn("Could not auto-complete schedule:", scheduleErr);
        }
      }

      if (warning) showExamToast(`${msg}\nCảnh báo chỉ số · ${horse.horse_name}\n${warning}`, { variant: "warning", durationMs: 12000 });
      else onChanged(msg);
    } catch (reason) { setError(veterinarianError(reason)); }
    finally { setBusy(false); }
  }

  async function saveDiagnosis(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail) return;
    setDiagnosisBusy(true);
    setDiagnosesError("");
    try {
      const values = formValues(event.currentTarget, [], ["treatment_plan"]);
      await veterinarianApi.createRecord(horse.id, {
        ...values,
        health_exam_id: detail.id,
      } as { health_exam_id: string; diagnosis: string; treatment_plan?: string });
      setDiagnosisExamId("");
      await loadDiagnoses();
      onChanged("Đã lưu chẩn đoán vào lịch sử khám của ngựa.");
    } catch (reason) {
      setDiagnosesError(veterinarianError(reason));
    } finally {
      setDiagnosisBusy(false);
    }
  }

  return <SectionCard title="Khám bệnh" icon={Stethoscope} action={<button type="button" className="gold-button h-10 px-3" disabled={busy} onClick={() => { setCreating(true); setDetail(null); setEditing(false); setError(""); }}><Stethoscope size={15} /> Khám mới</button>}>
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 p-3">
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-equine-mist sm:h-20 sm:w-20"><HorseImage horse={horse as unknown as Horse} /></div>
      <ExamHorsePicker horses={horses} selected={horse} disabled={busy || diagnosisBusy} onSelect={onSelectHorse} />
      <div className="text-xs text-slate-500"><p>{horse.stable_box ? `Chuồng ${horse.stable_box.box_code} · Khu ${horse.stable_box.section}` : "Chưa gán chuồng"}</p><p className="mt-1">{statusLabels[horse.current_status] ?? horse.current_status} · {response.total} lần khám</p>{horse.is_training_locked && <p className="mt-1 text-amber-800">Khóa tập luyện: {horse.lock_reason || horse.lock_level}</p>}</div>
    </div>
    <ErrorLine>{error}</ErrorLine>
    {creating && (
      <div ref={examEditorRef} tabIndex={-1} className="mb-5 rounded-xl border border-equine-line bg-slate-50 p-4">
        <h4 className="mb-4 font-semibold text-equine-navy">Lần khám mới</h4>
        <ExamForm
          editing={false}
          busy={busy}
          onSubmit={save}
          onCancel={() => setCreating(false)}
          pendingSchedule={pendingSchedule}
          autoCompleteCare={autoCompleteCare}
          onToggleAutoCompleteCare={setAutoCompleteCare}
        />
      </div>
    )}
    {detail && <div ref={examEditorRef} tabIndex={-1} className="mb-5 rounded-xl border border-equine-line bg-slate-50 p-4">
      <div className="mb-3 flex justify-end"><button type="button" className="text-sm font-medium text-slate-600 hover:text-equine-navy" onClick={() => { setDetail(null); setEditing(false); setDiagnosisExamId(""); }}>Đóng chi tiết</button></div>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h4 className="font-semibold text-equine-navy">Chi tiết lần khám</h4><CompactId id={detail.id} /></div><p className="text-sm text-slate-500">{displayDate(detail.exam_date)} · {formatDoctorDisplayName(detail.doctor?.name) || "Bác sĩ"}</p>{detail.last_edited_at && <p className="mt-1 text-xs text-slate-500">Sửa gần nhất: {displayDate(detail.last_edited_at)} · {formatDoctorDisplayName(detail.last_edited_by?.name) || "Bác sĩ"}</p>}</div><button type="button" className="soft-button h-9 px-3" onClick={() => setEditing((value) => !value)}> {editing ? "Đóng chỉnh sửa" : "Chỉnh sửa"}</button></div>
      {editing ? <div className="mt-4"><ExamForm initial={detail} editing busy={busy} onSubmit={save} onCancel={() => setEditing(false)} /></div> : <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{[...examFields, ...examLongFields].map((field) => { const value = detail[field.name as keyof HealthExam]; return value === undefined || value === null || value === "" ? null : <p key={field.name} className="rounded-lg bg-white px-3 py-2 text-sm"><span className="block text-xs text-slate-500">{field.label}</span><span className="whitespace-pre-wrap font-medium text-slate-800">{String(value)}</span></p>; })}</div>}
      <div className="mt-4 border-t border-equine-line pt-3"><p className="mb-2 flex items-center gap-2 text-sm font-semibold text-equine-navy"><ClipboardCheck size={15} /> Lịch sử sửa ({logs.length})</p>{logs.length === 0 ? <p className="text-xs text-slate-500">Hồ sơ chưa có lần chỉnh sửa.</p> : <div className="space-y-2">{logs.map((log) => <div key={log.id} className="rounded-lg bg-white p-3 text-xs"><p className="font-semibold">{log.edited_by?.name ?? "Bác sĩ"} · {displayDate(log.edited_at)}</p><ul className="mt-1 space-y-1">{log.changes.map((change) => <li key={change.field}>{change.field}: {String(change.old_value ?? "—")} → {String(change.new_value ?? "—")}</li>)}</ul></div>)}</div>}</div>
      <section className="mt-4 border-t border-equine-line pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold text-equine-navy"><FileHeart size={15} /> Chẩn đoán chấn thương trong lần khám</p>
          {diagnosisExamId !== detail.id && <button type="button" className="soft-button h-9 px-3 text-xs" onClick={() => setDiagnosisExamId(detail.id)}>+ Thêm chẩn đoán</button>}
        </div>
        {diagnosesLoading ? <p className="mt-2 text-xs text-slate-500">Đang tải chẩn đoán...</p> : (diagnosesByExam.get(detail.id) ?? []).length === 0 ? <p className="mt-2 text-xs text-slate-500">Chưa có chẩn đoán gắn với lần khám này.</p> : <div className="mt-2 space-y-2">{(diagnosesByExam.get(detail.id) ?? []).map((record) => <article key={record.id} className="rounded-lg border border-rose-100 bg-white p-3"><p className="whitespace-pre-wrap text-sm font-semibold text-slate-900">{record.diagnosis}</p><p className="mt-1 text-xs text-slate-500">Ngày ghi nhận: {displayDate(record.created_at)}</p>{record.treatment_plan && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{record.treatment_plan}</p>}</article>)}</div>}
        {diagnosisExamId === detail.id && <form onSubmit={(event) => void saveDiagnosis(event)} className="mt-3 space-y-3 rounded-xl bg-white p-3">
          <TextAreaField label="Chẩn đoán chấn thương" name="diagnosis" required rows={2} />
          <TextAreaField label="Phác đồ điều trị" name="treatment_plan" rows={3} />
          <div className="flex gap-2"><button className="gold-button h-10" disabled={diagnosisBusy}>Lưu vào lịch sử khám</button><button type="button" className="soft-button h-10 px-3" disabled={diagnosisBusy} onClick={() => setDiagnosisExamId("")}>Hủy</button></div>
        </form>}
      </section>
    </div>}
    {diagnosesError && <div className="mb-3"><Notice error>Không tải được lịch sử chẩn đoán: {diagnosesError}</Notice></div>}
    {standaloneDiagnoses.length > 0 && <section className="mb-4 rounded-xl border border-amber-200 bg-amber-50/50 p-3"><h4 className="font-semibold text-equine-navy">Chẩn đoán trong lịch sử ngựa chưa gắn với lần khám</h4><div className="mt-2 space-y-2">{standaloneDiagnoses.map((record) => <article key={record.id} className="rounded-lg border border-amber-100 bg-white p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="whitespace-pre-wrap text-sm font-semibold text-slate-900">{record.diagnosis}</p><span className="text-xs text-slate-500">{displayDate(record.created_at)}</span></div>{record.treatment_plan && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{record.treatment_plan}</p>}</article>)}</div></section>}
    {injuryHistoryError && <Notice error>{injuryHistoryError}</Notice>}
    {loading && response.data.length === 0 ? <PanelListSkeleton rows={3} label="Đang tải lịch sử khám..." /> : !error && <ExamHistoryViews key={horse.id} injuries={examInjuries} onOpenInjuries={onOpenInjuries} exams={response.data} diagnosesByExam={diagnosesByExam} onOpen={(id) => void openExam(id)} />}
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
      {creating && <form onSubmit={createRecord} className="mb-4 space-y-3 rounded-xl border border-equine-line bg-slate-50 p-4"><h4 className="font-semibold text-equine-navy">Tạo chẩn đoán</h4><label className="block"><span className="field-label">Lần khám liên quan</span><select name="health_exam_id" defaultValue={exams[0]?.id ?? ""} className="field-control px-3"><option value="">Chỉ lưu trong lịch sử chẩn đoán</option>{exams.map((exam) => <option key={exam.id} value={exam.id}>{displayDate(exam.exam_date)} · {exam.temperature_c ?? "—"} °C</option>)}</select></label>{exams.length > 0 && <p className="text-xs text-slate-500">Chọn lần khám để chẩn đoán xuất hiện trong tab Khám bệnh của ngựa.</p>}<TextAreaField label="Chẩn đoán" name="diagnosis" required /><TextAreaField label="Phác đồ điều trị" name="treatment_plan" rows={3} /><div className="flex gap-2"><button className="gold-button" disabled={busy}>Lưu chẩn đoán</button><button type="button" className="soft-button h-11 px-4" onClick={() => setCreating(false)}>Hủy</button></div></form>}
      {loading ? <PanelListSkeleton rows={3} label="Đang tải hồ sơ điều trị..." /> : error.includes("Chẩn đoán:") ? null : records.length === 0 ? <Empty>Chưa có chẩn đoán cho ngựa này.</Empty> : <div className="space-y-2">{records.map((record) => {
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
    {loading ? <PanelListSkeleton rows={3} label="Đang tải khẩu phần..." /> : error ? null : records.length === 0 ? <Empty>Không có khẩu phần trong khoảng thời gian này.</Empty> : <div className="space-y-2">{records.map((item) => <article key={item.id} className="flex flex-col gap-3 rounded-xl border border-equine-line p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-equine-navy">{item.feed_type} · {item.quantity_kg} kg</p><p className="mt-1 text-sm text-slate-600">{item.feeding_frequency || "Chưa ghi tần suất"} · {item.effective_date ?? "—"} → {item.end_date ?? "Đang áp dụng"}</p>{item.special_instructions && <p className="mt-1 whitespace-pre-wrap text-xs text-slate-500">{item.special_instructions}</p>}</div><div className="flex gap-2"><button type="button" className="soft-button h-9 px-3 text-xs" onClick={() => { setEditing(item); setCreating(false); }}>Sửa</button>{!item.end_date && <button type="button" className="soft-button h-9 border-amber-200 bg-amber-50 px-3 text-xs text-amber-900" disabled={busy} onClick={() => void endToday(item)}>Kết thúc hôm nay</button>}</div></article>)}</div>}
  </SectionCard>;
}

type InjuryGroup = NonNullable<InjuryMarker["injury_group"]>;
type InjuryCase = {
  id: string;
  markerIds: string[];
  bodyPart: string;
  group: InjuryGroup;
  severity: InjuryMarker["severity"];
  timeline: InjuryTimelineEntry[];
  coordinates: { x: InjuryMarker["coordinate_x"]; y: InjuryMarker["coordinate_y"]; z: InjuryMarker["coordinate_z"] };
};
type InjuryTab = "all" | "active" | "recovering" | "recovered";
type InjuryToast = { caseId: string; bodyPart: string; from: InjuryTimelineStatus; to: InjuryTimelineStatus };

const injuryGroupLabels: Record<InjuryGroup, string> = {
  Muscle: "Cơ",
  Bone: "Xương",
  Joint: "Khớp",
  SoftTissue: "Mô mềm",
};
const injuryLifecycle: InjuryTimelineStatus[] = ["New", "Treatment", "Recovering", "Recovered"];
const injuryLifecycleLabels: Record<InjuryTimelineStatus, string> = {
  New: "Mới chấn thương",
  Treatment: "Đang điều trị",
  Recovering: "Đang hồi phục",
  Recovered: "Đã hồi phục",
};
const injuryStatusClasses: Record<InjuryTimelineStatus, string> = {
  New: "border-rose-200 bg-rose-50 text-rose-900",
  Treatment: "border-red-200 bg-red-50 text-red-900",
  Recovering: "border-orange-200 bg-orange-50 text-orange-900",
  Recovered: "border-emerald-200 bg-emerald-50 text-emerald-900",
};
const injurySeverityLabels: Record<InjuryMarker["severity"], string> = {
  Mild: "Nhẹ",
  Moderate: "Vừa",
  Severe: "Nặng",
};

function normalizeDay(value: string) {
  return value.slice(0, 10);
}

function displayInjuryDate(value: string) {
  return displayDate(normalizeDay(value));
}

function dayCount(start: string, end: string) {
  const startTime = Date.parse(`${normalizeDay(start)}T00:00:00Z`);
  const endTime = Date.parse(`${normalizeDay(end)}T00:00:00Z`);
  return Number.isNaN(startTime) || Number.isNaN(endTime) ? 0 : Math.max(0, Math.floor((endTime - startTime) / 86_400_000));
}

const injuryDescriptionMetadata = /^\[\[injury-status:(New|Treatment|Recovering|Recovered);group:(Muscle|Bone|Joint|SoftTissue)\]\]\s*/;

function encodeInjuryNote(status: InjuryTimelineStatus, group: InjuryGroup, note: string | null) {
  return `[[injury-status:${status};group:${group}]]${note ? ` ${note}` : ""}`;
}

function injuryMetadata(marker: InjuryMarker) {
  const match = marker.description?.match(injuryDescriptionMetadata);
  return match ? { status: match[1] as InjuryTimelineStatus, group: match[2] as InjuryGroup } : null;
}

function visibleInjuryNote(value: string | null) {
  return value?.replace(injuryDescriptionMetadata, "").trim() || null;
}

function injuryCoordinatePayload(coordinates: InjuryCase["coordinates"]): Record<string, number> {
  if (coordinates.x == null || coordinates.y == null) return {};
  return {
    coordinate_x: Number(coordinates.x),
    coordinate_y: Number(coordinates.y),
    ...(coordinates.z == null ? {} : { coordinate_z: Number(coordinates.z) }),
  };
}

function statusFromLegacyMarker(marker: InjuryMarker, index: number): InjuryTimelineStatus {
  const metadata = injuryMetadata(marker);
  if (metadata && recoveryStatusFor(metadata.status) === marker.recovery_status) return metadata.status;
  if (marker.recovery_status === "Recovering") return "Recovering";
  if (marker.recovery_status === "Recovered") return "Recovered";
  return index === 0 ? "New" : "Treatment";
}

function recoveryStatusFor(status: InjuryTimelineStatus): InjuryMarker["recovery_status"] {
  if (status === "Recovering") return "Recovering";
  if (status === "Recovered") return "Recovered";
  return "Active";
}

function inferInjuryGroup(bodyPart: string): InjuryGroup {
  const part = bodyPart.toLocaleLowerCase("vi");
  if (/xương|bone|fractur|cốt/.test(part)) return "Bone";
  if (/khớp|joint|ligament|dây chằng/.test(part)) return "Joint";
  if (/cơ|muscle/.test(part)) return "Muscle";
  if (/gân|tendon|da|skin|mô|tissue|soft/.test(part)) return "SoftTissue";
  return "SoftTissue";
}

function buildInjuryCases(markers: InjuryMarker[], latestMarkers: InjuryMarker[]): InjuryCase[] {
  // Only the backend snapshot determines the current marker. History is sorted for display.
  return latestMarkers.map((latest) => {
    const key = latest.body_part.trim().toLocaleLowerCase("vi");
    const history = markers.filter((marker) => marker.id !== latest.id && marker.body_part.trim().toLocaleLowerCase("vi") === key)
      .sort((a, b) => Date.parse(a.marked_at) - Date.parse(b.marked_at));
    const entries = [...history, latest];
    return {
      id: latest.id,
      markerIds: entries.map((marker) => marker.id),
      bodyPart: latest.body_part,
      group: latest.injury_group ?? injuryMetadata(latest)?.group ?? inferInjuryGroup(key),
      severity: latest.severity,
      timeline: entries.map((marker, index) => ({ id: marker.id, date: marker.marked_at,
        status: statusFromLegacyMarker(marker, index), note: visibleInjuryNote(marker.description), updated_by: marker.marked_by })),
      coordinates: { x: latest.coordinate_x, y: latest.coordinate_y, z: latest.coordinate_z },
    };
  });
}

function currentInjuryStatus(injury: InjuryCase): InjuryTimelineStatus {
  return injury.timeline.at(-1)?.status ?? "New";
}

function nextInjuryStatus(status: InjuryTimelineStatus): InjuryTimelineStatus {
  return injuryLifecycle[Math.min(injuryLifecycle.indexOf(status) + 1, injuryLifecycle.length - 1)] ?? "Recovered";
}

function injuryTabForStatus(status: InjuryTimelineStatus): InjuryTab {
  if (status === "New" || status === "Treatment") return "active";
  return status === "Recovering" ? "recovering" : "recovered";
}

const injuryTabLabels: Record<InjuryTab, string> = {
  all: "Tất cả",
  active: "Đang chấn thương",
  recovering: "Đang hồi phục",
  recovered: "Đã hồi phục",
};

function severityBars(severity: InjuryMarker["severity"]) {
  const count = severity === "Severe" ? 3 : severity === "Moderate" ? 2 : 1;
  return <span className="inline-flex items-center gap-1" aria-hidden="true">{[1, 2, 3].map((bar) => <i key={bar} className={`h-3 w-1.5 rounded-sm ${bar <= count ? "bg-amber-600" : "bg-slate-200"}`} />)}</span>;
}

function InjuriesPanel({ horse, onChanged, onRefresh }: { horse: VetHorse; onChanged: (message: string) => void; onRefresh: () => Promise<unknown> }) {
  const [markers, setMarkers] = useState<InjuryMarker[]>([]);
  const [latestMarkers, setLatestMarkers] = useState<InjuryMarker[]>([]);
  const submitting = useRef(false);
  const savedIds = useRef(new Map<string, string>());
  const saveAssessment = useMemo(() => createInjuryWorkflow(veterinarianApi), []);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<InjuryTab>("all");
  const [dialogMode, setDialogMode] = useState<"update" | null>(null);
  const [creating, setCreating] = useState(false);
  const [updateCaseId, setUpdateCaseId] = useState<string | null>(null);
  const [detailsCaseId, setDetailsCaseId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [toast, setToast] = useState<InjuryToast | null>(null);
  const [draftCoordinates, setDraftCoordinates] = useState<InjuryCoordinateFields>({ coordinate_x: "", coordinate_y: "", coordinate_z: "" });
  const [draftBodyPart, setDraftBodyPart] = useState("");
  const [draftGroup, setDraftGroup] = useState<InjuryGroup>("Muscle");
  const [defaultNextStatus, setDefaultNextStatus] = useState<InjuryTimelineStatus>("Treatment");
  const selectedCoordinates = {
    coordinate_x: draftCoordinates.coordinate_x === "" ? null : Number(draftCoordinates.coordinate_x),
    coordinate_y: draftCoordinates.coordinate_y === "" ? null : Number(draftCoordinates.coordinate_y),
    coordinate_z: draftCoordinates.coordinate_z === "" ? null : Number(draftCoordinates.coordinate_z),
  };
  const displayMarkers = useMemo(() => markers.map((marker) => ({ ...marker, description: visibleInjuryNote(marker.description) })), [markers]);
  const cases = useMemo(() => buildInjuryCases(markers, latestMarkers), [markers, latestMarkers]);
  const activeCases = cases.filter((injury) => ["New", "Treatment"].includes(currentInjuryStatus(injury)));
  const recoveringCases = cases.filter((injury) => currentInjuryStatus(injury) === "Recovering");
  const recoveredCases = cases.filter((injury) => currentInjuryStatus(injury) === "Recovered");
  const selectedCase = cases.find((injury) => injury.id === detailsCaseId) ?? null;
  const editingCase = cases.find((injury) => injury.id === updateCaseId) ?? null;
  const tabCounts: Record<InjuryTab, number> = {
    all: cases.length,
    active: activeCases.length,
    recovering: recoveringCases.length,
    recovered: recoveredCases.length,
  };
  const visibleCases = useMemo(() => {
    const filtered = cases.filter((injury) => {
      const status = currentInjuryStatus(injury);
      if (tab === "active") return status === "New" || status === "Treatment";
      if (tab === "recovering") return status === "Recovering";
      if (tab === "recovered") return status === "Recovered";
      return true;
    });
    return filtered.sort((a, b) => {
      if (tab === "recovered") {
        const dateA = a.timeline.findLast((entry) => entry.status === "Recovered")?.date ?? "";
        const dateB = b.timeline.findLast((entry) => entry.status === "Recovered")?.date ?? "";
        return Date.parse(dateB) - Date.parse(dateA);
      }
      const severityRank = { Severe: 3, Moderate: 2, Mild: 1 };
      return severityRank[b.severity] - severityRank[a.severity]
        || Date.parse(b.timeline[0]?.date ?? "") - Date.parse(a.timeline[0]?.date ?? "");
    });
  }, [cases, tab]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setLoadFailed(false);
    try {
      const latest = (await veterinarianApi.injuries(horse.id, true)).data;
      const history = (await veterinarianApi.injuries(horse.id, false)).data;
      setLatestMarkers(latest);
      setMarkers(history);
      savedIds.current.clear();
    } catch (reason) {
      setMarkers([]);
      setLoadFailed(true);
      setError(reason instanceof ApiRequestError && reason.status >= 500
        ? `Không tải được hồ sơ chấn thương vì máy chủ lỗi (HTTP ${reason.status}). Vui lòng thử lại sau.`
        : veterinarianError(reason));
    } finally {
      setLoading(false);
    }
  }, [horse.id]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 8000);
    return () => window.clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!highlightId) return;
    const timer = window.setTimeout(() => setHighlightId(null), 1500);
    return () => window.clearTimeout(timer);
  }, [highlightId]);
  const updateDialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (dialogMode !== "update") return;
    const dialog = updateDialogRef.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus({ preventScroll: true });
    };
  }, [dialogMode]);
  useEffect(() => {
    if (!dialogMode && !selectedCase && !creating) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!submitting.current && event.key === "Escape") { setDialogMode(null); setDetailsCaseId(null); setCreating(false); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dialogMode, selectedCase, creating]);

  function openCreate() {
    setDraftCoordinates({ coordinate_x: "", coordinate_y: "", coordinate_z: "" });
    setDraftBodyPart("");
    setDraftGroup("Muscle");
    setCreating((value) => !value);
    setError("");
  }

  function openUpdate(injury: InjuryCase) {
    setUpdateCaseId(injury.id);
    setDefaultNextStatus(nextInjuryStatus(currentInjuryStatus(injury)));
    setCreating(false);
    setDialogMode("update");
    setError("");
  }

  function chooseAnatomyPart(label: string) {
    const separator = label.indexOf(":");
    const category = separator >= 0 ? label.slice(0, separator).trim() : "";
    const bodyPart = separator >= 0 ? label.slice(separator + 1).trim() : label;
    setDraftBodyPart(bodyPart);
    if (category === "Xương") setDraftGroup("Bone");
    else if (category === "Cơ") setDraftGroup("Muscle");
    else if (category === "Khớp") setDraftGroup("Joint");
    else if (category) setDraftGroup("SoftTissue");
  }

  async function persistAssessment(
    markerId: string | null, bodyPart: string, input: Record<string, unknown>,
    onSuccess: (saved: InjuryMarker) => void,
  ) {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    let persisted = false;
    try {
      const result = await saveAssessment(horse, savedIds.current.get(bodyPart) ?? markerId, input,
        (saved) => { persisted = true; savedIds.current.set(bodyPart, saved.id); },
        ({ latest, history, saved }) => {
          setLatestMarkers(latest);
          setMarkers(history);
          setLoadFailed(false);
          savedIds.current.delete(bodyPart);
          onSuccess(saved);
        });
      if (result) {
        onChanged(`Đã lưu đánh giá chấn thương tại ${bodyPart}.`);
        if (result.syncError) setError(`Đã lưu đánh giá, nhưng chưa đồng bộ sức khỏe hoặc khóa lịch tập: ${veterinarianError(result.syncError)}`);
      }
    } catch (reason) {
      setError(`${persisted ? "Đã lưu đánh giá nhưng chưa tải lại được dữ liệu. Chưa cập nhật sức khỏe. " : "Không thể lưu đánh giá. "}${veterinarianError(reason)}`);
    } finally {
      try { if (persisted) await onRefresh(); }
      finally { submitting.current = false; setBusy(false); }
    }
  }

  async function createInjury(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const values = formValues(event.currentTarget, ["coordinate_x", "coordinate_y", "coordinate_z"], ["coordinate_x", "coordinate_y", "coordinate_z", "note"]);
    if (("coordinate_x" in values) !== ("coordinate_y" in values)) {
      setError("Cần nhập cả tọa độ X và Y để lưu vị trí trên mô hình.");
      return;
    }
    const bodyPart = String(values.body_part).trim();
    await persistAssessment(null, bodyPart, {
      body_part: bodyPart, severity: String(values.severity), recovery_status: "Active",
      description: encodeInjuryNote("New", String(values.injury_group) as InjuryGroup, String(values.note ?? "").trim() || null),
      ...injuryCoordinatePayload({ x: values.coordinate_x as number, y: values.coordinate_y as number, z: values.coordinate_z as number }),
    }, (saved) => {
      setCreating(false); setTab("active"); setHighlightId(saved.id);
    });
  }

  async function updateStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingCase || submitting.current) return;
    const injury = editingCase;
    const values = formValues(event.currentTarget, [], ["note"]);
    const status = String(values.status) as InjuryTimelineStatus;
    const previousStatus = currentInjuryStatus(injury);
    await persistAssessment(injury.id, injury.bodyPart, {
      recovery_status: recoveryStatusFor(status),
      description: encodeInjuryNote(status, injury.group, String(values.note ?? "").trim() || null),
    }, (saved) => {
      setDialogMode(null); setUpdateCaseId(saved.id); setDetailsCaseId((current) => current === injury.id ? saved.id : current);
      setTab(injuryTabForStatus(status)); setHighlightId(saved.id);
      setToast({ caseId: saved.id, bodyPart: saved.body_part, from: previousStatus, to: status });
    });
  }

  async function undoLastUpdate() {
    if (!toast || submitting.current) return;
    const injury = cases.find((item) => item.id === toast.caseId);
    if (!injury) return;
    const target = toast.from;
    await persistAssessment(injury.id, injury.bodyPart, {
      recovery_status: recoveryStatusFor(target),
      description: encodeInjuryNote(target, injury.group, `Hoàn tác: trở về trạng thái ${injuryLifecycleLabels[target]}`),
    }, (saved) => { setToast(null); setTab(injuryTabForStatus(target)); setHighlightId(saved.id); });
  }

  const todayValue = today();
  const activeBanner = activeCases.length > 0;
  const severeActive = activeCases.filter((injury) => injury.severity === "Severe");
  const bannerText = activeBanner
    ? `Còn vị trí đang chấn thương (${severeActive.length} vị trí Nặng${severeActive.length ? `: ${severeActive.map((injury) => injury.bodyPart).join(", ")}` : ""}). Lịch tập ${horse.is_training_locked ? "đang khóa" : "chưa khóa; cần kiểm tra trạng thái sức khỏe"}.`
    : recoveringCases.length > 0
      ? `Ngựa còn ${recoveringCases.length} vị trí chưa hồi phục hoàn toàn. Lịch tập ${horse.is_training_locked ? "đang khóa" : "chưa khóa; cần kiểm tra trạng thái sức khỏe"}.`
      : `Không còn vị trí chấn thương chưa hồi phục. Trạng thái: ${statusLabels[horse.current_status] ?? horse.current_status}; ${readinessLabels[horse.readiness_status] ?? horse.readiness_status}. Lịch tập ${horse.is_training_locked ? "đang khóa" : "đã mở khóa"}.`;
  const tabs: { id: InjuryTab; label: string }[] = [
    { id: "all", label: "Tất cả" },
    { id: "active", label: "Đang chấn thương" },
    { id: "recovering", label: "Đang hồi phục" },
    { id: "recovered", label: "Đã hồi phục" },
  ];

  return <SectionCard title="Chấn thương & phục hồi" description="Mỗi ca có một hồ sơ với lịch sử cập nhật trạng thái theo thời gian." icon={Activity} action={<button type="button" className="gold-button min-h-11 px-4" disabled={busy || loading || loadFailed} onClick={openCreate}>{creating ? "Đóng ghi nhận" : "Ghi nhận chấn thương"}</button>}>
    <ErrorLine>{error}</ErrorLine>
    {loadFailed && <button type="button" className="soft-button mb-4 min-h-11 px-4" disabled={loading} onClick={() => void load()}>Thử tải lại hồ sơ chấn thương</button>}
    {!loading && !loadFailed && <>
      <Notice variant={activeBanner || recoveringCases.length > 0 ? "warning" : "success"}>{bannerText}</Notice>
      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: "Tổng số", count: cases.length, subset: cases },
          { label: "Đang chấn thương", count: activeCases.length, subset: activeCases },
          { label: "Đang hồi phục", count: recoveringCases.length, subset: recoveringCases },
          { label: "Đã hồi phục", count: recoveredCases.length, subset: recoveredCases },
        ].map((metric) => <article key={metric.label} className="rounded-lg border border-equine-line bg-white p-3 sm:p-4">
          <p className="text-xs font-semibold text-slate-700">{metric.label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-equine-navy">{metric.count}</p>
          <p className="mt-1 text-xs text-slate-600">{metric.subset.filter((injury) => injury.severity === "Severe").length} ca Nặng</p>
        </article>)}
      </div>

      <InjuryModel3D
        markers={displayMarkers}
        placementMode={creating}
        selectedCoordinates={creating ? selectedCoordinates : null}
        onSelectLocation={(coordinates, bodyPart) => {
          if (!creating) return;
          setDraftCoordinates({
            coordinate_x: coordinates.coordinate_x == null ? "" : String(coordinates.coordinate_x),
            coordinate_y: coordinates.coordinate_y == null ? "" : String(coordinates.coordinate_y),
            coordinate_z: coordinates.coordinate_z == null ? "" : String(coordinates.coordinate_z),
          });
          if (bodyPart) chooseAnatomyPart(bodyPart);
        }}
        onSelectAnatomyPart={(bodyPart) => {
          if (!creating) return;
          chooseAnatomyPart(bodyPart);
        }}
      />

      {creating && <form onSubmit={(event) => void createInjury(event)} className="mt-4 grid gap-4 rounded-lg border border-equine-line bg-slate-50 p-4 sm:grid-cols-2">
        <h4 className="font-semibold text-equine-navy sm:col-span-2">Thông tin ca chấn thương mới</h4>
        <label className="block"><span className="field-label">Vị trí cơ thể<span className="text-rose-600"> *</span></span><input name="body_part" required maxLength={100} placeholder="Chọn vị trí trên mô hình hoặc nhập tên" value={draftBodyPart} onChange={(event) => setDraftBodyPart(event.target.value)} className="field-control px-3" /></label>
        <label className="block"><span className="field-label">Nhóm</span><select name="injury_group" required value={draftGroup} onChange={(event) => setDraftGroup(event.target.value as InjuryGroup)} className="field-control px-3">{Object.entries(injuryGroupLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <SelectField label="Mức độ" name="severity" required options={[{ value: "Mild", label: "Nhẹ" }, { value: "Moderate", label: "Vừa" }, { value: "Severe", label: "Nặng" }]} />
        <label className="block sm:col-span-2"><span className="field-label">Ghi chú</span><textarea name="note" rows={3} maxLength={1000} className="field-control resize-y px-3 py-2" /></label>
        <CoordinateFields value={draftCoordinates} onChange={setDraftCoordinates} />
        <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" className="soft-button min-h-11 px-4" disabled={busy} onClick={() => setCreating(false)}>Hủy</button><button className="gold-button min-h-11 px-4" disabled={busy}>Lưu ca chấn thương</button></div>
      </form>}

      <div className="mb-3 flex gap-2 overflow-x-auto border-b border-equine-line" role="tablist" aria-label="Lọc ca chấn thương">
        {tabs.map((item) => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={`min-h-11 shrink-0 border-b-2 px-3 text-sm font-semibold ${tab === item.id ? "border-equine-blue text-equine-blue" : "border-transparent text-slate-700 hover:text-equine-navy:text-white"}`} onClick={() => setTab(item.id)}>
          {item.label} <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-800">{tabCounts[item.id]}</span>
        </button>)}
      </div>

      <div className="max-w-full overflow-x-auto rounded-lg border border-equine-line" tabIndex={0} aria-label="Bảng ca chấn thương; cuộn ngang để xem toàn bộ cột">
        <table className="w-full min-w-[1050px] text-left text-sm">
          <thead><tr className="border-b border-equine-line bg-slate-50 text-xs font-semibold text-slate-700">
            <th scope="col" className="px-4 py-3">Vị trí</th><th scope="col" className="px-4 py-3">Trạng thái</th><th scope="col" className="px-4 py-3">Mức độ</th><th scope="col" className="px-4 py-3">Ngày bắt đầu</th><th scope="col" className="px-4 py-3">Ngày hồi phục</th><th scope="col" className="px-4 py-3">Số ngày</th><th scope="col" className="px-4 py-3">Tiến độ</th><th scope="col" className="px-4 py-3">Thao tác</th>
          </tr></thead>
          <tbody>
            {visibleCases.length === 0 ? <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-700">{cases.length ? "Không có ca ở bộ lọc này." : "Chưa ghi nhận ca chấn thương nào."}</td></tr> : visibleCases.map((injury) => {
              const status = currentInjuryStatus(injury);
              const startDate = injury.timeline[0]?.date ?? "";
              const recoveryDate = injury.timeline.findLast((entry) => entry.status === "Recovered")?.date ?? "";
              const duration = dayCount(startDate, status === "Recovered" ? recoveryDate || startDate : todayValue);
              const progress = status === "New" ? 10 : status === "Treatment" ? 35 : status === "Recovering" ? 70 : 100;
              return <tr key={injury.id} className={`border-b border-equine-line last:border-0 ${status === "Recovered" ? "bg-slate-50/70 opacity-80" : "bg-white"} ${highlightId === injury.id ? "animate-pulse ring-2 ring-inset ring-sky-500" : ""}`}>
                <td className="px-4 py-3"><button type="button" className="min-h-11 text-left font-semibold text-equine-blue underline decoration-transparent underline-offset-2 hover:decoration-current focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600" onClick={() => setDetailsCaseId(injury.id)} aria-label={`Xem lịch sử chấn thương tại ${injury.bodyPart}`}>{injury.bodyPart}</button><p className="text-xs text-slate-600">{injuryGroupLabels[injury.group]}</p></td>
                <td className="px-4 py-3"><span className={`inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${injuryStatusClasses[status]}`}>{injuryLifecycleLabels[status]}</span></td>
                <td className="px-4 py-3"><span className="inline-flex items-center gap-2"><span>{severityBars(injury.severity)}</span><span className="font-semibold text-slate-800">{injurySeverityLabels[injury.severity]}</span></span></td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-700">{displayInjuryDate(startDate)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-700">{recoveryDate ? displayInjuryDate(recoveryDate) : "—"}</td>
                <td className="px-4 py-3 tabular-nums text-slate-800">{duration} ngày</td>
                <td className="px-4 py-3"><div className="flex min-w-32 items-center gap-2"><div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label={`Tiến độ hồi phục ${injury.bodyPart}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><div className="h-full rounded-full bg-sky-700" style={{ width: `${progress}%` }} /></div><span className="w-9 text-right text-xs font-semibold tabular-nums text-slate-700">{progress}%</span></div></td>
                <td className="px-4 py-3"><button type="button" className="soft-button min-h-11 whitespace-nowrap px-3 text-xs" disabled={busy || loading || loadFailed} onClick={() => openUpdate(injury)}>Cập nhật</button></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </>}
    {loading && <PanelListSkeleton rows={3} label="Đang tải ca chấn thương..." />}

    {dialogMode === "update" && <dialog ref={updateDialogRef} aria-modal="true" aria-labelledby="injury-dialog-title" className="overflow-y-auto rounded-xl border border-slate-200 bg-white text-slate-900 shadow-2xl" style={{ position: "fixed", inset: 0, margin: "auto", padding: 0, width: "calc(100vw - 2rem)", maxWidth: "42rem", maxHeight: "calc(100dvh - 2rem)" }} onCancel={(event) => { event.preventDefault(); if (!submitting.current) setDialogMode(null); }} onMouseDown={(event) => {
      if (submitting.current || event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setDialogMode(null);
    }}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-equine-line bg-white px-4 py-3 sm:px-6">
          <h3 id="injury-dialog-title" className="text-lg font-semibold">Cập nhật · {editingCase?.bodyPart ?? "ca chấn thương"}</h3>
          <button type="button" className="min-h-11 min-w-11 rounded-md text-2xl text-slate-600 hover:bg-slate-100:bg-slate-800" aria-label="Đóng hộp thoại" disabled={busy} onClick={() => setDialogMode(null)}>×</button>
        </div>
        {editingCase && <form key={editingCase.id} onSubmit={(event) => void updateStatus(event)} className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6">
          <div className="sm:col-span-2" role="alert"><ErrorLine>{error}</ErrorLine></div>
          <label className="block"><span className="field-label">Trạng thái mới</span><select name="status" defaultValue={defaultNextStatus} className="field-control px-3">{injuryLifecycle.map((status) => <option key={status} value={status}>{injuryLifecycleLabels[status]}</option>)}</select></label>
          <label className="block sm:col-span-2"><span className="field-label">Ghi chú</span><textarea name="note" rows={3} maxLength={1000} className="field-control resize-y px-3 py-2" /></label>
          <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" className="soft-button min-h-11 px-4" disabled={busy} onClick={() => setDialogMode(null)}>Hủy</button><button className="gold-button min-h-11 px-4" disabled={busy}>Lưu cập nhật</button></div>
        </form>}
    </dialog>}

    {selectedCase && <div className="fixed inset-0 z-[80] bg-slate-950/35" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetailsCaseId(null); }}>
      <aside role="dialog" aria-modal="true" aria-labelledby="injury-details-title" className="absolute inset-y-0 right-0 flex w-full max-w-lg flex-col border-l border-equine-line bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-equine-line p-5"><div><h3 id="injury-details-title" className="text-lg font-bold text-equine-navy">{selectedCase.bodyPart}</h3><p className="mt-1 text-sm text-slate-700">{injuryGroupLabels[selectedCase.group]} · Mức độ {injurySeverityLabels[selectedCase.severity]}</p></div><button type="button" className="min-h-11 min-w-11 rounded-md text-2xl text-slate-600 hover:bg-slate-100:bg-slate-800" aria-label="Đóng lịch sử" onClick={() => setDetailsCaseId(null)}>×</button></header>
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <section><h4 className="font-semibold text-slate-900">Lịch sử</h4><ol className="mt-3 space-y-3">{[...selectedCase.timeline].reverse().map((entry, index) => <li key={entry.id ?? `${entry.date}-${index}`} className="rounded-lg border border-equine-line p-3"><div className="flex flex-wrap items-center justify-between gap-2"><time className="text-sm font-semibold text-slate-800" dateTime={entry.date}>{displayInjuryDate(entry.date)}</time><span className={`inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${injuryStatusClasses[entry.status]}`}>{injuryLifecycleLabels[entry.status]}</span></div><p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{entry.note || "Không có ghi chú."}</p>{entry.updated_by != null && <p className="mt-2 text-xs text-slate-600">Người cập nhật: {entry.updated_by}</p>}</li>)}</ol></section>
          <section className="rounded-lg bg-slate-50 p-4"><h4 className="font-semibold text-slate-900">Tọa độ</h4><p className="mt-2 text-sm text-slate-700">{selectedCase.coordinates.x == null || selectedCase.coordinates.y == null ? "Chưa ghi tọa độ." : `X ${selectedCase.coordinates.x} · Y ${selectedCase.coordinates.y}${selectedCase.coordinates.z == null ? "" : ` · Z ${selectedCase.coordinates.z}`}`}</p></section>
        </div>
      </aside>
    </div>}

    {toast && <div className="fixed bottom-4 left-3 right-3 z-[100] mx-auto flex max-w-3xl flex-col gap-3 rounded-xl border border-sky-300 bg-slate-900 p-3 text-white shadow-2xl sm:flex-row sm:items-center sm:justify-between sm:px-4" role="status" aria-live="polite">
      <p className="text-sm font-medium">{toast.bodyPart} đã chuyển sang {injuryLifecycleLabels[toast.to]}.</p>
      <div className="flex flex-wrap gap-2"><button type="button" className="min-h-11 rounded-md bg-white/10 px-3 text-sm font-semibold hover:bg-white/20" disabled={busy} onClick={() => void undoLastUpdate()}>Hoàn tác</button><button type="button" className="min-h-11 rounded-md bg-sky-300 px-3 text-sm font-semibold text-slate-950 hover:bg-sky-200" onClick={() => setTab(injuryTabForStatus(toast.to))}>Xem tab {injuryTabLabels[injuryTabForStatus(toast.to)]}</button></div>
    </div>}
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
    {loading ? <PanelListSkeleton rows={3} label="Đang tải báo cáo sự cố..." /> : error ? null : incidents.length === 0 ? <Empty>Không có báo cáo ở trạng thái này.</Empty> : <div className="grid gap-3 lg:grid-cols-2">{incidents.map((incident) => <article data-notification-target={incident.id} key={incident.id} className={`rounded-xl border p-4 ${incident.is_emergency ? "border-rose-300 bg-rose-50/40" : "border-equine-line bg-white"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2"><div><h4 className="font-semibold text-equine-navy">{incident.horse_name}</h4><p className="mt-1 text-xs text-slate-500">{incident.box_code ? `Khu ${incident.section} · Chuồng ${incident.box_code} · ` : ""}{incident.groom_name ?? "Groom"} · {formatDisplayDate(incident.created_at, true)}</p></div><div className="flex gap-2"><span className="rounded-full bg-white px-2 py-1 text-xs font-semibold">{incident.status}</span>{incident.is_emergency && <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-bold text-rose-800">KHẨN CẤP</span>}</div></div>
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

function isTrainingCalendarEvent(event: CalendarCareItem) {
  if (event.context) return true;
  return [event.event_type, event.title].some((value) => /training|trialrun|race|rest|tập|đua/i.test(value ?? ""));
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
  const name = formatDoctorDisplayName(doctorName);
  return name ? `BS. ${name}` : "Bác sĩ thú y";
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
  if (!isActiveCareSchedule(schedule)) return false;
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

function isActiveCareSchedule(schedule: CareSchedule): boolean {
  return Boolean(schedule.frequency_days) || !["Completed", "Cancelled"].includes(schedule.event_status ?? "");
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

function CarePanel({
  horses,
  selectedHorse,
  onChanged,
  onGoToExam,
  onSelectHorse,
  isHeadVet = false,
  viewMode = "care",
  onSwitchView,
}: {
  horses: VetHorse[];
  selectedHorse: VetHorse;
  onChanged: (message: string) => void;
  onGoToExam?: (horseId?: string, scheduleId?: string) => void;
  onSelectHorse?: (horseId: string) => void;
  isHeadVet?: boolean;
  viewMode?: "dispatch" | "care";
  onSwitchView?: (nextView: "dispatch" | "care") => void;
}) {
  const [rawSchedules, setSchedules] = useState<CareSchedule[]>([]);
  const [events, setEvents] = useState<CareEvent[]>([]);
  const [contextEvents, setContextEvents] = useState<CareEvent[]>([]);
  const [doctors, setDoctors] = useState<{ id: number | string; name: string; email: string; role_name?: string }[]>([]);
  const [reassignTarget, setReassignTarget] = useState<CareSchedule | null>(null);
  const [workloadsLoading, setWorkloadsLoading] = useState(true);
  const [workloadsError, setWorkloadsError] = useState("");
  const [reassignDoctorId, setReassignDoctorId] = useState<string>("");
  const [dispatchSubTab, setDispatchSubTab] = useState<"coverage" | "rules">("coverage");
  const [coverageFilter, setCoverageFilter] = useState<"all" | "uncovered" | "overdue" | "covered" | "today">("all");
  const [showIdleDoctors, setShowIdleDoctors] = useState(false);
  const [doctorFilter, setDoctorFilter] = useState<string>("all");
  const [createHorseId, setCreateHorseId] = useState<string>(selectedHorse.id);
  const [showRulesDrawer, setShowRulesDrawer] = useState(false);
  const [weekStart, setWeekStart] = useState(() => mondayOfWeek(today()));
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [horseFilter, setHorseFilter] = useState("all");
  const [includeContext, setIncludeContext] = useState(false);
  const [projectionTarget, setProjectionTarget] = useState<CalendarCareItem | null>(null);
  const rulesDrawerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (showRulesDrawer) {
      rulesDrawerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      rulesDrawerRef.current?.focus({ preventScroll: true });
    }
  }, [showRulesDrawer]);
  useEffect(() => { setProjectionTarget(null); }, [weekStart, horseFilter, scope]);
  const [bookNow, setBookNow] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [bookId, setBookId] = useState("");
  const [moveId, setMoveId] = useState("");
  const [completeId, setCompleteId] = useState("");
  const currentUser = useMemo(() => getUser(), []);
  const schedules = useMemo(() => rawSchedules.map((schedule) => {
    const doctorId = schedule.assigned_doctor_id ?? schedule.assigned_doctor?.id;
    const doctor = doctors.find((item) => doctorId != null && String(item.id) === String(doctorId));
    const name = formatDoctorDisplayName(doctor?.name ?? schedule.assigned_doctor?.name ?? schedule.doctor_name);
    return {
      ...schedule,
      doctor_name: name,
      assigned_doctor: doctorId != null ? { id: doctorId, name } : schedule.assigned_doctor,
    };
  }), [rawSchedules, doctors]);
  const workloads = useMemo(() => doctors.map((doctor) => {
    const assigned = careRulesForDoctor(schedules, doctor.id);
    return {
      ...doctor,
      role_name: doctor.role_name ?? (String(doctor.id) === String(currentUser?.id) ? currentUser?.roleName : undefined),
      total_schedules: assigned.length,
      today_count: events.filter((event) => event.event_date === today() && event.status === "Scheduled"
        && assigned.some((rule) => rule.id === event.schedule_id || Boolean(rule.calendar_event_id && rule.calendar_event_id === (event.event_id ?? event.id)))).length,
      overdue_count: assigned.filter(isScheduleOverdue).length,
    };
  }), [doctors, schedules, currentUser, events]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const from = weekStart;
  const to = addCalendarDays(weekStart, 6);
  const effectiveScope = viewMode === "dispatch" ? "all" : scope;
  const calendarFrom = viewMode === "dispatch" ? today() : from;
  const calendarTo = viewMode === "dispatch" ? today() : to;
  const currentWeekStart = mondayOfWeek(today());
  const [showAllSlots, setShowAllSlots] = useState(true);
  useEffect(() => {
    const syncTarget = () => {
      const params = new URLSearchParams(window.location.search);
      if (!params.get("notificationTarget") && !(viewMode === "care" && params.get("horse") && params.get("date"))) return;
      if (params.get("date")?.match(/^\d{4}-\d{2}-\d{2}$/)) setWeekStart(mondayOfWeek(params.get("date")!));
      setCoverageFilter("all"); setDoctorFilter("all"); setDispatchSubTab("coverage");
      if (viewMode === "care") { setHorseFilter(params.get("horse") ?? "all"); if (isHeadVet) setScope("all"); }
    };
    syncTarget(); window.addEventListener("workspace-tab-change", syncTarget);
    return () => window.removeEventListener("workspace-tab-change", syncTarget);
  }, [viewMode, isHeadVet]);

  const hasActiveFilters = horseFilter !== "all" || scope !== "mine" || includeContext;

  useEffect(() => {
    if (viewMode !== "care") return;
    const navigateWeek = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, select, textarea, button, a, [contenteditable]:not([contenteditable='false']), [role='switch'], [role='dialog'], [role='slider'], [role='combobox']")) return;
      if (createOpen || projectionTarget || reassignTarget || bookId || moveId || completeId || document.querySelector("dialog[open], [aria-modal='true']")) return;
      event.preventDefault();
      setWeekStart((current) => addCalendarDays(current, event.key === "ArrowLeft" ? -7 : 7));
    };
    window.addEventListener("keydown", navigateWeek);
    return () => window.removeEventListener("keydown", navigateWeek);
  }, [viewMode, createOpen, projectionTarget, reassignTarget, bookId, moveId, completeId]);

  const weekOptions = useMemo(() => {
    const options = [];
    const curr = dateFromKey(currentWeekStart);
    const selectedWeekOffset = Math.round((dateFromKey(weekStart).getTime() - curr.getTime()) / (7 * 86400000));
    for (let i = Math.min(-8, selectedWeekOffset); i <= Math.max(12, selectedWeekOffset); i++) {
      const monday = new Date(curr);
      monday.setDate(monday.getDate() + i * 7);
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);
      const key = dateKey(monday);
      const weekNum = getISOWeekNumber(monday);
      const year = monday.getFullYear();
      const mStr = `${String(monday.getDate()).padStart(2, "0")}/${String(monday.getMonth() + 1).padStart(2, "0")}`;
      const sStr = `${String(sunday.getDate()).padStart(2, "0")}/${String(sunday.getMonth() + 1).padStart(2, "0")}`;
      options.push({ key, weekNum, year, label: `Week ${weekNum}, ${year}`, fullLabel: `${mStr}${year !== sunday.getFullYear() ? `/${year}` : ""} - ${sStr}/${sunday.getFullYear()}` });
    }
    return options;
  }, [currentWeekStart, weekStart]);
  const activeRules = useMemo(() => activeRecurringRules(schedules, horseFilter,
    scope === "mine" ? currentUser?.id ?? "" : undefined), [schedules, horseFilter, scope, currentUser]);
  const calendarItems = useMemo<CalendarCareItem[]>(() => {
    const dueItems = buildCareProjections(activeRules, events, horses, from, to);
    const primaryCareItems: CalendarCareItem[] = [
      ...events.map((event) => ({ ...event, context: false })),
      ...dueItems,
    ];
    try {
      const exportCareForTrainer = primaryCareItems
        .filter((ev) => ev.status !== "Cancelled" && !ev.is_periodic_due)
        .map((ev) => {
          const hId = ev.horse?.id ?? ev.horse_id ?? schedules.find((s) => s.id === ev.schedule_id)?.horse_id ?? "";
          const hObj = horses.find((h) => h.id === hId);
          return {
            event_id: ev.event_id ?? ev.id ?? `care-${hId}-${ev.event_date}`,
            event_type: ev.care_type ?? ev.event_type ?? "PeriodicCare",
            care_type: ev.care_type ?? ev.event_type ?? "PeriodicCare",
            title: ev.title ?? ev.care_type ?? "Chăm sóc định kỳ",
            event_date: ev.event_date,
            due_date: ev.due_date ?? ev.event_date,
            start_time: ev.start_time ?? null,
            end_time: ev.end_time ?? null,
            status: ev.status,
            source_table: "Periodic_Care_Schedules",
            source_id: ev.schedule_id ?? ev.event_id ?? ev.id ?? "",
            horse_id: String(hId),
            horse_name: hObj?.horse_name ?? ev.horse?.horse_name ?? ev.horse_name ?? "Ngựa",
            box_code: hObj?.stable_box?.box_code ?? ev.box_code ?? null,
            section: hObj?.stable_box?.section ?? ev.section ?? null,
            doctor_name: ev.assigned_doctor?.name ?? null,
            is_periodic_due: Boolean(ev.is_periodic_due),
          };
        });
      window.localStorage.setItem(
        `racehorse:shared-calendar:vet:${from}`,
        JSON.stringify(exportCareForTrainer),
      );
    } catch {
      // ignore storage errors
    }

    const mergedContextEvents: CalendarCareItem[] = contextEvents.map((event) => ({ ...event, context: true }));
    if (includeContext) {
      try {
        const cachedTrainRaw = window.localStorage.getItem(`racehorse:shared-calendar:training:${from}`);
        if (cachedTrainRaw) {
          const cachedTrain = JSON.parse(cachedTrainRaw) as Array<Record<string, unknown>>;
          if (Array.isArray(cachedTrain)) {
            const seenTrainKeys = new Set(
              mergedContextEvents.map((ev) => {
                const hId = ev.horse?.id ?? ev.horse_id ?? "";
                return `${hId}|${ev.event_date}|${(ev.start_time ?? "").slice(0, 5)}`;
              }),
            );
            for (const ts of cachedTrain) {
              if (ts.status === "Cancelled") continue;
              const hId = String(ts.horse_id ?? "");
              const evDate = String(ts.event_date ?? "");
              const sTime = ts.start_time ? String(ts.start_time) : null;
              const key = `${hId}|${evDate}|${(sTime ?? "").slice(0, 5)}`;
              if (!hId || !evDate || seenTrainKeys.has(key)) continue;
              seenTrainKeys.add(key);
              const hName = String(ts.horse_name ?? "Ngựa");
              mergedContextEvents.push({
                id: String(ts.event_id ?? ts.training_schedule_id ?? key),
                event_id: String(ts.event_id ?? ts.training_schedule_id ?? key),
                horse_id: hId,
                horse_name: hName,
                horse: { id: hId, horse_name: hName },
                event_date: evDate,
                start_time: sTime,
                end_time: ts.end_time ? String(ts.end_time) : null,
                status: String(ts.status ?? "Scheduled"),
                event_type: String(ts.session_type ?? "Training"),
                session_type: String(ts.session_type ?? "Training"),
                title: String(ts.session_type ?? "Training"),
                track_surface: ts.track_surface ? String(ts.track_surface) : null,
                target_distance_meters: typeof ts.plan_target_distance_meters === "number" ? ts.plan_target_distance_meters : null,
                target_intensity: ts.plan_target_intensity ? String(ts.plan_target_intensity) : null,
                groom_name: ts.groom_name ? String(ts.groom_name) : null,
                box_code: ts.box_code ? String(ts.box_code) : null,
                section: ts.section ? String(ts.section) : null,
                context: true,
              });
            }
          }
        }
      } catch {
        // ignore storage parse errors
      }
    }

    const items: CalendarCareItem[] = [
      ...primaryCareItems,
      ...(includeContext ? mergedContextEvents : []),
    ];
    return items.filter((event) => {
      if (event.status === "Cancelled") return false;
      const schedule = schedules.find((item) => item.id === event.schedule_id);
      if (!event.context && effectiveScope === "mine" && !isAssignedDoctor(event, schedule, currentUser)) return false;
      if (horseFilter === "all") return true;
      const eventHorseId = event.horse?.id ?? event.horse_id ?? schedules.find((schedule) => schedule.id === event.schedule_id)?.horse_id;
      return eventHorseId === horseFilter;
    });
  }, [activeRules, contextEvents, currentUser, effectiveScope, events, from, horseFilter, horses, includeContext, schedules, to]);
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
  const weeklyCareEvents = weekDays.flatMap((day) => day.events).filter((event) => !event.context && !event.is_periodic_due && event.status !== "Cancelled");
  const weeklyProjectedEvents = weekDays.flatMap((day) => day.events).filter((event) => event.is_periodic_due);
  const weeklyTrainingEvents = weekDays.flatMap((day) => day.events).filter((event) => Boolean(event.context) && event.status !== "Cancelled");
  const weeklyCompletedCount = weeklyCareEvents.filter((event) => event.status === "Completed").length;
  const weeklyTodayCount = (viewMode === "dispatch" ? events : weeklyCareEvents).filter((event) => !event.context && event.event_date === today() && event.status === "Scheduled").length;
  const weeklyOverdueCount = weeklyCareEvents.filter((event) => {
    const schedule = schedules.find((item) => item.id === event.schedule_id || Boolean(item.calendar_event_id && item.calendar_event_id === (event.event_id ?? event.id)));
    return isEventOverdue(event, schedule);
  }).length;
  const weeklyPendingCount = Math.max(0, weeklyCareEvents.filter((event) => event.status === "Scheduled").length - weeklyOverdueCount);
  const filteredSchedules = schedules.filter((schedule) => horseFilter === "all" || schedule.horse_id === horseFilter);
  const weeklyDueRuleCount = weeklyProjectedEvents.length;
  const nearestDueDate = weeklyProjectedEvents.map((event) => event.event_date).sort()[0];

  const horseCoverage = useMemo(() => {
    return horses.map((h) => {
      // Chỉ tính quy tắc còn hiệu lực: định kỳ, hoặc lịch 1 lần chưa hoàn thành/hủy.
      const horseRules = schedules.filter((s) => s.horse_id === h.id && (Boolean(s.frequency_days) || !["Completed", "Cancelled"].includes(s.event_status ?? "")));
      const overdueRules = horseRules.filter((s) => isScheduleOverdue(s));
      const hasOverdue = overdueRules.length > 0;
      const isUncovered = horseRules.length === 0;
      const nearestSchedule = [...horseRules].sort((a, b) => a.next_due_date.localeCompare(b.next_due_date))[0];
      return {
        horse: h,
        horseRules,
        overdueRules,
        hasOverdue,
        isUncovered,
        nearestSchedule,
      };
    });
  }, [horses, schedules]);

  const coveredCount = horseCoverage.filter((h) => !h.isUncovered).length;
  const uncoveredCount = horseCoverage.filter((h) => h.isUncovered).length;
  const overdueHorsesCount = horseCoverage.filter((h) => h.hasOverdue).length;

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

  const careLoadId = useRef({ value: 0 });
  const load = useCallback(async () => {
    const requestId = ++careLoadId.current.value;
    setLoading(true); setError("");
    const [scheduleResult, calendarResult] = await Promise.allSettled([
      veterinarianApi.allSchedules(), veterinarianApi.calendar(calendarFrom, calendarTo, includeContext, effectiveScope),
    ]);
    if (requestId !== careLoadId.current.value) return;
    const failures: string[] = [];
    if (scheduleResult.status === "fulfilled") setSchedules(scheduleResult.value.data);
    else { setSchedules([]); failures.push(`Quy tắc chăm sóc: ${veterinarianError(scheduleResult.reason)}`); }
    if (calendarResult.status === "fulfilled") {
      setEvents(calendarResult.value.data); setContextEvents(calendarResult.value.context_events ?? []);
    } else { setEvents([]); setContextEvents([]); failures.push(`Lịch chăm sóc: ${veterinarianError(calendarResult.reason)}`); }
    setError(failures.join(" · "));
    setLoading(false);
  }, [calendarFrom, calendarTo, effectiveScope, includeContext]);
  useEffect(() => {
    const requestState = careLoadId.current;
    void load();
    return () => { ++requestState.value; };
  }, [load]);

  const loadWorkloads = useCallback(async () => {
    setWorkloadsLoading(true);
    setWorkloadsError("");
    try {
      const res = await veterinarianApi.veterinarians();
      if (!Array.isArray(res)) throw new Error("Dữ liệu danh sách bác sĩ không hợp lệ.");
      setDoctors(res.map((doctor) => ({ ...doctor, name: formatDoctorDisplayName(doctor.name) })));
    } catch (reason) {
      setWorkloadsError(veterinarianError(reason));
    } finally {
      setWorkloadsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkloads();
  }, [loadWorkloads]);

  async function handleReassign(scheduleId: string, doctorId: string) {
    if (!doctorId) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await veterinarianApi.reassignSchedule(scheduleId, Number(doctorId));
      setReassignTarget(null);
      await Promise.all([load(), loadWorkloads()]);
      onChanged("Đã điều chuyển bác sĩ phụ trách ca chăm sóc.");
      setNotice("Đã cập nhật bác sĩ phụ trách thành công.");
    } catch (reason) {
      setError(veterinarianError(reason));
    } finally {
      setBusy(false);
    }
  }

  async function createSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    const form = event.currentTarget;
    const formData = new FormData(form);
    const book = formData.get("book_event") === "on";
    const values = formValues(form, ["frequency_days", "assigned_doctor_id"], ["frequency_days", "last_done_date", "notes", "start_time", "end_time"]);
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
      return true;
    }
    catch (reason) { setError(veterinarianError(reason)); return false; }
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
    return act(() => veterinarianApi.bookSchedule(id, values), "Đã chốt ca làm việc và tạo thông báo nhắc.");
  }
  async function submitMove(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    if (!isHeadVet) {
      setError("Chỉ trưởng ban thú y được phép dời lịch chăm sóc.");
      return;
    }
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

  const filteredCoverage = useMemo(() => {
    return horseCoverage.filter((item) => {
      if (doctorFilter !== "all" && !item.horseRules.some((rule) => String(rule.assigned_doctor_id ?? rule.assigned_doctor?.id ?? "") === doctorFilter)) return false;
      if (coverageFilter === "today") return events.some((event) => event.event_date === today() && event.status === "Scheduled" && (event.horse?.id ?? event.horse_id) === item.horse.id);
      if (coverageFilter === "uncovered") return item.isUncovered;
      if (coverageFilter === "overdue") return item.hasOverdue;
      if (coverageFilter === "covered") return !item.isUncovered && !item.hasOverdue;
      return true;
    });
  }, [horseCoverage, coverageFilter, doctorFilter, events]);

  function openCareCalendar(horseId: string, schedule?: CareSchedule) {
    const target = schedule ? careCalendarTarget(schedule) : { horseId, date: today() };
    const url = new URL(window.location.href);
    url.searchParams.set("horse", target.horseId);
    url.searchParams.set("date", target.date);
    url.searchParams.delete("notificationTarget");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    onSelectHorse?.(target.horseId);
    setHorseFilter(target.horseId);
    setWeekStart(mondayOfWeek(target.date));
    if (isHeadVet) setScope("all");
    onSwitchView?.("care");
  }

  const dispatchFilteredRules = useMemo(() => {
    return [...filteredSchedules]
      .filter(isActiveCareSchedule)
      .filter((s) => doctorFilter === "all" || String(s.assigned_doctor_id ?? s.assigned_doctor?.id ?? "") === doctorFilter)
      .sort((left, right) => left.next_due_date.localeCompare(right.next_due_date));
  }, [filteredSchedules, doctorFilter]);

  return <SectionCard
    className={viewMode === "dispatch" ? "care-dispatch" : ""}
    title={
      viewMode === "dispatch"
        ? "Điều phối chăm sóc"
        : isHeadVet
        ? "Thời khóa biểu Chăm sóc Thú y"
        : "Lịch của tôi"
    }
    description={
      viewMode === "dispatch"
        ? "Theo dõi tải công việc đội ngũ bác sĩ thú y, giám sát độ phủ chăm sóc toàn đàn và phân bổ ca khám."
        : isHeadVet
        ? "Xem lịch làm việc trong tuần của toàn bộ bác sĩ hoặc theo từng ngựa."
        : "Lịch tuần các ca khám và chăm sóc ngựa được phân công cho bạn. Vào khám trực tiếp hoặc ghi nhận kết quả."
    }
    icon={viewMode === "dispatch" ? Users : CalendarDays}
    action={
      <div className="flex flex-wrap items-center gap-2">
        {isHeadVet && onSwitchView && (
          <button
            type="button"
            className="soft-button h-10 px-3.5 text-xs font-bold text-slate-800"
            onClick={() => onSwitchView(viewMode === "dispatch" ? "care" : "dispatch")}
          >
            {viewMode === "dispatch" ? "Xem Thời khóa biểu tuần →" : "← Bàn điều phối & Phân công"}
          </button>
        )}
        {viewMode === "care" && (
          <button
            type="button"
            className="soft-button h-10 px-3 text-xs font-semibold text-slate-700"
            onClick={() => setShowRulesDrawer((v) => !v)}
          >
            {showRulesDrawer ? "Ẩn quy tắc định kỳ" : `Quy tắc định kỳ (${activeRules.length})`}
          </button>
        )}
        <button
          type="button"
          className="gold-button h-10 px-3.5 text-xs font-bold"
          onClick={() => {
            setCreateHorseId(selectedHorse.id);
            setCreateOpen(true);
          }}
        >
          Tạo quy tắc
        </button>
      </div>
    }
  >
    <ErrorLine>{error}</ErrorLine>
    {notice && <div className="mb-3"><Notice>{notice}</Notice></div>}

    {projectionTarget && (
      <Modal title="Xác nhận tạo ca chăm sóc" busy={busy} onClose={() => setProjectionTarget(null)}>
        <p className="mt-3 text-sm text-slate-600">
          {careTypeLabels[projectionTarget.care_type ?? ""] ?? projectionTarget.care_type}
          {" · "}{projectionTarget.horse?.horse_name} · Dự kiến ngày {formatDayMonth(projectionTarget.event_date)}.
          Xác nhận để tạo ca thực tế và thông báo nhắc.
        </p>
        {error && <div role="alert" className="mt-3 text-sm text-rose-700">{error}</div>}
        <form className="mt-4 space-y-3" onSubmit={async (event) => {
          event.preventDefault();
          if (busy || !projectionTarget.schedule_id) return;
          const success = await submitBook(event, projectionTarget.schedule_id);
          if (success) setProjectionTarget(null);
        }}>
          <Field label="Ngày hẹn" name="event_date" type="date" required defaultValue={projectionTarget.event_date} />
          <label className="block">
            <span className="field-label">Ca chăm sóc</span>
            <select name="slot_time_range" className="field-control" required defaultValue={(() => {
              const slot = TIMETABLE_SLOTS.find((item) => item.id === getEventSlot(projectionTarget)) ?? TIMETABLE_SLOTS[0];
              return `${slot.startTime}|${slot.endTime}`;
            })()}>
              {TIMETABLE_SLOTS.map((slot) => <option key={slot.id} value={`${slot.startTime}|${slot.endTime}`}>Ca {slot.id}: {slot.timeRange}</option>)}
            </select>
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" className="soft-button" disabled={busy} onClick={() => setProjectionTarget(null)}>Hủy</button>
            <button type="submit" className="gold-button" disabled={busy}>{busy ? "Đang tạo ca…" : "Xác nhận tạo ca"}</button>
          </div>
        </form>
      </Modal>
    )}

    {/* Reassign Doctor Modal */}
    {reassignTarget && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
          <h4 className="text-base font-bold text-slate-900">Điều chuyển Bác sĩ phụ trách</h4>
          <p className="mt-1 text-xs text-slate-600">
            Chỉ định lại bác sĩ cho việc chăm sóc: <strong className="text-slate-900">{careTypeLabels[reassignTarget.care_type] ?? reassignTarget.care_type}</strong> (Ngựa: {horses.find(h => h.id === reassignTarget.horse_id)?.horse_name ?? reassignTarget.horse_name})
          </p>
          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="field-label text-xs font-bold text-slate-800">Chọn Bác sĩ mới:</span>
              <select
                value={reassignDoctorId}
                onChange={(e) => setReassignDoctorId(e.target.value)}
                className="field-control h-10 px-3 text-sm font-semibold"
              >
                <option value="">-- Chọn bác sĩ --</option>
                {doctors.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    BS. {doc.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              className="soft-button px-4 py-2 text-xs"
              onClick={() => setReassignTarget(null)}
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={busy || !reassignDoctorId}
              className="gold-button px-4 py-2 text-xs"
              onClick={() => void handleReassign(reassignTarget.id, reassignDoctorId)}
            >
              Xác nhận điều chuyển
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Create Schedule Modal */}
    {createOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h4 className="text-base font-bold text-slate-900">Thiết lập & Giao lịch chăm sóc định kỳ</h4>
              <p className="mt-0.5 text-xs text-slate-500">Chọn ngựa, bác sĩ phụ trách và ngày đến hạn thực hiện.</p>
            </div>
            <button
              type="button"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              onClick={() => setCreateOpen(false)}
            >
              ✕
            </button>
          </div>
          <form onSubmit={(event) => void createSchedule(event)} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="field-label">Chọn ngựa <span className="text-rose-600">*</span></span>
              <select
                name="horse_id"
                value={createHorseId}
                onChange={(e) => setCreateHorseId(e.target.value)}
                required
                className="field-control px-3 font-semibold text-slate-900"
              >
                {horses.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.horse_name} {h.stable_box ? `(Chuồng ${h.stable_box.box_code})` : ""}
                  </option>
                ))}
              </select>
            </label>
            <SelectField
              label="Loại chăm sóc"
              name="care_type"
              required
              options={[
                { value: "HoofCheck", label: "Kiểm tra móng" },
                { value: "Deworming", label: "Tẩy giun" },
                { value: "Vaccination", label: "Tiêm phòng" },
                { value: "MedicalCheckup", label: "Khám định kỳ" },
              ]}
            />
            <label className="block">
              <span className="field-label">Bác sĩ phụ trách <span className="text-rose-600">*</span></span>
              <select
                name="assigned_doctor_id"
                defaultValue={currentUser?.id ? String(currentUser.id) : (doctors[0]?.id ? String(doctors[0].id) : "")}
                required
                className="field-control px-3"
              >
                {doctors.length > 0 ? (
                  doctors.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      BS. {doc.name}{currentUser?.id && String(doc.id) === String(currentUser.id) ? " (Tôi)" : ""}
                    </option>
                  ))
                ) : (
                  <option value={currentUser?.id ? String(currentUser.id) : ""}>
                    {currentUser?.fullName ?? "Bác sĩ hiện tại"} (Tôi)
                  </option>
                )}
              </select>
            </label>
            <Field label="Chu kỳ lặp (ngày) · bỏ trống nếu 1 lần" name="frequency_days" type="number" min={1} step="1" />
            <Field label="Ngày đến hạn" name="next_due_date" type="date" required defaultValue={today()} />
            <Field label="Lần thực hiện gần nhất" name="last_done_date" type="date" />
            <div className="sm:col-span-2">
              <TextAreaField label="Ghi chú chuyên môn" name="notes" rows={2} />
            </div>
            <label className="flex min-h-10 items-center gap-2 rounded-xl border border-equine-line bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 sm:col-span-2">
              <input type="checkbox" name="book_event" checked={bookNow} onChange={(event) => setBookNow(event.target.checked)} />
              Chốt ca làm việc ngay trên thời khóa biểu và gửi thông báo nhắc
            </label>
            {bookNow ? (
              <label className="block sm:col-span-2">
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
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 sm:col-span-2">
                Quy tắc sẽ được lưu ở trạng thái “Chưa chốt ca”. Bác sĩ có thể đặt ca sau trên thời khóa biểu.
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2 sm:col-span-2">
              <button type="button" className="soft-button h-10 px-4 text-xs" onClick={() => setCreateOpen(false)}>
                Hủy
              </button>
              <button className="gold-button h-10 px-5 text-xs font-bold" disabled={busy}>
                {bookNow ? "Giao lịch & Chốt ca" : "Lưu quy tắc định kỳ"}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}

    {/* ===================================================================== */}
    {/* TRANG 1: BÀN ĐIỀU PHỐI (viewMode === "dispatch")                      */}
    {/* ===================================================================== */}
    {viewMode === "dispatch" ? (
      <div className="space-y-5">
        <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-3" data-dispatch-kpis>
          {[
            { label: "Độ phủ", value: `${coveredCount}/${horses.length}`, hint: `${uncoveredCount} ngựa chưa có lịch`, Icon: ShieldAlert, tone: "blue", filter: "uncovered" as const },
            { label: "Ngựa quá hạn", value: overdueHorsesCount, hint: "Cần đôn đốc / đổi bác sĩ", Icon: AlertTriangle, tone: "red", filter: "overdue" as const },
            { label: "Ca hôm nay", value: weeklyTodayCount, hint: weeklyTodayCount ? "Chưa hoàn thành" : "Không có ca hôm nay", Icon: CalendarCheck, tone: "green", filter: "today" as const },
          ].map(({ label, value, hint, Icon, tone, filter }) => <button key={filter} type="button"
            className={`dispatch-kpi dispatch-kpi--${tone} ${tone === "red" && overdueHorsesCount > 0 ? "has-alert" : ""}`}
            aria-pressed={dispatchSubTab === "coverage" && coverageFilter === filter}
            title={filter === "overdue" ? "Đếm ngựa có ít nhất một quy tắc quá hạn; mỗi ngựa tính một lần." : undefined}
            onClick={() => { setDispatchSubTab("coverage"); setDoctorFilter("all"); setCoverageFilter(filter === "uncovered" && !uncoveredCount ? "all" : filter); }}>
            <span className="dispatch-kpi-icon"><Icon size={21} aria-hidden="true" /></span>
            <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-slate-600">{label}</span><span className="my-1 block text-3xl font-bold tracking-tight tabular-nums">{value}</span><span className="block text-xs text-slate-600">{hint}</span>
              {filter === "uncovered" && <span role="progressbar" aria-label="Độ phủ chăm sóc" aria-valuemin={0} aria-valuemax={horses.length || 1} aria-valuenow={coveredCount} className="mt-3 block h-1.5 overflow-hidden rounded-full bg-blue-100"><span className="block h-full rounded-full bg-equine-blue" style={{ width: `${horses.length ? coveredCount / horses.length * 100 : 0}%` }} /></span>}
            </span>
          </button>)}
        </div>

        {isHeadVet && <section className="rounded-xl border border-slate-200 bg-white p-4" aria-label="Phân bổ bác sĩ">
          <div className="mb-3 flex items-center gap-2">
            <h4 className="text-sm font-semibold text-slate-900">Phân bổ bác sĩ</h4>
            <span tabIndex={0} className="rounded text-slate-400 focus-visible:ring-2 focus-visible:ring-blue-400" title="Đếm các quy tắc còn hiệu lực theo ID bác sĩ được phân công. Bấm chip để lọc danh sách quy tắc; lịch một lần đã hoàn thành hoặc hủy được xem trong Lịch chăm sóc." aria-label="Giải thích phân bổ bác sĩ"><CircleHelp size={14} /></span>
            {doctorFilter !== "all" && <button type="button" className="ml-auto text-xs font-semibold text-blue-700 hover:underline" onClick={() => setDoctorFilter("all")}>Bỏ lọc</button>}
          </div>
          {(workloadsLoading || loading) && <p role="status" className="text-xs text-slate-500">Đang tải phân công…</p>}
          {workloadsError && <div role="alert" className="text-sm text-rose-700">{workloadsError}<button type="button" className="ml-2 underline" onClick={() => void loadWorkloads()}>Thử lại</button></div>}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {workloads.filter((doc) => doc.total_schedules > 0 || showIdleDoctors).map((doc) => {
              const selected = doctorFilter === String(doc.id);
              return <button key={doc.id} type="button" aria-pressed={selected}
                onClick={() => { setDoctorFilter(selected ? "all" : String(doc.id)); setDispatchSubTab("rules"); }}
                className={`dispatch-doctor ${selected ? "is-selected" : ""}`}>
                <span className="dispatch-avatar" aria-hidden="true">{doc.name.trim().split(/\s+/).slice(-2).map((name) => name[0]).join("")}</span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="flex flex-wrap items-center gap-2"><span className="font-semibold text-slate-900">{doc.name}</span>
                    {doc.role_name === "HEAD_VETERINARIAN" && <span className="rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-800">Trưởng ban</span>}</span>
                  <span className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600"><span>{doc.total_schedules} đang nhận</span>
                    {doc.overdue_count > 0 && <span className="rounded-full bg-red-700 px-2 py-0.5 text-[10px] font-semibold text-white">{doc.overdue_count} quá hạn</span>}</span>
                  <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-slate-100" role="meter" aria-label={`Tải công việc ${doc.name}`} aria-valuemin={0} aria-valuemax={Math.max(1, ...workloads.map((doctor) => doctor.total_schedules))} aria-valuenow={doc.total_schedules}>
                    <span className="block h-full rounded-full bg-equine-blue" style={{ width: `${doc.total_schedules / Math.max(1, ...workloads.map((doctor) => doctor.total_schedules)) * 100}%` }} /></span>
                </span>
              </button>;
            })}
          </div>
          {workloads.some((doc) => doc.total_schedules === 0) && <button type="button" aria-expanded={showIdleDoctors} className="mt-2 text-xs text-slate-500 hover:text-blue-700" onClick={() => setShowIdleDoctors((value) => !value)}>
            {showIdleDoctors ? "Thu gọn bác sĩ chưa có việc" : `${workloads.filter((doc) => doc.total_schedules === 0).length} bác sĩ chưa có việc`}
          </button>}
        </section>}

        <div className="rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="flex flex-wrap gap-4 border-b border-slate-200 px-4" role="tablist" aria-label="Bảng điều phối">
            <button id="dispatch-coverage-tab" type="button" role="tab" aria-controls="dispatch-results" aria-selected={dispatchSubTab === "coverage"} onClick={() => setDispatchSubTab("coverage")}
              className={`border-b-[3px] py-4 text-sm font-bold ${dispatchSubTab === "coverage" ? "border-equine-blue text-equine-blue" : "border-transparent text-slate-500 hover:text-slate-900"}`}>Độ phủ chăm sóc</button>
            <button id="dispatch-rules-tab" type="button" role="tab" aria-controls="dispatch-results" aria-selected={dispatchSubTab === "rules"} onClick={() => setDispatchSubTab("rules")}
              title="Danh sách quy tắc còn hiệu lực, lọc theo ngựa và bác sĩ được phân công."
              className={`border-b-[3px] py-4 text-sm font-bold ${dispatchSubTab === "rules" ? "border-equine-blue text-equine-blue" : "border-transparent text-slate-500 hover:text-slate-900"}`}>Danh sách quy tắc</button>
          </div>
          <div className="flex flex-wrap gap-2 border-b border-slate-100 px-4 py-3">
            {dispatchSubTab === "coverage" ? <>
              {([{ id: "all", label: "Tất cả" }, { id: "uncovered", label: "Chưa có lịch" }, { id: "overdue", label: "Quá hạn" }, { id: "covered", label: "Đầy đủ" }] as const).map((pill) => <button key={pill.id} type="button" aria-pressed={coverageFilter === pill.id} onClick={() => setCoverageFilter(pill.id)}
                className={`rounded-full border px-3 py-1 text-xs ${coverageFilter === pill.id ? "border-equine-blue bg-equine-blue text-white shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"}`}>{pill.label} · {horseCoverage.filter((item) => (doctorFilter === "all" || item.horseRules.some((rule) => String(rule.assigned_doctor_id ?? rule.assigned_doctor?.id ?? "") === doctorFilter)) && (pill.id === "all" || (pill.id === "uncovered" ? item.isUncovered : pill.id === "overdue" ? item.hasOverdue : !item.isUncovered && !item.hasOverdue))).length}</button>)}
              {coverageFilter === "today" && <button type="button" className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs text-blue-800" onClick={() => setCoverageFilter("all")}>Ca hôm nay · Bỏ lọc</button>}
            </> : <>
              <select aria-label="Ngựa trong danh sách quy tắc" value={horseFilter} onChange={(event) => setHorseFilter(event.target.value)} className="field-control h-8 max-w-full px-2 text-xs">
                <option value="all">Tất cả ngựa</option>{horses.map((horse) => <option key={horse.id} value={horse.id}>{horse.horse_name}</option>)}
              </select>
              <select aria-label="Bác sĩ trong danh sách quy tắc" value={doctorFilter} onChange={(event) => setDoctorFilter(event.target.value)} className="field-control h-8 max-w-full px-2 text-xs">
                <option value="all">Tất cả bác sĩ</option>{doctors.map((doctor) => <option key={doctor.id} value={String(doctor.id)}>{doctor.name}</option>)}
              </select>
            </>}
          </div>
          <div id="dispatch-results" role="tabpanel" aria-labelledby={dispatchSubTab === "coverage" ? "dispatch-coverage-tab" : "dispatch-rules-tab"}>
          {dispatchSubTab === "coverage" ? (
            <div className="overflow-x-auto rounded-b-xl">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600"><tr>
                  <th className="px-4 py-3 font-semibold">Ngựa & vị trí</th><th className="px-4 py-3 font-semibold">Quy tắc và hạn</th><th className="px-4 py-3 font-semibold">Trạng thái</th><th className="px-4 py-3 text-right font-semibold">Thao tác</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? <tr><td colSpan={4} className="p-6 text-center text-slate-500">Đang tải điều phối…</td></tr> : filteredCoverage.length === 0 ? <tr><td colSpan={4} className="p-6 text-center text-slate-500">Không có ngựa khớp bộ lọc.</td></tr> : filteredCoverage.map((item) => {
                    const openRules = () => { setHorseFilter(item.horse.id); setDoctorFilter("all"); setDispatchSubTab("rules"); };
                    const openCalendar = () => openCareCalendar(item.horse.id, item.nearestSchedule);
                    const assign = () => { onSelectHorse?.(item.horse.id); setCreateHorseId(item.horse.id); setCreateOpen(true); };
                    return <tr data-notification-target={item.horse.id} key={item.horse.id} className={`transition-colors hover:bg-[#F4F6FA] ${item.hasOverdue ? "bg-red-50/50" : ""}`}>
                      <td className="px-4 py-3"><div className="font-semibold text-slate-900">{item.horse.horse_name}</div><div className="mt-1 text-[11px] text-slate-500">{formatStableSection(item.horse.stable_box?.section)}{item.horse.stable_box?.box_code ? ` · Chuồng ${item.horse.stable_box.box_code}` : ""}</div></td>
                      <td className="px-4 py-3 text-slate-700">{[...item.horseRules].sort((a, b) => a.next_due_date.localeCompare(b.next_due_date)).map((rule) => <div key={rule.id} className="py-0.5">{careTypeLabels[rule.care_type] ?? rule.care_type} · <span className={isScheduleOverdue(rule) ? "font-semibold text-red-700" : ""}>{displayDate(rule.next_due_date)}</span> · {rule.doctor_name || "Chưa phân công"}</div>)}</td>
                      <td className="px-4 py-3"><span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${item.hasOverdue ? "border-rose-200 bg-rose-50 text-rose-800" : item.isUncovered ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`} title={item.hasOverdue ? "Đếm quy tắc quá hạn của ngựa, không phải số ca." : undefined}><span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />{item.hasOverdue ? `${item.overdueRules.length} quy tắc quá hạn` : item.isUncovered ? "Chưa có lịch" : "Đầy đủ"}</span></td>
                      <td className="px-4 py-3"><div className="flex items-start justify-end gap-1.5">
                        <button type="button" className={`dispatch-row-action ${item.isUncovered ? "is-primary" : item.hasOverdue ? "is-reassign" : ""}`} onClick={item.isUncovered ? assign : item.hasOverdue ? openRules : openCalendar}>{item.hasOverdue ? <Users size={13} aria-hidden="true" /> : <CalendarDays size={13} aria-hidden="true" />}{item.isUncovered ? "+ Giao lịch" : item.hasOverdue ? "Đổi BS" : "Xem lịch"}</button>
                        <details className="text-left"><summary aria-label={`Thao tác khác cho ${item.horse.horse_name}`} className="cursor-pointer list-none rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100">⋯</summary><div className="mt-2 flex min-w-28 flex-col gap-2 text-xs">
                          {!item.isUncovered && <button type="button" className="text-left text-slate-600 hover:text-blue-700" onClick={assign}>Giao lịch</button>}
                          {item.nearestSchedule && !item.hasOverdue && <button type="button" className="text-left text-slate-600 hover:text-blue-700" onClick={openRules}>Đổi BS</button>}
                          {item.hasOverdue && <button type="button" className="text-left text-slate-600 hover:text-blue-700" onClick={openCalendar}>Xem lịch</button>}
                        </div></details>
                      </div></td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          ) : (

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/70 text-[11px] font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Ngựa & Hạng mục</th>
                    <th className="px-4 py-3">Chu kỳ & Ngày đến hạn</th>
                    <th className="px-4 py-3">Bác sĩ phụ trách</th>
                    <th className="px-4 py-3">Trạng thái ca</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">Đang tải danh sách quy tắc...</td>
                    </tr>
                  ) : dispatchFilteredRules.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">Chưa có quy tắc chăm sóc nào khớp bộ lọc.</td>
                    </tr>
                  ) : (
                    dispatchFilteredRules.map((schedule) => {
                      const horseName = horses.find((horse) => horse.id === schedule.horse_id)?.horse_name ?? schedule.horse_name ?? "Ngựa";
                      const isOverdue = isScheduleOverdue(schedule);
                      const isCompletedOnce = !schedule.frequency_days && schedule.event_status === "Completed";
                      return (
                        <tr key={schedule.id} className={`transition-colors hover:bg-[#F4F6FA] ${isOverdue ? "bg-red-50/50" : ""}`}>
                          <td className="px-4 py-3">
                            <div className="font-bold text-slate-900">{horseName}</div>
                            <div className="text-[11px] font-semibold text-blue-800">{careTypeLabels[schedule.care_type] ?? schedule.care_type}</div>
                            {schedule.notes && <div className="mt-0.5 max-w-xs truncate text-[11px] text-slate-500">{schedule.notes}</div>}
                          </td>
                          <td className="px-4 py-3">
                            <div className={`font-bold ${isOverdue ? "text-red-700" : "text-slate-900"}`}>Hạn: {displayDate(schedule.next_due_date)}</div>
                            <div className="text-[11px] text-slate-600">
                              {schedule.frequency_days ? `Lặp mỗi ${schedule.frequency_days} ngày` : "Thực hiện 1 lần"}
                              {schedule.last_done_date ? ` · Gần nhất: ${displayDate(schedule.last_done_date)}` : ""}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-800 border border-slate-200">
                              <User size={12} className="text-equine-blue" />
                              {schedule.doctor_name ? schedule.doctor_name : "Chưa phân công"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                              isOverdue
                                ? "bg-red-50 text-red-800 border border-red-200"
                                : schedule.event_status === "Scheduled"
                                ? "bg-blue-100 text-blue-900 border border-blue-300"
                                : isCompletedOnce
                                ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                                : "bg-slate-200 text-slate-800"
                            }`}>
                              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
                              {isOverdue ? "Quá hạn" : schedule.event_status === "Scheduled" ? "Đã đặt ca" : isCompletedOnce ? "Đã hoàn thành" : "Chưa chốt ca"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                className="rounded-lg inline-flex items-center gap-1.5 bg-blue-50 px-2.5 py-1.5 text-[11px] font-bold text-blue-800 hover:bg-blue-100 border border-blue-200"
                                onClick={() => {
                                  setReassignTarget(schedule);
                                  setReassignDoctorId(schedule.assigned_doctor_id ? String(schedule.assigned_doctor_id) : "");
                                }}
                              >
                                Đổi BS
                              </button>
                              <details className="text-left"><summary aria-label="Thao tác khác" className="cursor-pointer list-none rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100">⋯</summary>
                              <button
                                type="button"
                                className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-semibold text-slate-800 hover:bg-slate-200 border border-slate-300"
                                onClick={() => {
                                  openCareCalendar(schedule.horse_id, schedule);
                                }}
                              >
                                Xem trên lịch →
                              </button>
                              </details>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
          </div>
        </div>
      </div>
    ) : (
      /* ===================================================================== */
      /* TRANG 2: XEM LỊCH TUẦN (viewMode === "care")                          */
      /* ===================================================================== */
      <div>
        {/* Optional Rules Drawer for regular Veterinarians */}
        {showRulesDrawer && (
          <div ref={rulesDrawerRef} tabIndex={-1} role="region" aria-label="Quy tắc định kỳ đang hoạt động" className="mb-4 rounded-xl border border-slate-300 bg-white p-4 shadow-xs focus:outline-none focus:ring-2 focus:ring-indigo-400">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900">Quy tắc định kỳ đang theo dõi ({activeRules.length})</h4>
              <button type="button" className="text-xs font-semibold text-slate-500 hover:text-slate-800" onClick={() => setShowRulesDrawer(false)}>Đóng ✕</button>
            </div>
            <div className="divide-y divide-slate-200 max-h-60 overflow-y-auto">
              {activeRules.length === 0 ? (
                <p className="py-3 text-xs text-slate-500">Chưa có quy tắc định kỳ nào.</p>
              ) : (
                [...activeRules].sort((a, b) => a.next_due_date.localeCompare(b.next_due_date)).map((schedule) => {
                  const horseName = horses.find((h) => h.id === schedule.horse_id)?.horse_name ?? schedule.horse_name ?? "Ngựa";
                  const isOverdue = isScheduleOverdue(schedule);
                  return (
                    <div key={schedule.id} className="flex items-center justify-between gap-2 py-2 text-xs">
                      <div>
                        <span className="font-bold text-slate-900">{horseName} · {careTypeLabels[schedule.care_type] ?? schedule.care_type}</span>
                        <span className="ml-2 text-slate-600">Hạn: {displayDate(schedule.next_due_date)} {schedule.doctor_name ? `· BS: ${schedule.doctor_name}` : ""}</span>
                      </div>
                      <button
                        type="button"
                        className={`rounded px-2 py-1 text-[11px] font-bold ${isOverdue ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-800"}`}
                        onClick={() => setWeekStart(mondayOfWeek(schedule.next_due_date))}
                      >
                        Đến tuần này
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Thống kê tuần (gọn) */}
        <div className="mb-4 grid grid-cols-2 items-stretch gap-2.5 lg:grid-cols-4">
          <StatTile tone="blue" label="Cần thực hiện" value={weeklyPendingCount} hint={`Tổng ${weeklyCareEvents.length} ca trong tuần`} />
          <StatTile tone="rose" highlight={weeklyOverdueCount > 0} label="Quá hạn" value={weeklyOverdueCount} hint="Đã qua giờ hẹn" />
          <StatTile tone="emerald" label="Đã hoàn thành" value={weeklyCompletedCount} suffix={weeklyCareEvents.length ? `/${weeklyCareEvents.length}` : undefined} hint="Đã ghi nhận kết quả" />
          <StatTile tone="indigo" label="Quy tắc đến hạn" value={weeklyDueRuleCount} tooltip="Chỉ tính lịch dự kiến chưa chốt ca. Số quy tắc đang hoạt động áp dụng cùng bộ lọc Ngựa/Bác sĩ với danh sách quy tắc."
            hint={weeklyDueRuleCount > 0 ? `Gần nhất: ${nearestDueDate?.slice(0, 10).split("-").reverse().slice(0, 2).join("/")}` : activeRules.length > 0 ? `${activeRules.length} quy tắc đang hoạt động` : "Chưa có quy tắc"}
            hintAction={activeRules.length === 0 ? <button type="button" className="font-semibold text-indigo-700 underline underline-offset-2" onClick={() => { setCreateHorseId(selectedHorse.id); setCreateOpen(true); }}>Tạo mới</button> : undefined} active={showRulesDrawer} onClick={activeRules.length === 0 ? undefined : () => {
            setShowRulesDrawer(true);
            if (showRulesDrawer) {
              rulesDrawerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
              rulesDrawerRef.current?.focus({ preventScroll: true });
            }
          }} />
        </div>

        {/* MAIN TIMETABLE CARD: "Thời khóa biểu tuần" */}
        <div className="care-calendar-card mb-6 rounded-xl border border-slate-300 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-slate-200 bg-white px-5 py-3.5">
            <div>
              <h3 className="text-base font-black text-slate-900">
                Lịch ca trong tuần
              </h3>
            </div>


            <div className="flex flex-wrap items-center gap-2.5 sm:ml-auto">
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${weeklyCareEvents.length ? "bg-blue-100 text-blue-900" : "bg-slate-100 text-slate-600"}`}>
                🩺 {weeklyCareEvents.length} ca y tế
              </span>
              <span className={`inline-flex items-center rounded-full border border-dashed px-3 py-1 text-xs font-bold ${weeklyProjectedEvents.length ? "border-indigo-300 bg-indigo-50 text-indigo-900" : "border-slate-300 bg-slate-100 text-slate-600"}`}>
                {weeklyProjectedEvents.length} lịch định kỳ dự kiến
              </span>
              {includeContext && (
                <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${weeklyTrainingEvents.length ? "border-violet-200 bg-violet-100 text-violet-900" : "border-slate-300 bg-slate-100 text-slate-600"}`}>
                  🐎 {weeklyTrainingEvents.length} lịch tập/đua
                </span>
              )}
            </div>
          </div>

          <div className="care-calendar-toolbar" role="region" aria-label="Thanh công cụ lịch ca">
            <div className="care-calendar-navigation">
                <button
                  type="button"
                  className={`inline-flex h-9 items-center gap-1 rounded-lg px-3.5 text-xs font-bold transition ${
                    weekStart === currentWeekStart
                      ? "border border-blue-400 bg-blue-50 text-blue-800 cursor-default disabled:opacity-100"
                      : "border border-slate-300 bg-white text-slate-800 hover:border-blue-400 hover:bg-blue-50"
                  }`}
                  disabled={weekStart === currentWeekStart}
                  onClick={() => setWeekStart(currentWeekStart)}
                >
                  Tuần hiện tại
                </button>
            <div className="care-calendar-week-picker" role="group" aria-label="Điều hướng tuần">
                <button
                  type="button"
                  aria-label="Tuần trước"
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                  onClick={() => setWeekStart(addCalendarDays(weekStart, -7))}
                  aria-keyshortcuts="ArrowLeft"
                  title="Tuần trước (←)"
                >
                  <ArrowLeft size={13} />
                </button>
              <div className="relative min-w-0">
                <select
                  value={weekStart}
                  title={weekOptions.find((option) => option.key === weekStart)?.fullLabel}
                  aria-label="Tuần đang xem"
                  onChange={(e) => setWeekStart(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-9 text-xs font-bold text-slate-950 shadow-xs transition hover:border-slate-400 focus:border-blue-600 focus:outline-none cursor-pointer"
                >
                  {weekOptions.map((opt) => (
                    <option key={opt.key} value={opt.key} className="text-slate-900 font-semibold">
                      {opt.fullLabel}
                    </option>
                  ))}
                </select>
                <CalendarDays className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-600" size={15} />
              </div>
                <button
                  type="button"
                  aria-label="Tuần sau"
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                  onClick={() => setWeekStart(addCalendarDays(weekStart, 7))}
                  aria-keyshortcuts="ArrowRight"
                  title="Tuần sau (→)"
                >
                  <ArrowRight size={13} />
                </button>
            </div>
            </div>
            <div className="care-calendar-filters">
              <label className="care-calendar-filter">
              <span className="text-[11px] font-semibold text-slate-500">Ngựa</span>
              <select
                value={horseFilter}
                onChange={(event) => setHorseFilter(event.target.value)}
                className="field-control h-9 w-full min-w-0 px-2.5 text-xs font-semibold text-slate-900 border-slate-300"
                aria-label="Lọc theo ngựa"
              >
                <option value="all">Tất cả ngựa ({horses.length})</option>
                {horses.map((horse) => <option key={horse.id} value={horse.id}>{horse.horse_name}</option>)}
              </select>
              </label>
              <label className="care-calendar-filter">
              <span className="text-[11px] font-semibold text-slate-500">Bác sĩ</span>
              <select
                value={scope}
                onChange={(event) => setScope(event.target.value as "mine" | "all")}
                className="field-control h-9 w-full min-w-0 px-2.5 text-xs font-semibold text-slate-900 border-slate-300"
                aria-label="Bác sĩ"
              >
                <option value="mine">{currentUser?.fullName ?? "Bác sĩ đang đăng nhập"} (tôi)</option>
                <option value="all">Tất cả bác sĩ</option>
              </select>
              </label>

              <div className="care-calendar-display-options" role="group" aria-label="Tùy chọn hiển thị">
              <label className="inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
                <input type="checkbox" role="switch" aria-label="Hiển thị lịch tập và đua" aria-checked={includeContext} checked={includeContext} onChange={(event) => setIncludeContext(event.target.checked)} className="peer sr-only" />
                <span aria-hidden="true" className="relative h-5 w-9 shrink-0 rounded-full bg-slate-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:bg-blue-600 peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 peer-focus-visible:ring-offset-2" />
                Hiển thị lịch tập và đua
              </label>
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-600">
              <ListFilter size={14} aria-hidden="true" />
              <input type="checkbox" role="switch" aria-label="Thu gọn ca trống" aria-checked={!showAllSlots} checked={!showAllSlots} onChange={(event) => setShowAllSlots(!event.target.checked)} className="peer sr-only" />
              <span aria-hidden="true" className="relative h-5 w-9 rounded-full bg-slate-300 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-blue-600 peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500" />
              Thu gọn ca trống
            </label>
              </div>
              {hasActiveFilters && <button type="button" className="h-9 shrink-0 rounded-lg px-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900" onClick={() => {
                setHorseFilter("all"); setScope("mine"); setIncludeContext(false);
              }}><X size={12} className="mr-1 inline" aria-hidden="true" />Xóa bộ lọc</button>}
            </div>
          </div>

      {loading ? (
        <div className="p-4">
          <PanelListSkeleton rows={4} label="Đang tải lịch trong tuần..." />
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
                              const isTrainingEvent = isTrainingCalendarEvent(event);
                              const isOverdue = isEventOverdue(event, schedule);
                              const isMyCareEvent = scope === "mine" || isAssignedDoctor(event, schedule, currentUser);
                              const canManage = !event.context && Boolean(scheduleId) && (isHeadVet || isMyCareEvent);
                              const canComplete = canManage && isMyCareEvent && event.status === "Scheduled" && event.event_date <= today();
                              const canBook = canManage && (Boolean(event.is_periodic_due) || isCancelled || schedule?.event_status === "Cancelled");
                              const hasBookedEvent = !event.is_periodic_due && event.status === "Scheduled";
                              const horse = horses.find((h) => h.id === (event.horse?.id ?? event.horse_id) || h.id === schedule?.horse_id);
                              const horseName = horse?.horse_name ?? event.horse?.horse_name ?? event.horse_name ?? "Ngựa";
                              const rawName = event.care_type ?? event.session_type ?? event.event_type ?? event.title ?? "Chăm sóc";
                              const eventName = careTypeLabels[rawName] ?? rawName;
                              const stallSection = horse?.stable_box?.section ?? event.section;
                              const stallBoxCode = horse?.stable_box?.box_code ?? event.box_code;
                              const horseLocation = stallBoxCode
                                ? `Khu ${stallSection ?? "A"} · Chuồng ${stallBoxCode}`
                                : isTrainingEvent
                                ? "Sân tập CLB"
                                : "Khu chuồng trại · Ô khám";
                              const timeStr = formatTimeDisplay(event.start_time, event.end_time);
                              const doctorName = isTrainingEvent
                                ? (event.groom_name ? `Groom: ${event.groom_name}` : "Ban huấn luyện")
                                : formatDoctorName(event, schedule, currentUser);
                              const surfaceVi = event.track_surface === "Turf" ? "Sân cỏ" : event.track_surface === "Synthetic" ? "Sân nhân tạo" : event.track_surface === "Dirt" ? "Sân đất" : null;
                              const trainingSubLabel = [
                                surfaceVi,
                                event.target_distance_meters ? `${Number(event.target_distance_meters).toLocaleString("vi-VN")}m` : null,
                              ].filter(Boolean).join(" · ") || "Sân tập";
                              const currentSlotObj = TIMETABLE_SLOTS.find((s) => s.id === getEventSlot(event)) ?? TIMETABLE_SLOTS[0];
                              const defaultSlotValue = `${currentSlotObj.startTime}|${currentSlotObj.endTime}`;

                              if (event.is_periodic_due) return (
                                <button
                                  key={event.id}
                                  data-notification-target={event.horse?.id ?? event.horse_id}
                                  type="button"
                                  data-care-projection
                                  aria-label={`Dự kiến: ${eventName} - ${horseName}, ngày ${formatDayMonth(event.event_date)}, ca ${currentSlotObj.id}`}
                                  className={`w-full rounded-lg border-2 border-dashed border-indigo-300 bg-indigo-50/70 p-2.5 text-left text-indigo-950 transition hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 `}
                                  onClick={() => { setError(""); setProjectionTarget(event); }}
                                  disabled={!canManage || busy}
                                  title={!canManage ? "Chỉ bác sĩ phụ trách hoặc trưởng ban thú y được chốt ca" : "Xác nhận tạo ca chăm sóc"}
                                >
                                  <span className="mb-1 inline-block rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold">Dự kiến</span>
                                  <span className="block text-xs font-bold">{eventName} - {horseName}</span>
                                  <span className="mt-1 block text-[11px]">{timeStr} · {doctorName}</span>
                                  <span className="mt-1 block text-[10px]">{canManage ? "Nhấn để tạo ca thực tế" : "Chờ bác sĩ phụ trách chốt ca"}</span>
                                </button>
                              );

                              return (
                                <article
                                  data-notification-target={event.horse?.id ?? event.horse_id}
                                  key={event.event_id ?? event.id ?? `${day.date}-${index}`}
                                  className={`rounded-lg p-2.5 shadow-xs transition hover:shadow-md ${
                                    isTrainingEvent
                                      ? "border border-violet-300 bg-violet-50/90"
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
                                    <div className={`flex items-start gap-1 font-bold break-words leading-tight text-xs ${isOverdue ? "text-rose-950 font-black" : isTrainingEvent ? "text-violet-950 font-black" : "text-[#0A389C]"}`}>
                                      {isOverdue ? (
                                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-600 mt-0.5" />
                                      ) : (
                                        <BookOpen className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${isTrainingEvent ? "text-violet-700" : "text-[#0A389C]"}`} />
                                      )}
                                      <span>{isTrainingEvent ? `🐎 ${eventName} - ${horseName}` : `${eventName} - ${horseName}`}</span>
                                    </div>
                                    {isCompleted && !isTrainingEvent && (
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
                                    {isTrainingEvent && (
                                      <span className={`inline-flex shrink-0 items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-black shadow-2xs ${
                                        isCompleted ? "bg-emerald-600 text-white" : "bg-violet-600 text-white"
                                      }`}>
                                        {isCompleted ? "Tập · Đã xong" : "Lịch tập"}
                                      </span>
                                    )}
                                  </div>

                                  {/* Time */}
                                  <div className={`mt-1.5 flex items-center gap-1.5 text-[11px] font-bold ${isOverdue ? "text-rose-900 font-extrabold" : isTrainingEvent ? "text-violet-900 font-extrabold" : "text-amber-900"}`}>
                                    <Clock className={`h-3 w-3 shrink-0 ${isOverdue ? "text-rose-600" : isTrainingEvent ? "text-violet-700" : "text-amber-700"}`} />
                                    <span>{timeStr}</span>
                                    <span className="text-slate-400">·</span>
                                    <span className={isOverdue ? "text-rose-700 font-bold" : "text-slate-700 font-semibold"}>
                                      {isTrainingEvent ? trainingSubLabel : isOverdue ? "Đã quá ca" : "Trực tiếp"}
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
                                              {isHeadVet && (
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
                                              )}
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
                                            <>
                                              {(event.care_type === "MedicalCheckup" || schedule?.care_type === "MedicalCheckup") && (
                                                <button
                                                  type="button"
                                                  className="rounded bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-indigo-700 shadow-xs flex items-center gap-1"
                                                  onClick={() => onGoToExam?.(event.horse?.id ? String(event.horse.id) : undefined, scheduleId)}
                                                  title="Chuyển sang tab Khám bệnh để ghi nhận sinh hiệu và kết quả khám"
                                                >
                                                  <Stethoscope size={10} /> Vào khám
                                                </button>
                                              )}
                                              <button
                                                type="button"
                                                className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-950 hover:bg-emerald-200 border border-emerald-300"
                                                onClick={() => { setCompleteId(completeId === scheduleId ? "" : scheduleId); setBookId(""); setMoveId(""); }}
                                              >
                                                Hoàn thành
                                              </button>
                                            </>
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
                                  {isHeadVet && scheduleId && moveId === scheduleId && (
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
                                      {(event.care_type === "MedicalCheckup" || schedule?.care_type === "MedicalCheckup") && (
                                        <div className="rounded-md border border-indigo-200 bg-indigo-100/70 p-2 text-[11px] text-indigo-950">
                                          <p className="font-bold flex items-center gap-1 text-indigo-900">
                                            <Stethoscope size={12} className="text-indigo-600" />
                                            Đây là ca khám lâm sàng
                                          </p>
                                          <p className="mt-0.5 text-[10px] text-indigo-800">
                                            Bạn có thể vào tab Khám bệnh để nhập sinh hiệu. Khi lưu, ca này sẽ tự động được hoàn thành.
                                          </p>
                                          <button
                                            type="button"
                                            className="mt-1.5 flex items-center justify-center gap-1 w-full rounded bg-indigo-600 py-1 text-[10px] font-bold text-white hover:bg-indigo-700 shadow-xs"
                                            onClick={() => onGoToExam?.(event.horse?.id ? String(event.horse.id) : undefined, scheduleId)}
                                          >
                                            <Stethoscope size={11} /> Mở tab Khám bệnh để điền hồ sơ
                                          </button>
                                        </div>
                                      )}
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
      </div>
    )}
  </SectionCard>;
}
