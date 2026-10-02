import { authenticatedRequest } from "@/lib/api";

export type TrainingMetric = {
  id?: string;
  horse_id: string;
  training_schedule_id?: string | null;
  recorded_at: string;
  body_weight_kg: number | null;
  max_heart_rate: number | null;
  avg_speed_kmh: number | null;
  stamina_score: number | null;
  has_injury_alert: boolean;
  trainer_review?: string | null;
  bp_systolic?: number | null;
  bp_diastolic?: number | null;
  is_simulated?: boolean;
};

export type TrainingPlan = {
  id: string;
  horse_id: string;
  stage_name: string;
  start_date: string | null;
  end_date: string | null;
  objective: string | null;
  target_distance_meters: number | null;
  target_workload_minutes: number | null;
  target_track_surface: string | null;
  target_intensity: "Low" | "Medium" | "High" | null;
  update_deadline_hours: number;
  is_active: boolean;
  training_schedules_count: number;
};

export type TrainingSession = {
  id: string;
  training_schedule_id: string;
  calendar_event_id: string;
  event_id: string;
  horse_id: string;
  horse_name: string;
  image_url?: string | null;
  training_plan_id?: string | null;
  plan_stage_name?: string | null;
  plan_objective?: string | null;
  plan_target_distance_meters?: number | null;
  plan_target_workload_minutes?: number | null;
  plan_target_track_surface?: string | null;
  plan_target_intensity?: "Low" | "Medium" | "High" | null;
  session_type: "Training" | "TrialRun" | "Rest";
  track_surface?: string | null;
  event_date: string;
  start_time?: string | null;
  end_time?: string | null;
  status: string;
  event_status?: string;
  notes?: string | null;
  assigned_groom_id?: number | null;
  groom_name?: string | null;
  metrics?: TrainingMetric[];
};

export type TrainerIncident = {
  id: string;
  horse_id: string;
  horse_name: string;
  groom_name: string | null;
  issue_description: string;
  image_url: string | null;
  is_emergency: boolean;
  status: string;
  assigned_to: number;
  assigned_role: string;
  assignee_name: string | null;
  assignment_note: string | null;
  result_note: string | null;
  created_at: string;
  assigned_at: string | null;
  result_at: string | null;
  assigned_to_me: boolean;
};

export type TrainerHorse = {
  horse_id: string;
  horse_name: string;
  image_url?: string | null;
  is_training_locked: boolean;
  lock_level?: string | null;
  lock_reason?: string | null;
  recorded_at?: string | null;
  body_weight_kg?: number | null;
  max_heart_rate?: number | null;
  avg_speed_kmh?: number | null;
  stamina_score?: number | null;
  has_injury_alert?: boolean;
  trend?: Record<string, { direction: string; change: number | null }>;
};

export type RaceOption = {
  id: string;
  race_name: string;
  race_date: string;
  location?: string | null;
  distance_meters?: number | null;
  grade?: string | null;
};

export type SimulationHorse = {
  horse_id: string;
  horse_name: string;
  image_url?: string | null;
  lane: number;
  seed: number;
  base_max_speed_kmh: number;
  base_resting_heart_rate: number;
  base_resting_bp: { systolic: number; diastolic: number };
  variance_profile: string;
};

export type Simulation = {
  simulation_id: string;
  distance_meters: number;
  duration_seconds: number;
  training_schedule_id?: string | null;
  injury_alert_heart_rate: number;
  injury_alert_speed_kmh: number;
  status: string;
  horses: SimulationHorse[];
};

export type SimulationResult = {
  horse_id: string;
  finish_time_seconds: number;
  avg_speed_kmh: number;
  max_heart_rate: number;
  max_bp_systolic: number;
  max_bp_diastolic: number;
};

type Page<T> = { data: T[]; total: number; page: number; limit: number };

function query(values: Record<string, string | number | boolean | undefined>) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  return params.toString();
}

