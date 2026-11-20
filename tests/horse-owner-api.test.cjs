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
