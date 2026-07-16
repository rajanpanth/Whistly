import { test, expect, Page } from "@playwright/test";

/**
 * HOMEPAGE FREEZE GUARD
 *
 * `/` must remain visually unchanged while the internal trading
 * experience is rebuilt. These baselines were captured before any
 * V2 work started. If this test fails, a change leaked into the
 * homepage — fix the leak, do NOT update the baselines without
 * explicit approval.
 *
 * Masked regions (time-varying by design, not layout):
 *  - .market-countdown  — second-by-second odometer digits
 *  - .market-chart      — live pool chart with wall-clock labels
 */
/**
 * Time-varying regions masked out of the pixel comparison:
 *  - .market-countdown       — second-by-second odometer digits
 *  - .market-chart           — live pool chart with wall-clock labels
 *  - .market-featured        — rotating featured-market carousel card
 *  - .market-featured-dots   — its 250ms progress indicator
 * Everything else on `/` is static demo data and must not move.
 */
const MASKED = [
  ".market-countdown",
  ".market-chart",
  ".market-featured",
  ".market-featured-dots",
];

async function settle(page: Page) {
  // Live API data (TxLINE fixtures, polls) changes run to run and even
  // resizes sections. Abort all internal API calls so every component
  // renders its deterministic fallback/empty state — we are guarding
  // the homepage DESIGN, not its live data.
  await page.route("**/api/**", (route) => route.abort());
  // Next dev keeps an HMR connection open, so `networkidle` may never fire.
  // DOM readiness + a visible main landmark is the stable layout boundary.
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.locator("main").waitFor({ state: "visible" });
  // Let fonts/images and the initial data pass finish.
  await page.waitForTimeout(1500);
}

test("homepage desktop 1440x900 is unchanged", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop only");
  await settle(page);
  await expect(page).toHaveScreenshot("homepage-desktop.png", {
    fullPage: true,
    mask: MASKED.map((s) => page.locator(s)),
  });
});

test("homepage mobile 390x844 is unchanged", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "mobile only");
  await settle(page);
  await expect(page).toHaveScreenshot("homepage-mobile.png", {
    fullPage: true,
    mask: MASKED.map((s) => page.locator(s)),
  });
});

test("homepage section skeleton is unchanged", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop only");
  await settle(page);
  // Structural fingerprint: the ordered list of top-level sections/classes
  // inside <main>. Catches DOM-level regressions screenshots might miss.
  const skeleton = await page.evaluate(() => {
    const main = document.querySelector("main");
    if (!main) return "NO_MAIN";
    const lines: string[] = [];
    const walk = (el: Element, depth: number) => {
      if (depth > 4) return;
      const cls = (el.className || "").toString().trim().split(/\s+/)[0];
      lines.push(`${"  ".repeat(depth)}${el.tagName.toLowerCase()}${cls ? "." + cls : ""}`);
      for (const child of Array.from(el.children)) walk(child, depth + 1);
    };
    walk(main, 0);
    return lines.join("\n");
  });
  expect(skeleton).toMatchSnapshot("homepage-skeleton.txt");
});