function call<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  return authenticatedRequest<T>(path, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

export const headTrainerApi = {
  incidents() {
    return call<{ data: TrainerIncident[] }>("/api/head-trainer/stable-incidents");
  },
  submitIncidentResult(id: string, result_note: string) {
    return call<{ id: string; status: string; result_note: string }>(
      `/api/head-trainer/stable-incidents/${encodeURIComponent(id)}/result`,
      "PATCH",
      { result_note },
    );
  },
  overview(includeSimulated = false) {
    return call<{ data: TrainerHorse[] }>(`/api/head-trainer/overview?include_simulated=${includeSimulated}`);
  },
  metrics(horseId: string, from?: string, to?: string, includeSimulated = false) {
    const params = query({ from, to, include_simulated: includeSimulated });
    return call<TrainingMetric[]>(`/api/horses/${horseId}/training-metrics?${params}`);
  },
  compare(horseIds: string[], from?: string, to?: string, includeSimulated = false) {
    const params = query({ horse_ids: horseIds.join(","), from, to, include_simulated: includeSimulated });
    return call<{ horses: { horse_id: string; horse_name: string; metrics: TrainingMetric[] }[] }>(`/api/head-trainer/training-metrics/compare?${params}`);
  },
  plans(horseId: string, activeOnly = false) {
    return call<{ data: TrainingPlan[] }>(`/api/horses/${horseId}/training-plans?active_only=${activeOnly}`);
  },
  createPlan(horseId: string, input: Record<string, unknown>) {
    return call<TrainingPlan>(`/api/horses/${horseId}/training-plans`, "POST", input);
  },
  updatePlan(id: string, input: Record<string, unknown>) {
    return call<TrainingPlan>(`/api/training-plans/${id}`, "PATCH", input);
  },
  deletePlan(id: string) {
    return call<{ id: string; deleted: boolean }>(`/api/training-plans/${id}`, "DELETE");
  },
  createSchedule(horseId: string, input: Record<string, unknown>) {
    return call<TrainingSession>(`/api/horses/${horseId}/training-schedules`, "POST", input);
  },
  calendar(from: string, to: string) {
    const params = query({ from, to, page: 1, limit: 100 });
    return call<Page<TrainingSession>>(`/api/head-trainer/calendar?${params}`);
  },
  grooms() {
    return call<{ data: { user_id: number; full_name: string; email: string }[] }>("/api/head-trainer/grooms");
  },
  assignGroom(id: string, groomId: number) {
    return call<TrainingSession>(`/api/training-schedules/${id}/assign-groom`, "PATCH", { groom_id: groomId });
  },
  schedule(id: string) {
    return call<TrainingSession>(`/api/training-schedules/${id}`);
  },
  updateSchedule(id: string, input: Record<string, unknown>) {
    return call<TrainingSession>(`/api/training-schedules/${id}`, "PATCH", input);
  },
  recordMetrics(id: string, input: Record<string, unknown>) {
    return call<TrainingMetric & { suggest_notify_vet: boolean }>(`/api/training-schedules/${id}/metrics`, "POST", input);
  },
  addTrainingVideo(id: string, input: { video_url: string; description?: string }) {
    return call<Record<string, unknown>>(`/api/training-schedules/${id}/videos`, "POST", input);
  },
  recordRaceResult(id: string, input: { result_position: number; prize_amount: number }) {
    return call<Record<string, unknown>>(`/api/race-entries/${id}/result`, "PATCH", input);
  },
  races(from?: string, to?: string) {
    const params = query({ from, to, page: 1, limit: 100 });
    return call<Page<RaceOption>>(`/api/head-trainer/races?${params}`);
  },
  registerRace(horseId: string, raceId: string) {
    return call<Record<string, unknown>>(`/api/horses/${horseId}/race-entries`, "POST", { race_id: raceId });
  },
  raceEntries(horseId: string) {
    return call<Page<Record<string, unknown>>>(`/api/horses/${horseId}/race-entries?page=1&limit=100`);
  },
  createSimulation(input: { horse_ids: string[]; distance_meters: number; duration_seconds: number; training_schedule_id?: string }) {
    return call<Simulation>("/api/head-trainer/race-simulations", "POST", input);
  },
  finishSimulation(id: string, input: { results: SimulationResult[]; copy_to_metrics?: boolean }) {
    return call<{ simulation_id: string; race_id: string; race_name: string; status: string; ranking: { rank: number; horse_id: string; horse_name: string; finish_time_seconds: number }[] }>(
      `/api/head-trainer/race-simulations/${id}/finish`, "POST", input,
    );
  },
};

function seededNoise(seed: number, progress: number, salt: number) {
  const sample = Math.max(0, Math.min(10000, Math.floor(progress * 1000)));
  let value = (seed ^ salt ^ Math.imul(sample, 0x45d9f3b)) | 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x45d9f3b);
  value ^= value >>> 16;
  return (value & 0x7fffffff) / 0x7fffffff;
}

export function speedFactor(progress: number) {
  const p = Math.max(0, Math.min(1, progress));
  if (p < 0.15) {
    const x = p / 0.15;
    const eased = x < 0.5 ? 2 * x * x : 1 - ((-2 * x + 2) ** 2) / 2;
    return 0.93 * eased;
  }
  if (p < 0.8) return 0.94 + 0.035 * Math.sin(((p - 0.15) / 0.65) * Math.PI);
  return 0.975 - 0.105 * ((p - 0.8) / 0.2);
}

export function simulatedVitals(horse: SimulationHorse, progress: number) {
  const ratioNoise = (seededNoise(horse.seed, progress, 0) - 0.5) * 0.03;
  const speed = Math.max(0, horse.base_max_speed_kmh * (speedFactor(progress) + ratioNoise));
  const ratio = horse.base_max_speed_kmh <= 0 ? 0 : speed / horse.base_max_speed_kmh;
  const heartRate = Math.round(Math.max(horse.base_resting_heart_rate, Math.min(230,
    horse.base_resting_heart_rate + (220 - horse.base_resting_heart_rate) * ratio * 0.7
      + (seededNoise(horse.seed, progress, 0x4f1bbcdc) - 0.5) * 7)));
  const systolic = Math.round(Math.max(40, Math.min(300, horse.base_resting_bp.systolic + ratio * 40
    + (seededNoise(horse.seed, progress, 0x7a143589) - 0.5) * 8)));
  const diastolic = Math.round(Math.max(60, Math.min(90, horse.base_resting_bp.diastolic
    + 3 * Math.sin(Math.max(0, Math.min(1, progress)) * Math.PI * 2)
    + (seededNoise(horse.seed, progress, 0x1b873593) - 0.5) * 6)));
  return { speed, heartRate, systolic, diastolic };
}

export function racePosition(horse: SimulationHorse, progress: number) {
  const p = Math.max(0, Math.min(1, progress));
  if (p === 0) return 0;
  let traveled = 0;
  let total = 0;
  const samples = 80;
  for (let index = 1; index <= samples; index += 1) {
    const sampleProgress = index / samples;
    const speed = simulatedVitals(horse, sampleProgress).speed;
    total += speed;
    if (sampleProgress <= p) traveled += speed;
  }
  return total === 0 ? p : traveled / total;
}

export function headTrainerError(error: unknown) {
  return error instanceof Error ? error.message : "Không thể kết nối máy chủ. Vui lòng thử lại.";
}
