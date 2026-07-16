import { NextResponse } from "next/server";
import { connection, RPC_URL } from "@/lib/program.base";
import { operatorStatus } from "@/lib/v2/engine";
import { getOrderStore, isSupabaseConfigured } from "@/lib/v2/orderStore";
import { getConfigV2PDA, parseConfigV2 } from "@/lib/v2/programV2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v2/status — matching-engine / order-book / RPC health. */
export async function GET() {
    const operator = operatorStatus();
    const store = getOrderStore();

    let rpc: { ok: boolean; slot?: number; error?: string };
    try {
        rpc = { ok: true, slot: await connection.getSlot() };
    } catch (err) {
        rpc = { ok: false, error: err instanceof Error ? err.message : "rpc_error" };
    }

    let configV2: { initialized: boolean; admin?: string; operator?: string; paused?: boolean; feeBps?: number; nextMarketId?: number } = {
        initialized: false,
    };
    try {
        const info = await connection.getAccountInfo(getConfigV2PDA()[0]);
        if (info) {
            const c = parseConfigV2(info.data);
            configV2 = {
                initialized: true,
                admin: c.admin.toBase58(),
                operator: c.operator.toBase58(),
                paused: c.paused,
                feeBps: c.feeBps,
                nextMarketId: Number(c.nextMarketId),
            };
        }
    } catch {
        // leave uninitialized
    }

    return NextResponse.json({
        rpc: { ...rpc, url: RPC_URL.replace(/api-key=[^&]+/, "api-key=***") },
        operator,
        operatorMatchesConfig:
            operator.configured && configV2.initialized
                ? operator.pubkey === configV2.operator
                : null,
        store: {
            kind: store.kind,
            supabaseConfigured: isSupabaseConfigured(),
        },
        configV2,
    });
}
