"use client";

import { Activity, AlertTriangle, ArrowUpRight, CalendarDays, Check, ClipboardList, Flag, Gauge, HeartPulse, Medal, Pencil, Play, Plus, RefreshCw, Search, Timer, Trash2, Users, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { HorseImage, Notice } from "@/components/horses/HorseUI";
import SessionTargetsEditor from "./SessionTargetsEditor";
import TrainingAnalysisPanel from "./TrainingAnalysisPanel";
import SensorTimeline from "./SensorTimeline";
import RaceTrackVisualization from "./RaceTrackVisualization";
import RaceTrackScene3D, { type RaceTrackRunner } from "./RaceTrackScene3D";
import NotificationCenter from "@/components/shared/NotificationCenter";
import { listHorses, type Horse } from "@/api/horses/api";
import { useDashboardTab } from "@/shared/hooks/use-dashboard-tab";
import {
  headTrainerApi,
  headTrainerError,
  type RaceOption,
  type Simulation,
  type SensorReading,
  type TrainingMetric,
  type TrainingPlan,
  type TrainingSession,
  type TrainerIncident,
  type TrainerHorse,
} from "@/api/head-trainer/api";

type Tab = "overview" | "analysis" | "plans" | "calendar" | "races" | "simulation" | "incidents";
const workspaceTabIds: readonly Tab[] = ["overview", "plans", "calendar", "simulation", "analysis", "races", "incidents"];
type Groom = { user_id: number; full_name: string; email: string };
type SensorVitals = { speed: number; heartRate: number; systolic: number; diastolic: number };
const distanceOptions: [string, string][] = [["", "Chọn cự ly"], ...Array.from({ length: 15 }, (_, index) => {
  const distance = String((index + 2) * 200);
  return [distance, `${Number(distance).toLocaleString("vi-VN")} m`] as [string, string];
})];
function distanceOptionsWithCurrent(value?: number | null): [string, string][] {
  if (value == null || distanceOptions.some(([distance]) => distance === String(value))) return distanceOptions;
  return [...distanceOptions, [String(value), `${Number(value).toLocaleString("vi-VN")} m (hiện tại)`]];
}
const tabs: { id: Tab; label: string; icon: typeof Activity }[] = [
  { id: "overview", label: "Tổng quan", icon: Activity },
  { id: "plans", label: "Giáo án", icon: ClipboardList },
  { id: "calendar", label: "Lịch tập", icon: CalendarDays },
  { id: "simulation", label: "Giả lập", icon: Timer },
  { id: "analysis", label: "Phân tích thể lực", icon: Gauge },
  { id: "races", label: "Giải đấu", icon: Flag },
  { id: "incidents", label: "Sự cố", icon: AlertTriangle },
];

function surfaceLabel(surface?: string | null) {
  const value = surface?.trim().toLowerCase();
  if (!value) return "Chưa chọn mặt sân";
  if (value === "dirt" || value.includes("đất")) return "Đất · Dirt";
  if (value === "turf" || value === "grass" || value.includes("cỏ")) return "Cỏ · Turf";
  return "Nhân tạo · Synthetic";
}

function dateInputValue(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}
function today() { return dateInputValue(new Date()); }
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
  return dateInputValue(value);
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
  const [incidents, setIncidents] = useState<TrainerIncident[]>([]);
  const [metrics, setMetrics] = useState<TrainingMetric[]>([]);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compare, setCompare] = useState<{ horse_id: string; horse_name: string; metrics: TrainingMetric[] }[]>([]);
  const [raceEntries, setRaceEntries] = useState<Record<string, unknown>[]>([]);
  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [activeSimulations, setActiveSimulations] = useState<Simulation[]>([]);
  const [liveReadings,setLiveReadings] = useState<SensorReading[]>([]);
  const [simulationPhase,setSimulationPhase] = useState("");
  const [ranking, setRanking] = useState<{ rank: number; horse_id: string; horse_name: string; finish_time_seconds: number }[]>([]);
  const [progress, setProgress] = useState(0);
  const [vitals, setVitals] = useState<Record<string, SensorVitals>>({});
  const [activeOnly, setActiveOnly] = useState(false);
  const [plansRevision, setPlansRevision] = useState(0);
  const [analysisRevision, setAnalysisRevision] = useState(0);
  const [includeSimulated, setIncludeSimulated] = useState(true);
  const [from, setFrom] = useState(() => plusDays(today(), -30));
  const [to, setTo] = useState(() => today());
  const [calendarFrom, setCalendarFrom] = useState(() => today());
  const [calendarTo, setCalendarTo] = useState(() => plusDays(today(), 14));
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editingPlan, setEditingPlan] = useState<string | null>(null);
  const [scheduleDraft, setScheduleDraft] = useState<{ horseId: string; planId: string; startDate: string | null } | null>(null);
  const [showMetricsFor, setShowMetricsFor] = useState<string | null>(null);
  const [finishFailed, setFinishFailed] = useState(false);
  const finishStartedRef = useRef(false);
  const horseRequestRef = useRef(0);
  const horseQueryKey = `${horseId}|${activeOnly}|${from}|${to}|${includeSimulated}`;
  const horseQueryRef = useRef(horseQueryKey);
  useEffect(() => {
    horseQueryRef.current = horseQueryKey;
    ++horseRequestRef.current;
  }, [horseQueryKey]);

  const selectedHorse = useMemo(() => horses.find((horse) => horse.id === horseId) ?? null, [horses, horseId]);
  const selectedOverview = useMemo(() => overview.find((horse) => horse.horse_id === horseId), [overview, horseId]);
  const featuredSimulation = activeSimulations.find((item) => item.status === "Running") ?? null;

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
    const [horsePage, overviewPage, groomPage, racePage, incidentPage] = await Promise.all([
      listHorses(), headTrainerApi.overview(includeSimulated), headTrainerApi.grooms(), headTrainerApi.races(),
      headTrainerApi.incidents(),
    ]);
    setHorses(horsePage.items);
    setOverview(overviewPage.data);
    setGrooms(groomPage.data);
    setRaces(racePage.data);
    setIncidents(incidentPage.data);
    setHorseId((current) => current || horsePage.items[0]?.id || "");
    setCompareIds((current) => current.length ? current : horsePage.items.slice(0, 3).map((item) => item.id));
  }, [includeSimulated]);

  async function submitIncidentResult(event: FormEvent<HTMLFormElement>, incidentId: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const resultNote = String(new FormData(form).get("result_note") ?? "").trim();
    const saved = await run(() => headTrainerApi.submitIncidentResult(incidentId, resultNote),
      "Đã gửi kết quả để Club Manager xem xét đóng sự cố.");
    if (saved) {
      form.reset();
      await loadOverview();
    }
  }

  const loadHorseData = useCallback(async () => {
    if (horseQueryRef.current !== horseQueryKey) return;
    const request = ++horseRequestRef.current;
    if (!horseId) { setPlans([]); setMetrics([]); setRaceEntries([]); return; }
    const [planPage, history, entries] = await Promise.all([
      headTrainerApi.plans(horseId, activeOnly),
      headTrainerApi.metrics(horseId, from, to, includeSimulated),
      headTrainerApi.raceEntries(horseId),
    ]);
    if (request !== horseRequestRef.current || horseQueryRef.current !== horseQueryKey) return;
    setPlans(planPage.data);
    setMetrics(history);
    setRaceEntries(entries.data);
  }, [horseId, activeOnly, from, to, includeSimulated, horseQueryKey]);

  const calendarRequestRef = useRef(0);
  const calendarQueryKey = `${calendarFrom}|${calendarTo}`;
  const calendarQueryRef = useRef(calendarQueryKey);
  useEffect(() => { calendarQueryRef.current = calendarQueryKey; ++calendarRequestRef.current; }, [calendarQueryKey]);
  const loadCalendar = useCallback(async () => {
    if(calendarQueryRef.current!==calendarQueryKey) return;
    const request=++calendarRequestRef.current;
    const data = await headTrainerApi.calendar(calendarFrom, calendarTo);
    if(request===calendarRequestRef.current && calendarQueryRef.current===calendarQueryKey)setSessions(data.data);
  }, [calendarFrom, calendarTo, calendarQueryKey]);

  useEffect(() => {
    if (tab !== "calendar") return;
    let active = true;
    const timer = window.setInterval(() => {
      loadCalendar().catch((reason) => { if (active) setError(headTrainerError(reason)); });
    }, 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, [tab, loadCalendar]);

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
  }, [tab, loadHorseData, loadCalendar, plansRevision]);

  useEffect(() => {
    if (tab !== "overview" || !compareIds.length) { setCompare([]); return; }
    let active = true;
    headTrainerApi.compare(compareIds.slice(0, 8), from, to, includeSimulated)
      .then((response) => { if (active) setCompare(response.horses); })
      .catch((reason) => { if (active) setError(headTrainerError(reason)); });
    return () => { active = false; };
  }, [tab, compareIds, from, to, includeSimulated, analysisRevision]);

  const finishSimulation = useCallback(async (currentSimulation: Simulation) => {
    if (finishStartedRef.current) return;
    finishStartedRef.current = true;
    setBusy(true); setError(""); setNotice(""); setFinishFailed(false);
    let saved = false;
    try {
      const response = await headTrainerApi.finishSimulation(currentSimulation.simulation_id);
      saved = true;
      setRanking(response.ranking);
      setSimulation((value) => value ? { ...value, status: response.status } : value);
      setNotice("Đã lưu dữ liệu buổi tập vào lịch sử phân tích.");
      setAnalysisRevision((value) => value + 1);
      const detail = await headTrainerApi.simulation(currentSimulation.simulation_id);
      setSimulation(detail); setLiveReadings(detail.readings??[]); setSimulationPhase(detail.phase??"");
      await Promise.all([loadOverview(), loadHorseData(), loadCalendar()]);
    } catch (reason) {
      if (saved) {
        setError("Buổi tập đã được ghi nhận; chưa tải lại được các bảng. Nhấn Làm mới để cập nhật.");
      } else {
        setError(headTrainerError(reason));
        setFinishFailed(true);
        finishStartedRef.current = false;
      }
    } finally {
      setBusy(false);
    }
  }, [loadOverview, loadHorseData, loadCalendar]);

  useEffect(() => {
    let active = true;
    let fetching = false;
    const reload = async () => {
      if (fetching) return;
      fetching = true;
      try {
        const result = await headTrainerApi.activeSimulations();
        if (active) {
          setActiveSimulations(result.data);
          setSimulation(current => current ?? result.data[0] ?? null);
        }
      } catch (reason) { if (active) setError(headTrainerError(reason)); }
      finally { fetching = false; }
    };
    void reload();
    const interval = window.setInterval(() => void reload(), 15000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);

  useEffect(() => {
    if (!simulation || simulation.status !== "Running") return;
    let active = true;
    let fetching = false;
    const tick = async () => {
      if (fetching) return;
      fetching = true;
      try {
        const snapshot = await headTrainerApi.simulation(simulation.simulation_id);
        if (!active) return;
        setProgress(Math.min(1, snapshot.elapsed_seconds / snapshot.duration_seconds));
        setLiveReadings(snapshot.readings??[]); setSimulationPhase(snapshot.phase??"");
        const latest = snapshot.readings?.at(-1);
        if (latest) setVitals(Object.fromEntries(snapshot.horses.map((horse) => [horse.horse_id, {
          speed: latest.speed_kmh, heartRate: latest.heart_rate, systolic: latest.bp_systolic, diastolic: latest.bp_diastolic,
        }])));
        if (snapshot.status !== "Running") {
          setSimulation(snapshot);
          setAnalysisRevision(value=>value+1);
          void Promise.all([loadOverview(),loadHorseData(),loadCalendar()]).catch(reason=>setError(headTrainerError(reason)));
          setNotice(snapshot.status === "Completed" ? "Buổi tập đã hoàn thành và lưu dữ liệu." : "Buổi giả lập đã dừng. Dữ liệu đã thu vẫn được giữ lại.");
        } else if (snapshot.elapsed_seconds >= snapshot.duration_seconds && !finishFailed) {
          await finishSimulation(snapshot);
        }
      } catch (reason) { if (active) setError(headTrainerError(reason)); }
      finally { fetching = false; }
    };
    void tick();
    const interval = window.setInterval(() => { void tick(); }, 5000);
    return () => { active = false; window.clearInterval(interval); };
  }, [simulation, finishSimulation, finishFailed, loadOverview, loadHorseData, loadCalendar]);

  const refresh = useCallback(async () => {
    try { setAnalysisRevision((value) => value + 1); await Promise.all([loadOverview(), loadHorseData(), tab === "calendar" ? loadCalendar() : Promise.resolve()]); }
    catch (reason) { setError(headTrainerError(reason)); }
  }, [loadOverview, loadHorseData, loadCalendar, tab]);

  async function createPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const horseIds = data.getAll("horse_ids").map(String);
    if (horseIds.length === 0) return;
    const result = await run(() => headTrainerApi.createPlan({
      horse_ids: horseIds,
      stage_name: data.get("stage_name"), start_date: data.get("start_date") || null,
      end_date: data.get("end_date") || null, objective: data.get("objective") || null,
      target_distance_meters: Number(data.get("target_distance_meters")) || null,
      target_workload_minutes: Number(data.get("target_workload_minutes")) || null,
      target_track_surface: data.get("target_track_surface") || null,
      target_intensity: data.get("target_intensity"), update_deadline_hours: Number(data.get("update_deadline_hours") ?? 24),
    }), "Đã tạo giáo án.");
    if (result) {
      form.reset();
      setHorseId(horseIds[0]);
      setActiveOnly(false);
      setPlansRevision((current) => current + 1);
    }
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
      update_deadline_hours: Number(data.get("update_deadline_hours") ?? 24),
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
    setScheduleDraft({ horseId, planId: plan.id, startDate: plan.start_date });
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
      target_distance_meters: Number(data.get("session_distance")) || null,
      target_intensity: data.get("session_intensity") || null,
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

  async function openTrainingSimulation(session: TrainingSession, scenario="Normal") {
    const result = await run(() => headTrainerApi.createSimulation({
      horse_ids: [session.horse_id], training_schedule_id: session.training_schedule_id, scenario,
    }));
    if (result) {
      selectSimulation(result); selectTab("simulation");
      setActiveSimulations(current => [...current.filter(item => item.simulation_id !== result.simulation_id), result]);
      await loadCalendar();
    }
  }

  async function startSimulation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const ids = data.getAll("training_schedule_id").map(String);
    const selected = sessions.filter(item => ids.includes(item.training_schedule_id));
    if (!selected.length) { setError("Chọn ít nhất một buổi tập."); return; }
    const scenario = String(data.get("scenario") ?? "Normal");
    const result = await run(() => headTrainerApi.createSimulationGroup(selected.map(session => ({
      horse_ids: [session.horse_id], training_schedule_id: session.training_schedule_id, scenario,
    }))));
    if (result?.data.length) {
      setActiveSimulations(current => [...current.filter(item => !result.data.some(next => next.simulation_id === item.simulation_id)), ...result.data]);
      selectSimulation(result.data[0]);
      await loadCalendar();
    }
  }

  async function restartOutdatedSimulation(current: Simulation) {
    if (!window.confirm("Chạy lại theo vận tốc ngựa đua? Phiên hiện tại sẽ được lưu là gián đoạn; dữ liệu đã thu vẫn được giữ trong lịch sử.")) return;
    const replacement = await run(() => headTrainerApi.restartSimulation(current.simulation_id),
      "Đã lưu phiên cũ và bắt đầu buổi tập theo công thức vận tốc mới.");
    if (replacement) {
      selectSimulation(replacement);
      setActiveSimulations(items => [...items.filter(item => item.simulation_id !== current.simulation_id && item.simulation_id !== replacement.simulation_id), replacement]);
      await loadCalendar();
    }
  }

  function selectSimulation(next: Simulation) {
    setRanking([]); setProgress(next.elapsed_seconds / next.duration_seconds);
    const latest = next.readings?.at(-1);
    setVitals(latest ? Object.fromEntries(next.horses.map(horse => [horse.horse_id, {
      speed: latest.speed_kmh, heartRate: latest.heart_rate, systolic: latest.bp_systolic, diastolic: latest.bp_diastolic,
    }])) : {});
    setLiveReadings(next.readings ?? []); setSimulationPhase(next.phase ?? "");
    setFinishFailed(false); finishStartedRef.current = false; setSimulation(next);
  }

  if (loading) return <div className="mt-10 rounded-2xl border border-equine-line bg-white p-6"><Notice>Đang tải dữ liệu huấn luyện…</Notice></div>;

  return <section className="head-trainer-workspace mt-5" aria-labelledby="head-trainer-title">
    <div className="mb-4 flex items-center justify-between gap-3">
      <div><p className="eyebrow">Phân hệ huấn luyện</p><h2 id="head-trainer-title" className="mt-2 font-sans text-3xl font-semibold text-equine-navy">Điều phối huấn luyện</h2></div>
      <button type="button" onClick={() => void refresh()} className="soft-button" disabled={busy}><RefreshCw size={15} /> Làm mới</button>
    </div>
    <div className="training-hero" hidden={tab !== "overview"}>
      <div className="training-hero__veil" />
      <div className="training-hero__copy">
        <p className="training-hero__eyebrow"><span className={featuredSimulation ? "training-live-dot" : "training-hero__dash"} />{featuredSimulation ? "ĐANG CÓ BUỔI TẬP TRỰC TIẾP" : "TRƯỜNG ĐUA HUẤN LUYỆN"}</p>
        <h3>{featuredSimulation ? `Theo dõi ${featuredSimulation.horses[0]?.horse_name ?? "buổi tập"}` : "Đưa từng buổi tập lên đường đua"}</h3>
        <p>{featuredSimulation ? "Vận tốc, cự ly và chỉ số cơ thể được cập nhật trong lúc ngựa chạy." : "Lên lịch, chọn mặt sân và theo dõi ngựa di chuyển theo dữ liệu mô phỏng."}</p>
        <div className="training-hero__actions">
          <button type="button" className="training-hero__primary" onClick={() => { if (featuredSimulation) selectSimulation(featuredSimulation); selectTab("simulation"); setError(""); setNotice(""); }}>
            <Play size={16} />{featuredSimulation ? "Theo dõi buổi tập" : "Mở giả lập"}<ArrowUpRight size={16} />
          </button>
          <button type="button" className="training-hero__secondary" onClick={() => { selectTab("calendar"); setError(""); setNotice(""); }}><CalendarDays size={16} /> Lịch tập</button>
        </div>
      </div>
      <aside className="training-hero__summary" aria-live="polite">
        {featuredSimulation ? <>
          <div className="training-hero__summary-top"><span>ĐANG TẬP</span><span>{Math.min(100, Math.round(featuredSimulation.elapsed_seconds / Math.max(1, featuredSimulation.duration_seconds) * 100))}%</span></div>
          <strong>{featuredSimulation.horses.length > 1 ? `${featuredSimulation.horses.length} ngựa trên sân` : featuredSimulation.horses[0]?.horse_name}</strong>
          <p>{featuredSimulation.distance_meters.toLocaleString("vi-VN")} m mục tiêu · {surfaceLabel(featuredSimulation.track_surface)}</p>
          <div className="training-hero__progress"><span style={{ width: `${Math.min(100, featuredSimulation.elapsed_seconds / Math.max(1, featuredSimulation.duration_seconds) * 100)}%` }} /></div>
        </> : <>
          <div className="training-hero__summary-top"><span>MẶT SÂN</span><span>03 LOẠI</span></div>
          <strong>Cỏ · Đất · Nhân tạo</strong>
          <p>Hình ảnh trường đua thay đổi theo mặt sân của lịch tập.</p>
          <div className="training-surface-swatches"><i className="grass" /><i className="dirt" /><i className="synthetic" /></div>
        </>}
      </aside>
    </div>
    {error && <Notice error>{error}</Notice>}{notice && <Notice>{notice}</Notice>}
    <div className="mt-4"><NotificationCenter /></div>
    <div className="workspace-secondary-nav trainer-tabs mt-5" role="tablist" aria-label="Chức năng huấn luyện">
      {tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => { selectTab(id); setError(""); setNotice(""); }} className={`trainer-tab ${tab === id ? "is-active" : ""} ${id === "incidents" && tab !== id ? "is-alert" : ""}`}><Icon size={16} />{label}{id === "incidents" && <span className="trainer-tab__count">{incidents.length}</span>}{id === "simulation" && featuredSimulation && <span className="trainer-tab__live">LIVE</span>}</button>)}
    </div>
    <div className="mt-5 space-y-4">
      {tab === "incidents" ? <TrainerIncidentsPanel incidents={incidents} busy={busy} onSubmit={submitIncidentResult} />
        : !horses.length ? <Notice>Chưa có hồ sơ ngựa đang hoạt động.</Notice> : <>
        {tab !== "simulation" && <div className="flex flex-wrap items-center gap-3 rounded-xl border border-equine-line bg-white p-3">
          <label className="text-xs font-bold uppercase tracking-wide text-slate-500" htmlFor="trainer-horse">Ngựa đang xem</label>
          <select id="trainer-horse" className="field-control max-w-sm px-3" value={horseId} onChange={(event) => setHorseId(event.target.value)}>{horses.map((horse) => <option key={horse.id} value={horse.id}>{horse.horse_name}{horse.is_training_locked ? " · Đang khóa" : ""}</option>)}</select>
          {selectedOverview?.is_training_locked && <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700"><AlertTriangle size={14} /> Khóa huấn luyện · {selectedOverview.lock_reason}</span>}
        </div>}
        {tab === "overview" && <OverviewPanel horses={horses} overview={overview} selectedHorseId={horseId} metrics={metrics} compare={compare} compareIds={compareIds} setCompareIds={setCompareIds} from={from} setFrom={setFrom} to={to} setTo={setTo} includeSimulated={includeSimulated} setIncludeSimulated={setIncludeSimulated} />}
        {tab === "analysis" && <TrainingAnalysisPanel horseId={horseId} from={from} to={to} setFrom={setFrom} setTo={setTo} revision={analysisRevision}/>}
        {tab === "plans" && <PlansPanel horse={selectedHorse} horses={horses} plans={plans} activeOnly={activeOnly} setActiveOnly={setActiveOnly} editingPlan={editingPlan} setEditingPlan={setEditingPlan} onCreate={createPlan} onUpdate={updatePlan} onDelete={deletePlan} onSchedule={scheduleFromPlan} busy={busy} />}
        {tab === "calendar" && <CalendarPanel onTargetsSaved={refresh} horses={horses} sessions={sessions} grooms={grooms} from={calendarFrom} setFrom={setCalendarFrom} to={calendarTo} setTo={setCalendarTo} scheduleDraft={scheduleDraft} onDraftUsed={() => setScheduleDraft(null)} onCreate={createSchedule} onAssign={async (id, groomId) => { const result = await run(() => headTrainerApi.assignGroom(id, groomId), "Đã phân công Groom."); if (result) await refresh(); }} onOpenSimulation={openTrainingSimulation} onStatus={async (id, status) => { const result = await run(() => headTrainerApi.updateSchedule(id, { status }), `Đã cập nhật buổi tập: ${status}.`); if (result) await refresh(); }} onMetrics={recordMetrics} onVideo={addTrainingVideo} showMetricsFor={showMetricsFor} setShowMetricsFor={setShowMetricsFor} busy={busy} />}
        {tab === "races" && <RaceEntriesPanel selectedHorse={selectedHorse} horses={horses} races={races} entries={raceEntries} onRecordResult={async (entryId,input) => { const result=await run(()=>headTrainerApi.recordRaceResult(entryId,input),"Race result saved."); if(result) await refresh(); }} onRegister={async (raceId) => { if (!horseId) return; const result = await run(() => headTrainerApi.registerRace(horseId, raceId), "Đã đăng ký ngựa vào giải."); if (result) await refresh(); }} busy={busy} />}
        {tab === "simulation" && <SimulationPanel sessions={sessions} activeSimulations={activeSimulations} onSelectSimulation={selectSimulation} simulation={simulation} readings={liveReadings} phase={simulationPhase} ranking={ranking} progress={progress} vitals={vitals} onStart={startSimulation} onRestartSimulation={restartOutdatedSimulation} onRetryFinish={() => { if (simulation) void finishSimulation(simulation); }} finishFailed={finishFailed} busy={busy} />}
      </>}
    </div>
  </section>;
}

