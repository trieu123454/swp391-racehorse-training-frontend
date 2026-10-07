import { authenticatedRequest } from "@/api/client";
import type { Horse } from "@/api/horses/api";

export type OwnerHorse = Horse & {
  current_weight_kg: number | null;
  readiness_status: string;
  box_code: string | null;
  section: string | null;
  owner_name: string | null;
  lock_level: string | null;
  lock_reason: string | null;
};

export type OwnerHealthExam = {
  id: string;
  exam_date: string;
  temperature_c: number | null;
  heart_rate: number | null;
  respiratory_rate: number | null;
  body_condition_score: number | null;
  gait_assessment: string | null;
  doctor_name: string | null;
};

export type OwnerTrainingMetric = {
  id: string;
  training_schedule_id: string | null;
  body_weight_kg: number | null;
  max_heart_rate: number | null;
  avg_speed_kmh: number | null;
  stamina_score: number | null;
  has_injury_alert: boolean;
  is_simulated: boolean;
  trainer_review: string | null;
  recorded_at: string;
  recorded_by_name: string | null;
};

export type OwnerTrainingSchedule = {
  id: string;
  event_type: string;
  title: string | null;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  status: string | null;
  training_schedule_id: string | null;
  session_type: string | null;
  track_surface: string | null;
  stage_name: string | null;
  assigned_groom_name: string | null;
};

export type OwnerTrainingVideo = {
  id: string;
  training_schedule_id: string | null;
  video_url: string;
  description: string | null;
  uploaded_at: string;
  uploaded_by_name: string | null;
  session_type: string | null;
};

export type OwnerRaceResult = {
  entry_id: string;
  entry_status: string | null;
  result_position: number | null;
  prize_amount: number | null;
  race_id: string;
  race_name: string;
  grade: string | null;
  distance_category: string | null;
  distance_meters: number | null;
  race_date: string;
  location: string | null;
  description: string | null;
  is_simulated: boolean;
};

export type OwnerFinancialTransaction = {
  id: string;
  transaction_type: string;
  category: "CARE" | "MEDICAL" | "PRIZE" | "OTHER";
  amount: number;
  billing_period: string;
  created_at: string;
};

export type OwnerFinancialMonth = {
  billing_period: string;
  care_cost: number;
  medical_cost: number;
  prize_income: number;
  other_amount: number;
};

export type OwnerDashboard = {
  horse: OwnerHorse;
  health_exams: OwnerHealthExam[];
  training_metrics: OwnerTrainingMetric[];
  training_schedules: OwnerTrainingSchedule[];
  training_videos: OwnerTrainingVideo[];
  race_history: OwnerRaceResult[];
  financial_report: {
    year: number;
    totals: {
      care_cost: number;
      medical_cost: number;
      total_expenses: number;
      prize_income: number;
      other_amount: number;
    };
    monthly: OwnerFinancialMonth[];
    transactions: OwnerFinancialTransaction[];
  };
};

export async function getOwnerHorses() {
  return authenticatedRequest<{ items: OwnerHorse[]; total: number }>("/api/horse-owner/horses");
}

export async function getOwnerHorseDashboard(horseId: string, year: number) {
  const query = new URLSearchParams({ year: String(year) });
  return authenticatedRequest<OwnerDashboard>(
    `/api/horse-owner/horses/${encodeURIComponent(horseId)}/dashboard?${query.toString()}`,
  );
}
