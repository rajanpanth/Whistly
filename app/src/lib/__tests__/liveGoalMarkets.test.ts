import { resolveGoalWindowMarket } from "@/lib/liveGoalMarkets";

describe("resolveGoalWindowMarket", () => {
  it("resolves 0-0 to 0-0 as NO", () => {
    expect(resolveGoalWindowMarket({
      startHomeScore: 0,
      startAwayScore: 0,
      endHomeScore: 0,
      endAwayScore: 0,
    })).toMatchObject({
      resolvedOutcome: "NO",
      winningOptionIndex: 0,
      startTotalGoals: 0,
      endTotalGoals: 0,
    });
  });

  it("resolves 1-1 to 1-1 as NO", () => {
    expect(resolveGoalWindowMarket({
      startHomeScore: 1,
      startAwayScore: 1,
      endHomeScore: 1,
      endAwayScore: 1,
    }).resolvedOutcome).toBe("NO");
  });

  it("resolves 1-1 to 2-1 as YES", () => {
    expect(resolveGoalWindowMarket({
      startHomeScore: 1,
      startAwayScore: 1,
      endHomeScore: 2,
      endAwayScore: 1,
    })).toMatchObject({
      resolvedOutcome: "YES",
      winningOptionIndex: 1,
      startTotalGoals: 2,
      endTotalGoals: 3,
    });
  });

  it("resolves 0-2 to 1-2 as YES", () => {
    expect(resolveGoalWindowMarket({
      startHomeScore: 0,
      startAwayScore: 2,
      endHomeScore: 1,
      endAwayScore: 2,
    }).resolvedOutcome).toBe("YES");
  });

  it("resolves 2-2 to 3-3 as YES", () => {
    expect(resolveGoalWindowMarket({
      startHomeScore: 2,
      startAwayScore: 2,
      endHomeScore: 3,
      endAwayScore: 3,
    })).toMatchObject({
      resolvedOutcome: "YES",
      winningOptionIndex: 1,
      startTotalGoals: 4,
      endTotalGoals: 6,
    });
  });
});
