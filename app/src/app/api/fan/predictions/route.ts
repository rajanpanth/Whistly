import { NextRequest } from "next/server";
import { z } from "zod";
import { fanApiError, noStoreJson, requireFanWallet } from "@/lib/fan/api";
import { getFanStore } from "@/lib/fan/store";

const PredictionSchema = z.object({
    challengeId: z.string().min(4).max(160),
    selectedOutcome: z.union([z.literal(0), z.literal(1)]),
});

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const wallet = await requireFanWallet(req);
    if (!wallet) return noStoreJson({ error: "authentication_required" }, { status: 401 });
    try {
        const fixtureId = req.nextUrl.searchParams.get("fixtureId") ?? undefined;
        const store = getFanStore();
        return noStoreJson({ predictions: await store.listPredictions(wallet, fixtureId), storage: store.mode() });
    } catch (error) {
        return fanApiError(error);
    }
}

export async function POST(req: NextRequest) {
    const wallet = await requireFanWallet(req);
    if (!wallet) return noStoreJson({ error: "authentication_required" }, { status: 401 });
    const parsed = PredictionSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return noStoreJson({ error: "invalid_prediction" }, { status: 400 });
    try {
        const store = getFanStore();
        const challenge = await store.getChallenge(parsed.data.challengeId);
        if (!challenge) return noStoreJson({ error: "challenge_not_found" }, { status: 404 });
        const prediction = await store.submitPrediction({ challenge, wallet, selectedOutcome: parsed.data.selectedOutcome });
        return noStoreJson({ prediction, storage: store.mode() }, { status: 201 });
    } catch (error) {
        return fanApiError(error);
    }
}
