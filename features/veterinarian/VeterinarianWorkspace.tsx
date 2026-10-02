"use client";

import {
  Activity,
  AlertTriangle,
  Bell,
  CalendarDays,
  Check,
  ClipboardCheck,
  FileHeart,
  HeartPulse,
  LockKeyhole,
  Pill,
  RefreshCw,
  Search,
  ShieldAlert,
  Stethoscope,
  UnlockKeyhole,
  Utensils,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { HorseImage, Notice } from "@/features/horses/HorseUI";
import IncidentPhoto from "@/features/groom/IncidentPhoto";
import type { Horse } from "@/features/horses/api";
import { useDashboardTab } from "@/shared/hooks/use-dashboard-tab";
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
} from "@/features/veterinarian/api";

type WorkspaceTab = "overview" | "exams" | "medical" | "diet" | "injuries" | "care" | "incidents" | "notifications";
const workspaceTabIds: readonly WorkspaceTab[] = ["overview", "exams", "medical", "diet", "injuries", "care", "incidents", "notifications"];

const tabs: { id: WorkspaceTab; label: string; icon: typeof Activity }[] = [
  { id: "overview", label: "Sức khỏe", icon: HeartPulse },
  { id: "exams", label: "Khám bệnh", icon: Stethoscope },
  { id: "medical", label: "Chẩn đoán & thuốc", icon: FileHeart },
  { id: "diet", label: "Khẩu phần", icon: Utensils },
  { id: "injuries", label: "Chấn thương", icon: Activity },
  { id: "care", label: "Lịch chăm sóc", icon: CalendarDays },
  { id: "incidents", label: "Báo cáo Groom", icon: AlertTriangle },
  { id: "notifications", label: "Thông báo", icon: Bell },
];

const statusLabels: Record<string, string> = {
  Healthy: "Khỏe mạnh",
  Monitoring: "Cần theo dõi",
  Injured: "Chấn thương",
  Quarantine: "Cách ly",
};

