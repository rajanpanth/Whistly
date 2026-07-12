/** Offside resolver — stub. Only enable as real if TxLINE exposes offside events/stats. */
import type { ResolverResult } from "./types";

export function resolveOffside(
  fixtureId: string,
  startOffsides: number,
  endOffsides: number
): ResolverResult {
  const yesWon = endOffsides > startOffsides;
  return {
    outcome: yesWon ? "YES" : "NO",
    winningOptionIndex: yesWon ? 1 : 0,
    evidence: {
      fixtureId,
      marketFamily: "Offside",
      startStat: startOffsides,
      endStat: endOffsides,
      source: "MOCK",
      proofStatus: "demo",
    },
  };
}
