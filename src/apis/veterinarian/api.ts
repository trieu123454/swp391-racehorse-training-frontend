import { ApiRequestError, authenticatedRequest } from "@/api/client";
import { broadcastWorkspaceSync } from "@/apis/horses/api";

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
  box_type?: "Normal" | "Quarantine" | "Injury";
} | null;

export type VetHorse = {
  id: string;
  horse_name: string;
  image_url: string | null;
  image_signed_url?: string | null;
  breed?: string | null;
  microchip_number?: string | null;
  passport_number?: string | null;
  current_status: string;
  readiness_status: "Ready" | "NotReady" | "Unknown";
  is_training_locked: boolean;
  lock_level: string | null;
  lock_reason: string | null;
  stable_box: StableBox;
};

export type HealthOverview = {
  counts: Record<string, number>;
  horses: VetHorse[];
  stables?: {
    id: string;
    box_code: string;
    section: string;
    box_type: "Normal" | "Quarantine" | "Injury";
    capacity: number;
    status: string;
    occupied: number;
  }[];
};

export type HealthExam = {
  id: string;
  horse_id: string;
  exam_date: string;
  exam_type?: string | null;
  conclusion?: string | null;
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
  injury_group?: "Muscle" | "Bone" | "Joint" | "SoftTissue";
  suggest_lock?: boolean;
  training_locked?: boolean;
};

export type InjuryTimelineStatus = "New" | "Treatment" | "Recovering" | "Recovered";
export type InjuryTimelineEntry = {
  id?: string;
  date: string;
  status: InjuryTimelineStatus;
  note: string | null;
  updated_by?: number | string | null;
};

export type VetStableIncident = {
  id: string; horse_id: string; horse_name: string; current_status: string; readiness_status: string;
  box_code: string | null; section: string | null; groom_id: number | null; groom_name: string | null;
  issue_description: string; image_url: string | null; status: string; is_emergency: boolean;
  assigned_to: number | null; assigned_role: string | null; assignee_name: string | null;
  assignment_note: string | null; result_note: string | null; assigned_to_me: boolean;
  created_at: string; assigned_at: string | null; result_at: string | null; resolved_at: string | null;
};

