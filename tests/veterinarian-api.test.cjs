const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function setup(response, error, exportName = "veterinarianApi") {
  const source = fs.readFileSync(path.join(__dirname, "../src/apis/veterinarian/api.ts"), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled)(() => ({
    ApiRequestError: Error,
    authenticatedRequest: async (url, options) => {
      if (error) throw error;
      if (typeof response === "function") return response(url, options);
      return response;
    },
  }), module, module.exports);
  return module.exports[exportName];
}

test("health conflicts explain how to recover without hiding unrelated errors", () => {
  const message = setup(null, null, "veterinarianError");
  const injury = Object.assign(new Error("Close the latest injury assessment"), { code: "ACTIVE_INJURY_MARKER", status: 409 });
  assert.match(message(injury), /Đã hồi phục/);
  const stable = Object.assign(new Error("Hết chuồng cách ly trống."), { code: "NO_MEDICAL_STABLE_AVAILABLE", status: 409 });
  assert.match(message(stable), /Hết chuồng cách ly trống/);
  assert.match(message(stable), /chưa được thay đổi/);
  assert.equal(message(new Error("Other failure")), "Other failure");
});

test("health conflicts preserve server messages and show structured details", () => {
  const message = setup(null, null, "veterinarianError");
  const error = Object.assign(new Error("Còn vị trí chưa hồi phục"), {
    status: 409, code: "ACTIVE_INJURY_MARKER", details: { injury_markers: [
      { id: "marker-a", body_part: "Chân trái", recovery_status: "Recovering", marked_at: "2026-11-26T09:00:00Z" },
    ] },
  });
  for (const value of [error.message, "marker-a", "Chân trái", "Recovering", "2026-11-26T09:00:00Z"]) assert.ok(message(error).includes(value));
  const stable = Object.assign(new Error("Hết chuồng"), { code: "NO_MEDICAL_STABLE_AVAILABLE", details: { required_box_type: "Quarantine" } });
  assert.ok(message(stable).includes("Quarantine"));
  delete stable.details;
  assert.ok(message(stable).includes("Hết chuồng"));
});

test("injury writes use POST for creation and PATCH for updates without server-owned fields", async () => {
  const requests = [];
  const api = setup((url, options) => { requests.push({ url, ...options }); return { id: "new-id" }; });
  const input = { recovery_status: "Recovered", marked_at: "client-time", marked_by: 42 };
  await api.createInjury("horse-1", input);
  await api.updateInjury("latest-id", input);
  assert.equal(requests[0].url, "/api/horses/horse-1/injury-markers");
  assert.equal(requests[0].method, "POST");
  assert.equal(requests[1].url, "/api/injury-markers/latest-id");
  assert.equal(requests[1].method, "PATCH");
  for (const request of requests) assert.deepEqual(JSON.parse(request.body), { recovery_status: "Recovered" });
});

test("latest injury snapshot bypasses cache and includes every page", async () => {
  const requests = [];
  const api = setup((url, options) => {
    requests.push({ url, ...options });
    const page = Number(new URL(url, "http://localhost").searchParams.get("page"));
    return { data: [{ id: `marker-${page}` }], total: 2, limit: 1, page };
  });
  assert.deepEqual((await api.injuries("horse-1", true)).data.map(marker => marker.id), ["marker-1", "marker-2"]);
  assert.ok(requests.every(request => request.cache === "no-store" && request.url.includes("latest_only=true")));
});

test("veterinarian workloads accept direct and wrapped lists", async () => {
  const items = [{ id: 1, name: "Bác sĩ", total_schedules: 2, today_count: 1, overdue_count: 0 }];
  for (const response of [items, { data: items }, { items }]) {
    assert.deepEqual(await setup(response).workloads(), items);
  }
  assert.deepEqual(await setup({ data: [] }).workloads(), []);
});

test("missing workload endpoint counts assigned schedules across pages and skips repeat 404s", async () => {
  let missingCalls = 0;
  const api = setup((url) => {
    if (url === "/api/veterinarian/workload") {
      missingCalls++;
      throw Object.assign(new Error("Not Found"), { status: 404 });
    }
    if (url === "/api/veterinarians") return [
      { id: 1, name: "Trưởng ban", email: "head@example.com", role_name: "HEAD_VETERINARIAN" },
      { id: 2, name: "Bác sĩ", email: "vet@example.com" },
    ];
    const pending = { assigned_doctor_id: 1, next_due_date: "2000-01-01", event_status: "Scheduled", frequency_days: null };
    return {
      data: url.includes("page=2") ? [
        { ...pending, assigned_doctor_id: null, assigned_doctor: { id: "1" } },
        { ...pending, assigned_doctor_id: null },
      ] : [pending, { ...pending, event_status: "Completed" }, { ...pending, event_status: "Cancelled" }],
      total: 5, limit: 3,
    };
  });
  const result = await api.workloads();
  assert.equal(result[0].role_name, "HEAD_VETERINARIAN");
  assert.equal(result[1].total_schedules, 0);
  assert.equal(result[0].today_count, 0);
  assert.equal(result[0].total_schedules, 2);
  assert.equal(result[0].total_schedules, result[0].overdue_count);
  await api.workloads();
  assert.equal(missingCalls, 1);
});

test("veterinarian workloads report malformed responses and API failures", async () => {
  for (const response of [null, {}, { data: null }, { items: {} }]) {
    await assert.rejects(setup(response).workloads(), /không hợp lệ/);
  }
  const error = new Error("Không có quyền truy cập");
  await assert.rejects(setup(null, error).workloads(), error);
});

test("all schedules loads every page and retains the horse filter", async () => {
  const urls = [];
  const api = setup((url) => {
    urls.push(url);
    const page = Number(new URL(url, "http://localhost").searchParams.get("page"));
    return { data: [{ id: `schedule-${page}` }], total: 3, limit: 1, page };
  });
  const result = await api.allSchedules("horse-1");
  assert.deepEqual(result.data.map((item) => item.id), ["schedule-1", "schedule-2", "schedule-3"]);
  assert.equal(urls.length, 3);
  assert.ok(urls.every((url) => new URL(url, "http://localhost").searchParams.get("horse_id") === "horse-1"));
});

test("schedule pagination overlaps requests with a maximum of four and preserves page order", async () => {
  let active = 0, peak = 0;
  const api = setup(async url => {
    const page = Number(new URL(url, "http://localhost").searchParams.get("page"));
    active++;
    peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, page % 2 ? 5 : 10));
    active--;
    return { data: [{ id: page }], total: 10, limit: 1, page };
  });
  const result = await api.allSchedules();
  assert.deepEqual(result.data.map(item => item.id), [1,2,3,4,5,6,7,8,9,10]);
  assert.ok(peak > 1, "requests must overlap instead of waiting for every page");
  assert.ok(peak <= 4, "pagination must not flood the backend");
});
