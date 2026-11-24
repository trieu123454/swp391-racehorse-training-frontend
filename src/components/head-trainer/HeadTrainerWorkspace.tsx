"use client";

import { useAutoRefresh } from "@/shared/hooks/use-auto-refresh";
import { formatDisplayDate } from "@/lib/display-format";

import { Activity, AlertTriangle, ArrowLeft, ArrowRight, ArrowUpRight, Ban, Bot, CalendarDays, Check, ChevronDown, CircleHelp, ClipboardList, Clock, Flag, Gauge, HeartPulse, MapPin, Medal, MessageSquare, Pencil, Play, Plus, RefreshCw, RotateCcw, Search, Send, Sparkles, Trash2, User, Users, Utensils, Wand2, X } from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { HorseImage, Modal, Notice } from "@/components/horses/HorseUI";
import SessionTargetsEditor from "./SessionTargetsEditor";
import TrainingAnalysisPanel from "./TrainingAnalysisPanel";
import SensorTimeline from "./SensorTimeline";
import RaceTrackVisualization from "./RaceTrackVisualization";
import dynamic from "next/dynamic";
import type { RaceTrackRunner } from "./RaceTrackScene3D";
const RaceTrackScene3D = dynamic(() => import("./RaceTrackScene3D"), {
  ssr: false,
  loading: () => <p role="status" className="p-5 text-sm text-slate-500">Đang tải mô hình 3D…</p>,
});
import { listHorses, type Horse } from "@/api/horses/api";
import { useLinkedNotificationHorse } from "@/hooks/use-notification-target";
import { useDashboardTab } from "@/shared/hooks/use-dashboard-tab";


import {
  headTrainerApi,
  headTrainerError,
  type CareCalendarEvent,
  type RaceEligibility,
  type RaceOption,
  type RaceScheduleConflict,
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
function plusDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  return dateInputValue(value);
}
function mondayOfWeek(date: string) {
  const value = new Date(`${date}T12:00:00`);
  const day = value.getDay();
  value.setDate(value.getDate() - (day === 0 ? 6 : day - 1));
  return dateInputValue(value);
}
function metricDate(value?: string | null) {
  if (!value) return "Chưa có dữ liệu";
  return new Date(value).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export type RegimenLevel =
  | "HIGH_SPRINT"
  | "HIGH_ENDURANCE"
  | "HIGH_TRIAL"
  | "MEDIUM_ENDURANCE"
  | "MEDIUM_INTERVAL"
  | "MEDIUM_ADAPT"
  | "LOW_REHAB"
  | "LOW_LIGHT"
  | "LOW_RECOVERY";

export interface SessionRunStructure {
  totalDistanceMeters: number;
  intensity: string;
  lapLengthMeters: number;
  totalLaps: number;
  runsPerSession: number;
  distancePerRunMeters: number;
  restBetweenRunsMinutes: number;
  warmupMinutes: number;
  activeRunMinutes: number;
  cooldownMinutes: number;
  formulaText: string;
  phaseBreakdownText: string;
}

export function analyzeSessionRunStructure(distanceMeters?: number | null, intensity?: string | null): SessionRunStructure {
  const totalDistanceMeters = Number(distanceMeters) > 0 ? Number(distanceMeters) : 1200;
  const normIntensity = intensity || "Medium";
  const lapLengthMeters = 600; // Chu vi 1 vòng sân tập tiêu chuẩn = 600m
  const totalLaps = Number((totalDistanceMeters / lapLengthMeters).toFixed(1));

  let runsPerSession = 2;
  let distancePerRunMeters = Math.round(totalDistanceMeters / 2);
  let restBetweenRunsMinutes = 15;
  let warmupMinutes = 15;
  let activeRunMinutes = 25;
  let cooldownMinutes = 20;

  if (totalDistanceMeters <= 800 || normIntensity === "Low") {
    runsPerSession = 2;
    distancePerRunMeters = Math.round(totalDistanceMeters / 2);
    restBetweenRunsMinutes = 15;
    warmupMinutes = 20;
    activeRunMinutes = 15;
    cooldownMinutes = 25;
  } else if (totalDistanceMeters <= 1400) {
    runsPerSession = 2;
    distancePerRunMeters = Math.round(totalDistanceMeters / 2);
    restBetweenRunsMinutes = 15;
    warmupMinutes = 15;
    activeRunMinutes = 25;
    cooldownMinutes = 20;
  } else if (totalDistanceMeters <= 2000) {
    runsPerSession = 3;
    distancePerRunMeters = Math.round(totalDistanceMeters / 3);
    restBetweenRunsMinutes = 12;
    warmupMinutes = 15;
    activeRunMinutes = 30;
    cooldownMinutes = 21;
  } else {
    runsPerSession = 4;
    distancePerRunMeters = Math.round(totalDistanceMeters / 4);
    restBetweenRunsMinutes = 10;
    warmupMinutes = 15;
    activeRunMinutes = 35;
    cooldownMinutes = 20;
  }

  return {
    totalDistanceMeters,
    intensity: normIntensity,
    lapLengthMeters,
    totalLaps,
    runsPerSession,
    distancePerRunMeters,
    restBetweenRunsMinutes,
    warmupMinutes,
    activeRunMinutes,
    cooldownMinutes,
    formulaText: `${runsPerSession} lượt × ${distancePerRunMeters.toLocaleString("vi-VN")}m (${totalLaps} vòng 600m · nghỉ ${restBetweenRunsMinutes}p)`,
    phaseBreakdownText: `Khởi động ${warmupMinutes}p · Chạy ${activeRunMinutes}p · Nghỉ ${restBetweenRunsMinutes * Math.max(1, runsPerSession - 1)}p · Thả lỏng ${cooldownMinutes}p`,
  };
}

export interface StandardRegimen {
  key: RegimenLevel;
  code: string;
  levelLabel: "CAO" | "VỪA" | "THẤP";
  shortBadge: string;
  sortOrder: number;
  title: string;
  subtitle: string;
  stage_name: string;
  target_intensity: "High" | "Medium" | "Low";
  target_distance_meters: number;
  target_workload_minutes: number;
  target_track_surface: "Turf" | "Dirt" | "Synthetic";
  recommended_sessions_per_week: number;
  session_type: "Training" | "TrialRun";
  objective: string;
  badgeClass: string;
  cardClass: string;
}

export const STANDARD_REGIMENS: readonly StandardRegimen[] = [
  // === NHÓM CAO (CHUẨN BỊ THI ĐẤU) ===
  {
    key: "HIGH_SPRINT",
    code: "REGIMEN-HIGH-SPRINT",
    levelLabel: "CAO",
    shortBadge: "CAO · Nước rút",
    sortOrder: 1,
    title: "Nước rút Thi đấu (1.800m · Cỏ)",
    subtitle: "Ngựa sẵn sàng thi đấu, bứt tốc tốc độ cao",
    stage_name: "Liệu trình CAO — Nước rút Thi đấu (1.800m)",
    target_intensity: "High",
    target_distance_meters: 1800,
    target_workload_minutes: 270,
    target_track_surface: "Turf",
    recommended_sessions_per_week: 3,
    session_type: "Training",
    objective: "1.800m · Sân cỏ · 3 lượt × 600m (nghỉ 12p)",
    badgeClass: "bg-rose-100 text-rose-800 border-rose-300",
    cardClass: "border-rose-200 bg-rose-50/50 hover:border-rose-400",
  },
  {
    key: "HIGH_ENDURANCE",
    code: "REGIMEN-HIGH-ENDURANCE",
    levelLabel: "CAO",
    shortBadge: "CAO · Đường dài",
    sortOrder: 2,
    title: "Sức bền Đường dài (2.400m · Đất)",
    subtitle: "Đua đường trường, thể lực rất cao (≥ 8.0)",
    stage_name: "Liệu trình CAO — Sức bền Đường dài (2.400m)",
    target_intensity: "High",
    target_distance_meters: 2400,
    target_workload_minutes: 270,
    target_track_surface: "Dirt",
    recommended_sessions_per_week: 3,
    session_type: "Training",
    objective: "2.400m · Sân đất · 4 lượt × 600m (nghỉ 10p)",
    badgeClass: "bg-rose-100 text-rose-800 border-rose-300",
    cardClass: "border-rose-200 bg-rose-50/50 hover:border-rose-400",
  },
  {
    key: "HIGH_TRIAL",
    code: "REGIMEN-HIGH-TRIAL",
    levelLabel: "CAO",
    shortBadge: "CAO · Chạy thử",
    sortOrder: 3,
    title: "Chạy thử Bấm giờ (1.600m · Cỏ)",
    subtitle: "Sát hạch tốc độ trước giải đấu (Trial Run)",
    stage_name: "Liệu trình CAO — Chạy thử Bấm giờ (1.600m)",
    target_intensity: "High",
    target_distance_meters: 1600,
    target_workload_minutes: 180,
    target_track_surface: "Turf",
    recommended_sessions_per_week: 2,
    session_type: "TrialRun",
    objective: "1.600m · Sân cỏ · 3 lượt × 533m (chạy thử bấm giờ)",
    badgeClass: "bg-rose-100 text-rose-800 border-rose-300",
    cardClass: "border-rose-200 bg-rose-50/50 hover:border-rose-400",
  },

  // === NHÓM VỪA (LUYỆN TẬP HẰNG NGÀY) ===
  {
    key: "MEDIUM_ENDURANCE",
    code: "REGIMEN-MEDIUM-ENDURANCE",
    levelLabel: "VỪA",
    shortBadge: "VỪA · Thể lực",
    sortOrder: 4,
    title: "Thể lực Hằng ngày (1.200m · Đất)",
    subtitle: "Duy trì sức bền nền tảng định kỳ",
    stage_name: "Liệu trình VỪA — Thể lực Hằng ngày (1.200m)",
    target_intensity: "Medium",
    target_distance_meters: 1200,
    target_workload_minutes: 180,
    target_track_surface: "Dirt",
    recommended_sessions_per_week: 2,
    session_type: "Training",
    objective: "1.200m · Sân đất · 2 lượt × 600m (nghỉ 15p)",
    badgeClass: "bg-blue-100 text-blue-800 border-blue-300",
    cardClass: "border-blue-200 bg-blue-50/50 hover:border-blue-400",
  },
  {
    key: "MEDIUM_INTERVAL",
    code: "REGIMEN-MEDIUM-INTERVAL",
    levelLabel: "VỪA",
    shortBadge: "VỪA · Biến tốc",
    sortOrder: 5,
    title: "Biến tốc Nhịp độ (1.400m · Cỏ)",
    subtitle: "Tăng tốc độ ổn định & cảm giác đường cỏ",
    stage_name: "Liệu trình VỪA — Biến tốc Nhịp độ (1.400m)",
    target_intensity: "Medium",
    target_distance_meters: 1400,
    target_workload_minutes: 180,
    target_track_surface: "Turf",
    recommended_sessions_per_week: 2,
    session_type: "Training",
    objective: "1.400m · Sân cỏ · 2 lượt × 700m (nghỉ 15p)",
    badgeClass: "bg-blue-100 text-blue-800 border-blue-300",
    cardClass: "border-blue-200 bg-blue-50/50 hover:border-blue-400",
  },
  {
    key: "MEDIUM_ADAPT",
    code: "REGIMEN-MEDIUM-ADAPT",
    levelLabel: "VỪA",
    shortBadge: "VỪA · Kỹ thuật",
    sortOrder: 6,
    title: "Kỹ thuật & Giảm chấn (1.000m · Nhân tạo)",
    subtitle: "Rèn dáng chạy, bảo vệ khớp trên sân nhân tạo",
    stage_name: "Liệu trình VỪA — Kỹ thuật & Giảm chấn (1.000m)",
    target_intensity: "Medium",
    target_distance_meters: 1000,
    target_workload_minutes: 180,
    target_track_surface: "Synthetic",
    recommended_sessions_per_week: 2,
    session_type: "Training",
    objective: "1.000m · Sân nhân tạo · 2 lượt × 500m (nghỉ 15p)",
    badgeClass: "bg-blue-100 text-blue-800 border-blue-300",
    cardClass: "border-blue-200 bg-blue-50/50 hover:border-blue-400",
  },

  // === NHÓM THẤP (PHỤC HỒI & DƯỠNG THƯƠNG) ===
  {
    key: "LOW_REHAB",
    code: "REGIMEN-LOW-REHAB",
    levelLabel: "THẤP",
    shortBadge: "THẤP · Phục hồi",
    sortOrder: 7,
    title: "Phục hồi Sau chấn thương (600m · Nhân tạo)",
    subtitle: "Ngựa mới hồi phục, cảnh báo nhịp tim hoặc thể lực < 5.5",
    stage_name: "Liệu trình THẤP — Phục hồi Sau chấn thương (600m)",
    target_intensity: "Low",
    target_distance_meters: 600,
    target_workload_minutes: 90,
    target_track_surface: "Synthetic",
    recommended_sessions_per_week: 1,
    session_type: "Training",
    objective: "600m · Sân nhân tạo · 2 lượt × 300m (nghỉ 15p)",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
    cardClass: "border-emerald-200 bg-emerald-50/50 hover:border-emerald-400",
  },
  {
    key: "LOW_LIGHT",
    code: "REGIMEN-LOW-LIGHT",
    levelLabel: "THẤP",
    shortBadge: "THẤP · Chạy kiệu",
    sortOrder: 8,
    title: "Chạy kiệu Giãn cơ (800m · Cỏ)",
    subtitle: "Vận động làm mềm cơ, giữ cảm giác vận động nhẹ",
    stage_name: "Liệu trình THẤP — Chạy kiệu Giãn cơ (800m)",
    target_intensity: "Low",
    target_distance_meters: 800,
    target_workload_minutes: 90,
    target_track_surface: "Turf",
    recommended_sessions_per_week: 1,
    session_type: "Training",
    objective: "800m · Sân cỏ · 2 lượt × 400m (nghỉ 15p)",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
    cardClass: "border-emerald-200 bg-emerald-50/50 hover:border-emerald-400",
  },
  {
    key: "LOW_RECOVERY",
    code: "REGIMEN-LOW-RECOVERY",
    levelLabel: "THẤP",
    shortBadge: "THẤP · Thả lỏng",
    sortOrder: 9,
    title: "Thả lỏng Sau giải đấu (400m · Nhân tạo)",
    subtitle: "Đi bộ & chạy chậm xả cơ sau tuần thi đấu căng thẳng",
    stage_name: "Liệu trình THẤP — Thả lỏng Sau giải đấu (400m)",
    target_intensity: "Low",
    target_distance_meters: 400,
    target_workload_minutes: 90,
    target_track_surface: "Synthetic",
    recommended_sessions_per_week: 1,
    session_type: "Training",
    objective: "400m · Sân nhân tạo · 2 lượt × 200m (đi bộ & thả lỏng)",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
    cardClass: "border-emerald-200 bg-emerald-50/50 hover:border-emerald-400",
  },
] as const;

export function intensityOrderScore(intensity?: string | null): number {
  const val = (intensity ?? "").toLowerCase();
  if (val === "high") return 1;
  if (val === "medium") return 2;
  if (val === "low") return 3;
  return 4;
}

export function deduplicateAndSortPlans(plans: TrainingPlan[]): { uniquePlans: TrainingPlan[]; hiddenDuplicateCount: number } {
  const sorted = [...plans].sort((a, b) => {
    const scoreDiff = intensityOrderScore(a.target_intensity) - intensityOrderScore(b.target_intensity);
    if (scoreDiff !== 0) return scoreDiff;
    const distDiff = (b.target_distance_meters ?? 0) - (a.target_distance_meters ?? 0);
    if (distDiff !== 0) return distDiff;
    const activeDiff = Number(Boolean(b.is_active)) - Number(Boolean(a.is_active));
    if (activeDiff !== 0) return activeDiff;
    return (b.training_schedules_count ?? 0) - (a.training_schedules_count ?? 0);
  });

  const seenSignatures = new Set<string>();
  const uniquePlans: TrainingPlan[] = [];
  let hiddenDuplicateCount = 0;

  for (const plan of sorted) {
    const matchedReg = matchStandardRegimen(plan);
    const sig = matchedReg
      ? `STD|${matchedReg.key}`
      : `CUSTOM|${(plan.target_intensity ?? "").toLowerCase()}|${plan.target_distance_meters ?? 0}|${(plan.target_track_surface ?? "").toLowerCase()}|${plan.target_workload_minutes ?? 0}`;
    if (seenSignatures.has(sig)) {
      hiddenDuplicateCount += 1;
      continue;
    }
    seenSignatures.add(sig);
    uniquePlans.push(plan);
  }
  return { uniquePlans, hiddenDuplicateCount };
}

export function getRegimenByKey(key?: string | null): StandardRegimen | undefined {
  if (!key) return undefined;
  const upper = key.toUpperCase();
  return (
    STANDARD_REGIMENS.find((item) => item.key === upper || item.code === upper) ??
    STANDARD_REGIMENS.find((item) => item.levelLabel === upper || item.target_intensity.toUpperCase() === upper)
  );
}

export function matchStandardRegimen(plan: Pick<TrainingPlan, "target_intensity" | "target_distance_meters" | "target_track_surface" | "stage_name">): StandardRegimen | null {
  // 1. Exact parameter match (Intensity + Distance + Surface)
  for (const reg of STANDARD_REGIMENS) {
    if (
      plan.target_intensity === reg.target_intensity &&
      plan.target_distance_meters === reg.target_distance_meters &&
      (plan.target_track_surface ?? "").toLowerCase() === reg.target_track_surface.toLowerCase()
    ) {
      return reg;
    }
  }
  // 2. Exact stage_name or distance + intensity match
  for (const reg of STANDARD_REGIMENS) {
    if (
      plan.stage_name?.toLowerCase() === reg.stage_name.toLowerCase() ||
      (plan.target_intensity === reg.target_intensity && plan.target_distance_meters === reg.target_distance_meters)
    ) {
      return reg;
    }
  }
  // 3. Fallback by intensity so High -> HIGH_SPRINT, Medium -> MEDIUM_ENDURANCE, Low -> LOW_REHAB
  if (plan.target_intensity === "High") return STANDARD_REGIMENS[0];
  if (plan.target_intensity === "Medium") return STANDARD_REGIMENS[3];
  if (plan.target_intensity === "Low") return STANDARD_REGIMENS[6];
  return null;
}

export async function ensurePlanForHorse(
  targetHorseId: string,
  regimen: StandardRegimen,
  eventDate: string,
): Promise<TrainingPlan> {
  const existingPage = await headTrainerApi.plans(targetHorseId, false);
  const existingPlans = Array.isArray(existingPage.data) ? existingPage.data : [];

  // 1. Chỉ tái sử dụng giáo án đang có nếu TRÙNG ĐÚNG thông số/mức của regimen được chọn và bao phủ ngày tập!
  const exactCoveringPlan = existingPlans.find((plan) => {
    const afterStart = !plan.start_date || plan.start_date <= eventDate;
    const beforeEnd = !plan.end_date || plan.end_date >= eventDate;
    if (!afterStart || !beforeEnd) return false;
    return (
      plan.target_intensity === regimen.target_intensity &&
      plan.target_distance_meters === regimen.target_distance_meters &&
      (plan.target_track_surface ?? "").toLowerCase() === regimen.target_track_surface.toLowerCase()
    );
  });
  if (exactCoveringPlan) {
    return exactCoveringPlan;
  }

  // 2. Nếu có giáo án bao phủ ngày tập nhưng chưa gắn buổi tập nào (schedules_count === 0) hoặc cùng cường độ, cập nhật luôn thông số sang regimen đã chọn để không bị lệch (VD: đang Thấp -> cập nhật thành Vừa)
  const coveringPlan = existingPlans.find((plan) => {
    const afterStart = !plan.start_date || plan.start_date <= eventDate;
    const beforeEnd = !plan.end_date || plan.end_date >= eventDate;
    return afterStart && beforeEnd;
  });
  if (coveringPlan) {
    if ((coveringPlan.training_schedules_count ?? 0) === 0 || coveringPlan.target_intensity === regimen.target_intensity) {
      try {
        const updated = await headTrainerApi.updatePlan(coveringPlan.id, {
          stage_name: regimen.stage_name,
          start_date: coveringPlan.start_date,
          end_date: coveringPlan.end_date,
          objective: regimen.objective,
          target_distance_meters: regimen.target_distance_meters,
          target_workload_minutes: regimen.target_workload_minutes,
          target_track_surface: regimen.target_track_surface,
          target_intensity: regimen.target_intensity,
          update_deadline_hours: coveringPlan.update_deadline_hours ?? 24,
        });
        return updated;
      } catch {
        return coveringPlan;
      }
    }
    return coveringPlan;
  }

  let startDate = eventDate < today() ? eventDate : today();
  let endDate = plusDays(eventDate, 60);

  const sortedPlans = [...existingPlans]
    .filter((p) => p.start_date && p.end_date)
    .sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)));

  for (const plan of sortedPlans) {
    const pStart = String(plan.start_date);
    const pEnd = String(plan.end_date);
    if (pEnd < eventDate && pEnd >= startDate) {
      startDate = plusDays(pEnd, 1);
    }
    if (pStart > eventDate && pStart <= endDate) {
      endDate = plusDays(pStart, -1);
    }
  }

  if (startDate > eventDate) startDate = eventDate;
  if (endDate < eventDate) endDate = eventDate;

  return headTrainerApi.createPlan({
    horse_ids: [targetHorseId],
    stage_name: regimen.stage_name,
    start_date: startDate,
    end_date: endDate,
    objective: regimen.objective,
    target_distance_meters: regimen.target_distance_meters,
    target_workload_minutes: regimen.target_workload_minutes,
    target_track_surface: regimen.target_track_surface,
    target_intensity: regimen.target_intensity,
    update_deadline_hours: 24,
  });
}

