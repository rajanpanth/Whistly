import { createMemoryFanStore } from "../store";
import type { FanChallenge } from "../types";
import { randomUUID } from "node:crypto";

Object.defineProperty(globalThis.crypto, "randomUUID", {
    configurable: true,
    value: randomUUID,
});

function challenge(fixtureId: string, id: string, endTs = Date.now() + 60_000): FanChallenge {
    return {
        id,
        fixtureId,
        challengeType: "GOAL_WINDOW",
        durationMinutes: 5,
        startTs: endTs - 300_000,
        endTs,
        startClockSeconds: 1_200,
        startHomeScore: 0,
        startAwayScore: 0,
        endHomeScore: null,
        endAwayScore: null,
        status: "OPEN",
        winningOutcome: null,
        resolutionSource: "replay",
        resolvedAt: null,
        createdAt: endTs - 300_000,
    };
}

describe("Whistly Matchday memory store", () => {
    test("rejects duplicate and late predictions", async () => {
        const store = createMemoryFanStore();
        const suffix = randomUUID();
        const open = challenge(`fixture-${suffix}`, `challenge-${suffix}`);
        await store.createChallenge(open);
        await store.submitPrediction({ challenge: open, wallet: `wallet-${suffix}`, selectedOutcome: 1 });
        await expect(store.submitPrediction({ challenge: open, wallet: `wallet-${suffix}`, selectedOutcome: 0 }))
            .rejects.toMatchObject({ code: "duplicate_prediction" });

        const late = challenge(`fixture-late-${suffix}`, `challenge-late-${suffix}`, Date.now() - 1);
        await store.createChallenge(late);
        await expect(store.submitPrediction({ challenge: late, wallet: `wallet-${suffix}`, selectedOutcome: 1 }))
            .rejects.toMatchObject({ code: "challenge_locked" });
    });

    test("resolves once, scores the correct fixture room, and preserves other rooms", async () => {
        const store = createMemoryFanStore();
        const suffix = randomUUID();
        const wallet = `wallet-${suffix}`;
        const currentFixture = `fixture-current-${suffix}`;
        const otherFixture = `fixture-other-${suffix}`;
        const item = challenge(currentFixture, `challenge-score-${suffix}`);
        await store.createChallenge(item);
        const currentRoom = await store.createRoom({ fixtureId: currentFixture, creatorWallet: wallet, name: "Current match", displayName: "Ada" });
        const otherRoom = await store.createRoom({ fixtureId: otherFixture, creatorWallet: wallet, name: "Other match", displayName: "Ada" });
        await store.submitPrediction({ challenge: item, wallet, selectedOutcome: 1 });

        await store.resolveChallenge({ challenge: item, winningOutcome: 1, endHomeScore: 1, endAwayScore: 0 });
        await store.resolveChallenge({ challenge: item, winningOutcome: 1, endHomeScore: 1, endAwayScore: 0 });

        expect(await store.leaderboard(currentRoom.id)).toEqual([
            expect.objectContaining({ wallet, totalPoints: 100, totalPredictions: 1, correctPredictions: 1, currentStreak: 1 }),
        ]);
        expect(await store.leaderboard(otherRoom.id)).toEqual([
            expect.objectContaining({ wallet, totalPoints: 0, totalPredictions: 0, correctPredictions: 0 }),
        ]);
        expect((await store.getChallenge(item.id))?.status).toBe("RESOLVED");
    });

    test("accepts room id or case-insensitive invite code", async () => {
        const store = createMemoryFanStore();
        const suffix = randomUUID();
        const room = await store.createRoom({ fixtureId: `fixture-${suffix}`, creatorWallet: `wallet-${suffix}`, name: "The group", displayName: "Owner" });
        expect((await store.getRoom(room.id))?.id).toBe(room.id);
        expect((await store.getRoom(room.inviteCode.toLowerCase()))?.id).toBe(room.id);
    });

    test("voids an interrupted challenge without scoring or breaking a streak", async () => {
        const store = createMemoryFanStore();
        const suffix = randomUUID();
        const wallet = `wallet-${suffix}`;
        const item = challenge(`fixture-${suffix}`, `challenge-void-${suffix}`);
        await store.createChallenge(item);
        const room = await store.createRoom({ fixtureId: item.fixtureId, creatorWallet: wallet, name: "Interrupted", displayName: "Ada" });
        await store.submitPrediction({ challenge: item, wallet, selectedOutcome: 1 });
        await store.voidChallenge(item);
        expect((await store.getChallenge(item.id))?.status).toBe("VOID");
        expect(await store.leaderboard(room.id)).toEqual([
            expect.objectContaining({ wallet, totalPoints: 0, totalPredictions: 0, currentStreak: 0 }),
        ]);
    });
});
