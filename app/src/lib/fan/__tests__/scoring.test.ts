import {
    challengeLockState,
    goalWindowId,
    resolveGoalWindow,
    scorePrediction,
    streakMultiplierBps,
} from "../scoring";

describe("Whistly Matchday scoring", () => {
    test("goal window resolves YES only when total score increases", () => {
        const start = { startHomeScore: 1, startAwayScore: 1 };
        expect(resolveGoalWindow(start, 2, 1)).toBe(1);
        expect(resolveGoalWindow(start, 1, 1)).toBe(0);
        expect(resolveGoalWindow(start, 0, 1)).toBe(0);
    });

    test("streak multipliers are deterministic and capped", () => {
        expect([1, 2, 3, 4, 5, 20].map(streakMultiplierBps)).toEqual([
            10_000, 11_000, 12_000, 13_000, 15_000, 15_000,
        ]);
    });

    test("correct predictions advance streak and award integer points", () => {
        expect(
            scorePrediction({
                selectedOutcome: 1,
                winningOutcome: 1,
                currentStreak: 2,
                longestStreak: 2,
            })
        ).toEqual({
            correct: true,
            basePoints: 100,
            multiplierBps: 12_000,
            awardedPoints: 120,
            currentStreak: 3,
            longestStreak: 3,
        });
    });

    test("incorrect predictions reset current streak only", () => {
        expect(
            scorePrediction({
                selectedOutcome: 0,
                winningOutcome: 1,
                currentStreak: 4,
                longestStreak: 6,
            })
        ).toMatchObject({ correct: false, awardedPoints: 0, currentStreak: 0, longestStreak: 6 });
    });

    test("open challenge locks at its boundary", () => {
        expect(challengeLockState("OPEN", 1_000, 999)).toBe("OPEN");
        expect(challengeLockState("OPEN", 1_000, 1_000)).toBe("LOCKED");
        expect(challengeLockState("RESOLVED", 1_000, 2_000)).toBe("RESOLVED");
    });

    test("challenge ids are stable per fixture, duration and boundary", () => {
        expect(goalWindowId("42", 5, 100)).toBe("gw:42:5:100");
        expect(goalWindowId("42", 5, 100)).toBe(goalWindowId("42", 5, 100));
        expect(goalWindowId("42", 15, 100)).not.toBe(goalWindowId("42", 5, 100));
    });
});
