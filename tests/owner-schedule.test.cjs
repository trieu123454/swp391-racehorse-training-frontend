const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const ts = require("typescript");

function loadOwnerScheduleHelpers() {
  const source = fs.readFileSync(
    path.join(__dirname, "../src/lib/owner-schedule.ts"),
    "utf8",
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const moduleUnderTest = { exports: {} };
  new Function("require", "module", "exports", compiled)(
    require,
    moduleUnderTest,
    moduleUnderTest.exports,
  );
  return moduleUnderTest.exports;
}

test("ownerSlotForTime aligns all 6 standard club slots including 10:30 (Ca 3) and 12:30 (Ca 4)", () => {
  const { OWNER_TIMETABLE_SLOTS, ownerSlotForTime } = loadOwnerScheduleHelpers();
  assert.equal(OWNER_TIMETABLE_SLOTS.length, 6);
  assert.equal(ownerSlotForTime("07:00"), 1);
  assert.equal(ownerSlotForTime("08:45"), 2);
  assert.equal(ownerSlotForTime("10:30"), 3);
  assert.equal(ownerSlotForTime("12:30"), 4);
  assert.equal(ownerSlotForTime("14:15"), 5);
  assert.equal(ownerSlotForTime("16:15"), 6);
  assert.equal(ownerSlotForTime(null), 1);
});

test("ownerCareTypeLabel translates HoofCheck and MedicalCheckup into Vietnamese", () => {
  const { ownerCareTypeLabel } = loadOwnerScheduleHelpers();
  assert.equal(ownerCareTypeLabel("HoofCheck", "HoofCheck"), "Kiểm tra móng");
  assert.equal(ownerCareTypeLabel("MedicalCheckup", null), "Khám sức khỏe định kỳ");
  assert.equal(ownerCareTypeLabel("Deworming", null), "Tẩy giun định kỳ");
  assert.equal(ownerCareTypeLabel("Vaccination", null), "Tiêm phòng vắc-xin");
});

test("ownerTrainingTitle translates raw English session keys and keeps custom Vietnamese titles", () => {
  const { ownerTrainingTitle } = loadOwnerScheduleHelpers();
  assert.equal(ownerTrainingTitle("Training", "Training"), "Tập luyện");
  assert.equal(ownerTrainingTitle("TrialRun", "TrialRun"), "Đua thử");
  assert.equal(ownerTrainingTitle("Rest", "Rest"), "Nghỉ hồi phục");
  assert.equal(ownerTrainingTitle("Chạy tăng tốc 1200m", "Training"), "Chạy tăng tốc 1200m");
});
