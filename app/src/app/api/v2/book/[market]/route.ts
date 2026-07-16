import { NextRequest, NextResponse } from "next/server";
import { getOrderStore } from "@/lib/v2/orderStore";
import { PRICE_SCALE } from "@/lib/v2/codec";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface BookLevel {
    priceBps: number;
    quantity: number;
    cumulative: number;
    orders: number;
}

/**
 * GET /api/v2/book/[market]?outcome=0
 * Aggregated two-sided book for one outcome, real signed orders only.
 * For binary markets, complementary-outcome BUYs surface as synthetic
 * liquidity on the other side of this outcome's book (a YES buy at p is
 * exactly a NO sell at 100%−p once minted) — flagged via `crossSide`.
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ market: string }> }
) {
    const { market } = await params;
    const outcome = Number(req.nextUrl.searchParams.get("outcome") ?? "0");
    const store = getOrderStore();
    const now = Math.floor(Date.now() / 1000);
    const resting = (await store.getRestingOrders(market)).filter((o) => o.expiry > now);

    const bidsMap = new Map<number, BookLevel>();
    const asksMap = new Map<number, BookLevel>();
    const add = (map: Map<number, BookLevel>, priceBps: number, qty: number) => {
        const level = map.get(priceBps) ?? { priceBps, quantity: 0, cumulative: 0, orders: 0 };
        level.quantity += qty;
        level.orders += 1;
        map.set(priceBps, level);
    };

    for (const o of resting) {
        const remaining = o.quantity - o.filledQuantity;
        if (remaining <= 0) continue;
        if (o.outcomeIndex === outcome) {
            add(o.side === "BUY" ? bidsMap : asksMap, o.priceBps, remaining);
        } else {
            // Complementary outcome on a binary market:
            //   BUY other @ p  ≡ ASK this @ 100% − p (mint-cross liquidity)
            //   SELL other @ p ≡ BID this @ 100% − p (burn-cross liquidity)
            const mirrored = PRICE_SCALE - o.priceBps;
            add(o.side === "BUY" ? asksMap : bidsMap, mirrored, remaining);
        }
    }

    const bids = Array.from(bidsMap.values()).sort((a, b) => b.priceBps - a.priceBps);
    const asks = Array.from(asksMap.values()).sort((a, b) => a.priceBps - b.priceBps);
    let cum = 0;
    for (const l of bids) {
        cum += l.quantity;
        l.cumulative = cum;
    }
    cum = 0;
    for (const l of asks) {
        cum += l.quantity;
        l.cumulative = cum;
    }

    const bestBid = bids[0]?.priceBps ?? null;
    const bestAsk = asks[0]?.priceBps ?? null;
    const fills = await store.getFills(market, 30);
    const lastTrade = fills.find((f) => f.outcomeIndex === outcome) ?? fills[0] ?? null;

    return NextResponse.json({
        market,
        outcome,
        bids,
        asks,
        bestBid,
        bestAsk,
        midBps: bestBid !== null && bestAsk !== null ? Math.round((bestBid + bestAsk) / 2) : null,
        spreadBps: bestBid !== null && bestAsk !== null ? bestAsk - bestBid : null,
        lastTradeBps: lastTrade?.priceBps ?? null,
        recentTrades: fills.map((f) => ({
            priceBps: f.priceBps,
            quantity: f.quantity,
            outcomeIndex: f.outcomeIndex,
            mode: f.mode,
            txSignature: f.txSignature,
            timestamp: f.createdAt,
        })),
    });
}
