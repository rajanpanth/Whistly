import { NextRequest } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rateLimit";
import { fanApiError, noStoreJson, requireFanWallet } from "@/lib/fan/api";
import { getFanStore } from "@/lib/fan/store";

const ReactionSchema = z.object({
    fixtureId: z.string().min(1).max(100),
    reactionType: z.enum(["GOAL", "SHOCK", "APPLAUSE", "FRUSTRATION", "SUPPORT"]),
});

export async function GET(req: NextRequest) {
    const fixtureId = req.nextUrl.searchParams.get("fixtureId");
    if (!fixtureId) return noStoreJson({ error: "fixture_required" }, { status: 400 });
    try {
        const store = getFanStore();
        return noStoreJson({ counts: await store.reactionCounts(fixtureId) });
    } catch (error) {
        return fanApiError(error);
    }
}

export async function POST(req: NextRequest) {
    const wallet = await requireFanWallet(req);
    if (!wallet) return noStoreJson({ error: "authentication_required" }, { status: 401 });
    const parsed = ReactionSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return noStoreJson({ error: "invalid_reaction" }, { status: 400 });
    const limit = await checkRateLimit(`fan-reaction:${wallet}`);
    if (limit.limited) return noStoreJson({ error: "rate_limited" }, { status: 429 });
    try {
        const store = getFanStore();
        await store.addReaction({ id: crypto.randomUUID(), wallet, createdAt: Date.now(), ...parsed.data });
        return noStoreJson({ counts: await store.reactionCounts(parsed.data.fixtureId) }, { status: 201 });
    } catch (error) {
        return fanApiError(error);
    }
}
