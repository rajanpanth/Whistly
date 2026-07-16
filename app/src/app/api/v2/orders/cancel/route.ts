import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import nacl from "tweetnacl";
import { PublicKey } from "@solana/web3.js";
import { getOrderStore } from "@/lib/v2/orderStore";
import { fromHex } from "@/lib/v2/codec";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/v2/orders/cancel
 * Soft-cancel (matching engine stops filling immediately). The maker signs
 * the ASCII message `WV2-CANCEL:<order_hash_hex>` with their wallet, which
 * proves intent without an on-chain transaction. For a trustless hard
 * cancel the client can additionally send cancel_order_v2 on-chain.
 */
const CancelSchema = z.object({
    orderHash: z.string().regex(/^[0-9a-fA-F]{64}$/),
    signatureHex: z.string().regex(/^[0-9a-fA-F]{128}$/),
});

export async function POST(req: NextRequest) {
    let body: z.infer<typeof CancelSchema>;
    try {
        body = CancelSchema.parse(await req.json());
    } catch {
        return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    const store = getOrderStore();
    const order = await store.getOrder(body.orderHash.toLowerCase());
    if (!order) return NextResponse.json({ error: "order_not_found" }, { status: 404 });

    const message = new TextEncoder().encode(`WV2-CANCEL:${body.orderHash.toLowerCase()}`);
    const makerKey = new PublicKey(order.maker);
    const valid = nacl.sign.detached.verify(
        message,
        fromHex(body.signatureHex),
        makerKey.toBytes()
    );
    if (!valid) return NextResponse.json({ error: "bad_signature" }, { status: 403 });

    if (order.status !== "open" && order.status !== "partially_filled") {
        return NextResponse.json(
            { error: "not_cancellable", status: order.status },
            { status: 409 }
        );
    }

    await store.updateOrder(order.orderHash, { status: "cancelled" });
    await store.insertActivity({
        kind: "order_cancelled",
        market: order.market,
        wallet: order.maker,
        outcomeIndex: order.outcomeIndex,
        side: order.side,
        priceBps: order.priceBps,
        quantity: order.quantity - order.filledQuantity,
        createdAt: Date.now(),
    });
    return NextResponse.json({
        ok: true,
        orderHash: order.orderHash,
        cancelledQuantity: order.quantity - order.filledQuantity,
        filledQuantity: order.filledQuantity,
    });
}
