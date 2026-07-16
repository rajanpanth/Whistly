import { noStoreJson } from "@/lib/fan/api";
import { fetchTxLineReplayFixtures, TxLineNotConfiguredError, TxLineRequestError } from "@/lib/txline/client";

export const dynamic = "force-dynamic";

export async function GET() {
    try { return noStoreJson(await fetchTxLineReplayFixtures()); }
    catch (error) {
        if (error instanceof TxLineNotConfiguredError) return noStoreJson({ error: "txline_not_configured" }, { status: 503 });
        if (error instanceof TxLineRequestError) return noStoreJson({ error: "txline_replay_unavailable" }, { status: 502 });
        return noStoreJson({ error: "replay_fixtures_failed" }, { status: 500 });
    }
}
