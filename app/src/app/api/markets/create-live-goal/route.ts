import { NextRequest, NextResponse } from "next/server";
import { createLiveGoalMarket } from "@/lib/liveGoalMarketStore";
import { isLiveGoalWindowMinutes } from "@/lib/liveGoalMarkets";
import { fetchTxLineFixtures } from "@/lib/txline/client";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const windowMinutes = Number(body.windowMinutes);

  if (!isLiveGoalWindowMinutes(windowMinutes)) {
    return NextResponse.json({ error: "invalid_window_minutes" }, { status: 400 });
  }
  if (!body.onchainMarketPubkey || typeof body.onchainMarketPubkey !== "string") {
    return NextResponse.json({ error: "missing_onchain_market_pubkey" }, { status: 400 });
  }
  if (!Number.isFinite(Number(body.onchainPollId))) {
    return NextResponse.json({ error: "missing_onchain_poll_id" }, { status: 400 });
  }

  const fixtures = await fetchTxLineFixtures();
  const fixture = fixtures.find(item => item.fixtureId === String(body.fixtureId)) ?? fixtures[0];
  if (!fixture) {
    return NextResponse.json({ error: "fixture_not_found" }, { status: 404 });
  }

  const market = createLiveGoalMarket({
    onchainMarketPubkey: body.onchainMarketPubkey,
    onchainPollId: Number(body.onchainPollId),
    fixture,
    windowMinutes,
  });

  return NextResponse.json({ market });
}

export async function GET() {
  const { listLiveGoalMarkets } = await import("@/lib/liveGoalMarketStore");
  return NextResponse.json({ markets: listLiveGoalMarkets() });
}
