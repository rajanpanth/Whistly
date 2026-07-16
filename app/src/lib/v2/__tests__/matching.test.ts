import { findMatches } from "../matchLogic";
import type { OrderRecord } from "../orderStore";

// findMatches is pure; test the price-time priority + cross detection that
// drives on-chain settlement, without touching the chain.

function order(p: Partial<OrderRecord>): OrderRecord {
    return {
        orderHash: Math.random().toString(16).slice(2),
        protocolVersion: 2,
        market: "M",
        marketId: 1,
        outcomeIndex: 1,
        maker: "maker",
        side: "BUY",
        orderType: "LIMIT",
        priceBps: 5000,
        quantity: 100,
        lockedAmount: 0,
        nonce: Math.floor(Math.random() * 1e9),
        expiry: Math.floor(Date.now() / 1000) + 3600,
        tif: "GTC",
        filledQuantity: 0,
        status: "open",
        payloadHex: "",
        signatureHex: "",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ...p,
    };
}

const incoming = (p: Partial<Parameters<typeof findMatches>[0]>) => ({
    side: "BUY" as const,
    outcomeIndex: 1,
    priceBps: 5000,
    quantity: 100n,
    maker: "taker",
    ...p,
});

describe("findMatches — TRANSFER (same outcome, opposite side)", () => {
    it("crosses a buy against a resting sell at or below the buy price", () => {
        const book = [order({ side: "SELL", outcomeIndex: 1, priceBps: 4800, maker: "m1" })];
        const m = findMatches(incoming({ side: "BUY", priceBps: 5000 }), book, 2);
        expect(m).toHaveLength(1);
        expect(m[0].mode).toBe("TRANSFER");
    });

    it("does not cross when the sell is above the buy price", () => {
        const book = [order({ side: "SELL", outcomeIndex: 1, priceBps: 5200, maker: "m1" })];
        expect(findMatches(incoming({ side: "BUY", priceBps: 5000 }), book, 2)).toHaveLength(0);
    });

    it("never self-trades", () => {
        const book = [order({ side: "SELL", outcomeIndex: 1, priceBps: 4000, maker: "taker" })];
        expect(findMatches(incoming({ side: "BUY", maker: "taker" }), book, 2)).toHaveLength(0);
    });

    it("skips expired resting orders", () => {
        const book = [
            order({ side: "SELL", outcomeIndex: 1, priceBps: 4000, maker: "m1", expiry: 1 }),
        ];
        expect(findMatches(incoming({}), book, 2)).toHaveLength(0);
    });

    it("gives the buyer the lowest ask first (price priority)", () => {
        const book = [
            order({ side: "SELL", outcomeIndex: 1, priceBps: 4900, maker: "hi" }),
            order({ side: "SELL", outcomeIndex: 1, priceBps: 4500, maker: "lo" }),
        ];
        const m = findMatches(incoming({ side: "BUY", priceBps: 5000 }), book, 2);
        expect(m[0].resting.priceBps).toBe(4500);
    });
});

describe("findMatches — MINT cross (two complementary BUYs, binary)", () => {
    it("crosses when prices sum to at least 100%", () => {
        const book = [order({ side: "BUY", outcomeIndex: 0, priceBps: 4700, maker: "m1" })];
        const m = findMatches(incoming({ side: "BUY", outcomeIndex: 1, priceBps: 5400 }), book, 2);
        expect(m).toHaveLength(1);
        expect(m[0].mode).toBe("MINT");
    });

    it("does not cross when prices sum below 100%", () => {
        const book = [order({ side: "BUY", outcomeIndex: 0, priceBps: 4000, maker: "m1" })];
        const m = findMatches(incoming({ side: "BUY", outcomeIndex: 1, priceBps: 5000 }), book, 2);
        expect(m).toHaveLength(0);
    });

    it("is disabled on non-binary markets", () => {
        const book = [order({ side: "BUY", outcomeIndex: 0, priceBps: 6000, maker: "m1" })];
        const m = findMatches(incoming({ side: "BUY", outcomeIndex: 1, priceBps: 6000 }), book, 3);
        expect(m).toHaveLength(0);
    });
});

describe("findMatches — BURN cross (two complementary SELLs, binary)", () => {
    it("crosses when prices sum to at most 100%", () => {
        const book = [order({ side: "SELL", outcomeIndex: 0, priceBps: 4000, maker: "m1" })];
        const m = findMatches(
            incoming({ side: "SELL", outcomeIndex: 1, priceBps: 5500 }),
            book,
            2
        );
        expect(m).toHaveLength(1);
        expect(m[0].mode).toBe("BURN");
    });

    it("does not cross when prices sum above 100%", () => {
        const book = [order({ side: "SELL", outcomeIndex: 0, priceBps: 6000, maker: "m1" })];
        const m = findMatches(
            incoming({ side: "SELL", outcomeIndex: 1, priceBps: 5500 }),
            book,
            2
        );
        expect(m).toHaveLength(0);
    });
});

describe("findMatches — remaining quantity", () => {
    it("only offers the unfilled remainder of a partially-filled order", () => {
        const book = [
            order({
                side: "SELL",
                outcomeIndex: 1,
                priceBps: 4000,
                quantity: 100,
                filledQuantity: 70,
                maker: "m1",
            }),
        ];
        const m = findMatches(incoming({ side: "BUY", priceBps: 5000 }), book, 2);
        expect(m[0].quantity).toBe(30n);
    });
});
