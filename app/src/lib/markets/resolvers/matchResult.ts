/** Match Result resolver — stub for future implementation */
import type { ResolverResult } from "./types";

export function resolveMatchResult(
  fixtureId: string,
  homeScore: number,
  awayScore: number,
  expectedOutcome: "HOME" | "AWAY" | "DRAW"
): ResolverResult {
  const actual = homeScore > awayScore ? "HOME" : awayScore > homeScore ? "AWAY" : "DRAW";
  const yesWon = actual === expectedOutcome;
  return {
    outcome: yesWon ? "YES" : "NO",
    winningOptionIndex: yesWon ? 1 : 0,
    evidence: {
      fixtureId,
      marketFamily: "MatchResult",
      endScore: `${homeScore}-${awayScore}`,
      source: "MOCK",
      proofStatus: "demo",
    },
  };
}
