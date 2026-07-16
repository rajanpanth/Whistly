import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.PW_BASE_URL || "http://localhost:3000";
const outputDir = path.resolve(process.cwd(), "..", "demo-video");
const outputPath = path.join(outputDir, "whistly-matchday-real-data-broll.webm");
const executablePath = process.env.PW_CHROMIUM_EXECUTABLE ||
  "C:\\Users\\panth\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe";

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: outputDir, size: { width: 1440, height: 900 } },
  locale: "en-US",
  timezoneId: "UTC",
});
const page = await context.newPage();
const video = page.video();

await page.goto(`${baseUrl}/matchday`, { waitUntil: "domcontentloaded" });
await page.locator(".fan-fixture-card").first().waitFor({ state: "visible" });
await page.waitForTimeout(2500);
await page.mouse.wheel(0, 470);
await page.waitForTimeout(1700);
await page.mouse.wheel(0, -470);
await page.waitForTimeout(1200);

await page.goto(`${baseUrl}/matchday/replay`, { waitUntil: "domcontentloaded" });
const recentFixture = page.locator(".fan-replay-picks button").first();
await recentFixture.waitFor({ state: "visible", timeout: 30_000 });
await recentFixture.click();
await page.getByRole("button", { name: "Load replay" }).click();
await page.locator(".fan-replay-stage").waitFor({ state: "visible", timeout: 60_000 });
await page.waitForTimeout(2200);
const slider = page.locator('.fan-replay-slider input[type="range"]');
const maximum = Number(await slider.getAttribute("max"));
await slider.fill(String(Math.floor(maximum * 0.55)));
await page.waitForTimeout(1800);
await slider.fill(String(maximum));
await page.waitForTimeout(1800);
await page.mouse.wheel(0, 420);
await page.waitForTimeout(1500);

await page.goto(`${baseUrl}/fan-leaderboard`, { waitUntil: "domcontentloaded" });
await page.getByRole("heading", { name: "Join a friend room" }).waitFor({ state: "visible" });
await page.waitForTimeout(1800);

await context.close();
await video.saveAs(outputPath);
await browser.close();
console.log(outputPath);