export default function VeterinarianWorkspace() {
  const [overview, setOverview] = useState<HealthOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [section, setSection] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [tab, selectTab] = useDashboardTab(workspaceTabIds, "overview");
  const [notice, setNotice] = useState("");
  const [unread, setUnread] = useState(0);

  const loadOverview = useCallback(async (nextSection = section) => {
    setLoading(true);
    setError("");
    try {
      const result = await veterinarianApi.overview(nextSection || undefined);
      setOverview(result);
      setSelectedId((current) => result.horses.some((horse) => horse.id === current)
        ? current
        : result.horses[0]?.id ?? "");
    } catch (reason) {
      setError(veterinarianError(reason));
    } finally {
      setLoading(false);
    }
  }, [section]);

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
    void loadUnread();
    const timer = window.setInterval(() => void loadUnread(), 60_000);
    return () => window.clearInterval(timer);
  }, [loadUnread]);

  const horses = useMemo(() => overview?.horses ?? [], [overview]);
  const horse = horses.find((item) => item.id === selectedId) ?? null;
  const sections = useMemo(() => [...new Set(horses.map((item) => item.stable_box?.section).filter((item): item is string => Boolean(item)))].sort(), [horses]);
  const stableGroups = useMemo(() => {
    const groups = new Map<string, VetHorse[]>();
    for (const item of horses) {
      const location = item.stable_box ? `Khu ${item.stable_box.section} · Chuồng ${item.stable_box.box_code}` : "Chưa xếp chuồng";
      groups.set(location, [...(groups.get(location) ?? []), item]);
    }
    return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right, "vi"));
  }, [horses]);
  const visibleHorses = horses.filter((item) => item.horse_name.toLocaleLowerCase("vi").includes(search.trim().toLocaleLowerCase("vi")));

  function changed(message: string) {
    setNotice(message);
    void loadOverview();
    void loadUnread();
  }

  return (
    <section className="dashboard-workspace" aria-labelledby="vet-page-title">
      <div className="flex flex-col gap-4 border-b border-equine-line pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Veterinarian · Hồ sơ y tế & lịch chăm sóc</p>
          <h1 id="vet-page-title" className="mt-2 font-sans text-3xl font-semibold text-equine-navy">Bảng điều khiển bác sĩ thú y</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Theo dõi sức khỏe toàn đàn, ghi nhận khám bệnh và quản lý các lịch chăm sóc định kỳ.</p>
        </div>
        <button type="button" className="soft-button h-10 px-4 text-equine-navy" onClick={() => { void loadOverview(); void loadUnread(); }}><RefreshCw size={15} /> Làm mới</button>
      </div>

      {error && <div className="mt-5"><Notice error>{error}</Notice></div>}
      {notice && <div className="mt-5"><Notice>{notice}</Notice></div>}

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(["Healthy", "Monitoring", "Injured", "Quarantine"] as const).map((status) => (
          <article key={status} className="rounded-2xl border border-equine-line bg-white p-4 shadow-sm sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{statusLabels[status]}</p>
            <p className="mt-2 font-sans text-3xl font-semibold text-equine-navy">{overview?.counts[status] ?? "—"}</p>
          </article>
        ))}
      </div>

      <section className="mt-4 rounded-2xl border border-equine-line bg-white p-4 shadow-sm sm:p-5" aria-label="Sơ đồ sức khỏe chuồng trại">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2"><div><h2 className="font-sans text-lg font-semibold text-equine-navy">Sơ đồ trạng thái chuồng trại</h2><p className="text-xs text-slate-500">Chọn ô chuồng để mở hồ sơ sức khỏe tương ứng.</p></div><span className="text-xs text-slate-500">{horses.length} ngựa · {stableGroups.length} vị trí</span></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">{stableGroups.map(([location, occupants]) => <div key={location} className="rounded-xl border border-equine-line bg-[#f8fafc] p-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{location}</p>
          <div className="space-y-2">{occupants.map((item) => <button type="button" key={item.id} onClick={() => { setSelectedId(item.id); selectTab("overview"); }} aria-pressed={item.id === selectedId} className={`flex w-full items-center justify-between gap-2 rounded-lg border p-2 text-left text-sm ${item.id === selectedId ? "border-equine-gold bg-[#fffaf2]" : "border-equine-line bg-white"}`}>
            <span className="truncate font-semibold text-equine-navy">{item.horse_name}{item.is_training_locked ? " · Khóa" : ""}</span>
            <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${item.current_status === "Injured" || item.current_status === "Quarantine" ? "bg-rose-100 text-rose-800" : item.current_status === "Monitoring" ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-800"}`}>{statusLabels[item.current_status] ?? item.current_status}</span>
          </button>)}</div>
        </div>)}</div>
      </section>

      <div className="mt-6 grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="h-fit rounded-2xl border border-equine-line bg-white p-4 shadow-sm xl:sticky xl:top-4">
          <div className="flex items-center justify-between gap-3">
            <div><h2 className="font-sans text-lg font-semibold text-equine-navy">Đàn ngựa</h2><p className="text-xs text-slate-500">{horses.length} hồ sơ đang hoạt động</p></div>
            <label className="sr-only" htmlFor="vet-section">Lọc khu chuồng</label>
            <select id="vet-section" value={section} onChange={(event) => setSection(event.target.value)} className="field-control h-10 max-w-28 px-2 text-xs">
              <option value="">Tất cả khu</option>{sections.map((item) => <option key={item} value={item}>Khu {item}</option>)}
            </select>
          </div>
          <label className="mt-4 flex items-center gap-2 rounded-xl border border-equine-line bg-[#f7f9ff] px-3 py-2.5"><Search size={15} className="text-slate-500" /><span className="sr-only">Tìm ngựa</span><input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full border-0 bg-transparent text-sm outline-none" placeholder="Tìm tên ngựa..." /></label>
          <div className="mt-4 max-h-[65vh] space-y-2 overflow-y-auto pr-1">
            {loading && !overview ? <Notice>Đang tải đàn ngựa...</Notice> : visibleHorses.length === 0 ? <Notice>Không có ngựa phù hợp.</Notice> : visibleHorses.map((item) => <HorseChoice key={item.id} horse={item} selected={item.id === selectedId} onClick={() => { setSelectedId(item.id); setNotice(""); }} />)}
          </div>
        </aside>

        <div className="min-w-0">
          {horse && <>
            <HorseSummary horse={horse} />
            <div className="mt-4 flex gap-2 overflow-x-auto border-b border-equine-line pb-2" role="tablist" aria-label="Chức năng bác sĩ thú y">
              {tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" role="tab" aria-selected={tab === id} className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${tab === id ? "bg-equine-navy text-white" : "bg-white text-slate-600 hover:bg-equine-mist"}`} onClick={() => { selectTab(id); setNotice(""); }}><Icon size={15} />{label}{id === "notifications" && unread > 0 && <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] text-rose-700">{unread}</span>}</button>)}
            </div>
            <div className="mt-4">
              {tab === "overview" && <HorseStatusPanel horse={horse} onChanged={changed} />}
              {tab === "exams" && <ExamsPanel horse={horse} onChanged={(message) => { setNotice(message); void loadOverview(); }} />}
              {tab === "medical" && <MedicalPanel horse={horse} onChanged={setNotice} />}
              {tab === "diet" && <DietPanel horse={horse} onChanged={setNotice} />}
              {tab === "injuries" && <InjuriesPanel horse={horse} onChanged={setNotice} />}
              {tab === "care" && <CarePanel horses={horses} selectedHorse={horse} onChanged={(message) => { setNotice(message); void loadUnread(); }} />}
              {tab === "incidents" && <StableIncidentsPanel onOpenHorse={(id) => { setSelectedId(id); selectTab("overview"); }} />}
              {tab === "notifications" && <NotificationsPanel onUnread={setUnread} />}
            </div>
          </>}
          {!horse && !loading && <div className="rounded-2xl border border-equine-line bg-white p-6"><Notice>Chưa có ngựa đang hoạt động để quản lý sức khỏe.</Notice></div>}
        </div>
      </div>
    </section>
  );
}

