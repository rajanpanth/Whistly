import { getFanFixtures } from "@/lib/fan/service";
import { noStoreJson } from "@/lib/fan/api";
import { TxLineNotConfiguredError } from "@/lib/txline/client";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const feed = await getFanFixtures();
        return noStoreJson(feed);
    } catch (error) {
        if (error instanceof TxLineNotConfiguredError) {
            return noStoreJson({ error: "txline_not_configured", fixtures: [] }, { status: 503 });
        }
        return noStoreJson({ error: "txline_unavailable", fixtures: [] }, { status: 502 });
    }
}
