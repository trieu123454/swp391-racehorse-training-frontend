const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const source = fs.readFileSync(path.join(__dirname, "../src/lib/care-projections.ts"), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exported = { exports: {} };
new Function("module", "exports", compiled)(exported, exported.exports);
const { activeRecurringRules, buildCareProjections, careRulesForDoctor } = exported.exports;
const rule = (patch = {}) => ({
  id: "rule-1", horse_id: "horse-1", care_type: "MedicalCheckup",
  frequency_days: 7, next_due_date: "2026-11-23", last_done_date: null,
  assigned_doctor_id: 5, notes: null, calendar_event_id: null, ...patch,
});
const project = (rules, events = []) => buildCareProjections(rules, events,
  [{ id: "horse-1", horse_name: "Star" }], "2026-11-23", "2026-11-29");
const appointment = (patch = {}) => ({
  id: "event-1", schedule_id: "rule-1", event_date: "2026-11-23",
  start_time: "14:15", end_time: "15:45", status: "Scheduled", ...patch,
});

test("two overdue rules on one horse belong to their assigned doctors, regardless of names", () => {
  const rules = [rule({ assigned_doctor_id: 5, doctor_name: "dat tran", is_overdue: true }),
    rule({ id: "r2", assigned_doctor_id: 6, doctor_name: "nguyễn ngọ hân", is_overdue: true })];
  assert.equal(new Set(rules.filter(rule => rule.is_overdue).map(rule => rule.horse_id)).size, 1);
  assert.equal(careRulesForDoctor(rules, "5").filter(rule => rule.is_overdue).length, 1);
  assert.equal(careRulesForDoctor(rules, 6).filter(rule => rule.is_overdue).length, 1);
  assert.equal(careRulesForDoctor(rules, 7).length, 0);
  assert.equal(careRulesForDoctor(rules.map(rule => ({ ...rule, assigned_doctor_id: 5 })), 6).length, 0);
  assert.equal(careRulesForDoctor([rule({ frequency_days: null, event_status: "Completed" })], 5).length, 0);
});

test("active rule totals exclude one-off schedules and follow the horse and doctor filters", () => {
  const rules = [rule(), rule({ id: "other", assigned_doctor_id: 6 }),
    rule({ id: "one-off", frequency_days: null }), rule({ id: "other-horse", horse_id: "horse-2" })];
  assert.equal(activeRecurringRules(rules).length, 3);
  assert.equal(activeRecurringRules(rules, "all", 5).length, 2);
  assert.equal(activeRecurringRules(rules, "horse-1", 5).length, 1);
  assert.equal(activeRecurringRules(rules, "horse-1", 7).length, 0);
});

test("two active rules outside the selected week mean two listed rules and zero projected cells", () => {
  const rules = activeRecurringRules([rule({ next_due_date: "2026-12-02" }),
    rule({ id: "rule-2", next_due_date: "2026-12-01" })], "all", 5);
  assert.equal(rules.length, 2);
  assert.equal(project(rules).length, 0);
  assert.equal(rules.map(rule => rule.next_due_date).sort()[0], "2026-12-01");
});

test("two due rules produce two distinct projected cells with horse and doctor", () => {
  const items = project([rule(), rule({ id: "rule-2", next_due_date: "2026-11-29" })]);
  assert.equal(items.length, 2);
  assert.notEqual(items[0].id, items[1].id);
  assert.deepEqual(items.map(item => item.event_date), ["2026-11-23", "2026-11-29"]);
  assert.equal(items[0].horse.horse_name, "Star");
  assert.equal(items[0].assigned_doctor.id, 5);
  assert.ok(items.every(item => item.is_periodic_due && item.status === "Projected"));
});

test("only periodic rules inside the viewed week are projected; overdue rules stay on their date", () => {
  assert.deepEqual(project([
    rule({ next_due_date: "2026-11-22" }), rule({ next_due_date: "2026-11-30" }),
    rule({ frequency_days: null }), rule({ frequency_days: 0 }), rule({ frequency_days: -1 }),
  ]), []);
});

test("booked or completed actual occurrences replace projections, cancelled events do not", () => {
  assert.equal(project([rule()], [appointment()]).length, 0);
  assert.equal(project([rule()], [appointment({ status: "Completed" })]).length, 0);
  assert.equal(project([rule()], [appointment({ status: "Cancelled" })]).length, 1);
  assert.equal(project([rule()], [appointment({ event_date: "2026-11-25" })]).length, 0);
});

test("linked booked appointment outside calendar page suppresses duplicate booking", () => {
  assert.equal(project([rule({ calendar_event_id: "event-1", event_status: "Scheduled" })]).length, 0);
  assert.equal(project([rule({ calendar_event_id: "event-1", event: appointment() })]).length, 0);
});

test("new periodic occurrence keeps the previous slot without reusing its completed occurrence", () => {
  const items = project([rule({ event: appointment({ event_date: "2026-11-16", status: "Completed" }) })]);
  assert.equal(items.length, 1);
  assert.equal(items[0].event_date, "2026-11-23");
  assert.equal(items[0].start_time, "14:15");
  assert.equal(items[0].end_time, "15:45");
  assert.equal(project([rule({ event: appointment({ status: "Completed" }) })]).length, 0);
});

test("booking transition changes two projections to one projection and one actual appointment", () => {
  const rules = [rule(), rule({ id: "rule-2" })];
  assert.equal(project(rules).length, 2);
  const events = [appointment()];
  assert.equal(project(rules, events).length, 1);
  assert.equal(events.filter(event => event.status !== "Cancelled").length, 1);
  assert.equal(project(rules, [appointment({ schedule_id: "another-rule" })]).length, 2);
});
