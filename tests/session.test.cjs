const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function setup(fetch, sharedLocalStorage) {
  const storage = () => {
    const data = new Map();
    return { get length() { return data.size; }, key: index => [...data.keys()][index] ?? null, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
  };
  const localStorage = sharedLocalStorage ?? storage(), sessionStorage = storage(), cache = {};
  const context = vm.createContext({ window: { localStorage, sessionStorage, dispatchEvent: () => {} }, Event: class Event {}, CustomEvent: class CustomEvent {}, fetch, process: { env: {} } });
  function load(name) {
    if (cache[name]) return cache[name];
    const file = name === "api" ? "../src/apis/client.ts" : name === "session" ? "../src/stores/session.ts" : `../src/lib/${name}.ts`;
    const source = fs.readFileSync(path.join(__dirname, file), "utf8");
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    const module = { exports: {} };
    vm.runInContext(`(function(require,module,exports){${compiled}\n})`, context)(ref => load(ref.split("/").at(-1)), module, module.exports);
    return cache[name] = module.exports;
  }
  return { session: load("session"), api: load("api"), localStorage, sessionStorage };
}
const user = { id: 1, fullName: "Owner", email: "owner@example.com", roleName: "HORSE_OWNER", status: "APPROVED" };
const auth = { accessToken: "access", refreshToken: "refresh", user };
const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

test("sessions stay in the current tab and remember choice controls refresh credentials", () => {
  const { session, localStorage, sessionStorage } = setup();
  session.saveSession(auth);
  assert.equal(localStorage.getItem("racehorse.accessToken"), null);
  assert.equal(sessionStorage.getItem("racehorse.accessToken"), "access");
  assert.equal(session.getRefreshToken(), "refresh");
  assert.equal(session.isRemembered(), true);
  session.saveSession(auth, false);
  assert.equal(localStorage.getItem("racehorse.accessToken"), null);
  assert.equal(sessionStorage.getItem("racehorse.accessToken"), "access");
  assert.equal(session.getRefreshToken(), null);
  assert.equal(session.isRemembered(), false);
  session.clearSession();
  assert.equal(session.getAccessToken(), null);
});

test("server identity overrides forged cached role", async () => {
  const app = setup(async () => reply(200, user));
  app.session.saveSession({ ...auth, user: { ...user, roleName: "CLUB_MANAGER" } });
  assert.equal((await app.api.validateSession()).roleName, "HORSE_OWNER");
});

test("expired token is refreshed once for concurrent remembered callers", async () => {
  let refreshCalls = 0;
  const app = setup(async url => {
    if (url.endsWith("/me")) return reply(401, { message: "expired" });
    refreshCalls++;
    return reply(200, { ...auth, accessToken: "new-access" });
  });
  app.session.saveSession(auth, true);
  await Promise.all([app.api.validateSession(), app.api.validateSession()]);
  assert.equal(refreshCalls, 1);
  assert.equal(app.session.getAccessToken(), "new-access");
  assert.equal(app.session.isRemembered(), true);
  assert.equal(app.localStorage.getItem("racehorse.accessToken"), null);
});

test("protected request retries with a refreshed access token", async () => {
  const sent = [];
  const app = setup(async (url, options = {}) => {
    if (url.endsWith("/api/training-plans")) {
      sent.push(options.headers.Authorization);
      return sent.length === 1 ? reply(401, { message: "Authentication required" }) : reply(201, { id: "plan" });
    }
    if (url.endsWith("/api/auth/me")) return reply(401, { message: "Authentication required" });
    if (url.endsWith("/api/auth/refresh")) return reply(200, { ...auth, accessToken: "new-access" });
    throw new Error(`Unexpected request: ${url}`);
  });
  app.session.saveSession(auth);
  assert.equal((await app.api.authenticatedRequest("/api/training-plans", { method: "POST" })).id, "plan");
  assert.deepEqual(sent, ["Bearer access", "Bearer new-access"]);
});

test("unrecoverable protected request clears expired credentials", async () => {
  const app = setup(async url => reply(url.endsWith("/api/auth/refresh") ? 400 : 401,
    { message: "Authentication required" }));
  app.session.saveSession(auth);
  await assert.rejects(app.api.authenticatedRequest("/api/training-plans", { method: "POST" }),
    error => error.status === 401 && error.message.includes("đăng nhập lại"));
  assert.equal(app.session.getAccessToken(), null);
});

test("an expired nonremembered session requires login without attempting refresh", async () => {
  let calls = 0;
  const app = setup(async url => {
    calls++;
    assert.ok(url.endsWith("/me"));
    return reply(401, { message: "expired" });
  });
  app.session.saveSession(auth, false);
  await assert.rejects(app.api.validateSession(), error => error.status === 401);
  assert.equal(calls, 1);
  assert.equal(app.session.getAccessToken(), null);
});

test("logging out of one role tab preserves the other tab's credentials", async () => {
  const first = setup(async () => reply(200, user));
  const secondUser = { ...user, id: 2, roleName: "VETERINARIAN" };
  const second = setup(async () => reply(200, secondUser), first.localStorage);
  first.session.saveSession(auth);
  second.session.saveSession({ ...auth, accessToken: "vet-access", refreshToken: "vet-refresh", user: secondUser });
  first.session.clearSession();
  assert.equal(second.session.getAccessToken(), "vet-access");
  assert.equal(second.session.getRefreshToken(), "vet-refresh");
  assert.equal((await second.api.validateSession()).roleName, "VETERINARIAN");
});

test("shared credentials from legacy builds are removed without importing another tab's role", () => {
  const app = setup();
  app.localStorage.setItem("racehorse.accessToken", "legacy-access");
  app.localStorage.setItem("racehorse.refreshToken", "legacy-refresh");
  app.localStorage.setItem("racehorse.user", JSON.stringify(user));
  assert.equal(app.session.getAccessToken(), null);
  assert.equal(app.localStorage.getItem("racehorse.accessToken"), null);
  assert.equal(app.localStorage.getItem("racehorse.refreshToken"), null);
  assert.equal(app.localStorage.getItem("racehorse.user"), null);
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

test("changePassword uses authenticatedRequest and refreshes expired access token", async () => {
  const sent = [];
  const app = setup(async (url, options = {}) => {
    if (url.endsWith("/api/auth/change-password")) {
      sent.push(options.headers.Authorization);
      return sent.length === 1
        ? reply(401, { message: "Authentication required" })
        : reply(200, { ...auth, accessToken: "updated-access" });
    }
    if (url.endsWith("/api/auth/refresh")) {
      return reply(200, { ...auth, accessToken: "refreshed-access" });
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  app.session.saveSession(auth, true);
  const res = await app.api.changePassword("oldPass123", "newPass456");
  assert.equal(res.accessToken, "updated-access");
  assert.deepEqual(sent, ["Bearer access", "Bearer refreshed-access"]);
});

test("concurrent image lookups share one request and reuse the cached signed URL", async () => {
  let calls = 0;
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const app = setup(async () => {
    calls++;
    await pending;
    return reply(200, { hasImage: true, url: "https://images.example/horse.jpg?signature=test" });
  });
  app.session.saveSession(auth);
  const first = app.api.authenticatedRequest("/api/horses/h1/image");
  const second = app.api.authenticatedRequest("/api/horses/h1/image");
  release();
  const [a, b] = await Promise.all([first, second]);
  assert.equal(a.url, b.url);
  assert.equal(calls, 1);
  const cached = await app.api.authenticatedRequest("/api/horses/h1/image");
  assert.equal(cached.url, a.url);
  assert.equal(calls, 1);
});

test("horse changes invalidate cached image lookups", async () => {
  let imageCalls = 0;
  const app = setup(async (url, options = {}) => {
    if (options.method === "PATCH") return reply(200, { id: "h1" });
    imageCalls++;
    return reply(200, { hasImage: true, url: `https://images.example/${imageCalls}.jpg` });
  });
  app.session.saveSession(auth);
  const first = await app.api.authenticatedRequest("/api/horses/h1/image");
  await app.api.authenticatedRequest("/api/horses/h1", { method: "PATCH", body: "{}" });
  const next = await app.api.authenticatedRequest("/api/horses/h1/image");
  assert.notEqual(first.url, next.url);
  assert.equal(imageCalls, 2);
});

test("reading notifications preserves cached horse images and refreshes notification data", async () => {
  let imageCalls = 0, notificationCalls = 0;
  const app = setup(async (url, options = {}) => {
    if (options.method === "PATCH") return reply(200, {});
    if (url.includes("/notifications")) return reply(200, { unread_count: ++notificationCalls });
    imageCalls++;
    return reply(200, { hasImage: true, url: "https://images.example/horse.jpg" });
  });
  app.session.saveSession(auth);
  await app.api.authenticatedRequest("/api/horses/h1/image");
  await app.api.authenticatedRequest("/api/notifications?page=1");
  await app.api.authenticatedRequest("/api/notifications/n1/read", { method: "PATCH" });
  await app.api.authenticatedRequest("/api/horses/h1/image");
  await app.api.authenticatedRequest("/api/notifications?page=1");
  assert.equal(imageCalls, 1);
  assert.equal(notificationCalls, 2);
});
