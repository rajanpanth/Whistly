import {
    fetchTxLineFixtures,
    fetchTxLineScore,
    type TxLineDataSource,
} from "@/lib/txline/client";
import type { TxLineFixture, TxLineScore } from "@/lib/txline/mock";
import { goalWindowId, resolveGoalWindow } from "./scoring";
import { getFanStore, type FanStore } from "./store";
import type { FanChallenge } from "./types";

export type EnrichedFanFixture = TxLineFixture & {
    source: TxLineDataSource;
    stale: boolean;
    lastUpdateMs: number;
    events: TxLineScore["events"];
};

export async function getFanFixtures(): Promise<{
    fixtures: EnrichedFanFixture[];
    source: TxLineDataSource;
}> {
    const result = await fetchTxLineFixtures();
    const fixtures = await Promise.all(
        result.fixtures.map(async (fixture): Promise<EnrichedFanFixture> => {
            let score: TxLineScore | null = null;
            if (fixture.status === "LIVE" || fixture.status === "FINISHED") {
                try {
                    score = (await fetchTxLineScore(fixture.fixtureId)).score;
                } catch {
                    score = null;
                }
            }
            const updatedAt = score?.updatedAt ?? fixture.updatedAt;
            const lastUpdateMs = Date.parse(updatedAt) || Date.now();
            return {
                ...fixture,
                status: score?.status ?? fixture.status,
                clockSeconds: score?.clockSeconds ?? fixture.clockSeconds,
                homeScore: score?.homeScore ?? fixture.homeScore,
                awayScore: score?.awayScore ?? fixture.awayScore,
                updatedAt,
                events: score?.events ?? [],
                source: result.source,
                stale: fixture.status === "LIVE" && Date.now() - lastUpdateMs > 120_000,
                lastUpdateMs,
            };
        })
    );
    return { fixtures, source: result.source };
}

export async function syncFixtureChallenges(
    fixtureId: string,
    store: FanStore = getFanStore(),
    now = Date.now()
) {
    const feed = await getFanFixtures();
    const fixture = feed.fixtures.find((item) => item.fixtureId === fixtureId);
    if (!fixture) return { fixture: null, challenges: [], storage: store.mode() };

    let challenges = await store.listChallenges(fixtureId);
    if (["POSTPONED", "ABANDONED", "CANCELLED"].includes(fixture.status)) {
        for (const challenge of challenges) await store.voidChallenge(challenge, now);
    }
    if (fixture.status === "LIVE" || fixture.status === "FINISHED") {
        for (const challenge of challenges) {
            if (challenge.status !== "OPEN" && challenge.status !== "LOCKED" && challenge.status !== "RESOLVING") continue;
            if (now < challenge.endTs) continue;
            const freshEnough =
                fixture.status === "FINISHED" || fixture.lastUpdateMs >= challenge.endTs - 30_000;
            if (!freshEnough || fixture.stale) continue;
            await store.resolveChallenge({
                challenge,
                winningOutcome: resolveGoalWindow(
                    challenge,
                    fixture.homeScore,
                    fixture.awayScore
                ),
                endHomeScore: fixture.homeScore,
                endAwayScore: fixture.awayScore,
                resolvedAt: now,
            });
        }
    }

    challenges = await store.listChallenges(fixtureId);
    if (fixture.status === "LIVE" && !fixture.stale) {
        const activeDurations = new Set(
            challenges
                .filter((item) => ["OPEN", "LOCKED", "RESOLVING"].includes(item.status) && now < item.endTs + 120_000)
                .map((item) => item.durationMinutes)
        );
        const startTs = Math.floor(now / 1_000) * 1_000;
        for (const duration of [5, 15, 45] as const) {
            if (activeDurations.has(duration)) continue;
            const challenge: FanChallenge = {
                id: goalWindowId(fixtureId, duration, startTs),
                fixtureId,
                challengeType: "GOAL_WINDOW",
                durationMinutes: duration,
                startTs,
                endTs: startTs + duration * 60_000,
                startClockSeconds: fixture.clockSeconds,
                startHomeScore: fixture.homeScore,
                startAwayScore: fixture.awayScore,
                endHomeScore: null,
                endAwayScore: null,
                status: "OPEN",
                winningOutcome: null,
                resolutionSource: feed.source,
                resolvedAt: null,
                createdAt: now,
            };
            await store.createChallenge(challenge);
        }
    }

    challenges = await store.listChallenges(fixtureId);
    return {
        fixture,
        challenges: challenges.map((challenge) => ({
            ...challenge,
            status:
                challenge.status === "OPEN" && now >= challenge.endTs
                    ? "LOCKED"
                    : challenge.status,
        })),
        storage: store.mode(),
    };
}
