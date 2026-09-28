import { ApiRequestError, authenticatedRequest } from "./api";

export type ApiPage<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
};

export type VetPerson = { id: number | string; name: string | null };
export type StableBox = {
  id: string;
  box_code: string;
  section: string;
} | null;

export type VetHorse = {
  id: string;
  horse_name: string;
  image_url: string | null;
  current_status: string;
  is_training_locked: boolean;
  lock_level: string | null;
  lock_reason: string | null;
  stable_box: StableBox;
};

export type HealthOverview = {
  counts: Record<string, number>;
  horses: VetHorse[];
};

export type HealthExam = {
  id: string;
  horse_id: string;
  exam_date: string;
  doctor_id?: number;
  doctor?: VetPerson | null;
  temperature_c: number | string | null;
  heart_rate: number | null;
  respiratory_rate: number | null;
  mucous_membrane_color?: string | null;
  capillary_refill_sec?: number | string | null;
  skin_turgor?: string | null;
  jugular_pulse?: string | null;
  digital_pulse?: string | null;
  gut_sounds?: string | null;
  defecation_frequency?: string | null;
  urination_frequency?: string | null;
  body_condition_score?: number | string | null;
  hoof_temperature?: string | null;
  gait_assessment?: string | null;
  hematology_result?: string | null;
  biochemistry_result?: string | null;
  fecal_test_result?: string | null;
  notes?: string | null;
  has_edits?: boolean;
  alerts?: { field: string; value: number; normal_range: string; level: string }[];
  suggest_medical_record?: boolean;
  last_edited_at?: string | null;
  last_edited_by?: VetPerson | null;
};

export type HealthExamLog = {
  id: string;
  edited_at: string;
  edited_by: VetPerson | null;
  changes: { field: string; old_value: unknown; new_value: unknown }[];
};

export type MedicalRecord = {
  id: string;
  horse_id: string;
  health_exam_id: string | null;
  diagnosis: string;
  treatment_plan: string | null;
  created_at: string;
  prescriptions?: Prescription[];
  injury_markers?: InjuryMarker[];
};

export type Prescription = {
  id: string;
  horse_id: string;
  medical_record_id: string | null;
  drug_name: string;
  dosage: string | null;
  frequency: string | null;
  route: string | null;
  start_date: string | null;
  end_date: string | null;
  status: "Active" | "Completed" | "Stopped";
  notes: string | null;
  warnings?: { code: string; prescriptions: Prescription[] }[];
};

export type DietRecord = {
  id: string;
  horse_id: string;
  feed_type: string;
  quantity_kg: number | string;
  feeding_frequency: string | null;
  special_instructions: string | null;
  effective_date: string | null;
  end_date: string | null;
};

export type InjuryMarker = {
  id: string;
  horse_id: string;
  medical_record_id: string | null;
  body_part: string;
  coordinate_x: number | string | null;
  coordinate_y: number | string | null;
  coordinate_z: number | string | null;
  severity: "Mild" | "Moderate" | "Severe";
  recovery_status: "Active" | "Recovering" | "Recovered";
  description: string | null;
  marked_at: string;
  marked_by?: number | null;
  suggest_lock?: boolean;
};

export type CareEvent = {
  id?: string;
  event_id?: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  status: "Scheduled" | "Completed" | "Cancelled";
  event_type?: string;
  care_type?: string;
  title?: string;
  horse_name?: string;
  context?: boolean;
  horse?: { id: string; horse_name: string };
  schedule_id?: string;
};

export type CareSchedule = {
  id: string;
  horse_id: string;
  horse_name?: string;
  care_type: string;
  frequency_days: number | null;
  last_done_date: string | null;
  next_due_date: string;
  assigned_doctor_id: number | null;
  notes: string | null;
  calendar_event_id: string | null;
  is_overdue?: boolean;
  event?: CareEvent | null;
  event_status?: string | null;
};

export type CareCalendar = ApiPage<CareEvent> & {
  context_events?: CareEvent[];
  context_total?: number;
};

export type AppNotification = {
  id: string;
  message: string;
  is_read: boolean;
  scheduled_at: string | null;
  created_at: string;
  related_table: string | null;
  related_id: string | null;
};

export type HealthExamInput = {
  exam_date?: string;
  temperature_c: number;
  heart_rate: number;
  respiratory_rate: number;
  mucous_membrane_color?: string;
  capillary_refill_sec?: number;
  skin_turgor?: string;
  jugular_pulse?: string;
  digital_pulse?: string;
  gut_sounds?: string;
  defecation_frequency?: string;
  urination_frequency?: string;
  body_condition_score?: number;
  hoof_temperature?: string;
  gait_assessment?: string;
  hematology_result?: string;
  biochemistry_result?: string;
  fecal_test_result?: string;
  notes?: string;
};

const queryString = (params: Record<string, string | number | boolean | undefined>) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  });
  return query.toString();
};

export function veterinarianError(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Không thể kết nối máy chủ. Vui lòng thử lại.";
}

