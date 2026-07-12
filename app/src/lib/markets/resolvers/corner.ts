/** Corner resolver — stub. Only enable as real after TxLINE corner events/stats are wired. */
import type { ResolverResult } from "./types";

export function resolveCorner(
  fixtureId: string,
  startCorners: number,
  endCorners: number
): ResolverResult {
  const yesWon = endCorners > startCorners;
  return {
    outcome: yesWon ? "YES" : "NO",
    winningOptionIndex: yesWon ? 1 : 0,
    evidence: {
      fixtureId,
      marketFamily: "Corner",
      startStat: startCorners,
      endStat: endCorners,
      source: "MOCK",
      proofStatus: "demo",
    },
  };
}
