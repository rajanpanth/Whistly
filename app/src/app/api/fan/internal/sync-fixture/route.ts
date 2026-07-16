import { NextRequest } from "next/server";
import { z } from "zod";
import { fanApiError, noStoreJson } from "@/lib/fan/api";
import { syncFixtureChallenges } from "@/lib/fan/service";

const Schema = z.object({ fixtureId: z.string().min(1).max(100) });

export async function POST(req: NextRequest) {
    const secret = process.env.FAN_CRON_SECRET;
    if (!secret || req.headers.get("x-fan-cron-secret") !== secret) {
        return noStoreJson({ error: "unauthorized" }, { status: 401 });
    }
    const parsed = Schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return noStoreJson({ error: "invalid_fixture" }, { status: 400 });
    try { return noStoreJson(await syncFixtureChallenges(parsed.data.fixtureId)); }
    catch (error) { return fanApiError(error); }
}
