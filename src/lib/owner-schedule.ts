export const OWNER_TIMETABLE_SLOTS = [
  { id: 1, label: "Ca 1", timeRange: "07:00 – 08:30" },
  { id: 2, label: "Ca 2", timeRange: "08:45 – 10:15" },
  { id: 3, label: "Ca 3", timeRange: "10:30 – 12:00" },
  { id: 4, label: "Ca 4", timeRange: "12:30 – 14:00" },
  { id: 5, label: "Ca 5", timeRange: "14:15 – 15:45" },
  { id: 6, label: "Ca 6", timeRange: "16:15 – 17:45" },
] as const;

export function ownerSlotForTime(startTime: string | null | undefined): number {
  if (!startTime) return 1;
  const [hoursStr, minutesStr = "0"] = startTime.split(":");
  const hours = Number(hoursStr);
  const minutes = Number(minutesStr);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 1;
  const total = hours + minutes / 60;
  if (total < 8.625) return 1;
  if (total < 10.375) return 2;
  if (total < 12.25) return 3;
  if (total < 14.125) return 4;
  if (total < 16.0) return 5;
  return 6;
}

const CARE_TYPE_LABELS: Record<string, string> = {
  HoofCheck: "Kiểm tra móng",
  HoofCare: "Chăm sóc móng",
  Deworming: "Tẩy giun định kỳ",
  Vaccination: "Tiêm phòng vắc-xin",
  MedicalCheckup: "Khám sức khỏe định kỳ",
  GeneralCheckup: "Khám sức khỏe định kỳ",
  VetCheckup: "Khám thú y",
  DentalCheck: "Khám răng",
  Physiotherapy: "Vật lý trị liệu",
};

export function ownerCareTypeLabel(careType: string | null | undefined, title: string | null | undefined): string {
  const mappedCare = careType ? CARE_TYPE_LABELS[careType] : undefined;
  if (mappedCare) return mappedCare;
  const mappedTitle = title ? CARE_TYPE_LABELS[title] : undefined;
  if (mappedTitle) return mappedTitle;
  return title || careType || "Chăm sóc y tế";
}

const TRAINING_TYPE_LABELS: Record<string, string> = {
  Training: "Tập luyện",
  TrialRun: "Đua thử",
  Race: "Đua thử",
  Rest: "Nghỉ hồi phục",
};

export function ownerTrainingTitle(
  title: string | null | undefined,
  sessionType: string | null | undefined,
  eventType?: string | null,
): string {
  const trimmedTitle = title?.trim();
  if (trimmedTitle && !(trimmedTitle in TRAINING_TYPE_LABELS)) {
    return trimmedTitle;
  }
  const key = sessionType ?? eventType ?? trimmedTitle ?? "";
  return TRAINING_TYPE_LABELS[key] ?? "Buổi tập";
}
