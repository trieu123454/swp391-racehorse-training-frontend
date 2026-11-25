const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const ts = require("typescript");

function loadHorseSearchHelpers() {
  const source = fs.readFileSync(
    path.join(__dirname, "../src/lib/horse-search.ts"),
    "utf8",
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const mod = { exports: {} };
  new Function("require", "module", "exports", compiled)(require, mod, mod.exports);
  return mod.exports;
}

const sampleHorses = [
  {
    id: "h-1",
    horse_name: "Ngựa Đỏ",
    breed: "Arabian",
    box_code: "A-03",
    section: "Stable A",
    microchip_number: "CHIP-101",
    passport_number: "PP-101",
    current_status: "Healthy",
  },
  {
    id: "h-2",
    horse_name: "Ngựa Đỏ",
    breed: "Thoroughbred",
    stable_box: { id: "b-2", box_code: "B-07", section: "Stable B" },
    microchip_number: "CHIP-999",
    passport_number: "PP-999",
    current_status: "Injured",
  },
  {
    id: "h-3",
    horse_name: "Silver Thunder",
    breed: "Mustang",
    current_status: "Under Observation",
  },
];

test("filterSearchableHorses supports accent-insensitive queries and disambiguates duplicate names", () => {
  const { filterSearchableHorses } = loadHorseSearchHelpers();
  assert.equal(filterSearchableHorses(sampleHorses, { query: "ngua do" }).length, 2);
  assert.deepEqual(
    filterSearchableHorses(sampleHorses, { query: "CHIP-999" }).map((h) => h.id),
    ["h-2"],
  );
  assert.deepEqual(
    filterSearchableHorses(sampleHorses, { query: "a-03" }).map((h) => h.id),
    ["h-1"],
  );
});

test("filterSearchableHorses filters by normalized status and stable box", () => {
  const { extractStableOptions, filterSearchableHorses } = loadHorseSearchHelpers();
  const options = extractStableOptions(sampleHorses);
  assert.deepEqual(options.map((o) => o.value), ["A-03", "B-07", "__UNASSIGNED__"]);

  assert.deepEqual(
    filterSearchableHorses(sampleHorses, { status: "Monitoring" }).map((h) => h.id),
    ["h-3"],
  );
  assert.deepEqual(
    filterSearchableHorses(sampleHorses, { stable: "B-07" }).map((h) => h.id),
    ["h-2"],
  );
  assert.deepEqual(
    filterSearchableHorses(sampleHorses, { stable: "__UNASSIGNED__" }).map((h) => h.id),
    ["h-3"],
  );
});

test("filterSearchableHorses filters by competition readiness_status", () => {
  const { filterSearchableHorses } = loadHorseSearchHelpers();
  const horsesWithReadiness = [
    { ...sampleHorses[0], readiness_status: "Ready" },
    { ...sampleHorses[1], readiness_status: "NotReady" },
    { ...sampleHorses[2], readiness_status: null },
  ];
  assert.deepEqual(
    filterSearchableHorses(horsesWithReadiness, { readiness: "Ready" }).map((h) => h.id),
    ["h-1"],
  );
  assert.deepEqual(
    filterSearchableHorses(horsesWithReadiness, { readiness: "NotReady" }).map((h) => h.id),
    ["h-2"],
  );
  assert.deepEqual(
    filterSearchableHorses(horsesWithReadiness, { readiness: "Unknown" }).map((h) => h.id),
    ["h-3"],
  );
});
