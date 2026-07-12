/** Goal Total resolver — stub for future implementation */
import type { ResolverResult } from "./types";

export function resolveGoalTotal(
  fixtureId: string,
  totalGoals: number,
  threshold: number
): ResolverResult {
  const yesWon = totalGoals > threshold;
  return {
    outcome: yesWon ? "YES" : "NO",
    winningOptionIndex: yesWon ? 1 : 0,
    evidence: {
      fixtureId,
      marketFamily: "GoalTotal",
      endStat: totalGoals,
      source: "MOCK",
      proofStatus: "demo",
    },
  };
}
