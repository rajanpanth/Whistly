import { NextRequest } from "next/server";
import { fanApiError, noStoreJson, requireFanWallet } from "@/lib/fan/api";
import { getFanStore } from "@/lib/fan/store";

export async function GET(req: NextRequest, { params }: { params: Promise<{ fixtureId: string }> }) {
    const wallet = await requireFanWallet(req);
    if (!wallet) return noStoreJson({ error: "authentication_required" }, { status: 401 });
    try {
        const { fixtureId } = await params;
        const roomId = req.nextUrl.searchParams.get("roomId");
        return noStoreJson({ recap: await getFanStore().recap(wallet, fixtureId, roomId) });
    } catch (error) { return fanApiError(error); }
}
