const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const ts = require("typescript");

function loadHorseApi(authenticatedRequestImpl) {
  const source = fs.readFileSync(
    path.join(__dirname, "../src/apis/horses/api.ts"),
    "utf8",
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const moduleUnderTest = { exports: {} };
  const fakeClient = {
    APP_MUTATION_COMPLETED_EVENT: "app:mutation-completed",
    ApiRequestError: class ApiRequestError extends Error {
      constructor(message, status) {
        super(message);
        this.status = status;
      }
    },
    authenticatedRequest: authenticatedRequestImpl,
    authenticatedUploadWithProgress: async () => ({}),
  };
  new Function("require", "module", "exports", compiled)(
    (ref) => (ref === "@/api/client" ? fakeClient : require(ref)),
    moduleUnderTest,
    moduleUnderTest.exports,
  );
  return moduleUnderTest.exports;
}

test("listHorses deduplicates in-flight requests and warms peekCachedHorseList", async () => {
  let listCalls = 0;
  let resolveFetch;
  const pendingFetch = new Promise((resolve) => {
    resolveFetch = resolve;
  });
  const api = loadHorseApi((url) => {
    if (url.startsWith("/api/horses?page=1&size=9")) {
      listCalls += 1;
      return pendingFetch;
    }
    return Promise.resolve([]);
  });

  assert.equal(api.peekCachedHorseList({ page: 1, size: 9 }), null);

  const p1 = api.listHorses({ page: 1, size: 9 });
  const p2 = api.listHorses({ page: 1, size: 9 });
  assert.equal(listCalls, 1);

  resolveFetch({ items: [{ id: "h-1", horse_name: "Thunder" }], total: 1, page: 1, size: 9 });
  const [r1, r2] = await Promise.all([p1, p2]);
  assert.equal(r1.items[0].horse_name, "Thunder");
  assert.equal(r2.total, 1);

  const peeked = api.peekCachedHorseList({ page: 1, size: 9 });
  assert.equal(peeked?.items.length, 1);

  api.invalidateHorseCaches();
  assert.equal(api.peekCachedHorseList({ page: 1, size: 9 }), null);
});

test("prefetchHorsesOverview warms horses + stables for staff and skips stables for owner", async () => {
  const urls = [];
  const api = loadHorseApi((url) => {
    urls.push(url);
    if (url.startsWith("/api/horses/options/stables")) {
      return Promise.resolve([{ id: "s-1", box_code: "A-01", section: "A", capacity: 1, occupied: 0 }]);
    }
    return Promise.resolve({ items: [], total: 0, page: 1, size: 9 });
  });

  api.prefetchHorsesOverview(true);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepEqual(urls, ["/api/horses?page=1&size=9"]);

  urls.length = 0;
  api.invalidateHorseCaches();
  api.prefetchHorsesOverview(false);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.ok(urls.includes("/api/horses?page=1&size=9"));
  assert.ok(urls.includes("/api/horses/options/stables"));
  assert.equal(api.peekCachedStables()?.length, 1);
});