export type CareEvent = {
  id?: string;
  event_id?: string;
  horse_id?: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  status: "Scheduled" | "Completed" | "Cancelled" | string;
  event_type?: string;
  care_type?: string;
  title?: string;
  horse_name?: string;
  box_code?: string | null;
  section?: string | null;
  session_type?: string | null;
  track_surface?: string | null;
  plan_stage_name?: string | null;
  target_distance_meters?: number | null;
  target_intensity?: string | null;
  groom_name?: string | null;
  context?: boolean;
  horse?: { id: string; horse_name: string };
  schedule_id?: string;
  assigned_doctor?: { id?: number | string | null; name?: string | null } | null;
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
  doctor_name?: string | null;
  assigned_doctor?: { id?: number | string | null; name?: string | null } | null;
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
  if (error instanceof ApiRequestError) {
    const details = error.details as { injury_markers?: { id: string; body_part: string; recovery_status: string; marked_at: string }[]; required_box_type?: string } | undefined;
    if (error.code === "ACTIVE_INJURY_MARKER") {
      const positions = Array.isArray(details?.injury_markers) ? details.injury_markers.map((marker) =>
        `${marker.body_part} (${marker.recovery_status}; ${marker.marked_at}; ID: ${marker.id})`).join("; ") : "";
      return `${error.message}${positions ? ` Vị trí chưa hồi phục: ${positions}.` : ""} Kiểm tra từng vị trí chưa hồi phục trong mục Chấn thương; chỉ cập nhật Đã hồi phục sau khi đánh giá.`;
    }
    if (error.code === "NO_MEDICAL_STABLE_AVAILABLE") {
      return `${error.message}${details?.required_box_type ? ` Loại chuồng thiếu: ${details.required_box_type}.` : ""} Nhờ quản lý câu lạc bộ bố trí chuồng phù hợp rồi lưu lại. Trạng thái sức khỏe chưa được thay đổi.`;
    }
  }
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

function notifyHorseHealthChanged(horseId?: string) {
  if (typeof broadcastWorkspaceSync === "function") {
    broadcastWorkspaceSync("horse-health", horseId);
  }
}

let workloadEndpointUnavailable = false;

export const veterinarianApi = {
  overview(section?: string) {
    const query = queryString({ section });
    return call<HealthOverview>(`/api/vet/health-overview${query ? `?${query}` : ""}`);
  },
  incidents(status = "Open") {
    return call<{ status: string; data: VetStableIncident[] }>(`/api/vet/stable-incidents?status=${encodeURIComponent(status)}`);
  },
  claimEmergencyIncident(id: string) {
    return call<{ id: string; status: string }>(`/api/vet/stable-incidents/${encodeURIComponent(id)}/claim`, "PATCH");
  },
  submitIncidentResult(id: string, result_note: string) {
    return call<{ id: string; status: string; result_note: string }>(
      `/api/vet/stable-incidents/${encodeURIComponent(id)}/result`, "PATCH", { result_note },
    );
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
  async injuries(horse: string, latest = false) {
    const fetchPage = (page: number) => authenticatedRequest<ApiPage<InjuryMarker>>(
      `/api/horses/${horse}/injury-markers?latest_only=${latest}&page=${page}&limit=100`, { cache: "no-store" });
    const first = await fetchPage(1);
    const data = [...first.data];
    for (let page = 2; page <= Math.ceil(first.total / (first.limit || 100)); page++) {
      data.push(...(await fetchPage(page)).data);
    }
    return { ...first, data };
  },
  createInjury(horse: string, input: Record<string, unknown>) {
    const { marked_at, marked_by, ...body } = input;
    void marked_at; void marked_by;
    return call<InjuryMarker>(`/api/horses/${horse}/injury-markers`, "POST", body)
      .then((res) => { notifyHorseHealthChanged(horse); return res; });
  },
  updateInjury(id: string, input: Record<string, unknown>) {
    const { marked_at, marked_by, ...body } = input;
    void marked_at; void marked_by;
    return call<InjuryMarker>(`/api/injury-markers/${id}`, "PATCH", body)
      .then((res) => { notifyHorseHealthChanged(); return res; });
  },
  updateHealthStatus(horse: string, current_status: string, readiness_status: string, note?: string) {
    return call<{
      id: string;
      current_status: string;
      readiness_status: string;
      is_training_locked: boolean;
      upcoming_sessions: { training_schedule_id: string; event_date: string; start_time?: string; session_type: string }[];
      stable_relocation?: { from_box_code?: string; to_box_code?: string; box_type: string; message: string } | null;
    }>(`/api/horses/${horse}/health-status`, "PATCH", { current_status, readiness_status, note })
      .then((res) => { notifyHorseHealthChanged(horse); return res; });
  },
  lockTraining(horse: string, input: { lock_level: string; lock_reason: string }) {
    return call<{ id: string; is_training_locked: boolean; was_locked: boolean; upcoming_sessions: unknown[] }>(`/api/horses/${horse}/training-lock`, "PUT", input)
      .then((res) => { notifyHorseHealthChanged(horse); return res; });
  },
  unlockTraining(horse: string, reason: string) {
    return call<{ id: string; is_training_locked: boolean; suggest_status_update: boolean }>(`/api/horses/${horse}/training-unlock`, "POST", { reason })
      .then((res) => { notifyHorseHealthChanged(horse); return res; });
  },
  schedules(horse?: string) {
    const query = queryString({ horse_id: horse, page: 1, limit: 100 });
    return call<ApiPage<CareSchedule>>(`/api/periodic-care-schedules?${query}`);
  },
  async allSchedules(horse?: string) {
    const first = await veterinarianApi.schedules(horse);
    if (!Array.isArray(first.data)) throw new Error("Dữ liệu lịch chăm sóc không hợp lệ.");
    const data = [...first.data];
    const limit = first.limit || 100;
    const pageCount = Math.ceil(first.total / limit);
    for (let start = 2; start <= pageCount; start += 4) {
      const pages = await Promise.all(Array.from({ length: Math.min(4, pageCount - start + 1) }, (_, index) =>
        call<ApiPage<CareSchedule>>(`/api/periodic-care-schedules?${queryString({ horse_id: horse, page: start + index, limit })}`),
      ));
      for (const result of pages) {
        if (!Array.isArray(result.data)) throw new Error("Dữ liệu lịch chăm sóc không hợp lệ.");
        data.push(...result.data);
      }
    }
    return { ...first, data };
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
  veterinarians() {
    return call<{ id: number | string; name: string; email: string; role_name?: string }[]>("/api/veterinarians");
  },
  async workloads() {
    type Workload = {
      id: number | string;
      name: string;
      email: string;
      role_name?: string;
      total_schedules: number;
      overdue_count: number;
      today_count: number;
    };
    if (!workloadEndpointUnavailable) {
      try {
        const response = await call<Workload[] | { data: Workload[] } | { items: Workload[] }>("/api/veterinarian/workload");
        const items = Array.isArray(response) ? response : response && ("data" in response ? response.data : "items" in response ? response.items : undefined);
        if (!Array.isArray(items)) throw new Error("Dữ liệu tải công việc bác sĩ không hợp lệ.");
        return items;
      } catch (error) {
        if (!(error instanceof ApiRequestError) || error.status !== 404) throw error;
        workloadEndpointUnavailable = true;
      }
    }

    // Older backends have no workload endpoint. Count the complete schedule list
    // by assigned doctor instead; never substitute invented doctor statistics.
    const [doctors, firstPage] = await Promise.all([
      veterinarianApi.veterinarians(),
      veterinarianApi.schedules(),
    ]);
    if (!Array.isArray(doctors) || !Array.isArray(firstPage.data)) {
      throw new Error("Dữ liệu phân bổ công việc bác sĩ không hợp lệ.");
    }
    const schedules = [...firstPage.data];
    const pageSize = firstPage.limit || 100;
    const pageCount = Math.ceil(firstPage.total / pageSize);
    for (let page = 2; page <= pageCount; page++) {
      const result = await call<ApiPage<CareSchedule>>(`/api/periodic-care-schedules?${queryString({ page, limit: pageSize })}`);
      if (!Array.isArray(result.data)) throw new Error("Dữ liệu lịch chăm sóc không hợp lệ.");
      schedules.push(...result.data);
    }
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    return doctors.map((doctor): Workload => {
      const assigned = schedules.filter((schedule) => {
        const doctorId = schedule.assigned_doctor_id ?? schedule.assigned_doctor?.id;
        return doctorId != null && String(doctorId) === String(doctor.id)
          && (Boolean(schedule.frequency_days) || !["Completed", "Cancelled"].includes(schedule.event_status ?? ""));
      });
      return {
        ...doctor,
        total_schedules: assigned.length,
        today_count: assigned.filter((schedule) => (schedule.event?.event_date ?? schedule.next_due_date) === today && !["Completed", "Cancelled"].includes(schedule.event_status ?? "")).length,
        overdue_count: assigned.filter((schedule) => {
          const endTime = schedule.event?.end_time?.slice(0, 5);
          return Boolean(schedule.is_overdue) || schedule.next_due_date < today
            || (schedule.next_due_date === today && Boolean(endTime && time > endTime) && schedule.event_status === "Scheduled");
        }).length,
      };
    });
  },
  reassignSchedule(id: string, assignedDoctorId: number | string | null) {
    return call<CareSchedule>(`/api/periodic-care-schedules/${id}/reassign`, "PATCH", {
      assigned_doctor_id: assignedDoctorId,
    });
  },
};

export function fieldError(error: unknown) {
  return error instanceof ApiRequestError ? error.message : veterinarianError(error);
}
