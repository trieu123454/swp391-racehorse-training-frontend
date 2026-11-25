const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function setup(response, onRequest = () => {}) {
  const source = fs.readFileSync(path.join(__dirname, "../src/apis/horse-owner/api.ts"), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled)(
    () => ({ authenticatedRequest: async (...args) => { onRequest(...args); return response; } }), module, module.exports,
  );
  return module.exports;
}

test("registration sends the JSON body accepted by the backend", async () => {
  const api = setup({ id: "new-request" }, (url, options) => {
    assert.equal(url, "/api/horse-owner/horse-registration-requests");
    assert.equal(options.method, "POST");
    assert.deepEqual(JSON.parse(options.body), { horseName: "Thunder", reason: "Please review" });
  });
  const result = await api.submitHorseRegistrationRequest({ requestType: "REGISTER", horseName: "Thunder", ownerNote: "Please review" }, null, [], []);
  assert.deepEqual(result.documents, []);
  assert.deepEqual(result.history, []);
});

test("registration does not silently discard attachments", async () => {
  const image = new Blob(["image"], { type: "image/png" });
  const document = new Blob(["document"], { type: "application/pdf" });
  const input = { requestType: "REGISTER", horseName: "Thunder" };
  let calls = 0;
  const uploadApi = setup({}, (url, options) => {
    calls++;
    assert.equal(options.method, "POST");
    assert.ok(options.body instanceof FormData);
    assert.equal(options.body.get("horseImage").size, image.size);
    assert.equal(options.body.getAll("documents")[0].size, document.size);
    assert.equal(options.body.get("request").type, "application/json");
    assert.equal(options.body.get("documentTypes").type, "application/json");
  });
  await uploadApi.submitHorseRegistrationRequest(input, image, [document], ["OTHER"]);
  assert.equal(calls, 1);
});

for (const method of ["getHorseRegistrationRequests", "getOwnershipTransferRequests"]) {
  test(`${method} returns lists from direct and paginated responses`, async () => {
    const items = [{ id: "request-1" }];
    for (const response of [items, { items, total: 1 }, [], { items: [], total: 0 }]) {
      assert.deepEqual(await setup(response)[method](), Array.isArray(response) ? response : response.items);
    }
  });

  test(`${method} rejects malformed responses before they reach component state`, async () => {
    for (const response of [null, undefined, {}, { items: null }, { items: {} }, "invalid"]) {
      await assert.rejects(setup(response)[method](), /Dữ liệu danh sách/);
    }
  });
}

test("getOwnerCalendar deduplicates in-flight calls and supports cache invalidation", async () => {
  let calls = 0;
  let resolveCalendar;
  const source = fs.readFileSync(path.join(__dirname, "../src/apis/horse-owner/api.ts"), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const mod = { exports: {} };
  new Function("require", "module", "exports", compiled)(
    () => ({
      APP_MUTATION_COMPLETED_EVENT: "app:mutation",
      SESSION_EXPIRED_EVENT: "app:expired",
      authenticatedRequest: async () => {
        calls += 1;
        return new Promise((resolve) => {
          resolveCalendar = resolve;
        });
      },
      authenticatedUploadWithProgress: async () => ({}),
    }),
    mod,
    mod.exports,
  );

  const p1 = mod.exports.getOwnerCalendar();
  const p2 = mod.exports.getOwnerCalendar();
  assert.equal(calls, 1);

  resolveCalendar({
    training_schedules: [{ id: "t1", horse_name: "Desert Mirage" }],
    care_schedules: [{ id: "c1", horse_name: "Quarter Horse" }],
  });
  const [c1, c2] = await Promise.all([p1, p2]);
  assert.equal(c1.training_schedules.length, 1);
  assert.equal(c2.care_schedules.length, 1);
  assert.equal(mod.exports.peekOwnerCalendar()?.training_schedules.length, 1);

  mod.exports.invalidateOwnerCaches();
  assert.equal(mod.exports.peekOwnerCalendar(), null);
});
