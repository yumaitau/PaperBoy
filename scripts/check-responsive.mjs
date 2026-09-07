import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

// Start a separate app against an explicitly supplied disposable test database.
assert.ok(process.env.PAPERBOY_TEST_DATABASE_URL, "PAPERBOY_TEST_DATABASE_URL must point to a migrated disposable database");
const port = process.env.PAPERBOY_RESPONSIVE_PORT ?? "3491";
const baseURL = `http://127.0.0.1:${port}`;
const server = spawn("bun", ["run", "start", "--hostname", "127.0.0.1", "--port", port], {
  env: {
    ...process.env,
    DATABASE_URL: process.env.PAPERBOY_TEST_DATABASE_URL,
    BETTER_AUTH_SECRET: randomUUID(),
    BETTER_AUTH_URL: baseURL,
    PAPERBOY_PUBLIC_SIGNUP_ENABLED: "true",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverLog = "";
for (const stream of [server.stdout, server.stderr]) {
  stream.on("data", (chunk) => { serverLog = (serverLog + chunk).slice(-4000); });
}
let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (server.exitCode !== null) throw new Error(serverLog);
    try {
      ready = (await fetch(`${baseURL}/sign-in`)).ok;
    } catch { /* The server is still starting. */ }
    if (ready) break;
    await delay(500);
  }
  assert.ok(ready, `App failed to start: ${serverLog}`);
  browser = await chromium.launch({
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {}),
  });
  const context = await browser.newContext();
  const response = await context.request.post(`${baseURL}/api/auth/sign-up/email`, {
    headers: { Origin: baseURL },
    data: {
      name: "Responsive layout review",
      email: `layout-${randomUUID()}@example.test`,
      password: randomUUID(),
    },
  });
  assert.equal(response.status(), 200, "Test account signup failed");
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  // Populate a real detail view, including an unbroken name that stresses grids.
  await page.goto(`${baseURL}/app/audiences`);
  await page.locator("#audience-name").fill(`WeeklyReaders${"x".repeat(80)}`);
  await page.getByRole("button", { name: "Create audience", exact: true }).click();
  await page.waitForURL(/saved=/);
  assert.equal(await page.getByRole("status").count(), 1);
  const plainInputs = await page.locator("input:not([type])").evaluateAll((elements) =>
    elements.map((element) => getComputedStyle(element).borderTopWidth),
  );
  assert.ok(plainInputs.length > 0, "Populated audience must include plain text inputs");
  assert.ok(plainInputs.every((width) => parseFloat(width) > 0), "Text inputs need visible borders");

  const routes = ["/app", "/app/api-keys", "/app/audiences", "/app/broadcasts", "/app/domains", "/app/logs", "/app/organization", "/app/send", "/app/settings", "/app/suppressions", "/app/templates", "/app/docs"];
  let checks = 0;
  if (process.env.PAPERBOY_SCREENSHOT_DIR) await mkdir(process.env.PAPERBOY_SCREENSHOT_DIR, { recursive: true });
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      const result = await page.goto(`${baseURL}${route}`);
      assert.equal(result.status(), 200, `${route} at ${width}px`);
      assert.ok(new URL(page.url()).pathname.startsWith("/app"), "Authentication was lost");
      await page.evaluate(() => document.fonts.ready);
      const size = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        content: document.documentElement.scrollWidth,
      }));
      assert.ok(size.content <= size.viewport + 1, `${route} at ${width}px overflows: ${JSON.stringify(size)}`);
      if (process.env.PAPERBOY_SCREENSHOT_DIR && [390, 1440].includes(width)) {
        await page.screenshot({ path: `${process.env.PAPERBOY_SCREENSHOT_DIR}/${route.split("/").at(-1)}-${width}.png`, fullPage: true });
      }
      checks++;
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseURL}/app`);
  await page.getByRole("button", { name: "Open navigation" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  const padding = await dialog.getByRole("button", { name: "Close navigation" }).evaluate((element) => getComputedStyle(element).paddingTop);
  assert.notEqual(padding, "0px", "Navigation spacing must survive the CSS reset");
  await dialog.getByRole("link", { name: "Templates", exact: true }).click();
  await page.waitForURL("**/app/templates");
  await dialog.waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await dialog.getByRole("link", { name: "Templates", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  assert.deepEqual(errors, [], "Browser runtime errors");
  console.log(`${checks} responsive page checks passed; drawer closes on new and current routes.`);
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
