type CalendarRule = {
  horse_id: string;
  next_due_date: string;
  event?: { event_date: string; status: string } | null;
};

/** Open the booked appointment when present; otherwise show the rule's due date. */
export function careCalendarTarget(rule: CalendarRule) {
  const date = rule.event?.status === "Scheduled" ? rule.event.event_date : rule.next_due_date;
  return { horseId: rule.horse_id, date };
}
