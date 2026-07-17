import { NextResponse } from "next/server";
import { connection, PROGRAM_ID } from "@/lib/program.base";
import { accountDiscriminator } from "@/lib/program.base";
import { parseMarketV2 } from "@/lib/v2/programV2";
import { getOrderStore } from "@/lib/v2/orderStore";
import bs58 from "bs58";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Short in-process cache: getProgramAccounts is one of the most expensive
// Solana RPC calls and this is a public, polled endpoint. Clients poll every
// ~6s, so a 3s TTL keeps data fresh while collapsing concurrent readers
// onto one upstream fetch per instance.
const CACHE_TTL_MS = 3_000;
let _cache: { body: unknown; expiresAt: number } | null = null;

/**
 * GET /api/v2/markets — every on-chain MarketV2 account plus book summary
 * (best bid/ask per outcome from real resting orders only).
 */
export async function GET() {
    if (_cache && Date.now() < _cache.expiresAt) {
        return NextResponse.json(_cache.body);
    }

    const disc = await accountDiscriminator("MarketV2");
    const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
        filters: [{ memcmp: { offset: 0, bytes: bs58.encode(disc) } }],
    });

    const store = getOrderStore();
    const now = Math.floor(Date.now() / 1000);

    // Fetch order/fill data for all markets concurrently instead of two
    // serialized store queries per market (N+1).
    const enriched = await Promise.all(
        accounts.map(async ({ pubkey, account }) => {
            const [restingAll, fills] = await Promise.all([
                store.getRestingOrders(pubkey.toBase58()),
                store.getFills(pubkey.toBase58(), 1),
            ]);
            return { pubkey, account, resting: restingAll.filter((o) => o.expiry > now), fills };
        })
    );

    const markets = [];
    for (const { pubkey, account, resting, fills } of enriched) {
        const m = parseMarketV2(account.data);
        const perOutcome = [];
        for (let i = 0; i < m.numOutcomes; i++) {
            let bestBid: number | null = null;
            let bestAsk: number | null = null;
            for (const o of resting) {
                const remaining = o.quantity - o.filledQuantity;
                if (remaining <= 0) continue;
                const sameOutcome = o.outcomeIndex === i;
                // Mirror complementary binary orders into this outcome's book.
                const isBid = sameOutcome ? o.side === "BUY" : m.numOutcomes === 2 && o.side === "SELL";
                const isAsk = sameOutcome ? o.side === "SELL" : m.numOutcomes === 2 && o.side === "BUY";
                const px = sameOutcome ? o.priceBps : 10_000 - o.priceBps;
                if (isBid) bestBid = bestBid === null ? px : Math.max(bestBid, px);
                if (isAsk) bestAsk = bestAsk === null ? px : Math.min(bestAsk, px);
            }
            perOutcome.push({ outcome: m.outcomes[i], bestBid, bestAsk });
        }
        markets.push({
            address: pubkey.toBase58(),
            marketId: Number(m.marketId),
            title: m.title,
            outcomes: m.outcomes,
            numOutcomes: m.numOutcomes,
            marketType: m.marketType,
            fixtureId: Number(m.fixtureId),
            resolutionSource: m.resolutionSource,
            closeTs: Number(m.closeTs),
            status: m.status,
            winningOutcome: m.winningOutcome,
            feeBps: m.feeBps,
            openSets: Number(m.openSets),
            volumeLamports: Number(m.volumeLamports),
            fillCount: Number(m.fillCount),
            createdAt: Number(m.createdAt),
            book: perOutcome,
            lastTradeBps: fills[0]?.priceBps ?? null,
            restingOrders: resting.length,
        });
    }
    markets.sort((a, b) => b.createdAt - a.createdAt);
    const body = { markets };
    _cache = { body, expiresAt: Date.now() + CACHE_TTL_MS };
    return NextResponse.json(body);
}