function call<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  return authenticatedRequest<T>(path, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

export const veterinarianApi = {
  overview(section?: string) {
    const query = queryString({ section });
    return call<HealthOverview>(`/api/vet/health-overview${query ? `?${query}` : ""}`);
  },
  exams(horse: string, page = 1) {
    return call<ApiPage<HealthExam>>(`/api/horses/${horse}/health-exams?page=${page}&limit=20`);
  },
  exam(id: string) {
    return call<HealthExam>(`/api/health-exams/${id}`);
  },
  examLogs(id: string, page = 1) {
    return call<ApiPage<HealthExamLog>>(`/api/health-exams/${id}/logs?page=${page}&limit=20`);
  },
  createExam(horse: string, input: HealthExamInput) {
    return call<HealthExam>(`/api/horses/${horse}/health-exams`, "POST", input);
  },
  updateExam(id: string, input: Partial<HealthExamInput>) {
    return call<{ changed: boolean; exam?: HealthExam; alerts?: HealthExam["alerts"] }>(`/api/health-exams/${id}`, "PATCH", input);
  },
  records(horse: string, page = 1) {
    return call<ApiPage<MedicalRecord>>(`/api/horses/${horse}/medical-records?page=${page}&limit=100`);
  },
  record(id: string) {
    return call<MedicalRecord>(`/api/medical-records/${id}`);
  },
  createRecord(horse: string, input: { health_exam_id?: string; diagnosis: string; treatment_plan?: string }) {
    return call<MedicalRecord>(`/api/horses/${horse}/medical-records`, "POST", input);
  },
  updateRecord(id: string, input: { diagnosis?: string; treatment_plan?: string }) {
    return call<MedicalRecord>(`/api/medical-records/${id}`, "PATCH", input);
  },
  createPrescription(record: string, input: Record<string, unknown>) {
    return call<Prescription>(`/api/medical-records/${record}/prescriptions`, "POST", input);
  },
  prescriptions(horse: string, page = 1) {
    return call<ApiPage<Prescription>>(`/api/horses/${horse}/prescriptions?page=${page}&limit=100`);
  },
  updatePrescription(id: string, input: Partial<Prescription>) {
    return call<Prescription>(`/api/prescriptions/${id}`, "PATCH", input);
  },
  diets(horse: string, includeHistory = true, activeOn?: string) {
    const query = queryString({ include_history: includeHistory, active_on: includeHistory ? undefined : activeOn, page: 1, limit: 100 });
    return call<ApiPage<DietRecord>>(`/api/horses/${horse}/diet-records?${query}`);
  },
  createDiet(horse: string, input: Record<string, unknown>) {
    return call<DietRecord>(`/api/horses/${horse}/diet-records`, "POST", input);
  },
  updateDiet(id: string, input: Record<string, unknown>) {
    return call<DietRecord>(`/api/diet-records/${id}`, "PATCH", input);
  },
  injuries(horse: string, latest = false) {
    return call<ApiPage<InjuryMarker>>(`/api/horses/${horse}/injury-markers?latest_only=${latest}&page=1&limit=100`);
  },
  createInjury(horse: string, input: Record<string, unknown>) {
    return call<InjuryMarker>(`/api/horses/${horse}/injury-markers`, "POST", input);
  },
  updateHealthStatus(horse: string, current_status: string, note?: string) {
    return call<{ id: string; current_status: string; suggest_lock: boolean }>(`/api/horses/${horse}/health-status`, "PATCH", { current_status, note });
  },
  lockTraining(horse: string, input: { lock_level: string; lock_reason: string }) {
    return call<{ id: string; is_training_locked: boolean; was_locked: boolean; upcoming_sessions: unknown[] }>(`/api/horses/${horse}/training-lock`, "PUT", input);
  },
  unlockTraining(horse: string, reason: string) {
    return call<{ id: string; is_training_locked: boolean; suggest_status_update: boolean }>(`/api/horses/${horse}/training-unlock`, "POST", { reason });
  },
  schedules(horse?: string) {
    const query = queryString({ horse_id: horse, page: 1, limit: 100 });
    return call<ApiPage<CareSchedule>>(`/api/periodic-care-schedules?${query}`);
  },
  calendar(from: string, to: string, includeContext = false, scope: "mine" | "all" = "mine") {
    const query = queryString({ from, to, scope, include_context: includeContext, page: 1, limit: 100 });
    return call<CareCalendar>(`/api/vet/calendar?${query}`);
  },
  createSchedule(input: Record<string, unknown>) {
    return call<CareSchedule>("/api/periodic-care-schedules", "POST", input);
  },
  bookSchedule(id: string, input: Record<string, unknown>) {
    return call<CareSchedule>(`/api/periodic-care-schedules/${id}/book`, "POST", input);
  },
  moveSchedule(id: string, input: Record<string, unknown>) {
    return call<CareSchedule>(`/api/periodic-care-schedules/${id}/event`, "PATCH", input);
  },
  cancelSchedule(id: string) {
    return call<CareSchedule>(`/api/periodic-care-schedules/${id}/cancel-event`, "POST");
  },
  completeSchedule(id: string, input: Record<string, unknown>) {
    return call<{ schedule: CareSchedule; warnings: { code: string; reason?: string }[] }>(`/api/periodic-care-schedules/${id}/complete`, "POST", input);
  },
  notifications(unreadOnly = false) {
    return call<ApiPage<AppNotification> & { unread_count: number }>(`/api/notifications?unread_only=${unreadOnly}&page=1&limit=100`);
  },
  readNotification(id: string) {
    return call<{ id: string; is_read: boolean }>(`/api/notifications/${id}/read`, "PATCH");
  },
  readAllNotifications() {
    return call<{ updated: number }>("/api/notifications/read-all", "POST");
  },
};

export function fieldError(error: unknown) {
  return error instanceof ApiRequestError ? error.message : veterinarianError(error);
}
