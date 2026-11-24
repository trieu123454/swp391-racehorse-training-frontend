const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const source = fs.readFileSync(path.join(__dirname, "../src", file), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled)(ref => {
    if (ref === "@/routes/Routes") return load("routes.tsx");
    if (ref === "@/lib/roles") return load("lib/roles.ts");
    return require(ref);
  }, module, module.exports);
  cache.set(file, module.exports);
  return module.exports;
}
const { sidebarSections } = load("constants/workspace-navigation.ts");
const { roleRoutes } = load("lib/roles.ts");

test("sidebar routes stay within the signed-in role and never expose notifications", () => {
  for (const [role, route] of Object.entries(roleRoutes)) {
    const sections = sidebarSections(role, 12);
    const entries = sections.flatMap(section => section.items.flatMap(item => item.children ?? [item]));
    assert.equal(new Set(entries.map(item => item.key)).size, entries.length);
    assert.ok(entries.every(item => !item.href.includes("notifications")));
    assert.ok(entries.filter(item => item.href.startsWith("/dashboard/")).every(item => item.href.split("?")[0] === route));
    assert.equal(entries.some(item => item.key === "users"), role === "CLUB_MANAGER");
    assert.equal(entries.some(item => item.key === "horse-records"), role !== "HORSE_OWNER");
  }
});

test("veterinary medical links are grouped without leaking head-vet dispatch to ordinary vets", () => {
  for (const role of ["VETERINARIAN", "HEAD_VETERINARIAN"]) {
    const work = sidebarSections(role)[0].items;
    const medical = work.find(item => item.key === "medical-group");
    assert.deepEqual(medical.children.map(item => item.key), ["exams", "medical", "injuries"]);
    assert.equal(work.some(item => item.key === "dispatch"), role === "HEAD_VETERINARIAN");
  }
  assert.equal(sidebarSections("CLUB_MANAGER", 12)[0].items.find(item => item.key === "horse-requests").badge, 12);
});