function HorseChoice({ horse, selected, onClick }: { horse: VetHorse; selected: boolean; onClick: () => void }) {
  const statusClass = horse.current_status === "Injured" || horse.current_status === "Quarantine" ? "border-rose-200 bg-rose-50" : horse.current_status === "Monitoring" ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50";
  return <button type="button" onClick={onClick} aria-pressed={selected} className={`w-full rounded-xl border p-3 text-left transition ${selected ? "border-equine-gold bg-[#fffaf2] shadow-sm" : "border-equine-line hover:bg-slate-50"}`}>
    <div className="flex items-center gap-3"><div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-equine-mist"><HorseImage horse={horse as unknown as Horse} /></div><div className="min-w-0 flex-1"><p className="truncate font-semibold text-equine-navy">{horse.horse_name}</p><p className="truncate text-xs text-slate-500">{horse.stable_box ? `${horse.stable_box.box_code} · Khu ${horse.stable_box.section}` : "Chưa xếp chuồng"}</p></div><span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${statusClass}`}>{statusLabels[horse.current_status] ?? horse.current_status}</span></div>
    {horse.is_training_locked && <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-rose-700"><LockKeyhole size={12} /> Đang khóa huấn luyện</p>}
  </button>;
}

function HorseSummary({ horse }: { horse: VetHorse }) {
  return <article className="flex flex-col gap-4 rounded-2xl border border-equine-line bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:p-5">
    <div className="h-24 w-28 shrink-0 overflow-hidden rounded-xl bg-equine-mist"><HorseImage horse={horse as unknown as Horse} /></div>
    <div className="min-w-0 flex-1"><p className="eyebrow">Hồ sơ sức khỏe</p><h2 className="mt-1 font-sans text-2xl font-semibold text-equine-navy">{horse.horse_name}</h2><p className="mt-1 text-sm text-slate-600">{horse.stable_box ? `Chuồng ${horse.stable_box.box_code} · Khu ${horse.stable_box.section}` : "Chưa gán chuồng"} · {statusLabels[horse.current_status] ?? horse.current_status}</p></div>
    {horse.is_training_locked && <div className={`rounded-xl border px-3 py-2 text-sm ${horse.lock_level === "Critical" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}><p className="flex items-center gap-2 font-bold"><LockKeyhole size={15} /> Khóa {horse.lock_level}</p><p className="mt-1 max-w-sm text-xs">{horse.lock_reason}</p></div>}
  </article>;
}

function SectionCard({ title, description, icon: Icon, children, action }: { title: string; description?: string; icon: typeof Activity; children: ReactNode; action?: ReactNode }) {
  return <section className="rounded-2xl border border-equine-line bg-white p-4 shadow-sm sm:p-5"><div className="mb-4 flex flex-col gap-3 border-b border-equine-line pb-4 sm:flex-row sm:items-start sm:justify-between"><div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-equine-mist text-equine-navy"><Icon size={19} /></span><div><h3 className="font-sans text-lg font-semibold text-equine-navy">{title}</h3>{description && <p className="mt-1 text-sm text-slate-500">{description}</p>}</div></div>{action}</div>{children}</section>;
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
    try { const status = String(values.current_status); const result = await veterinarianApi.updateHealthStatus(horse.id, status, String(values.readiness_status), String(values.note ?? "")); setSuggestLock(["Injured", "Quarantine"].includes(status)); setSessions(result.upcoming_sessions ?? []); onChanged(result.is_training_locked && ["Injured", "Quarantine"].includes(status) ? "Đã cập nhật trạng thái và tự động khóa huấn luyện." : "Đã cập nhật trạng thái sức khỏe và sẵn sàng thi đấu."); }
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
    {detail && <div className="mb-5 rounded-xl border border-equine-gold/40 bg-[#fffdf8] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="font-semibold text-equine-navy">Chi tiết lần khám</h4><p className="text-sm text-slate-500">{displayDate(detail.exam_date)} · {detail.doctor?.name ?? "Bác sĩ"}</p>{detail.last_edited_at && <p className="mt-1 text-xs text-slate-500">Sửa gần nhất: {displayDate(detail.last_edited_at)} · {detail.last_edited_by?.name ?? "Bác sĩ"}</p>}</div><button type="button" className="soft-button h-9 px-3" onClick={() => setEditing((value) => !value)}> {editing ? "Đóng chỉnh sửa" : "Chỉnh sửa"}</button></div>
      {editing ? <div className="mt-4"><ExamForm initial={detail} editing busy={busy} onSubmit={save} onCancel={() => setEditing(false)} /></div> : <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{[...examFields, ...examLongFields].map((field) => { const value = detail[field.name as keyof HealthExam]; return value === undefined || value === null || value === "" ? null : <p key={field.name} className="rounded-lg bg-white px-3 py-2 text-sm"><span className="block text-xs text-slate-500">{field.label}</span><span className="whitespace-pre-wrap font-medium text-slate-800">{String(value)}</span></p>; })}</div>}
      <div className="mt-4 border-t border-equine-line pt-3"><p className="mb-2 flex items-center gap-2 text-sm font-semibold text-equine-navy"><ClipboardCheck size={15} /> Lịch sử sửa ({logs.length})</p>{logs.length === 0 ? <p className="text-xs text-slate-500">Hồ sơ chưa có lần chỉnh sửa.</p> : <div className="space-y-2">{logs.map((log) => <div key={log.id} className="rounded-lg bg-white p-3 text-xs"><p className="font-semibold">{log.edited_by?.name ?? "Bác sĩ"} · {displayDate(log.edited_at)}</p><ul className="mt-1 space-y-1">{log.changes.map((change) => <li key={change.field}>{change.field}: {String(change.old_value ?? "—")} → {String(change.new_value ?? "—")}</li>)}</ul></div>)}</div>}</div>
    </div>}
    {loading && response.data.length === 0 ? <Notice>Đang tải lịch sử khám...</Notice> : error ? null : response.data.length === 0 ? <Empty>Chưa có hồ sơ khám. Hãy tạo lần khám đầu tiên.</Empty> : <div className="space-y-2">{response.data.map((exam) => <button key={exam.id} type="button" onClick={() => void openExam(exam.id)} className="flex w-full flex-col gap-2 rounded-xl border border-equine-line p-3 text-left hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-equine-navy">{displayDate(exam.exam_date)}</p><p className="text-xs text-slate-500">{exam.doctor?.name ?? "Bác sĩ"}{exam.has_edits ? " · Đã chỉnh sửa" : ""}</p></div><div className="flex gap-3 text-sm"><span>{exam.temperature_c ?? "—"} °C</span><span>{exam.heart_rate ?? "—"} bpm</span><span>{exam.respiratory_rate ?? "—"} lần/phút</span></div></button>)}</div>}
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
      const result = await veterinarianApi.createInjury(horse.id, values);
      setCreating(false); setAssessmentFor(null); setSuggestLock(Boolean(result.training_locked)); await load();
      onChanged(result.training_locked ? "Đã lưu đánh giá. Ngựa được chuyển sang Chấn thương và khóa lịch huấn luyện." : "Đã lưu đánh giá chấn thương.");
    } catch (reason) { setError(veterinarianError(reason)); }
    finally { setBusy(false); }
  }

  return <SectionCard title="Chấn thương & phục hồi" description="Đánh dấu từng lần đánh giá mới. Hồ sơ cũ được giữ nguyên làm lịch sử." icon={Activity} action={<button type="button" className="gold-button h-10 px-3" onClick={() => { setAssessmentFor(null); setCreating((value) => !value); setSuggestLock(false); }}>+ Đánh dấu</button>}>
    <ErrorLine>{error}</ErrorLine>
    {!creating && latestByBodyPart.some((marker) => marker.recovery_status !== "Recovered") && <div className="mb-4 flex flex-wrap gap-2">{latestByBodyPart.filter((marker) => marker.recovery_status !== "Recovered").map((marker) => <button key={marker.id} type="button" className="soft-button h-9 px-3 text-xs" onClick={() => { setAssessmentFor(marker); setCreating(false); }}>{marker.body_part}: đánh giá phục hồi</button>)}</div>}
    {assessmentFor && <form key={assessmentFor.id} onSubmit={(event) => void create(event)} className="mb-4 grid gap-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4 sm:grid-cols-2"><h4 className="font-semibold text-equine-navy sm:col-span-2">Đánh giá phục hồi · bản ghi mới, giữ nguyên lịch sử</h4><Field label="Vị trí cơ thể" name="body_part" required maxLength={50} defaultValue={assessmentFor.body_part} /><SelectField label="Mức độ" name="severity" required defaultValue={assessmentFor.severity} options={[{ value: "Mild", label: "Nhẹ · Mild" }, { value: "Moderate", label: "Vừa · Moderate" }, { value: "Severe", label: "Nặng · Severe" }]} /><SelectField label="Tình trạng phục hồi" name="recovery_status" defaultValue={assessmentFor.recovery_status === "Active" ? "Recovering" : "Recovered"} options={[{ value: "Active", label: "Đang chấn thương" }, { value: "Recovering", label: "Đang hồi phục" }, { value: "Recovered", label: "Đã hồi phục" }]} /><label className="block sm:col-span-2"><span className="field-label">Chẩn đoán liên quan</span><select name="medical_record_id" defaultValue={assessmentFor.medical_record_id ?? ""} className="field-control px-3"><option value="">Không gắn chẩn đoán</option>{records.map((record) => <option key={record.id} value={record.id}>{record.diagnosis}</option>)}</select></label><div className="grid grid-cols-3 gap-2 sm:col-span-2"><Field label="X" name="coordinate_x" type="number" step="0.001" defaultValue={assessmentFor.coordinate_x} /><Field label="Y" name="coordinate_y" type="number" step="0.001" defaultValue={assessmentFor.coordinate_y} /><Field label="Z" name="coordinate_z" type="number" step="0.001" defaultValue={assessmentFor.coordinate_z} /></div><div className="sm:col-span-2"><TextAreaField label="Mô tả" name="description" rows={3} defaultValue={assessmentFor.description} /></div><div className="flex gap-2 sm:col-span-2"><button className="gold-button h-10" disabled={busy}>Lưu đánh giá phục hồi</button><button type="button" className="soft-button h-10 px-3" onClick={() => setAssessmentFor(null)}>Hủy</button></div></form>}
    <label className="mb-4 inline-flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={latestOnly} onChange={(event) => setLatestOnly(event.target.checked)} /> Chỉ điểm mới nhất của mỗi vị trí</label>
    {creating && <form onSubmit={(event) => void create(event)} className="mb-4 grid gap-3 rounded-xl border border-equine-line bg-slate-50 p-4 sm:grid-cols-2"><h4 className="font-semibold text-equine-navy sm:col-span-2">Đánh giá chấn thương mới</h4><Field label="Vị trí cơ thể" name="body_part" required maxLength={50} placeholder="Ví dụ: Chân trước trái" /><SelectField label="Mức độ" name="severity" required options={[{ value: "Mild", label: "Nhẹ · Mild" }, { value: "Moderate", label: "Vừa · Moderate" }, { value: "Severe", label: "Nặng · Severe" }]} /><SelectField label="Tình trạng phục hồi" name="recovery_status" options={[{ value: "Active", label: "Đang chấn thương" }, { value: "Recovering", label: "Đang hồi phục" }, { value: "Recovered", label: "Đã hồi phục" }]} /><label className="block sm:col-span-2"><span className="field-label">Chẩn đoán liên quan</span><select name="medical_record_id" defaultValue="" className="field-control px-3"><option value="">Không gắn chẩn đoán</option>{records.map((record) => <option key={record.id} value={record.id}>{record.diagnosis}</option>)}</select></label><p className="text-xs text-slate-500 sm:col-span-2">Tọa độ X/Y cần nhập cùng nhau; Z không bắt buộc cho sơ đồ 2D.</p><div className="grid grid-cols-3 gap-2 sm:col-span-2"><Field label="X" name="coordinate_x" type="number" step="0.001" min={-999.999} max={999.999} /><Field label="Y" name="coordinate_y" type="number" step="0.001" min={-999.999} max={999.999} /><Field label="Z" name="coordinate_z" type="number" step="0.001" min={-999.999} max={999.999} /></div><div className="sm:col-span-2"><TextAreaField label="Mô tả" name="description" rows={3} /></div><div className="flex gap-2 sm:col-span-2"><button className="gold-button h-10" disabled={busy}>Lưu đánh giá</button><button type="button" className="soft-button h-10 px-3" onClick={() => setCreating(false)}>Hủy</button></div></form>}
    {suggestLock && <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle size={15} className="mr-1 inline" />Ngựa đã chuyển sang trạng thái Chấn thương, sẵn sàng thi đấu bị đặt thành Chưa sẵn sàng và lịch tập đã khóa.</p>}
    {loading ? <Notice>Đang tải điểm chấn thương...</Notice> : error.includes("Điểm chấn thương:") ? null : markers.length === 0 ? <Empty>Chưa có đánh giá chấn thương.</Empty> : <><InjuryModel markers={markers} /><div className="mt-4 space-y-3">{markers.map((marker) => <article key={marker.id} className={`rounded-xl border p-4 ${marker.recovery_status === "Recovered" ? "border-emerald-200 bg-emerald-50/60" : marker.severity === "Severe" ? "border-rose-200 bg-rose-50/50" : "border-equine-line"}`}><div className="flex flex-wrap items-start justify-between gap-2"><div><h4 className="font-semibold text-equine-navy">{marker.body_part}</h4><p className="mt-1 text-xs text-slate-500">{displayDate(marker.marked_at)} · {marker.coordinate_x == null ? "Chưa đặt tọa độ" : `X ${marker.coordinate_x}, Y ${marker.coordinate_y}${marker.coordinate_z == null ? "" : `, Z ${marker.coordinate_z}`}`}</p></div><div className="flex gap-2"><span className="rounded-full bg-white px-2 py-1 text-xs font-semibold">{marker.severity}</span><span className="rounded-full bg-white px-2 py-1 text-xs font-semibold">{marker.recovery_status}</span></div></div>{marker.description && <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{marker.description}</p>}</article>)}</div></>}
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
function InjuryModel({ markers }: { markers: InjuryMarker[] }) {
  const located = markers.filter((marker) => marker.coordinate_x != null && marker.coordinate_y != null);
  const [selected, setSelected] = useState<string | null>(null);
  const [angle, setAngle] = useState(-10);
  const selectedMarker = located.find((marker) => marker.id === selected);
  const project = (raw: number | string | null, center: number, span: number) => {
    const value = Math.max(-1, Math.min(1, Number(raw ?? 0)));
    return center + value * span;
  };
  const markerColor = (marker: InjuryMarker) => marker.recovery_status === "Recovered" ? "#059669" : marker.severity === "Severe" ? "#e11d48" : marker.severity === "Moderate" ? "#d97706" : "#2563eb";

  return <section className="rounded-2xl border border-equine-line bg-gradient-to-br from-slate-50 to-blue-50/50 p-3 sm:p-5" aria-label="Sơ đồ minh họa vị trí chấn thương">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h4 className="font-semibold text-equine-navy">Sơ đồ minh họa 2D · vị trí chấn thương</h4><p className="text-xs text-slate-500">X dọc thân · Y cao độ; Z chỉ tạo độ lệch hiển thị trên sơ đồ.</p></div><div className="flex gap-1"><button type="button" className="soft-button h-8 px-2 text-xs" onClick={() => setAngle((value) => Math.max(-30, value - 10))}>Xoay sơ đồ trái</button><button type="button" className="soft-button h-8 px-2 text-xs" onClick={() => setAngle((value) => Math.min(30, value + 10))}>Xoay sơ đồ phải</button></div></div>
    <div className="mt-3 overflow-hidden rounded-xl border border-blue-100 bg-white p-2">
      <svg viewBox="0 0 720 330" role="img" aria-label="Hình ngựa minh họa 2D cùng các vị trí chấn thương" className="mx-auto h-auto w-full max-w-3xl" style={{ transform: `rotate(${angle / 6}deg)`, transition: "transform 250ms ease" }}>
        <defs><linearGradient id="horse-coat" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#c99c68"/><stop offset="1" stopColor="#80603e"/></linearGradient></defs>
        <ellipse cx="355" cy="273" rx="280" ry="22" fill="#e2e8f0"/>
        <g opacity=".28" transform="translate(0,-13)" fill="#b8c9d7" stroke="#8297a8" strokeWidth="3">
          <path d="M186 120 C207 84 265 77 328 87 C374 92 411 107 443 111 L475 82 L510 64 L546 70 L565 92 L541 111 L511 105 L481 145 L448 183 C418 197 382 202 342 202 L224 197 C195 180 178 151 186 120Z"/>
          <path d="M222 177 L213 225 L202 269 L217 272 L242 231 L259 191 M281 195 L287 230 L277 270 L294 272 L317 226 L315 195 M385 194 L378 229 L371 270 L388 272 L410 228 L419 188 M433 176 L449 215 L451 267 L468 270 L478 220 L465 170"/>
          <path d="M188 113 Q151 92 136 119 Q150 126 180 136"/>
        </g>
        <g fill="url(#horse-coat)" stroke="#634b32" strokeWidth="4" strokeLinejoin="round">
          <path d="M181 115 C205 82 265 73 330 84 C374 89 411 104 443 109 L473 80 L509 61 L546 68 L566 91 L540 108 L511 102 L481 143 L448 179 C416 194 380 198 341 198 L225 193 C194 177 176 148 181 115Z"/>
          <path d="M221 174 L211 224 L200 268 L217 271 L242 229 L258 190 M282 192 L288 229 L278 269 L295 271 L317 225 L315 192 M384 190 L378 228 L370 269 L388 271 L410 226 L419 184 M434 173 L451 214 L452 267 L469 269 L478 219 L464 168"/>
          <path d="M184 112 Q151 91 132 115 Q145 126 180 137" fill="none"/>
          <path d="M469 82 Q452 57 459 45 L477 67 M493 68 Q494 45 509 40 L512 70" fill="#594736"/>
          <path d="M423 101 Q440 72 464 67 L452 110 L431 126Z" fill="#392f27"/>
        </g>
        <path d="M203 109 C258 83 331 87 394 110 M224 140 C290 124 365 126 438 141 M220 169 C294 155 369 163 438 168 M337 89 L333 195 M390 101 L388 193" fill="none" stroke="#efd9b6" strokeDasharray="5 8" strokeWidth="2" opacity=".78"/>
        <circle cx="535" cy="86" r="4" fill="#1e293b"/>
        {located.map((marker) => {
          const z = Math.max(-1, Math.min(1, Number(marker.coordinate_z ?? 0)));
          const x = project(marker.coordinate_x, 355, 190) + z * 32;
          const y = project(marker.coordinate_y, 159, -83) - z * 22;
          return <g key={marker.id} role="button" tabIndex={0} aria-label={`${marker.body_part}, ${marker.severity}, ${marker.recovery_status}`} onClick={() => setSelected(marker.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelected(marker.id); }} className="cursor-pointer">
            <circle cx={x} cy={y} r={selected === marker.id ? 17 : 13} fill={markerColor(marker)} opacity=".23"/>
            <circle cx={x} cy={y} r={selected === marker.id ? 8 : 6} fill={markerColor(marker)} stroke="white" strokeWidth="2"/>
            <text x={x + 10} y={y - 9} fontSize="11" fontWeight="700" fill="#1e293b" stroke="white" strokeWidth="3" paintOrder="stroke">{marker.body_part}</text>
          </g>;
        })}
      </svg>
    </div>
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600"><span><b className="text-blue-700">●</b> Nhẹ</span><span><b className="text-amber-600">●</b> Vừa</span><span><b className="text-rose-600">●</b> Nặng</span><span><b className="text-emerald-600">●</b> Đã hồi phục</span><span>{located.length} điểm có tọa độ / {markers.length} điểm</span></div>
    {selectedMarker && <p className="mt-2 rounded-lg bg-white p-2 text-sm text-slate-700">{selectedMarker.body_part} · {selectedMarker.severity} · {selectedMarker.recovery_status}{selectedMarker.description ? ` — ${selectedMarker.description}` : ""}</p>}
    {!located.length && <p className="mt-2 text-xs text-slate-500">Chưa có điểm nào đủ tọa độ X/Y để hiển thị.</p>}
  </section>;
}

function daysFromToday(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function CarePanel({ horses, selectedHorse, onChanged }: { horses: VetHorse[]; selectedHorse: VetHorse; onChanged: (message: string) => void }) {
  const [schedules, setSchedules] = useState<CareSchedule[]>([]);
  const [events, setEvents] = useState<CareEvent[]>([]);
  const [contextEvents, setContextEvents] = useState<CareEvent[]>([]);
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(daysFromToday(30));
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [includeContext, setIncludeContext] = useState(true);
  const [bookNow, setBookNow] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [bookId, setBookId] = useState("");
  const [moveId, setMoveId] = useState("");
  const [completeId, setCompleteId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

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
    try {
      await veterinarianApi.createSchedule(values); setCreateOpen(false); await load();
      onChanged(book ? "Đã tạo lịch chăm sóc và hẹn thông báo." : "Đã lưu quy tắc chăm sóc; lịch chưa được chốt giờ.");
      setNotice(book ? "Lịch đã được chốt. Thông báo sẽ hiện trước ngày hẹn." : "Quy tắc đã lưu, chưa tạo sự kiện hoặc thông báo.");
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
    event.preventDefault(); const values = formValues(event.currentTarget);
    await act(() => veterinarianApi.bookSchedule(id, values), "Đã chốt ngày giờ và tạo thông báo nhắc.");
  }
  async function submitMove(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault(); const values = formValues(event.currentTarget, [], ["event_date", "start_time", "end_time"]);
    await act(() => veterinarianApi.moveSchedule(id, values), "Đã dời lịch và cập nhật thông báo.");
  }
  async function submitComplete(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault(); const values = formValues(event.currentTarget, [], ["done_date", "next_start_time", "next_end_time"]);
    await act(() => veterinarianApi.completeSchedule(id, values), "Đã ghi nhận hoàn thành lịch chăm sóc.");
  }
  async function cancel(id: string) {
    if (!window.confirm("Hủy lịch chăm sóc này? Quy tắc vẫn được giữ để bạn có thể đặt lịch lại.")) return;
    await act(() => veterinarianApi.cancelSchedule(id), "Đã hủy lịch. Quy tắc vẫn còn trong danh sách.");
  }

  return <div className="space-y-4">
    <SectionCard title="Quy tắc chăm sóc định kỳ" description="Tạo quy tắc có chu kỳ hoặc lưu quy tắc trước rồi chốt ngày giờ sau." icon={CalendarDays} action={<button type="button" className="gold-button h-10 px-3" onClick={() => setCreateOpen((value) => !value)}>+ Lịch chăm sóc</button>}>
      <ErrorLine>{error}</ErrorLine>{notice && <div className="mb-3"><Notice>{notice}</Notice></div>}
      {createOpen && <form onSubmit={(event) => void createSchedule(event)} className="mb-4 grid gap-3 rounded-xl border border-equine-line bg-slate-50 p-4 sm:grid-cols-2"><h4 className="font-semibold text-equine-navy sm:col-span-2">Tạo quy tắc</h4><label className="block"><span className="field-label">Ngựa *</span><select name="horse_id" defaultValue={selectedHorse.id} required className="field-control px-3">{horses.map((item) => <option key={item.id} value={item.id}>{item.horse_name}</option>)}</select></label><SelectField label="Loại chăm sóc" name="care_type" required options={[{ value: "HoofCheck", label: "Kiểm tra móng" }, { value: "Deworming", label: "Tẩy giun" }, { value: "Vaccination", label: "Tiêm phòng" }, { value: "MedicalCheckup", label: "Khám định kỳ" }]} /><Field label="Chu kỳ (ngày, bỏ trống nếu một lần)" name="frequency_days" type="number" min={1} step="1" /><Field label="Lần thực hiện gần nhất" name="last_done_date" type="date" /><Field label="Ngày đến hạn (có thể tính từ ngày cuối + chu kỳ)" name="next_due_date" type="date" /><Field label="Giờ bắt đầu" name="start_time" type="time" required={bookNow} defaultValue="08:00" /><Field label="Giờ kết thúc" name="end_time" type="time" required={bookNow} defaultValue="09:00" /><TextAreaField label="Ghi chú" name="notes" rows={2} /><label className="flex items-center gap-2 self-end rounded-xl border border-equine-line bg-white p-3 text-sm"><input type="checkbox" name="book_event" checked={bookNow} onChange={(event) => setBookNow(event.target.checked)} /> Chốt lịch ngay và tạo nhắc nhở</label><div className="flex gap-2 sm:col-span-2"><button className="gold-button h-10" disabled={busy}>Lưu quy tắc</button><button type="button" className="soft-button h-10 px-3" onClick={() => setCreateOpen(false)}>Hủy</button></div></form>}
      {loading ? <Notice>Đang tải lịch chăm sóc...</Notice> : error.includes("Quy tắc chăm sóc:") ? null : schedules.length === 0 ? <Empty>Chưa có quy tắc chăm sóc.</Empty> : <div className="space-y-3">{schedules.map((schedule) => {
        const scheduleHorse = horses.find((item) => item.id === schedule.horse_id)?.horse_name ?? schedule.horse_name ?? "Ngựa";
        const booked = Boolean(schedule.calendar_event_id);
        const completed = schedule.event_status === "Completed";
        return <article key={schedule.id} className="rounded-xl border border-equine-line p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h4 className="font-semibold text-equine-navy">{scheduleHorse} · {schedule.care_type}</h4>{schedule.is_overdue && <span className="rounded-full bg-rose-100 px-2 py-1 text-[10px] font-bold text-rose-800">QUÁ HẠN</span>}{completed && <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-800">ĐÃ HOÀN THÀNH</span>}</div><p className="mt-1 text-sm text-slate-600">Đến hạn {displayDate(schedule.next_due_date)} · {schedule.frequency_days ? `mỗi ${schedule.frequency_days} ngày` : "một lần"}{schedule.last_done_date ? ` · gần nhất ${displayDate(schedule.last_done_date)}` : ""}</p>{schedule.notes && <p className="mt-1 text-xs text-slate-500">{schedule.notes}</p>}</div><div className="flex flex-wrap gap-2">{!booked && <button type="button" className="soft-button h-9 px-3 text-xs" onClick={() => setBookId(bookId === schedule.id ? "" : schedule.id)}>Chốt giờ</button>}{booked && !completed && <><button type="button" className="soft-button h-9 px-3 text-xs" onClick={() => setMoveId(moveId === schedule.id ? "" : schedule.id)}>Dời lịch</button><button type="button" className="soft-button h-9 border-emerald-200 bg-emerald-50 px-3 text-xs text-emerald-800" onClick={() => setCompleteId(completeId === schedule.id ? "" : schedule.id)}>Hoàn thành</button><button type="button" className="soft-button h-9 border-rose-200 bg-rose-50 px-3 text-xs text-rose-800" disabled={busy} onClick={() => void cancel(schedule.id)}>Hủy lịch</button></>}</div></div>
          {bookId === schedule.id && <form onSubmit={(event) => void submitBook(event, schedule.id)} className="mt-3 grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-3"><Field label="Ngày hẹn" name="event_date" type="date" defaultValue={schedule.next_due_date} /><Field label="Bắt đầu" name="start_time" type="time" required defaultValue="08:00" /><Field label="Kết thúc" name="end_time" type="time" required defaultValue="09:00" /><button className="gold-button h-10 sm:col-span-3" disabled={busy}>Chốt lịch & tạo nhắc nhở</button></form>}
          {moveId === schedule.id && <form onSubmit={(event) => void submitMove(event, schedule.id)} className="mt-3 grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-3"><Field label="Ngày mới (bỏ trống để giữ nguyên)" name="event_date" type="date" /><Field label="Giờ bắt đầu mới" name="start_time" type="time" /><Field label="Giờ kết thúc mới" name="end_time" type="time" /><button className="gold-button h-10 sm:col-span-3" disabled={busy}>Lưu lịch mới</button></form>}
          {completeId === schedule.id && <form onSubmit={(event) => void submitComplete(event, schedule.id)} className="mt-3 grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-3"><Field label="Ngày hoàn thành" name="done_date" type="date" defaultValue={today()} /><Field label="Giờ lần kế tiếp (tùy chọn)" name="next_start_time" type="time" /><Field label="Kết thúc lần kế tiếp" name="next_end_time" type="time" /><button className="gold-button h-10 sm:col-span-3" disabled={busy}>Xác nhận hoàn thành</button></form>}
        </article>;
      })}</div>}
    </SectionCard>

    <SectionCard title="Lịch chăm sóc" description="Lịch giữ lịch sử đã hoàn thành. Có thể bật sự kiện ngựa để xem lịch xung quanh." icon={CalendarDays}>
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"><Field label="Từ ngày" name="calendar_from" type="date" defaultValue={from} key={`from-${from}`} /><Field label="Đến ngày" name="calendar_to" type="date" defaultValue={to} key={`to-${to}`} /><label className="block"><span className="field-label">Phạm vi bác sĩ</span><select value={scope} onChange={(event) => setScope(event.target.value as "mine" | "all")} className="field-control px-3"><option value="mine">Lịch của tôi</option><option value="all">Tất cả bác sĩ</option></select></label><button type="button" className="soft-button h-12 px-4" onClick={(event) => { const form = event.currentTarget.parentElement; const inputs = form?.querySelectorAll("input"); const nextFrom = inputs?.[0]?.value || from; const nextTo = inputs?.[1]?.value || to; setFrom(nextFrom); setTo(nextTo); }}>Xem lịch</button></div>
      <label className="mb-3 inline-flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={includeContext} onChange={(event) => setIncludeContext(event.target.checked)} /> Hiện lịch tập/đua của các ngựa trong danh sách</label>
      {error.includes("Lịch chăm sóc:") ? null : events.length === 0 && contextEvents.length === 0 ? <Empty>Không có sự kiện trong khoảng ngày này.</Empty> : <div className="space-y-2">{events.map((event) => <CalendarRow key={event.event_id} event={event} />)}{contextEvents.map((event, index) => <CalendarRow key={`${event.id ?? event.event_id}-${index}`} event={{ ...event, context: true }} />)}</div>}
      {events.length >= 100 && <p className="mt-2 text-xs text-slate-500">Đang hiển thị tối đa 100 sự kiện trong khoảng đã chọn.</p>}
    </SectionCard>
  </div>;
}

function CalendarRow({ event }: { event: CareEvent }) {
  const eventName = event.care_type ?? event.event_type ?? "Sự kiện";
  const horseName = event.horse?.horse_name ?? event.horse_name;
  const context = event.context;
  return <article className={`flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between ${context ? "border-slate-200 bg-slate-50" : "border-equine-line"}`}><div><p className="font-semibold text-equine-navy">{horseName ? `${horseName} · ` : ""}{eventName}{context ? " · Lịch liên quan" : ""}</p><p className="mt-1 text-xs text-slate-500">{displayDate(event.event_date)}{event.start_time ? ` · ${event.start_time.slice(0, 5)}–${event.end_time?.slice(0, 5) ?? "?"}` : " · Cả ngày"}</p></div><span className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-600">{event.status}</span></article>;
}

function NotificationsPanel({ onUnread }: { onUnread: (count: number) => void }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const result = await veterinarianApi.notifications(unreadOnly); setNotifications(result.data); setUnread(result.unread_count); onUnread(result.unread_count); }
    catch (reason) { setError(veterinarianError(reason)); }
    finally { setLoading(false); }
  }, [onUnread, unreadOnly]);
  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 60_000); return () => window.clearInterval(timer); }, [load]);
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
  return <SectionCard title="Thông báo" description="Chỉ hiển thị thông báo đã đến hạn. Danh sách tự cập nhật mỗi phút." icon={Bell} action={<div className="flex gap-2"><button type="button" className="soft-button h-9 px-3 text-xs" onClick={() => setUnreadOnly((value) => !value)}>{unreadOnly ? "Xem tất cả" : "Chưa đọc"}</button><button type="button" className="soft-button h-9 px-3 text-xs" disabled={busy || unread === 0} onClick={() => void markAll()}>Đọc tất cả</button></div>}>
    <ErrorLine>{error}</ErrorLine>{loading ? <Notice>Đang tải thông báo...</Notice> : notifications.length === 0 ? <Empty>{unreadOnly ? "Không có thông báo chưa đọc." : "Chưa có thông báo đã đến hạn."}</Empty> : <div className="space-y-2">{notifications.map((item) => <article key={item.id} className={`flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between ${item.is_read ? "border-equine-line bg-white" : "border-equine-gold/40 bg-[#fffaf2]"}`}><div><p className="text-sm font-medium text-equine-navy">{item.message}</p><p className="mt-1 text-xs text-slate-500">{displayDate(item.scheduled_at ?? item.created_at)}{item.is_read ? " · Đã đọc" : " · Chưa đọc"}</p></div>{!item.is_read && <button type="button" className="soft-button h-9 px-3 text-xs" disabled={busy} onClick={() => void markRead(item.id)}>Đánh dấu đã đọc</button>}</article>)}</div>}
  </SectionCard>;
}
