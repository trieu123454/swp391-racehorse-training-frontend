import { authenticatedRequest } from "@/lib/api";

export type GroomHorse = {
  id: string;
  horse_name: string;
  image_url: string | null;
  current_status: string;
  is_training_locked: boolean;
  stable_box: { box_code: string; section: string | null } | null;
};

export type GroomCalendarHorse = Pick<GroomHorse, "id" | "horse_name">;

export type GroomCalendarEvent =
  | {
      type: "training";
      training_schedule_id: string;
      event_id: string;
      event_date: string;
      start_time: string | null;
      end_time: string | null;
      status: string;
      session_type: string;
      sensor_running?: boolean;
      horse: GroomCalendarHorse;
      note: string | null;
    }
  | {
      type: "care_task";
      task_id: string;
      horse: GroomCalendarHorse;
      task_type: string;
      status: string;
    };

export type GroomCalendar = { date: string; events: GroomCalendarEvent[] };

export type GroomDietRecord = {
  id: string; horse_id: string; feed_type: string; quantity_kg: number;
  feeding_frequency: string | null; special_instructions: string | null;
  effective_date: string | null; end_date: string | null;
};
export type GroomInventoryItem = {
  id: string; item_name: string; category: string | null; unit: string | null;
  quantity_in_stock: number; reorder_threshold: number | null; is_low_stock: boolean;
};
export type GroomIncident = {
  id: string; horse_id: string; horse_name: string; issue_description: string;
  image_url: string | null; status: string; created_at: string; is_emergency: boolean;
  assigned_to: number | null; assigned_role: string | null; assignee_name: string | null;
  assignment_note: string | null; result_note: string | null; assigned_at: string | null; result_at: string | null;
  assigned_to_me: boolean;
};
export type GroomSupplyRequest = {
  id: string; item_id: string; item_name: string; quantity_requested: number;
  reason: string | null; status: string; created_at: string; reviewed_at: string | null;
};

export function getMyGroomHorses() {
  return authenticatedRequest<{ data: GroomHorse[] }>("/api/groom/my-horses");
}

export function getGroomCalendar(date: string) {
  return authenticatedRequest<GroomCalendar>(`/api/groom/calendar?date=${encodeURIComponent(date)}`);
}

export function getGroomDietRecords(horseId: string, activeOn: string) {
  return authenticatedRequest<{ data: GroomDietRecord[] }>(
    `/api/groom/horses/${encodeURIComponent(horseId)}/diet-records?active_on=${encodeURIComponent(activeOn)}`,
  );
}

export function getGroomInventory() {
  return authenticatedRequest<{ data: GroomInventoryItem[] }>("/api/groom/inventory");
}

export function getGroomIncidents() {
  return authenticatedRequest<{ data: GroomIncident[] }>("/api/groom/incidents");
}

export function getGroomSupplyRequests() {
  return authenticatedRequest<{ data: GroomSupplyRequest[] }>("/api/groom/supply-requests");
}

export function createGroomSupplyRequest(input: { item_id: string; quantity_requested: number; reason?: string }) {
  return authenticatedRequest<GroomSupplyRequest>("/api/groom/supply-requests", {
    method: "POST", body: JSON.stringify(input),
  });
}

export function completeGroomTask(id: string) {
  return authenticatedRequest<{ id: string; status: string; completed_at: string | null; already_completed?: boolean }>(
    `/api/groom/daily-tasks/${encodeURIComponent(id)}/complete`,
    { method: "PATCH" },
  );
}

export function completeGroomTrainingSession(id: string) {
  return authenticatedRequest<{ id: string; status: string; already_completed?: boolean }>(
    `/api/groom/training-schedules/${encodeURIComponent(id)}/complete`,
    { method: "PATCH" },
  );
}

export function reportGroomIncident(horseId: string, issue_description: string, image_url?: string, is_emergency = false) {
  return authenticatedRequest<Record<string, unknown>>(
    `/api/groom/horses/${encodeURIComponent(horseId)}/incidents`,
    {
      method: "POST",
      body: JSON.stringify({ issue_description, image_url: image_url || null, is_emergency }),
    },
  );
}

export function submitGroomIncidentResult(id: string, result_note: string) {
  return authenticatedRequest<{ id: string; status: string; result_note: string }>(
    `/api/groom/incidents/${encodeURIComponent(id)}/result`,
    { method: "PATCH", body: JSON.stringify({ result_note }) },
  );
}

export function uploadGroomIncidentImage(file: File) {
  const body = new FormData();
  body.append("file", file);
  return authenticatedRequest<{ imagePath: string }>("/api/groom/incidents/images", {
    method: "POST",
    body,
  });
}
