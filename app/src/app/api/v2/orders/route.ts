import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateOrder, matchAndSettle } from "@/lib/v2/engine";
import { getOrderStore } from "@/lib/v2/orderStore";
import { decodeOrderV2, fromHex, LAMPORTS_PER_BP, SIDE_BUY, TIF_GTC, TIF_GTD, TIF_FAK, TIF_FOK } from "@/lib/v2/codec";
import { isRateLimitedCustom, getClientIp } from "@/lib/rateLimit";

// Order submission triggers operator-paid on-chain settlement — keep the
// per-maker allowance tight so order spam can't drain operator SOL.
const ORDERS_PER_MINUTE = 20;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PostOrderSchema = z.object({
    payloadHex: z.string().regex(/^[0-9a-fA-F]{212}$|^[0-9a-fA-F]{220}$/), // 106 (V2) or 110 (V3) bytes
    signatureHex: z.string().regex(/^[0-9a-fA-F]{128}$/), // 64 bytes
    orderType: z.enum(["LIMIT", "MARKET"]),
});

const TIF_NAMES: Record<number, "GTC" | "GTD" | "FOK" | "FAK"> = {
    [TIF_GTC]: "GTC",
    [TIF_GTD]: "GTD",
    [TIF_FOK]: "FOK",
    [TIF_FAK]: "FAK",
};

/** POST /api/v2/orders — submit a wallet-signed order intent. */
export async function POST(req: NextRequest) {
    let body: z.infer<typeof PostOrderSchema>;
    try {
        body = PostOrderSchema.parse(await req.json());
    } catch {
        return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    // Rate limit per maker wallet (decoded from the signed payload) before any
    // signature/RPC work; fall back to IP if the payload doesn't decode.
    let rateKey: string;
    try {
        const decoded = decodeOrderV2(fromHex(body.payloadHex));
        rateKey = decoded
            ? `v2-orders:${decoded.maker.toBase58()}`
            : `v2-orders:ip:${getClientIp(req)}`;
    } catch {
        rateKey = `v2-orders:ip:${getClientIp(req)}`;
    }
    if (await isRateLimitedCustom(rateKey, ORDERS_PER_MINUTE)) {
        return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    const result = await validateOrder(body);
    if (!result.ok) {
        const status =
            result.error === "insufficient_balance" || result.error === "insufficient_shares"
                ? 422
                : 400;
        return NextResponse.json({ error: result.error }, { status });
    }

    const { payload, orderHash } = result;
    const tif = TIF_NAMES[payload.tif];
    if (!tif) return NextResponse.json({ error: "invalid_tif" }, { status: 400 });

    const store = getOrderStore();
    const lockedAmount =
        payload.side === SIDE_BUY
            ? payload.priceBps * LAMPORTS_PER_BP * Number(payload.quantity)
            : Number(payload.quantity);

    const inserted = await store.insertOrder({
        orderHash,
        protocolVersion: 2,
        market: payload.market.toBase58(),
        marketId: Number(result.market.marketId),
        outcomeIndex: payload.outcomeIndex,
        maker: payload.maker.toBase58(),
        side: payload.side === SIDE_BUY ? "BUY" : "SELL",
        orderType: body.orderType,
        priceBps: payload.priceBps,
        quantity: Number(payload.quantity),
        lockedAmount,
        nonce: Number(payload.nonce),
        expiry: Number(payload.expiry),
        tif,
        filledQuantity: 0,
        status: "open",
        payloadHex: body.payloadHex.toLowerCase(),
        signatureHex: body.signatureHex.toLowerCase(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
    });
    if (!inserted.ok) {
        return NextResponse.json({ error: inserted.error }, { status: 409 });
    }
    await store.insertActivity({
        kind: "order_posted",
        market: payload.market.toBase58(),
        wallet: payload.maker.toBase58(),
        outcomeIndex: payload.outcomeIndex,
        side: payload.side === SIDE_BUY ? "BUY" : "SELL",
        priceBps: payload.priceBps,
        quantity: Number(payload.quantity),
        createdAt: Date.now(),
    });

    // Match + settle immediately (each fill = confirmed devnet tx).
    try {
        const outcome = await matchAndSettle(orderHash);
        return NextResponse.json({ orderHash, ...outcome });
    } catch (err) {
        return NextResponse.json({
            orderHash,
            settled: [],
            remaining: Number(payload.quantity),
            status: "open",
            matchError: err instanceof Error ? err.message : "match_failed",
        });
    }
}

/** GET /api/v2/orders?maker=…&market=…&limit=… — list a wallet's orders (newest first). */
export async function GET(req: NextRequest) {
    const maker = req.nextUrl.searchParams.get("maker");
    const market = req.nextUrl.searchParams.get("market") ?? undefined;
    if (!maker) return NextResponse.json({ error: "maker_required" }, { status: 400 });
    const limitParam = Number(req.nextUrl.searchParams.get("limit") ?? 200);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(1, Math.floor(limitParam)), 500) : 200;
    const store = getOrderStore();
    const now = Math.floor(Date.now() / 1000);
    const all = await store.getOrdersByMaker(maker, market);
    const orders = all
        .slice()
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, limit);
    // Lazily expire overdue resting orders on read (bounded by `limit`).
    for (const o of orders) {
        if ((o.status === "open" || o.status === "partially_filled") && o.expiry <= now) {
            await store.updateOrder(o.orderHash, { status: "expired" });
            o.status = "expired";
        }
    }
    return NextResponse.json({ orders, total: all.length });
}
