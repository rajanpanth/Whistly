import { NextRequest } from "next/server";
import { noStoreJson } from "@/lib/fan/api";
import { fetchTxLineHistoricalScores, TxLineNotConfiguredError, TxLineRequestError } from "@/lib/txline/client";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ fixtureId: string }> }) {
    try {
        const { fixtureId } = await params;
        return noStoreJson(await fetchTxLineHistoricalScores(fixtureId));
    } catch (error) {
        if (error instanceof TxLineNotConfiguredError) return noStoreJson({ error: "txline_not_configured" }, { status: 503 });
        if (error instanceof TxLineRequestError) return noStoreJson({ error: "txline_replay_unavailable", detail: error.message }, { status: error.status === 404 ? 404 : 502 });
        return noStoreJson({ error: "replay_failed", detail: error instanceof Error ? error.message : undefined }, { status: 500 });
    }
}
