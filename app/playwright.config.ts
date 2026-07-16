import { defineConfig, devices } from "@playwright/test";

/**
 * Visual-regression config for Whistly.
 *
 * The homepage `/` is FROZEN — its baselines live in
 * e2e/__screenshots__ and any diff is a build-blocking failure.
 *
 * Run:  npx playwright test
 * Update baselines (only when a homepage change is explicitly approved):
 *       npx playwright test --update-snapshots
 */
export default defineConfig({
  testDir: "./e2e",
  outputDir: "./e2e/test-results",
  fullyParallel: true,
  retries: 0,
  timeout: 60_000,
  expect: {
    toHaveScreenshot: {
      // Freeze CSS animations/transitions so captures are deterministic.
      animations: "disabled",
      caret: "hide",
      // Tolerate sub-pixel AA differences only.
      maxDiffPixelRatio: 0.002,
    },
  },
  snapshotPathTemplate:
    "{testDir}/__screenshots__/{testFilePath}/{arg}{ext}",
  use: {
    baseURL: process.env.PW_BASE_URL || "http://localhost:3005",
    timezoneId: "UTC",
    locale: "en-US",
    // CI normally uses Playwright's headless shell. Local environments can
    // point at the bundled full Chromium when that smaller shell is absent.
    launchOptions: process.env.PW_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PW_CHROMIUM_EXECUTABLE }
      : undefined,
  },
  // Reuse an already-running dev server at PW_BASE_URL. Never spawn a second
  // `next dev` against the same .next directory — two dev servers sharing
  // .next corrupt the build manifest (ENOENT app-build-manifest.json).
  webServer: {
    command:
      "node -e \"console.log('reusing existing dev server; not spawning a second one')\"",
    url: process.env.PW_BASE_URL || "http://localhost:3005",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "mobile",
      use: {
        // iPhone-13-sized viewport, but rendered with Chromium so visual
        // diffs use one engine across desktop and mobile.
        ...devices["iPhone 13"],
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
      },
    },
  ],
});
