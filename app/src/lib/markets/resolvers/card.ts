/** Card resolver — stub for future implementation */
import type { ResolverResult } from "./types";

export function resolveCard(
  fixtureId: string,
  cardDetected: boolean
): ResolverResult {
  return {
    outcome: cardDetected ? "YES" : "NO",
    winningOptionIndex: cardDetected ? 1 : 0,
    evidence: {
      fixtureId,
      marketFamily: "Card",
      eventType: "CARD",
      source: "MOCK",
      proofStatus: "demo",
    },
  };
}
