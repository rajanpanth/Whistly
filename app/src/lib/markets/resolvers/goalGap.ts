/** Goal Gap / Handicap resolver — stub for future implementation */
import type { ResolverResult } from "./types";

export function resolveGoalGap(
  fixtureId: string,
  homeScore: number,
  awayScore: number,
  minGap: number
): ResolverResult {
  const gap = Math.abs(homeScore - awayScore);
  const yesWon = gap >= minGap;
  return {
    outcome: yesWon ? "YES" : "NO",
    winningOptionIndex: yesWon ? 1 : 0,
    evidence: {
      fixtureId,
      marketFamily: "GoalGap",
      endScore: `${homeScore}-${awayScore}`,
      endStat: gap,
      source: "MOCK",
      proofStatus: "demo",
    },
  };
}
