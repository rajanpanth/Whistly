import { NextRequest, NextResponse } from "next/server";
import { createLiveGoalMarket } from "@/lib/liveGoalMarketStore";
import { isLiveGoalWindowMinutes } from "@/lib/liveGoalMarkets";
import { fetchTxLineFixtures, TxLineNotConfiguredError } from "@/lib/txline/client";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const windowMinutes = Number(body.windowMinutes);
  const fixtureId = typeof body.fixtureId === "string" ? body.fixtureId.trim() : "";

  if (!isLiveGoalWindowMinutes(windowMinutes)) {
    return NextResponse.json({ error: "invalid_window_minutes" }, { status: 400 });
  }
  if (!body.onchainMarketPubkey || typeof body.onchainMarketPubkey !== "string") {
    return NextResponse.json({ error: "missing_onchain_market_pubkey" }, { status: 400 });
  }
  if (!Number.isFinite(Number(body.onchainPollId))) {
    return NextResponse.json({ error: "missing_onchain_poll_id" }, { status: 400 });
  }
  if (!fixtureId) {
    return NextResponse.json({ error: "missing_fixture_id", message: "Real-data market creation requires a valid TxLINE fixtureId." }, { status: 400 });
  }

  let fixtures;
  let source;
  try {
    ({ fixtures, source } = await fetchTxLineFixtures());
  } catch (error) {
    if (error instanceof TxLineNotConfiguredError) {
      return NextResponse.json({
        error: "txline_not_configured",
        message: "Market creation disabled — TxLINE Not Configured and mock mode is off.",
      }, { status: 503 });
    }
    return NextResponse.json({ error: "txline_error", message: "TxLINE Error — could not verify fixture." }, { status: 502 });
  }

  // No silent fallback to another fixture: the requested fixture must exist.
  const fixture = fixtures.find(item => item.fixtureId === fixtureId);
  if (!fixture) {
    return NextResponse.json({ error: "fixture_not_found", fixtureId }, { status: 404 });
  }

  const market = createLiveGoalMarket({
    onchainMarketPubkey: body.onchainMarketPubkey,
    onchainPollId: Number(body.onchainPollId),
    fixture,
    windowMinutes,
  });

  return NextResponse.json({ market, source });
}

export async function GET() {
  const { listLiveGoalMarkets } = await import("@/lib/liveGoalMarketStore");
  return NextResponse.json({ markets: listLiveGoalMarkets() });
}
