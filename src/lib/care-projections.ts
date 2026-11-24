import type { CareEvent, CareSchedule, VetHorse } from "@/api/veterinarian/api";

export type ProjectedCareEvent = CareEvent & { is_periodic_due: true; due_date: string };

export function activeRecurringRules(schedules: CareSchedule[], horseId = "all", doctorId?: number | string): CareSchedule[] {
  return schedules.filter((rule) => Number(rule.frequency_days) > 0
    && (horseId === "all" || rule.horse_id === horseId)
    && (doctorId === undefined || String(rule.assigned_doctor_id ?? rule.assigned_doctor?.id ?? "") === String(doctorId)));
}

/** Assignment follows the rule's doctor ID, never the horse's nearest rule or a name. */
export function careRulesForDoctor(schedules: CareSchedule[], doctorId: number | string): CareSchedule[] {
  return schedules.filter((rule) => String(rule.assigned_doctor_id ?? rule.assigned_doctor?.id ?? "") === String(doctorId)
    && (Boolean(rule.frequency_days) || !["Completed", "Cancelled"].includes(rule.event_status ?? "")));
}

/** Project the next occurrence of each rule; booking is still an explicit action. */
export function buildCareProjections(
  schedules: CareSchedule[],
  events: CareEvent[],
  horses: VetHorse[],
  from: string,
  to: string,
): ProjectedCareEvent[] {
  return schedules.flatMap((schedule): ProjectedCareEvent[] => {
    if (!schedule.frequency_days || schedule.frequency_days <= 0) return [];
    if (schedule.next_due_date < from || schedule.next_due_date > to) return [];
    const linked = events.filter((event) => !event.context && (
      event.schedule_id === schedule.id || Boolean(schedule.calendar_event_id
        && schedule.calendar_event_id === (event.event_id ?? event.id))
    ));
    // Cancelled appointments can be booked again. Completed occurrences are historical.
    if (linked.some((event) => event.status !== "Cancelled"
      && (event.event_date === schedule.next_due_date || event.status === "Scheduled"))) return [];
    const booked = schedule.event;
    const status = booked?.status ?? schedule.event_status;
    if (schedule.calendar_event_id && status === "Scheduled") return [];
    if (booked?.event_date === schedule.next_due_date && status === "Completed") return [];

    const horseName = horses.find((horse) => horse.id === schedule.horse_id)?.horse_name
      ?? schedule.horse_name ?? "Ngựa";
    return [{
      id: `projected-${schedule.id}-${schedule.next_due_date}`,
      event_date: schedule.next_due_date,
      due_date: schedule.next_due_date,
      // Reuse the rule's previous slot; rules without a time use the first slot.
      start_time: booked?.start_time ?? "07:00",
      end_time: booked?.end_time ?? "08:30",
      status: "Projected",
      event_type: "PeriodicCare",
      care_type: schedule.care_type,
      horse_id: schedule.horse_id,
      horse: { id: schedule.horse_id, horse_name: horseName },
      schedule_id: schedule.id,
      is_periodic_due: true,
      assigned_doctor: schedule.assigned_doctor ?? {
        id: schedule.assigned_doctor_id, name: schedule.doctor_name,
      },
    }];
  });
}
