/**
 * Settlement resolver tests — every market family that can settle a market
 * from score/stat data. These are the core "resolves from data, not majority
 * vote" guarantees, so boundaries are tested exhaustively.
 */
import { resolveCard } from "../card";
import { resolveCorner } from "../corner";
import { resolveGoalGap } from "../goalGap";
import { resolveGoalTotal } from "../goalTotal";
import { resolveGoalWindow } from "../goalWindow";
import { resolveMatchResult } from "../matchResult";
import { resolveOffside } from "../offside";
import { resolvePenalty } from "../penalty";

const FIXTURE = "fx-123";

describe("resolveCard", () => {
    it("YES (index 1) when a card was detected", () => {
        const r = resolveCard(FIXTURE, true);
        expect(r.outcome).toBe("YES");
        expect(r.winningOptionIndex).toBe(1);
    });

    it("NO (index 0) when no card was detected", () => {
        const r = resolveCard(FIXTURE, false);
        expect(r.outcome).toBe("NO");
        expect(r.winningOptionIndex).toBe(0);
    });

    it("carries fixture and family evidence", () => {
        const r = resolveCard(FIXTURE, true);
        expect(r.evidence.fixtureId).toBe(FIXTURE);
        expect(r.evidence.marketFamily).toBe("Card");
        expect(r.evidence.eventType).toBe("CARD");
    });
});

describe("resolvePenalty", () => {
    it("YES when a penalty was detected", () => {
        const r = resolvePenalty(FIXTURE, true);
        expect(r.outcome).toBe("YES");
        expect(r.winningOptionIndex).toBe(1);
    });

    it("NO when no penalty was detected", () => {
        const r = resolvePenalty(FIXTURE, false);
        expect(r.outcome).toBe("NO");
        expect(r.winningOptionIndex).toBe(0);
    });
});

describe("resolveCorner", () => {
    it("YES when corner count increased during the window", () => {
        const r = resolveCorner(FIXTURE, 3, 5);
        expect(r.outcome).toBe("YES");
        expect(r.winningOptionIndex).toBe(1);
        expect(r.evidence.startStat).toBe(3);
        expect(r.evidence.endStat).toBe(5);
    });

    it("NO when corner count is unchanged (boundary)", () => {
        const r = resolveCorner(FIXTURE, 4, 4);
        expect(r.outcome).toBe("NO");
        expect(r.winningOptionIndex).toBe(0);
    });

    it("NO when end count is lower (corrected feed data)", () => {
        expect(resolveCorner(FIXTURE, 4, 3).outcome).toBe("NO");
    });
});

describe("resolveOffside", () => {
    it("YES when offside count increased", () => {
        expect(resolveOffside(FIXTURE, 1, 2).outcome).toBe("YES");
    });

    it("NO when offside count is unchanged (boundary)", () => {
        expect(resolveOffside(FIXTURE, 2, 2).outcome).toBe("NO");
    });
});

describe("resolveGoalGap", () => {
    it("YES when the gap equals the minimum (inclusive boundary)", () => {
        const r = resolveGoalGap(FIXTURE, 3, 1, 2);
        expect(r.outcome).toBe("YES");
        expect(r.evidence.endStat).toBe(2);
        expect(r.evidence.endScore).toBe("3-1");
    });

    it("YES when the gap exceeds the minimum", () => {
        expect(resolveGoalGap(FIXTURE, 4, 0, 2).outcome).toBe("YES");
    });

    it("NO when the gap is below the minimum", () => {
        expect(resolveGoalGap(FIXTURE, 2, 1, 2).outcome).toBe("NO");
    });

    it("gap is absolute — away-side blowouts count too", () => {
        expect(resolveGoalGap(FIXTURE, 0, 3, 2).outcome).toBe("YES");
    });

    it("draw has zero gap", () => {
        expect(resolveGoalGap(FIXTURE, 2, 2, 1).outcome).toBe("NO");
    });
});

