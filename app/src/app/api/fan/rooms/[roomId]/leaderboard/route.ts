import { NextRequest } from "next/server";
import { fanApiError, noStoreJson } from "@/lib/fan/api";
import { getFanStore } from "@/lib/fan/store";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
    try {
        const { roomId } = await params;
        const store = getFanStore();
        const room = await store.getRoom(roomId);
        if (!room) return noStoreJson({ error: "room_not_found" }, { status: 404 });
        return noStoreJson({ roomId: room.id, leaderboard: await store.leaderboard(room.id) });
    } catch (error) {
        return fanApiError(error);
    }
}
