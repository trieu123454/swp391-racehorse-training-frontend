const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const source = fs.readFileSync(path.join(__dirname, "../src/lib/care-calendar-navigation.ts"), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exported = { exports: {} };
new Function("module", "exports", compiled)(exported, exported.exports);
const { careCalendarTarget } = exported.exports;

test("view calendar preserves overdue and future due dates instead of using today", () => {
  for (const date of ["2026-11-22", "2026-12-29", "2027-06-01"]) {
    assert.deepEqual(careCalendarTarget({ horse_id: "horse-2", next_due_date: date }), {
      horseId: "horse-2", date,
    });
  }
});

test("view calendar follows the booked appointment when it differs from the rule deadline", () => {
  assert.deepEqual(careCalendarTarget({ horse_id: "horse-1", next_due_date: "2026-11-29",
    event: { event_date: "2026-12-02", status: "Scheduled" } }), {
    horseId: "horse-1", date: "2026-12-02",
  });
});

test("cancelled or completed appointments do not replace the next due date", () => {
  for (const status of ["Cancelled", "Completed"]) {
    assert.equal(careCalendarTarget({ horse_id: "horse-1", next_due_date: "2026-12-29",
      event: { event_date: "2026-11-22", status } }).date, "2026-12-29");
  }
});
