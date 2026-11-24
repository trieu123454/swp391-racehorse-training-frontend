// Manual UI smoke test: requires frontend on port 3000; API and SSE transport are mocked.
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const { chromium } = require("playwright-core");
const assert = require("node:assert/strict");

(async () => {
  const browser = await chromium.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.clock.install({ time: new Date("2026-11-24T03:00:00Z") });
    const user = { id: 5, fullName: "Dat Tran", email: "vet@example.test", roleName: "HEAD_VETERINARIAN", status: "APPROVED" };
    await page.addInitScript(user => {
      for (const [key, value] of Object.entries({ apiBase: "http://localhost:8080", legacySessionCleared: "true", accessToken: "test", user: JSON.stringify(user) })) sessionStorage.setItem(`racehorse.${key}`, value);
      const nativeFetch = window.fetch.bind(window);
      window.__bellRings = 0;
      const nativeAnimate = Element.prototype.animate;
      Element.prototype.animate = function (...args) { if (this.classList.contains("notification-bell")) window.__bellRings++; return nativeAnimate.apply(this, args); };
      window.fetch = (input, options) => {
        if (String(input).endsWith("/api/notifications/stream")) {
          const stream = new ReadableStream({ start(controller) {
            window.__pushNotifications = revision => { try { controller.enqueue(new TextEncoder().encode(`event: notifications\ndata: ${JSON.stringify({ revision })}\n\n`)); } catch {} };
            options.signal.addEventListener("abort", () => { try { controller.close(); } catch {} });
          } });
          return Promise.resolve(new Response(stream, { headers: { "Content-Type": "text/event-stream" } }));
        }
        return nativeFetch(input, options);
      };
    }, user);

    const now = Date.parse("2026-11-24T03:00:00Z");
    let items = Array.from({ length: 27 }, (_, index) => ({
      id: `n${index}`, message: index === 0 ? "\n\n  Golden Boy có lịch chăm sóc quá hạn. " + "Cần kiểm tra móng và cập nhật kết quả chăm sóc. ".repeat(6) : `Lịch chăm sóc số ${index}`,
      related_table: "Periodic_Care_Schedules", related_id: "s1", is_read: index >= 12, scheduled_at: null,
      created_at: new Date(now - (index >= 6 ? 86400000 : 0) - index * 60000).toISOString(),
    }));
    const horses = [{ id: "h1", horse_name: "Golden Boy", current_status: "Healthy", readiness_status: "Ready", stable_box: null }];
    const mutations = [];
    await page.route("http://localhost:8080/**", async route => {
      const request = route.request(), url = new URL(request.url()), path = url.pathname;
      let body = { data: [], total: 0, page: 1, limit: 100, unread_count: 0, context_events: [] };
      if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*" } });
      if (path === "/api/auth/me") body = user;
      else if (path === "/api/vet/health-overview") body = { counts: {}, horses };
      else if (path === "/api/veterinarians") body = [{ id: 5, name: user.fullName, email: user.email }];
      else if (path === "/api/notifications") {
        const filtered = items.filter(item => url.searchParams.get("unread_only") !== "true" || !item.is_read).sort((a, b) => b.created_at.localeCompare(a.created_at));
        const size = Number(url.searchParams.get("limit") || 20), page = Number(url.searchParams.get("page") || 1);
        body = { data: filtered.slice((page - 1) * size, page * size), total: filtered.length, unread_count: items.filter(item => !item.is_read).length };
      } else if (path.endsWith("/target")) body = { horse_id: "h1", schedule_id: "s1", event_date: "2026-11-24" };
      else if (path === "/api/notifications/read-all") { mutations.push(path); items.forEach(item => item.is_read = true); body = { updated: 12 }; }
      else if (path.endsWith("/read")) { mutations.push(path); items.find(item => item.id === path.split("/").at(-2)).is_read = true; body = {}; }
      else if (request.method() === "DELETE") { mutations.push(path); items = items.filter(item => item.id !== path.split("/").at(-1)); return route.fulfill({ status: 204, headers: { "Access-Control-Allow-Origin": "*" } }); }
      return route.fulfill({ status: 200, json: body, headers: { "Access-Control-Allow-Origin": "*" } });
    });
    const count = async (selector, count) => page.waitForFunction(({ selector, count }) => document.querySelectorAll(selector).length === count, { selector, count });
    const bell = page.locator(".notification-bell");
    await page.goto("http://localhost:3000/dashboard/head-veterinarian", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Thông báo, 12 chưa đọc", exact: true }).waitFor();
    assert.equal(await bell.locator(".notification-bell-badge").innerText(), "9+");
    assert.equal(await page.locator(".horse-sidebar").getByText("Thông báo", { exact: true }).count(), 0);
    await bell.click();
    const dialog = page.getByRole("dialog", { name: "Thông báo", exact: true });
    await dialog.waitFor(); await count(".notification-item", 12);
    assert.ok(Math.abs((await dialog.boundingBox()).width - 380) < 2);
    const description = dialog.locator(".notification-item-description").first();
    assert.match(await description.innerText(), /Golden Boy có lịch chăm sóc quá hạn/);
    assert.equal(Math.round((await description.boundingBox()).height), 40);
    await dialog.getByRole("button", { name: "Xem thêm", exact: true }).first().click();
    assert.ok((await description.boundingBox()).height > 40);
    assert.equal(mutations.length, 0);
    await dialog.getByRole("button", { name: "Thu gọn", exact: true }).first().click();
    await page.screenshot({ path: join(tmpdir(), "racehorse-notifications-desktop.png") });
    await dialog.getByRole("tab", { name: "Tất cả", exact: true }).click(); await count(".notification-item", 20);
    await dialog.getByRole("button", { name: "Xem tất cả thông báo", exact: true }).click(); await count(".notification-item", 27);
    await page.keyboard.press("Tab");
    assert.equal(await dialog.evaluate(element => element.contains(document.activeElement)), true);
    await dialog.getByRole("tab", { name: /^Chưa đọc \(/ }).click(); await count(".notification-item", 12);
    await dialog.locator(".notification-item").first().hover();
    await dialog.locator(".notification-item").first().getByRole("button", { name: "Đánh dấu đã đọc", exact: true }).click(); await count(".notification-item", 11);
    await dialog.locator(".notification-item").first().hover();
    await dialog.locator(".notification-item").first().getByRole("button", { name: "Xóa thông báo", exact: true }).click(); await count(".notification-item", 10);
    await dialog.getByRole("button", { name: "Đánh dấu tất cả đã đọc", exact: true }).click();
    await dialog.getByText("Bạn đã xem hết thông báo", { exact: true }).waitFor();
    assert.equal(await bell.locator(".notification-bell-badge").count(), 0);
    await page.keyboard.press("Escape"); await dialog.waitFor({ state: "hidden" });
    await page.waitForFunction(() => document.activeElement?.classList.contains("notification-bell"));

    items.unshift({ id: "new", related_id: "s1", related_table: "Periodic_Care_Schedules", message: "Golden Boy có lịch quá hạn mới", is_read: false, scheduled_at: null, created_at: new Date(now + 1000).toISOString() });
    await page.evaluate(() => window.__pushNotifications(99));
    await page.getByRole("button", { name: "Thông báo, 1 chưa đọc", exact: true }).waitFor();
    assert.equal(await dialog.count(), 0); assert.ok(await page.evaluate(() => window.__bellRings) >= 1);
    await bell.click(); await count(".notification-item", 1);
    await dialog.locator(".notification-item-open").press("Enter");
    await page.waitForURL(/tab=dispatch/);
    await page.locator("tr[data-notification-target='h1'].notification-target-highlight").waitFor();
    await page.waitForFunction(() => !document.querySelector(".notification-target-highlight"), { timeout: 5000 });
    assert.ok(mutations.some(path => path.endsWith("/new/read")));

    await page.goto("http://localhost:3000/notifications", { waitUntil: "domcontentloaded" });
    await page.waitForURL(/dashboard\/head-veterinarian/); await dialog.waitFor();
    await page.mouse.click(700, 800); await dialog.waitFor({ state: "hidden" });
    await page.goto("http://localhost:3000/dashboard/head-veterinarian?tab=notifications", { waitUntil: "domcontentloaded" });
    await dialog.waitFor(); assert.ok(!page.url().includes("tab=notifications"));
    await page.setViewportSize({ width: 390, height: 844 });
    const bounds = await dialog.boundingBox();
    assert.ok(Math.abs(bounds.width - 390) < 2); assert.ok(bounds.height <= 844 * .8 + 2);
    await page.screenshot({ path: join(tmpdir(), "racehorse-notifications-mobile.png") });
    assert.equal(await page.evaluate(() => document.body.style.overflow), "hidden");
    await dialog.getByRole("button", { name: "Đóng thông báo", exact: true }).click(); await dialog.waitFor({ state: "hidden" });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const rings = await page.evaluate(() => window.__bellRings);
    items.unshift({ id: "reduced", related_id: "s1", related_table: "Periodic_Care_Schedules", message: "Lịch chăm sóc mới", is_read: false, scheduled_at: null, created_at: new Date(now + 2000).toISOString() });
    await page.evaluate(() => window.__pushNotifications(100));
    await page.getByRole("button", { name: "Thông báo, 1 chưa đọc", exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.__bellRings), rings);
    // Structured content and priority are checked separately from legacy compatibility above.
    await page.setViewportSize({ width: 1440, height: 900 });
    items = [
      { id: "care", type: "CARE_ASSIGNED", title: "Lịch chăm sóc mới", params: { horse_name: "Golden Boy", event_date: "2026-11-22", start_time: "07:00:00", care_label: "Kiểm tra móng" }, link: "/dashboard/head-veterinarian?tab=care&horse=h1", created_at: "2026-11-22T00:00:00Z", is_read: false },
      { id: "role", type: "ROLE_CHANGED", params: { old_role: "VETERINARIAN", new_role: "HEAD_VETERINARIAN" }, created_at: "2026-11-24T02:59:00Z", is_read: false },
      { id: "lock", type: "ACCOUNT_LOCKED", params: {}, created_at: "2026-11-24T02:58:00Z", is_read: false },
      { id: "unlock", type: "ACCOUNT_UNLOCKED", params: {}, created_at: "2026-11-23T02:59:00Z", is_read: false },
      { id: "old-account", type: "ACCOUNT_APPROVED", params: {}, created_at: "2026-11-01T02:59:00Z", is_read: false },
      { id: "read-account", type: "ACCOUNT_UNLOCKED", params: {}, created_at: "2026-11-24T01:00:00Z", is_read: true },
    ].map(item => ({ message: "", related_table: item.type.startsWith("CARE") ? "Calendar_Events" : "users", related_id: item.id, scheduled_at: null, ...item }));
    await page.evaluate(() => window.__pushNotifications(101));
    await page.getByRole("button", { name: "Thông báo, 5 chưa đọc", exact: true }).waitFor();
    const beforeOpen = mutations.length;
    await bell.click(); await count(".notification-item", 4);
    await dialog.getByRole("tab", { name: "Chưa đọc (5)", exact: true }).waitFor();
    assert.equal(mutations.length, beforeOpen);
    assert.equal(await dialog.getByRole("button", { name: "Đóng thông báo", exact: true }).isVisible(), false);
    assert.ok(Math.abs((await dialog.boundingBox()).x + (await dialog.boundingBox()).width - (await bell.boundingBox()).x - (await bell.boundingBox()).width) < 2);
    assert.match(await dialog.locator(".notification-item").first().innerText(), /Lịch chăm sóc mới/);
    await dialog.getByText(/22\/11\/2026 lúc 07:00/).waitFor();
    assert.match(await dialog.innerText(), /từ Bác sĩ thú y sang Trưởng ban thú y/);
    assert.doesNotMatch(await dialog.innerText(), /VETERINARIAN|Club Manager|Lý do:/);
    assert.equal(await dialog.locator("time").first().getAttribute("title"), "22/11/2026 lúc 07:00");
    await dialog.getByRole("button", { name: "Xem lịch", exact: true }).waitFor();
    await dialog.getByRole("button", { name: "Thông báo tài khoản cũ (1)", exact: true }).click();
    await count(".notification-item", 5);
    await dialog.getByRole("tab", { name: "Tất cả", exact: true }).click();
    await count(".notification-item", 6);
    const readTitle = dialog.locator(".notification-item:not(.is-unread) .notification-item-title");
    assert.equal(await readTitle.evaluate(el => getComputedStyle(el).fontWeight), "400");
    assert.equal(await dialog.locator(".notification-item.is-unread .notification-item-title").first().evaluate(el => getComputedStyle(el).fontWeight), "600");
    await page.screenshot({ path: join(tmpdir(), "racehorse-notifications-structured.png") });
    await page.keyboard.press("Escape");
    items = [
      { id: "legacy-training", message: "Ban duoc phan cong buoi tap Golden Boy vao 2026-11-24 luc 07:00", related_table: "Training_Schedules" },
      { id: "legacy-registration", message: "Horse registration APPROVED", related_table: "horse_registration_requests" },
      { id: "legacy-injury", message: "Horse Golden Boy has an active injury marker at Chân trái; training has been locked.", related_table: "Horses" },
    ].map(item => ({ related_id: item.id, is_read: false, created_at: "2026-11-24T02:59:00Z", scheduled_at: null, ...item }));
    await page.evaluate(() => window.__pushNotifications(102));
    await page.getByRole("button", { name: "Thông báo, 3 chưa đọc", exact: true }).waitFor();
    await bell.click(); await count(".notification-item", 3);
    assert.match(await dialog.innerText(), /Bạn được phân công buổi tập của ngựa Golden Boy/);
    assert.match(await dialog.innerText(), /Yêu cầu đăng ký ngựa đã phê duyệt/);
    assert.match(await dialog.innerText(), /chấn thương tại Chân trái; đã khóa huấn luyện/);
    assert.doesNotMatch(await dialog.innerText(), /Ban duoc|Horse registration|APPROVED|training has been locked/);
    await page.screenshot({ path: join(tmpdir(), "racehorse-notifications-vietnamese.png") });
    assert.deepEqual(errors, []);
    console.log("PASS: badge 9+/zero; sidebar removed; unread/all + pagination; read/delete/read-all server calls; SSE updates and rings without opening; Enter navigation + 2s highlight; legacy redirects; Esc/outside/focus; mobile bottom sheet. Mock transport/API.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
