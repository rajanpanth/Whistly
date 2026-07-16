import { NextRequest } from "next/server";
import { z } from "zod";
import { fanApiError, noStoreJson, requireFanWallet } from "@/lib/fan/api";
import { getFanStore } from "@/lib/fan/store";

const RoomSchema = z.object({
    fixtureId: z.string().min(1).max(100),
    name: z.string().trim().min(1).max(48),
    displayName: z.string().trim().min(1).max(32),
});

export async function POST(req: NextRequest) {
    const wallet = await requireFanWallet(req);
    if (!wallet) return noStoreJson({ error: "authentication_required" }, { status: 401 });
    const parsed = RoomSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return noStoreJson({ error: "invalid_room" }, { status: 400 });
    try {
        const store = getFanStore();
        const room = await store.createRoom({ ...parsed.data, creatorWallet: wallet });
        return noStoreJson({ room, storage: store.mode() }, { status: 201 });
    } catch (error) {
        return fanApiError(error);
    }
}
