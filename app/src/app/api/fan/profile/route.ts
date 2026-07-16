import { NextRequest } from "next/server";
import { z } from "zod";
import { fanApiError, noStoreJson, requireFanWallet } from "@/lib/fan/api";
import { getFanStore } from "@/lib/fan/store";

const ProfileSchema = z.object({
    displayName: z.string().trim().min(1).max(32),
    favoriteTeam: z.string().trim().max(48).default(""),
});

export async function GET(req: NextRequest) {
    const wallet = await requireFanWallet(req);
    if (!wallet) return noStoreJson({ error: "authentication_required" }, { status: 401 });
    try {
        return noStoreJson({ profile: await getFanStore().getProfile(wallet) });
    } catch (error) { return fanApiError(error); }
}

export async function POST(req: NextRequest) {
    const wallet = await requireFanWallet(req);
    if (!wallet) return noStoreJson({ error: "authentication_required" }, { status: 401 });
    const parsed = ProfileSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return noStoreJson({ error: "invalid_profile" }, { status: 400 });
    try {
        const now = Date.now();
        const current = await getFanStore().getProfile(wallet);
        const profile = await getFanStore().upsertProfile({
            wallet,
            displayName: parsed.data.displayName,
            favoriteTeam: parsed.data.favoriteTeam,
            avatarSeed: current?.avatarSeed || wallet.slice(0, 12),
            createdAt: current?.createdAt || now,
            updatedAt: now,
        });
        return noStoreJson({ profile });
    } catch (error) { return fanApiError(error); }
}