export default function HeadTrainerWorkspace() {
  const [tab, selectTab] = useDashboardTab(workspaceTabIds, "overview");
  const [horses, setHorses] = useState<Horse[]>([]);
  const [overview, setOverview] = useState<TrainerHorse[]>([]);
  const [grooms, setGrooms] = useState<Groom[]>([]);
  const [races, setRaces] = useState<RaceOption[]>([]);
  const [horseId, setHorseId] = useState("");
  useLinkedNotificationHorse(horses, setHorseId);
  const [horseSearch, setHorseSearch] = useState("");
  const [horseSelectorOpen, setHorseSelectorOpen] = useState(false);
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [careEvents, setCareEvents] = useState<CareCalendarEvent[]>([]);
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
  const [calendarFrom, setCalendarFrom] = useState(() => mondayOfWeek(today()));
  const [calendarTo, setCalendarTo] = useState(() => plusDays(mondayOfWeek(today()), 6));
  useEffect(() => {
    const sync = () => {
      const params = new URLSearchParams(window.location.search), date = params.get("date");
      if (params.has("notificationTarget") && date?.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const monday = mondayOfWeek(date); setCalendarFrom(monday); setCalendarTo(plusDays(monday, 6));
      }
    };
    sync(); window.addEventListener("workspace-tab-change", sync);
    return () => window.removeEventListener("workspace-tab-change", sync);
  }, []);

  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editingPlan, setEditingPlan] = useState<string | null>(null);
  const [selectedPlanHorseIds, setSelectedPlanHorseIds] = useState<string[]>([]);
  const [scheduleDraft, setScheduleDraft] = useState<{ horseId: string; planId: string; startDate: string | null; regimenKey?: RegimenLevel } | null>(null);
  const [lastCreatedSessionId, setLastCreatedSessionId] = useState<string | null>(null);
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

  const trainableHorses = useMemo(() => horses.filter((horse) => !isHorseInjuredOrLocked(horse)), [horses]);
  const selectedHorse = useMemo(() => trainableHorses.find((horse) => horse.id === horseId) ?? trainableHorses[0] ?? null, [trainableHorses, horseId]);
  const visibleHorseOptions = useMemo(() => {
    const query = normalizeHorseSearch(horseSearch.trim());
    return trainableHorses.filter((horse) => normalizeHorseSearch(`${horse.horse_name ?? ""} ${horse.box_code ?? ""} ${horse.microchip_number ?? ""} ${horse.breed ?? ""} ${horse.id}`).includes(query));
  }, [trainableHorses, horseSearch]);
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
    const unlockedHorses = horsePage.items.filter((item) => !isHorseInjuredOrLocked(item));
    const defaultHorseId = unlockedHorses[0]?.id || "";
    setHorseId((current) => unlockedHorses.some((item) => item.id === current) ? current : defaultHorseId);
    setCompareIds((current) => {
      const validCurrent = current.filter((id) => unlockedHorses.some((item) => item.id === id));
      return validCurrent.length ? validCurrent : unlockedHorses.slice(0, 3).map((item) => item.id);
    });
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
    if (from && to && from > to) {
      const [planPage, entries] = await Promise.all([
        headTrainerApi.plans(horseId, activeOnly),
        headTrainerApi.raceEntries(horseId),
      ]);
      if (request !== horseRequestRef.current || horseQueryRef.current !== horseQueryKey) return;
      setPlans(planPage.data);
      setMetrics([]);
      setRaceEntries(entries.data);
      setError("Ngày bắt đầu không được lớn hơn ngày kết thúc.");
      return;
    }
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
    if(request===calendarRequestRef.current && calendarQueryRef.current===calendarQueryKey) {
      const trainingList = Array.isArray(data.data) ? data.data : [];
      setSessions(trainingList);
      try {
        window.localStorage.setItem(
          `racehorse:shared-calendar:training:${calendarFrom}`,
          JSON.stringify(trainingList),
        );
      } catch {
        // ignore storage quota errors
      }
      const rawCaret = Array.isArray(data.care_events) ? data.care_events : [];
      const mergedCare: CareCalendarEvent[] = [];
      const seenKeys = new Set<string>();
      for (const item of rawCaret) {
        const key = `${item.event_id || item.source_id || item.title || "care"}|${item.horse_id || ""}|${item.event_date}|${item.start_time || ""}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          mergedCare.push(item);
        }
      }
      try {
        const cachedVetRaw = window.localStorage.getItem(`racehorse:shared-calendar:vet:${calendarFrom}`);
        if (cachedVetRaw) {
          const cachedVet = JSON.parse(cachedVetRaw) as CareCalendarEvent[];
          if (Array.isArray(cachedVet)) {
            for (const item of cachedVet) {
              const key = `${item.event_id || item.source_id || item.title || "care"}|${item.horse_id || ""}|${item.event_date}|${item.start_time || ""}`;
              if (!seenKeys.has(key)) {
                seenKeys.add(key);
                mergedCare.push(item);
              }
            }
          }
        }
      } catch {
        // ignore storage parse errors
      }
      setCareEvents(mergedCare);
    }
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
    loadCalendar().catch((reason) => { if (active) setError(headTrainerError(reason)); });
    return () => { active = false; };
  }, [tab, loadHorseData, loadCalendar, plansRevision]);

  useAutoRefresh(async () => {
    const tasks: Promise<unknown>[] = [loadOverview()];
    if (tab === "overview" || tab === "plans" || tab === "races") tasks.push(loadHorseData());
    if (tab === "calendar" || tab === "overview") tasks.push(loadCalendar());
    await Promise.allSettled(tasks);
  }, { enabled: !busy, intervalMs: 25_000 });

  useEffect(() => {
    if (tab !== "overview" || !compareIds.length) { setCompare([]); return; }
    if (from && to && from > to) {
      setCompare([]);
      setError("Ngày bắt đầu không được lớn hơn ngày kết thúc.");
      return;
    }
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
    try { setAnalysisRevision((value) => value + 1); await Promise.all([loadOverview(), loadHorseData(), loadCalendar()]); }
    catch (reason) { setError(headTrainerError(reason)); }
  }, [loadOverview, loadHorseData, loadCalendar]);

  async function handleResetAndSeedCleanData() {
    const res = await run(
      () => headTrainerApi.resetCleanData(),
    );
    if (res) {
      setScheduleDraft(null);
      setPlansRevision((current) => current + 1);
      await Promise.all([loadOverview(), loadHorseData(), loadCalendar()]);
      setNotice(
        `🧹 Đã làm sạch dữ liệu cũ (${res.deleted_plans} giáo án, ${res.deleted_schedules} lịch tập) và tạo mới ${res.created_plans} giáo án chuẩn + ${res.created_schedules} buổi tập không trùng lịch chăm sóc!`,
      );
    }
  }

  async function createPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const horseIds = (selectedPlanHorseIds.length ? selectedPlanHorseIds : data.getAll("horse_ids").map(String)).filter(Boolean);
    if (horseIds.length === 0) return;
    const baseInput = {
      stage_name: data.get("stage_name"),
      start_date: data.get("start_date") || null,
      end_date: data.get("end_date") || null,
      objective: data.get("objective") || null,
      target_distance_meters: Number(data.get("target_distance_meters")) || null,
      target_workload_minutes: Number(data.get("target_workload_minutes")) || null,
      target_track_surface: data.get("target_track_surface") || null,
      target_intensity: data.get("target_intensity"),
      update_deadline_hours: Number(data.get("update_deadline_hours") ?? 24),
    };
    setBusy(true);
    setError("");
    setNotice("");
    const succeededIds: string[] = [];
    const createdPlans: TrainingPlan[] = [];
    let firstFailure: unknown = null;
    try {
      for (const targetHorseId of horseIds) {
        try {
          const plan = await headTrainerApi.createPlan({
            ...baseInput,
            horse_ids: [targetHorseId],
          });
          succeededIds.push(targetHorseId);
          createdPlans.push(plan);
        } catch (reason) {
          if (!firstFailure) firstFailure = reason;
        }
      }
      if (createdPlans.length > 0) {
        if (horseIds.includes(horseId)) {
          const forCurrentHorse = createdPlans.filter((p) => p.horse_id === horseId || p.horse_ids?.includes(horseId));
          if (forCurrentHorse.length > 0) {
            setPlans((current) => [...forCurrentHorse, ...current]);
          }
        }
        setPlansRevision((current) => current + 1);
      }
      const remainingIds = horseIds.filter((id) => !succeededIds.includes(id));
      if (remainingIds.length === 0) {
        form.reset();
        setSelectedPlanHorseIds([horseIds[0]]);
        setHorseId(horseIds[0]);
        setActiveOnly(false);
        setNotice("Đã tạo giáo án.");
      } else {
        setSelectedPlanHorseIds(remainingIds);
        if (succeededIds.length > 0) {
          setNotice(`Đã tạo giáo án cho ${succeededIds.length}/${horseIds.length} ngựa. Các ngựa đã tạo thành công đã được bỏ chọn.`);
        }
        setError(headTrainerError(firstFailure));
      }
    } finally {
      setBusy(false);
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
    const matched = matchStandardRegimen(plan);
    setScheduleDraft({ horseId, planId: plan.id, startDate: plan.start_date, regimenKey: matched?.key });
    selectTab("calendar");
    setError("");
    setNotice(`Đã chọn giáo án “${plan.stage_name}”. Hãy chọn ngày, giờ và Groom để lên lịch buổi tập.`);
  }

  async function applyStandardRegimenToHorses(regimen: StandardRegimen, targetHorseIds: string[], openCalendarAfter = false) {
    const validIds = targetHorseIds.filter((id) => horses.some((item) => item.id === id && !item.is_training_locked));
    if (!validIds.length) {
      setError("Hãy chọn ít nhất một ngựa không bị khóa huấn luyện để áp dụng liệu trình.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      let primaryPlan: TrainingPlan | null = null;
      let count = 0;
      for (const targetId of validIds) {
        const plan = await ensurePlanForHorse(targetId, regimen, today());
        if (targetId === validIds[0]) primaryPlan = plan;
        count += 1;
      }
      setPlansRevision((current) => current + 1);
      await Promise.all([loadOverview(), loadHorseData()]);
      if (openCalendarAfter && primaryPlan) {
        const primaryHorseId = validIds[0];
        setHorseId(primaryHorseId);
        setScheduleDraft({ horseId: primaryHorseId, planId: primaryPlan.id, startDate: today(), regimenKey: regimen.key });
        selectTab("calendar");
        setNotice(`Đã áp dụng “${regimen.stage_name}” cho ${count} ngựa và chuyển sang Lịch tập.`);
      } else {
        setNotice(`Đã gán sẵn “${regimen.stage_name}” cho ${count} ngựa.`);
      }
    } catch (reason) {
      setError(headTrainerError(reason));
    } finally {
      setBusy(false);
    }
  }

  async function createSchedule(event: FormEvent<HTMLFormElement>): Promise<TrainingSession | null> {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const targetHorseId = String(data.get("horse_id") || horseId);
    const sessionTypeValue = String(data.get("session_type") || "Training");
    const eventDateValue = String(data.get("event_date") || today());
    const regimenKey = String(data.get("regimen_preset") || "");
    let planIdValue = sessionTypeValue === "Rest" ? null : (String(data.get("training_plan_id") || "").trim() || null);

    const result = await run(async () => {
      if (!planIdValue && sessionTypeValue !== "Rest") {
        const intensityHint = String(data.get("session_intensity") || "Medium");
        const regimen = getRegimenByKey(regimenKey || intensityHint) ?? STANDARD_REGIMENS[3];
        const autoPlan = await ensurePlanForHorse(targetHorseId, regimen, eventDateValue);
        planIdValue = autoPlan.id;
      }
      return headTrainerApi.createSchedule(targetHorseId, {
        training_plan_id: planIdValue,
        session_type: sessionTypeValue,
        track_surface: data.get("track_surface") || null,
        event_date: eventDateValue,
        start_time: data.get("start_time"),
        end_time: data.get("end_time"),
        assigned_groom_id: data.get("assigned_groom_id") ? Number(data.get("assigned_groom_id")) : null,
        notes: data.get("notes") || null,
        target_distance_meters: Number(data.get("session_distance")) || null,
        target_intensity: data.get("session_intensity") || null,
      });
    }, `✅ Đã tạo lịch tập ngày ${eventDateValue} (${String(data.get("start_time") || "")} – ${String(data.get("end_time") || "")}).`);
    if (result) {
      setScheduleDraft(null);
      const targetMonday = mondayOfWeek(eventDateValue);
      const targetSunday = plusDays(targetMonday, 6);
      setCalendarFrom(targetMonday);
      setCalendarTo(targetSunday);
      setSessions((current) => [
        ...current.filter((s) => s.training_schedule_id !== result.training_schedule_id),
        result,
      ]);
      setLastCreatedSessionId(result.training_schedule_id);
      setPlansRevision((current) => current + 1);
      if (targetMonday === calendarFrom) {
        await refresh();
      } else {
        await Promise.all([loadOverview(), loadHorseData()]);
      }
      return result;
    }
    return null;
  }

  // The calendar no longer exposes manual metric entry; this handler remains only for backwards compatibility with the API flow.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    if (selected.length > 5) { setError("Chỉ được chọn tối đa 5 buổi tập trong một nhóm mô phỏng."); return; }
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

  async function cancelTrainingConflict(conflict: RaceScheduleConflict): Promise<boolean> {
    let scheduleId = conflict.source_table === "training_schedules" && conflict.source_id
      ? conflict.source_id
      : null;
    const matchesSession = (session: TrainingSession) =>
      session.horse_id === horseId
      && session.event_date === conflict.event_date
      && session.status !== "Cancelled"
      && (session.calendar_event_id === conflict.event_id
        || session.event_id === conflict.event_id
        || (Boolean(conflict.start_time) && session.start_time?.slice(0, 5) === conflict.start_time?.slice(0, 5)));
    if (!scheduleId) {
      scheduleId = sessions.find(matchesSession)?.training_schedule_id ?? null;
    }
    if (!scheduleId) {
      try {
        const dayCalendar = await headTrainerApi.calendar(conflict.event_date, conflict.event_date);
        scheduleId = (dayCalendar.data ?? []).find(matchesSession)?.training_schedule_id ?? null;
      } catch {
        // Fallback error is shown below when scheduleId remains null.
      }
    }
    if (!scheduleId) {
      setError("Không tìm thấy mã buổi tập để hủy tự động. Vui lòng mở Lịch tập để xử lý.");
      return false;
    }
    const updated = await run(
      () => headTrainerApi.updateSchedule(scheduleId, { status: "Cancelled" }),
      "Đã hủy buổi tập trùng lịch ngày đua.",
    );
    if (!updated) return false;
    await refresh();
    return true;
  }

  if (loading) return <div className="mt-10 rounded-lg border border-equine-line bg-white p-6 shadow-sm"><Notice>Đang tải dữ liệu huấn luyện…</Notice></div>;

  return <section className="head-trainer-workspace mt-5" aria-label="Điều phối huấn luyện">
    <div className="mb-4 flex justify-end gap-3">
      <button type="button" onClick={() => void refresh()} className="soft-button" disabled={busy}><RefreshCw size={15} /> Làm mới</button>
    </div>
    <div className="training-hero" hidden={tab !== "overview"}>
      <div className="training-hero__veil" />
      <div className="training-hero__copy">
        <p className="training-hero__eyebrow"><span className={featuredSimulation ? "training-live-dot" : "training-hero__dash"} />{featuredSimulation ? "ĐANG CÓ BUỔI TẬP TRỰC TIẾP" : "TỔNG QUAN HUẤN LUYỆN"}</p>
        <h3>{featuredSimulation ? `Theo dõi ${featuredSimulation.horses[0]?.horse_name ?? "buổi tập"}` : "Buổi tập mô phỏng"}</h3>

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

          <div className="training-surface-swatches"><i className="grass" /><i className="dirt" /><i className="synthetic" /></div>
        </>}
      </aside>
    </div>
    {error && <Notice error>{error}</Notice>}{notice && <Notice>{notice}</Notice>}

    <div className="mt-5 space-y-4">
      {tab === "incidents" ? <TrainerIncidentsPanel incidents={incidents} busy={busy} onSubmit={submitIncidentResult} error={error} notice={notice} />
        : !horses.length ? <Notice>Chưa có hồ sơ ngựa đang hoạt động.</Notice> : <>
        {tab !== "simulation" && tab !== "races" && tab !== "calendar" && <div className="relative flex flex-wrap items-center gap-3 rounded-xl border border-blue-200 bg-gradient-to-r from-equine-mist via-white to-slate-50 p-3.5 shadow-sm ring-1 ring-blue-100/70">
          <label className="text-xs font-extrabold uppercase tracking-wider text-equine-navy" htmlFor="trainer-horse-search">Ngựa đang xem:</label>
          <div className="relative flex w-full max-w-xs items-center">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="trainer-horse-search"
              type="text"
              name="horse-search"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              onFocus={() => setHorseSelectorOpen(true)}
              onBlur={() => setTimeout(() => setHorseSelectorOpen(false), 160)}
              className="h-9 w-full rounded-lg border border-blue-200 bg-white pl-9 pr-8 text-xs font-semibold text-equine-navy shadow-xs outline-none focus:border-blue-500"
              value={horseSelectorOpen ? horseSearch : `${selectedHorse?.horse_name ?? ""}${selectedHorse?.box_code ? ` (${selectedHorse.box_code})` : ""}`}
              onChange={(event) => {
                const value = event.target.value;
                const query = normalizeHorseSearch(value.trim());
                setHorseSearch(value);
                setHorseSelectorOpen(true);
                const firstMatch = horses.find((horse) =>
                  normalizeHorseSearch(`${horse.horse_name ?? ""} ${horse.box_code ?? ""} ${horse.microchip_number ?? ""} ${horse.id}`).includes(query),
                );
                if (query && firstMatch) setHorseId(firstMatch.id);
              }}
              placeholder="Gõ tìm tên ngựa, mã chuồng..."
            />
            {horseSearch ? (
              <button
                type="button"
                aria-label="Xóa tìm ngựa"
                className="absolute right-2.5 top-1/2 z-10 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setHorseSearch("")}
              >
                <X size={14} />
              </button>
            ) : (
              <button
                type="button"
                aria-label="Mở danh sách ngựa"
                className="absolute right-2.5 top-1/2 z-10 -translate-y-1/2 text-slate-500 hover:text-equine-navy"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setHorseSelectorOpen((open) => !open)}
              >
                <ChevronDown size={16} aria-hidden="true" />
              </button>
            )}
            {horseSelectorOpen && (
              <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-lg border border-equine-line bg-white py-1 shadow-lg" role="listbox">
                {visibleHorseOptions.slice(0, 50).map((horse) => (
                  <button
                    key={horse.id}
                    type="button"
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs transition hover:bg-equine-mist ${
                      horse.id === horseId ? "bg-blue-50 font-bold text-blue-950" : "text-slate-700"
                    }`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setHorseId(horse.id);
                      setHorseSearch("");
                      setHorseSelectorOpen(false);
                    }}
                    role="option"
                    aria-selected={horse.id === horseId}
                  >
                    <span>
                      {horse.horse_name}
                      {horse.box_code ? <span className="ml-1.5 text-[11px] text-slate-500">· Chuồng {horse.box_code}</span> : null}
                    </span>
                    {horse.is_training_locked ? (
                      <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">Đang khóa</span>
                    ) : (
                      <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">Sẵn sàng</span>
                    )}
                  </button>
                ))}
                {visibleHorseOptions.length === 0 && <span className="block px-3 py-2 text-xs text-slate-500">Không tìm thấy ngựa phù hợp.</span>}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {trainableHorses.map((item) => {
              const active = item.id === horseId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setHorseId(item.id);
                    setHorseSearch("");
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                    active
                      ? "border-equine-navy bg-equine-navy text-white shadow-xs"
                      : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50/50"
                  }`}
                >
                  <span>{item.horse_name}</span>
                  {item.box_code && (
                    <span className={`rounded px-1 py-0.2 text-[10px] ${active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
                      {item.box_code}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <select id="trainer-horse" className="hidden" value={horseId} onChange={(event) => setHorseId(event.target.value)}>{trainableHorses.map((horse) => <option key={horse.id} value={horse.id}>{horse.horse_name}</option>)}</select>
        </div>}
        {tab === "overview" && <>{error && <Notice error>{error}</Notice>}{notice && <Notice>{notice}</Notice>}<OverviewPanel horses={trainableHorses} overview={overview.filter((o) => trainableHorses.some((h) => h.id === o.horse_id))} selectedHorseId={horseId} metrics={metrics} compare={compare} compareIds={compareIds} setCompareIds={setCompareIds} from={from} setFrom={setFrom} to={to} setTo={setTo} includeSimulated={includeSimulated} setIncludeSimulated={setIncludeSimulated} /></>}
        {tab === "analysis" && <>{error && <Notice error>{error}</Notice>}{notice && <Notice>{notice}</Notice>}<TrainingAnalysisPanel horseId={horseId} from={from} to={to} setFrom={setFrom} setTo={setTo} revision={analysisRevision}/></>}
        {tab === "plans" && <PlansPanel horse={selectedHorse} horses={trainableHorses} plans={plans} activeOnly={activeOnly} setActiveOnly={setActiveOnly} editingPlan={editingPlan} setEditingPlan={setEditingPlan} selectedHorseIds={selectedPlanHorseIds} setSelectedHorseIds={setSelectedPlanHorseIds} onCreate={createPlan} onUpdate={updatePlan} onDelete={deletePlan} onSchedule={scheduleFromPlan} onApplyRegimen={applyStandardRegimenToHorses} onResetCleanData={handleResetAndSeedCleanData} busy={busy} error={error} notice={notice} />}
        {tab === "calendar" && <CalendarPanel selectedHorseId={horseId} onSelectHorse={setHorseId} overview={overview.filter((o) => trainableHorses.some((h) => h.id === o.horse_id))} onTargetsSaved={refresh} horses={trainableHorses} sessions={sessions} careEvents={careEvents} grooms={grooms} from={calendarFrom} to={calendarTo} onWeekChange={(value) => { const start = mondayOfWeek(value); setCalendarFrom(start); setCalendarTo(plusDays(start, 6)); }} scheduleDraft={scheduleDraft} onCreate={createSchedule} onResetCleanData={handleResetAndSeedCleanData} onAssign={async (id, groomId) => { const result = await run(() => headTrainerApi.assignGroom(id, groomId), "Đã phân công Groom."); if (result) await refresh(); }} onOpenSimulation={openTrainingSimulation} onStatus={async (id, status) => { const result = await run(() => headTrainerApi.updateSchedule(id, { status }), `Đã cập nhật buổi tập: ${status}.`); if (result) await refresh(); }} onVideo={addTrainingVideo} showMetricsFor={showMetricsFor} setShowMetricsFor={setShowMetricsFor} busy={busy} error={error} notice={notice} lastCreatedSessionId={lastCreatedSessionId} />}
        {tab === "races" && <RaceEntriesPanel
          selectedHorse={selectedHorse}
          horses={trainableHorses}
          races={races}
          entries={raceEntries}
          refreshRevision={analysisRevision}
          onSelectHorse={setHorseId}
          onCancelTrainingConflict={cancelTrainingConflict}
          error={error}
          notice={notice}
          onOpenCalendarOnDate={(date) => {
            const start = mondayOfWeek(date);
            setCalendarFrom(start);
            setCalendarTo(plusDays(start, 6));
            selectTab("calendar");
          }}
          onRecordResult={async (entryId, input) => {
            const result = await run(() => headTrainerApi.recordRaceResult(entryId, input), "Đã lưu kết quả thi đấu chính thức và cập nhật tài chính.");
            if (result) await refresh();
          }}
          onRegister={async (raceId) => {
            if (!horseId) return;
            const result = await run(() => headTrainerApi.registerRace(horseId, raceId));
            if (result) {
              const warningCount = Array.isArray(result.warnings) ? result.warnings.length : 0;
              setNotice(warningCount > 0
                ? `Đã đăng ký ngựa vào giải đấu chính thức (lưu ý ${warningCount} cảnh báo hồi phục).`
                : "Đã đăng ký ngựa vào giải đấu chính thức.");
              await refresh();
            }
          }}
          onCancelEntry={async (entryId, reason) => {
            const result = await run(() => headTrainerApi.cancelRaceEntry(entryId, reason), "Đã rút ngựa khỏi giải đấu và giải phóng lịch ngày đua.");
            if (result) await refresh();
          }}
          onRestoreEntry={async (entryId) => {
            const result = await run(() => headTrainerApi.restoreRaceEntry(entryId));
            if (result) {
              const warningCount = Array.isArray(result.warnings) ? result.warnings.length : 0;
              setNotice(warningCount > 0
                ? `Đã khôi phục đăng ký giải đấu (lưu ý ${warningCount} cảnh báo hồi phục).`
                : "Đã khôi phục đăng ký giải đấu sang Đã đăng ký.");
              await refresh();
            }
          }}
          busy={busy}
        />}
        {tab === "simulation" && <SimulationPanel sessions={sessions} activeSimulations={activeSimulations} onSelectSimulation={selectSimulation} simulation={simulation} readings={liveReadings} phase={simulationPhase} ranking={ranking} progress={progress} vitals={vitals} onStart={startSimulation} onRestartSimulation={restartOutdatedSimulation} onRetryFinish={() => { if (simulation) void finishSimulation(simulation); }} finishFailed={finishFailed} busy={busy} error={error} notice={notice} />}
      </>}
    </div>
  </section>;
}

