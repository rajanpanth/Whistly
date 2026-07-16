// ─── Pure matching logic ───────────────────────────────────────────────────
// No chain/web3 imports so it is unit-testable in isolation. engine.ts
// re-exports findMatches and layers on-chain settlement over it.

import type { OrderRecord, OrderSideStr } from "./orderStore";

// Inlined (not imported from codec) so this module pulls in zero web3.js —
// keeps it unit-testable without the ESM transform headache. Mirrors
// codec.PRICE_SCALE / state_v2.rs PRICE_SCALE.
const PRICE_SCALE = 10_000;

export interface MatchCandidate {
    resting: OrderRecord;
    /** shares fillable against this resting order */
    quantity: bigint;
    mode: "TRANSFER" | "MINT" | "BURN";
}

export interface IncomingOrder {
    side: OrderSideStr;
    outcomeIndex: number;
    priceBps: number;
    quantity: bigint;
    maker: string;
}

/**
 * Find crossable resting orders for `incoming`, best price first then FIFO.
 *  - TRANSFER: opposite side, same outcome, prices cross.
 *  - MINT (binary): both BUY, complementary outcomes, pMaker + pTaker ≥ 100%.
 *  - BURN (binary): both SELL, complementary outcomes, pMaker + pTaker ≤ 100%.
 * Execution always happens at the RESTING (maker) order's price.
 */
export function findMatches(
    incoming: IncomingOrder,
    book: OrderRecord[],
    numOutcomes: number,
    nowSec = Math.floor(Date.now() / 1000)
): MatchCandidate[] {
    const live = book.filter(
        (o) =>
            o.expiry > nowSec &&
            o.maker !== incoming.maker &&
            o.quantity - o.filledQuantity > 0
    );

    const candidates: { c: MatchCandidate; sortPrice: number }[] = [];
    for (const resting of live) {
        const remaining = BigInt(resting.quantity - resting.filledQuantity);
        if (resting.side !== incoming.side && resting.outcomeIndex === incoming.outcomeIndex) {
            const buyPrice = incoming.side === "BUY" ? incoming.priceBps : resting.priceBps;
            const sellPrice = incoming.side === "BUY" ? resting.priceBps : incoming.priceBps;
            if (buyPrice >= sellPrice) {
                candidates.push({
                    c: { resting, quantity: remaining, mode: "TRANSFER" },
                    sortPrice: incoming.side === "BUY" ? resting.priceBps : -resting.priceBps,
                });
            }
        } else if (
            numOutcomes === 2 &&
            resting.side === incoming.side &&
            resting.outcomeIndex !== incoming.outcomeIndex
        ) {
            const sum = resting.priceBps + incoming.priceBps;
            if (incoming.side === "BUY" && sum >= PRICE_SCALE) {
                candidates.push({
                    c: { resting, quantity: remaining, mode: "MINT" },
                    sortPrice: -resting.priceBps,
                });
            } else if (incoming.side === "SELL" && sum <= PRICE_SCALE) {
                candidates.push({
                    c: { resting, quantity: remaining, mode: "BURN" },
                    sortPrice: resting.priceBps,
                });
            }
        }
    }

    candidates.sort(
        (a, b) => a.sortPrice - b.sortPrice || a.c.resting.createdAt - b.c.resting.createdAt
    );
    return candidates.map((x) => x.c);
}
