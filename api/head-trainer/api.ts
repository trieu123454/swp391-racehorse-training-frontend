import { authenticatedRequest } from "@/api/client";

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
  horse_id: string | null;
  horse_ids?: string[];
  horse_names?: string | null;
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
  variance_profile?: string;
};

export type SensorReading = { elapsed_seconds: number; speed_kmh: number; heart_rate: number; bp_systolic: number; bp_diastolic: number };
export type TrainingAnalysisSession = {
  simulation_attempts?: {id:string;status:string;stop_reason?:string|null}[];
  id: string; event_date: string; start_time?: string; session_type: string; effective_status: string;
  snapshot_stage_name?: string | null; track_surface?: string | null; groom_name?: string | null;
  target_distance_meters?: number | null; actual_distance_meters?: number | null;
  avg_speed_kmh?: number | null; max_heart_rate?: number | null; recovery_heart_rate?: number | null;
  estimated_stamina_score?: number | null; distance_achievement_percent?: number | null;
  speed_change_kmh?: number | null; recovery_change_bpm?: number | null;
  simulation_id?: string | null; stop_reason?: string | null; recommendation: string; trainer_review?: string | null;
};
export type TrainingAnalysis = {
  weeks: {week_start:string;target_minutes:number;planned_minutes:number;actual_minutes:number;workload_achievement_percent:number|null;completed:number;missed:number;cancelled:number;rest:number}[];
  sessions: TrainingAnalysisSession[]; trial_runs: TrainingAnalysisSession[];
};

export type Simulation = {
  simulation_id: string;
  elapsed_seconds: number;
  actual_distance_meters?: number | null;
  target_intensity?: string;
  readings?: SensorReading[];
  phase?: string;
  recovery_heart_rate?: number | null;
  stamina_score?: number | null;
  stop_reason?: string | null;
  scenario?: string;
  model_version?: number;
  track_surface?: string | null;
  distance_meters: number;
  duration_seconds: number;
  training_schedule_id?: string | null;
  injury_alert_heart_rate: number;
  injury_alert_speed_kmh: number;
  status: string;
  horses: SimulationHorse[];
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
  overview(includeSimulated = true) {
    return call<{ data: TrainerHorse[] }>(`/api/head-trainer/overview?include_simulated=${includeSimulated}`);
  },
  metrics(horseId: string, from?: string, to?: string, includeSimulated = true) {
    const params = query({ from, to, include_simulated: includeSimulated });
    return call<TrainingMetric[]>(`/api/horses/${horseId}/training-metrics?${params}`);
  },
  compare(horseIds: string[], from?: string, to?: string, includeSimulated = true) {
    const params = query({ horse_ids: horseIds.join(","), from, to, include_simulated: includeSimulated });
    return call<{ horses: { horse_id: string; horse_name: string; metrics: TrainingMetric[] }[] }>(`/api/head-trainer/training-metrics/compare?${params}`);
  },
  plans(horseId: string, activeOnly = false) {
    return call<{ data: TrainingPlan[] }>(`/api/horses/${horseId}/training-plans?active_only=${activeOnly}`);
  },
  createPlan(input: Record<string, unknown>) {
    return call<TrainingPlan>("/api/training-plans", "POST", input);
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
  analysis(horseId: string, from: string, to: string) {
    return call<TrainingAnalysis>(`/api/horses/${horseId}/training-analysis?${query({from,to})}`);
  },
  createSimulation(input: { horse_ids: string[]; training_schedule_id: string; scenario?: string }) {
    return call<Simulation>("/api/head-trainer/race-simulations", "POST", input);
  },
  activeSimulation() {
    return call<Simulation | Record<string, never>>("/api/head-trainer/race-simulations/active");
  },
  activeSimulations() {
    return call<{ data: Simulation[] }>("/api/head-trainer/race-simulations/active-sessions");
  },
  createSimulationGroup(sessions: { horse_ids: string[]; training_schedule_id: string; scenario?: string }[]) {
    return call<{ data: Simulation[] }>("/api/head-trainer/race-simulations/group", "POST", { sessions });
  },
  simulation(id: string) {
    return call<Simulation>(`/api/head-trainer/race-simulations/${id}`);
  },
  restartSimulation(id: string) {
    return call<Simulation>(`/api/head-trainer/race-simulations/${id}/restart`, "POST", {});
  },
  finishSimulation(id: string) {
    return call<{ simulation_id: string; race_id: string | null; race_name: string; status: string; ranking: { rank: number; horse_id: string; horse_name: string; finish_time_seconds: number }[] }>(
      `/api/head-trainer/race-simulations/${id}/finish`, "POST", {},
    );
  },
};

export function headTrainerError(error: unknown) {
  return error instanceof Error ? error.message : "Không thể kết nối máy chủ. Vui lòng thử lại.";
}
