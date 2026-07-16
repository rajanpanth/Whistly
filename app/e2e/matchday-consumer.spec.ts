import { expect, test, type Page } from "@playwright/test";

const now = Date.UTC(2026, 6, 16, 15, 0, 0);
const fixture = {
  fixtureId: "demo-live",
  homeTeam: "France",
  awayTeam: "England",
  competition: "World Cup · Semi-final",
  status: "LIVE",
  clockSeconds: 3_780,
  homeScore: 1,
  awayScore: 1,
  startTimeMs: Date.UTC(2026, 6, 16, 13, 30),
  updatedAt: new Date(now).toISOString(),
  lastUpdateMs: now,
  source: "txline",
  stale: false,
  events: [{ id: "goal-1", type: "GOAL", clockSeconds: 3_600, team: "HOME", scoreAfter: "1-1" }],
};

async function mockFanApi(page: Page) {
  await page.route("**/api/fan/fixtures", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ fixtures: [fixture], source: "txline" }),
  }));
  await page.route("**/api/fan/challenges/demo-live", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      fixture,
      storage: "supabase",
      challenges: [
        { id: "gw:demo:5", fixtureId: "demo-live", challengeType: "GOAL_WINDOW", durationMinutes: 5, startTs: now, endTs: now + 300_000, startClockSeconds: 3_780, startHomeScore: 1, startAwayScore: 1, endHomeScore: null, endAwayScore: null, status: "OPEN", winningOutcome: null, resolutionSource: "txline", resolvedAt: null, createdAt: now },
        { id: "gw:demo:15", fixtureId: "demo-live", challengeType: "GOAL_WINDOW", durationMinutes: 15, startTs: now, endTs: now + 900_000, startClockSeconds: 3_780, startHomeScore: 1, startAwayScore: 1, endHomeScore: null, endAwayScore: null, status: "OPEN", winningOutcome: null, resolutionSource: "txline", resolvedAt: null, createdAt: now },
      ],
    }),
  }));
  await page.route("**/api/fan/reactions?fixtureId=demo-live", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ counts: { GOAL: 12, APPLAUSE: 8 } }) }));
}

test("Matchday discovery is responsive and visibly TxLINE-backed", async ({ page }) => {
  await mockFanApi(page);
  await page.goto("/matchday");
  await expect(page.getByText("TxLINE Connected")).toBeVisible();
  await expect(page.getByRole("link", { name: /France.*England/ })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page).toHaveScreenshot(`matchday-discovery-${test.info().project.name}.png`, { fullPage: true });
});

test("live companion exposes goal challenges, timeline, rooms, and reactions", async ({ page }) => {
  await mockFanApi(page);
  await page.goto("/matchday/demo-live");
  await expect(page.getByRole("heading", { name: "Make your pick" })).toBeVisible();
  await expect(page.getByText("Will there be a goal in the next 5 minutes?")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Live timeline" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Celebrate" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create friend room" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page).toHaveScreenshot(`matchday-live-${test.info().project.name}.png`, {
    fullPage: true,
    mask: [page.locator(".fan-challenge header b"), page.locator(".fan-feed-state span")],
  });
});
