const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, "../src/lib/notifications.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const exported = { exports: {} };
const roles = { exports: {} };
const rolesCode = ts.transpileModule(fs.readFileSync(path.join(__dirname, "../src/lib/roles.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
new Function("require", "module", "exports", rolesCode)(() => ({ Routes: { dashboardRole: slug => `/dashboard/${slug}` } }), roles, roles.exports);
new Function("require", "module", "exports", code)(() => roles.exports, exported, exported.exports);
const { notificationDescription, notificationKind, notificationRelativeTime, notificationIsToday, notificationHref, notificationPresentation, notificationExactTime, notificationGroup } = exported.exports;
const item = { id: "n1", message: "Lịch chăm sóc quá hạn", related_table: "Periodic_Care_Schedules", related_id: "s1", created_at: "2026-11-24T02:55:00Z", scheduled_at: null, is_read: false };
const now = new Date("2026-11-24T03:00:00Z");

test("notification previews keep real content while removing leading blank lines", () => {
  assert.equal(notificationDescription("\n\n  Golden Boy\n\t cần kiểm tra móng.  "), "Golden Boy cần kiểm tra móng.");
  assert.equal(notificationDescription(null), "");
});

test("notification types recognize Vietnamese accents and server source tables", () => {
  assert.equal(notificationKind(item), "overdue");
  assert.equal(notificationKind({ ...item, message: "Điều chuyển bác sĩ" }), "reassigned");
  assert.equal(notificationKind({ ...item, message: "Lịch chăm sóc mới" }), "assigned");
  assert.equal(notificationKind({ ...item, related_table: "Stable_Incidents", message: "Emergency" }), "incident");
});
test("relative time and grouping follow the business day", () => {
  assert.equal(notificationRelativeTime(item.created_at, now), "5 phút trước");
  assert.equal(notificationRelativeTime("2026-11-23T02:55:00Z", now), "Hôm qua");
  assert.equal(notificationIsToday(item, now), true);
  assert.equal(notificationIsToday({ ...item, created_at: "2026-11-23T02:55:00Z" }, now), false);
});
test("overdue deep link identifies the horse row in dispatch; ordinary vets go to their care calendar", () => {
  const target = { horse_id: "horse-2", schedule_id: "s1", event_date: "2026-11-23" };
  const head = new URL(notificationHref(item, target, "HEAD_VETERINARIAN"), "http://localhost");
  assert.equal(head.searchParams.get("tab"), "dispatch");
  assert.equal(head.searchParams.get("notificationTarget"), "horse-2");
  assert.equal(head.searchParams.get("date"), "2026-11-23");
  assert.equal(new URL(notificationHref(item, target, "VETERINARIAN"), "http://localhost").searchParams.get("tab"), "care");
});
test("incident deep links highlight the incident rather than a different horse card", () => {
  const url = new URL(notificationHref({ ...item, related_table: "Stable_Incidents" }, { horse_id: "h1", incident_id: "i1" }, "HEAD_VETERINARIAN"), "http://localhost");
  assert.equal(url.searchParams.get("tab"), "incidents");
  assert.equal(url.searchParams.get("notificationTarget"), "i1");
});

test("structured role changes use shared Vietnamese labels without exposing role codes", () => {
  const view = notificationPresentation({ ...item, type: "ROLE_CHANGED", message: "", params: { old_role: "VETERINARIAN", new_role: "HEAD_VETERINARIAN" } });
  assert.equal(view.title, "Vai trò đã thay đổi");
  assert.match(view.description, /từ Bác sĩ thú y sang Trưởng ban thú y/);
  assert.doesNotMatch(view.description, /VETERINARIAN|Club Manager/);
});

test("lock templates omit missing reasons and retain an actual reason", () => {
  const locked = { ...item, type: "ACCOUNT_LOCKED", message: "", params: {} };
  assert.equal(notificationPresentation(locked).title, "Tài khoản bị khóa");
  assert.doesNotMatch(notificationPresentation(locked).description, /Lý do/);
  assert.match(notificationPresentation({ ...locked, params: { reason: "Vi phạm quy trình kiểm tra" } }).description, /Lý do: Vi phạm quy trình kiểm tra/);
  assert.equal(notificationKind({ ...locked, type: "ACCOUNT_UNLOCKED" }), "unlocked");
});

test("care templates use absolute dates and wall clock time even after a reminder expires", () => {
  const view = notificationPresentation({ ...item, type: "CARE_ASSIGNED", message: "", params: { horse_name: "Golden Boy", event_date: "2026-11-22", start_time: "07:00:00", care_label: "Kiểm tra móng" } });
  assert.match(view.description, /22\/11\/2026 lúc 07:00/);
  assert.doesNotMatch(view.description, /Ngày mai/);
  assert.equal(notificationExactTime("2026-11-22T00:00:00Z"), "22/11/2026 lúc 07:00");
});

test("time groups use a Monday business week and old accounts remain in the older group", () => {
  assert.equal(notificationGroup(item, now), "Hôm nay");
  assert.equal(notificationGroup({ ...item, created_at: "2026-11-23T03:00:00Z" }, now), "Tuần này");
  assert.equal(notificationGroup({ ...item, type: "ACCOUNT_UNLOCKED", created_at: "2026-11-01T03:00:00Z" }, now), "Cũ hơn");
  assert.equal(notificationGroup({ ...item, created_at: "bad-date" }, now), "Cũ hơn");
});

test("legacy history translates roles and static reminder dates without altering server read state", () => {
  const view = notificationPresentation({ ...item, type: null, message: "Club Manager đổi từ VETERINARIAN sang HEAD_VETERINARIAN. Ngày mai (2026-11-22) lúc 07:00:00" });
  assert.match(view.description, /Bác sĩ thú y sang Trưởng ban thú y/);
  assert.match(view.description, /22\/11\/2026 lúc 07:00/);
  assert.doesNotMatch(view.description, /Ngày mai|VETERINARIAN|Club Manager/);
});

test("historical English notification templates render Vietnamese while preserving domain data", () => {
  const cases = [
    ["Ban duoc phan cong buoi tap Golden Boy vao 2026-11-24 luc 07:00", /Bạn được phân công buổi tập của ngựa Golden Boy vào 24\/11\/2026 lúc 07:00/],
    ["Your supply request was approved.", /Yêu cầu vật tư của bạn đã phê duyệt/],
    ["New supply request for Hay (quantity 2)", /Hay · Số lượng: 2/],
    ["Horse registration APPROVED", /Yêu cầu đăng ký ngựa đã phê duyệt/],
    ["Groom confirmed the training session for Golden Boy on 2026-11-24.", /Nhân viên chăm sóc đã xác nhận buổi tập của ngựa Golden Boy ngày 24\/11\/2026/],
    ["Incident for Golden Boy is assigned to VETERINARIAN. Instructions: Kiểm tra chân trái", /giao cho Bác sĩ thú y\. Hướng dẫn: Kiểm tra chân trái/],
    ["Horse Golden Boy has an active injury marker at Chân trái; training has been locked.", /chấn thương tại Chân trái; đã khóa huấn luyện/],
    ["Training simulation for horse abc exceeded a configured monitoring threshold; review the sensor readings", /Chỉ số mô phỏng tập luyện của ngựa abc vượt ngưỡng/],
    ["Horse Owner Dat Tran vừa gửi yêu cầu đăng ký ngựa mới Golden Boy.", /Chủ sở hữu ngựa Dat Tran/],
    ["Ngựa Golden Boy bị khóa huấn luyện (Warning): Kiểm tra lại", /\(Cảnh báo\): Kiểm tra lại/],
  ];
  for (const [message, expected] of cases) {
    const view = notificationPresentation({ ...item, related_table: "users", message });
    assert.match(view.description, expected, message);
    assert.doesNotMatch(view.description, /Horse Owner|Club Manager|VETERINARIAN|APPROVED|Ban duoc|training has been locked|Training simulation/);
  }
});

test("enum labels and status casing are localized for structured notifications", () => {
  const view = notificationPresentation({ ...item, type: "CARE_ASSIGNED", params: { horse_name: "Golden Boy", care_type: "MedicalCheckup" }, message: "" });
  assert.match(view.description, /Khám định kỳ cho ngựa Golden Boy/);
  const supply = notificationPresentation({ ...item, type: "SUPPLY_UPDATED", params: { item_name: "Hay", status: "PARTIALLY_APPROVED" }, message: "" });
  assert.match(supply.description, /đã phê duyệt một phần/);
});

test("a horse training unlock is not classified as a personal account notification", () => {
  assert.equal(notificationKind({ ...item, related_table: "Horses", message: "Ngựa Golden Boy đã được mở khóa huấn luyện" }), "general");
  assert.equal(notificationKind({ ...item, related_table: "users", message: "Tài khoản đã được mở khóa" }), "unlocked");
});
