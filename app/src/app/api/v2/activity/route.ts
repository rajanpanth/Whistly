import { NextRequest, NextResponse } from "next/server";
import { getOrderStore } from "@/lib/v2/orderStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v2/activity?market=…&wallet=…&limit=50 */
export async function GET(req: NextRequest) {
    const market = req.nextUrl.searchParams.get("market") ?? undefined;
    const wallet = req.nextUrl.searchParams.get("wallet") ?? undefined;
    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? "50"), 200);
    const store = getOrderStore();
    const activity = await store.getActivity({ market, wallet, limit });
    return NextResponse.json({ activity });
}
