import { NextRequest } from "next/server";
import { z } from "zod";
import { fanApiError, noStoreJson, requireFanWallet } from "@/lib/fan/api";
import { getFanStore } from "@/lib/fan/store";

const JoinSchema = z.object({
    roomIdOrCode: z.string().min(4).max(64),
    displayName: z.string().trim().min(1).max(32),
});

export async function POST(req: NextRequest) {
    const wallet = await requireFanWallet(req);
    if (!wallet) return noStoreJson({ error: "authentication_required" }, { status: 401 });
    const parsed = JoinSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return noStoreJson({ error: "invalid_join_request" }, { status: 400 });
    try {
        const store = getFanStore();
        const room = await store.getRoom(parsed.data.roomIdOrCode);
        if (!room) return noStoreJson({ error: "room_not_found" }, { status: 404 });
        const member = await store.joinRoom({ room, wallet, displayName: parsed.data.displayName });
        return noStoreJson({ room, member, storage: store.mode() });
    } catch (error) {
        return fanApiError(error);
    }
}
