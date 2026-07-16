import { NextRequest } from "next/server";
import { fanApiError, noStoreJson } from "@/lib/fan/api";
import { syncFixtureChallenges } from "@/lib/fan/service";

export const dynamic = "force-dynamic";

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ fixtureId: string }> }
) {
    try {
        const { fixtureId } = await params;
        const result = await syncFixtureChallenges(fixtureId);
        if (!result.fixture) return noStoreJson({ error: "fixture_not_found" }, { status: 404 });
        return noStoreJson(result);
    } catch (error) {
        return fanApiError(error);
    }
}
