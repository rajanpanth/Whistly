export const LIVE_GOAL_MARKET_KIND = "LIVE_GOAL_WINDOW" as const;

export const LIVE_GOAL_WINDOWS = [5, 15, 45] as const;

export type LiveGoalWindowMinutes = (typeof LIVE_GOAL_WINDOWS)[number];
export type LiveGoalOutcome = "NO" | "YES";
export type LiveGoalStatus =
  | "OPEN"
  | "LOCKED"
  | "RESOLVING"
  | "RESOLVED"
  | "CLAIMABLE"
  | "CANCELLED";

export type LiveGoalResolutionSource = "MOCK" | "TXLINE_SCORE" | "TXLINE_PROOF";

export interface LiveGoalMarketMetadata {
  id: string;
  onchainMarketPubkey: string;
  onchainPollId: number;
  txoddsFixtureId: string;
  marketKind: typeof LIVE_GOAL_MARKET_KIND;
  homeTeam: string;
  awayTeam: string;
  matchClockAtStart: string;
  windowMinutes: LiveGoalWindowMinutes;
  windowStartTs: number;
  lockTs: number;
  windowEndTs: number;
  startHomeScore: number;
  startAwayScore: number;
  endHomeScore?: number;
  endAwayScore?: number;
  status: LiveGoalStatus;
  winningOutcome?: LiveGoalOutcome;
  winningOptionIndex?: 0 | 1;
  settlementTx?: string;
  resolutionSource: LiveGoalResolutionSource;
  createdAt: string;
  updatedAt: string;
}

export interface GoalWindowResolutionInput {
  startHomeScore: number;
  startAwayScore: number;
  endHomeScore: number;
  endAwayScore: number;
}

export interface GoalWindowResolution {
  resolvedOutcome: LiveGoalOutcome;
  winningOptionIndex: 0 | 1;
  startTotalGoals: number;
  endTotalGoals: number;
}

export function isLiveGoalWindowMinutes(value: number): value is LiveGoalWindowMinutes {
  return LIVE_GOAL_WINDOWS.includes(value as LiveGoalWindowMinutes);
}

export function resolveGoalWindowMarket(input: GoalWindowResolutionInput): GoalWindowResolution {
  const startTotalGoals = input.startHomeScore + input.startAwayScore;
  const endTotalGoals = input.endHomeScore + input.endAwayScore;
  const yesWon = endTotalGoals > startTotalGoals;

  return {
    resolvedOutcome: yesWon ? "YES" : "NO",
    winningOptionIndex: yesWon ? 1 : 0,
    startTotalGoals,
    endTotalGoals,
  };
}

export function getLiveGoalMarketStatus(
  nowSeconds: number,
  market: Pick<LiveGoalMarketMetadata, "status" | "lockTs" | "windowEndTs">
): LiveGoalStatus {
  if (market.status === "RESOLVED" || market.status === "CLAIMABLE" || market.status === "CANCELLED") {
    return market.status;
  }
  if (nowSeconds >= market.windowEndTs) return "RESOLVING";
  if (nowSeconds >= market.lockTs) return "LOCKED";
  return "OPEN";
}

export function impliedProbability(voteCounts: number[], yesIndex = 1): number {
  const total = voteCounts.reduce((sum, count) => sum + count, 0);
  if (total <= 0) return 50;
  return Math.round(((voteCounts[yesIndex] ?? 0) / total) * 100);
}

export function formatMatchClock(totalSeconds: number): string {
  const minutes = Math.max(0, Math.floor(totalSeconds / 60));
  const seconds = Math.max(0, totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function buildLiveGoalMarketTitle(
  homeTeam: string,
  awayTeam: string,
  windowMinutes: LiveGoalWindowMinutes
): string {
  return `Goal in next ${windowMinutes} minutes? ${homeTeam} vs ${awayTeam}`;
}
