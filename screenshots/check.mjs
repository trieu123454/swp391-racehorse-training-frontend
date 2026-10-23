import { chromium } from "playwright-core";

const browser = await chromium.launch({
  headless: true,
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
});

for (const [name, width, height] of [["desktop", 1440, 900], ["mobile", 390, 844]]) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  for (const route of ["", "login", "register"]) {
    await page.goto(`http://localhost:3100/${route}`, { waitUntil: "networkidle" });
    if (!route) {
      await page.locator(".landing-operation-image").scrollIntoViewIfNeeded();
      await page.locator(".landing-operation-image img").evaluate(async (img) => {
        if (!img.complete) await new Promise((resolve) => img.addEventListener("load", resolve, { once: true }));
      });
      await page.evaluate(() => scrollTo(0, 0));
    }
    await page.waitForTimeout(1800);
    if (!route) {
      await page.locator(".landing-operation-image").screenshot({ path: `screenshots/horse-care-${name}.png` });
    }
    await page.screenshot({ path: `screenshots/${route || "home"}-${name}.png`, fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    console.log(`${route || "home"} ${name}: overflow=${overflow}; title=${await page.title()}`);
    if (route === "login") {
      const fields = await page.locator("input[type=email], input[type=password]").evaluateAll((inputs) =>
        inputs.map((input) => ({ type: input.getAttribute("type"), paddingLeft: getComputedStyle(input).paddingLeft }))
      );
      await page.locator("input[type=password]").focus();
      await page.keyboard.press("Tab");
      const visibilityFocused = await page.getByRole("button", { name: "Hiện mật khẩu" }).evaluate((button) => button === document.activeElement);
      console.log(`login ${name}: fields=${JSON.stringify(fields)}; visibility keyboard focus=${visibilityFocused}`);
    }
  }
  await page.close();
}

await browser.close();
