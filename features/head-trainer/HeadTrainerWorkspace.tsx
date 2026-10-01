"use client";

import { Activity, AlertTriangle, CalendarDays, Check, ClipboardList, Flag, Gauge, HeartPulse, Medal, Pencil, Play, Plus, RefreshCw, Timer, Trophy, Trash2, Users, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { HorseImage, Notice } from "@/features/horses/HorseUI";
import NotificationCenter from "@/shared/components/NotificationCenter";
import { listHorses, type Horse } from "@/features/horses/api";
import { useDashboardTab } from "@/shared/hooks/use-dashboard-tab";
import {
  headTrainerApi,
  headTrainerError,
  racePosition,
  simulatedVitals,
  type RaceOption,
  type Simulation,
  type TrainingMetric,
  type TrainingPlan,
  type TrainingSession,
  type TrainerHorse,
} from "@/features/head-trainer/api";

type Tab = "overview" | "plans" | "calendar" | "races" | "simulation";
const workspaceTabIds: readonly Tab[] = ["overview", "plans", "calendar", "races", "simulation"];
type Groom = { user_id: number; full_name: string; email: string };
const tabs: { id: Tab; label: string; icon: typeof Activity }[] = [
  { id: "overview", label: "Thể lực", icon: Activity },
  { id: "plans", label: "Giáo án", icon: ClipboardList },
  { id: "calendar", label: "Lịch tập", icon: CalendarDays },
  { id: "simulation", label: "Chạy đua", icon: Trophy },
  { id: "races", label: "Giải đấu", icon: Flag },
];

function today() { return new Date().toLocaleDateString("en-CA"); }
function simulationResults(simulation: Simulation) {
  return simulation.horses.map((horse) => {
    let speedTotal = 0;
    let maxHeartRate = 0;
    let maxSystolic = 0;
    let maxDiastolic = 0;
    for (let index = 0; index <= 100; index += 1) {
      const point = simulatedVitals(horse, index / 100);
      speedTotal += point.speed;
      maxHeartRate = Math.max(maxHeartRate, point.heartRate);
      maxSystolic = Math.max(maxSystolic, point.systolic);
      maxDiastolic = Math.max(maxDiastolic, point.diastolic);
    }
    const averageSpeed = speedTotal / 101;
    return {
      horse_id: horse.horse_id,
      finish_time_seconds: Number((simulation.distance_meters / (averageSpeed / 3.6)).toFixed(2)),
      avg_speed_kmh: Number(averageSpeed.toFixed(2)),
      max_heart_rate: maxHeartRate,
      max_bp_systolic: maxSystolic,
      max_bp_diastolic: maxDiastolic,
    };
  });
}

function suggestedTrainingWindow() {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  const end = new Date(start);
  end.setHours(end.getHours() + 1);
  const dateValue = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  const timeValue = (value: Date) => `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
  return { date: dateValue(start), start: timeValue(start), end: timeValue(end) };
}
function plusDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  return value.toLocaleDateString("en-CA");
}
function metricDate(value?: string | null) {
  if (!value) return "Chưa có dữ liệu";
  return new Date(value).toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" });
}

export default function HeadTrainerWorkspace() {
  const [tab, selectTab] = useDashboardTab(workspaceTabIds, "overview");
  const [horses, setHorses] = useState<Horse[]>([]);
  const [overview, setOverview] = useState<TrainerHorse[]>([]);
  const [grooms, setGrooms] = useState<Groom[]>([]);
  const [races, setRaces] = useState<RaceOption[]>([]);
  const [horseId, setHorseId] = useState("");
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [metrics, setMetrics] = useState<TrainingMetric[]>([]);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [simulationHorseIds, setSimulationHorseIds] = useState<string[]>([]);
  const [compare, setCompare] = useState<{ horse_id: string; horse_name: string; metrics: TrainingMetric[] }[]>([]);
  const [raceEntries, setRaceEntries] = useState<Record<string, unknown>[]>([]);
  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [ranking, setRanking] = useState<{ rank: number; horse_id: string; horse_name: string; finish_time_seconds: number }[]>([]);
  const [progress, setProgress] = useState(0);
  const [vitals, setVitals] = useState<Record<string, ReturnType<typeof simulatedVitals>>>({});
  const [activeOnly, setActiveOnly] = useState(false);
  const [includeSimulated, setIncludeSimulated] = useState(false);
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(plusDays(today(), 14));
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editingPlan, setEditingPlan] = useState<string | null>(null);
  const [scheduleDraft, setScheduleDraft] = useState<{ horseId: string; planId: string; startDate: string | null } | null>(null);
  const [showMetricsFor, setShowMetricsFor] = useState<string | null>(null);
  const [finishFailed, setFinishFailed] = useState(false);
  const startAtRef = useRef(0);
  const finishStartedRef = useRef(false);

  const selectedHorse = useMemo(() => horses.find((horse) => horse.id === horseId) ?? null, [horses, horseId]);
  const selectedOverview = useMemo(() => overview.find((horse) => horse.horse_id === horseId), [overview, horseId]);

  const run = useCallback(async <T,>(action: () => Promise<T>, success?: string) => {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await action();
      if (success) setNotice(success);
      return result;
    } catch (reason) {
      setError(headTrainerError(reason));
      return null;
    } finally { setBusy(false); }
  }, []);

  const loadOverview = useCallback(async () => {
    const [horsePage, overviewPage, groomPage, racePage] = await Promise.all([
      listHorses(), headTrainerApi.overview(includeSimulated), headTrainerApi.grooms(), headTrainerApi.races(),
    ]);
    setHorses(horsePage.items);
    setOverview(overviewPage.data);
    setGrooms(groomPage.data);
    setRaces(racePage.data);
    setHorseId((current) => current || horsePage.items[0]?.id || "");
    setCompareIds((current) => current.length ? current : horsePage.items.slice(0, 3).map((item) => item.id));
  }, [includeSimulated]);

  const loadHorseData = useCallback(async () => {
    if (!horseId) { setPlans([]); setMetrics([]); setRaceEntries([]); return; }
    const [planPage, history, entries] = await Promise.all([
      headTrainerApi.plans(horseId, activeOnly),
      headTrainerApi.metrics(horseId, from, to, includeSimulated),
      headTrainerApi.raceEntries(horseId),
    ]);
    setPlans(planPage.data);
    setMetrics(history);
    setRaceEntries(entries.data);
  }, [horseId, activeOnly, from, to, includeSimulated]);

  const loadCalendar = useCallback(async () => {
    const data = await headTrainerApi.calendar(from, to);
    setSessions(data.data);
  }, [from, to]);

  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    loadOverview().catch((reason) => { if (active) setError(headTrainerError(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loadOverview]);

  useEffect(() => {
    let active = true;
    if (tab === "overview" || tab === "plans" || tab === "races") {
      loadHorseData().catch((reason) => { if (active) setError(headTrainerError(reason)); });
    }
    if (tab === "calendar" || tab === "simulation") loadCalendar().catch((reason) => { if (active) setError(headTrainerError(reason)); });
    return () => { active = false; };
  }, [tab, loadHorseData, loadCalendar]);

  useEffect(() => {
    if (tab !== "overview" || !compareIds.length) { setCompare([]); return; }
    let active = true;
    headTrainerApi.compare(compareIds.slice(0, 8), from, to, includeSimulated)
      .then((response) => { if (active) setCompare(response.horses); })
      .catch((reason) => { if (active) setError(headTrainerError(reason)); });
    return () => { active = false; };
  }, [tab, compareIds, from, to, includeSimulated]);

  const finishSimulation = useCallback(async (currentSimulation: Simulation) => {
    if (finishStartedRef.current) return;
    finishStartedRef.current = true;
    setBusy(true); setError(""); setNotice(""); setFinishFailed(false);
    let raceSaved = false;
    try {
      const response = await headTrainerApi.finishSimulation(currentSimulation.simulation_id, {
        results: simulationResults(currentSimulation),
      });
      raceSaved = true;
      setRanking(response.ranking);
      setSimulation((value) => value ? { ...value, status: "Completed" } : value);
      setNotice(`Đã lưu ${response.race_name} và cập nhật lịch sử giải đấu.`);
      await Promise.all([loadOverview(), loadHorseData()]);
    } catch (reason) {
      if (raceSaved) {
        setError("Cuộc đua đã được ghi nhận; chưa tải lại được các bảng. Nhấn Làm mới để cập nhật.");
      } else {
        setError(headTrainerError(reason));
        setFinishFailed(true);
        finishStartedRef.current = false;
      }
    } finally {
      setBusy(false);
    }
  }, [loadOverview, loadHorseData]);

  useEffect(() => {
    if (!simulation || simulation.status === "Completed") return;
    startAtRef.current ||= performance.now();
    let frame = 0;
    const tick = () => {
      const elapsed = (performance.now() - startAtRef.current) / 1000;
      const current = Math.min(1, elapsed / simulation.duration_seconds);
      setProgress(current);
      setVitals(Object.fromEntries(simulation.horses.map((horse) => [horse.horse_id, simulatedVitals(horse, current)])));
      if (current >= 1 && !finishStartedRef.current) {
        void finishSimulation(simulation);
      } else if (current < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [simulation, finishSimulation]);

  const refresh = useCallback(async () => {
    try { await Promise.all([loadOverview(), loadHorseData(), tab === "calendar" ? loadCalendar() : Promise.resolve()]); }
    catch (reason) { setError(headTrainerError(reason)); }
  }, [loadOverview, loadHorseData, loadCalendar, tab]);

  async function createPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!horseId) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const result = await run(() => headTrainerApi.createPlan(horseId, {
      stage_name: data.get("stage_name"), start_date: data.get("start_date") || null,
      end_date: data.get("end_date") || null, objective: data.get("objective") || null,
      target_distance_meters: Number(data.get("target_distance_meters")) || null,
      target_workload_minutes: Number(data.get("target_workload_minutes")) || null,
      target_track_surface: data.get("target_track_surface") || null,
      target_intensity: data.get("target_intensity"), update_deadline_hours: Number(data.get("update_deadline_hours")) || 24,
    }), "Đã tạo giáo án.");
    if (result) { form.reset(); await refresh(); }
  }

  async function updatePlan(event: FormEvent<HTMLFormElement>, planId: string) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    const result = await run(() => headTrainerApi.updatePlan(planId, {
      stage_name: data.get("stage_name"), start_date: data.get("start_date") || null,
      end_date: data.get("end_date") || null, objective: data.get("objective") || null,
      target_distance_meters: Number(data.get("target_distance_meters")) || null,
      target_workload_minutes: Number(data.get("target_workload_minutes")) || null,
      target_track_surface: data.get("target_track_surface") || null,
      target_intensity: data.get("target_intensity") || null,
      update_deadline_hours: Number(data.get("update_deadline_hours")) || 24,
    }), "Đã cập nhật giáo án.");
    if (result) { setEditingPlan(null); await refresh(); }
  }

  async function deletePlan(planId: string) {
    const result = await run(() => headTrainerApi.deletePlan(planId), "Đã xóa giáo án.");
    if (result) {
      if (editingPlan === planId) setEditingPlan(null);
      await refresh();
    }
  }

  function scheduleFromPlan(plan: TrainingPlan) {
    setScheduleDraft({ horseId: plan.horse_id, planId: plan.id, startDate: plan.start_date });
    selectTab("calendar");
    setError("");
    setNotice(`Đã chọn giáo án “${plan.stage_name}”. Hãy chọn ngày, giờ và Groom để lên lịch buổi tập.`);
  }

  async function createSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    const result = await run(() => headTrainerApi.createSchedule(String(data.get("horse_id")), {
      training_plan_id: data.get("training_plan_id") || null, session_type: data.get("session_type"),
      track_surface: data.get("track_surface") || null, event_date: data.get("event_date"),
      start_time: data.get("start_time"), end_time: data.get("end_time"),
      assigned_groom_id: data.get("assigned_groom_id") ? Number(data.get("assigned_groom_id")) : null,
      notes: data.get("notes") || null,
    }), "Đã tạo lịch tập.");
    if (result) { form.reset(); setScheduleDraft(null); await refresh(); }
  }

  async function recordMetrics(event: FormEvent<HTMLFormElement>, scheduleId: string) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    const result = await run(() => headTrainerApi.recordMetrics(scheduleId, {
      body_weight_kg: Number(data.get("body_weight_kg")), max_heart_rate: Number(data.get("max_heart_rate")),
      avg_speed_kmh: Number(data.get("avg_speed_kmh")), stamina_score: Number(data.get("stamina_score")),
      trainer_review: data.get("trainer_review") || null,
    }), "Đã lưu chỉ số sau buổi tập.");
    if (result) {
      form.reset();
      setNotice(result.suggest_notify_vet ? "Đã lưu chỉ số. Nên thông báo bác sĩ thú y để kiểm tra ngựa." : "Đã lưu chỉ số sau buổi tập.");
      await refresh();
    }
  }

  async function addTrainingVideo(event: FormEvent<HTMLFormElement>, scheduleId: string) {
    event.preventDefault(); const form=event.currentTarget; const data=new FormData(form);
    const result=await run(()=>headTrainerApi.addTrainingVideo(scheduleId,{
      video_url:String(data.get("video_url")),description:String(data.get("description")||"")||undefined,
    }),"Đã chia sẻ video buổi tập với Horse Owner.");
    if(result){form.reset();await refresh();}
  }

  async function startSimulation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    const result = await run(() => headTrainerApi.createSimulation({
      horse_ids: simulationHorseIds.slice(0, 5), distance_meters: Number(data.get("distance_meters")),
      duration_seconds: Number(data.get("duration_seconds")),
      training_schedule_id: data.get("training_schedule_id") ? String(data.get("training_schedule_id")) : undefined,
    }));
    if (result) { setRanking([]); setProgress(0); setFinishFailed(false); finishStartedRef.current = false; startAtRef.current = performance.now(); setSimulation(result); }
  }

  if (loading) return <div className="mt-10 rounded-2xl border border-equine-line bg-white p-6"><Notice>Đang tải dữ liệu huấn luyện…</Notice></div>;

  return <section className="mt-5" aria-labelledby="head-trainer-title">
    <div className="flex flex-col gap-4 border-b border-equine-line pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div><p className="eyebrow">Phân hệ huấn luyện</p><h2 id="head-trainer-title" className="mt-2 font-sans text-3xl font-semibold text-equine-navy">Head Trainer workspace</h2><p className="mt-2 max-w-2xl text-sm text-slate-600">Theo dõi thể lực, lập giáo án, sắp lịch tập, tổ chức cuộc đua và xem thành tích.</p></div>
      <button type="button" onClick={() => void refresh()} className="soft-button self-start" disabled={busy}><RefreshCw size={15} /> Làm mới</button>
    </div>
    <div className="mt-4"><NotificationCenter /></div>
    <div className="mt-5 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Chức năng huấn luyện">
      {tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => { selectTab(id); setError(""); setNotice(""); }} className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${tab === id ? "bg-equine-navy text-white" : "border border-equine-line bg-white text-slate-600 hover:bg-equine-mist"}`}><Icon size={16} />{label}</button>)}
    </div>
    <div className="mt-5 space-y-4">
      {error && <Notice error>{error}</Notice>}{notice && <Notice>{notice}</Notice>}
      {!horses.length ? <Notice>Chưa có hồ sơ ngựa đang hoạt động.</Notice> : <>
        {tab !== "simulation" && <div className="flex flex-wrap items-center gap-3 rounded-xl border border-equine-line bg-white p-3">
          <label className="text-xs font-bold uppercase tracking-wide text-slate-500" htmlFor="trainer-horse">Ngựa đang xem</label>
          <select id="trainer-horse" className="field-control max-w-sm px-3" value={horseId} onChange={(event) => setHorseId(event.target.value)}>{horses.map((horse) => <option key={horse.id} value={horse.id}>{horse.horse_name}{horse.is_training_locked ? " · Đang khóa" : ""}</option>)}</select>
          {selectedOverview?.is_training_locked && <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700"><AlertTriangle size={14} /> Khóa huấn luyện · {selectedOverview.lock_reason}</span>}
        </div>}
        {tab === "overview" && <OverviewPanel horses={horses} overview={overview} selectedHorseId={horseId} metrics={metrics} compare={compare} compareIds={compareIds} setCompareIds={setCompareIds} from={from} setFrom={setFrom} to={to} setTo={setTo} includeSimulated={includeSimulated} setIncludeSimulated={setIncludeSimulated} />}
        {tab === "plans" && <PlansPanel horse={selectedHorse} plans={plans} activeOnly={activeOnly} setActiveOnly={setActiveOnly} editingPlan={editingPlan} setEditingPlan={setEditingPlan} onCreate={createPlan} onUpdate={updatePlan} onDelete={deletePlan} onSchedule={scheduleFromPlan} busy={busy} />}
        {tab === "calendar" && <CalendarPanel horses={horses} sessions={sessions} grooms={grooms} from={from} setFrom={setFrom} to={to} setTo={setTo} scheduleDraft={scheduleDraft} onDraftUsed={() => setScheduleDraft(null)} onCreate={createSchedule} onAssign={async (id, groomId) => { const result = await run(() => headTrainerApi.assignGroom(id, groomId), "Đã phân công Groom."); if (result) await refresh(); }} onStatus={async (id, status) => { const result = await run(() => headTrainerApi.updateSchedule(id, { status }), `Đã cập nhật buổi tập: ${status}.`); if (result) await refresh(); }} onMetrics={recordMetrics} onVideo={addTrainingVideo} showMetricsFor={showMetricsFor} setShowMetricsFor={setShowMetricsFor} busy={busy} />}
        {tab === "races" && <RaceEntriesPanel selectedHorse={selectedHorse} races={races} entries={raceEntries} onRecordResult={async (entryId,input) => { const result=await run(()=>headTrainerApi.recordRaceResult(entryId,input),"Race result saved."); if(result) await refresh(); }} onRegister={async (raceId) => { if (!horseId) return; const result = await run(() => headTrainerApi.registerRace(horseId, raceId), "Đã đăng ký ngựa vào giải."); if (result) await refresh(); }} busy={busy} />}
        {tab === "simulation" && <SimulationPanel horses={horses} selectedIds={simulationHorseIds} setSelectedIds={setSimulationHorseIds} sessions={sessions} simulation={simulation} ranking={ranking} progress={progress} vitals={vitals} onStart={startSimulation} onRetryFinish={() => { if (simulation) void finishSimulation(simulation); }} finishFailed={finishFailed} busy={busy} />}
      </>}
    </div>
  </section>;
}

