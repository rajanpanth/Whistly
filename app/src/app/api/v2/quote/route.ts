import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PublicKey } from "@solana/web3.js";
import { connection } from "@/lib/program.base";
import { getOrderStore } from "@/lib/v2/orderStore";
import { findMatches } from "@/lib/v2/engine";
import { parseMarketV2 } from "@/lib/v2/programV2";
import { LAMPORTS_PER_BP, PRICE_SCALE, MAX_PRICE_BPS, MIN_PRICE_BPS, SET_COST } from "@/lib/v2/codec";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/v2/quote — executable preview for a market order against the
 * CURRENT book. Never fabricates liquidity: if the book can't fill the
 * request within the slippage cap, the shortfall is reported.
 *
 * BUY:  { market, outcome, side:"BUY", lamports, maxPriceBps? }
 * SELL: { market, outcome, side:"SELL", shares, minPriceBps? }
 */
const QuoteSchema = z.object({
    market: z.string(),
    outcome: z.number().int().min(0).max(7),
    side: z.enum(["BUY", "SELL"]),
    lamports: z.number().int().positive().optional(),
    shares: z.number().int().positive().optional(),
    maxPriceBps: z.number().int().min(MIN_PRICE_BPS).max(MAX_PRICE_BPS).optional(),
    minPriceBps: z.number().int().min(MIN_PRICE_BPS).max(MAX_PRICE_BPS).optional(),
    wallet: z.string().optional(),
});

export async function POST(req: NextRequest) {
    let body: z.infer<typeof QuoteSchema>;
    try {
        body = QuoteSchema.parse(await req.json());
    } catch {
        return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    const marketInfo = await connection.getAccountInfo(new PublicKey(body.market));
    if (!marketInfo) return NextResponse.json({ error: "market_not_found" }, { status: 404 });
    const market = parseMarketV2(marketInfo.data);
    const feeBps = market.feeBps;

    const store = getOrderStore();
    const now = Math.floor(Date.now() / 1000);
    const book = (await store.getRestingOrders(body.market)).filter((o) => o.expiry > now);

    const cap = body.side === "BUY" ? body.maxPriceBps ?? MAX_PRICE_BPS : body.minPriceBps ?? MIN_PRICE_BPS;
    const matches = findMatches(
        {
            side: body.side,
            outcomeIndex: body.outcome,
            priceBps: cap,
            quantity: BigInt(Number.MAX_SAFE_INTEGER),
            maker: body.wallet ?? "",
        },
        book,
        market.numOutcomes
    );

    // Walk the book. Execution price per candidate = resting order's
    // effective price for OUR outcome (mirror complementary orders).
    let sharesOut = 0;
    let lamportsUsed = 0;
    let worstBps: number | null = null;
    const levels: { priceBps: number; quantity: number }[] = [];

    const wantLamports = body.side === "BUY" ? body.lamports ?? 0 : Infinity;
    const wantShares = body.side === "SELL" ? body.shares ?? 0 : Infinity;
    if (body.side === "BUY" && !body.lamports) {
        return NextResponse.json({ error: "lamports_required" }, { status: 400 });
    }
    if (body.side === "SELL" && !body.shares) {
        return NextResponse.json({ error: "shares_required" }, { status: 400 });
    }

    for (const m of matches) {
        // Effective execution price for the requested outcome.
        const sameOutcome = m.resting.outcomeIndex === body.outcome;
        const execBps = sameOutcome ? m.resting.priceBps : PRICE_SCALE - m.resting.priceBps;
        if (body.side === "BUY" && execBps > (body.maxPriceBps ?? MAX_PRICE_BPS)) continue;
        if (body.side === "SELL" && execBps < (body.minPriceBps ?? MIN_PRICE_BPS)) continue;

        const perShare = execBps * LAMPORTS_PER_BP;
        const availQty = Number(m.quantity);
        let take: number;
        if (body.side === "BUY") {
            const affordable = Math.floor((wantLamports - lamportsUsed) / perShare);
            take = Math.min(availQty, affordable);
        } else {
            take = Math.min(availQty, wantShares - sharesOut);
        }
        if (take <= 0) continue;

        sharesOut += take;
        lamportsUsed += take * perShare;
        worstBps = worstBps === null
            ? execBps
            : body.side === "BUY"
              ? Math.max(worstBps, execBps)
              : Math.min(worstBps, execBps);
        levels.push({ priceBps: execBps, quantity: take });

        if (body.side === "BUY" && wantLamports - lamportsUsed < MIN_PRICE_BPS * LAMPORTS_PER_BP) break;
        if (body.side === "SELL" && sharesOut >= wantShares) break;
    }

    const avgBps = sharesOut > 0 ? Math.round(lamportsUsed / (sharesOut * LAMPORTS_PER_BP)) : null;
    const fee = Math.ceil((lamportsUsed * feeBps) / PRICE_SCALE);
    const bestBps = levels[0]?.priceBps ?? null;

    return NextResponse.json({
        market: body.market,
        outcome: body.outcome,
        side: body.side,
        fillableShares: sharesOut,
        lamportsUsed,
        feeLamports: fee,
        // BUY pays lamportsUsed + fee; SELL receives lamportsUsed - fee.
        totalLamports: body.side === "BUY" ? lamportsUsed + fee : Math.max(0, lamportsUsed - fee),
        avgPriceBps: avgBps,
        worstPriceBps: worstBps,
        bestPriceBps: bestBps,
        priceImpactBps: bestBps !== null && worstBps !== null ? Math.abs(worstBps - bestBps) : 0,
        // A winning share redeems for SET_COST lamports.
        potentialPayoutLamports: sharesOut * SET_COST,
        levels,
        insufficientLiquidity:
            body.side === "BUY"
                ? sharesOut === 0
                : sharesOut < (body.shares ?? 0),
        shortfallShares: body.side === "SELL" ? Math.max(0, (body.shares ?? 0) - sharesOut) : 0,
        feeBps,
    });
}