function TrainerIncidentsPanel({ incidents, busy, onSubmit }: {
  incidents: TrainerIncident[];
  busy: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>, incidentId: string) => void | Promise<void>;
}) {
  return <Section title="Sự cố được giao cho bạn" description="Xem hướng dẫn, gửi kết quả xử lý để Club Manager đóng sự cố." icon={AlertTriangle}>
    {!incidents.length ? <p className="text-sm text-slate-500">Hiện chưa có sự cố nào được giao cho bạn.</p>
      : <div className="space-y-3">{incidents.map((incident) => <article key={incident.id} className={`rounded-xl border p-4 ${incident.is_emergency ? "border-rose-300 bg-rose-50/40" : "border-equine-line bg-white"}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h3 className="font-semibold text-equine-navy">{incident.horse_name}</h3>
            <p className="mt-1 text-xs text-slate-500">{incident.groom_name ?? "Groom"} · {new Date(incident.created_at).toLocaleString("vi-VN")}</p>
          </div>
          <div className="flex gap-2"><span className="rounded-full bg-white px-2 py-1 text-xs font-semibold">{incident.status === "InProgress" ? "Đang xử lý" : "Chờ Club Manager đóng"}</span>
            {incident.is_emergency && <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-bold text-rose-800">KHẨN CẤP</span>}
          </div>
        </div>
        <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{incident.issue_description}</p>
        {incident.assignment_note && <p className="mt-3 whitespace-pre-wrap rounded-lg bg-blue-50 p-3 text-sm text-blue-900"><strong>Hướng dẫn:</strong> {incident.assignment_note}</p>}
        {incident.result_note && <p className="mt-3 whitespace-pre-wrap rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900"><strong>Kết quả đã gửi:</strong> {incident.result_note}</p>}
        {incident.status === "InProgress" && <form onSubmit={(event) => void onSubmit(event, incident.id)} className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
          <label className="block"><span className="field-label">Kết quả xử lý</span><textarea className="field-control min-h-20 px-3 py-2" name="result_note" maxLength={2000} required /></label>
          <button className="soft-button self-end" disabled={busy}>Gửi kết quả cho Club Manager</button>
        </form>}
      </article>)}</div>}
  </Section>;
}

function OverviewPanel({ horses, overview, selectedHorseId, metrics, compare, compareIds, setCompareIds, from, setFrom, to, setTo, includeSimulated, setIncludeSimulated }: {
  horses: Horse[]; overview: TrainerHorse[]; selectedHorseId: string; metrics: TrainingMetric[]; compare: { horse_id: string; horse_name: string; metrics: TrainingMetric[] }[];
  compareIds: string[]; setCompareIds: (ids: string[]) => void;
  from: string; setFrom: (value: string) => void; to: string; setTo: (value: string) => void;
  includeSimulated: boolean; setIncludeSimulated: (value: boolean) => void;
}) {
  const [comparisonMetric, setComparisonMetric] = useState<ComparisonMetricKey>("avg_speed_kmh");
  const [prioritySearch, setPrioritySearch] = useState("");
  const selected = overview.find((item) => item.horse_id === selectedHorseId);
  const lockedCount = overview.filter((item) => item.is_training_locked).length;
  const alertCount = overview.filter((item) => item.has_injury_alert).length;
  const normalizedQuery = normalizeHorseSearch(prioritySearch.trim());
  const priorityHorses = overview.filter((item) => !normalizedQuery || normalizeHorseSearch(item.horse_name).includes(normalizedQuery));
  const visiblePriorityHorses = normalizedQuery ? priorityHorses : priorityHorses.slice(0, 8);
  return <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard icon={Users} label="Ngựa đang hoạt động" value={String(horses.length)} />
      <StatCard icon={AlertTriangle} label="Đang khóa huấn luyện" value={String(lockedCount)} warning={lockedCount > 0} />
      <StatCard icon={HeartPulse} label="Cảnh báo ở lần đo gần nhất" value={String(alertCount)} warning={alertCount > 0} />
      <StatCard icon={Activity} label="Có dữ liệu thể lực" value={String(overview.filter((item) => item.recorded_at).length)} />
    </div>
    <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <Section title="Ưu tiên theo dõi" description="Ngựa bị khóa hoặc có cảnh báo gần nhất được xếp lên trước." icon={AlertTriangle}>
        <label className="relative mb-3 block">
          <span className="sr-only">Tìm ngựa theo tên</span>
          <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="search" value={prioritySearch} onChange={(event) => setPrioritySearch(event.target.value)} placeholder="Tìm ngựa theo tên..." className="field-control pl-9 pr-3" />
        </label>
        <div className="space-y-2">{visiblePriorityHorses.map((item) => <div key={item.horse_id} className="flex items-center gap-3 rounded-xl border border-equine-line p-3">
          <HorsePhoto id={item.horse_id} name={item.horse_name} image={item.image_url} />
          <div className="min-w-0 flex-1"><p className="truncate font-semibold text-equine-navy">{item.horse_name}</p><p className="text-xs text-slate-500">{metricDate(item.recorded_at)}</p></div>
          {item.is_training_locked && <span className="rounded-full bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-700">Đang khóa</span>}
          {!item.is_training_locked && item.has_injury_alert && <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">Cảnh báo</span>}
          <span className="text-right text-xs text-slate-600">{item.stamina_score ?? "—"}<small className="block">thể lực</small></span>
        </div>)}{visiblePriorityHorses.length === 0 && <p className="rounded-xl border border-dashed border-equine-line p-4 text-center text-sm text-slate-500">Không tìm thấy ngựa phù hợp.</p>}</div>
      </Section>
      <Section title="So sánh chỉ số theo thời gian" description="Mỗi ngày là một nhóm cột; màu sắc đại diện cho từng ngựa." icon={Activity}>
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

const chartColors = ["#4169e1", "#d17a2b", "#2f855a", "#805ad5", "#d64545", "#159a9c", "#8c5a3c", "#c44b86"];
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

function normalizeHorseSearch(value: string) {
  return value.toLocaleLowerCase("vi").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
}

function formatChartValue(value: number) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value);
}

function chartDateLabel(value: string) {
  return new Date(value + "T12:00:00").toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "2-digit" });
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
      if (value === null || !Number.isFinite(timestamp)) return [];
      const date = new Date(timestamp);
      const dayKey = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
      return [{ metric, value, timestamp, dayKey }];
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
      Chưa có lần đo {definition.label.toLowerCase()} trong khoảng ngày này. Hãy mở rộng khoảng ngày, bật dữ liệu mô phỏng hoặc ghi chỉ số sau khi hoàn tất buổi tập.
    </div>;
  }

  const dateKeys = [...new Set(allPoints.map((point) => point.dayKey))].sort();
  const chartRows = rows.map((row) => {
    const dailyPoints = new Map(row.points.map((point) => [point.dayKey, point] as const));
    return { ...row, dailyPoints };
  });
  const values = chartRows.flatMap((row) => Array.from(row.dailyPoints.values(), (point) => point.value));
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const domainMin = Math.min(0, minValue);
  const valuePadding = Math.max((maxValue - domainMin) * 0.08, Math.abs(maxValue) * 0.06, 0.5);
  const domainMax = Math.max(0, maxValue) + valuePadding;
  const chart = { left: 62, right: 20, top: 24, bottom: 208, height: 300 };
  const groupWidth = Math.max(100, chartRows.length * 19 + 30);
  const plotWidth = Math.max(dateKeys.length * groupWidth, 620 - chart.left - chart.right);
  const effectiveGroupWidth = plotWidth / dateKeys.length;
  const chartWidth = chart.left + plotWidth + chart.right;
  const y = (value: number) => chart.bottom - ((value - domainMin) / (domainMax - domainMin)) * (chart.bottom - chart.top);
  const yTicks = Array.from({ length: 5 }, (_, index) => domainMax - ((domainMax - domainMin) * index) / 4);
  const zeroY = y(0);
  const barGap = 3;
  const barWidth = Math.min(24, Math.max(8, (effectiveGroupWidth - 28 - barGap * Math.max(chartRows.length - 1, 0)) / Math.max(chartRows.length, 1)));

  return <div className="mt-5 space-y-4">
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600">
      {chartRows.map((row) => <span key={row.horse_id} className="inline-flex max-w-full items-center gap-2">
        <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: row.color }} />
        <span className="max-w-40 truncate" title={row.horse_name}>{row.horse_name}</span>
      </span>)}
      <span className="ml-auto text-slate-500">Trục dọc: {definition.label} ({definition.unit})</span>
    </div>
    <div className="overflow-x-auto rounded-xl border border-equine-line bg-[#f7f8fa] px-2 py-2">
      <svg
        viewBox={"0 0 " + chartWidth + " " + chart.height}
        className="block h-[300px] w-full"
        style={{ minWidth: chartWidth }}
        role="img"
        aria-label={"So sánh " + definition.label.toLowerCase() + " của từng ngựa theo ngày (" + definition.unit + ")"}
      >
        <desc>Biểu đồ cột nhóm theo ngày. Mỗi màu đại diện cho một ngựa; nếu có nhiều lần đo trong cùng ngày thì hiển thị lần đo gần nhất.</desc>
        {yTicks.map((tick, index) => {
          const tickY = y(tick);
          return <g key={`y-${index}`}>
            <line x1={chart.left} x2={chartWidth - chart.right} y1={tickY} y2={tickY} stroke={index === yTicks.length - 1 ? "#94a3b8" : "#d9dee7"} />
            <text x={chart.left - 10} y={tickY + 4} textAnchor="end" fill="#6b7280" fontSize="11">{formatChartValue(tick)}</text>
          </g>;
        })}
        <line x1={chart.left} x2={chartWidth - chart.right} y1={zeroY} y2={zeroY} stroke="#94a3b8" />
        {dateKeys.map((dateKey, index) => {
          const center = chart.left + index * effectiveGroupWidth + effectiveGroupWidth / 2;
          const clusterWidth = chartRows.length * barWidth + Math.max(chartRows.length - 1, 0) * barGap;
          const startX = center - clusterWidth / 2;
          return <g key={dateKey}>
            <line x1={center} x2={center} y1={chart.top} y2={chart.bottom} stroke="#e5e7eb" />
            {chartRows.map((row, rowIndex) => {
              const point = row.dailyPoints.get(dateKey);
              if (!point) return null;
              const valueY = y(point.value);
              const barTop = Math.min(zeroY, valueY);
              const barHeight = Math.max(Math.abs(zeroY - valueY), 1);
              return <rect
                key={row.horse_id}
                x={startX + rowIndex * (barWidth + barGap)}
                y={barTop}
                width={barWidth}
                height={barHeight}
                rx="2"
                fill={row.color}
              >
                <title>{row.horse_name + " · " + metricDate(point.metric.recorded_at) + " · " + formatChartValue(point.value) + " " + definition.unit}</title>
              </rect>;
            })}
            <text
              x={center}
              y={chart.bottom + 39}
              textAnchor="end"
              fill="#4b5563"
              fontSize="11"
              transform={"rotate(-25 " + center + " " + (chart.bottom + 39) + ")"}
            >{chartDateLabel(dateKey)}</text>
          </g>;
        })}
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
function PlansPanel({ horse, horses, plans, activeOnly, setActiveOnly, editingPlan, setEditingPlan, onCreate, onUpdate, onDelete, onSchedule, busy }: {
  horse: Horse | null; horses: Horse[]; plans: TrainingPlan[]; activeOnly: boolean; setActiveOnly: (value: boolean) => void;
  editingPlan: string | null; setEditingPlan: (id: string | null) => void;
  onCreate: (event: FormEvent<HTMLFormElement>) => void; onUpdate: (event: FormEvent<HTMLFormElement>, id: string) => void;
  onDelete: (id: string) => void; onSchedule: (plan: TrainingPlan) => void; busy: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [horseSearch, setHorseSearch] = useState("");
  const [selectedHorseIds, setSelectedHorseIds] = useState<string[]>(horse && !horse.is_training_locked ? [horse.id] : []);
  const selectableHorseId = horse && !horse.is_training_locked ? horse.id : null;
  useEffect(() => {
    setSelectedHorseIds(selectableHorseId ? [selectableHorseId] : []);
  }, [selectableHorseId]);
  const canCreate = selectedHorseIds.length > 0 && selectedHorseIds.every((id) => horses.some((item) => item.id === id && !item.is_training_locked));
  const normalizedSearch = normalizeHorseSearch(horseSearch.trim());
  const visibleHorses = horses.filter((item) => normalizeHorseSearch(item.horse_name).includes(normalizedSearch));
  return <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
    <Section title="Tạo giáo án theo giai đoạn" description="Chọn một hoặc nhiều ngựa để dùng chung giáo án." icon={Plus}>
      <form onSubmit={onCreate} className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <span className="field-label">Ngựa áp dụng *</span>
          {selectedHorseIds.map((id) => <input key={id} type="hidden" name="horse_ids" value={id} />)}
          <div className="relative mt-1">
            <Search aria-hidden="true" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="search" value={horseSearch} onChange={(event) => setHorseSearch(event.target.value)} placeholder="Tìm theo tên ngựa..." aria-label="Tìm ngựa theo tên"
              className="field-control pl-9 pr-3" />
          </div>
          <div className="mt-1 grid max-h-44 gap-2 overflow-y-auto rounded-xl border border-equine-line p-3 sm:grid-cols-2">
            {visibleHorses.map((item) => <label key={item.id} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${item.is_training_locked ? "cursor-not-allowed text-slate-400" : "cursor-pointer text-slate-700"}`}>
              <input type="checkbox" value={item.id} checked={selectedHorseIds.includes(item.id)} disabled={busy || item.is_training_locked}
                onChange={(event) => setSelectedHorseIds((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} />
              <span>{item.horse_name}{item.is_training_locked ? " · Đang khóa huấn luyện" : ""}</span>
            </label>)}
            {horses.length === 0 && <span className="text-sm text-slate-500">Chưa có ngựa khả dụng.</span>}
            {horses.length > 0 && visibleHorses.length === 0 && <span className="text-sm text-slate-500">Không tìm thấy ngựa phù hợp.</span>}
          </div>
          <p className="mt-1 text-xs text-slate-500">Các ngựa đã khóa huấn luyện không thể chọn.</p>
        </div>
        <Field label="Tên giai đoạn" name="stage_name" required maxLength={100} />
        <SelectField label="Cự ly mục tiêu (m)" name="target_distance_meters" required options={distanceOptions} />
        <Field label="Khối lượng mục tiêu (phút/tuần)" name="target_workload_minutes" type="number" min={1} required max={1440} />
        <SelectField label="Mặt sân ưu tiên" name="target_track_surface" required options={[["", "Chưa chọn"], ["Dirt", "Đất"], ["Turf", "Cỏ"], ["Synthetic", "Nhân tạo"]]} />
        <Field label="Ngày bắt đầu" name="start_date" type="date" required />
        <Field label="Ngày kết thúc" name="end_date" type="date" required />
        <SelectField label="Cường độ" name="target_intensity" required options={[["Low", "Thấp"], ["Medium", "Vừa"], ["High", "Cao"]]} />
        <Field label="Hạn sửa trước buổi tập (giờ)" name="update_deadline_hours" type="number" min={0} defaultValue={24} />
        <TextArea label="Mục tiêu" name="objective" rows={3} />
        <div className="flex items-end"><button className="gold-button w-full" disabled={busy || !canCreate}><Plus size={15} /> Tạo giáo án</button></div>
      </form>
      <p className="mt-3 text-xs leading-5 text-slate-500">Giáo án được dùng chung cho các ngựa đã chọn. Để bắt đầu thực hiện, chọn giáo án ở danh sách bên cạnh rồi lên lịch từng buổi tập với ngày, giờ và Groom.</p>
    </Section>
    <Section title={horse ? `Giáo án của ${horse.horse_name}` : "Giáo án của ngựa"} description="Giáo án mô tả mục tiêu giai đoạn; lên lịch từng buổi để thực hiện. Có thể sửa trước hạn của buổi tập gần nhất." icon={ClipboardList} action={<label className="inline-flex items-center gap-2 text-xs"><input type="checkbox" checked={activeOnly} onChange={(event) => setActiveOnly(event.target.checked)} />Chỉ đang hoạt động</label>}>
      <div className="space-y-3">{plans.map((plan) => <article key={plan.id} className="rounded-xl border border-equine-line p-4">
        {editingPlan === plan.id ? <form onSubmit={(event) => onUpdate(event, plan.id)} className="grid gap-2 sm:grid-cols-2">
          <Field label="Tên giai đoạn" name="stage_name" required defaultValue={plan.stage_name} />
          <SelectField label="Cự ly mục tiêu (m)" name="target_distance_meters" required defaultValue={String(plan.target_distance_meters ?? "")} options={distanceOptionsWithCurrent(plan.target_distance_meters)} />
          <Field label="Khối lượng mục tiêu (phút/tuần)" name="target_workload_minutes" type="number" min={1} required max={1440} defaultValue={plan.target_workload_minutes} />
          <SelectField label="Mặt sân ưu tiên" name="target_track_surface" required defaultValue={plan.target_track_surface ?? ""} options={[["", "Chưa chọn"], ["Dirt", "Đất"], ["Turf", "Cỏ"], ["Synthetic", "Nhân tạo"]]} />
          <Field label="Ngày bắt đầu" name="start_date" type="date" required defaultValue={plan.start_date} />
          <Field label="Ngày kết thúc" name="end_date" type="date" required defaultValue={plan.end_date} />
          <SelectField label="Cường độ" name="target_intensity" required defaultValue={plan.target_intensity ?? ""} options={[["", "Chưa đặt"], ["Low", "Thấp"], ["Medium", "Vừa"], ["High", "Cao"]]} />
          <Field label="Hạn sửa trước buổi tập (giờ)" name="update_deadline_hours" type="number" min={0} defaultValue={plan.update_deadline_hours} />
          <TextArea label="Mục tiêu" name="objective" defaultValue={plan.objective} />
          <div className="flex items-end gap-2"><button className="gold-button" disabled={busy}><Check size={15} /> Lưu</button><button type="button" className="soft-button" onClick={() => setEditingPlan(null)}><X size={15} /> Bỏ</button></div>
        </form> : <div className="space-y-4">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold text-equine-navy">{plan.stage_name}</h3>
                <span className={"rounded-full px-2.5 py-1 text-xs font-semibold " + (plan.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500")}>
                  {plan.is_active ? "Đang hoạt động" : "Ngoài giai đoạn"}
                </span>
              </div>
              {plan.horse_names && <p className="mt-1 text-sm text-slate-500">Ngựa áp dụng: <span className="font-medium text-slate-700">{plan.horse_names}</span></p>}
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-equine-mist px-3 py-1.5 text-xs font-medium text-equine-navy">
              <ClipboardList size={14} /> {plan.training_schedules_count} buổi gắn giáo án
            </span>
          </header>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-xl bg-slate-50 px-3 py-2.5">
              <p className="text-xs text-slate-500">Thời gian</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{plan.start_date ?? "Chưa đặt ngày"} <span className="font-normal text-slate-400">→</span> {plan.end_date ?? "Chưa đặt ngày"}</p>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2.5">
              <p className="text-xs text-slate-500">Cự ly mục tiêu</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{plan.target_distance_meters == null ? "Chưa đặt" : String(plan.target_distance_meters.toLocaleString("vi-VN")) + " m"}</p>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2.5">
              <p className="text-xs text-slate-500">Khối lượng mục tiêu</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{plan.target_workload_minutes == null ? "Chưa đặt" : String(plan.target_workload_minutes) + " phút / tuần"}</p>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2.5">
              <p className="text-xs text-slate-500">Mặt sân ưu tiên</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{surfaceLabel(plan.target_track_surface)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2.5">
              <p className="text-xs text-slate-500">Cường độ</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{({ Low: "Thấp", Medium: "Vừa", High: "Cao" } as Record<string, string>)[plan.target_intensity ?? ""] ?? "Chưa đặt"}</p>
            </div>
          </div>

          <div className="rounded-xl border border-equine-line px-3 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mục tiêu giai đoạn</p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{plan.objective || "Chưa có mô tả mục tiêu."}</p>
          </div>

          <div className="flex flex-col gap-2 border-t border-equine-line pt-4 sm:flex-row sm:flex-wrap">
            <button type="button" className="gold-button min-h-11 justify-center sm:min-w-52" disabled={busy || Boolean(plan.end_date && plan.end_date < today())} title={plan.end_date && plan.end_date < today() ? "Giai đoạn này đã kết thúc" : undefined} onClick={() => onSchedule(plan)}><CalendarDays size={15} /> Lên lịch buổi tập</button>
            <button type="button" className="soft-button min-h-11 justify-center sm:min-w-28" disabled={busy} onClick={() => { setConfirmDelete(null); setEditingPlan(plan.id); }}><Pencil size={15} /> Sửa giáo án</button>
            {plan.training_schedules_count === 0
              ? <button type="button" className="soft-button min-h-11 justify-center text-rose-700 sm:min-w-28" disabled={busy} onClick={() => setConfirmDelete(confirmDelete === plan.id ? null : plan.id)}><Trash2 size={15} /> Xóa giáo án</button>
              : <button type="button" className="soft-button min-h-11 cursor-not-allowed justify-center text-slate-400 sm:min-w-28" disabled title="Giáo án đang gắn với lịch tập; giữ lại để bảo toàn lịch sử."><Trash2 size={15} /> Đang dùng</button>}
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
  if (value === "Missed") return "B\u1ecf l\u1ee1";
  return ({ Scheduled: "Đã lên lịch", Blocked: "Chờ xử lý y tế", InProgress: "Đang diễn ra", Completed: "Hoàn thành", Cancelled: "Đã hủy", Missed: "Bỏ lỡ" } as Record<string, string>)[value] ?? value;
}

function CalendarPanel({ horses, sessions, grooms, from, setFrom, to, setTo, scheduleDraft, onDraftUsed, onCreate, onAssign, onStatus, onMetrics, onVideo, showMetricsFor, setShowMetricsFor, busy, onOpenSimulation, onTargetsSaved }: {
  horses: Horse[]; sessions: TrainingSession[]; grooms: Groom[]; from: string; setFrom: (value: string) => void;
  to: string; setTo: (value: string) => void; onCreate: (event: FormEvent<HTMLFormElement>) => void;
  scheduleDraft: { horseId: string; planId: string; startDate: string | null } | null; onDraftUsed: () => void;
  onTargetsSaved: () => Promise<void>;
  onOpenSimulation: (session: TrainingSession) => void;
  onAssign: (id: string, groomId: number) => void; onStatus: (id: string, status: string) => void;
  onMetrics: (event: FormEvent<HTMLFormElement>, id: string) => void; onVideo: (event: FormEvent<HTMLFormElement>, id: string) => void; showMetricsFor: string | null;
  setShowMetricsFor: (id: string | null) => void; busy: boolean;
}) {
  const [createHorse, setCreateHorse] = useState(horses[0]?.id ?? "");
  const [horsePlans, setHorsePlans] = useState<TrainingPlan[]>([]);
  const [horsePlansLoading, setHorsePlansLoading] = useState(false);
  const [horsePlansError, setHorsePlansError] = useState("");
  const [plansReload, setPlansReload] = useState(0);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [sessionType, setSessionType] = useState("Training");
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
    setHorsePlans([]);
    setHorsePlansError("");
    if (!createHorse) {
      setHorsePlansLoading(false);
      return () => { active = false; };
    }
    setHorsePlansLoading(true);
    headTrainerApi.plans(createHorse).then((result) => {
      if (!active) return;
      const plans = Array.isArray(result.data) ? result.data : [];
      setHorsePlans(plans);
      setSelectedPlanId((current) => plans.some((plan) => plan.id === current) ? current : "");
    }).catch((reason) => {
      if (!active) return;
      setHorsePlans([]);
      setHorsePlansError(headTrainerError(reason));
    }).finally(() => {
      if (active) setHorsePlansLoading(false);
    });
    return () => { active = false; };
  }, [createHorse, plansReload]);
  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 15000);
    return () => window.clearInterval(interval);
  }, []);
  return <div className="trainer-calendar space-y-5">
    <Section title="Tạo buổi tập" description="Ngựa không thể có lịch tập chồng thời gian." icon={Plus}>
      <form ref={createFormRef} onSubmit={onCreate} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SelectField label="Ngựa" name="horse_id" value={createHorse} onChange={(id) => { setCreateHorse(id); setSelectedPlanId(""); onDraftUsed(); }} options={horses.map((horse) => [horse.id, horse.horse_name])} />
        <SelectField label="Giáo án" name="training_plan_id" required={sessionType !== "Rest"} value={selectedPlanId} onChange={setSelectedPlanId} options={[["", "Không gắn giáo án"], ...horsePlans.map((plan) => [plan.id, plan.stage_name] as [string, string])]} />
        {(horsePlansLoading || horsePlansError || (!horsePlansLoading && !horsePlansError && createHorse && horsePlans.length === 0)) && <div aria-live="polite" className="-mt-2 text-xs text-slate-600 sm:col-span-2 lg:col-span-4">
          {horsePlansLoading && <span>Đang tải giáo án của ngựa…</span>}
          {horsePlansError && <span className="text-rose-700">Không tải được giáo án: {horsePlansError} <button type="button" className="ml-2 underline" onClick={() => setPlansReload((value) => value + 1)}>Thử tải lại</button></span>}
          {!horsePlansLoading && !horsePlansError && createHorse && horsePlans.length === 0 && <span>Ngựa này chưa có giáo án. Hãy tạo giáo án cho đúng ngựa trong tab Giáo án.</span>}
        </div>}
        <SelectField label="Loại buổi" name="session_type" value={sessionType} onChange={setSessionType} options={[["Training", "Huấn luyện"], ["TrialRun", "Chạy thử"], ["Rest", "Nghỉ"]]} />
        <SelectField key={"surface-"+selectedPlanId} label="Mặt sân buổi tập" name="track_surface" required={sessionType !== "Rest"} defaultValue={selectedPlan?.target_track_surface ?? ""} options={[["", "Chọn mặt sân"], ["Dirt", "Đất"], ["Turf", "Cỏ"], ["Synthetic", "Nhân tạo"]]} />
        <SelectField key={"distance-"+selectedPlanId} label="Cự ly buổi tập (m)" name="session_distance" required={sessionType !== "Rest"} defaultValue={String(selectedPlan?.target_distance_meters ?? "")} options={distanceOptionsWithCurrent(selectedPlan?.target_distance_meters)} />
        <SelectField key={"intensity-"+selectedPlanId} label="Cường độ buổi tập" name="session_intensity" required={sessionType !== "Rest"} defaultValue={selectedPlan?.target_intensity ?? ""} options={[["", "Chọn cường độ"], ["Low", "Thấp"], ["Medium", "Vừa"], ["High", "Cao"]]} />
        <Field label="Ngày" name="event_date" type="date" required min={selectedPlan?.start_date && selectedPlan.start_date > today() ? selectedPlan.start_date : today()} max={selectedPlan?.end_date ?? undefined} defaultValue={scheduleDraft?.startDate && scheduleDraft.startDate > today() ? scheduleDraft.startDate : scheduleDefaults.date} />
        <Field label="Bắt đầu (24 giờ)" name="start_time" type="text" required defaultValue={scheduleDefaults.start} maxLength={5} pattern="([01][0-9]|2[0-3]):[0-5][0-9]" placeholder="HH:mm" title="Nhập giờ theo dạng 24 giờ, ví dụ 06:30" />
        <Field label="Kết thúc (24 giờ)" name="end_time" type="text" required defaultValue={scheduleDefaults.end} maxLength={5} pattern="([01][0-9]|2[0-3]):[0-5][0-9]" placeholder="HH:mm" title="Nhập giờ theo dạng 24 giờ, ví dụ 07:30" />
        <SelectField label="Groom" name="assigned_groom_id" options={[["", "Chưa phân công"], ...grooms.map((groom) => [String(groom.user_id), groom.full_name] as [string, string])]} />
        <TextArea label="Ghi chú" name="notes" rows={2} />
        <div className="flex items-end"><button className="gold-button w-full" disabled={busy}><CalendarDays size={15} /> Tạo lịch</button></div>
      </form>
    </Section>
    <Section title="Lịch tập" description="Chỉ bắt đầu trong khung giờ đã đặt; chỉ ghi chỉ số sau khi buổi tập hoàn tất." icon={CalendarDays}>
      <div className="trainer-calendar__filters"><Field label="Từ ngày" name="from" type="date" value={from} onChange={setFrom} /><Field label="Đến ngày" name="to" type="date" value={to} onChange={setTo} /></div>
      <div className="trainer-calendar__list-heading"><div><h4>Danh sách buổi tập</h4><p>Thông tin và thao tác được sắp xếp riêng cho từng buổi.</p></div><span>{sessions.length} buổi</span></div>
      <div className="trainer-calendar__list">{sessions.map((session) => {
        const window = sessionWindow(session);
        const insideTimeWindow = Boolean(window && nowMs >= window.start && nowMs < window.end);
        const afterTimeWindow = Boolean(window && nowMs >= window.end);
        const canStart = Boolean(session.assigned_groom_id) && session.status === "Scheduled" && session.session_type !== "Rest" && insideTimeWindow;
        const canComplete = afterTimeWindow && (session.status === "InProgress" || (session.status === "Scheduled" && session.session_type === "Rest"));
        const isOpen = ["Scheduled", "Blocked", "InProgress"].includes(session.status);
        return <article key={session.training_schedule_id} className="trainer-session-card" data-status={session.status}>
          <div className="trainer-session-card__layout">
            <div className="trainer-session-card__identity">
              <HorsePhoto id={session.horse_id} name={session.horse_name} image={session.image_url} />
              <div className="trainer-session-card__details">
                <div className="trainer-session-card__title"><h3>{session.horse_name}</h3><span className="trainer-session-card__type">{sessionTypeLabel(session.session_type)}</span><span className="trainer-session-card__status" data-status={session.status}>{scheduleStatusLabel(session.status)}</span></div>
                <p className="trainer-session-card__time"><strong>{new Date(`${session.event_date}T12:00:00`).toLocaleDateString("vi-VN", { day: "numeric", month: "long", year: "numeric" })}</strong><span>{session.start_time?.slice(0, 5) ?? "Cả ngày"}{session.end_time ? `–${session.end_time.slice(0, 5)}` : ""}</span><span>{session.track_surface || "Chưa chọn mặt sân"}</span></p>
                <div className="trainer-session-card__meta">
                  <p><span>Giáo án</span><strong>{session.plan_stage_name ?? "Chưa gắn"}</strong></p>
                  <p><span>Groom</span><strong>{session.groom_name ?? "Chưa phân công"}</strong></p>
                  {(session.plan_target_distance_meters != null || session.plan_target_intensity) && <p><span>Chỉ tiêu giai đoạn</span><strong>{session.plan_target_distance_meters != null ? `${session.plan_target_distance_meters.toLocaleString("vi-VN")} m` : ""}{session.plan_target_distance_meters != null && session.plan_target_intensity ? " · " : ""}{session.plan_target_intensity ? `Cường độ ${{ Low: "thấp", Medium: "vừa", High: "cao" }[session.plan_target_intensity]}` : ""}</strong></p>}
                </div>
                {(session.plan_objective || session.notes) && <div className="trainer-session-card__notes">
                  {session.plan_objective && <p><span>Mục tiêu giáo án</span>{session.plan_objective}</p>}
                  {session.notes && <p><span>Ghi chú buổi tập</span>{session.notes}</p>}
                </div>}
              </div>
            </div>
            <aside className="trainer-session-card__actions" aria-label={`Thao tác buổi tập của ${session.horse_name}`}>
              <label><span>Groom phụ trách</span><select aria-label={`Phân công Groom cho ${session.horse_name}`} className="field-control" value={session.assigned_groom_id ?? ""} disabled={session.status !== "Scheduled" || busy} onChange={(event) => event.target.value && onAssign(session.training_schedule_id, Number(event.target.value))}><option value="">Chọn Groom</option>{grooms.map((groom) => <option key={groom.user_id} value={groom.user_id}>{groom.full_name}</option>)}</select></label>
              <button type="button" className="soft-button" disabled={session.status !== "Completed"} onClick={() => setShowMetricsFor(showMetricsFor === session.training_schedule_id ? null : session.training_schedule_id)}><HeartPulse size={14} /> Chỉ số</button>
              {canStart && <button type="button" className="gold-button" disabled={busy} onClick={() => onOpenSimulation(session)}><Play size={14} /> Bắt đầu tập</button>}
              {session.status === "Scheduled" && session.session_type !== "Rest" && <p className="trainer-session-card__hint">{afterTimeWindow ? "Đã qua giờ kết thúc" : !session.assigned_groom_id ? "Cần phân công Groom" : insideTimeWindow ? "Đang trong khung giờ tập" : `Bắt đầu lúc ${session.start_time?.slice(0, 5)}`}</p>}
              {session.status === "InProgress" && <button type="button" className="gold-button" disabled={busy} onClick={() => onOpenSimulation(session)}><Activity size={14} /> Mở lại giả lập</button>}
              {session.status === "InProgress" && <button type="button" className="soft-button" disabled={busy || !canComplete} title={!canComplete ? `Có thể hoàn tất sau ${session.end_time?.slice(0, 5) ?? "giờ kết thúc"}` : undefined} onClick={() => onStatus(session.training_schedule_id, "Completed")}><Check size={14} /> Hoàn tất</button>}
              {session.status === "Scheduled" && session.session_type === "Rest" && canComplete && <button type="button" className="soft-button" disabled={busy} onClick={() => onStatus(session.training_schedule_id, "Completed")}><Check size={14} /> Hoàn tất nghỉ</button>}
              {isOpen && <button type="button" className="soft-button trainer-session-card__cancel" disabled={busy} onClick={() => onStatus(session.training_schedule_id, "Cancelled")}><X size={14} /> Hủy buổi tập</button>}
            </aside>
          </div>
        {session.status === "Scheduled" && !afterTimeWindow && session.session_type !== "Rest" && <SessionTargetsEditor key={`${session.training_schedule_id}-${session.plan_target_distance_meters}-${session.plan_target_intensity}-${session.track_surface}`} session={session} onSaved={onTargetsSaved}/>}
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
  const start = new Date(`${session.event_date}T${session.start_time.slice(0, 5)}:00+07:00`).getTime();
  const end = new Date(`${session.event_date}T${session.end_time.slice(0, 5)}:00+07:00`).getTime();
  return Number.isFinite(start) && Number.isFinite(end) ? { start, end } : null;
}

function formatSimulationDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return minutes > 0 ? `${minutes} phút ${remainingSeconds} giây` : `${remainingSeconds} giây`;
}

function racePreviewSpeed(horseId: string) {
  let hash = 0;
  for (let index = 0; index < horseId.length; index += 1) hash = (hash * 31 + horseId.charCodeAt(index)) >>> 0;
  return 53 + (hash % 90) / 10;
}

function RaceEntriesPanel({ selectedHorse, horses, races, entries, onRegister, onRecordResult, busy }: {
  selectedHorse: Horse | null; horses: Horse[]; races: RaceOption[]; entries: Record<string, unknown>[];
  onRegister: (id: string) => void;
  onRecordResult: (id: string, input: { result_position: number; prize_amount: number }) => void;
  busy: boolean;
}) {
  const [raceId, setRaceId] = useState("");
  const [trackSurface, setTrackSurface] = useState("Turf");
  const [competitorIds, setCompetitorIds] = useState<string[]>(() => selectedHorse ? [selectedHorse.id] : []);
  const [runStartTime, setRunStartTime] = useState<number | null>(null);
  useEffect(() => {
    if (!selectedHorse) return;
    setCompetitorIds((current) => current.includes(selectedHorse.id) || current.length >= 5 ? current : [selectedHorse.id, ...current]);
  }, [selectedHorse?.id]);

  const horsePool = selectedHorse && !horses.some((horse) => horse.id === selectedHorse.id) ? [selectedHorse, ...horses] : horses;
  const availableHorses = horsePool.filter((horse) => !horse.deleted_at);
  const competitors = competitorIds.map((id) => availableHorses.find((horse) => horse.id === id)).filter((horse): horse is Horse => Boolean(horse));
  const raceRunners: RaceTrackRunner[] = competitors.slice(0, 5).map((horse, index) => ({
    id: horse.id,
    name: horse.horse_name,
    lane: index + 1,
    progress: 0,
    speedKmh: racePreviewSpeed(horse.id),
  }));
  const selectedRace = races.find((race) => race.id === raceId);
  const targetDistance = selectedRace?.distance_meters ?? 1600;

  function submitResult(event: FormEvent<HTMLFormElement>, entry: Record<string, unknown>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    onRecordResult(String(entry.id), {
      result_position: Number(values.get("result_position")),
      prize_amount: Number(values.get("prize_amount")),
    });
  }
  const isReady = selectedHorse?.readiness_status === "Ready";
  return <div className="space-y-5">
    <Section title="Mô phỏng thi đấu 3D" description="Dùng nguyên mô hình sân bạn gửi; chọn tối đa năm ngựa để chạy trong năm làn." icon={Flag}>
      <div className="race-competition-layout">
        <div className="min-w-0">
          <RaceTrackScene3D surface={trackSurface} runners={raceRunners} targetDistanceMeters={targetDistance} isRunning={runStartTime != null} runStartTime={runStartTime} />
          <div className="race-lane-legend">
            {raceRunners.map((runner) => <span key={runner.id}><b>{runner.lane}</b>{runner.name}</span>)}
            {!raceRunners.length && <span>Chọn ngựa để đưa vào các làn.</span>}
          </div>
        </div>
        <div className="space-y-4">
          <label className="block"><span className="field-label">Giải đấu</span><select className="field-control px-3" value={raceId} onChange={(event) => { setRaceId(event.target.value); setRunStartTime(null); }}><option value="">Chọn giải…</option>{races.map((race) => <option key={race.id} value={race.id}>{race.race_name} · {race.race_date} · {race.distance_meters ?? "?"} m</option>)}</select></label>
          <SelectField label="Mặt sân 3D" name="preview_track_surface" value={trackSurface} onChange={(value) => { setTrackSurface(value); setRunStartTime(null); }} options={[["Turf", "Cỏ · Turf"], ["Dirt", "Đất · Dirt"], ["Synthetic", "Nhân tạo · Synthetic"]]} />
          <fieldset className="race-competitor-picker">
            <legend className="field-label">Ngựa thi đấu · {competitors.length}/5</legend>
            <div className="race-competitor-picker__list">
              {availableHorses.map((horse) => {
                const checked = competitorIds.includes(horse.id);
                const disabled = !checked && competitorIds.length >= 5;
                return <label key={horse.id} className={`race-competitor-option ${disabled ? "is-disabled" : ""}`}>
                  <input type="checkbox" checked={checked} disabled={disabled} onChange={() => {
                    setRunStartTime(null);
                    setCompetitorIds((current) => checked ? current.filter((id) => id !== horse.id) : current.length < 5 ? [...current, horse.id] : current);
                  }} />
                  <span>{horse.horse_name}</span>
                </label>;
              })}
              {!availableHorses.length && <p className="text-sm text-slate-500">Chưa có ngựa trong danh sách.</p>}
            </div>
          </fieldset>
          <button type="button" className="gold-button w-full justify-center" disabled={!raceRunners.length} onClick={() => setRunStartTime(Date.now())}>
            <Play size={15} />{runStartTime == null ? "Chạy mô phỏng 3D" : "Chạy lại mô phỏng"}
          </button>
          <p className="text-xs leading-5 text-slate-500">Mô phỏng hiển thị trong mô hình 3D; việc đăng ký giải và lưu kết quả vẫn dùng biểu mẫu bên dưới.</p>
        </div>
      </div>
    </Section>

    <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
      <Section title="Đăng ký vào giải" description={selectedHorse ? selectedHorse.horse_name + " · chỉ giải từ hôm nay trở đi" : "Chọn ngựa"} icon={Flag}>
        {selectedHorse?.is_training_locked && <Notice error>Ngựa đang khóa huấn luyện và chưa thể đăng ký.</Notice>}
        {selectedHorse && !isReady && <Notice error>Vet cần đánh giá ngựa sẵn sàng thi đấu trước khi đăng ký giải.</Notice>}
        <p className="text-sm text-slate-600">Giải được chọn: <strong className="text-equine-navy">{selectedRace?.race_name ?? "Chưa chọn"}</strong></p>
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
    </div>
  </div>;
}
function SimulationPanel({ sessions, activeSimulations, onSelectSimulation, simulation, readings, phase, ranking, progress, vitals, onStart, onRestartSimulation, onRetryFinish, finishFailed, busy }: {
  sessions: TrainingSession[]; simulation: Simulation | null; readings: SensorReading[]; phase: string;
  activeSimulations: Simulation[]; onSelectSimulation: (simulation: Simulation) => void;
  onRestartSimulation: (simulation: Simulation) => void;
  ranking: { rank: number; horse_id: string; horse_name: string; finish_time_seconds: number }[];
  progress: number; vitals: Record<string, SensorVitals>;
  onStart: (event: FormEvent<HTMLFormElement>) => void; onRetryFinish: () => void;
  finishFailed: boolean; busy: boolean;
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const eligible = sessions.filter(session => {
    const window = sessionWindow(session);
    return session.session_type !== "Rest" && session.assigned_groom_id && ["Scheduled", "InProgress"].includes(session.status)
      && window && nowMs >= window.start && nowMs < window.end;
  });
  return <div className="space-y-5">
    {activeSimulations.length > 0 && <Section title="Buổi tập đang chạy" description="Chọn phiên để theo dõi; dữ liệu vẫn được ghi nhận khi bạn chuyển ngựa hoặc tải lại trang." icon={Activity}>
      <div className="flex flex-wrap gap-2">{activeSimulations.map(item => <button key={item.simulation_id} type="button" className={item.simulation_id === simulation?.simulation_id ? "gold-button" : "soft-button"} disabled={busy} onClick={() => onSelectSimulation(item)}>
        {item.horses[0]?.horse_name} · {Math.round(item.elapsed_seconds / item.duration_seconds * 100)}%
      </button>)}</div>
    </Section>}
    {simulation && <section className="training-live-card" aria-label="Theo dõi buổi tập">
      <header className="training-live-card__header">
        <div>
          <div className="training-live-card__eyebrow"><span className={simulation.status === "Running" ? "training-live-dot" : "training-hero__dash"} />{{Running: "ĐANG TẬP", Completed: "ĐÃ HOÀN THÀNH", Interrupted: "ĐÃ DỪNG"}[simulation.status] ?? simulation.status}</div>
          <h3>{simulation.horses[0]?.horse_name ?? "Buổi tập"}{simulation.horses.length > 1 ? ` + ${simulation.horses.length - 1} ngựa` : ""}</h3>
          <p>{surfaceLabel(simulation.track_surface)} · Cường độ {simulation.target_intensity ?? "Medium"} · {formatSimulationDuration(simulation.elapsed_seconds)} đã trôi qua</p>
        </div>
        <div className="training-live-card__percent"><strong>{Math.round(progress * 100)}%</strong><span>thời lượng</span></div>
      </header>
      <div className="training-live-card__progress"><span style={{ width: `${progress * 100}%` }} /></div>
      {simulation.model_version != null && simulation.model_version < 5 && <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
        <p className="text-sm font-semibold text-amber-950">Phiên này được tạo bằng công thức vận tốc cũ.</p>
        <p className="mt-1 text-xs text-amber-900">Có thể chạy lại ngay theo cường độ và vận tốc ngựa đua; dữ liệu phiên cũ vẫn được giữ trong lịch sử.</p>
        {simulation.status === "Running" && simulation.training_schedule_id && <button type="button" className="gold-button mt-3" disabled={busy} onClick={() => onRestartSimulation(simulation)}><RefreshCw size={14}/> Chạy lại theo công thức mới</button>}
      </div>}
      {simulation.horses[0] && <RaceTrackVisualization horseName={simulation.horses[0].horse_name} horseId={simulation.horses[0].horse_id} readings={readings}
        targetDistance={simulation.distance_meters} currentSpeed={vitals[simulation.horses[0].horse_id]?.speed ?? readings.at(-1)?.speed_kmh ?? 0}
        surface={simulation.track_surface} isRunning={simulation.status === "Running"}/>}
      <div className="training-vitals-grid">
        {simulation.horses.map((horse) => {
          const current = vitals[horse.horse_id];
          return <article key={horse.horse_id} className="training-vitals-card">
            <div className="training-vitals-card__horse"><HorsePhoto id={horse.horse_id} name={horse.horse_name} image={horse.image_url}/><strong>{horse.horse_name}</strong></div>
            {current ? <div className="training-vitals-card__values">
              <div><span>Tốc độ</span><strong>{Number(current.speed).toFixed(1)} <small>km/h</small></strong></div>
              <div><span>Nhịp tim</span><strong>{current.heartRate} <small>bpm</small></strong></div>
              <div><span>Huyết áp mô phỏng</span><strong>{current.systolic}/{current.diastolic}</strong></div>
            </div> : <p className="text-sm text-slate-500">Đang tải chỉ số…</p>}
            {current && (current.heartRate > simulation.injury_alert_heart_rate || current.speed > simulation.injury_alert_speed_kmh) && <Notice>Có chỉ số vượt ngưỡng theo dõi; cần xem xét buổi tập.</Notice>}
          </article>;
        })}
      </div>
      <div className="training-live-card__phase"><span>PHA TẬP</span><strong>{({Warmup:"Khởi động",Work:"Vận động chính",Cooldown:"Giảm cường độ",Recovery:"Hồi phục"} as Record<string,string>)[phase] ?? "Đang tải"}</strong>{simulation.distance_meters > 0 && <span>Đích đến {simulation.distance_meters.toLocaleString("vi-VN")} m</span>}</div>
      {simulation.status === "Running" && <p className="mt-3 text-sm text-slate-500">Có thể tải lại trang để tiếp tục theo dõi. Hủy lịch tại tab Lịch tập sẽ dừng giả lập và giữ dữ liệu đã thu.</p>}
      <details className="training-live-card__details"><summary>Biểu đồ cảm biến</summary><div className="pt-4"><SensorTimeline readings={readings}/></div></details>
      {simulation.stop_reason && <Notice>Buổi tập đã dừng: {simulation.stop_reason}</Notice>}
      {simulation.recovery_heart_rate != null && <p className="mt-3 text-sm">Nhịp tim cuối hồi phục: {simulation.recovery_heart_rate} bpm · Điểm hồi phục ước tính: {simulation.stamina_score ?? "—"}/10</p>}
      {simulation.actual_distance_meters != null && <p className="mt-3">Cự ly thực hiện: {Number(simulation.actual_distance_meters).toFixed(1)} m</p>}
      {finishFailed && <button type="button" className="soft-button mt-3" onClick={onRetryFinish} disabled={busy}>Thử lưu kết quả lại</button>}
      {(ranking.length > 0 || simulation.status === "Completed") && <Notice>Đã hoàn tất buổi tập và lưu chỉ số vào biểu đồ phân tích.</Notice>}
    </section>}
    <Section title="Chuẩn bị buổi tập mô phỏng" description="Chọn tối đa 5 buổi đã có lịch, Groom và đang trong khung giờ tập để mô phỏng riêng hoặc theo nhóm." icon={Play}>
      <form onSubmit={onStart} className="training-start-form">
        <SelectField label="Tình huống mô phỏng" name="scenario" options={[["Normal", "Phản ứng vận động bình thường"], ["Fatigue", "Phản ứng tải cao, hồi phục chậm"]]} />
        <fieldset className="training-session-options"><legend className="field-label">Buổi tập đang sẵn sàng</legend>{eligible.map(session => <label key={session.training_schedule_id} className="training-session-option">
          <input type="checkbox" name="training_schedule_id" value={session.training_schedule_id} disabled={busy}/>
          <span><strong>{session.horse_name}</strong><small>{session.event_date} · {session.start_time?.slice(0,5)}–{session.end_time?.slice(0,5)} · {surfaceLabel(session.track_surface)}</small></span>
        </label>)}</fieldset>
        <button className="gold-button" disabled={busy || eligible.length === 0}><Play size={15} /> Mở các buổi đã chọn</button>
      </form>
      {eligible.length === 0 && <Notice>Chưa có lịch tập phù hợp trong khung giờ hiện tại. Tạo lịch từ giáo án, phân công Groom và mở giả lập tại tab Lịch tập khi đến giờ.</Notice>}
    </Section>
  </div>;
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

function SelectField({ label, name, options, value, defaultValue, onChange, required=false }: {
  required?: boolean; label: string; name: string; options: [string, string][]; value?: string; defaultValue?: string; onChange?: (value: string) => void;
}) {
  return <label className="block"><span className="field-label">{label}</span><select required={required} name={name} value={value} defaultValue={value === undefined ? defaultValue : undefined} onChange={onChange ? (event) => onChange(event.target.value) : undefined} className="field-control px-3">{options.map(([optionValue, text]) => <option key={optionValue} value={optionValue}>{text}</option>)}</select></label>;
}

function TextArea({ label, name, required = false, defaultValue, rows = 3 }: { label: string; name: string; required?: boolean; defaultValue?: string | null; rows?: number }) {
  return <label className="block"><span className="field-label">{label}</span><textarea name={name} required={required} defaultValue={defaultValue ?? ""} rows={rows} className="field-control px-3 py-2" /></label>;
}