function OverviewPanel({ horses, overview, selectedHorseId, metrics, compare, compareIds, setCompareIds, from, setFrom, to, setTo, includeSimulated, setIncludeSimulated }: {
  horses: Horse[]; overview: TrainerHorse[]; selectedHorseId: string; metrics: TrainingMetric[]; compare: { horse_id: string; horse_name: string; metrics: TrainingMetric[] }[];
  compareIds: string[]; setCompareIds: (ids: string[]) => void;
  from: string; setFrom: (value: string) => void; to: string; setTo: (value: string) => void;
  includeSimulated: boolean; setIncludeSimulated: (value: boolean) => void;
}) {
  const [comparisonMetric, setComparisonMetric] = useState<ComparisonMetricKey>("avg_speed_kmh");
  const selected = overview.find((item) => item.horse_id === selectedHorseId);
  const lockedCount = overview.filter((item) => item.is_training_locked).length;
  const alertCount = overview.filter((item) => item.has_injury_alert).length;
  return <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard icon={Users} label="Ngựa đang hoạt động" value={String(horses.length)} />
      <StatCard icon={AlertTriangle} label="Đang khóa huấn luyện" value={String(lockedCount)} warning={lockedCount > 0} />
      <StatCard icon={HeartPulse} label="Cảnh báo ở lần đo gần nhất" value={String(alertCount)} warning={alertCount > 0} />
      <StatCard icon={Activity} label="Có dữ liệu thể lực" value={String(overview.filter((item) => item.recorded_at).length)} />
    </div>
    <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <Section title="Ưu tiên theo dõi" description="Ngựa bị khóa hoặc có cảnh báo gần nhất được xếp lên trước." icon={AlertTriangle}>
        <div className="space-y-2">{overview.slice(0, 8).map((item) => <div key={item.horse_id} className="flex items-center gap-3 rounded-xl border border-equine-line p-3">
          <HorsePhoto id={item.horse_id} name={item.horse_name} image={item.image_url} />
          <div className="min-w-0 flex-1"><p className="truncate font-semibold text-equine-navy">{item.horse_name}</p><p className="text-xs text-slate-500">{metricDate(item.recorded_at)}</p></div>
          {item.is_training_locked && <span className="rounded-full bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-700">Đang khóa</span>}
          {!item.is_training_locked && item.has_injury_alert && <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">Cảnh báo</span>}
          <span className="text-right text-xs text-slate-600">{item.stamina_score ?? "—"}<small className="block">thể lực</small></span>
        </div>)}</div>
      </Section>
      <Section title="Biểu đồ tiến độ và so sánh" description="So sánh cùng một chỉ số trên cùng thang đo; rê chuột lên điểm hoặc mở danh sách để xem từng lần đo." icon={Activity}>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Từ ngày" name="from" type="date" value={from} onChange={setFrom} /><Field label="Đến ngày" name="to" type="date" value={to} onChange={setTo} /></div>
        <label className="mt-3 inline-flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={includeSimulated} onChange={(event) => setIncludeSimulated(event.target.checked)} />Gồm dữ liệu mô phỏng</label>
        <label className="mt-3 block max-w-sm"><span className="field-label">Chỉ số cần theo dõi</span><select className="field-control px-3" value={comparisonMetric} onChange={(event) => setComparisonMetric(event.target.value as ComparisonMetricKey)}>{comparisonMetrics.map((metric) => <option key={metric.key} value={metric.key}>{metric.label} ({metric.unit})</option>)}</select></label>
        <div className="mt-3 flex max-h-28 flex-wrap gap-2 overflow-y-auto">{horses.map((horse) => <label key={horse.id} className="inline-flex items-center gap-1 rounded-lg border border-equine-line px-2 py-1 text-xs"><input type="checkbox" checked={compareIds.includes(horse.id)} onChange={(event) => setCompareIds(event.target.checked ? [...compareIds, horse.id].slice(0, 8) : compareIds.filter((id) => id !== horse.id))} />{horse.horse_name}</label>)}</div>
        <ComparisonChart compare={compare} metricKey={comparisonMetric} />
      </Section>
    </div>
    <Section title="Lần đo gần nhất" description={`${selected?.horse_name ?? "Các ngựa"} · dữ liệu sắp theo thời gian`} icon={Gauge}>
      <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead><tr className="border-b border-equine-line text-xs uppercase text-slate-500"><th className="py-2">Thời điểm</th><th>Cân nặng</th><th>Nhịp tim tối đa</th><th>Tốc độ TB</th><th>Thể lực</th><th>Cảnh báo</th></tr></thead><tbody>{metrics.slice().reverse().slice(0, 12).map((point, index) => <tr key={point.id ?? `${point.recorded_at}-${index}`} className="border-b border-equine-line/70"><td className="py-2">{metricDate(point.recorded_at)}{point.is_simulated && <small className="ml-1 text-violet-700">· Mô phỏng</small>}</td><td>{point.body_weight_kg ?? "—"} kg</td><td>{point.max_heart_rate ?? "—"} bpm</td><td>{point.avg_speed_kmh ?? "—"} km/h</td><td>{point.stamina_score ?? "—"}</td><td>{point.has_injury_alert ? <span className="text-rose-700">Cần lưu ý</span> : "—"}</td></tr>)}</tbody></table>{metrics.length === 0 && <p className="py-4 text-sm text-slate-500">Chưa có chỉ số trong khoảng thời gian này.</p>}</div>
    </Section>
  </div>;
}

const chartColors = ["#bd843d", "#2f6875", "#784f6b", "#6d7b4e", "#b15d46", "#52648e", "#886b35", "#4d7b69"];
type ComparisonMetricKey = "avg_speed_kmh" | "stamina_score" | "max_heart_rate" | "body_weight_kg" | "bp_systolic" | "bp_diastolic";
const comparisonMetrics: { key: ComparisonMetricKey; label: string; unit: string }[] = [
  { key: "avg_speed_kmh", label: "Tốc độ trung bình", unit: "km/h" },
  { key: "stamina_score", label: "Thể lực", unit: "/10" },
  { key: "max_heart_rate", label: "Nhịp tim tối đa", unit: "bpm" },
  { key: "body_weight_kg", label: "Cân nặng", unit: "kg" },
  { key: "bp_systolic", label: "Huyết áp tâm thu", unit: "mmHg" },
  { key: "bp_diastolic", label: "Huyết áp tâm trương", unit: "mmHg" },
];

function comparisonValue(metric: TrainingMetric, key: ComparisonMetricKey) {
  const value = metric[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatChartValue(value: number) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value);
}

function shortMetricDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function ComparisonChart({ compare, metricKey }: {
  compare: { horse_id: string; horse_name: string; metrics: TrainingMetric[] }[];
  metricKey: ComparisonMetricKey;
}) {
  const definition = comparisonMetrics.find((metric) => metric.key === metricKey) ?? comparisonMetrics[0];
  const rows = compare.map((horse, index) => ({
    ...horse,
    color: chartColors[index % chartColors.length],
    points: horse.metrics.flatMap((metric) => {
      const value = comparisonValue(metric, metricKey);
      const timestamp = new Date(metric.recorded_at).getTime();
      return value === null || !Number.isFinite(timestamp) ? [] : [{ metric, value, timestamp }];
    }).sort((a, b) => a.timestamp - b.timestamp),
  }));
  const allPoints = rows.flatMap((row) => row.points);
  if (compare.length === 0) {
    return <div className="mt-5 rounded-xl border border-dashed border-equine-line bg-slate-50 p-6 text-center text-sm text-slate-500">
      Chọn ít nhất một ngựa để xem biểu đồ so sánh.
    </div>;
  }
  if (allPoints.length === 0) {
    return <div className="mt-5 rounded-xl border border-dashed border-equine-line bg-slate-50 p-6 text-center text-sm text-slate-500">
      Chưa có dữ liệu {definition.label.toLowerCase()} trong khoảng ngày đã chọn. Thử đổi chỉ số hoặc mở rộng khoảng ngày.
    </div>;
  }

  const chart = { left: 74, right: 956, top: 18, bottom: 204, width: 1000, height: 262 };
  const minTime = Math.min(...allPoints.map((point) => point.timestamp));
  const maxTime = Math.max(...allPoints.map((point) => point.timestamp));
  const timeSpan = Math.max(maxTime - minTime, 1);
  const minValue = Math.min(...allPoints.map((point) => point.value));
  const maxValue = Math.max(...allPoints.map((point) => point.value));
  const valuePadding = Math.max((maxValue - minValue) * 0.12, Math.abs(minValue) * 0.04, 0.5);
  const domainMin = minValue - valuePadding;
  const domainMax = maxValue + valuePadding;
  const x = (timestamp: number) => minTime === maxTime
    ? (chart.left + chart.right) / 2
    : chart.left + ((timestamp - minTime) / timeSpan) * (chart.right - chart.left);
  const y = (value: number) => chart.bottom - ((value - domainMin) / (domainMax - domainMin)) * (chart.bottom - chart.top);
  const yTicks = [domainMax, (domainMin + domainMax) / 2, domainMin];
  const xTicks = minTime === maxTime
    ? [{ timestamp: minTime, position: (chart.left + chart.right) / 2 }]
    : [
      { timestamp: minTime, position: chart.left },
      { timestamp: minTime + timeSpan / 2, position: (chart.left + chart.right) / 2 },
      { timestamp: maxTime, position: chart.right },
    ];
  const firstDate = new Date(minTime).toLocaleDateString("vi-VN");
  const lastDate = new Date(maxTime).toLocaleDateString("vi-VN");

  return <div className="mt-5 space-y-4">
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600">
      {rows.map((row) => <span key={row.horse_id} className="inline-flex min-w-0 items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} /><span className="max-w-48 truncate">{row.horse_name}</span></span>)}
      <span className="ml-auto text-slate-500">Trục dọc: {definition.label} ({definition.unit})</span>
    </div>
    <div className="overflow-x-auto rounded-xl border border-equine-line bg-white p-2">
      <svg viewBox={`0 0 ${chart.width} ${chart.height}`} className="h-64 min-w-[620px] w-full" role="img" aria-label={`So sánh ${definition.label.toLowerCase()} của các ngựa từ ${firstDate} đến ${lastDate}`}>
        <desc>Biểu đồ dùng chung thang đo cho tất cả ngựa. Mỗi điểm có ngày giờ và giá trị khi rê chuột.</desc>
        {yTicks.map((tick, index) => {
          const tickY = y(tick);
          return <g key={`y-${index}`}>
            <line x1={chart.left} x2={chart.right} y1={tickY} y2={tickY} stroke="#dbe4eb" strokeDasharray={index === 1 ? "4 4" : undefined} />
            <text x={chart.left - 10} y={tickY + 4} textAnchor="end" fill="#64748b" fontSize="12">{formatChartValue(tick)}</text>
          </g>;
        })}
        {xTicks.map((tick, index) => {
          const tickX = tick.position;
          return <g key={`x-${index}`}>
            <line x1={tickX} x2={tickX} y1={chart.top} y2={chart.bottom} stroke="#eef2f6" />
            <text x={tickX} y={chart.bottom + 22} textAnchor={xTicks.length === 1 ? "middle" : index === 0 ? "start" : index === xTicks.length - 1 ? "end" : "middle"} fill="#64748b" fontSize="12">{shortMetricDate(tick.timestamp)}</text>
          </g>;
        })}
        {rows.map((row) => <g key={row.horse_id}>
          {row.points.length > 1 && <polyline fill="none" stroke={row.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" points={row.points.map((point) => `${x(point.timestamp)},${y(point.value)}`).join(" ")} />}
          {row.points.map((point, pointIndex) => <circle key={point.metric.id ?? `${point.timestamp}-${pointIndex}`} cx={x(point.timestamp)} cy={y(point.value)} r="4.5" fill={row.color} stroke="white" strokeWidth="2">
            <title>{`${row.horse_name} · ${metricDate(point.metric.recorded_at)} · ${formatChartValue(point.value)} ${definition.unit}`}</title>
          </circle>)}
        </g>)}
      </svg>
    </div>
    <div className="grid gap-3 md:grid-cols-2">
      {rows.map((row) => {
        const first = row.points[0];
        const latest = row.points[row.points.length - 1];
        const change = first && latest ? latest.value - first.value : null;
        return <details key={row.horse_id} className="rounded-xl border border-equine-line bg-slate-50 p-3">
          <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 text-sm">
            <span className="inline-flex min-w-0 items-center gap-2 font-semibold text-equine-navy"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} /><span className="truncate">{row.horse_name}</span></span>
            {latest ? <span className="text-right"><strong>{formatChartValue(latest.value)} {definition.unit}</strong><span className="ml-2 text-xs font-normal text-slate-500">{row.points.length} lần đo</span></span> : <span className="text-xs text-slate-500">Chưa có dữ liệu</span>}
          </summary>
          {latest && <div className="mt-2 border-t border-equine-line pt-2 text-xs text-slate-600">
            <p>Lần gần nhất: {metricDate(latest.metric.recorded_at)}</p>
            {change !== null && <p className="mt-1">Thay đổi so với lần đầu: {change > 0 ? "+" : ""}{formatChartValue(change)} {definition.unit}</p>}
            <ol className="mt-2 grid max-h-48 gap-x-4 gap-y-1 overflow-y-auto sm:grid-cols-2">{row.points.map((point, pointIndex) => <li key={point.metric.id ?? `${point.timestamp}-${pointIndex}`} className="flex justify-between gap-3"><span>{metricDate(point.metric.recorded_at)}</span><strong className="whitespace-nowrap">{formatChartValue(point.value)} {definition.unit}</strong></li>)}</ol>
          </div>}
        </details>;
      })}
    </div>
  </div>;
}

function PlansPanel({ horse, plans, activeOnly, setActiveOnly, editingPlan, setEditingPlan, onCreate, onUpdate, onDelete, onSchedule, busy }: {
  horse: Horse | null; plans: TrainingPlan[]; activeOnly: boolean; setActiveOnly: (value: boolean) => void;
  editingPlan: string | null; setEditingPlan: (id: string | null) => void;
  onCreate: (event: FormEvent<HTMLFormElement>) => void; onUpdate: (event: FormEvent<HTMLFormElement>, id: string) => void;
  onDelete: (id: string) => void; onSchedule: (plan: TrainingPlan) => void; busy: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  return <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
    <Section title="Tạo giáo án theo giai đoạn" description={horse ? `Áp dụng cho ${horse.horse_name}` : "Chọn ngựa trước khi tạo"} icon={Plus}>
      {horse?.is_training_locked && <Notice error>Ngựa đang bị khóa huấn luyện. Gỡ khóa bởi bác sĩ trước khi tạo giáo án.</Notice>}
      <form onSubmit={onCreate} className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Tên giai đoạn" name="stage_name" required maxLength={100} />
        <Field label="Cự ly mục tiêu (m)" name="target_distance_meters" type="number" min={1} />
        <Field label="Khối lượng mục tiêu (phút/tuần)" name="target_workload_minutes" type="number" min={1} max={1440} />
        <SelectField label="Mặt sân ưu tiên" name="target_track_surface" options={[["", "Chưa chọn"], ["Dirt", "Đất"], ["Turf", "Cỏ"], ["Synthetic", "Nhân tạo"]]} />
        <Field label="Ngày bắt đầu" name="start_date" type="date" />
        <Field label="Ngày kết thúc" name="end_date" type="date" />
        <SelectField label="Cường độ" name="target_intensity" options={[["Low", "Thấp"], ["Medium", "Vừa"], ["High", "Cao"]]} />
        <Field label="Hạn sửa trước buổi tập (giờ)" name="update_deadline_hours" type="number" min={0} defaultValue={24} />
        <TextArea label="Mục tiêu" name="objective" rows={3} />
        <div className="flex items-end"><button className="gold-button w-full" disabled={busy || !horse || horse.is_training_locked}><Plus size={15} /> Tạo giáo án</button></div>
      </form>
      <p className="mt-3 text-xs leading-5 text-slate-500">Tạo giáo án chỉ lưu kế hoạch giai đoạn. Để bắt đầu thực hiện, chọn giáo án bên cạnh rồi lên lịch từng buổi tập với ngày, giờ và Groom.</p>
    </Section>
    <Section title="Giáo án của ngựa" description="Giáo án mô tả mục tiêu giai đoạn; lên lịch từng buổi để thực hiện. Có thể sửa trước hạn của buổi tập gần nhất." icon={ClipboardList} action={<label className="inline-flex items-center gap-2 text-xs"><input type="checkbox" checked={activeOnly} onChange={(event) => setActiveOnly(event.target.checked)} />Chỉ đang hoạt động</label>}>
      <div className="space-y-3">{plans.map((plan) => <article key={plan.id} className="rounded-xl border border-equine-line p-4">
        {editingPlan === plan.id ? <form onSubmit={(event) => onUpdate(event, plan.id)} className="grid gap-2 sm:grid-cols-2">
          <Field label="Tên giai đoạn" name="stage_name" required defaultValue={plan.stage_name} />
          <Field label="Cự ly mục tiêu (m)" name="target_distance_meters" type="number" min={1} defaultValue={plan.target_distance_meters} />
          <Field label="Khối lượng mục tiêu (phút/tuần)" name="target_workload_minutes" type="number" min={1} max={1440} defaultValue={plan.target_workload_minutes} />
          <SelectField label="Mặt sân ưu tiên" name="target_track_surface" defaultValue={plan.target_track_surface ?? ""} options={[["", "Chưa chọn"], ["Dirt", "Đất"], ["Turf", "Cỏ"], ["Synthetic", "Nhân tạo"]]} />
          <Field label="Ngày bắt đầu" name="start_date" type="date" defaultValue={plan.start_date} />
          <Field label="Ngày kết thúc" name="end_date" type="date" defaultValue={plan.end_date} />
          <SelectField label="Cường độ" name="target_intensity" defaultValue={plan.target_intensity ?? ""} options={[["", "Chưa đặt"], ["Low", "Thấp"], ["Medium", "Vừa"], ["High", "Cao"]]} />
          <Field label="Hạn sửa trước buổi tập (giờ)" name="update_deadline_hours" type="number" min={0} defaultValue={plan.update_deadline_hours} />
          <TextArea label="Mục tiêu" name="objective" defaultValue={plan.objective} />
          <div className="flex items-end gap-2"><button className="gold-button" disabled={busy}><Check size={15} /> Lưu</button><button type="button" className="soft-button" onClick={() => setEditingPlan(null)}><X size={15} /> Bỏ</button></div>
        </form> : <div className="flex flex-wrap items-start justify-between gap-3">
          <div><div className="flex items-center gap-2"><h3 className="font-semibold text-equine-navy">{plan.stage_name}</h3><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${plan.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{plan.is_active ? "Đang hoạt động" : "Ngoài giai đoạn"}</span></div><p className="mt-1 text-sm text-slate-600">{plan.start_date ?? "—"} → {plan.end_date ?? "—"} · {plan.target_distance_meters ?? "—"} m · {plan.target_workload_minutes ? `${plan.target_workload_minutes} phút/tuần` : "Chưa đặt khối lượng"} · {plan.target_track_surface ?? "Chưa chọn mặt sân"} · {plan.target_intensity ?? "Chưa đặt cường độ"}</p><p className="mt-1 text-xs text-slate-500">{plan.objective || "Chưa có mục tiêu"} · {plan.training_schedules_count} buổi đã gắn</p></div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="gold-button" disabled={busy || Boolean(plan.end_date && plan.end_date < today())} title={plan.end_date && plan.end_date < today() ? "Giai đoạn này đã kết thúc" : undefined} onClick={() => onSchedule(plan)}><CalendarDays size={14} /> Lên lịch buổi tập</button>
            <button type="button" className="soft-button" disabled={busy} onClick={() => { setConfirmDelete(null); setEditingPlan(plan.id); }}><Pencil size={14} /> Sửa</button>
            {plan.training_schedules_count === 0 ? <button type="button" className="soft-button text-rose-700" disabled={busy} onClick={() => setConfirmDelete(confirmDelete === plan.id ? null : plan.id)}><Trash2 size={14} /> Xóa</button> : <button type="button" className="soft-button cursor-not-allowed text-slate-400" disabled title="Giáo án đang gắn với lịch tập; giữ lại để bảo toàn lịch sử."><Trash2 size={14} /> Đang dùng</button>}
          </div>
        </div>}
        {confirmDelete === plan.id && editingPlan !== plan.id && <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800"><span>Xóa giáo án “{plan.stage_name}”? Thao tác này không thể hoàn tác.</span><div className="flex gap-2"><button type="button" className="soft-button" disabled={busy} onClick={() => setConfirmDelete(null)}>Giữ lại</button><button type="button" className="soft-button border-rose-200 bg-rose-600 text-white hover:bg-rose-700" disabled={busy} onClick={() => { setConfirmDelete(null); onDelete(plan.id); }}><Trash2 size={14} /> Xác nhận xóa</button></div></div>}
      </article>)}{plans.length === 0 && <Notice>Chưa có giáo án cho ngựa này.</Notice>}</div>
    </Section>
  </div>;
}

function sessionTypeLabel(value: string) {
  return ({ Training: "Huấn luyện", TrialRun: "Chạy thử", Rest: "Nghỉ" } as Record<string, string>)[value] ?? value;
}

function scheduleStatusLabel(value: string) {
  return ({ Scheduled: "Đã lên lịch", Blocked: "Chờ xử lý y tế", InProgress: "Đang diễn ra", Completed: "Hoàn thành", Cancelled: "Đã hủy" } as Record<string, string>)[value] ?? value;
}

function CalendarPanel({ horses, sessions, grooms, from, setFrom, to, setTo, scheduleDraft, onDraftUsed, onCreate, onAssign, onStatus, onMetrics, onVideo, showMetricsFor, setShowMetricsFor, busy }: {
  horses: Horse[]; sessions: TrainingSession[]; grooms: Groom[]; from: string; setFrom: (value: string) => void;
  to: string; setTo: (value: string) => void; onCreate: (event: FormEvent<HTMLFormElement>) => void;
  scheduleDraft: { horseId: string; planId: string; startDate: string | null } | null; onDraftUsed: () => void;
  onAssign: (id: string, groomId: number) => void; onStatus: (id: string, status: string) => void;
  onMetrics: (event: FormEvent<HTMLFormElement>, id: string) => void; onVideo: (event: FormEvent<HTMLFormElement>, id: string) => void; showMetricsFor: string | null;
  setShowMetricsFor: (id: string | null) => void; busy: boolean;
}) {
  const [createHorse, setCreateHorse] = useState(horses[0]?.id ?? "");
  const [horsePlans, setHorsePlans] = useState<TrainingPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [scheduleDefaults] = useState(() => suggestedTrainingWindow());
  const createFormRef = useRef<HTMLFormElement>(null);
  const selectedPlan = horsePlans.find((plan) => plan.id === selectedPlanId);
  useEffect(() => { setCreateHorse((id) => horses.some((horse) => horse.id === id) ? id : horses[0]?.id ?? ""); }, [horses]);
  useEffect(() => {
    if (scheduleDraft) {
      setCreateHorse(scheduleDraft.horseId);
      setSelectedPlanId(scheduleDraft.planId);
    }
  }, [scheduleDraft]);
  useEffect(() => {
    if (scheduleDraft) createFormRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [scheduleDraft]);
  useEffect(() => {
    let active = true;
    if (createHorse) headTrainerApi.plans(createHorse).then((result) => {
      if (!active) return;
      setHorsePlans(result.data);
      setSelectedPlanId((current) => result.data.some((plan) => plan.id === current) ? current : "");
    }).catch(() => { if (active) { setHorsePlans([]); setSelectedPlanId(""); } });
    else setHorsePlans([]);
    return () => { active = false; };
  }, [createHorse]);
  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 15000);
    return () => window.clearInterval(interval);
  }, []);
  return <div className="space-y-5">
    <Section title="Tạo buổi tập" description="Ngựa không thể có lịch tập chồng thời gian." icon={Plus}>
      <form ref={createFormRef} onSubmit={onCreate} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SelectField label="Ngựa" name="horse_id" value={createHorse} onChange={(id) => { setCreateHorse(id); setSelectedPlanId(""); onDraftUsed(); }} options={horses.map((horse) => [horse.id, horse.horse_name])} />
        <SelectField label="Giáo án" name="training_plan_id" value={selectedPlanId} onChange={setSelectedPlanId} options={[["", "Không gắn giáo án"], ...horsePlans.map((plan) => [plan.id, plan.stage_name] as [string, string])]} />
        <SelectField label="Loại buổi" name="session_type" options={[["Training", "Huấn luyện"], ["TrialRun", "Chạy thử"], ["Rest", "Nghỉ"]]} />
        <Field label="Mặt sân" name="track_surface" placeholder="Cát, cỏ…" />
        <Field label="Ngày" name="event_date" type="date" required min={selectedPlan?.start_date && selectedPlan.start_date > today() ? selectedPlan.start_date : today()} max={selectedPlan?.end_date ?? undefined} defaultValue={scheduleDraft?.startDate && scheduleDraft.startDate > today() ? scheduleDraft.startDate : scheduleDefaults.date} />
        <Field label="Bắt đầu (24 giờ)" name="start_time" type="text" required defaultValue={scheduleDefaults.start} maxLength={5} pattern="([01][0-9]|2[0-3]):[0-5][0-9]" placeholder="HH:mm" title="Nhập giờ theo dạng 24 giờ, ví dụ 06:30" />
        <Field label="Kết thúc (24 giờ)" name="end_time" type="text" required defaultValue={scheduleDefaults.end} maxLength={5} pattern="([01][0-9]|2[0-3]):[0-5][0-9]" placeholder="HH:mm" title="Nhập giờ theo dạng 24 giờ, ví dụ 07:30" />
        <SelectField label="Groom" name="assigned_groom_id" options={[["", "Chưa phân công"], ...grooms.map((groom) => [String(groom.user_id), groom.full_name] as [string, string])]} />
        <TextArea label="Ghi chú" name="notes" rows={2} />
        <div className="flex items-end"><button className="gold-button w-full" disabled={busy}><CalendarDays size={15} /> Tạo lịch</button></div>
      </form>
    </Section>
    <Section title="Lịch tập" description="Chỉ bắt đầu trong khung giờ đã đặt; chỉ ghi chỉ số sau khi buổi tập hoàn tất." icon={CalendarDays}>
      <div className="mb-4 grid max-w-lg gap-3 sm:grid-cols-2"><Field label="Từ ngày" name="from" type="date" value={from} onChange={setFrom} /><Field label="Đến ngày" name="to" type="date" value={to} onChange={setTo} /></div>
      <div className="space-y-3">{sessions.map((session) => {
        const window = sessionWindow(session);
        const insideTimeWindow = Boolean(window && nowMs >= window.start && nowMs < window.end);
        const afterTimeWindow = Boolean(window && nowMs >= window.end);
        const canStart = session.status === "Scheduled" && session.session_type !== "Rest" && insideTimeWindow;
        const canComplete = afterTimeWindow && (session.status === "InProgress" || (session.status === "Scheduled" && session.session_type === "Rest"));
        const isOpen = ["Scheduled", "Blocked", "InProgress"].includes(session.status);
        return <article key={session.training_schedule_id} className="rounded-xl border border-equine-line p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <HorsePhoto id={session.horse_id} name={session.horse_name} image={session.image_url} />
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-equine-navy">{session.horse_name}</h3><span className="rounded-full bg-equine-mist px-2 py-1 text-[10px] font-bold text-equine-navy">{sessionTypeLabel(session.session_type)}</span><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">{scheduleStatusLabel(session.status)}</span></div><p className="mt-1 text-sm text-slate-600">{session.event_date} · {session.start_time ?? "Cả ngày"}{session.end_time ? `–${session.end_time}` : ""} · {session.track_surface || "Chưa chọn mặt sân"}</p><p className="mt-1 text-xs text-slate-500">Giáo án: {session.plan_stage_name ?? "Chưa gắn"} · Groom: {session.groom_name ?? "Chưa phân công"}</p>{(session.plan_target_distance_meters != null || session.plan_target_intensity) && <p className="mt-1 text-xs font-medium text-equine-navy">Chỉ tiêu giai đoạn: {session.plan_target_distance_meters != null ? `${session.plan_target_distance_meters} m` : ""}{session.plan_target_distance_meters != null && session.plan_target_intensity ? " · " : ""}{session.plan_target_intensity ? `Cường độ ${{ Low: "thấp", Medium: "vừa", High: "cao" }[session.plan_target_intensity]}` : ""}</p>}{session.plan_objective && <p className="mt-1 text-sm text-slate-600">Mục tiêu giáo án: {session.plan_objective}</p>}{session.notes && <p className="mt-1 text-sm text-slate-600">Ghi chú buổi tập: {session.notes}</p>}</div>
          <div className="flex flex-wrap gap-2">
            <select aria-label={`Phân công Groom cho ${session.horse_name}`} className="field-control min-w-40 px-2" value={session.assigned_groom_id ?? ""} disabled={session.status !== "Scheduled" || busy} onChange={(event) => event.target.value && onAssign(session.training_schedule_id, Number(event.target.value))}><option value="">Gán Groom…</option>{grooms.map((groom) => <option key={groom.user_id} value={groom.user_id}>{groom.full_name}</option>)}</select>
            <button type="button" className="soft-button" disabled={session.status !== "Completed"} onClick={() => setShowMetricsFor(showMetricsFor === session.training_schedule_id ? null : session.training_schedule_id)}><HeartPulse size={14} /> Chỉ số</button>
            {canStart && <button type="button" className="gold-button" disabled={busy} onClick={() => onStatus(session.training_schedule_id, "InProgress")}><Play size={14} /> Bắt đầu tập</button>}
            {session.status === "Scheduled" && session.session_type !== "Rest" && <span className="self-center text-xs text-slate-500">{window && nowMs < window.start ? `Bắt đầu lúc ${session.start_time?.slice(0, 5)}` : "Khung giờ bắt đầu đã qua"}</span>}
            {session.status === "InProgress" && <button type="button" className="soft-button" disabled={busy || !canComplete} title={!canComplete ? `Có thể hoàn tất sau ${session.end_time?.slice(0, 5) ?? "giờ kết thúc"}` : undefined} onClick={() => onStatus(session.training_schedule_id, "Completed")}><Check size={14} /> Hoàn tất</button>}
            {session.status === "Scheduled" && session.session_type === "Rest" && canComplete && <button type="button" className="soft-button" disabled={busy} onClick={() => onStatus(session.training_schedule_id, "Completed")}><Check size={14} /> Hoàn tất nghỉ</button>}
            {isOpen && <button type="button" className="soft-button text-rose-700" disabled={busy} onClick={() => onStatus(session.training_schedule_id, "Cancelled")}><X size={14} /> Hủy</button>}
          </div>
        </div>
        {showMetricsFor === session.training_schedule_id && <SessionMetrics session={session} onMetrics={onMetrics} onVideo={onVideo} busy={busy} />}
      </article>;
      })}{sessions.length === 0 && <Notice>Không có buổi tập trong khoảng ngày này.</Notice>}</div>
    </Section>
  </div>;
}

function SessionMetrics({ session, onMetrics, onVideo, busy }: { session: TrainingSession; onMetrics: (event: FormEvent<HTMLFormElement>, id: string) => void; onVideo: (event: FormEvent<HTMLFormElement>, id: string) => void; busy: boolean }) {
  const [detail, setDetail] = useState<TrainingSession | null>(null);
  useEffect(() => { headTrainerApi.schedule(session.training_schedule_id).then(setDetail).catch(() => setDetail(session)); }, [session, session.training_schedule_id]);
  return <div className="mt-4 grid gap-4 border-t border-equine-line pt-4 lg:grid-cols-[1fr_1fr]">
    <div><h4 className="text-sm font-semibold text-equine-navy">Lịch sử chỉ số</h4><div className="mt-2 space-y-2">{detail?.metrics?.map((metric) => <div key={metric.id} className="rounded-lg bg-slate-50 p-3 text-xs"><p className="font-semibold">{metricDate(metric.recorded_at)} · {metric.body_weight_kg ?? "—"} kg · {metric.max_heart_rate ?? "—"} bpm · {metric.avg_speed_kmh ?? "—"} km/h · thể lực {metric.stamina_score ?? "—"}</p>{metric.trainer_review && <p className="mt-1 text-slate-600">{metric.trainer_review}</p>}{metric.has_injury_alert && <p className="mt-1 text-rose-700">Có cảnh báo sức khỏe</p>}</div>)}{!detail?.metrics?.length && <p className="text-xs text-slate-500">Chưa ghi chỉ số.</p>}</div></div>
    <form onSubmit={(event) => onMetrics(event, session.training_schedule_id)} className="grid gap-2 sm:grid-cols-2"><h4 className="sm:col-span-2 text-sm font-semibold text-equine-navy">Ghi chỉ số mới</h4><Field label="Cân nặng (kg)" name="body_weight_kg" type="number" min={100} max={900} step="0.1" required /><Field label="Nhịp tim tối đa" name="max_heart_rate" type="number" min={20} max={260} required /><Field label="Tốc độ TB (km/h)" name="avg_speed_kmh" type="number" min={0} max={90} step="0.1" required /><Field label="Điểm thể lực" name="stamina_score" type="number" min={0} max={10} step="0.1" required /><TextArea label="Đánh giá của HLV" name="trainer_review" rows={2} /><div className="flex items-end"><button className="gold-button" disabled={busy}><Plus size={14} /> Lưu chỉ số</button></div></form>
    <form onSubmit={(event) => onVideo(event, session.training_schedule_id)} className="mt-4 grid gap-2 border-t border-equine-line pt-4 sm:grid-cols-2">
      <h4 className="sm:col-span-2 text-sm font-semibold text-equine-navy">Chia sẻ video với Horse Owner</h4>
      <Field label="Đường dẫn HTTPS" name="video_url" type="url" required placeholder="https://..." />
      <Field label="Mô tả" name="description" maxLength={255} placeholder="Buổi tập hoặc nội dung video" />
      <div className="flex items-end"><button className="soft-button" disabled={busy}><Plus size={14} /> Chia sẻ video</button></div>
    </form>
  </div>;
}

function sessionWindow(session: TrainingSession) {
  if (!session.start_time || !session.end_time) return null;
  const start = new Date(`${session.event_date}T${session.start_time.slice(0, 5)}:00`).getTime();
  const end = new Date(`${session.event_date}T${session.end_time.slice(0, 5)}:00`).getTime();
  return Number.isFinite(start) && Number.isFinite(end) ? { start, end } : null;
}

function RaceEntriesPanel({ selectedHorse, races, entries, onRegister, onRecordResult, busy }: {
  selectedHorse: Horse | null; races: RaceOption[]; entries: Record<string, unknown>[];
  onRegister: (id: string) => void;
  onRecordResult: (id: string, input: { result_position: number; prize_amount: number }) => void;
  busy: boolean;
}) {
  const [raceId, setRaceId] = useState("");
  function submitResult(event: FormEvent<HTMLFormElement>, entry: Record<string, unknown>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    onRecordResult(String(entry.id), {
      result_position: Number(values.get("result_position")),
      prize_amount: Number(values.get("prize_amount")),
    });
  }
  const isReady = selectedHorse?.readiness_status === "Ready";
  return <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
    <Section title="Đăng ký vào giải" description={selectedHorse ? selectedHorse.horse_name + " · chỉ giải từ hôm nay trở đi" : "Chọn ngựa"} icon={Flag}>
      {selectedHorse?.is_training_locked && <Notice error>Ngựa đang khóa huấn luyện và chưa thể đăng ký.</Notice>}
      {selectedHorse && !isReady && <Notice error>Vet cần đánh giá ngựa sẵn sàng thi đấu trước khi đăng ký giải.</Notice>}
      <label className="block"><span className="field-label">Giải đấu</span><select className="field-control px-3" value={raceId} onChange={(event) => setRaceId(event.target.value)}><option value="">Chọn giải…</option>{races.map((race) => <option key={race.id} value={race.id}>{race.race_name} · {race.race_date} · {race.distance_meters ?? "?"} m</option>)}</select></label>
      <button type="button" className="gold-button mt-3" disabled={busy || !raceId || !selectedHorse || selectedHorse.is_training_locked || !isReady} onClick={() => onRegister(raceId)}><Plus size={15} /> Đăng ký ngựa</button>
      <p className="mt-2 text-xs text-slate-500">Hệ thống từ chối nếu ngựa đã có hoạt động khác cùng ngày.</p>
    </Section>
    <Section title="Lịch sử giải đấu" description={entries.length + " thành tích"} icon={Medal}>
      <div className="space-y-3">{entries.map((entry, index) => {
        const pendingResult = entry.status === "Registered" && String(entry.race_date ?? "") <= today();
        return <article key={String(entry.id ?? index)} className="rounded-lg border border-equine-line p-3">
          <div className="flex items-center justify-between gap-3"><div><p className="font-semibold text-equine-navy">{String(entry.race_name ?? "Giải đấu")}</p><p className="text-xs text-slate-500">{String(entry.race_date ?? "")} · {String(entry.location ?? "")}</p></div><span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">{entry.result_position == null ? String(entry.status ?? "Registered") : "Hạng " + String(entry.result_position)}</span></div>
          {pendingResult && <form onSubmit={(event) => submitResult(event, entry)} className="mt-3 grid gap-2 border-t border-equine-line pt-3 sm:grid-cols-3">
            <Field label="Vị trí" name="result_position" type="number" min={1} step="1" required />
            <Field label="Tiền thưởng" name="prize_amount" type="number" min={0} step="0.01" required defaultValue="0" />
            <div className="flex items-end"><button className="soft-button" disabled={busy}><Medal size={14} /> Lưu kết quả</button></div>
          </form>}
        </article>;
      })}{!entries.length && <Notice>Ngựa này chưa được đăng ký vào giải nào.</Notice>}</div>
    </Section>
  </div>;
}
function SimulationPanel({ horses, selectedIds, setSelectedIds, sessions, simulation, ranking, progress, vitals, onStart, onRetryFinish, finishFailed, busy }: {
  horses: Horse[]; selectedIds: string[]; setSelectedIds: (ids: string[]) => void; sessions: TrainingSession[];
  simulation: Simulation | null; ranking: { rank: number; horse_id: string; horse_name: string; finish_time_seconds: number }[];
  progress: number; vitals: Record<string, ReturnType<typeof simulatedVitals>>;
  onStart: (event: FormEvent<HTMLFormElement>) => void; onRetryFinish: () => void;
  finishFailed: boolean; busy: boolean;
}) {
  const [distance, setDistance] = useState(1200);
  const [duration, setDuration] = useState(60);
  const selected = horses.filter((horse) => selectedIds.includes(horse.id));
  return <div className="space-y-5">
    <Section title="Tổ chức cuộc đua" description="Chọn từ 2 đến 5 ngựa; hệ thống sẽ lưu thành tích và thứ hạng vào lịch sử giải đấu." icon={Trophy}>
      <form onSubmit={onStart} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Field label="Cự ly (m)" name="distance_meters" type="number" min={400} max={3200} required value={distance} onChange={(value) => setDistance(Number(value))} /><Field label="Thời lượng cuộc đua (giây)" name="duration_seconds" type="number" min={60} max={300} required value={duration} onChange={(value) => setDuration(Number(value))} /><SelectField label="Liên kết buổi tập (tùy chọn)" name="training_schedule_id" options={[["", "Không liên kết"], ...sessions.filter((session) => selectedIds.includes(session.horse_id) && session.status === "Scheduled").map((session) => [session.training_schedule_id, `${session.horse_name} · ${session.event_date}`] as [string, string])]} /><p className="mt-6 text-xs text-slate-500">Kết quả được lưu vào chỉ số sức khỏe và lịch sử giải đấu của từng ngựa.</p></div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{horses.map((horse) => <label key={horse.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${selectedIds.includes(horse.id) ? "border-equine-gold bg-[#fffaf2]" : "border-equine-line bg-white"}`}><input type="checkbox" checked={selectedIds.includes(horse.id)} onChange={(event) => setSelectedIds(event.target.checked ? [...selectedIds, horse.id].slice(0, 5) : selectedIds.filter((id) => id !== horse.id))} /><HorsePhoto id={horse.id} name={horse.horse_name} image={horse.image_url} /><span className="min-w-0 flex-1 truncate text-sm font-semibold text-equine-navy">{horse.horse_name}</span><small className="text-slate-400">{horse.breed ?? ""}</small></label>)}</div>
        <div className="flex flex-wrap items-center gap-3"><button className="gold-button" disabled={busy || selected.length < 2 || selected.length > 5 || Boolean(simulation && simulation.status !== "Completed")}><Play size={15} /> {simulation && simulation.status !== "Completed" ? "Cuộc đua đang chạy" : "Bắt đầu cuộc đua"}</button><p className="text-xs text-slate-500">Thời lượng: {duration}s · cự ly: {distance.toLocaleString("vi-VN")}m · {selected.length}/5 ngựa</p></div>
      </form>
    </Section>
    {simulation && <Section title={simulation.status === "Completed" ? "Kết quả cuộc đua" : "Cuộc đua đang diễn ra"} description={`${simulation.distance_meters.toLocaleString("vi-VN")} m · ${simulation.duration_seconds}s hiển thị · ${Math.round(progress * 100)}%`} icon={simulation.status === "Completed" ? Trophy : Timer}>
      <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-equine-gold transition-[width]" style={{ width: `${progress * 100}%` }} /></div>
      {finishFailed && <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3"><p className="flex-1 text-sm text-rose-800">Chưa lưu được kết quả cuộc đua.</p><button type="button" className="soft-button" onClick={onRetryFinish} disabled={busy}>Thử lưu kết quả lần nữa</button></div>}
      <div className="space-y-3">{(simulation?.horses ?? []).map((horse) => {
        const current = vitals[horse.horse_id] ?? simulatedVitals(horse, progress);
        const position = racePosition(horse, progress);
        return <div key={horse.horse_id} className="overflow-hidden rounded-xl border border-equine-line p-3">
          <div className="mb-2 flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-equine-navy text-xs font-bold text-white">{horse.lane}</span><HorsePhoto id={horse.horse_id} name={horse.horse_name} image={horse.image_url} /><span className="truncate font-semibold text-equine-navy">{horse.horse_name}</span></div><span className="text-xs text-slate-500">Tốc độ nền {horse.base_max_speed_kmh} km/h</span></div>
          <div className="relative h-14 overflow-hidden rounded-lg border border-[#eadfcd] bg-[#f7f3ea]">
            <span aria-hidden="true" className="absolute inset-x-0 top-1/2 h-px bg-white/70" />
            <span aria-hidden="true" className="absolute inset-y-0 right-[7%] border-r-2 border-dashed border-equine-gold/70" />
            <span className="absolute top-1/2 h-12 w-[76px] -translate-y-1/2 transition-[left] duration-100" style={{ left: `calc(${position * 100}% - ${position * 76}px)` }}>
              <RacingHorseSprite />
            </span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-xs sm:grid-cols-4"><span><Gauge size={13} className="mr-1 inline" />{current.speed.toFixed(1)} km/h</span><span><HeartPulse size={13} className="mr-1 inline" />{current.heartRate} bpm</span><span>HA {current.systolic}/{current.diastolic}</span><span className="hidden sm:inline">Làn {horse.lane}</span></div>
          {(current.heartRate > simulation.injury_alert_heart_rate || current.speed > simulation.injury_alert_speed_kmh) && <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">Cảnh báo realtime: nhịp tim hoặc tốc độ đã vượt ngưỡng an toàn.</p>}
        </div>;
      })}</div>
      {ranking.length > 0 && <div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-equine-line text-xs uppercase text-slate-500"><th className="py-2">Hạng</th><th>Ngựa</th><th>Thời gian</th></tr></thead><tbody>{ranking.map((item) => <tr key={item.horse_id} className="border-b border-equine-line/70"><td className="py-2 font-bold">{item.rank}</td><td>{item.horse_name}</td><td>{item.finish_time_seconds.toFixed(2)} giây</td></tr>)}</tbody></table><p className="mt-2 text-xs text-emerald-700">Thứ hạng đã được ghi vào lịch sử giải đấu.</p></div>}
    </Section>}
  </div>;
}

function RacingHorseSprite() {
  return <svg aria-hidden="true" viewBox="0 0 120 72" className="racing-horse h-full w-full">
    <ellipse cx="57" cy="65" rx="39" ry="3" fill="#75583b" opacity=".16" />
    <g className="racing-horse__tail">
      <path d="M31 29 C21 25 19 18 13 16 C16 24 12 28 8 34 C15 33 20 31 24 37" fill="none" stroke="#39241d" strokeWidth="4" strokeLinecap="round" />
    </g>
    <g className="racing-horse__leg racing-horse__leg--hind-a">
      <path d="M38 37 C36 44 30 49 25 55 L20 60" fill="none" stroke="#60351f" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 60 L22 60 L20 63 L15 63 Z" fill="#34251e" />
    </g>
    <g className="racing-horse__leg racing-horse__leg--hind-b">
      <path d="M48 38 C48 45 52 50 57 55 L61 60" fill="none" stroke="#87502e" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M58 60 L64 60 L64 63 L59 63 Z" fill="#34251e" />
    </g>
    <g className="racing-horse__body">
      <path d="M28 25 C34 18 45 17 57 19 C68 20 76 25 78 31 C79 36 72 40 63 41 L39 39 C31 37 25 31 28 25Z" fill="#99542f" />
      <path d="M55 22 C62 20 70 23 76 28 L70 34 C64 31 58 31 51 32Z" fill="#b36a3b" opacity=".75" />
      <path d="M64 30 C67 23 69 13 77 8 C82 5 88 7 93 10 L91 16 C86 15 83 18 82 23 L79 35 L71 39Z" fill="#8d4b2a" />
      <path d="M76 11 C80 4 82 2 85 1 L86 10 C90 4 93 4 96 5 L94 13 L88 19 L82 21Z" fill="#38251e" />
      <path d="M86 10 C91 5 98 6 103 9 L114 9 L109 14 L116 17 L109 21 L100 18 C96 22 91 21 86 18Z" fill="#99542f" />
      <path d="M100 9 C102 12 102 15 100 18" fill="none" stroke="#f3e4cf" strokeWidth="2.3" strokeLinecap="round" />
      <circle cx="105" cy="12" r="1.2" fill="#201a17" />
      <path d="M113 16 L117 17" stroke="#38251e" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M56 22 C62 18 70 19 75 24 L69 29 L57 29Z" fill="#d19a4e" />
      <path d="M59 21 L70 21" stroke="#f3d18d" strokeWidth="1.5" />
    </g>
    <g className="racing-horse__leg racing-horse__leg--fore-a">
      <path d="M74 35 C75 42 82 47 88 52 L93 59" fill="none" stroke="#99542f" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M90 59 L97 59 L97 62 L92 62 Z" fill="#34251e" />
    </g>
    <g className="racing-horse__leg racing-horse__leg--fore-b">
      <path d="M81 35 C85 42 82 49 77 55 L74 60" fill="none" stroke="#784329" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M71 60 L78 60 L77 63 L72 63 Z" fill="#34251e" />
    </g>
  </svg>;
}

function HorsePhoto({ id, name, image }: { id: string; name: string; image?: string | null }) {
  return <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-equine-mist"><HorseImage horse={{ id, horse_name: name, image_url: image ?? null } as Horse} /></div>;
}

function Section({ title, description, icon: Icon, children, action }: { title: string; description?: string; icon: typeof Activity; children: ReactNode; action?: ReactNode }) {
  return <section className="rounded-2xl border border-equine-line bg-white p-4 shadow-sm sm:p-5"><div className="mb-4 flex flex-col gap-3 border-b border-equine-line pb-4 sm:flex-row sm:items-start sm:justify-between"><div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-equine-mist text-equine-navy"><Icon size={19} /></span><div><h3 className="font-sans text-lg font-semibold text-equine-navy">{title}</h3>{description && <p className="mt-1 text-sm text-slate-500">{description}</p>}</div></div>{action}</div>{children}</section>;
}

function StatCard({ icon: Icon, label, value, warning = false }: { icon: typeof Activity; label: string; value: string; warning?: boolean }) {
  return <article className={`rounded-xl border p-4 ${warning ? "border-rose-200 bg-rose-50" : "border-equine-line bg-white"}`}><Icon className={warning ? "text-rose-700" : "text-equine-gold"} size={18} /><p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-2xl font-semibold text-equine-navy">{value}</p></article>;
}

function Field({ label, name, type = "text", required = false, defaultValue, value, onChange, maxLength, min, max, step, placeholder, pattern, inputMode, title }: {
  label: string; name: string; type?: string; required?: boolean; defaultValue?: string | number | null;
  value?: string | number; onChange?: (value: string) => void; maxLength?: number; min?: string | number; max?: string | number; step?: string; placeholder?: string;
  pattern?: string; inputMode?: "numeric" | "text" | "decimal" | "search" | "tel" | "url" | "email"; title?: string;
}) {
  return <label className="block"><span className="field-label">{label}{required && <span className="text-rose-600"> *</span>}</span><input name={name} type={type} required={required} maxLength={maxLength} min={min} max={max} step={step} pattern={pattern} inputMode={inputMode} title={title} value={value} defaultValue={value === undefined ? defaultValue ?? "" : undefined} onChange={onChange ? (event) => onChange(event.target.value) : undefined} placeholder={placeholder} className="field-control px-3" /></label>;
}

function SelectField({ label, name, options, value, defaultValue, onChange }: {
  label: string; name: string; options: [string, string][]; value?: string; defaultValue?: string; onChange?: (value: string) => void;
}) {
  return <label className="block"><span className="field-label">{label}</span><select name={name} value={value} defaultValue={value === undefined ? defaultValue : undefined} onChange={onChange ? (event) => onChange(event.target.value) : undefined} className="field-control px-3">{options.map(([optionValue, text]) => <option key={optionValue} value={optionValue}>{text}</option>)}</select></label>;
}

function TextArea({ label, name, required = false, defaultValue, rows = 3 }: { label: string; name: string; required?: boolean; defaultValue?: string | null; rows?: number }) {
  return <label className="block"><span className="field-label">{label}</span><textarea name={name} required={required} defaultValue={defaultValue ?? ""} rows={rows} className="field-control px-3 py-2" /></label>;
}
