const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

class ApiRequestError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

function setup(response, error) {
  const source = fs.readFileSync(path.join(__dirname, "../src/apis/club-manager/api.ts"), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled)(
    () => ({ ApiRequestError, authenticatedRequest: async () => {
      if (error) throw error;
      return response;
    } }), module, module.exports,
  );
  return module.exports;
}

test("manager registration lists unwrap supported response envelopes", async () => {
  const items = [{ id: "registration-1" }];
  for (const response of [items, { items, total: 1 }, { data: items, total: 1 }]) {
    assert.deepEqual(await setup(response).listPendingHorseRegistrationRequests(), items);
  }
  assert.deepEqual(await setup({ items: [] }).listPendingHorseRegistrationRequests(), []);
});

test("malformed manager lists fail before reaching React state", async () => {
  for (const response of [null, undefined, {}, { items: {} }, { data: null }, "invalid"]) {
    await assert.rejects(setup(response).listPendingHorseRegistrationRequests(), /không hợp lệ/);
  }
});

test("missing manager endpoint retains its actionable error", async () => {
  await assert.rejects(setup(null, new ApiRequestError("Not Found", 404)).listPendingHorseRegistrationRequests(), /Cần cập nhật backend/);
});
