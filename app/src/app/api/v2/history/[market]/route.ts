import { NextRequest, NextResponse } from "next/server";
import { getOrderStore } from "@/lib/v2/orderStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v2/history/[market]?outcome=0&range=1d
 * Price history built ONLY from settled fills (each backed by a devnet tx).
 * No fills → empty series; the UI must show "No completed trades yet."
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ market: string }> }
) {
    const { market } = await params;
    const outcome = Number(req.nextUrl.searchParams.get("outcome") ?? "0");
    const range = req.nextUrl.searchParams.get("range") ?? "all";
    const store = getOrderStore();
    const fills = await store.getFills(market, 1000);

    const rangeMs: Record<string, number> = {
        "1h": 3_600_000,
        "6h": 21_600_000,
        "1d": 86_400_000,
        "1w": 604_800_000,
        all: Number.POSITIVE_INFINITY,
    };
    const cutoff = Date.now() - (rangeMs[range] ?? Number.POSITIVE_INFINITY);

    const points = fills
        .filter((f) => f.createdAt >= cutoff)
        // Normalize every fill to this outcome's probability: a fill on the
        // complementary binary outcome at p implies 100% − p here.
        .map((f) => ({
            t: f.createdAt,
            priceBps:
                f.outcomeIndex === outcome ? f.priceBps : 10_000 - f.priceBps,
            quantity: f.quantity,
            txSignature: f.txSignature,
        }))
        .sort((a, b) => a.t - b.t);

    return NextResponse.json({ market, outcome, range, points });
}