function TrainerIncidentsPanel({ incidents, busy, onSubmit, error, notice }: {
  incidents: TrainerIncident[];
  busy: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>, incidentId: string) => void | Promise<void>;
  error?: string;
  notice?: string;
}) {
  return <Section title="Sự cố được giao cho bạn" help="Xem hướng dẫn, gửi kết quả xử lý để Club Manager đóng sự cố." icon={AlertTriangle}>
    {error && <div className="mb-3"><Notice error>{error}</Notice></div>}
    {notice && <div className="mb-3"><Notice>{notice}</Notice></div>}
    {!incidents.length ? <p className="text-sm text-slate-500">Hiện chưa có sự cố nào được giao cho bạn.</p>
      : <div className="space-y-3">{incidents.map((incident) => <article key={incident.id} className={`rounded-lg border p-4 ${incident.is_emergency ? "border-rose-300 bg-rose-50/40" : "border-equine-line bg-white"}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h3 className="font-semibold text-equine-navy">{incident.horse_name}</h3>
            <p className="mt-1 text-xs text-slate-500">{incident.groom_name ?? "Groom"} · {formatDisplayDate(incident.created_at, true)}</p>
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

function buildPrioritySparkline(item: TrainerHorse, horseInfo: Horse | undefined, comparedMetrics: TrainingMetric[]): { values: number[]; label: string } {
  const realSpeeds = comparedMetrics
    .map((m) => (typeof m.avg_speed_kmh === "number" && Number.isFinite(m.avg_speed_kmh) ? m.avg_speed_kmh : typeof m.stamina_score === "number" && Number.isFinite(m.stamina_score) ? m.stamina_score * 6 : null))
    .filter((v): v is number => v !== null)
    .slice(-7);
  if (realSpeeds.length >= 2) {
    const padded = Array.from({ length: 7 }, (_, idx) => realSpeeds[Math.max(0, idx - (7 - realSpeeds.length))] ?? realSpeeds[0]);
    return { values: padded, label: `${realSpeeds.length} lần đo gần nhất` };
  }
  const readinessBonus = (item.readiness_status ?? horseInfo?.readiness_status) === "Ready" ? 1.5 : (item.readiness_status ?? horseInfo?.readiness_status) === "NotReady" ? -1.5 : 0;
  const baseScore = item.stamina_score != null
    ? Math.max(1, Math.min(10, item.stamina_score))
    : item.avg_speed_kmh != null
      ? Math.max(1, Math.min(10, item.avg_speed_kmh / 6.5))
      : item.is_training_locked
        ? 2.5
        : Math.max(2, Math.min(10, 5.5 + readinessBonus));
  const trendChange = item.trend?.stamina_score?.change ?? item.trend?.avg_speed_kmh?.change ?? 0;
  const sessionsCount = Math.max(0, Math.min(7, item.sessions_this_week ?? (item.recorded_at ? 3 : 0)));
  const step = Number.isFinite(trendChange) ? Math.max(-0.5, Math.min(0.5, trendChange / 6)) : 0;
  const values = Array.from({ length: 7 }, (_, dayIndex) => {
    const activeDayBoost = dayIndex >= 7 - sessionsCount ? 0.35 : 0;
    return Number(Math.max(1, Math.min(10, baseScore - step * (6 - dayIndex) + activeDayBoost)).toFixed(2));
  });
  const label = item.sessions_this_week != null
    ? `${item.sessions_this_week} buổi/tuần · chỉ số 7 ngày`
    : "Chỉ số 7 ngày gần nhất";
  return { values, label };
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
  const visiblePriorityHorses = overview.slice(0, 8);
  return <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard icon={Users} label="Ngựa đang hoạt động" value={String(horses.length)} />
      <StatCard icon={AlertTriangle} label="Đang khóa huấn luyện" value={String(lockedCount)} warning={lockedCount > 0} />
      <StatCard icon={HeartPulse} label="Cảnh báo ở lần đo gần nhất" value={String(alertCount)} warning={alertCount > 0} />
      <StatCard icon={Activity} label="Có dữ liệu thể lực" value={String(overview.filter((item) => item.recorded_at).length)} />
    </div>
    <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <Section title="Ưu tiên theo dõi" help="Ngựa bị khóa hoặc có cảnh báo gần nhất được xếp lên trước." icon={AlertTriangle}>
        <div className="space-y-2">{visiblePriorityHorses.map((item) => {
          const horseInfo = horses.find((h) => h.id === item.horse_id);
          const horseMetrics = item.horse_id === selectedHorseId ? metrics : (compare.find((c) => c.horse_id === item.horse_id)?.metrics ?? []);
          const sparkline = buildPrioritySparkline(item, horseInfo, horseMetrics);
          const minSpark = Math.min(...sparkline.values);
          const maxSpark = Math.max(...sparkline.values, minSpark + 1);
          const polyPoints = sparkline.values.map((val, idx) => {
            const x = (idx / 6) * 56 + 2;
            const y = 18 - ((val - minSpark) / (maxSpark - minSpark)) * 14;
            return `${x.toFixed(1)},${y.toFixed(1)}`;
          }).join(" ");
          return <div key={item.horse_id} className="flex items-center gap-3 rounded-lg border border-equine-line p-3">
            <HorsePhoto id={item.horse_id} name={item.horse_name} image={item.image_url} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-equine-navy">{item.horse_name}</p>
              <p className="text-xs text-slate-500">{metricDate(item.recorded_at)} · {sparkline.label}</p>
            </div>
            <svg viewBox="0 0 60 20" className="hidden h-5 w-16 shrink-0 sm:block" role="img" aria-label={`Biểu đồ 7 ngày của ${item.horse_name}: ${sparkline.label}`}>
              <polyline fill="none" stroke={item.is_training_locked ? "#be123c" : item.has_injury_alert ? "#b45309" : "#0f766e"} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" points={polyPoints} />
            </svg>
            {item.is_training_locked && <span className="rounded-full bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-700">Đang khóa</span>}
            {!item.is_training_locked && item.has_injury_alert && <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">Cảnh báo</span>}
            <span className="text-right text-xs text-slate-600">{item.stamina_score ?? "—"}<small className="block">thể lực</small></span>
          </div>;
        })}{visiblePriorityHorses.length === 0 && <p className="rounded-lg border border-dashed border-equine-line p-4 text-center text-sm text-slate-500">Không tìm thấy ngựa phù hợp.</p>}</div>
      </Section>
      <Section title="So sánh chỉ số theo thời gian" help="Mỗi ngày là một nhóm cột; màu sắc đại diện cho từng ngựa." icon={Activity}>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Từ ngày" name="from" type="date" value={from} onChange={setFrom} /><Field label="Đến ngày" name="to" type="date" value={to} onChange={setTo} /></div>
        <label className="mt-3 inline-flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={includeSimulated} onChange={(event) => setIncludeSimulated(event.target.checked)} />Gồm dữ liệu mô phỏng</label>
        <label className="mt-3 block max-w-sm"><span className="field-label">Chỉ số cần theo dõi</span><select className="field-control px-3" value={comparisonMetric} onChange={(event) => setComparisonMetric(event.target.value as ComparisonMetricKey)}>{comparisonMetrics.map((metric) => <option key={metric.key} value={metric.key}>{metric.label} ({metric.unit})</option>)}</select></label>
        <div className="mt-3 flex max-h-28 flex-wrap gap-2 overflow-y-auto">{horses.map((horse) => <label key={horse.id} className="inline-flex items-center gap-1 rounded-lg border border-equine-line px-2 py-1 text-xs"><input type="checkbox" checked={compareIds.includes(horse.id)} onChange={(event) => setCompareIds(event.target.checked ? [...compareIds, horse.id].slice(0, 8) : compareIds.filter((id) => id !== horse.id))} />{horse.horse_name}</label>)}</div>
        <ComparisonChart compare={compare} metricKey={comparisonMetric} />
      </Section>
    </div>
    <Section title="Lần đo gần nhất" description={selected?.horse_name ?? "Các ngựa"} icon={Gauge}>
      <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead><tr className="border-b border-equine-line text-xs uppercase text-slate-500"><th className="py-2">Thời điểm</th><th>Cân nặng</th><th>Nhịp tim tối đa</th><th>Tốc độ TB</th><th>Thể lực</th><th>Cảnh báo</th></tr></thead><tbody>{metrics.slice().reverse().slice(0, 12).map((point, index) => <tr key={point.id ?? `${point.recorded_at}-${index}`} className="border-b border-equine-line/70"><td className="py-2">{metricDate(point.recorded_at)}{point.is_simulated && <small className="ml-1 text-violet-700">· Mô phỏng</small>}</td><td>{point.body_weight_kg ?? "—"} kg</td><td>{point.max_heart_rate ?? "—"} bpm</td><td>{point.avg_speed_kmh ?? "—"} km/h</td><td>{point.stamina_score ?? "—"}</td><td>{point.has_injury_alert ? <span className="text-rose-700">Cần lưu ý</span> : "—"}</td></tr>)}</tbody></table>{metrics.length === 0 && <p className="py-4 text-sm text-slate-500">Chưa có chỉ số trong khoảng thời gian này.</p>}</div>
    </Section>
  </div>;
}

const chartColors = ["#1040C5", "#0099CF", "#15803D", "#B45309", "#B91C1C", "#6366F1", "#8B5CF6", "#EC4899"];
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

function isHorseInjuredOrLocked(horse: Horse): boolean {
  const status = String(horse.current_status ?? "").trim().toLowerCase();
  return Boolean(horse.is_training_locked) || status === "injured" || status === "quarantine" || status === "sick";
}

function normalizeHorseSearch(value: string) {
  return value.toLocaleLowerCase("vi").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
}

function formatChartValue(value: number) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value);
}

function chartDateLabel(value: string) {
  return new Date(value + "T12:00:00").toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
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
    return <div className="mt-5 rounded-lg border border-dashed border-equine-line bg-slate-50 p-6 text-center text-sm text-slate-500">
      Chọn ít nhất một ngựa để xem biểu đồ so sánh.
    </div>;
  }
  if (allPoints.length === 0) {
    return <div className="mt-5 rounded-lg border border-dashed border-equine-line bg-slate-50 p-6 text-center text-sm text-slate-500">
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
    <div className="overflow-x-auto rounded-lg border border-equine-line bg-[#f8fafc] px-2 py-2">
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
            <line x1={chart.left} x2={chartWidth - chart.right} y1={tickY} y2={tickY} stroke={index === yTicks.length - 1 ? "#CBD5E1" : "#E2E8F0"} />
            <text x={chart.left - 10} y={tickY + 4} textAnchor="end" fill="#64748B" fontSize="11">{formatChartValue(tick)}</text>
          </g>;
        })}
        <line x1={chart.left} x2={chartWidth - chart.right} y1={zeroY} y2={zeroY} stroke="#CBD5E1" />
        {dateKeys.map((dateKey, index) => {
          const center = chart.left + index * effectiveGroupWidth + effectiveGroupWidth / 2;
          const clusterWidth = chartRows.length * barWidth + Math.max(chartRows.length - 1, 0) * barGap;
          const startX = center - clusterWidth / 2;
          return <g key={dateKey}>
            <line x1={center} x2={center} y1={chart.top} y2={chart.bottom} stroke="#E2E8F0" />
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
        return <details key={row.horse_id} className="rounded-lg border border-equine-line bg-slate-50 p-3">
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
export interface GroomWorkloadStat {
  groom: Groom;
  todayCount: number;
  weekCount: number;
  upcomingCount: number;
  totalMinutesWeek: number;
  status: "light" | "balanced" | "heavy";
  statusLabel: string;
}

export interface HorseCoverageStat {
  horse: Horse;
  overviewItem?: TrainerHorse;
  weekSessions: TrainingSession[];
  activeSessionCount: number;
  totalMinutesWeek: number;
  maxSessionsInSingleDay: number;
  recommendedRegimen: StandardRegimen;
  aiReason: string;
  coverageStatus: "locked" | "uncovered" | "undertrained" | "balanced" | "overtrained";
  coverageLabel: string;
}

export function recommendRegimenForHorse(horse: Horse, overviewItem?: TrainerHorse): { regimen: StandardRegimen; reason: string } {
  const readiness = overviewItem?.readiness_status ?? horse.readiness_status;
  const stamina = overviewItem?.stamina_score;
  const maxHr = overviewItem?.max_heart_rate;
  const speed = overviewItem?.avg_speed_kmh;
  const hasAlert = Boolean(overviewItem?.has_injury_alert);

  if (hasAlert || readiness === "NotReady" || (stamina != null && stamina < 5.5) || (maxHr != null && maxHr > 215)) {
    const reasons: string[] = [];
    if (hasAlert) reasons.push("cảnh báo y tế");
    if (readiness === "NotReady") reasons.push("chưa sẵn sàng");
    if (stamina != null && stamina < 5.5) reasons.push(`thể lực ${stamina}/10`);
    if (maxHr != null && maxHr > 215) reasons.push(`nhịp tim ${maxHr} bpm`);
    const lowReg = stamina != null && stamina >= 4.5 && !hasAlert ? STANDARD_REGIMENS[7] : STANDARD_REGIMENS[6];
    return {
      regimen: lowReg,
      reason: `Phục hồi (${reasons.join(", ") || "tập nhẹ"})`,
    };
  }

  if (readiness === "Ready" && (stamina == null || stamina >= 7.0)) {
    const highReg = stamina != null && stamina >= 8.5 ? STANDARD_REGIMENS[1] : STANDARD_REGIMENS[0];
    return {
      regimen: highReg,
      reason: `Sẵn sàng thi đấu${stamina != null ? ` · Thể lực ${stamina}/10` : ""}${speed != null ? ` · ${speed} km/h` : ""}`,
    };
  }

  const medReg = stamina != null && stamina >= 6.5 ? STANDARD_REGIMENS[4] : STANDARD_REGIMENS[3];
  return {
    regimen: medReg,
    reason: `Tập định kỳ${stamina != null ? ` · Thể lực ${stamina}/10` : ""}`,
  };
}

function sessionDurationMinutes(session: TrainingSession): number {
  if (!session.start_time || !session.end_time) return 90;
  const [sh, sm = "0"] = session.start_time.split(":");
  const [eh, em = "0"] = session.end_time.split(":");
  const diff = (Number(eh) * 60 + Number(em)) - (Number(sh) * 60 + Number(sm));
  return diff > 0 ? diff : 90;
}

const SLOT_START_END: Record<number, { start: string; end: string }> = {
  1: { start: "07:00", end: "08:30" },
  2: { start: "08:45", end: "10:15" },
  3: { start: "10:30", end: "12:00" },
  4: { start: "12:30", end: "14:00" },
  5: { start: "14:15", end: "15:45" },
  6: { start: "16:15", end: "17:45" },
};

export function careEventTypeLabel(eventType?: string | null, title?: string | null): string {
  const val = (eventType || title || "").trim();
  const map: Record<string, string> = {
    HoofCheck: "Kiểm tra móng",
    Deworming: "Tẩy giun",
    Vaccination: "Tiêm phòng",
    MedicalCheckup: "Khám định kỳ",
    VetCheckup: "Khám thú y",
    CareTask: title ? `Chăm sóc (${title})` : "Chăm sóc hằng ngày",
    Feeding: "Cho ăn",
    Cleaning: "Vệ sinh chuồng",
    Bathing: "Tắm chải",
    IceBath: "Ngâm đá hồi phục",
    Race: title ? `Giải đua: ${title}` : "Giải đua",
  };
  return map[val] ?? (title || val || "Lịch chăm sóc");
}

export function timeToMinutes(timeStr?: string | null): number | null {
  if (!timeStr) return null;
  const parts = timeStr.split(":");
  if (parts.length < 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
}

export function doesCareEventOverlapSlot(care: CareCalendarEvent, slotId: number): boolean {
  if (care.status === "Cancelled" || care.status === "Completed") return false;
  if (!care.start_time || !care.end_time) {
    if (care.event_type === "CareTask") return false;
    if (care.is_periodic_due) return slotId === 1;
    return true;
  }
  const slotTimes = SLOT_START_END[slotId];
  if (!slotTimes) return false;
  const cStart = timeToMinutes(care.start_time);
  const cEnd = timeToMinutes(care.end_time);
  const sStart = timeToMinutes(slotTimes.start);
  const sEnd = timeToMinutes(slotTimes.end);
  if (cStart == null || cEnd == null || sStart == null || sEnd == null) return false;
  return cStart < sEnd && cEnd > sStart;
}

export function getCareEventPrimarySlot(care: CareCalendarEvent): number {
  if (!care.start_time) return 1;
  for (let slotId = 1; slotId <= 6; slotId++) {
    if (doesCareEventOverlapSlot(care, slotId)) return slotId;
  }
  const mins = timeToMinutes(care.start_time) ?? 420;
  if (mins < 517) return 1;
  if (mins < 622) return 2;
  if (mins < 735) return 3;
  if (mins < 847) return 4;
  if (mins < 960) return 5;
  return 6;
}

export function computeGroomWorkloads(grooms: Groom[], sessions: TrainingSession[], calendarDays: string[]): GroomWorkloadStat[] {
  const todayStr = today();
  const activeSessions = sessions.filter((s) => s.status !== "Cancelled" && calendarDays.includes(s.event_date));
  const counts = grooms.map((groom) => {
    const groomSessions = activeSessions.filter((s) => s.assigned_groom_id === groom.user_id);
    const todayCount = groomSessions.filter((s) => s.event_date === todayStr).length;
    const weekCount = groomSessions.length;
    const upcomingCount = groomSessions.filter((s) => s.event_date >= todayStr && s.status === "Scheduled").length;
    const totalMinutesWeek = groomSessions.reduce((sum, s) => sum + sessionDurationMinutes(s), 0);
    return { groom, todayCount, weekCount, upcomingCount, totalMinutesWeek };
  });
  const avgWeek = counts.length ? counts.reduce((sum, item) => sum + item.weekCount, 0) / counts.length : 0;
  return counts
    .map((item) => {
      let status: "light" | "balanced" | "heavy" = "balanced";
      let statusLabel = "Cân bằng";
      if (item.weekCount === 0 || (avgWeek >= 2 && item.weekCount < avgWeek * 0.6)) {
        status = "light";
        statusLabel = "Đang rảnh / Ít việc";
      } else if (item.todayCount >= 4 || item.weekCount >= Math.max(6, Math.ceil(avgWeek * 1.45))) {
        status = "heavy";
        statusLabel = "Nguy cơ quá tải";
      }
      return { ...item, status, statusLabel };
    })
    .sort((a, b) => a.weekCount - b.weekCount || a.todayCount - b.todayCount);
}

export function computeHorseCoverage(
  horses: Horse[],
  overview: TrainerHorse[],
  sessions: TrainingSession[],
  calendarDays: string[],
): HorseCoverageStat[] {
  return horses.map((horse) => {
    const overviewItem = overview.find((o) => o.horse_id === horse.id);
    const { regimen: aiRegimen, reason } = recommendRegimenForHorse(horse, overviewItem);
    const weekSessions = sessions.filter(
      (s) => s.horse_id === horse.id && s.status !== "Cancelled" && s.session_type !== "Rest" && calendarDays.includes(s.event_date),
    );
    const hasHighSession = weekSessions.some((s) => s.plan_target_intensity === "High" || s.session_type === "TrialRun");
    const hasMedSession = weekSessions.some((s) => s.plan_target_intensity === "Medium");
    const regimen =
      hasHighSession && aiRegimen.target_intensity !== "High"
        ? STANDARD_REGIMENS[0]
        : (hasHighSession || hasMedSession) && aiRegimen.target_intensity === "Low"
          ? STANDARD_REGIMENS[3]
          : aiRegimen;
    const activeSessionCount = weekSessions.length;
    const totalMinutesWeek = weekSessions.reduce((sum, s) => sum + sessionDurationMinutes(s), 0);
    const byDay = new Map<string, number>();
    for (const s of weekSessions) {
      byDay.set(s.event_date, (byDay.get(s.event_date) ?? 0) + 1);
    }
    const maxSessionsInSingleDay = Math.max(0, ...Array.from(byDay.values()));
    const targetSessionsWeek = Math.max(2, regimen.recommended_sessions_per_week);
    const maxAllowedSessionsWeek = Math.max(4, targetSessionsWeek + 1);
    const maxAllowedMinutesWeek = Math.max(360, regimen.target_workload_minutes * 1.5);

    let coverageStatus: HorseCoverageStat["coverageStatus"] = "balanced";
    let coverageLabel = "Đạt chuẩn";
    if (horse.is_training_locked || overviewItem?.is_training_locked) {
      coverageStatus = "locked";
      coverageLabel = "Đang khóa y tế";
    } else if (activeSessionCount === 0) {
      coverageStatus = "uncovered";
      coverageLabel = "Chưa có lịch tập (0 buổi)";
    } else if (
      activeSessionCount > maxAllowedSessionsWeek ||
      maxSessionsInSingleDay >= 2 ||
      totalMinutesWeek > maxAllowedMinutesWeek
    ) {
      coverageStatus = "overtrained";
      coverageLabel = maxSessionsInSingleDay >= 2
        ? `Tập quá nhiều (${maxSessionsInSingleDay} buổi/ngày)`
        : `Tập quá nhiều (${activeSessionCount}/${targetSessionsWeek} buổi · ${totalMinutesWeek}p)`;
    } else if (activeSessionCount < targetSessionsWeek) {
      coverageStatus = "undertrained";
      coverageLabel = `Thiếu buổi (${activeSessionCount}/${targetSessionsWeek} buổi)`;
    }
    return {
      horse,
      overviewItem,
      weekSessions,
      activeSessionCount,
      totalMinutesWeek,
      maxSessionsInSingleDay,
      recommendedRegimen: regimen,
      aiReason: reason,
      coverageStatus,
      coverageLabel,
    };
  });
}

function PlansPanel({ horse, horses, plans: allPlans, activeOnly, setActiveOnly, editingPlan, setEditingPlan, selectedHorseIds, setSelectedHorseIds, onCreate, onUpdate, onDelete, onSchedule, onApplyRegimen, onResetCleanData, busy, error, notice }: {
  horse: Horse | null; horses: Horse[]; plans: TrainingPlan[]; activeOnly: boolean; setActiveOnly: (value: boolean) => void;
  editingPlan: string | null; setEditingPlan: (id: string | null) => void;
  selectedHorseIds: string[]; setSelectedHorseIds: (value: string[] | ((current: string[]) => string[])) => void;
  onCreate: (event: FormEvent<HTMLFormElement>) => void; onUpdate: (event: FormEvent<HTMLFormElement>, id: string) => void;
  onDelete: (id: string) => void; onSchedule: (plan: TrainingPlan) => void;
  onApplyRegimen: (regimen: StandardRegimen, targetHorseIds: string[], openCalendarAfter?: boolean) => Promise<void>;
  onResetCleanData: () => Promise<void>;
  busy: boolean;
  error?: string;
  notice?: string;
}) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [showDuplicatePlans, setShowDuplicatePlans] = useState(false);
  const [planSearch, setPlanSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<"ALL" | "CAO" | "VỪA" | "THẤP">("ALL");
  const plansPerPage = 6;
  const [planPage, setPlanPage] = useState(1);

  const unlockedHorses = useMemo(() => horses.filter((h) => !h.is_training_locked), [horses]);
  const { uniquePlans, hiddenDuplicateCount } = useMemo(() => deduplicateAndSortPlans(allPlans), [allPlans]);
  const displayPlansSource = useMemo(() => {
    const baseList = showDuplicatePlans
      ? [...allPlans].sort((a, b) => intensityOrderScore(a.target_intensity) - intensityOrderScore(b.target_intensity))
      : uniquePlans;
    const q = normalizeHorseSearch(planSearch.trim());
    return baseList.filter((p) => {
      if (levelFilter === "CAO" && p.target_intensity !== "High") return false;
      if (levelFilter === "VỪA" && p.target_intensity !== "Medium") return false;
      if (levelFilter === "THẤP" && p.target_intensity !== "Low") return false;
      if (q) {
        const planText = normalizeHorseSearch(`${p.stage_name ?? ""} ${p.objective ?? ""} ${p.target_track_surface ?? ""} ${p.target_distance_meters ?? ""}`);
        const matchesHorseName = unlockedHorses.some((h) => normalizeHorseSearch(`${h.horse_name ?? ""} ${h.box_code ?? ""}`).includes(q));
        if (!planText.includes(q) && !matchesHorseName) return false;
      }
      return true;
    });
  }, [allPlans, uniquePlans, showDuplicatePlans, planSearch, levelFilter, unlockedHorses]);

  const filteredStandardRegimens = useMemo(() => {
    const q = normalizeHorseSearch(planSearch.trim());
    return STANDARD_REGIMENS.filter((reg) => {
      if (levelFilter !== "ALL" && reg.levelLabel !== levelFilter) return false;
      if (q) {
        const regText = normalizeHorseSearch(`${reg.title} ${reg.subtitle} ${reg.stage_name} ${reg.target_track_surface} ${reg.target_distance_meters}`);
        const matchesHorseName = unlockedHorses.some((h) => normalizeHorseSearch(`${h.horse_name ?? ""} ${h.box_code ?? ""}`).includes(q));
        if (!regText.includes(q) && !matchesHorseName) return false;
      }
      return true;
    });
  }, [planSearch, levelFilter, unlockedHorses]);

  const totalPlanPages = Math.max(1, Math.ceil(displayPlansSource.length / plansPerPage));
  const currentPlanPage = Math.min(planPage, totalPlanPages);
  const plans = displayPlansSource.slice((currentPlanPage - 1) * plansPerPage, currentPlanPage * plansPerPage);
  const selectableHorseId = horse && !horse.is_training_locked ? horse.id : null;
  const createFormRef = useRef<HTMLFormElement>(null);
  const [duplicateWarningPlan, setDuplicateWarningPlan] = useState<TrainingPlan | null>(null);

  useEffect(() => {
    setSelectedHorseIds(selectableHorseId ? [selectableHorseId] : []);
  }, [selectableHorseId, setSelectedHorseIds]);
  useEffect(() => {
    setPlanPage(1);
    setConfirmDelete(null);
    setDuplicateWarningPlan(null);
  }, [horse?.id, activeOnly, allPlans]);
  useEffect(() => {
    if (planPage > totalPlanPages) setPlanPage(totalPlanPages);
  }, [planPage, totalPlanPages]);

  function handleFormChange() {
    const form = createFormRef.current;
    if (!form) return;
    const data = new FormData(form);
    const dist = Number(data.get("target_distance_meters")) || null;
    const workload = Number(data.get("target_workload_minutes")) || null;
    const surface = String(data.get("target_track_surface") || "").toLowerCase();
    const intensity = String(data.get("target_intensity") || "");
    if (!dist || !surface || !intensity) {
      setDuplicateWarningPlan(null);
      return;
    }
    const existing = allPlans.find((p) =>
      p.target_intensity === intensity &&
      p.target_distance_meters === dist &&
      (p.target_track_surface ?? "").toLowerCase() === surface &&
      (!workload || p.target_workload_minutes === workload),
    );
    setDuplicateWarningPlan(existing ?? null);
  }

  const canCreate = selectedHorseIds.length > 0 && selectedHorseIds.every((id) => horses.some((item) => item.id === id && !item.is_training_locked));
  return <div className="space-y-4">
    <Section
      title="Giáo án chuẩn (Cao → Vừa → Thấp)"
      icon={ClipboardList}
      action={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void onResetCleanData()}
            className="soft-button border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100"
            title="Xóa toàn bộ giáo án & lịch tập cũ bị trùng/lộn xộn và tự động tạo lại bộ chuẩn sạch cho toàn bộ ngựa"
          >
            <RefreshCw size={13} /> 🧹 Làm sạch & Tạo lại Giáo án + Lịch chuẩn
          </button>
        </div>
      }
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-equine-line bg-slate-50/80 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-56">
            <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={planSearch}
              onChange={(e) => setPlanSearch(e.target.value)}
              placeholder="Tìm giáo án, cự ly, sân..."
              className="h-8 w-full rounded-lg border border-equine-line bg-white pl-7 pr-7 text-xs text-slate-800 outline-none focus:border-equine-navy"
            />
            {planSearch && (
              <button
                type="button"
                onClick={() => setPlanSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                title="Xóa tìm kiếm"
              >
                <X size={12} />
              </button>
            )}
          </div>
          <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5">
            {(["ALL", "CAO", "VỪA", "THẤP"] as const).map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setLevelFilter(lvl)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition ${
                  levelFilter === lvl ? "bg-equine-navy text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {lvl === "ALL" ? "Tất cả" : `Mức ${lvl}`}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-bold text-equine-navy">
            Ngựa áp dụng ({selectedHorseIds.length}/{unlockedHorses.length}):
          </span>
          {unlockedHorses.map((item) => {
            const checked = selectedHorseIds.includes(item.id);
            return (
              <label
                key={item.id}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                  checked
                    ? "border-blue-600 bg-blue-50 font-semibold text-blue-950 shadow-xs"
                    : "border-equine-line bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) =>
                    setSelectedHorseIds((curr) =>
                      e.target.checked ? [...new Set([...curr, item.id])] : curr.filter((id) => id !== item.id),
                    )
                  }
                />
                <span>{item.horse_name}</span>
                {item.box_code && (
                  <span className="rounded bg-slate-100 px-1 py-0.2 text-[10px] text-slate-500">
                    {item.box_code}
                  </span>
                )}
              </label>
            );
          })}
          <button
            type="button"
            className="soft-button px-2.5 py-1 text-[11px]"
            onClick={() => setSelectedHorseIds(unlockedHorses.map((h) => h.id))}
          >
            Chọn tất cả ({unlockedHorses.length})
          </button>
          {horse && !horse.is_training_locked && (
            <button
              type="button"
              className="soft-button px-2.5 py-1 text-[11px]"
              onClick={() => setSelectedHorseIds([horse.id])}
            >
              Chỉ {horse.horse_name}
            </button>
          )}
        </div>
      </div>

      {/* Bảng List 9 Giáo án Chuẩn: CAO (3) -> VỪA (3) -> THẤP (3) */}
      <div className="overflow-x-auto rounded-xl border border-equine-line bg-white">
        <table className="w-full min-w-[780px] text-left text-xs">
          <thead>
            <tr className="border-b border-equine-line bg-slate-100 text-[11px] font-extrabold uppercase tracking-wide text-slate-700">
              <th className="px-3 py-2.5">Mức độ</th>
              <th className="px-3 py-2.5">Giáo án</th>
              <th className="px-3 py-2.5">Thông số tự điền</th>
              <th className="px-3 py-2.5">Số lượt chạy / ca (90p)</th>
              <th className="px-3 py-2.5 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-equine-line">
            {filteredStandardRegimens.map((reg) => {
              const runInfo = analyzeSessionRunStructure(reg.target_distance_meters, reg.target_intensity);
              return (
                <tr
                  key={reg.key}
                  className="transition hover:bg-slate-50/80"
                >
                  <td className="px-3 py-2 align-middle">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${reg.badgeClass}`}>
                      {reg.shortBadge}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <p className="font-bold text-equine-navy">{reg.title}</p>
                    <p className="text-[11px] text-slate-500">{reg.subtitle}</p>
                  </td>
                  <td className="px-3 py-2 align-middle font-medium text-slate-800">
                    <strong>{reg.target_distance_meters.toLocaleString("vi-VN")}m</strong> · {surfaceLabel(reg.target_track_surface)} · {reg.recommended_sessions_per_week} buổi/tuần ({reg.target_workload_minutes}p)
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <strong className="text-slate-900">
                      {runInfo.runsPerSession} lượt × {runInfo.distancePerRunMeters.toLocaleString("vi-VN")}m
                    </strong>
                    <span className="ml-1 text-[11px] text-slate-500">
                      ({runInfo.totalLaps} vòng · nghỉ {runInfo.restBetweenRunsMinutes}p)
                    </span>
                  </td>
                  <td className="px-3 py-2 align-middle text-right">
                    <button
                      type="button"
                      disabled={busy || !canCreate}
                      onClick={() => void onApplyRegimen(reg, selectedHorseIds.length ? selectedHorseIds : (horse ? [horse.id] : []), true)}
                      className="gold-button px-2.5 py-1 text-xs"
                    >
                      <CalendarDays size={12} /> Chọn lên lịch
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>

    {/* Danh sách Giáo án đã có của ngựa */}
    <Section
      title={horse ? `Giáo án đã có — ${horse.horse_name}` : "Giáo án đã có"}
      icon={ClipboardList}
      action={
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          {hiddenDuplicateCount > 0 && (
            <label className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-900 ring-1 ring-amber-200">
              <input
                type="checkbox"
                checked={showDuplicatePlans}
                onChange={(e) => setShowDuplicatePlans(e.target.checked)}
              />
              Ẩn {hiddenDuplicateCount} bản trùng
            </label>
          )}
          <label className="inline-flex cursor-pointer items-center gap-1 font-medium text-slate-700">
            <input type="checkbox" checked={activeOnly} onChange={(event) => setActiveOnly(event.target.checked)} />
            Đang hoạt động
          </label>
          <button
            type="button"
            onClick={() => setShowCustomForm((v) => !v)}
            className="soft-button px-2.5 py-1.5 text-xs"
          >
            <Plus size={13} /> {showCustomForm ? "Đóng form" : "Tạo tùy chỉnh"}
          </button>
        </div>
      }
    >
      {showCustomForm && (
        <div className="mb-4 rounded-xl border border-blue-200 bg-slate-50/90 p-3.5">
          {error && <div className="mb-3"><Notice error>{error}</Notice></div>}
          {notice && <div className="mb-3"><Notice>{notice}</Notice></div>}
          <form ref={createFormRef} onSubmit={onCreate} onChange={handleFormChange} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2 lg:col-span-4">
              {selectedHorseIds.map((id) => <input key={id} type="hidden" name="horse_ids" value={id} />)}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="font-semibold text-slate-600">Áp dụng cho:</span>
                {selectedHorseIds.length > 0
                  ? selectedHorseIds.map((id) => {
                      const h = horses.find((item) => item.id === id);
                      return h ? <span key={id} className="rounded bg-white border border-equine-line px-2 py-0.5 font-semibold text-equine-navy">{h.horse_name}</span> : null;
                    })
                  : <span className="text-slate-500">Chưa chọn ngựa</span>}
              </div>
            </div>
            {duplicateWarningPlan && (
              <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-950">
                <span>⚠️ Đã có giáo án trùng thông số: <b>{duplicateWarningPlan.stage_name}</b></span>
                <button type="button" className="gold-button shrink-0 px-2.5 py-1 text-xs" onClick={() => onSchedule(duplicateWarningPlan)}>
                  <CalendarDays size={12} /> Chọn lên lịch luôn
                </button>
              </div>
            )}
            <Field label="Tên giai đoạn" name="stage_name" required maxLength={100} />
            <SelectField label="Cự ly (m)" name="target_distance_meters" required options={distanceOptions} />
            <Field label="Khối lượng (phút/tuần)" name="target_workload_minutes" type="number" min={1} required max={1440} />
            <SelectField label="Mặt sân" name="target_track_surface" required options={[["", "Chưa chọn"], ["Dirt", "Đất"], ["Turf", "Cỏ"], ["Synthetic", "Nhân tạo"]]} />
            <Field label="Bắt đầu" name="start_date" type="date" required defaultValue={today()} />
            <Field label="Kết thúc" name="end_date" type="date" required defaultValue={plusDays(today(), 60)} />
            <SelectField label="Cường độ" name="target_intensity" required options={[["High", "Cao"], ["Medium", "Vừa"], ["Low", "Thấp"]]} />
            <Field label="Hạn sửa trước (giờ)" name="update_deadline_hours" type="number" min={0} defaultValue={24} />
            <div className="sm:col-span-2 lg:col-span-3">
              <TextArea label="Mục tiêu" name="objective" rows={2} />
            </div>
            <div className="flex items-end"><button className="gold-button w-full justify-center" disabled={busy || !canCreate}><Plus size={14} /> Lưu giáo án</button></div>
          </form>
        </div>
      )}

      {!showCustomForm && !editingPlan && (error || notice) && (
        <div className="mb-3 space-y-2">
          {error && <Notice error>{error}</Notice>}
          {notice && <Notice>{notice}</Notice>}
        </div>
      )}
      {plans.length === 0 ? (
        <Notice>Chưa có giáo án. Hãy chọn 1 trong 3 mức Cao / Vừa / Thấp ở trên.</Notice>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-equine-line bg-white">
          <table className="w-full min-w-[780px] text-left text-xs">
            <thead>
              <tr className="border-b border-equine-line bg-slate-50 text-[11px] font-extrabold uppercase tracking-wide text-slate-600">
                <th className="px-3 py-2.5">Mức</th>
                <th className="px-3 py-2.5">Giáo án</th>
                <th className="px-3 py-2.5">Thông số</th>
                <th className="px-3 py-2.5">Chia lượt / ca</th>
                <th className="px-3 py-2.5">Lịch</th>
                <th className="px-3 py-2.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-equine-line">
              {plans.map((plan) => {
                const intensityBadge = plan.target_intensity === "High"
                  ? "bg-rose-100 text-rose-800 border-rose-300"
                  : plan.target_intensity === "Low"
                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                  : "bg-blue-100 text-blue-800 border-blue-300";
                const intensityLabel = ({ High: "CAO", Medium: "VỪA", Low: "THẤP" } as Record<string, string>)[plan.target_intensity ?? ""] ?? "—";
                const runInfo = analyzeSessionRunStructure(plan.target_distance_meters, plan.target_intensity);

                return (
                  <Fragment key={plan.id}>
                    <tr className="transition hover:bg-slate-50/90">
                      <td className="px-3 py-2.5 align-middle">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${intensityBadge}`}>
                          {intensityLabel}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <strong className="font-bold text-equine-navy">{plan.stage_name}</strong>
                          {!plan.is_active && (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">Hết hạn</span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500">{plan.start_date ?? "—"} → {plan.end_date ?? "—"}</p>
                      </td>
                      <td className="px-3 py-2.5 align-middle font-medium text-slate-800">
                        <strong>{plan.target_distance_meters != null ? `${plan.target_distance_meters.toLocaleString("vi-VN")}m` : "—"}</strong> · {surfaceLabel(plan.target_track_surface)} · {plan.target_workload_minutes ?? "—"}p/tuần
                      </td>
                      <td className="px-3 py-2.5 align-middle text-slate-700">
                        <strong>{runInfo.runsPerSession} lượt × {runInfo.distancePerRunMeters.toLocaleString("vi-VN")}m</strong> ({runInfo.totalLaps} vòng)
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        <span className="rounded-full bg-equine-mist px-2 py-0.5 text-[11px] font-semibold text-equine-navy">
                          {plan.training_schedules_count} buổi
                        </span>
                      </td>
                      <td className="px-3 py-2.5 align-middle text-right">
                        <div className="inline-flex flex-wrap items-center justify-end gap-1">
                          <button
                            type="button"
                            className="gold-button px-2.5 py-1 text-xs"
                            disabled={busy || Boolean(plan.end_date && plan.end_date < today())}
                            onClick={() => onSchedule(plan)}
                          >
                            <CalendarDays size={12} /> Lên lịch
                          </button>
                          <button
                            type="button"
                            className="soft-button px-2 py-1 text-xs"
                            disabled={busy}
                            onClick={() => { setConfirmDelete(null); setEditingPlan(editingPlan === plan.id ? null : plan.id); }}
                          >
                            <Pencil size={12} />
                          </button>
                          {plan.training_schedules_count === 0 && (
                            <button
                              type="button"
                              className="soft-button px-2 py-1 text-xs text-rose-700"
                              disabled={busy}
                              onClick={() => setConfirmDelete(confirmDelete === plan.id ? null : plan.id)}
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {editingPlan === plan.id && (
                      <tr className="bg-slate-50">
                        <td colSpan={6} className="p-3.5">
                          {error && <div className="mb-2.5"><Notice error>{error}</Notice></div>}
                          {notice && <div className="mb-2.5"><Notice>{notice}</Notice></div>}
                          <form onSubmit={(event) => onUpdate(event, plan.id)} className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                            <Field label="Tên giai đoạn" name="stage_name" required defaultValue={plan.stage_name} />
                            <SelectField label="Cự ly (m)" name="target_distance_meters" required defaultValue={String(plan.target_distance_meters ?? "")} options={distanceOptionsWithCurrent(plan.target_distance_meters)} />
                            <Field label="Khối lượng (phút/tuần)" name="target_workload_minutes" type="number" min={1} required max={1440} defaultValue={plan.target_workload_minutes} />
                            <SelectField label="Mặt sân" name="target_track_surface" required defaultValue={plan.target_track_surface ?? ""} options={[["", "Chưa chọn"], ["Dirt", "Đất"], ["Turf", "Cỏ"], ["Synthetic", "Nhân tạo"]]} />
                            <Field label="Bắt đầu" name="start_date" type="date" required defaultValue={plan.start_date} />
                            <Field label="Kết thúc" name="end_date" type="date" required defaultValue={plan.end_date} />
                            <SelectField label="Cường độ" name="target_intensity" required defaultValue={plan.target_intensity ?? ""} options={[["", "Chưa đặt"], ["High", "Cao"], ["Medium", "Vừa"], ["Low", "Thấp"]]} />
                            <Field label="Hạn sửa (giờ)" name="update_deadline_hours" type="number" min={0} defaultValue={plan.update_deadline_hours} />
                            <div className="sm:col-span-2 lg:col-span-3">
                              <TextArea label="Mục tiêu" name="objective" defaultValue={plan.objective} rows={2} />
                            </div>
                            <div className="flex items-end gap-2"><button className="gold-button" disabled={busy}><Check size={14} /> Lưu</button><button type="button" className="soft-button" onClick={() => setEditingPlan(null)}><X size={14} /> Đóng</button></div>
                          </form>
                        </td>
                      </tr>
                    )}
                    {confirmDelete === plan.id && editingPlan !== plan.id && (
                      <tr className="bg-rose-50/80">
                        <td colSpan={6} className="px-4 py-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-rose-900">
                            <span>Xóa giáo án <strong>“{plan.stage_name}”</strong>?</span>
                            <div className="flex gap-2">
                              <button type="button" className="soft-button px-2.5 py-1" disabled={busy} onClick={() => setConfirmDelete(null)}>Hủy</button>
                              <button type="button" className="soft-button border-rose-200 bg-rose-600 px-2.5 py-1 text-white hover:bg-rose-700" disabled={busy} onClick={() => { setConfirmDelete(null); onDelete(plan.id); }}><Trash2 size={12} /> Xóa</button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {displayPlansSource.length > plansPerPage && <nav className="mt-4 flex flex-wrap items-center justify-center gap-2" aria-label="Phân trang giáo án">
        <button type="button" className="soft-button min-w-9 justify-center px-3" onClick={() => setPlanPage(1)} disabled={currentPlanPage === 1} aria-label="Trang đầu">«</button>
        <button type="button" className="soft-button min-w-9 justify-center px-3" onClick={() => setPlanPage((page) => Math.max(1, page - 1))} disabled={currentPlanPage === 1} aria-label="Trang trước">‹</button>
        {Array.from({ length: totalPlanPages }, (_, index) => index + 1).map((page) => <button key={page} type="button" className={page === currentPlanPage ? "gold-button min-w-9 justify-center px-3" : "soft-button min-w-9 justify-center px-3"} onClick={() => setPlanPage(page)} aria-current={page === currentPlanPage ? "page" : undefined}>{page}</button>)}
        <button type="button" className="soft-button min-w-9 justify-center px-3" onClick={() => setPlanPage((page) => Math.min(totalPlanPages, page + 1))} disabled={currentPlanPage === totalPlanPages} aria-label="Trang sau">›</button>
        <button type="button" className="soft-button min-w-9 justify-center px-3" onClick={() => setPlanPage(totalPlanPages)} disabled={currentPlanPage === totalPlanPages} aria-label="Trang cuối">»</button>
      </nav>}
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

const TRAINING_TIMETABLE_SLOTS = [
  { id: 1, timeRange: "07h00 - 08h30", start: "07:00", end: "08:30" },
  { id: 2, timeRange: "08h45 - 10h15", start: "08:45", end: "10:15" },
  { id: 3, timeRange: "10h30 - 12h00", start: "10:30", end: "12:00" },
  { id: 4, timeRange: "12h30 - 14h00", start: "12:30", end: "14:00" },
  { id: 5, timeRange: "14h15 - 15h45", start: "14:15", end: "15:45" },
  { id: 6, timeRange: "16h15 - 17h45", start: "16:15", end: "17:45" },
];

function getTrainingSlot(session: TrainingSession) {
  if (!session.start_time) return 1;
  const [hours, minutes = "0"] = session.start_time.split(":");
  const total = Number(hours) + Number(minutes) / 60;
  if (total < 8.625) return 1;
  if (total < 10.375) return 2;
  if (total < 12.25) return 3;
  if (total < 14.125) return 4;
  if (total < 16) return 5;
  return 6;
}

function trainingDayLabel(value: string) {
  const day = new Date(`${value}T12:00:00`).getDay();
  return day === 0 ? "Chủ nhật" : `Thứ ${day + 1}`;
}

function suggestedTrainingSlot(preferredDate?: string | null) {
  const todayStr = today();
  if (preferredDate && preferredDate > todayStr) {
    return { date: preferredDate, slot: TRAINING_TIMETABLE_SLOTS[0] };
  }
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nextToday = TRAINING_TIMETABLE_SLOTS.find((s) => {
    const [h, m] = s.start.split(":").map(Number);
    return h * 60 + m > nowMinutes;
  });
  if (nextToday) {
    return { date: todayStr, slot: nextToday };
  }
  return { date: plusDays(todayStr, 1), slot: TRAINING_TIMETABLE_SLOTS[0] };
}

type RankedSlotGroom = {
  groom: Groom;
  dayCount: number;
  weekCount: number;
  busyReason: string | null;
};

type EvaluatedSlot = {
  slot: (typeof TRAINING_TIMETABLE_SLOTS)[number];
  isPast: boolean;
  horseTrainingConflict: TrainingSession | null;
  horseCareConflict: CareCalendarEvent | null;
  isFreeForHorse: boolean;
  hasFreeGroom: boolean;
  statusLabel: string;
  rankedGrooms: RankedSlotGroom[];
  bestGroomId: string;
};

function evaluateSlotForDateAndHorse(
  horseId: string,
  date: string,
  slot: (typeof TRAINING_TIMETABLE_SLOTS)[number],
  sessions: TrainingSession[],
  careEvents: CareCalendarEvent[],
  groomWorkloads: GroomWorkloadStat[],
): EvaluatedSlot {
  const todayStr = today();
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const slotStartMins = timeToMinutes(slot.start) ?? 0;
  const isPast = date < todayStr || (date === todayStr && slotStartMins <= nowMinutes);

  const activeDaySessions = sessions.filter((s) => s.status !== "Cancelled" && s.event_date === date);
  const horseTrainingConflict = activeDaySessions.find(
    (s) => s.horse_id === horseId && getTrainingSlot(s) === slot.id,
  ) ?? null;

  const horseCareConflict = careEvents.find((c) => {
    if (c.status === "Cancelled" || c.status === "Completed") return false;
    if (c.event_date !== date || c.horse_id !== horseId) return false;
    return doesCareEventOverlapSlot(c, slot.id);
  }) ?? null;

  const rankedGrooms: RankedSlotGroom[] = groomWorkloads
    .map((gw) => {
      const gid = gw.groom.user_id;
      const dayCount = activeDaySessions.filter((s) => s.assigned_groom_id === gid).length;
      const busySession = activeDaySessions.find(
        (s) => s.assigned_groom_id === gid && getTrainingSlot(s) === slot.id,
      );
      const busyCare = careEvents.find(
        (c) =>
          c.status !== "Cancelled" &&
          c.status !== "Completed" &&
          c.event_date === date &&
          c.groom_id === gid &&
          doesCareEventOverlapSlot(c, slot.id),
      );
      const busyReason = busySession
        ? `đang tập ${busySession.horse_name || "ngựa khác"}`
        : busyCare
          ? `bận chăm sóc ${busyCare.horse_name || ""}`.trim()
          : null;
      return {
        groom: gw.groom,
        dayCount,
        weekCount: gw.weekCount,
        busyReason,
      };
    })
    .sort((a, b) => {
      const aBusy = a.busyReason ? 1 : 0;
      const bBusy = b.busyReason ? 1 : 0;
      if (aBusy !== bBusy) return aBusy - bBusy;
      if (a.dayCount !== b.dayCount) return a.dayCount - b.dayCount;
      return a.weekCount - b.weekCount;
    });

  const isFreeForHorse = !isPast && !horseTrainingConflict && !horseCareConflict;
  const firstFreeGroom = rankedGrooms.find((g) => !g.busyReason);
  const hasFreeGroom = Boolean(firstFreeGroom);
  const bestGroomId = firstFreeGroom
    ? String(firstFreeGroom.groom.user_id)
    : rankedGrooms[0]
      ? String(rankedGrooms[0].groom.user_id)
      : "";

  let statusLabel = "✓ Trống";
  if (isPast) statusLabel = "✗ Đã qua giờ";
  else if (horseTrainingConflict) statusLabel = "✗ Ngựa đã có ca tập";
  else if (horseCareConflict) statusLabel = `✗ Trùng lịch Y tế (${careEventTypeLabel(horseCareConflict.care_type ?? horseCareConflict.event_type, horseCareConflict.title)})`;
  else if (groomWorkloads.length > 0 && !hasFreeGroom) statusLabel = "⚠ Không còn Groom rảnh";

  return {
    slot,
    isPast,
    horseTrainingConflict,
    horseCareConflict,
    isFreeForHorse,
    hasFreeGroom,
    statusLabel,
    rankedGrooms,
    bestGroomId,
  };
}

function findBestDateSlotAndGroom(
  horseId: string,
  minDate: string,
  maxDate: string | null | undefined,
  sessions: TrainingSession[],
  careEvents: CareCalendarEvent[],
  groomWorkloads: GroomWorkloadStat[],
  preferredWeeklyCap = 3,
): { date: string; slot: (typeof TRAINING_TIMETABLE_SLOTS)[number]; groomId: string } {
  const todayStr = today();
  const startDay = minDate >= todayStr ? minDate : todayStr;
  const candidateDates: string[] = [];
  for (let i = 0; i < 21; i++) {
    const d = plusDays(startDay, i);
    if (maxDate && d > maxDate) break;
    candidateDates.push(d);
  }
  if (candidateDates.length === 0) candidateDates.push(startDay);

  const horseActiveSessions = sessions.filter(
    (s) => s.status !== "Cancelled" && s.session_type !== "Rest" && s.horse_id === horseId,
  );
  const horseTrainingDates = new Set(horseActiveSessions.map((s) => s.event_date));
  const sessionsPerWeekMap = new Map<string, number>();
  for (const s of horseActiveSessions) {
    const wk = mondayOfWeek(s.event_date);
    sessionsPerWeekMap.set(wk, (sessionsPerWeekMap.get(wk) ?? 0) + 1);
  }

  type ScoredCandidate = {
    date: string;
    slot: (typeof TRAINING_TIMETABLE_SLOTS)[number];
    groomId: string;
    score: number;
  };
  const candidates: ScoredCandidate[] = [];

  for (let dayIdx = 0; dayIdx < candidateDates.length; dayIdx++) {
    const d = candidateDates[dayIdx];
    const wk = mondayOfWeek(d);
    const weekCountForHorse = sessionsPerWeekMap.get(wk) ?? 0;
    const horseSessionsOnDay = horseActiveSessions.filter((s) => s.event_date === d).length;
    const hasAdjacentDaySession =
      horseTrainingDates.has(plusDays(d, -1)) || horseTrainingDates.has(plusDays(d, 1));
    const totalClubSessionsOnDay = sessions.filter(
      (s) => s.status !== "Cancelled" && s.event_date === d,
    ).length;

    for (const slot of TRAINING_TIMETABLE_SLOTS) {
      const ev = evaluateSlotForDateAndHorse(horseId, d, slot, sessions, careEvents, groomWorkloads);
      if (!ev.isFreeForHorse) continue;

      const totalClubSessionsInSlot = sessions.filter(
        (s) => s.status !== "Cancelled" && s.event_date === d && getTrainingSlot(s) === slot.id,
      ).length;

      // Score lower is better:
      // 1. Strongly avoid stacking >=2 sessions on the same day for the same horse (+10000)
      // 2. If current week already reached preferredWeeklyCap, push to next week (+3000)
      // 3. Prefer spacing training days by 1 rest day (+400 if adjacent day already has training)
      // 4. Require at least 1 free Groom (+1500 if no free groom)
      // 5. Spread evenly across slots & days in the club (+30 * slot load + 10 * day load)
      // 6. Prefer earlier valid date/slot (+12 * dayIdx + slot.id)
      let score = 0;
      if (horseSessionsOnDay > 0) score += 10000 * horseSessionsOnDay;
      if (weekCountForHorse >= preferredWeeklyCap) score += 3000 + (weekCountForHorse - preferredWeeklyCap) * 1000;
      if (hasAdjacentDaySession) score += 400;
      if (groomWorkloads.length > 0 && !ev.hasFreeGroom) score += 1500;
      score += totalClubSessionsInSlot * 35 + totalClubSessionsOnDay * 10 + dayIdx * 12 + slot.id;

      candidates.push({
        date: d,
        slot,
        groomId: ev.bestGroomId,
        score,
      });
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => a.score - b.score);
    return {
      date: candidates[0].date,
      slot: candidates[0].slot,
      groomId: candidates[0].groomId,
    };
  }

  const def = suggestedTrainingSlot(startDay);
  const ev = evaluateSlotForDateAndHorse(horseId, def.date, def.slot, sessions, careEvents, groomWorkloads);
  return { date: def.date, slot: def.slot, groomId: ev.bestGroomId };
}

function CalendarPanel({ selectedHorseId, onSelectHorse, overview, horses, sessions, careEvents, grooms, from, to, onWeekChange, scheduleDraft, onCreate, onResetCleanData, onAssign, onStatus, onVideo, showMetricsFor, setShowMetricsFor, busy, onOpenSimulation, onTargetsSaved, error, notice, lastCreatedSessionId }: {
  selectedHorseId: string; onSelectHorse: (id: string) => void; overview: TrainerHorse[]; horses: Horse[]; sessions: TrainingSession[]; careEvents: CareCalendarEvent[]; grooms: Groom[]; from: string; to: string; onWeekChange: (value: string) => void;
  onCreate: (event: FormEvent<HTMLFormElement>) => Promise<TrainingSession | null>;
  onResetCleanData: () => Promise<void>;
  scheduleDraft: { horseId: string; planId: string; startDate: string | null; regimenKey?: RegimenLevel } | null;
  onTargetsSaved: () => Promise<void>;
  onOpenSimulation: (session: TrainingSession) => void;
  onAssign: (id: string, groomId: number) => void; onStatus: (id: string, status: string) => void;
  onVideo: (event: FormEvent<HTMLFormElement>, id: string) => void; showMetricsFor: string | null;
  setShowMetricsFor: (id: string | null) => void; busy: boolean;
  error?: string;
  notice?: string;
  lastCreatedSessionId?: string | null;
}) {
  const [createHorse, setCreateHorse] = useState((selectedHorseId || horses[0]?.id) ?? "");
  const [allHorsePlans, setHorsePlans] = useState<TrainingPlan[]>([]);
  const [horsePlansLoading, setHorsePlansLoading] = useState(false);
  const [horsePlansError, setHorsePlansError] = useState("");
  const [plansReload, setPlansReload] = useState(0);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [regimenPreset, setRegimenPreset] = useState<string>("MEDIUM_ENDURANCE");
  const [scheduleDefaults] = useState(() => suggestedTrainingSlot(scheduleDraft?.startDate));
  const [selectedSlotId, setSelectedSlotId] = useState<string>(() => String(scheduleDefaults.slot.id));
  const [sessionType, setSessionType] = useState("Training");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState(() => scheduleDefaults.date);
  const [startTimeVal, setStartTimeVal] = useState(() => scheduleDefaults.slot.start);
  const [endTimeVal, setEndTimeVal] = useState(() => scheduleDefaults.slot.end);
  const [assignedGroomVal, setAssignedGroomVal] = useState("");
  const [surfaceVal, setSurfaceVal] = useState("Dirt");
  const [distanceVal, setDistanceVal] = useState("1200");
  const [intensityVal, setIntensityVal] = useState("Medium");
  const [showAllHorsesTimetable, setShowAllHorsesTimetable] = useState(true);
  const [groomFilterId, setGroomFilterId] = useState<string>("");
  const [coverageFilter, setCoverageFilter] = useState<"all" | "uncovered" | "overtrained" | "undertrained" | "balanced" | "locked">("all");
  const createFormRef = useRef<HTMLFormElement>(null);

  const calendarDays = useMemo(() => Array.from({ length: 7 }, (_, index) => plusDays(from, index)), [from]);
  const groomWorkloads = useMemo(() => computeGroomWorkloads(grooms, sessions, calendarDays), [grooms, sessions, calendarDays]);
  const horseCoverageList = useMemo(() => computeHorseCoverage(horses, overview, sessions, calendarDays), [horses, overview, sessions, calendarDays]);

  const currentSlotCareConflict = useMemo(() => {
    if (!createHorse || !scheduleDate) return null;
    const sStart = timeToMinutes(startTimeVal);
    const sEnd = timeToMinutes(endTimeVal);
    return careEvents.find((c) => {
      if (c.status === "Cancelled" || c.status === "Completed") return false;
      if (c.event_date !== scheduleDate) return false;
      const matchesHorse = c.horse_id === createHorse;
      const matchesGroom = Boolean(assignedGroomVal && c.groom_id != null && String(c.groom_id) === assignedGroomVal);
      if (!matchesHorse && !matchesGroom) return false;
      if (!c.start_time || !c.end_time) {
        if (c.event_type === "CareTask") return false;
        return matchesHorse;
      }
      const cStart = timeToMinutes(c.start_time);
      const cEnd = timeToMinutes(c.end_time);
      if (cStart == null || cEnd == null || sStart == null || sEnd == null) return false;
      return cStart < sEnd && cEnd > sStart;
    }) ?? null;
  }, [careEvents, createHorse, scheduleDate, startTimeVal, endTimeVal, assignedGroomVal]);

  const uncoveredCount = horseCoverageList.filter((h) => h.coverageStatus === "uncovered").length;
  const undertrainedCount = horseCoverageList.filter((h) => h.coverageStatus === "undertrained").length;
  const overtrainedCount = horseCoverageList.filter((h) => h.coverageStatus === "overtrained").length;
  const balancedCount = horseCoverageList.filter((h) => h.coverageStatus === "balanced").length;
  const unassignedSessionsCount = sessions.filter((s) => s.status === "Scheduled" && s.session_type !== "Rest" && !s.assigned_groom_id && calendarDays.includes(s.event_date)).length;

  const horsePlans = useMemo(() => {
    const active = allHorsePlans.filter((plan) => {
      if (!plan.is_active) return false;
      if (plan.start_date && scheduleDate < plan.start_date) return false;
      if (plan.end_date && scheduleDate > plan.end_date) return false;
      return true;
    });
    return deduplicateAndSortPlans(active).uniquePlans;
  }, [allHorsePlans, scheduleDate]);
  const selectedPlan = horsePlans.find((plan) => plan.id === selectedPlanId) ?? allHorsePlans.find((plan) => plan.id === selectedPlanId);

  const currentHorseObj = horses.find((h) => h.id === createHorse) ?? horses.find((h) => h.id === selectedHorseId) ?? null;
  const currentOverviewObj = overview.find((o) => o.horse_id === currentHorseObj?.id);
  const currentHorseAi = useMemo(
    () => (currentHorseObj ? recommendRegimenForHorse(currentHorseObj, currentOverviewObj) : null),
    [currentHorseObj, currentOverviewObj],
  );
  const currentRunStructure = useMemo(
    () => analyzeSessionRunStructure(Number(distanceVal) || 1200, intensityVal),
    [distanceVal, intensityVal],
  );
  const [notesVal, setNotesVal] = useState("");

  const slotEvaluationsForDate = useMemo(
    () =>
      TRAINING_TIMETABLE_SLOTS.map((slot) =>
        evaluateSlotForDateAndHorse(createHorse, scheduleDate, slot, sessions, careEvents, groomWorkloads),
      ),
    [createHorse, scheduleDate, sessions, careEvents, groomWorkloads],
  );

  const currentSlotEval = useMemo(
    () =>
      slotEvaluationsForDate.find((ev) => String(ev.slot.id) === selectedSlotId) ??
      slotEvaluationsForDate[0],
    [slotEvaluationsForDate, selectedSlotId],
  );

  // Automatically pick best available Groom for current (scheduleDate, selectedSlotId) whenever slot/date/horse/sessions change
  useEffect(() => {
    if (!currentSlotEval) return;
    const currentGroomStat = currentSlotEval.rankedGrooms.find(
      (g) => String(g.groom.user_id) === assignedGroomVal,
    );
    // If no groom selected, or currently selected groom is busy in this slot, or another groom is clearly freer, auto-select bestGroomId
    if (!assignedGroomVal || currentGroomStat?.busyReason || currentSlotEval.bestGroomId) {
      if (currentSlotEval.bestGroomId && currentSlotEval.bestGroomId !== assignedGroomVal) {
        setAssignedGroomVal(currentSlotEval.bestGroomId);
      }
    }
  }, [currentSlotEval, assignedGroomVal]);

  // When scheduleDate changes and current slot is not free for the horse on that date, auto-hop to the least-crowded free slot on that date
  useEffect(() => {
    if (!createHorse || slotEvaluationsForDate.length === 0) return;
    const currentEv = slotEvaluationsForDate.find((ev) => String(ev.slot.id) === selectedSlotId);
    if (currentEv && currentEv.isFreeForHorse && (currentEv.hasFreeGroom || groomWorkloads.length === 0)) {
      return;
    }
    const freeSlots = slotEvaluationsForDate
      .filter((ev) => ev.isFreeForHorse)
      .sort((a, b) => {
        if (a.hasFreeGroom !== b.hasFreeGroom) return a.hasFreeGroom ? -1 : 1;
        const aClubLoad = sessions.filter((s) => s.status !== "Cancelled" && s.event_date === scheduleDate && getTrainingSlot(s) === a.slot.id).length;
        const bClubLoad = sessions.filter((s) => s.status !== "Cancelled" && s.event_date === scheduleDate && getTrainingSlot(s) === b.slot.id).length;
        return aClubLoad - bClubLoad || a.slot.id - b.slot.id;
      });
    const bestSlotOnDay = freeSlots[0];
    if (bestSlotOnDay && String(bestSlotOnDay.slot.id) !== selectedSlotId) {
      setSelectedSlotId(String(bestSlotOnDay.slot.id));
      setStartTimeVal(bestSlotOnDay.slot.start);
      setEndTimeVal(bestSlotOnDay.slot.end);
      if (bestSlotOnDay.bestGroomId) setAssignedGroomVal(bestSlotOnDay.bestGroomId);
    }
  }, [createHorse, scheduleDate, slotEvaluationsForDate, selectedSlotId, groomWorkloads.length, sessions]);

  useEffect(() => {
    const preferredHorseId = selectedHorseId && horses.some((horse) => horse.id === selectedHorseId)
      ? selectedHorseId
      : horses[0]?.id ?? "";
    setCreateHorse(preferredHorseId);
  }, [horses, selectedHorseId]);

  // When horse changes, auto-select recommended regimen preset ONLY if no specific plan is currently selected
  useEffect(() => {
    if (currentHorseAi && !scheduleDraft && !selectedPlanId) {
      const reg = currentHorseAi.regimen;
      setRegimenPreset(reg.key);
      setSurfaceVal(reg.target_track_surface);
      setDistanceVal(String(reg.target_distance_meters));
      setIntensityVal(reg.target_intensity);
      setSessionType(reg.session_type);
      const runInfo = analyzeSessionRunStructure(reg.target_distance_meters, reg.target_intensity);
      setNotesVal(`[${reg.stage_name}] ${runInfo.formulaText}`);
    }
  }, [currentHorseAi, scheduleDraft, selectedPlanId]);

  const lastAutoPickedKeyRef = useRef<string>("");
  useEffect(() => {
    if (!createHorse) return;
    const minStart =
      (scheduleDraft?.startDate && scheduleDraft.startDate > today() ? scheduleDraft.startDate : null) ??
      (selectedPlan?.start_date && selectedPlan.start_date > today() ? selectedPlan.start_date : null) ??
      today();
    const maxEnd = selectedPlan?.end_date ?? null;
    const autoKey = `${createHorse}|${scheduleDraft?.planId ?? ""}|${selectedPlan?.id ?? ""}|${minStart}|${sessions.length}|${grooms.length}`;
    if (lastAutoPickedKeyRef.current === autoKey) return;
    lastAutoPickedKeyRef.current = autoKey;

    const activeReg =
      (selectedPlan ? matchStandardRegimen(selectedPlan) : null) ??
      getRegimenByKey(regimenPreset) ??
      currentHorseAi?.regimen;
    const weeklyCap = Math.max(2, activeReg?.recommended_sessions_per_week ?? 3);
    const best = findBestDateSlotAndGroom(createHorse, minStart, maxEnd, sessions, careEvents, groomWorkloads, weeklyCap);
    setScheduleDate(best.date);
    setSelectedSlotId(String(best.slot.id));
    setStartTimeVal(best.slot.start);
    setEndTimeVal(best.slot.end);
    if (best.groomId) setAssignedGroomVal(best.groomId);
  }, [createHorse, scheduleDraft, selectedPlan?.id, selectedPlan?.start_date, selectedPlan?.end_date, sessions, careEvents, groomWorkloads, grooms.length]);

  useEffect(() => {
    if (scheduleDraft) {
      setCreateHorse(scheduleDraft.horseId);
      setSelectedPlanId(scheduleDraft.planId);
      if (scheduleDraft.regimenKey) {
        const reg = getRegimenByKey(scheduleDraft.regimenKey);
        if (reg) {
          setRegimenPreset(reg.key);
          setSurfaceVal(reg.target_track_surface);
          setDistanceVal(String(reg.target_distance_meters));
          setIntensityVal(reg.target_intensity);
          setSessionType(reg.session_type);
          const runInfo = analyzeSessionRunStructure(reg.target_distance_meters, reg.target_intensity);
          setNotesVal(`[${reg.stage_name}] ${runInfo.formulaText}`);
        }
      }
    }
  }, [scheduleDraft]);

  useEffect(() => {
    if (selectedPlan) {
      if (selectedPlan.target_track_surface) setSurfaceVal(selectedPlan.target_track_surface);
      if (selectedPlan.target_distance_meters) setDistanceVal(String(selectedPlan.target_distance_meters));
      if (selectedPlan.target_intensity) setIntensityVal(selectedPlan.target_intensity);
      const matched = matchStandardRegimen(selectedPlan);
      if (matched) {
        setRegimenPreset(matched.key);
        setSessionType(matched.session_type);
      }
      const runInfo = analyzeSessionRunStructure(selectedPlan.target_distance_meters, selectedPlan.target_intensity);
      setNotesVal(`[${selectedPlan.stage_name}] ${runInfo.formulaText}`);
    }
  }, [selectedPlan]);

  useEffect(() => {
    if (horsePlansLoading) return;
    setSelectedPlanId((current) => {
      if (!current) return "";
      if (allHorsePlans.some((plan) => plan.id === current)) return current;
      if (scheduleDraft?.planId === current) return current;
      return "";
    });
  }, [allHorsePlans, horsePlansLoading, scheduleDraft?.planId]);

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
      setSelectedPlanId((current) => {
        if (current && plans.some((plan) => plan.id === current)) return current;
        if (scheduleDraft?.planId && plans.some((plan) => plan.id === scheduleDraft.planId)) return scheduleDraft.planId;
        const targetKey = scheduleDraft?.regimenKey ?? currentHorseAi?.regimen.key;
        if (targetKey) {
          const matching = plans.find((p) => matchStandardRegimen(p)?.key === targetKey);
          if (matching) return matching.id;
        }
        return "";
      });
    }).catch((reason) => {
      if (!active) return;
      setHorsePlans([]);
      setHorsePlansError(headTrainerError(reason));
    }).finally(() => {
      if (active) setHorsePlansLoading(false);
    });
    return () => { active = false; };
  }, [createHorse, plansReload, scheduleDraft?.regimenKey, currentHorseAi?.regimen.key]);

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 15000);
    return () => window.clearInterval(interval);
  }, []);

  function handleSelectRegimenPreset(key: string) {
    setRegimenPreset(key);
    const reg = getRegimenByKey(key);
    if (reg) {
      setSurfaceVal(reg.target_track_surface);
      setDistanceVal(String(reg.target_distance_meters));
      setIntensityVal(reg.target_intensity);
      setSessionType(reg.session_type);
      const runInfo = analyzeSessionRunStructure(reg.target_distance_meters, reg.target_intensity);
      setNotesVal(`[${reg.stage_name}] ${runInfo.formulaText}`);
      const matchingPlan = horsePlans.find(
        (p) =>
          p.target_intensity === reg.target_intensity &&
          p.target_distance_meters === reg.target_distance_meters &&
          (p.target_track_surface ?? "").toLowerCase() === reg.target_track_surface.toLowerCase(),
      );
      if (matchingPlan) {
        setSelectedPlanId(matchingPlan.id);
      } else {
        setSelectedPlanId("");
      }
    }
  }

  function handleSelectSlot(slotIdStr: string) {
    setSelectedSlotId(slotIdStr);
    const times = SLOT_START_END[Number(slotIdStr)];
    if (times) {
      setStartTimeVal(times.start);
      setEndTimeVal(times.end);
    }
  }

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "Scheduled" | "Overdue" | "InProgress" | "Completed" | "Cancelled">("all");
  const [includeCareEvents, setIncludeCareEvents] = useState(true);
  const [showAllSlots, setShowAllSlots] = useState(true);
  const [showDispatchDrawer, setShowDispatchDrawer] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(() => Boolean(scheduleDraft));
  const [moveId, setMoveId] = useState<string>("");
  const [completeId, setCompleteId] = useState<string>("");
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionNotice, setActionNotice] = useState("");
  const [highlightedSessionId, setHighlightedSessionId] = useState<string | null>(null);
  const timetableRef = useRef<HTMLDivElement>(null);

  const lastScrolledSessionRef = useRef<string | null>(null);

  useEffect(() => {
    if (!lastCreatedSessionId) return;
    setHighlightedSessionId(lastCreatedSessionId);
    setSelectedSessionId(lastCreatedSessionId);
    setSearchQuery("");
    setGroomFilterId("");
    setStatusFilter("all");
    setShowAllHorsesTimetable(true);
    setShowCreateForm(false);

    let attempts = 0;
    let scrollTimer = 0;
    const tryScrollToCard = () => {
      const cardEl = document.getElementById(`session-card-${lastCreatedSessionId}`);
      if (cardEl) {
        cardEl.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
        lastScrolledSessionRef.current = lastCreatedSessionId;
      } else if (attempts < 15) {
        attempts += 1;
        scrollTimer = window.setTimeout(tryScrollToCard, 80);
      } else {
        timetableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };
    scrollTimer = window.setTimeout(tryScrollToCard, 60);

    const clearTimer = window.setTimeout(() => {
      setHighlightedSessionId((curr) => (curr === lastCreatedSessionId ? null : curr));
    }, 8000);
    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearTimer);
    };
  }, [lastCreatedSessionId]);

  useEffect(() => {
    if (!highlightedSessionId) return;
    const cardEl = document.getElementById(`session-card-${highlightedSessionId}`);
    if (cardEl && lastScrolledSessionRef.current !== `${highlightedSessionId}:settled`) {
      lastScrolledSessionRef.current = `${highlightedSessionId}:settled`;
      cardEl.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    }
  }, [highlightedSessionId, sessions]);

  useEffect(() => {
    if (scheduleDraft) setShowCreateForm(true);
  }, [scheduleDraft]);

  const currentWeekMonday = useMemo(() => mondayOfWeek(today()), []);
  const weekOptions = useMemo(() => {
    const opts = [];
    const base = new Date(`${currentWeekMonday}T12:00:00`);
    for (let i = -8; i <= 12; i++) {
      const m = new Date(base);
      m.setDate(m.getDate() + i * 7);
      const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}-${String(m.getDate()).padStart(2, "0")}`;
      const sKey = plusDays(key, 6);
      const mStr = `${key.slice(8, 10)}/${key.slice(5, 7)}`;
      const sStr = `${sKey.slice(8, 10)}/${sKey.slice(5, 7)}`;
      opts.push({ key, label: `Tuần ${mStr} - ${sStr} (${key.slice(0, 4)})` });
    }
    if (!opts.some((o) => o.key === from)) {
      opts.unshift({ key: from, label: `Tuần ${from.slice(8, 10)}/${from.slice(5, 7)} - ${to.slice(8, 10)}/${to.slice(5, 7)}` });
    }
    return opts;
  }, [currentWeekMonday, from, to]);

  function isSessionOverdue(session: TrainingSession) {
    if (session.status === "Missed") return true;
    if (session.status !== "Scheduled") return false;
    const win = sessionWindow(session);
    if (win) return nowMs >= win.end;
    return session.event_date < today();
  }

  const weekBaseSessions = useMemo(() => {
    return sessions.filter((session) => {
      if (!calendarDays.includes(session.event_date)) return false;
      if (!showAllHorsesTimetable && session.horse_id !== selectedHorseId) return false;
      if (groomFilterId && String(session.assigned_groom_id ?? "") !== groomFilterId) return false;
      return true;
    });
  }, [sessions, calendarDays, showAllHorsesTimetable, selectedHorseId, groomFilterId]);

  const filteredSessions = useMemo(() => {
    const q = normalizeHorseSearch(searchQuery.trim());
    return weekBaseSessions.filter((session) => {
      const overdue = isSessionOverdue(session);
      if (statusFilter === "Scheduled" && (session.status !== "Scheduled" || overdue)) return false;
      if (statusFilter === "Overdue" && !overdue) return false;
      if (statusFilter === "InProgress" && session.status !== "InProgress") return false;
      if (statusFilter === "Completed" && session.status !== "Completed") return false;
      if (statusFilter === "Cancelled" && session.status !== "Cancelled") return false;
      if (q) {
        const hay = normalizeHorseSearch(`${session.horse_name} ${session.plan_stage_name ?? ""} ${session.groom_name ?? ""} ${session.notes ?? ""} ${session.track_surface ?? ""} ${session.box_code ?? ""}`);
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [weekBaseSessions, statusFilter, searchQuery, nowMs]);

  const weeklyOverdueCount = useMemo(() => weekBaseSessions.filter((s) => isSessionOverdue(s)).length, [weekBaseSessions, nowMs]);
  const weeklyPendingCount = useMemo(() => weekBaseSessions.filter((s) => s.status === "Scheduled" && !isSessionOverdue(s)).length, [weekBaseSessions, nowMs]);
  const weeklyCompletedCount = useMemo(() => weekBaseSessions.filter((s) => s.status === "Completed").length, [weekBaseSessions]);
  const weeklyCareCount = useMemo(
    () =>
      careEvents.filter(
        (c) =>
          calendarDays.includes(c.event_date) &&
          c.status !== "Cancelled" &&
          c.event_type !== "CareTask" &&
          (showAllHorsesTimetable || c.horse_id === selectedHorseId),
      ).length,
    [careEvents, calendarDays, showAllHorsesTimetable, selectedHorseId],
  );

  async function submitReschedule(event: FormEvent<HTMLFormElement>, session: TrainingSession) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const nextDate = String(data.get("event_date") || session.event_date).trim();
    const slotRange = String(data.get("slot_time_range") || "07:00|08:30");
    const [rawStart, rawEnd] = slotRange.split("|");
    const nextStart = (rawStart || "07:00").trim().replace("h", ":");
    const nextEnd = (rawEnd || "08:30").trim().replace("h", ":");
    const groomRaw = String(data.get("assigned_groom_id") ?? "").trim();
    const nextGroomId = groomRaw ? Number(groomRaw) : (session.assigned_groom_id ?? null);
    const payload: Record<string, unknown> = {
      event_date: nextDate,
      start_time: nextStart,
      end_time: nextEnd,
    };
    if (groomRaw) payload.assigned_groom_id = Number(groomRaw);

    setActionBusy(true);
    setActionError("");
    setActionNotice("");
    try {
      const updated = await headTrainerApi.updateSchedule(session.training_schedule_id, payload);
      const updatedStart = updated.start_time ? updated.start_time.slice(0, 5) : "";
      // Fallback nếu backend đang chạy bản build cũ chưa nhận event_date/start_time trong PATCH
      if (updated.event_date !== nextDate || (updatedStart && updatedStart !== nextStart)) {
        let planIdToUse = session.training_plan_id ?? null;
        if (session.session_type !== "Rest") {
          const regimen = getRegimenByKey(session.plan_target_intensity ?? "Medium") ?? STANDARD_REGIMENS[3];
          const ensuredPlan = await ensurePlanForHorse(session.horse_id, regimen, nextDate);
          planIdToUse = ensuredPlan.id;
        }
        await headTrainerApi.updateSchedule(session.training_schedule_id, { status: "Cancelled" });
        const baseCreatePayload = {
          training_plan_id: planIdToUse,
          session_type: session.session_type,
          track_surface: session.track_surface || "Dirt",
          event_date: nextDate,
          start_time: nextStart,
          end_time: nextEnd,
          notes: session.notes ?? null,
          target_distance_meters: session.plan_target_distance_meters ?? 1200,
          target_intensity: session.plan_target_intensity ?? "Medium",
        };
        try {
          await headTrainerApi.createSchedule(session.horse_id, {
            ...baseCreatePayload,
            assigned_groom_id: nextGroomId,
          });
        } catch {
          // Thử lại không gắn Groom bị trùng ca để không chặn dời lịch của ngựa
          await headTrainerApi.createSchedule(session.horse_id, {
            ...baseCreatePayload,
            assigned_groom_id: null,
          });
        }
      }
      setMoveId("");
      setHighlightedSessionId(session.training_schedule_id);
      if (!calendarDays.includes(nextDate)) {
        onWeekChange(nextDate);
      }
      await onTargetsSaved();
      setActionNotice(`✅ Đã dời lịch tập của ${session.horse_name} sang ngày ${nextDate} (${nextStart} – ${nextEnd}).`);
      window.setTimeout(() => {
        const el = document.getElementById(`session-card-${session.training_schedule_id}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 150);
    } catch (err) {
      setActionError(headTrainerError(err));
    } finally {
      setActionBusy(false);
    }
  }

  async function submitInlineComplete(event: FormEvent<HTMLFormElement>, session: TrainingSession) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const recordNow = data.get("record_metrics_now") === "on";
    const review = String(data.get("trainer_review") ?? "").trim();
    setActionBusy(true);
    setActionError("");
    setActionNotice("");
    try {
      await headTrainerApi.updateSchedule(session.training_schedule_id, {
        status: "Completed",
        ...(review ? { trainer_review: review } : {}),
      });
      if (recordNow && session.session_type !== "Rest") {
        await headTrainerApi.recordMetrics(session.training_schedule_id, {
          body_weight_kg: Number(data.get("body_weight_kg")) || 465,
          max_heart_rate: Number(data.get("max_heart_rate")) || 182,
          avg_speed_kmh: Number(data.get("avg_speed_kmh")) || 46.5,
          stamina_score: Number(data.get("stamina_score")) || 8.2,
          trainer_review: review || "Hoàn thành tốt giáo án",
        });
      }
      setCompleteId("");
      await onTargetsSaved();
      setActionNotice(`Đã ghi nhận hoàn thành buổi tập của ${session.horse_name}${recordNow ? " kèm chỉ số thể lực" : ""}.`);
    } catch (err) {
      setActionError(headTrainerError(err));
    } finally {
      setActionBusy(false);
    }
  }

  const filteredCoverageList = useMemo(() => {
    if (coverageFilter === "all") return horseCoverageList;
    return horseCoverageList.filter((item) => item.coverageStatus === coverageFilter);
  }, [horseCoverageList, coverageFilter]);

  const selectedSession = filteredSessions.find((session) => session.training_schedule_id === selectedSessionId)
    ?? sessions.find((session) => session.training_schedule_id === selectedSessionId && calendarDays.includes(session.event_date))
    ?? null;

  const stableCoverageGroups = useMemo(() => {
    const map = new Map<string, { boxCode: string; section: string; items: HorseCoverageStat[] }>();
    for (const item of filteredCoverageList) {
      const boxCode = item.horse.box_code ? `Chuồng ${item.horse.box_code}` : "Chưa xếp chuồng";
      const section = item.horse.section ? `Khu ${item.horse.section}` : "Khu chung";
      const key = `${section}|${boxCode}`;
      const existing = map.get(key);
      if (existing) {
        existing.items.push(item);
      } else {
        map.set(key, { boxCode, section, items: [item] });
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => a.section.localeCompare(b.section, "vi") || a.boxCode.localeCompare(b.boxCode, "vi"),
    );
  }, [filteredCoverageList]);

  return <div className="trainer-calendar space-y-4">
    {/* Thanh Công cụ Điều phối gọn trên đầu */}
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 shadow-xs">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setShowDispatchDrawer((v) => !v)}
          className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold transition ${
            showDispatchDrawer ? "border-equine-navy bg-equine-navy text-white" : "border-slate-300 bg-slate-50 text-slate-800 hover:bg-slate-100"
          }`}
        >
          <Users size={14} /> {showDispatchDrawer ? "Ẩn Bàn điều phối Chuồng & Groom" : `Bàn điều phối Chuồng & Groom (${uncoveredCount + undertrainedCount} thiếu lịch)`}
        </button>
        <button
          type="button"
          onClick={() => setShowCreateForm((v) => !v)}
          className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-xs font-bold transition ${
            showCreateForm ? "bg-slate-800 text-white" : "gold-button"
          }`}
        >
          <Plus size={14} /> {showCreateForm ? "Đóng form đặt lịch" : "+ Đặt lịch tập mới"}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void onResetCleanData()}
          className="inline-flex h-9 items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-3 text-xs font-bold text-amber-900 hover:bg-amber-100"
          title="Xóa giáo án & lịch tập cũ và tự động khởi tạo lại bộ chuẩn sạch cho toàn bộ ngựa"
        >
          <RefreshCw size={13} /> Làm sạch & Tạo chuẩn
        </button>
      </div>
    </div>

    {!showCreateForm && !moveId && (error || notice || actionError || actionNotice) && (
      <div className="space-y-2">
        {(error || actionError) && <Notice error>{actionError || error}</Notice>}
        {(notice || actionNotice) && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-950">
            {actionNotice || notice}
          </div>
        )}
      </div>
    )}

    {showDispatchDrawer && (
      <Section title="Điều phối Độ phủ Chuồng & Tải Groom" icon={Users}>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
          <button type="button" onClick={() => setCoverageFilter(coverageFilter === "uncovered" ? "all" : "uncovered")} className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left transition ${coverageFilter === "uncovered" ? "border-rose-500 bg-rose-100/80" : "border-rose-200 bg-rose-50/60"}`}><span className="text-xs font-bold text-rose-900">Chưa có lịch</span><strong className="text-lg font-extrabold text-rose-900">{uncoveredCount}</strong></button>
          <button type="button" onClick={() => setCoverageFilter(coverageFilter === "undertrained" ? "all" : "undertrained")} className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left transition ${coverageFilter === "undertrained" ? "border-orange-500 bg-orange-100/80" : "border-orange-200 bg-orange-50/60"}`}><span className="text-xs font-bold text-orange-900">Thiếu buổi</span><strong className="text-lg font-extrabold text-orange-900">{undertrainedCount}</strong></button>
          <button type="button" onClick={() => setCoverageFilter(coverageFilter === "overtrained" ? "all" : "overtrained")} className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left transition ${coverageFilter === "overtrained" ? "border-amber-500 bg-amber-100/80" : "border-amber-200 bg-amber-50/60"}`}><span className="text-xs font-bold text-amber-900">Tập quá tải</span><strong className="text-lg font-extrabold text-amber-900">{overtrainedCount}</strong></button>
          <button type="button" onClick={() => setCoverageFilter(coverageFilter === "balanced" ? "all" : "balanced")} className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left transition ${coverageFilter === "balanced" ? "border-emerald-500 bg-emerald-100/80" : "border-emerald-200 bg-emerald-50/60"}`}><span className="text-xs font-bold text-emerald-900">Đạt chuẩn</span><strong className="text-lg font-extrabold text-emerald-900">{balancedCount}</strong></button>
          <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50/60 px-3 py-2"><span className="text-xs font-bold text-blue-900">Chờ gán Groom</span><strong className="text-lg font-extrabold text-blue-900">{unassignedSessionsCount}</strong></div>
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-xl border border-equine-line bg-slate-50/70 p-3">
            <h4 className="text-xs font-extrabold uppercase tracking-wide text-equine-navy">🏠 Độ phủ theo Chuồng ({stableCoverageGroups.length} chuồng)</h4>
            <div className="mt-2 grid max-h-48 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
              {stableCoverageGroups.map((stall) => (
                <div key={`${stall.section}-${stall.boxCode}`} className="rounded-lg border border-slate-200 bg-white p-2 text-xs">
                  <div className="mb-1 flex items-center justify-between border-b border-slate-100 pb-1">
                    <span className="font-extrabold text-equine-navy">{stall.boxCode}</span>
                    <span className="text-[10px] text-slate-500">{stall.section}</span>
                  </div>
                  {stall.items.map((item) => (
                      <div key={item.horse.id} className="mt-1 flex items-center justify-between gap-1 text-[11px]">
                        <button type="button" onClick={() => { onSelectHorse(item.horse.id); setCreateHorse(item.horse.id); }} className="truncate font-bold text-equine-navy hover:underline">{item.horse.horse_name}</button>
                        <span className="text-[10px] font-semibold text-slate-600">{item.activeSessionCount}/{Math.max(2, item.recommendedRegimen.recommended_sessions_per_week)}b</span>
                      </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-equine-line bg-slate-50/70 p-3">
            <h4 className="text-xs font-extrabold uppercase tracking-wide text-equine-navy">⚖️ Tải công việc Groom</h4>
            <div className="mt-2 max-h-48 space-y-1.5 overflow-y-auto pr-1">
              {groomWorkloads.map((item, idx) => (
                <div key={item.groom.user_id} className="flex items-center justify-between rounded-lg border border-equine-line bg-white px-2.5 py-1.5 text-xs">
                  <span className="font-bold text-slate-900">{idx === 0 && <span className="mr-1 rounded bg-emerald-600 px-1 py-0.5 text-[9px] text-white">Rảnh nhất</span>}{item.groom.full_name}</span>
                  <span className="text-[11px] text-slate-600">{item.weekCount} ca/tuần · {item.todayCount} ca hôm nay</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>
    )}

    {showCreateForm && (
      <Section
        title="Đặt lịch tập mới"
        icon={Plus}
        action={
          <button type="button" onClick={() => setShowCreateForm(false)} className="soft-button px-2.5 py-1.5 text-xs">Đóng ✕</button>
        }
      >
        <form ref={createFormRef} onSubmit={onCreate} onChange={(event) => { if (event.target instanceof HTMLInputElement && event.target.name === "event_date") setScheduleDate(event.target.value); }} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input type="hidden" name="regimen_preset" value={regimenPreset} />
          <SelectField
            label="Ngựa"
            name="horse_id"
            value={createHorse}
            onChange={(val) => { setCreateHorse(val); onSelectHorse(val); }}
            options={horses.filter((horse) => !horse.is_training_locked).map((horse) => [horse.id, `${horse.horse_name}${horse.box_code ? ` (Chuồng ${horse.box_code})` : ""}`] as [string, string])}
          />
          <SelectField
            label="Giáo án (Cao → Thấp)"
            name="training_plan_id"
            value={selectedPlanId}
            onChange={(val) => {
              if (val.startsWith("REG:")) {
                handleSelectRegimenPreset(val.slice(4));
                return;
              }
              setSelectedPlanId(val);
              const found = horsePlans.find((p) => p.id === val) ?? allHorsePlans.find((p) => p.id === val);
              if (found) {
                if (found.target_track_surface) setSurfaceVal(found.target_track_surface);
                if (found.target_distance_meters) setDistanceVal(String(found.target_distance_meters));
                if (found.target_intensity) setIntensityVal(found.target_intensity);
                const matched = matchStandardRegimen(found);
                if (matched) {
                  setRegimenPreset(matched.key);
                  setSessionType(matched.session_type);
                }
                const runInfo = analyzeSessionRunStructure(found.target_distance_meters, found.target_intensity);
                setNotesVal(`[${found.stage_name}] ${runInfo.formulaText}`);
              }
            }}
            options={[
              [
                "",
                selectedPlan
                  ? `✨ Đang chọn: ${selectedPlan.stage_name}`
                  : `✨ Đang chọn: [${getRegimenByKey(regimenPreset)?.levelLabel ?? "VỪA"}] ${getRegimenByKey(regimenPreset)?.title ?? "Giáo án chuẩn"}`,
              ],
              ...STANDARD_REGIMENS.map((reg) => [`REG:${reg.key}`, `[${reg.levelLabel}] ${reg.title}`] as [string, string]),
              ...horsePlans.map((plan) => [plan.id, `[Đã lưu] ${plan.stage_name}`] as [string, string]),
            ]}
          />
          <Field label="Ngày tập" name="event_date" type="date" required value={scheduleDate} onChange={setScheduleDate} min={selectedPlan?.start_date && selectedPlan.start_date > today() ? selectedPlan.start_date : today()} max={selectedPlan?.end_date ?? undefined} />
          <SelectField
            label="Ca tập"
            name="slot_preset"
            value={selectedSlotId}
            onChange={handleSelectSlot}
            options={slotEvaluationsForDate.map((ev) => [
              String(ev.slot.id),
              `Ca ${ev.slot.id}: ${ev.slot.timeRange} (${ev.statusLabel})`,
            ] as [string, string])}
          />
          <SelectField
            label="Groom phụ trách"
            name="assigned_groom_id"
            value={assignedGroomVal}
            onChange={setAssignedGroomVal}
            options={[
              ["", "Chưa phân công"],
              ...(currentSlotEval?.rankedGrooms ?? []).map((item, idx) => [
                String(item.groom.user_id),
                item.busyReason
                  ? `${item.groom.full_name} (✗ Bận ca này: ${item.busyReason} · ${item.weekCount} ca/tuần)`
                  : `${item.groom.full_name} (✓ Rảnh ca này · ${item.dayCount} ca ngày / ${item.weekCount} ca tuần${idx === 0 ? " · Rảnh nhất" : ""})`,
              ] as [string, string]),
            ]}
          />
          {currentSlotCareConflict && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-900 sm:col-span-2 lg:col-span-5">
              <span>⚠️ Trùng lịch y tế/chăm sóc của <b>{currentSlotCareConflict.horse_name}</b> ({careEventTypeLabel(currentSlotCareConflict.event_type, currentSlotCareConflict.title)}). Vui lòng chọn ngày hoặc khung giờ khác.</span>
            </div>
          )}
          {(error || actionError) && !moveId && (
            <div className="sm:col-span-2 lg:col-span-5">
              <Notice error>{actionError || error}</Notice>
            </div>
          )}
          {(notice || actionNotice) && !moveId && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-950 sm:col-span-2 lg:col-span-5">
              <span>{actionNotice || notice}</span>
              {lastCreatedSessionId && (
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById(`session-card-${lastCreatedSessionId}`);
                    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                    else timetableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className="rounded border border-emerald-400 bg-white px-2.5 py-1 text-[11px] font-bold text-emerald-900 hover:bg-emerald-100"
                >
                  ↓ Xem trên bảng lịch
                </button>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-xs text-emerald-950 sm:col-span-2 lg:col-span-5">
            <span>
              ✅ <strong>Thông số ca tập{selectedPlan ? ` (${selectedPlan.stage_name})` : ""}:</strong>{" "}
              {Number(selectedPlan?.target_distance_meters ?? distanceVal).toLocaleString("vi-VN")}m ·{" "}
              {surfaceLabel(selectedPlan?.target_track_surface ?? surfaceVal)} · Cường độ{" "}
              {({ High: "Cao", Medium: "Vừa", Low: "Thấp" } as Record<string, string>)[selectedPlan?.target_intensity ?? intensityVal] ?? (selectedPlan?.target_intensity ?? intensityVal)} ·{" "}
              {analyzeSessionRunStructure(Number(selectedPlan?.target_distance_meters ?? distanceVal) || 1200, selectedPlan?.target_intensity ?? intensityVal).formulaText}
            </span>
            <div className="flex items-center gap-2">
              <details className="relative">
                <summary className="cursor-pointer rounded border border-emerald-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-900">⚙️ Tùy chỉnh</summary>
                <div className="mt-2 grid gap-2.5 rounded-xl border border-equine-line bg-white p-3 shadow-md sm:grid-cols-3">
                  <Field label="Bắt đầu" name="start_time" type="text" required value={startTimeVal} onChange={setStartTimeVal} maxLength={5} />
                  <Field label="Kết thúc" name="end_time" type="text" required value={endTimeVal} onChange={setEndTimeVal} maxLength={5} />
                  <SelectField label="Loại buổi" name="session_type" value={sessionType} onChange={setSessionType} options={[["Training", "Huấn luyện"], ["TrialRun", "Chạy thử"], ["Rest", "Nghỉ"]]} />
                  <SelectField label="Mặt sân" name="track_surface" required={sessionType !== "Rest"} value={surfaceVal} onChange={setSurfaceVal} options={[["", "Chọn"], ["Dirt", "Đất"], ["Turf", "Cỏ"], ["Synthetic", "Nhân tạo"]]} />
                  <SelectField label="Cự ly (m)" name="session_distance" required={sessionType !== "Rest"} value={distanceVal} onChange={setDistanceVal} options={distanceOptionsWithCurrent(Number(distanceVal) || selectedPlan?.target_distance_meters)} />
                  <SelectField label="Cường độ" name="session_intensity" required={sessionType !== "Rest"} value={intensityVal} onChange={setIntensityVal} options={[["", "Chọn"], ["High", "Cao"], ["Medium", "Vừa"], ["Low", "Thấp"]]} />
                  <label className="sm:col-span-3 block"><span className="field-label">Ghi chú ca tập</span><input type="text" name="notes" value={notesVal} onChange={(e) => setNotesVal(e.target.value)} className="field-control px-2.5 text-xs" /></label>
                </div>
              </details>
              <button className="gold-button px-4 py-1.5 text-xs" disabled={busy}><CalendarDays size={14} /> Chốt ca tập</button>
            </div>
          </div>
        </form>
      </Section>
    )}
    <Section title="Thời khóa biểu tuần (Bộ lọc, Dời lịch, Hoàn thành & Chỉ số)" icon={CalendarDays}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-equine-line bg-slate-50 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Chọn tuần"
            className="field-control w-auto py-1.5 text-sm font-semibold"
            value={weekOptions.some((w) => w.key === from) ? from : weekOptions[0]?.key ?? from}
            onChange={(e) => onWeekChange(e.target.value)}
          >
            {weekOptions.map((w) => (
              <option key={w.key} value={w.key}>{w.label}</option>
            ))}
          </select>
          <button type="button" className="soft-button text-xs" onClick={() => onWeekChange(plusDays(from, -7))}>
            <ArrowLeft size={14} /> Tuần trước
          </button>
          <button type="button" className="soft-button text-xs" onClick={() => onWeekChange(today())}>
            Tuần hiện tại
          </button>
          <button type="button" className="soft-button text-xs" onClick={() => onWeekChange(plusDays(from, 7))}>
            Tuần sau <ArrowRight size={14} />
          </button>
          {!showCreateForm && (
            <button
              type="button"
              onClick={() => {
                setShowCreateForm(true);
                window.setTimeout(() => {
                  createFormRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                }, 60);
              }}
              className="gold-button px-3 py-1.5 text-xs"
            >
              <Plus size={13} /> Đặt thêm lịch tập
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-56">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm ngựa, bài tập, groom..."
              className="h-9 w-full rounded-lg border border-equine-line bg-white pl-8 pr-7 text-xs text-slate-800 outline-none focus:border-equine-navy"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                title="Xóa tìm kiếm"
              >
                <X size={13} />
              </button>
            )}
          </div>
          <div className="inline-flex rounded-lg border border-equine-line bg-white p-0.5">
            <button
              type="button"
              onClick={() => setShowAllHorsesTimetable(true)}
              className={`rounded-md px-2.5 py-1 text-xs font-bold transition ${showAllHorsesTimetable ? "bg-equine-navy text-white" : "text-slate-600 hover:bg-slate-100"}`}
            >
              Toàn CLB ({sessions.filter((s) => calendarDays.includes(s.event_date)).length})
            </button>
            <button
              type="button"
              onClick={() => setShowAllHorsesTimetable(false)}
              className={`rounded-md px-2.5 py-1 text-xs font-bold transition ${!showAllHorsesTimetable ? "bg-equine-navy text-white" : "text-slate-600 hover:bg-slate-100"}`}
            >
              {currentHorseObj?.horse_name ?? "Ngựa chọn"} ({sessions.filter((s) => s.horse_id === selectedHorseId && calendarDays.includes(s.event_date)).length})
            </button>
          </div>
          <select
            aria-label="Lọc theo Groom"
            value={groomFilterId}
            onChange={(e) => setGroomFilterId(e.target.value)}
            className="field-control h-9 w-auto px-2.5 py-1 text-xs font-semibold"
          >
            <option value="">Tất cả Groom ({grooms.length})</option>
            {groomWorkloads.map((item) => (
              <option key={item.groom.user_id} value={String(item.groom.user_id)}>
                {item.groom.full_name} ({item.weekCount} ca/tuần)
              </option>
            ))}
          </select>
          <select
            aria-label="Lọc trạng thái lịch tập"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="field-control h-9 w-auto px-2.5 py-1 text-xs font-semibold"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="Scheduled">Cần thực hiện (Đã lên lịch)</option>
            <option value="InProgress">Đang tập</option>
            <option value="Overdue">Quá hạn / Bỏ lỡ</option>
            <option value="Completed">Đã hoàn thành</option>
            <option value="Cancelled">Đã hủy</option>
          </select>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-equine-line bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={includeCareEvents}
              onChange={(e) => setIncludeCareEvents(e.target.checked)}
              className="rounded border-slate-300"
            />
            Hiện lịch Y tế
          </label>
          {(searchQuery || groomFilterId || statusFilter !== "all" || !showAllHorsesTimetable) && (
            <button
              type="button"
              className="soft-button h-9 px-2.5 text-xs text-rose-700"
              onClick={() => {
                setSearchQuery("");
                setGroomFilterId("");
                setStatusFilter("all");
                setShowAllHorsesTimetable(true);
              }}
            >
              Xóa lọc
            </button>
          )}
        </div>
      </div>

      <div className="mb-3 grid gap-2 sm:grid-cols-4">
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === "Scheduled" ? "all" : "Scheduled")}
          className={`rounded-lg border p-2.5 text-left transition ${statusFilter === "Scheduled" ? "ring-2 ring-blue-500 border-blue-400 bg-blue-50" : "border-blue-200 bg-blue-50/60 hover:bg-blue-50"}`}
        >
          <span className="text-[11px] font-bold uppercase text-blue-700">Cần thực hiện trong tuần</span>
          <strong className="mt-0.5 block text-lg font-black text-blue-950">{weeklyPendingCount} buổi</strong>
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === "Overdue" ? "all" : "Overdue")}
          className={`rounded-lg border p-2.5 text-left transition ${statusFilter === "Overdue" ? "ring-2 ring-amber-500 border-amber-400 bg-amber-50" : "border-amber-200 bg-amber-50/70 hover:bg-amber-50"}`}
        >
          <span className="text-[11px] font-bold uppercase text-amber-800">Quá hạn / Bỏ lỡ</span>
          <strong className="mt-0.5 block text-lg font-black text-amber-950">{weeklyOverdueCount} buổi</strong>
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === "Completed" ? "all" : "Completed")}
          className={`rounded-lg border p-2.5 text-left transition ${statusFilter === "Completed" ? "ring-2 ring-emerald-500 border-emerald-400 bg-emerald-50" : "border-emerald-200 bg-emerald-50/70 hover:bg-emerald-50"}`}
        >
          <span className="text-[11px] font-bold uppercase text-emerald-700">Đã hoàn thành</span>
          <strong className="mt-0.5 block text-lg font-black text-emerald-950">{weeklyCompletedCount} buổi</strong>
        </button>
        <div className="rounded-lg border border-purple-200 bg-purple-50/70 p-2.5">
          <span className="text-[11px] font-bold uppercase text-purple-800">Lịch Y tế / Chăm sóc</span>
          <strong className="mt-0.5 block text-lg font-black text-purple-950">{weeklyCareCount} ca</strong>
        </div>
      </div>

      <div ref={timetableRef} className="overflow-x-auto rounded-lg border border-slate-300">
        <table className="w-full min-w-[1080px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-300">
              <th className="w-24 border-r border-slate-300 bg-slate-100 p-3 text-center font-black uppercase tracking-wide text-slate-900">Slot</th>
              {calendarDays.map((day) => {
                const isToday = day === today();
                return (
                  <th key={day} className={`border-r border-slate-300 p-3 text-center ${isToday ? "border-b-2 border-emerald-700 bg-[#C3E6CB] text-[#0A4125]" : "bg-slate-100 text-slate-900"}`}>
                    <div className="flex flex-col items-center">
                      <span className="font-black">{trainingDayLabel(day)} ({day.slice(8, 10)}/{day.slice(5, 7)})</span>
                      {isToday && <span className="mt-0.5 rounded bg-emerald-800 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">Hôm nay</span>}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-300">
            {TRAINING_TIMETABLE_SLOTS.map((slot) => (
              <tr key={slot.id} className="transition-colors hover:bg-slate-50/60">
                <td className="border-r border-slate-300 bg-slate-100/90 p-3 text-center align-middle font-black text-slate-950">
                  <span className="text-lg">{slot.id}</span>
                  <p className="mt-0.5 whitespace-nowrap text-[11px] font-bold text-slate-700">{slot.timeRange}</p>
                </td>
                {calendarDays.map((day) => {
                  const cellSessions = filteredSessions.filter((session) => session.event_date === day && getTrainingSlot(session) === slot.id);
                  const cellCareEvents = !includeCareEvents ? [] : careEvents.filter((care) => {
                    if (care.event_date !== day || care.status === "Cancelled" || care.event_type === "CareTask") return false;
                    if (!showAllHorsesTimetable && care.horse_id !== selectedHorseId) return false;
                    if (searchQuery.trim()) {
                      const q = normalizeHorseSearch(searchQuery.trim());
                      const hay = normalizeHorseSearch(`${care.horse_name} ${careEventTypeLabel(care.care_type ?? care.event_type, care.title)} ${care.doctor_name ?? ""} ${care.box_code ?? ""}`);
                      if (!hay.includes(q)) return false;
                    }
                    return getCareEventPrimarySlot(care) === slot.id;
                  });
                  return (
                    <td key={`${slot.id}-${day}`} className={`border-r border-slate-300 p-2.5 align-top ${day === today() ? "bg-[#F3FAF5]" : "bg-white"}`}>
                      {cellSessions.length === 0 && cellCareEvents.length === 0 ? (
                        <div className="flex min-h-[96px] items-center justify-center text-base font-bold text-slate-400 select-none">-</div>
                      ) : (
                        <div className="space-y-2">
                          {cellCareEvents.map((care, careIdx) => {
                            const careLabel = careEventTypeLabel(care.care_type ?? care.event_type, care.title);
                            const dueOrEventDate = care.due_date ?? care.event_date;
                            const isCareOverdue = care.status === "Scheduled" && dueOrEventDate < today();
                            const isCareCompleted = care.status === "Completed";
                            const timeLabel = care.start_time
                              ? `${care.start_time.slice(0, 5)}${care.end_time ? ` – ${care.end_time.slice(0, 5)}` : ""}`
                              : "07:00 – 08:30";
                            const stallText = care.box_code ? `Chuồng ${care.box_code}${care.section ? ` (${care.section})` : ""}` : null;
                            return (
                              <div
                                key={`${care.event_id || care.source_id || "care"}-${care.horse_id || ""}-${care.event_date}-${careIdx}`}
                                className={`rounded-lg border p-2 text-left text-[11px] shadow-2xs ${
                                  isCareOverdue
                                    ? "border-rose-400 bg-rose-50/90 text-rose-950"
                                    : isCareCompleted
                                    ? "border-emerald-300 bg-emerald-50/80 text-emerald-950"
                                    : "border-purple-300 bg-purple-50/90 text-purple-950"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-1">
                                  <strong className="font-bold leading-tight">
                                    🩺 {careLabel} - {care.horse_name}
                                  </strong>
                                  <span
                                    className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-extrabold ${
                                      isCareOverdue
                                        ? "bg-rose-600 text-white"
                                        : isCareCompleted
                                        ? "bg-emerald-200 text-emerald-900"
                                        : care.is_periodic_due
                                        ? "bg-amber-200 text-amber-950"
                                        : "bg-purple-200 text-purple-900"
                                    }`}
                                  >
                                    {isCareOverdue ? "Y tế · Quá hạn" : isCareCompleted ? "Y tế · Đã khám" : care.is_periodic_due ? "Y tế · Đến hạn" : "Lịch Y tế"}
                                  </span>
                                </div>
                                <p className="mt-1 flex items-center gap-1 font-semibold opacity-90">
                                  <Clock size={11} /> {timeLabel} · {care.is_periodic_due ? "Quy tắc định kỳ" : "Đã chốt ca"}
                                </p>
                                <p className="mt-0.5 truncate text-[10px] opacity-85">
                                  {stallText ? `${stallText} · ` : ""}
                                  {care.doctor_name ? `BS. ${care.doctor_name.replace(/^(bs|bác sĩ|dr)\.?\s+/i, "")}` : "BS. Thú y"}
                                </p>
                              </div>
                            );
                          })}
                          {cellSessions.map((session, sessionIdx) => {
                            const win = sessionWindow(session);
                            const insideTimeWindow = Boolean(win && nowMs >= win.start && nowMs < win.end);
                            const afterTimeWindow = Boolean(win && nowMs >= win.end);
                            const canStartSim = Boolean(session.assigned_groom_id) && session.status === "Scheduled" && session.session_type !== "Rest" && insideTimeWindow;
                            const canComplete = afterTimeWindow && (session.status === "InProgress" || (session.status === "Scheduled" && session.session_type === "Rest"));
                            const canReschedule = ["Scheduled", "Blocked", "Missed"].includes(session.status);
                            const isOpen = ["Scheduled", "Blocked", "InProgress", "Missed"].includes(session.status);
                            const isOverdue = isSessionOverdue(session);
                            const latestMetric = session.latest_metric ?? session.metrics?.[0] ?? null;
                            const stallLabel = session.box_code ? `Chuồng ${session.box_code}${session.section ? ` (${session.section})` : ""}` : null;
                            const cardStyle = session.status === "Completed"
                              ? "border-emerald-300 bg-emerald-50/90"
                              : isOverdue
                              ? "border-amber-400 bg-amber-50/95 ring-1 ring-amber-300"
                              : session.status === "InProgress"
                              ? "border-sky-300 bg-sky-50"
                              : session.status === "Cancelled"
                              ? "border-slate-300 bg-slate-100 opacity-75"
                              : "border-blue-300 bg-blue-50/75";
                            const badgeStyle = session.status === "Completed"
                              ? "bg-emerald-100 text-emerald-900"
                              : isOverdue
                              ? "bg-amber-200 text-amber-950"
                              : session.status === "InProgress"
                              ? "bg-sky-100 text-sky-900"
                              : session.status === "Cancelled"
                              ? "bg-slate-200 text-slate-700"
                              : "bg-blue-100 text-blue-900";
                            const isNewlyCreated = highlightedSessionId === session.training_schedule_id;
                            return (
                              <div data-notification-target={session.horse_id} id={`session-card-${session.training_schedule_id}`} key={`${session.training_schedule_id || session.event_id || "session"}-${sessionIdx}`} className={`rounded-lg border p-2 shadow-xs transition hover:shadow-sm ${cardStyle} ${isNewlyCreated ? "ring-4 ring-emerald-500 border-emerald-600 bg-emerald-50 animate-pulse" : ""}`}>
                                <div className="flex items-start justify-between gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedSessionId(session.training_schedule_id)}
                                    className="truncate text-left text-xs font-black text-slate-950 hover:underline"
                                  >
                                    🐎 {session.horse_name}
                                  </button>
                                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${badgeStyle}`}>
                                    {isOverdue && session.status === "Scheduled" ? "Quá hạn" : scheduleStatusLabel(session.status)}
                                  </span>
                                </div>
                                <p className="mt-0.5 font-semibold text-slate-800">{sessionTypeLabel(session.session_type)}</p>
                                <div className="mt-1 space-y-0.5 text-[11px] text-slate-600">
                                  {stallLabel && <p className="flex items-center gap-1 font-semibold text-equine-navy"><MapPin size={11} /> {stallLabel}</p>}
                                  <p className="flex items-center gap-1 font-medium text-slate-700">
                                    <Clock size={11} /> {session.start_time?.slice(0, 5) ?? "Cả ngày"}{session.end_time ? `–${session.end_time.slice(0, 5)}` : ""}
                                    {session.track_surface ? ` · ${session.track_surface}` : ""}
                                  </p>
                                  <p className="flex items-center gap-1 truncate"><User size={11} /> Groom: {session.groom_name ?? "Chưa giao"}</p>
                                  {session.plan_stage_name && <p className="truncate text-[10px] text-slate-500">📋 {session.plan_stage_name}</p>}
                                </div>

                                {session.status === "Scheduled" && session.session_type !== "Rest" && !canStartSim && (
                                  <p className="mt-1 rounded bg-slate-100/90 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                                    {!session.assigned_groom_id
                                      ? "⚠️ Cần giao Groom trước khi chạy mô phỏng"
                                      : afterTimeWindow
                                      ? "⏰ Đã qua giờ tập — bấm Dời lịch để chạy mô phỏng"
                                      : `⏳ Mở mô phỏng lúc ${session.start_time?.slice(0, 5) ?? "đến giờ"}`}
                                  </p>
                                )}

                                {latestMetric && (
                                  <div className="mt-1.5 rounded border border-emerald-200 bg-white/90 px-2 py-1 text-[10px] text-slate-700">
                                    <div className="flex flex-wrap items-center justify-between gap-1 font-bold text-emerald-900">
                                      <span>📊 HR {latestMetric.max_heart_rate ?? "—"} bpm</span>
                                      <span>⚡ {latestMetric.avg_speed_kmh ?? "—"} km/h</span>
                                      <span>💪 {latestMetric.stamina_score ?? "—"}/10</span>
                                    </div>
                                    {(session.trainer_review || latestMetric.trainer_review) && (
                                      <p className="mt-0.5 truncate text-[10px] text-slate-600">
                                        Đánh giá: {session.trainer_review || latestMetric.trainer_review}
                                      </p>
                                    )}
                                  </div>
                                )}

                                <div className="mt-2 flex flex-wrap gap-1 border-t border-slate-200/80 pt-1.5">
                                  {canStartSim && (
                                    <button
                                      type="button"
                                      disabled={busy}
                                      className="rounded border border-amber-400 bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-slate-950 hover:bg-amber-400"
                                      onClick={() => onOpenSimulation(session)}
                                    >
                                      ▶ Bắt đầu mô phỏng
                                    </button>
                                  )}
                                  {session.status === "InProgress" && (
                                    <button
                                      type="button"
                                      disabled={busy}
                                      className="rounded border border-sky-400 bg-sky-600 px-1.5 py-0.5 text-[10px] font-bold text-white hover:bg-sky-700"
                                      onClick={() => onOpenSimulation(session)}
                                    >
                                      ▶ Mở mô phỏng đang chạy
                                    </button>
                                  )}
                                  {canComplete && (
                                    <button
                                      type="button"
                                      disabled={busy}
                                      className="rounded border border-emerald-300 bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white hover:bg-emerald-700"
                                      onClick={() => onStatus(session.training_schedule_id, "Completed")}
                                    >
                                      ✓ {session.session_type === "Rest" ? "Hoàn tất nghỉ" : "Hoàn tất"}
                                    </button>
                                  )}
                                  {canReschedule && (
                                    <button
                                      type="button"
                                      className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-100"
                                      onClick={() => {
                                        setCompleteId("");
                                        setMoveId(moveId === session.training_schedule_id ? "" : session.training_schedule_id);
                                      }}
                                    >
                                      Dời lịch
                                    </button>
                                  )}
                                  {isOpen && (
                                    <button
                                      type="button"
                                      className="rounded border border-rose-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 hover:bg-rose-50"
                                      disabled={busy}
                                      onClick={() => onStatus(session.training_schedule_id, "Cancelled")}
                                    >
                                      Hủy
                                    </button>
                                  )}
                                  {(session.status === "Completed" || Boolean(latestMetric)) && (
                                    <button
                                      type="button"
                                      className="rounded border border-blue-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-blue-800 hover:bg-blue-50"
                                      onClick={() => {
                                        setSelectedSessionId(session.training_schedule_id);
                                        setShowMetricsFor(showMetricsFor === session.training_schedule_id ? null : session.training_schedule_id);
                                      }}
                                    >
                                      📊 Chỉ số mô phỏng
                                    </button>
                                  )}
                                </div>

                                {moveId === session.training_schedule_id && (
                                  <form
                                    onSubmit={(e) => void submitReschedule(e, session)}
                                    className="mt-2 space-y-1.5 rounded border border-equine-line bg-white p-2"
                                  >
                                    <p className="text-[10px] font-bold uppercase text-equine-navy">Dời lịch & đổi ca / Groom</p>
                                    {actionError && (
                                      <p className="rounded bg-rose-50 p-1.5 text-[10px] font-semibold text-rose-700 border border-rose-200">
                                        {actionError}
                                      </p>
                                    )}
                                    <input
                                      aria-label="Ngày mới"
                                      name="event_date"
                                      type="date"
                                      required
                                      min={today()}
                                      defaultValue={session.event_date < today() ? today() : session.event_date}
                                      className="field-control py-1 text-xs"
                                    />
                                    <select
                                      aria-label="Ca tập mới"
                                      name="slot_time_range"
                                      defaultValue={(() => {
                                        const curSlot = TRAINING_TIMETABLE_SLOTS.find((s) => s.id === getTrainingSlot(session)) ?? TRAINING_TIMETABLE_SLOTS[0];
                                        return `${curSlot.start}|${curSlot.end}`;
                                      })()}
                                      className="field-control py-1 text-xs"
                                    >
                                      {TRAINING_TIMETABLE_SLOTS.map((s) => (
                                        <option key={s.id} value={`${s.start}|${s.end}`}>Ca {s.id} ({s.timeRange})</option>
                                      ))}
                                    </select>
                                    <select
                                      aria-label="Groom phụ trách"
                                      name="assigned_groom_id"
                                      defaultValue={session.assigned_groom_id ? String(session.assigned_groom_id) : ""}
                                      className="field-control py-1 text-xs"
                                    >
                                      <option value="">Giữ nguyên Groom</option>
                                      {grooms.map((g) => (
                                        <option key={g.user_id} value={g.user_id}>{g.full_name}</option>
                                      ))}
                                    </select>
                                    <div className="flex gap-1 pt-1">
                                      <button type="submit" className="gold-button px-2 py-1 text-[10px]" disabled={busy || actionBusy}>
                                        {actionBusy ? "Đang lưu..." : "Lưu lịch mới"}
                                      </button>
                                      <button type="button" className="soft-button px-2 py-1 text-[10px]" onClick={() => { setMoveId(""); setActionError(""); }}>Đóng</button>
                                    </div>
                                  </form>
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
      {filteredSessions.length === 0 && <Notice>Không có buổi tập nào khớp bộ lọc trong khoảng ngày này.</Notice>}
      {selectedSession && <TrainingSessionDetail
        session={selectedSession}
        grooms={grooms}
        busy={busy}
        nowMs={nowMs}
        showMetrics={showMetricsFor === selectedSession.training_schedule_id}
        onAssign={onAssign}
        onStatus={onStatus}
        onVideo={onVideo}
        onOpenSimulation={onOpenSimulation}
        onToggleMetrics={() => setShowMetricsFor(showMetricsFor === selectedSession.training_schedule_id ? null : selectedSession.training_schedule_id)}
        onTargetsSaved={onTargetsSaved}
      />}
    </Section>
  </div>;
}

function TrainingSessionDetail({ session, grooms, busy, nowMs, showMetrics, onAssign, onStatus, onVideo, onOpenSimulation, onToggleMetrics, onTargetsSaved }: {
  session: TrainingSession; grooms: Groom[]; busy: boolean; nowMs: number; showMetrics: boolean;
  onAssign: (id: string, groomId: number) => void; onStatus: (id: string, status: string) => void;
  onVideo: (event: FormEvent<HTMLFormElement>, id: string) => void; onOpenSimulation: (session: TrainingSession) => void;
  onToggleMetrics: () => void; onTargetsSaved: () => Promise<void>;
}) {
  const window = sessionWindow(session);
  const insideTimeWindow = Boolean(window && nowMs >= window.start && nowMs < window.end);
  const afterTimeWindow = Boolean(window && nowMs >= window.end);
  const canStart = Boolean(session.assigned_groom_id) && session.status === "Scheduled" && session.session_type !== "Rest" && insideTimeWindow;
  const canComplete = afterTimeWindow && (session.status === "InProgress" || (session.status === "Scheduled" && session.session_type === "Rest"));
  const isOpen = ["Scheduled", "Blocked", "InProgress", "Missed"].includes(session.status);
  const hasSimulationMetrics = session.status === "Completed" || Boolean(session.latest_metric || session.metrics?.length);
  return <article className="mt-4 rounded-xl border border-blue-300 bg-white p-4 shadow-sm" aria-label={`Chi tiết buổi tập của ${session.horse_name}`}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-black text-slate-950">{session.horse_name}</h3><span className="rounded bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">{sessionTypeLabel(session.session_type)}</span><span className="rounded bg-blue-50 px-2 py-1 text-xs font-bold text-blue-900">{scheduleStatusLabel(session.status)}</span></div><p className="mt-1 text-sm font-semibold text-slate-700">{new Date(`${session.event_date}T12:00:00`).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })} · {session.start_time?.slice(0, 5) ?? "Cả ngày"}{session.end_time ? `–${session.end_time.slice(0, 5)}` : ""} · {session.track_surface || "Chưa chọn mặt sân"}</p></div>
      <button type="button" className="soft-button" onClick={onToggleMetrics} disabled={!hasSimulationMetrics} title={!hasSimulationMetrics ? "Chỉ số sẽ tự động có sau khi hoàn thành mô phỏng buổi tập" : undefined}><HeartPulse size={14} /> {showMetrics ? "Ẩn chỉ số mô phỏng" : "Xem chỉ số mô phỏng & đánh giá"}</button>
    </div>
    <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4"><p><span className="block text-xs text-slate-500">Giáo án</span><strong>{session.plan_stage_name ?? "Chưa gắn"}</strong></p><p><span className="block text-xs text-slate-500">Groom</span><strong>{session.groom_name ?? "Chưa phân công"}</strong></p><p><span className="block text-xs text-slate-500">Mục tiêu</span><strong>{session.plan_objective ?? "Chưa có mô tả"}</strong></p><p><span className="block text-xs text-slate-500">Chỉ tiêu</span><strong>{session.plan_target_distance_meters != null ? `${session.plan_target_distance_meters.toLocaleString("vi-VN")} m` : "—"}{session.plan_target_intensity ? ` · ${session.plan_target_intensity}` : ""}</strong></p></div>
    {session.notes && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700"><strong>Ghi chú:</strong> {session.notes}</p>}
    <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-200 pt-3"><label className="min-w-52"><span className="mb-1 block text-xs font-semibold text-slate-600">Groom phụ trách</span><select aria-label={`Phân công Groom cho ${session.horse_name}`} className="field-control w-full" value={session.assigned_groom_id ?? ""} disabled={session.status !== "Scheduled" || busy} onChange={(event) => event.target.value && onAssign(session.training_schedule_id, Number(event.target.value))}><option value="">Chọn Groom</option>{grooms.map((groom) => <option key={groom.user_id} value={groom.user_id}>{groom.full_name}</option>)}</select></label>{canStart && <button type="button" className="gold-button" disabled={busy} onClick={() => onOpenSimulation(session)}><Play size={14} /> Bắt đầu tập (Mô phỏng)</button>}{session.status === "InProgress" && <button type="button" className="gold-button" disabled={busy} onClick={() => onOpenSimulation(session)}><Activity size={14} /> Mở lại giả lập</button>}{session.status === "InProgress" && <button type="button" className="soft-button text-emerald-700" disabled={busy || !canComplete} title={!canComplete ? `Chỉ hoàn tất sau khi kết thúc giả lập hoặc sau ${session.end_time?.slice(0, 5) ?? "giờ tập"}` : undefined} onClick={() => onStatus(session.training_schedule_id, "Completed")}><Check size={14} /> Hoàn tất</button>}{session.status === "Scheduled" && session.session_type === "Rest" && canComplete && <button type="button" className="soft-button text-emerald-700" disabled={busy} onClick={() => onStatus(session.training_schedule_id, "Completed")}><Check size={14} /> Hoàn tất nghỉ</button>}{isOpen && <button type="button" className="soft-button text-rose-700" disabled={busy} onClick={() => onStatus(session.training_schedule_id, "Cancelled")}><X size={14} /> Hủy buổi tập</button>}</div>
    {session.status === "Scheduled" && !afterTimeWindow && session.session_type !== "Rest" && <SessionTargetsEditor key={`${session.training_schedule_id}-${session.plan_target_distance_meters}-${session.plan_target_intensity}-${session.track_surface}`} session={session} onSaved={onTargetsSaved} />}
    {showMetrics && <SessionMetrics session={session} onVideo={onVideo} onSaved={onTargetsSaved} busy={busy} />}
  </article>;
}

function SessionMetrics({ session, onVideo, onSaved, busy }: { session: TrainingSession; onVideo: (event: FormEvent<HTMLFormElement>, id: string) => void; onSaved: () => Promise<void>; busy: boolean }) {
  const [detail, setDetail] = useState<TrainingSession | null>(session);
  const [savingReview, setSavingReview] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [reviewSavedMsg, setReviewSavedMsg] = useState("");
  useEffect(() => {
    setDetail(session);
    headTrainerApi.schedule(session.training_schedule_id).then(setDetail).catch(() => setDetail(session));
  }, [session, session.training_schedule_id]);
  const metrics = detail?.metrics?.length ? detail.metrics : session.metrics ?? [];
  const defaultReview = detail?.trainer_review ?? session.trainer_review ?? metrics[0]?.trainer_review ?? "";

  async function submitReviewForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const reviewText = String(data.get("trainer_review") || "").trim();
    setSavingReview(true);
    setReviewError("");
    setReviewSavedMsg("");
    try {
      const updated = await headTrainerApi.updateSchedule(session.training_schedule_id, {
        trainer_review: reviewText,
      });
      setDetail(updated);
      await onSaved();
      setReviewSavedMsg("Đã lưu nhận xét chuyên môn của HLV.");
    } catch (err) {
      setReviewError(headTrainerError(err));
    } finally {
      setSavingReview(false);
    }
  }

  return <div className="mt-4 border-t border-equine-line pt-5">
    <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
      <section aria-label="Chỉ số thu tự động từ mô phỏng">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-base font-bold text-equine-navy">Chỉ số tự động từ Mô phỏng cảm biến</h4>
            <p className="text-xs text-slate-500">Chỉ số được hệ thống tự động lấy trực tiếp từ phiên mô phỏng tập luyện (không cần nhập thủ công).</p>
          </div>
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-900">{metrics.length} bản ghi mô phỏng</span>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {metrics.map((metric) => <article key={metric.id} className="rounded-xl border border-equine-line bg-slate-50 p-3.5 text-sm shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold text-equine-navy">{metricDate(metric.recorded_at)}</p>
              {metric.has_injury_alert && <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">Cảnh báo vượt ngưỡng</span>}
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-2.5 text-slate-700">
              <p className="rounded bg-white p-2 border border-slate-200/80"><span className="block text-[11px] text-slate-500">Cân nặng</span><strong className="text-sm">{metric.body_weight_kg ?? "—"} kg</strong></p>
              <p className="rounded bg-white p-2 border border-slate-200/80"><span className="block text-[11px] text-slate-500">Nhịp tim tối đa</span><strong className="text-sm text-rose-700">{metric.max_heart_rate ?? "—"} bpm</strong></p>
              <p className="rounded bg-white p-2 border border-slate-200/80"><span className="block text-[11px] text-slate-500">Tốc độ trung bình</span><strong className="text-sm text-blue-700">{metric.avg_speed_kmh ?? "—"} km/h</strong></p>
              <p className="rounded bg-white p-2 border border-slate-200/80"><span className="block text-[11px] text-slate-500">Điểm thể lực</span><strong className="text-sm text-emerald-700">{metric.stamina_score ?? "—"} / 10</strong></p>
            </div>
            {(detail?.trainer_review || metric.trainer_review) && <p className="mt-2.5 rounded bg-white p-2 text-xs text-slate-700 border border-slate-200/80"><strong>Đánh giá:</strong> {detail?.trainer_review || metric.trainer_review}</p>}
          </article>)}
        </div>
        {!metrics.length && <p className="mt-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Chưa có dữ liệu chỉ số từ mô phỏng. Khi buổi tập chạy xong bên tab Mô phỏng, chỉ số sẽ tự động hiển thị tại đây.</p>}
      </section>

      <div className="space-y-4">
        <form key={defaultReview} onSubmit={(event) => void submitReviewForm(event)} className="grid gap-2.5 rounded-xl border border-equine-line bg-slate-50/70 p-3.5">
          <h4 className="text-sm font-bold text-equine-navy">Đánh giá chuyên môn của HLV sau buổi tập</h4>
          {reviewError && <Notice error>{reviewError}</Notice>}
          {reviewSavedMsg && <Notice>{reviewSavedMsg}</Notice>}
          <TextArea label="Nhận xét của HLV" name="trainer_review" defaultValue={defaultReview} rows={3} />
          <div className="flex justify-end">
            <button className="gold-button" disabled={busy || savingReview}><Check size={14} /> Lưu nhận xét HLV</button>
          </div>
        </form>

        <form onSubmit={(event) => onVideo(event, session.training_schedule_id)} className="grid gap-2 rounded-xl border border-equine-line bg-slate-50/70 p-3.5 sm:grid-cols-2">
          <h4 className="text-sm font-bold text-equine-navy sm:col-span-2">Chia sẻ video với Chủ ngựa</h4>
          <Field label="Đường dẫn HTTPS" name="video_url" type="url" required placeholder="https://..." />
          <Field label="Mô tả" name="description" maxLength={255} placeholder="Buổi tập hoặc nội dung video" />
          <div className="sm:col-span-2 flex justify-end"><button className="soft-button" disabled={busy}><Plus size={14} /> Chia sẻ video</button></div>
        </form>
      </div>
    </div>
  </div>;
}

// Kept as a reference for the previous manual-entry flow; it is no longer rendered.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LegacySessionMetrics({ session, onMetrics, onVideo, busy }: { session: TrainingSession; onMetrics: (event: FormEvent<HTMLFormElement>, id: string) => void; onVideo: (event: FormEvent<HTMLFormElement>, id: string) => void; busy: boolean }) {
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

const RACE_SPEED_OPTIONS = [1, 2, 4, 8] as const;

function formatPrizeVnd(value: unknown) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(num);
}

function trainerHorseHealthLabel(status?: string | null) {
  return ({
    Healthy: "Khỏe mạnh",
    Monitoring: "Đang theo dõi",
    Injured: "Chấn thương",
    Quarantine: "Cách ly",
    "Under Observation": "Cần theo dõi",
    Sick: "Đang bệnh",
  } as Record<string, string>)[status ?? ""] ?? status ?? "Chưa xác định";
}

function trainerHorseReadinessLabel(readiness?: string | null) {
  return ({
    Ready: "Sẵn sàng",
    NotReady: "Chưa sẵn sàng",
    Unknown: "Chưa đánh giá",
  } as Record<string, string>)[readiness ?? ""] ?? "Chưa đánh giá";
}

function formatIsoDateVi(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(parsed);
}

function conflictTypeLabel(eventType: string) {
  return ({
    Training: "Buổi tập",
    TrialRun: "Chạy thử",
    Race: "Giải đấu",
    HoofCheck: "Kiểm tra móng",
    Deworming: "Tẩy giun",
    Vaccination: "Tiêm phòng",
    MedicalCheckup: "Khám định kỳ",
  } as Record<string, string>)[eventType] ?? eventType;
}

function isTrainingConflict(conflict: RaceScheduleConflict) {
  return conflict.source_table === "training_schedules"
    || conflict.event_type === "Training"
    || conflict.event_type === "TrialRun";
}

function horseRaceTier(horse: Horse) {
  if (horse.is_training_locked || horse.current_status !== "Healthy") return 2;
  if (horse.readiness_status !== "Ready") return 1;
  return 0;
}

function horseRaceBadge(horse: Horse) {
  if (horse.is_training_locked) return { label: "Đang khóa", cls: "bg-rose-100 text-rose-800" };
  if (horse.current_status !== "Healthy") return { label: trainerHorseHealthLabel(horse.current_status), cls: "bg-rose-100 text-rose-800" };
  if (horse.readiness_status !== "Ready") return { label: "Chờ BS duyệt", cls: "bg-amber-100 text-amber-800" };
  return { label: "Đủ chuẩn", cls: "bg-emerald-100 text-emerald-800" };
}

type TrainerEntryFilter = "ALL" | "PENDING_RESULT" | "UPCOMING" | "COMPLETED" | "INACTIVE";

function RaceEntriesPanel({
  selectedHorse,
  horses,
  races,
  entries,
  refreshRevision,
  onSelectHorse,
  onCancelTrainingConflict,
  onOpenCalendarOnDate,
  onRegister,
  onRecordResult,
  onCancelEntry,
  onRestoreEntry,
  busy,
  error,
  notice,
}: {
  selectedHorse: Horse | null;
  horses: Horse[];
  races: RaceOption[];
  entries: Record<string, unknown>[];
  refreshRevision: number;
  onSelectHorse: (horseId: string) => void;
  onCancelTrainingConflict: (conflict: RaceScheduleConflict) => Promise<boolean>;
  onOpenCalendarOnDate: (date: string) => void;
  onRegister: (id: string) => void;
  onRecordResult: (id: string, input: { result_position: number; prize_amount: number }) => void;
  onCancelEntry: (entryId: string, reason: string) => Promise<void>;
  onRestoreEntry: (entryId: string) => Promise<void>;
  busy: boolean;
  error?: string;
  notice?: string;
}) {
  const [viewMode, setViewMode] = useState<"official" | "preview3d">("official");
  const [raceId, setRaceId] = useState("");
  const [horseSearchQuery, setHorseSearchQuery] = useState("");
  const [onlyReadyHorses, setOnlyReadyHorses] = useState(false);
  const [entryFilter, setEntryFilter] = useState<TrainerEntryFilter>("ALL");
  const [trackSurface, setTrackSurface] = useState("Turf");
  const [competitorIds, setCompetitorIds] = useState<string[]>(() => selectedHorse ? [selectedHorse.id] : []);
  const [runStartTime, setRunStartTime] = useState<number | null>(null);
  const [raceSpeed, setRaceSpeed] = useState<number>(1);
  const [eligibilityState, setEligibilityState] = useState<{ key: string; data?: RaceEligibility; error?: string } | null>(null);
  const [eligibilityCheckSeq, setEligibilityCheckSeq] = useState(0);
  const [resolvingConflictId, setResolvingConflictId] = useState<string | null>(null);
  const [cancellingEntry, setCancellingEntry] = useState<{ id: string; raceName: string } | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [confirmingResult, setConfirmingResult] = useState<{ entryId: string; raceName: string; position: number; prize: number } | null>(null);

  const selectedHorseId = selectedHorse?.id;
  useEffect(() => {
    if (!selectedHorseId) return;
    setCompetitorIds((current) => current.includes(selectedHorseId) || current.length >= 5 ? current : [selectedHorseId, ...current]);
  }, [selectedHorseId]);

  const activeRegisteredRaceIds = useMemo(() => {
    const set = new Set<string>();
    for (const entry of entries) {
      if (String(entry.status ?? "") !== "Cancelled" && entry.race_id) {
        set.add(String(entry.race_id));
      }
    }
    return set;
  }, [entries]);

  const effectiveRaceId = useMemo(() => {
    if (races.some((race) => race.id === raceId)) return raceId;
    return races.find((race) => !activeRegisteredRaceIds.has(race.id))?.id ?? races[0]?.id ?? "";
  }, [races, raceId, activeRegisteredRaceIds]);

  const entriesSignature = useMemo(
    () => entries.map((entry) => `${String(entry.id ?? "")}:${String(entry.status ?? "")}`).join(","),
    [entries],
  );

  const eligibilityKey = selectedHorseId && effectiveRaceId
    ? [
      selectedHorseId,
      effectiveRaceId,
      selectedHorse?.current_status ?? "",
      selectedHorse?.readiness_status ?? "",
      String(Boolean(selectedHorse?.is_training_locked)),
      entriesSignature,
      String(refreshRevision),
      String(eligibilityCheckSeq),
    ].join("|")
    : "";

  useEffect(() => {
    if (!selectedHorseId || !effectiveRaceId || !eligibilityKey) return;
    let active = true;
    const key = eligibilityKey;
    headTrainerApi.raceEligibility(selectedHorseId, effectiveRaceId)
      .then((data) => { if (active) setEligibilityState({ key, data }); })
      .catch((reason) => { if (active) setEligibilityState({ key, error: headTrainerError(reason) }); });
    return () => { active = false; };
  }, [selectedHorseId, effectiveRaceId, eligibilityKey]);

  const checkingEligibility = Boolean(eligibilityKey && eligibilityState?.key !== eligibilityKey);
  const eligibility = eligibilityKey && eligibilityState?.key === eligibilityKey ? eligibilityState.data ?? null : null;
  const eligibilityError = eligibilityKey && eligibilityState?.key === eligibilityKey ? eligibilityState.error ?? "" : "";

  const horsePool = selectedHorse && !horses.some((horse) => horse.id === selectedHorse.id) ? [selectedHorse, ...horses] : horses;
  const availableHorses = horsePool.filter((horse) => !horse.deleted_at);
  const sortedHorses = useMemo(() => {
    return [...availableHorses].sort((left, right) => {
      const tierDiff = horseRaceTier(left) - horseRaceTier(right);
      return tierDiff !== 0 ? tierDiff : left.horse_name.localeCompare(right.horse_name, "vi");
    });
  }, [availableHorses]);
  const readyHorseCount = useMemo(() => sortedHorses.filter((horse) => horseRaceTier(horse) === 0).length, [sortedHorses]);
  const filteredQuickHorses = useMemo(() => {
    const query = normalizeHorseSearch(horseSearchQuery.trim());
    return sortedHorses.filter((horse) => {
      if (onlyReadyHorses && horseRaceTier(horse) !== 0) return false;
      if (!query) return true;
      return normalizeHorseSearch(`${horse.horse_name} ${horse.id}`).includes(query);
    });
  }, [sortedHorses, horseSearchQuery, onlyReadyHorses]);

  const competitors = competitorIds.map((id) => availableHorses.find((horse) => horse.id === id)).filter((horse): horse is Horse => Boolean(horse));
  const raceRunners: RaceTrackRunner[] = competitors.slice(0, 5).map((horse, index) => ({
    id: horse.id,
    name: horse.horse_name,
    lane: index + 1,
    progress: 0,
    speedKmh: racePreviewSpeed(horse.id),
  }));
  const selectedRace = races.find((race) => race.id === effectiveRaceId) ?? null;
  const targetDistance = selectedRace?.distance_meters ?? 1600;

  const todayStr = today();

  const entryStats = useMemo(() => {
    let upcoming = 0;
    let pendingResult = 0;
    let completed = 0;
    let wins = 0;
    let inactive = 0;
    let totalPrize = 0;
    for (const entry of entries) {
      const status = String(entry.status ?? "Registered");
      const raceStatus = String(entry.race_status ?? "Scheduled");
      const raceDate = String(entry.race_date ?? "");
      if (status === "Completed") {
        completed += 1;
        if (Number(entry.result_position) === 1) wins += 1;
        const prize = Number(entry.prize_amount ?? 0);
        if (Number.isFinite(prize)) totalPrize += prize;
      } else if (status === "Cancelled" || raceStatus === "Cancelled" || status === "Blocked") {
        inactive += 1;
      } else if (status === "Registered") {
        if (raceDate && raceDate <= todayStr) pendingResult += 1;
        else upcoming += 1;
      }
    }
    return { upcoming, pendingResult, completed, wins, inactive, totalPrize };
  }, [entries, todayStr]);

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const status = String(entry.status ?? "Registered");
      const raceStatus = String(entry.race_status ?? "Scheduled");
      const raceDate = String(entry.race_date ?? "");
      const isPending = status === "Registered" && raceStatus !== "Cancelled" && Boolean(raceDate) && raceDate <= todayStr;
      const isUpcoming = status === "Registered" && raceStatus !== "Cancelled" && (!raceDate || raceDate > todayStr);
      const isInactive = status === "Blocked" || status === "Cancelled" || raceStatus === "Cancelled";
      if (entryFilter === "PENDING_RESULT") return isPending;
      if (entryFilter === "UPCOMING") return isUpcoming;
      if (entryFilter === "COMPLETED") return status === "Completed";
      if (entryFilter === "INACTIVE") return isInactive;
      return true;
    });
  }, [entries, entryFilter, todayStr]);

  function submitResult(event: FormEvent<HTMLFormElement>, entry: Record<string, unknown>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const position = Number(values.get("result_position"));
    const prize = Number(values.get("prize_amount"));
    if (!Number.isInteger(position) || position < 1 || !Number.isFinite(prize) || prize < 0) return;
    setConfirmingResult({
      entryId: String(entry.id),
      raceName: String(entry.race_name ?? "Giải đấu"),
      position,
      prize,
    });
  }

  async function handleCancelConflict(conflict: RaceScheduleConflict) {
    setResolvingConflictId(conflict.event_id);
    try {
      const ok = await onCancelTrainingConflict(conflict);
      if (ok) setEligibilityCheckSeq((value) => value + 1);
    } finally {
      setResolvingConflictId(null);
    }
  }

  async function handleCancelAllTrainingConflicts(items: RaceScheduleConflict[]) {
    if (!items.length) return;
    setResolvingConflictId("ALL");
    try {
      let changed = false;
      for (const item of items) {
        const ok = await onCancelTrainingConflict(item);
        if (ok) changed = true;
      }
      if (changed) setEligibilityCheckSeq((value) => value + 1);
    } finally {
      setResolvingConflictId(null);
    }
  }

  const isHealthy = selectedHorse?.current_status === "Healthy";
  const isReady = selectedHorse?.readiness_status === "Ready";
  const isLocked = Boolean(selectedHorse?.is_training_locked);
  const lockCheckFailed = isLocked || Boolean(eligibility?.has_unresolved_injury);
  const conflicts = eligibility?.conflicts ?? [];
  const trainingConflicts = conflicts.filter(isTrainingConflict);
  const extraBlockingReasons = (eligibility?.blocking_reasons ?? []).filter((reason) =>
    !reason.startsWith("Ngựa đang bị khóa huấn luyện")
    && !reason.startsWith("Trạng thái sức khỏe hiện tại")
    && !reason.startsWith("Bác sĩ thú y chưa đánh giá Sẵn sàng")
    && !reason.startsWith("Ngựa vẫn còn chấn thương")
    && !(eligibility?.already_registered && reason.startsWith("Ngựa đã có đăng ký đang hiệu lực")),
  );
  const scheduleCheckPassed = Boolean(
    effectiveRaceId
    && !checkingEligibility
    && !eligibilityError
    && eligibility
    && !eligibility.already_registered
    && conflicts.length === 0
    && extraBlockingReasons.length === 0,
  );
  const canSubmitRegister = Boolean(
    effectiveRaceId
    && selectedHorse
    && !isLocked
    && isHealthy
    && isReady
    && !checkingEligibility
    && !eligibilityError
    && eligibility?.eligible,
  );

  const registerButtonLabel = canSubmitRegister
    ? `+ Đăng ký ${selectedHorse?.horse_name ?? "ngựa"} vào giải này`
    : !effectiveRaceId
      ? "Chọn giải đấu ở Bước 1 để đăng ký"
      : checkingEligibility
        ? "Đang kiểm tra điều kiện tham dự..."
        : eligibility?.already_registered
          ? "Ngựa đã đăng ký giải đấu này"
          : lockCheckFailed
            ? "Đang bị khóa / chấn thương — chưa thể đăng ký"
            : !isHealthy
              ? "Ngựa chưa Khỏe mạnh (Healthy) — chưa thể đăng ký"
              : !isReady
                ? "Cần Bác sĩ thú y duyệt “Sẵn sàng” trước khi đăng ký"
                : trainingConflicts.length > 0
                  ? `Hủy ${trainingConflicts.length} buổi tập trùng ở trên để đăng ký`
                  : conflicts.length > 0
                    ? `Xử lý ${conflicts.length} lịch trùng ở trên để đăng ký`
                    : extraBlockingReasons[0] ?? "+ Đăng ký ngựa vào giải chính thức";

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-equine-line bg-white p-2.5 shadow-sm">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setViewMode("official")}
          className={viewMode === "official" ? "gold-button !min-h-[38px] !px-4 !text-sm" : "soft-button !min-h-[38px] !px-4 !text-sm"}
        >
          <Flag size={15} /> Đăng ký &amp; Kết quả giải chính thức
        </button>
        <button
          type="button"
          onClick={() => setViewMode("preview3d")}
          className={viewMode === "preview3d" ? "gold-button !min-h-[38px] !px-4 !text-sm" : "soft-button !min-h-[38px] !px-4 !text-sm"}
        >
          <Play size={15} /> Mô phỏng đường đua 3D (Thử sân)
        </button>
      </div>
      {viewMode === "official" && selectedHorse && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-sky-50 px-2.5 py-1 font-semibold text-sky-800">
            Sắp thi đấu: {entryStats.upcoming}
          </span>
          <span className={`rounded-full px-2.5 py-1 font-semibold ${entryStats.pendingResult > 0 ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-600"}`}>
            Chờ ghi KQ: {entryStats.pendingResult}
          </span>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-800">
            Hoàn thành: {entryStats.completed}{entryStats.totalPrize > 0 ? ` · ${formatPrizeVnd(entryStats.totalPrize)}` : ""}
          </span>
        </div>
      )}
    </div>

    {viewMode === "official" && (
      <section className="rounded-xl border border-equine-line bg-white p-3.5 shadow-sm space-y-3" aria-label="Chọn nhanh ngựa thi đấu">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-extrabold uppercase tracking-wide text-equine-navy">Chọn ngựa thi đấu</span>
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${readyHorseCount > 0 ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
              {readyHorseCount}/{availableHorses.length} ngựa đủ chuẩn y tế
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative">
              <span className="sr-only">Tìm nhanh tên ngựa</span>
              <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={horseSearchQuery}
                onChange={(event) => setHorseSearchQuery(event.target.value)}
                placeholder="Tìm tên ngựa..."
                className="field-control !min-h-[34px] w-44 pl-8 pr-2.5 text-xs"
              />
            </label>
            <button
              type="button"
              onClick={() => setOnlyReadyHorses((value) => !value)}
              className={onlyReadyHorses ? "gold-button !min-h-[34px] !px-3 !text-xs" : "soft-button !min-h-[34px] !px-3 !text-xs"}
            >
              Chỉ hiện đủ chuẩn ({readyHorseCount})
            </button>
          </div>
        </div>
        <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto pr-1" role="listbox" aria-label="Danh sách chọn ngựa nhanh">
          {filteredQuickHorses.map((horse) => {
            const picked = horse.id === selectedHorseId;
            const badge = horseRaceBadge(horse);
            return (
              <button
                key={horse.id}
                type="button"
                role="option"
                aria-selected={picked}
                onClick={() => onSelectHorse(horse.id)}
                className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition ${
                  picked
                    ? "border-equine-navy bg-equine-navy text-white shadow-sm"
                    : "border-slate-200 bg-slate-50/70 text-slate-800 hover:border-equine-navy/50 hover:bg-white"
                }`}
              >
                <span className="font-semibold">{horse.horse_name}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${picked ? "bg-white/20 text-white" : badge.cls}`}>
                  {badge.label}
                </span>
              </button>
            );
          })}
          {!filteredQuickHorses.length && (
            <p className="text-xs text-slate-500 py-1">
              {onlyReadyHorses ? "Hiện chưa có ngựa nào đạt đủ chuẩn Healthy + Ready." : "Không tìm thấy ngựa phù hợp."}
            </p>
          )}
        </div>
      </section>
    )}

    {viewMode === "official" ? (
      <div className="grid gap-5 xl:grid-cols-[1.04fr_1.16fr]">
        <Section
          title="Đăng ký giải đấu chính thức"
          description={selectedHorse ? `Ngựa đang chọn: ${selectedHorse.horse_name}` : "Chọn ngựa phía trên"}
          help="Chọn giải mở, xem nhanh 4 điều kiện và bấm hủy ngay buổi tập trùng nếu có để hoàn tất đăng ký."
          icon={Flag}
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-equine-line bg-slate-50/80 p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wide text-equine-navy">Bước 1 · Chọn giải đấu đang mở</span>
                <span className="text-xs text-slate-500">{races.length} giải sắp tới</span>
              </div>

              {races.length > 0 ? (
                <div className="max-h-60 space-y-2 overflow-y-auto pr-1" role="listbox" aria-label="Danh sách giải đấu chính thức">
                  {races.map((race) => {
                    const isPicked = effectiveRaceId === race.id;
                    const alreadyIn = activeRegisteredRaceIds.has(race.id);
                    return (
                      <button
                        key={race.id}
                        type="button"
                        role="option"
                        aria-selected={isPicked}
                        onClick={() => { setRaceId(race.id); setRunStartTime(null); }}
                        className={`w-full rounded-lg border p-2.5 text-left transition ${
                          isPicked
                            ? "border-equine-navy bg-sky-50/40 ring-2 ring-equine-navy/15 shadow-sm"
                            : "border-slate-200 bg-white hover:border-equine-teal/60"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-sm text-equine-navy">{race.race_name}</span>
                          <div className="flex flex-wrap gap-1.5">
                            {race.grade && <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">Hạng {race.grade}</span>}
                            {alreadyIn && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-800">Đã đăng ký</span>}
                          </div>
                        </div>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1"><CalendarDays size={12} /> {formatIsoDateVi(race.race_date)}</span>
                          {race.distance_meters != null && <span>{race.distance_meters.toLocaleString("vi-VN")} m{race.distance_category ? ` (${race.distance_category})` : ""}</span>}
                          {race.location && <span className="inline-flex items-center gap-1"><MapPin size={12} /> {race.location}</span>}
                        </p>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <Notice>Hiện chưa có giải đấu chính thức nào đang mở từ hôm nay trở đi. Club Manager cần tạo giải mới trước.</Notice>
              )}
            </div>

            <div className="rounded-xl border border-equine-line bg-white p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wide text-equine-navy">Bước 2 · Kiểm tra 4 điều kiện tham dự</span>
                <button
                  type="button"
                  disabled={busy || checkingEligibility || !effectiveRaceId}
                  onClick={() => setEligibilityCheckSeq((value) => value + 1)}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  <RefreshCw size={11} className={checkingEligibility ? "animate-spin" : ""} />
                  {checkingEligibility ? "Đang kiểm tra..." : "Kiểm tra lại"}
                </button>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 text-xs">
                <div className={`rounded-lg border p-2.5 ${isHealthy ? "border-emerald-200 bg-emerald-50/40" : "border-rose-200 bg-rose-50/40"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-800">1. Sức khỏe</span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${isHealthy ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                      {isHealthy ? <><Check size={11} /> Đạt</> : <><X size={11} /> Chưa đạt</>}
                    </span>
                  </div>
                  <p className="mt-1 text-slate-600">{trainerHorseHealthLabel(selectedHorse?.current_status)}</p>
                </div>

                <div className={`rounded-lg border p-2.5 ${isReady ? "border-emerald-200 bg-emerald-50/40" : "border-amber-200 bg-amber-50/50"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-800">2. Bác sĩ thú y duyệt</span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${isReady ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                      {isReady ? <><Check size={11} /> Đạt</> : <><X size={11} /> Chưa đạt</>}
                    </span>
                  </div>
                  <p className="mt-1 text-slate-600">
                    {isReady ? "Đã đánh giá Sẵn sàng" : `${trainerHorseReadinessLabel(selectedHorse?.readiness_status)} · Cần BS bật Sẵn sàng ở tab Sức khỏe`}
                  </p>
                </div>

                <div className={`rounded-lg border p-2.5 ${!lockCheckFailed ? "border-emerald-200 bg-emerald-50/40" : "border-rose-200 bg-rose-50/40"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-800">3. Khóa &amp; Chấn thương</span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${!lockCheckFailed ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                      {!lockCheckFailed ? <><Check size={11} /> Đạt</> : <><X size={11} /> Bị chặn</>}
                    </span>
                  </div>
                  <p className="mt-1 text-slate-600">
                    {isLocked
                      ? "Ngựa đang bị khóa huấn luyện"
                      : eligibility?.has_unresolved_injury
                        ? "Còn chấn thương chưa hồi phục"
                        : "Không khóa · Ổn định"}
                  </p>
                </div>

                <div className={`rounded-lg border p-2.5 ${
                  !effectiveRaceId || checkingEligibility
                    ? "border-slate-200 bg-slate-50/70"
                    : scheduleCheckPassed
                      ? "border-emerald-200 bg-emerald-50/40"
                      : "border-rose-200 bg-rose-50/40"
                }`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-800">4. Lịch ngày đua</span>
                    {effectiveRaceId && !checkingEligibility && (
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${scheduleCheckPassed ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                        {scheduleCheckPassed ? <><Check size={11} /> Hợp lệ</> : <><X size={11} /> Bị chặn</>}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-slate-600">
                    {!effectiveRaceId
                      ? "Chưa có giải đấu để kiểm tra"
                      : checkingEligibility
                        ? "Đang đồng bộ lịch ngày đua..."
                        : eligibilityError
                          ? eligibilityError
                          : eligibility?.already_registered
                            ? "Đã đăng ký giải này"
                            : conflicts.length > 0
                              ? `Trùng ${conflicts.length} sự kiện ngày ${formatIsoDateVi(eligibility?.race_date)}`
                              : extraBlockingReasons[0] ?? `Trống lịch ngày ${formatIsoDateVi(eligibility?.race_date)}`}
                  </p>
                </div>
              </div>

              {effectiveRaceId && !checkingEligibility && (conflicts.length > 0 || extraBlockingReasons.length > 0) && (
                <div className="rounded-lg border border-rose-200 bg-rose-50/70 p-3 space-y-2 text-xs">
                  {conflicts.length > 0 && (
                    <>
                      <p className="font-bold text-rose-900">Xử lý lịch trùng trong ngày {formatIsoDateVi(eligibility?.race_date)}:</p>
                      <div className="space-y-1.5">
                        {conflicts.map((conflict) => {
                          const canCancelDirectly = isTrainingConflict(conflict);
                          const cancellingThis = resolvingConflictId === conflict.event_id || resolvingConflictId === "ALL";
                          return (
                            <div key={conflict.event_id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-rose-200/80 bg-white px-2.5 py-2 text-rose-900">
                              <span>
                                <strong>{conflictTypeLabel(conflict.event_type)}</strong>
                                {conflict.title ? ` · ${conflict.title}` : ""} ({formatIsoDateVi(conflict.event_date)}
                                {conflict.start_time ? ` · ${conflict.start_time.slice(0, 5)}–${conflict.end_time?.slice(0, 5) ?? ""}` : " · Cả ngày"})
                              </span>
                              {canCancelDirectly ? (
                                <button
                                  type="button"
                                  disabled={busy || resolvingConflictId !== null}
                                  onClick={() => void handleCancelConflict(conflict)}
                                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-rose-300 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-800 hover:bg-rose-100 disabled:opacity-50"
                                >
                                  <X size={12} /> {cancellingThis ? "Đang hủy..." : "Hủy buổi tập này"}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => onOpenCalendarOnDate(conflict.event_date)}
                                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-300 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                                >
                                  <CalendarDays size={12} /> Mở trên Lịch
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {trainingConflicts.length >= 2 && (
                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            disabled={busy || resolvingConflictId !== null}
                            onClick={() => void handleCancelAllTrainingConflicts(trainingConflicts)}
                            className="inline-flex items-center gap-1 rounded-md bg-rose-700 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-rose-800 disabled:opacity-50"
                          >
                            <Trash2 size={12} /> Hủy tất cả {trainingConflicts.length} buổi tập trùng
                          </button>
                        </div>
                      )}
                    </>
                  )}
                  {extraBlockingReasons.length > 0 && (
                    <ul className="list-inside list-disc space-y-0.5 text-rose-800">
                      {extraBlockingReasons.map((reason) => <li key={reason}>{reason}</li>)}
                    </ul>
                  )}
                </div>
              )}

              {eligibilityError && <Notice error>{eligibilityError}</Notice>}

              {eligibility && eligibility.warnings.length > 0 && (
                <Notice variant="warning">
                  <p className="font-semibold">Cảnh báo hồi phục (vẫn cho phép đăng ký nếu HLV cân nhắc phù hợp):</p>
                  <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs">
                    {eligibility.warnings.map((warning, idx) => <li key={`${warning.code}-${idx}`}>{warning.message}</li>)}
                  </ul>
                </Notice>
              )}

              {canSubmitRegister && (eligibility?.warnings.length ?? 0) === 0 && (
                <Notice variant="success">
                  {selectedHorse?.horse_name} đã đạt đủ 4/4 điều kiện tham dự giải “{eligibility?.race_name}” ngày {formatIsoDateVi(eligibility?.race_date)}.
                </Notice>
              )}
            </div>

            <div className="space-y-2">
              {error && <Notice error>{error}</Notice>}
              {notice && <Notice>{notice}</Notice>}
              <button
                type="button"
                className="gold-button w-full justify-center"
                disabled={busy || !canSubmitRegister}
                onClick={() => { if (effectiveRaceId) onRegister(effectiveRaceId); }}
              >
                {canSubmitRegister && <Plus size={15} />}
                <span>{registerButtonLabel}</span>
              </button>
              <p className="text-xs text-slate-500">
                Ngày thi đấu giải chính thức chiếm trọn ngày trên lịch tập luyện và chăm sóc của ngựa.
              </p>
            </div>
          </div>
        </Section>

        <Section
          title="Hồ sơ đăng ký & Ghi nhận kết quả"
          description={`${entries.length} lượt đăng ký của ${selectedHorse?.horse_name ?? "ngựa"}`}
          help="Các giải tới/quá ngày thi đấu cần được nhập Thứ hạng và Tiền thưởng (VND) để hoàn tất hồ sơ."
          icon={Medal}
        >
          <div className="mb-4 flex flex-wrap gap-2">
            {([
              ["ALL", `Tất cả (${entries.length})`],
              ["PENDING_RESULT", `Chờ ghi kết quả (${entryStats.pendingResult})`],
              ["UPCOMING", `Sắp thi đấu (${entryStats.upcoming})`],
              ["COMPLETED", `Đã có kết quả (${entryStats.completed})`],
              ["INACTIVE", `Tạm khóa / Hủy (${entryStats.inactive})`],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setEntryFilter(key)}
                className={entryFilter === key ? "gold-button !min-h-[34px] !px-3 !text-xs" : "soft-button !min-h-[34px] !px-3 !text-xs"}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filteredEntries.map((entry, index) => {
              const entryId = String(entry.id ?? index);
              const status = String(entry.status ?? "Registered");
              const raceStatus = String(entry.race_status ?? "Scheduled");
              const raceDate = String(entry.race_date ?? "");
              const pendingResult = status === "Registered" && raceStatus !== "Cancelled" && Boolean(raceDate) && raceDate <= todayStr;
              const canWithdraw = status === "Registered" || status === "Blocked";
              const canRestore = status === "Blocked" && raceStatus !== "Cancelled" && raceDate >= todayStr;

              const statusBadge = status === "Completed"
                ? {
                  label: entry.result_position != null ? `Hạng ${entry.result_position} · Hoàn thành` : "Đã hoàn thành",
                  cls: Number(entry.result_position) === 1
                    ? "bg-amber-100 text-amber-900 border-amber-300"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200",
                }
                : status === "Blocked"
                  ? { label: "Tạm khóa y tế", cls: "bg-rose-50 text-rose-700 border-rose-200" }
                  : status === "Cancelled" || raceStatus === "Cancelled"
                    ? { label: "Đã rút / Hủy", cls: "bg-slate-100 text-slate-600 border-slate-200" }
                    : pendingResult
                      ? { label: "Chờ ghi kết quả", cls: "bg-amber-50 text-amber-800 border-amber-300" }
                      : { label: "Sắp thi đấu", cls: "bg-sky-50 text-sky-700 border-sky-200" };

              return (
                <article
                  key={entryId}
                  className={`rounded-xl border p-4 transition ${
                    pendingResult
                      ? "border-amber-300 bg-amber-50/30"
                      : status === "Blocked"
                        ? "border-rose-200 bg-rose-50/20"
                        : "border-equine-line bg-white"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-semibold text-equine-navy">{String(entry.race_name ?? "Giải đấu")}</h4>
                        {raceStatus === "Cancelled" && (
                          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">Giải đã hủy</span>
                        )}
                      </div>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${statusBadge.cls}`}>{statusBadge.label}</span>
                  </div>

                  <div className="mt-3 grid gap-2 rounded-lg bg-slate-50 p-2.5 text-xs sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <span className="block text-[11px] uppercase tracking-wide text-slate-400">Ngày thi đấu</span>
                      <strong className="mt-0.5 block text-slate-800">{formatIsoDateVi(raceDate)}</strong>
                    </div>
                    <div>
                      <span className="block text-[11px] uppercase tracking-wide text-slate-400">Địa điểm</span>
                      <strong className="mt-0.5 block text-slate-800">{entry.location ? String(entry.location) : "Chưa cập nhật"}</strong>
                    </div>
                    <div>
                      <span className="block text-[11px] uppercase tracking-wide text-slate-400">Cự ly & Hạng giải</span>
                      <strong className="mt-0.5 block text-slate-800">
                        {entry.distance_meters ? `${Number(entry.distance_meters).toLocaleString("vi-VN")} m` : "—"}
                        {entry.grade ? ` · ${String(entry.grade)}` : ""}
                      </strong>
                    </div>
                    <div>
                      <span className="block text-[11px] uppercase tracking-wide text-slate-400">Thành tích / Thưởng</span>
                      <strong className="mt-0.5 block text-equine-navy">
                        {status === "Completed"
                          ? `${entry.result_position != null ? `Hạng ${entry.result_position} · ` : ""}${formatPrizeVnd(entry.prize_amount ?? 0)}`
                          : pendingResult
                            ? "Cần nhập kết quả"
                            : status === "Cancelled"
                              ? "Đã hủy"
                              : "Chưa thi đấu"}
                      </strong>
                    </div>
                  </div>

                  {status === "Blocked" && (
                    <div className="mt-3">
                      <Notice variant="warning">
                        Đăng ký đang tạm khóa do trạng thái y tế. Chỉ khôi phục sau khi Bác sĩ thú y mở khóa và đánh giá ngựa Khỏe mạnh (Healthy) + Sẵn sàng (Ready).
                      </Notice>
                    </div>
                  )}

                  {entry.cancel_reason ? (
                    <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700">
                      <strong>Lý do hủy / rút ngựa:</strong> {String(entry.cancel_reason)}
                    </p>
                  ) : null}

                  {pendingResult && (
                    <form onSubmit={(event) => submitResult(event, entry)} className="mt-3 rounded-lg border border-amber-200 bg-white p-3 space-y-2.5">
                      <p className="text-xs font-bold text-amber-900">Đã đến / qua ngày thi đấu — Nhập kết quả chính thức:</p>
                      <div className="grid gap-2.5 sm:grid-cols-3">
                        <Field label="Thứ hạng (1–100)" name="result_position" type="number" min={1} max={100} step="1" required placeholder="VD: 1" />
                        <Field label="Tiền thưởng (VND)" name="prize_amount" type="number" min={0} step="0.01" required defaultValue="0" />
                        <div className="flex items-end">
                          <button className="gold-button w-full justify-center" disabled={busy}>
                            <Medal size={14} /> Lưu kết quả
                          </button>
                        </div>
                      </div>
                    </form>
                  )}

                  {(canWithdraw || canRestore) && (
                    <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                      {canRestore && (
                        <button
                          type="button"
                          className="soft-button !min-h-[32px] !px-3 !text-xs border-emerald-200 bg-emerald-50 text-emerald-800"
                          disabled={busy || !isHealthy || !isReady || isLocked}
                          onClick={() => void onRestoreEntry(entryId)}
                        >
                          <RotateCcw size={13} /> Khôi phục đăng ký
                        </button>
                      )}
                      {canWithdraw && (
                        <button
                          type="button"
                          className="soft-button !min-h-[32px] !px-3 !text-xs border-rose-200 bg-rose-50 text-rose-700"
                          disabled={busy}
                          onClick={() => {
                            setCancellingEntry({ id: entryId, raceName: String(entry.race_name ?? "Giải đấu") });
                            setCancelReason("");
                          }}
                        >
                          <Ban size={13} /> Rút ngựa khỏi giải
                        </button>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
            {!filteredEntries.length && (
              <Notice>
                {entries.length === 0
                  ? "Ngựa này chưa được đăng ký vào giải chính thức nào."
                  : "Không có lượt đăng ký nào khớp bộ lọc đang chọn."}
              </Notice>
            )}
          </div>
        </Section>
      </div>
    ) : (
      <Section title="Mô phỏng thi đấu 3D (Thử sân)" help="Chạy mô phỏng trực quan tối đa 5 ngựa trên đường đua 3D theo cự ly và mặt sân." icon={Play}>
        <div className="race-competition-layout">
          <div className="min-w-0">
            <RaceTrackScene3D surface={trackSurface} runners={raceRunners} targetDistanceMeters={targetDistance} isRunning={runStartTime != null} runStartTime={runStartTime} speedMultiplier={raceSpeed} />
            <div className="race-lane-legend">
              {raceRunners.map((runner) => <span key={runner.id}><b>{runner.lane}</b>{runner.name}</span>)}
              {!raceRunners.length && <span>Chọn ngựa để đưa vào các làn.</span>}
            </div>
          </div>
          <div className="space-y-4">
            <label className="block">
              <span className="field-label">Tham chiếu cự ly từ giải chính thức</span>
              <select className="field-control px-3" value={effectiveRaceId} onChange={(event) => { setRaceId(event.target.value); setRunStartTime(null); }}>
                <option value="">Mặc định (1.600 m)</option>
                {races.map((race) => <option key={race.id} value={race.id}>{race.race_name} · {race.race_date} · {race.distance_meters ? `${race.distance_meters} m` : "?"}</option>)}
              </select>
            </label>
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
            <fieldset className="rounded-lg border border-equine-line bg-slate-50 p-3">
              <legend className="field-label px-1">Tốc độ mô phỏng</legend>
              <div className="grid grid-cols-4 gap-2">
                {RACE_SPEED_OPTIONS.map((multiplier) => <button key={multiplier} type="button" className={raceSpeed === multiplier ? "gold-button justify-center px-2 py-2 text-sm" : "soft-button justify-center px-2 py-2 text-sm"} onClick={() => setRaceSpeed(multiplier)} aria-pressed={raceSpeed === multiplier}>{multiplier}x</button>)}
              </div>
              <p className="mt-2 text-xs text-slate-500">Có thể đổi tốc độ ngay cả khi trận đua đang chạy.</p>
            </fieldset>
            <button type="button" className="gold-button w-full justify-center" disabled={!raceRunners.length} onClick={() => setRunStartTime(Date.now())}>
              <Play size={15} />{runStartTime == null ? "Chạy mô phỏng 3D" : "Chạy lại mô phỏng"}
            </button>
          </div>
        </div>
      </Section>
    )}

    {cancellingEntry && (
      <Modal title="Rút ngựa khỏi giải đấu" busy={busy} onClose={() => setCancellingEntry(null)}>
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!cancelReason.trim()) return;
            const current = cancellingEntry;
            const reasonText = cancelReason.trim();
            setCancellingEntry(null);
            await onCancelEntry(current.id, reasonText);
          }}
        >
          <p className="text-sm text-slate-600">
            Xác nhận rút <strong>{selectedHorse?.horse_name}</strong> khỏi giải <strong>{cancellingEntry.raceName}</strong>. Ngày lịch thi đấu sẽ được giải phóng ngay lập tức.
          </p>
          <label className="block">
            <span className="field-label">Lý do rút ngựa <span className="text-rose-600">*</span></span>
            <input
              className="field-control px-3"
              maxLength={255}
              required
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              placeholder="Ví dụ: Điều chỉnh chiến thuật, chưa hồi phục thể lực..."
            />
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" className="soft-button" disabled={busy} onClick={() => setCancellingEntry(null)}>Đóng</button>
            <button type="submit" className="danger-button" disabled={busy || !cancelReason.trim()}>Xác nhận rút ngựa</button>
          </div>
        </form>
      </Modal>
    )}

    {confirmingResult && (
      <Modal title="Xác nhận lưu kết quả thi đấu" busy={busy} onClose={() => setConfirmingResult(null)}>
        <div className="space-y-4">
          <p className="text-sm leading-6 text-slate-700">
            Lưu kết quả chính thức cho <strong>{selectedHorse?.horse_name}</strong> tại giải{" "}
            <strong>{confirmingResult.raceName}</strong>: <strong>Hạng {confirmingResult.position}</strong>, tiền thưởng{" "}
            <strong>{formatPrizeVnd(confirmingResult.prize)}</strong>?
          </p>
          <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
            Lưu ý: Sau khi xác nhận, kết quả sẽ được khóa cố định và phần tiền thưởng (nếu lớn hơn 0) sẽ tự động ghi nhận vào báo cáo tài chính của Chủ ngựa.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" className="soft-button" disabled={busy} onClick={() => setConfirmingResult(null)}>Kiểm tra lại</button>
            <button
              type="button"
              className="gold-button"
              disabled={busy}
              onClick={() => {
                const payload = confirmingResult;
                setConfirmingResult(null);
                onRecordResult(payload.entryId, { result_position: payload.position, prize_amount: payload.prize });
              }}
            >
              Xác nhận lưu kết quả
            </button>
          </div>
        </div>
      </Modal>
    )}
  </div>;
}
function SimulationPanel({ sessions, activeSimulations, onSelectSimulation, simulation, readings, phase, ranking, progress, vitals, onStart, onRestartSimulation, onRetryFinish, finishFailed, busy, error, notice }: {
  sessions: TrainingSession[]; simulation: Simulation | null; readings: SensorReading[]; phase: string;
  activeSimulations: Simulation[]; onSelectSimulation: (simulation: Simulation) => void;
  onRestartSimulation: (simulation: Simulation) => void;
  ranking: { rank: number; horse_id: string; horse_name: string; finish_time_seconds: number }[];
  progress: number; vitals: Record<string, SensorVitals>;
  onStart: (event: FormEvent<HTMLFormElement>) => void; onRetryFinish: () => void;
  finishFailed: boolean; busy: boolean;
  error?: string;
  notice?: string;
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
    {activeSimulations.length > 0 && <Section title="Buổi tập đang chạy" help="Chọn phiên để theo dõi; dữ liệu vẫn được ghi nhận khi bạn chuyển ngựa hoặc tải lại trang." icon={Activity}>
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
      {simulation.model_version != null && simulation.model_version < 5 && <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
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
          </article>;
        })}
      </div>
      {simulation.alert_thresholds && <details className="training-live-card__details mt-3">
        <summary>Ngưỡng cảnh báo mô phỏng BR-R04</summary>
        <p className="pt-3 text-sm text-slate-600">
          Nhịp tim nghỉ &gt; {simulation.alert_thresholds.resting_heart_rate_bpm} bpm · Vận động &gt; {simulation.alert_thresholds.exercise_heart_rate_bpm} bpm ·
          Hồi phục &gt; {simulation.alert_thresholds.recovery_heart_rate_bpm} bpm sau {simulation.alert_thresholds.recovery_rest_minutes} phút nghỉ ·
          Huyết áp tâm thu &gt; {simulation.alert_thresholds.systolic_blood_pressure_mmhg} mmHg ·
          Cường độ cao &gt; {simulation.alert_thresholds.high_intensity_heart_rate_bpm} bpm qua {simulation.alert_thresholds.high_intensity_sustained_samples} mẫu liên tiếp.
        </p>
      </details>}
      {!!simulation.alerts?.length && <div role="alert" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
        <p className="font-semibold">Cảnh báo chỉ số mô phỏng</p>
        <ul className="mt-1 list-inside list-disc space-y-1">{simulation.alerts.map(alert => <li key={alert.code}>{alert.message} ({alert.value} {alert.unit})</li>)}</ul>
      </div>}
      <p className="mt-2 text-xs text-slate-500">Cảnh báo mô phỏng không tự khóa tập; bác sĩ thú y quyết định.</p>
      <div className="training-live-card__phase"><span>PHA TẬP</span><strong>{({Warmup:"Khởi động",Work:"Vận động chính",Cooldown:"Giảm cường độ",Recovery:"Hồi phục"} as Record<string,string>)[phase] ?? "Đang tải"}</strong>{simulation.distance_meters > 0 && <span>Đích đến {simulation.distance_meters.toLocaleString("vi-VN")} m</span>}</div>
      {simulation.status === "Running" && <p className="mt-3 text-sm text-slate-500">Có thể tải lại trang để tiếp tục theo dõi. Hủy lịch tại tab Lịch tập sẽ dừng giả lập và giữ dữ liệu đã thu.</p>}
      <details className="training-live-card__details"><summary>Biểu đồ cảm biến</summary><div className="pt-4"><SensorTimeline readings={readings}/></div></details>
      {simulation.stop_reason && <Notice>Buổi tập đã dừng: {simulation.stop_reason}</Notice>}
      {simulation.recovery_heart_rate != null && <p className="mt-3 text-sm">Nhịp tim mô phỏng sau 15 phút nghỉ: {simulation.recovery_heart_rate} bpm · Điểm hồi phục ước tính: {simulation.stamina_score ?? "—"}/10</p>}
      {simulation.actual_distance_meters != null && <p className="mt-3">Cự ly thực hiện: {Number(simulation.actual_distance_meters).toFixed(1)} m</p>}
      {finishFailed && <button type="button" className="soft-button mt-3" onClick={onRetryFinish} disabled={busy}>Thử lưu kết quả lại</button>}
      {(ranking.length > 0 || simulation.status === "Completed") && <Notice>Đã hoàn tất buổi tập và lưu chỉ số vào biểu đồ phân tích.</Notice>}
    </section>}
    <Section title="Chuẩn bị buổi tập mô phỏng" help="Chọn tối đa 5 buổi đã có lịch, Groom và đang trong khung giờ tập để mô phỏng riêng hoặc theo nhóm." icon={Play}>
      <form onSubmit={onStart} className="training-start-form">
        {error && <div className="mb-2"><Notice error>{error}</Notice></div>}
        {notice && <div className="mb-2"><Notice>{notice}</Notice></div>}
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

function Section({ title, description, help, icon: Icon, children, action }: { title: string; description?: string; help?: string; icon: typeof Activity; children: ReactNode; action?: ReactNode }) {
  return <section className="rounded-lg border border-equine-line bg-white p-4 shadow-sm sm:p-5"><div className="mb-4 flex flex-col gap-3 border-b border-equine-line pb-4 sm:flex-row sm:items-start sm:justify-between"><div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-equine-mist text-equine-navy"><Icon size={19} /></span><div><div className="flex items-center gap-2"><h3 className="font-sans text-lg font-semibold text-equine-navy">{title}</h3>{help && <details className="relative text-slate-500"><summary className="grid h-8 w-8 cursor-pointer list-none place-items-center rounded-md hover:bg-slate-100" aria-label={`Giải thích ${title}`} title={`Giải thích ${title}`}><CircleHelp size={16} /></summary><p className="absolute left-0 z-20 mt-1 w-64 max-w-[70vw] rounded-md border border-equine-line bg-white p-3 text-xs leading-5 text-slate-700 shadow-lg">{help}</p></details>}</div>{description && <p className="mt-1 text-sm text-slate-500">{description}</p>}</div></div>{action}</div>{children}</section>;
}

function StatCard({ icon: Icon, label, value, warning = false }: { icon: typeof Activity; label: string; value: string; warning?: boolean }) {
  return <article className={`rounded-lg border p-4 ${warning ? "border-rose-200 bg-rose-50" : "border-equine-line bg-white"}`}><Icon className={warning ? "text-rose-700" : "text-equine-teal"} size={18} /><p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-2xl font-semibold text-equine-navy">{value}</p></article>;
}

function Field({ label, name, type = "text", required = false, defaultValue, value, onChange, maxLength, min, max, step, placeholder, pattern, inputMode, title }: {
  label: string; name: string; type?: string; required?: boolean; defaultValue?: string | number | null;
  value?: string | number; onChange?: (value: string) => void; maxLength?: number; min?: string | number; max?: string | number; step?: string; placeholder?: string;
  pattern?: string; inputMode?: "numeric" | "text" | "decimal" | "search" | "tel" | "url" | "email"; title?: string;
}) {
  const inputType = name === "start_time" || name === "end_time" ? "time" : type;
  return <label className="block"><span className="field-label">{label}{required && <span className="text-rose-600"> *</span>}</span><input name={name} type={inputType} required={required} maxLength={maxLength} min={min} max={max} step={step} pattern={pattern} inputMode={inputMode} title={title} value={value} defaultValue={value === undefined ? defaultValue ?? "" : undefined} onChange={onChange ? (event) => onChange(event.target.value) : undefined} placeholder={placeholder} className="field-control px-3" /></label>;
}

function SelectField({ label, name, options, value, defaultValue, onChange, required=false }: {
  required?: boolean; label: string; name: string; options: [string, string][]; value?: string; defaultValue?: string; onChange?: (value: string) => void;
}) {
  return <label className="block"><span className="field-label">{label}</span><select required={required} name={name} value={value} defaultValue={value === undefined ? defaultValue : undefined} onChange={onChange ? (event) => onChange(event.target.value) : undefined} className="field-control px-3">{options.map(([optionValue, text]) => <option key={optionValue} value={optionValue}>{text}</option>)}</select></label>;
}

function TextArea({ label, name, required = false, defaultValue, rows = 3 }: { label: string; name: string; required?: boolean; defaultValue?: string | null; rows?: number }) {
  return <label className="block"><span className="field-label">{label}</span><textarea name={name} required={required} defaultValue={defaultValue ?? ""} rows={rows} className="field-control px-3 py-2" /></label>;
}
