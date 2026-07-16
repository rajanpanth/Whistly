import type { FanChallenge, FanOutcome } from "./types";

export const BASE_CORRECT_POINTS = 100;

export function streakMultiplierBps(nextStreak: number): number {
    if (nextStreak >= 5) return 15_000;
    if (nextStreak === 4) return 13_000;
    if (nextStreak === 3) return 12_000;
    if (nextStreak === 2) return 11_000;
    return 10_000;
}

export function scorePrediction(params: {
    selectedOutcome: FanOutcome;
    winningOutcome: FanOutcome;
    currentStreak: number;
    longestStreak: number;
}) {
    const correct = params.selectedOutcome === params.winningOutcome;
    if (!correct) {
        return {
            correct: false,
            basePoints: 0,
            multiplierBps: 10_000,
            awardedPoints: 0,
            currentStreak: 0,
            longestStreak: params.longestStreak,
        };
    }
    const currentStreak = params.currentStreak + 1;
    const multiplierBps = streakMultiplierBps(currentStreak);
    return {
        correct: true,
        basePoints: BASE_CORRECT_POINTS,
        multiplierBps,
        awardedPoints: Math.floor((BASE_CORRECT_POINTS * multiplierBps) / 10_000),
        currentStreak,
        longestStreak: Math.max(params.longestStreak, currentStreak),
    };
}

export function resolveGoalWindow(
    challenge: Pick<FanChallenge, "startHomeScore" | "startAwayScore">,
    endHomeScore: number,
    endAwayScore: number
): FanOutcome {
    const startTotal = challenge.startHomeScore + challenge.startAwayScore;
    const endTotal = endHomeScore + endAwayScore;
    return endTotal > startTotal ? 1 : 0;
}

export function challengeLockState(
    status: FanChallenge["status"],
    endTs: number,
    now = Date.now()
) {
    if (status !== "OPEN") return status;
    return now >= endTs ? "LOCKED" : "OPEN";
}

export function goalWindowId(
    fixtureId: string,
    durationMinutes: number,
    startTs: number
) {
    return `gw:${fixtureId}:${durationMinutes}:${startTs}`;
}
