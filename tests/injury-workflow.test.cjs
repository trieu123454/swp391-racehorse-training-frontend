const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const source = fs.readFileSync(require("node:path").join(__dirname, "../src/lib/injury-workflow.ts"), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const loaded = { exports: {} };
new Function("module", "exports", compiled)(loaded, loaded.exports);
const { createInjuryWorkflow } = loaded.exports;
const horse = { id: "horse-1", horse_name: "Horse" };
const marker = (id, recovery_status = "Recovered", body_part = "Leg") => ({ id, recovery_status, body_part, severity: "Mild" });

function setup(latest, overrides = {}) {
  const calls = [];
  const api = {
    updateInjury: async (id, input) => { calls.push(["patch", id, input]); return marker("new-id", input.recovery_status); },
    createInjury: async () => { calls.push(["post"]); return marker("created", "Active"); },
    injuries: async (id, latestOnly) => { calls.push(["get", latestOnly]); return { data: latest }; },
    updateHealthStatus: async (...args) => { calls.push(["health", ...args]); return { is_training_locked: true }; },
    unlockTraining: async () => { calls.push(["unlock"]); },
    lockTraining: async () => { calls.push(["lock"]); },
    ...overrides,
  };
  return { calls, api, run: createInjuryWorkflow(api) };
}

test("one recovered position cannot make a horse with another active/recovering position Ready", async () => {
  for (const status of ["Active", "Recovering"]) {
    const { calls, run } = setup([marker("new-id"), marker("other", status, "Back")]);
    await run(horse, "old-id", { recovery_status: "Recovered" }, () => {}, () => {});
    assert.deepEqual(calls.map(call => call[0]), ["patch", "get", "get"]);
  }
});

test("all positions recovered: save and reload precede Healthy/Ready and unlock", async () => {
  const { calls, run } = setup([marker("new-id"), marker("other", "Recovered", "Back")]);
  await run(horse, "old-id", { recovery_status: "Recovered" }, () => calls.push(["saved"]), () => calls.push(["reloaded"]));
  assert.deepEqual(calls.map(call => call[0]), ["patch", "saved", "get", "get", "reloaded", "health", "unlock"]);
  assert.deepEqual(calls.find(call => call[0] === "health").slice(2, 4), ["Healthy", "Ready"]);
});

test("successive updates use returned server IDs even when IDs and times are unordered", async () => {
  const snapshots = [marker("z-id", "Active"), marker("a-id", "Recovering")];
  const ids = [];
  const api = setup([], {
    updateInjury: async id => { ids.push(id); return snapshots[ids.length - 1]; },
    injuries: async () => ({ data: [snapshots[ids.length - 1]] }),
  });
  let current = "initial-id";
  for (let index = 0; index < 2; index++) {
    await api.run(horse, current, {}, saved => { current = saved.id; }, snapshot => { current = snapshot.latest[0].id; });
  }
  assert.deepEqual(ids, ["initial-id", "z-id"]);
  assert.equal(current, "a-id");
});

test("medical stable conflict is surfaced once without retry or unlock", async () => {
  const conflict = Object.assign(new Error("Hết chuồng"), { status: 409, code: "NO_MEDICAL_STABLE_AVAILABLE" });
  let attempts = 0;
  const { calls, run } = setup([marker("new-id", "Active")], {
    updateHealthStatus: async () => { attempts++; throw conflict; },
  });
  const result = await run(horse, "old", { recovery_status: "Active" }, () => {}, () => {});
  assert.equal(result.syncError, conflict);
  assert.equal(attempts, 1);
  assert.ok(!calls.some(call => ["lock", "unlock"].includes(call[0])));
});

test("double submit issues one write; failed write stops reload and health, permits manual retry", async () => {
  let rejectWrite;
  let attempts = 0;
  const failure = new Error("Save failed");
  const { calls, run } = setup([], {
    updateInjury: () => { attempts++; return new Promise((resolve, reject) => { rejectWrite = reject; }); },
  });
  const first = run(horse, "old", {}, () => assert.fail("not saved"), () => assert.fail("not reloaded"));
  assert.equal(await run(horse, "old", {}, () => {}, () => {}), null);
  rejectWrite(failure);
  await assert.rejects(first, failure);
  assert.equal(attempts, 1);
  assert.equal(calls.length, 0);
  const retry = run(horse, "old", {}, () => {}, () => {});
  rejectWrite(failure);
  await assert.rejects(retry, failure);
  assert.equal(attempts, 2);
});

test("reload failure retains the saved ID and stops health synchronization", async () => {
  let savedId;
  const { calls, run } = setup([], { injuries: async () => { throw new Error("Reload failed"); } });
  await assert.rejects(run(horse, "old", { recovery_status: "Recovered" }, saved => { savedId = saved.id; }, () => assert.fail("incomplete reload")), /Reload failed/);
  assert.equal(savedId, "new-id");
  assert.ok(!calls.some(call => call[0] === "health"));
});
