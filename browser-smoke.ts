import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const root = import.meta.dirname;
await mkdir("build-reports", { recursive: true });
const allowed = new Set([
  "index.html",
  "status.css",
  "status.js",
  "status.json",
]);
const server = Bun.serve({
  port: 0,
  hostname: "127.0.0.1",
  fetch(request) {
    const path = new URL(request.url).pathname.slice(1) || "index.html";
    return allowed.has(path)
      ? new Response(Bun.file(`${root}/dist/${path}`))
      : new Response(null, { status: 404 });
  },
});
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`http://127.0.0.1:${server.port}`);
    await page
      .locator("#freshness")
      .filter({ hasText: "Recent observations." })
      .waitFor();
    if (
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      )
    )
      throw new Error("horizontal overflow");
    if ((await page.getByRole("heading", { level: 1 }).count()) !== 1)
      throw new Error("missing main heading");
    await page.keyboard.press("Tab");
    if (
      await page
        .locator(".skip")
        .evaluate((el) => el !== document.activeElement)
    )
      throw new Error("skip link not keyboard reachable");
    await page.screenshot({
      path: `${root}/build-reports/status-${width}.png`,
      fullPage: true,
    });
  }
  await page.addInitScript(() => {
    const now = Date.now();
    Date.now = () => now + 20 * 60 * 1000;
  });
  await page.reload();
  await page.locator("#freshness.stale").waitFor();
  if ((await page.locator(".badge.stale").count()) !== 10)
    throw new Error("stale observations still look current");
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(
    "Chromium PASS: 375/1280, no overflow, keyboard skip link, all10 stale badges, no JS/CSP errors.",
  );
} finally {
  await browser.close();
  server.stop();
}
