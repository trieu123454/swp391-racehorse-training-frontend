const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const source = fs.readFileSync(path.join(__dirname, "../src/lib/display-format.ts"), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const exported = { exports: {} };
new Function("module", "exports", compiled)(exported, exported.exports);
const { formatDisplayDate, formatDoctorDisplayName, formatStableSection } = exported.exports;

test("stable sections show one Vietnamese prefix and remove imported Stable prefixes", () => {
  assert.equal(formatStableSection("Khu điều trị chấn thương"), "Khu điều trị chấn thương");
  assert.equal(formatStableSection("Khu Khu điều trị chấn thương"), "Khu điều trị chấn thương");
  assert.equal(formatStableSection("Stable A/B"), "Khu A/B");
  assert.equal(formatStableSection("Khu Stable A"), "Khu A");
});

test("doctor names keep accents, normalize whitespace and remove duplicate titles", () => {
  assert.equal(formatDoctorDisplayName("  BS. NGUYỄN   NGỌ HÂN "), "Nguyễn Ngọ Hân");
  assert.equal(formatDoctorDisplayName("dat tran"), "Dat Tran");
  assert.equal(formatDoctorDisplayName(null), "");
});

test("display dates use padded day/month/full year and preserve calendar-only dates", () => {
  assert.equal(formatDisplayDate("2026-11-02"), "02/11/2026");
  assert.equal(formatDisplayDate("2026-11-22T18:00:00Z"), "23/11/2026");
  assert.match(formatDisplayDate("2026-11-22T18:00:00Z", true), /23\/11\/2026/);
  assert.match(formatDisplayDate("2026-11-22T18:00:00Z", true), /01:00/);
  assert.equal(formatDisplayDate(null), "—");
});
