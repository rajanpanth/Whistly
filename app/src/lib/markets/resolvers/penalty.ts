/** Penalty resolver — stub. Penalty awarded != penalty scored. */
import type { ResolverResult } from "./types";

export function resolvePenalty(
  fixtureId: string,
  penaltyDetected: boolean
): ResolverResult {
  return {
    outcome: penaltyDetected ? "YES" : "NO",
    winningOptionIndex: penaltyDetected ? 1 : 0,
    evidence: {
      fixtureId,
      marketFamily: "Penalty",
      eventType: "PENALTY",
      source: "MOCK",
      proofStatus: "demo",
    },
  };
}