describe("resolveGoalTotal", () => {
    it("YES when total is strictly over a half-goal line", () => {
        expect(resolveGoalTotal(FIXTURE, 3, 2.5).outcome).toBe("YES");
    });

    it("NO when total is under the line", () => {
        expect(resolveGoalTotal(FIXTURE, 2, 2.5).outcome).toBe("NO");
    });

    it("NO on an exact integer line (strictly-greater semantics)", () => {
        expect(resolveGoalTotal(FIXTURE, 3, 3).outcome).toBe("NO");
    });

    it("NO for a goalless match on any positive line", () => {
        expect(resolveGoalTotal(FIXTURE, 0, 0.5).outcome).toBe("NO");
    });

    it("records the total in evidence", () => {
        expect(resolveGoalTotal(FIXTURE, 4, 2.5).evidence.endStat).toBe(4);
    });
});

describe("resolveMatchResult", () => {
    it.each([
        [2, 1, "HOME", "YES"],
        [1, 2, "HOME", "NO"],
        [1, 2, "AWAY", "YES"],
        [2, 1, "AWAY", "NO"],
        [1, 1, "DRAW", "YES"],
        [0, 0, "DRAW", "YES"],
        [1, 1, "HOME", "NO"],
        [1, 1, "AWAY", "NO"],
        [2, 1, "DRAW", "NO"],
    ] as const)(
        "score %i-%i with expected %s resolves %s",
        (home, away, expected, outcome) => {
            const r = resolveMatchResult(FIXTURE, home, away, expected);
            expect(r.outcome).toBe(outcome);
            expect(r.winningOptionIndex).toBe(outcome === "YES" ? 1 : 0);
        }
    );

    it("records the final score in evidence", () => {
        expect(resolveMatchResult(FIXTURE, 2, 1, "HOME").evidence.endScore).toBe("2-1");
    });
});

describe("resolveGoalWindow (adapter over resolveGoalWindowMarket)", () => {
    it("YES when a goal lands inside the window", () => {
        const r = resolveGoalWindow(FIXTURE, {
            startHomeScore: 0,
            startAwayScore: 0,
            endHomeScore: 1,
            endAwayScore: 0,
        });
        expect(r.outcome).toBe("YES");
        expect(r.winningOptionIndex).toBe(1);
        expect(r.evidence.startScore).toBe("0-0");
        expect(r.evidence.endScore).toBe("1-0");
    });

    it("NO when the score never moves", () => {
        const r = resolveGoalWindow(FIXTURE, {
            startHomeScore: 1,
            startAwayScore: 1,
            endHomeScore: 1,
            endAwayScore: 1,
        });
        expect(r.outcome).toBe("NO");
        expect(r.winningOptionIndex).toBe(0);
    });

    it("away goals count toward YES", () => {
        const r = resolveGoalWindow(FIXTURE, {
            startHomeScore: 0,
            startAwayScore: 0,
            endHomeScore: 0,
            endAwayScore: 2,
        });
        expect(r.outcome).toBe("YES");
    });
});

describe("cross-family invariants", () => {
    it("outcome and winningOptionIndex always agree (YES=1, NO=0)", () => {
        const results = [
            resolveCard(FIXTURE, true),
            resolveCard(FIXTURE, false),
            resolvePenalty(FIXTURE, true),
            resolveCorner(FIXTURE, 0, 1),
            resolveOffside(FIXTURE, 1, 1),
            resolveGoalGap(FIXTURE, 3, 0, 2),
            resolveGoalTotal(FIXTURE, 1, 2.5),
            resolveMatchResult(FIXTURE, 1, 0, "HOME"),
            resolveGoalWindow(FIXTURE, { startHomeScore: 0, startAwayScore: 0, endHomeScore: 0, endAwayScore: 0 }),
        ];
        for (const r of results) {
            expect(r.winningOptionIndex).toBe(r.outcome === "YES" ? 1 : 0);
        }
    });

    it("every resolver reports its fixture id", () => {
        expect(resolveGoalTotal(FIXTURE, 2, 2.5).evidence.fixtureId).toBe(FIXTURE);
        expect(resolveGoalGap(FIXTURE, 1, 0, 1).evidence.fixtureId).toBe(FIXTURE);
        expect(resolveMatchResult(FIXTURE, 0, 0, "DRAW").evidence.fixtureId).toBe(FIXTURE);
    });
});
