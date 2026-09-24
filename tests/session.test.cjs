const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function setup(fetch) {
  const storage = () => {
    const data = new Map();
    return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
  };
  const localStorage = storage(), sessionStorage = storage(), cache = {};
  const context = vm.createContext({ localStorage, sessionStorage, fetch, process: { env: {} } });
  function load(name) {
    if (cache[name]) return cache[name];
    const source = fs.readFileSync(path.join(__dirname, "../lib", name + ".ts"), "utf8");
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    const module = { exports: {} };
    vm.runInContext(`(function(require,module,exports){${compiled}\n})`, context)(ref => load(ref.replace("./", "")), module, module.exports);
    return cache[name] = module.exports;
  }
  return { session: load("session"), api: load("api"), localStorage, sessionStorage };
}
const user = { id: 1, fullName: "Owner", email: "owner@example.com", roleName: "HORSE_OWNER", status: "APPROVED" };
const auth = { accessToken: "access", refreshToken: "refresh", user };
const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

test("remember choice controls storage and clears previous sessions", () => {
  const { session, localStorage, sessionStorage } = setup();
  session.saveSession(auth);
  assert.equal(localStorage.getItem("racehorse.accessToken"), "access");
  session.saveSession(auth, false);
  assert.equal(localStorage.getItem("racehorse.accessToken"), null);
  assert.equal(sessionStorage.getItem("racehorse.accessToken"), "access");
  session.clearSession();
  assert.equal(session.getAccessToken(), null);
});

test("server identity overrides forged cached role", async () => {
  const app = setup(async () => reply(200, user));
  app.session.saveSession({ ...auth, user: { ...user, roleName: "CLUB_MANAGER" } });
  assert.equal((await app.api.validateSession()).roleName, "HORSE_OWNER");
});

test("expired token is refreshed once for concurrent callers, preserving remember choice", async () => {
  let refreshCalls = 0;
  const app = setup(async url => {
    if (url.endsWith("/me")) return reply(401, { message: "expired" });
    refreshCalls++;
    return reply(200, { ...auth, accessToken: "new-access" });
  });
  app.session.saveSession(auth, false);
  await Promise.all([app.api.validateSession(), app.api.validateSession()]);
  assert.equal(refreshCalls, 1);
  assert.equal(app.session.getAccessToken(), "new-access");
  assert.equal(app.session.isRemembered(), false);
});

test("revoked refresh token clears session", async () => {
  const app = setup(async url => reply(url.endsWith("/me") ? 401 : 400, { message: "revoked" }));
  app.session.saveSession(auth);
  await assert.rejects(app.api.validateSession());
  assert.equal(app.session.getAccessToken(), null);
});

test("network failure preserves credentials and fails closed", async () => {
  const app = setup(async () => { throw new Error("offline"); });
  app.session.saveSession(auth);
  await assert.rejects(app.api.validateSession(), /offline/);
  assert.equal(app.session.getRefreshToken(), "refresh");
});
