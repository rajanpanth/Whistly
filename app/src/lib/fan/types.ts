export type FanChallengeStatus =
    | "SCHEDULED"
    | "OPEN"
    | "LOCKED"
    | "RESOLVING"
    | "RESOLVED"
    | "VOID"
    | "CANCELLED";

export type FanChallengeType = "GOAL_WINDOW";
export type FanOutcome = 0 | 1;

export interface FanChallenge {
    id: string;
    fixtureId: string;
    challengeType: FanChallengeType;
    durationMinutes: 5 | 15 | 45;
    startTs: number;
    endTs: number;
    startClockSeconds: number;
    startHomeScore: number;
    startAwayScore: number;
    endHomeScore: number | null;
    endAwayScore: number | null;
    status: FanChallengeStatus;
    winningOutcome: FanOutcome | null;
    resolutionSource: "txline" | "mock" | "replay";
    resolvedAt: number | null;
    createdAt: number;
}

export interface FanPrediction {
    id: string;
    challengeId: string;
    wallet: string;
    selectedOutcome: FanOutcome;
    submittedAt: number;
    correct: boolean | null;
    basePoints: number;
    streakMultiplierBps: number;
    awardedPoints: number;
    scoredAt: number | null;
}

export interface FanRoom {
    id: string;
    inviteCode: string;
    creatorWallet: string;
    fixtureId: string;
    name: string;
    visibility: "PRIVATE" | "PUBLIC";
    status: "OPEN" | "CLOSED";
    createdAt: number;
    updatedAt: number;
}

export interface FanRoomMember {
    roomId: string;
    wallet: string;
    displayName: string;
    role: "OWNER" | "MEMBER";
    joinedAt: number;
}

export interface FanScore {
    roomId: string;
    wallet: string;
    displayName: string;
    totalPoints: number;
    correctPredictions: number;
    totalPredictions: number;
    currentStreak: number;
    longestStreak: number;
    updatedAt: number;
}

export interface FanReaction {
    id: string;
    fixtureId: string;
    wallet: string;
    reactionType: "GOAL" | "SHOCK" | "APPLAUSE" | "FRUSTRATION" | "SUPPORT";
    createdAt: number;
}

export interface FanProfile {
    wallet: string;
    displayName: string;
    favoriteTeam: string;
    avatarSeed: string;
    createdAt: number;
    updatedAt: number;
}

export interface FanRecap {
    fixtureId: string;
    wallet: string;
    roomId: string | null;
    totalPoints: number;
    correctPredictions: number;
    totalPredictions: number;
    accuracy: number;
    longestStreak: number;
    finalRank: number | null;
}
