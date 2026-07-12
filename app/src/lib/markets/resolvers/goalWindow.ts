/**
 * Goal Window resolver — re-exports the existing working resolver
 * from liveGoalMarkets.ts with ResolverResult adapter.
 */
import { resolveGoalWindowMarket, type GoalWindowResolutionInput } from "@/lib/liveGoalMarkets";
import type { ResolverResult } from "./types";

export function resolveGoalWindow(
  fixtureId: string,
  input: GoalWindowResolutionInput
): ResolverResult {
  const result = resolveGoalWindowMarket(input);
  return {
    outcome: result.resolvedOutcome,
    winningOptionIndex: result.winningOptionIndex,
    evidence: {
      fixtureId,
      marketFamily: "GoalWindow",
      startScore: `${input.startHomeScore}-${input.startAwayScore}`,
      endScore: `${input.endHomeScore}-${input.endAwayScore}`,
      source: "MOCK",
      proofStatus: "demo",
    },
  };
}
