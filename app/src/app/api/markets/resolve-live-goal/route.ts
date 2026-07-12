import { NextRequest, NextResponse } from "next/server";
import { getLiveGoalMarket, updateLiveGoalMarket } from "@/lib/liveGoalMarketStore";
import { resolveGoalWindowMarket } from "@/lib/liveGoalMarkets";
import { fetchTxLineScore, isTxLineMockMode } from "@/lib/txline/client";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const marketId = String(body.marketId || "");
  const market = getLiveGoalMarket(marketId);

  if (!market) {
    return NextResponse.json({ error: "market_not_found" }, { status: 404 });
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const forceDemo = body.forceDemo === true && isTxLineMockMode();
  if (nowSeconds < market.windowEndTs && !forceDemo) {
    return NextResponse.json({
      error: "window_not_ended",
      windowEndTs: market.windowEndTs,
      nowSeconds,
    }, { status: 409 });
  }

  const score = await fetchTxLineScore(market.txoddsFixtureId);
  const resolution = resolveGoalWindowMarket({
    startHomeScore: market.startHomeScore,
    startAwayScore: market.startAwayScore,
    endHomeScore: score.homeScore,
    endAwayScore: score.awayScore,
  });

  const settlementTx = typeof body.settlementTx === "string" && body.settlementTx.length > 0
    ? body.settlementTx
    : undefined;

  const updatedMarket = updateLiveGoalMarket(market.id, {
    status: settlementTx ? "RESOLVED" : "RESOLVING",
    endHomeScore: score.homeScore,
    endAwayScore: score.awayScore,
    winningOutcome: resolution.resolvedOutcome,
    winningOptionIndex: resolution.winningOptionIndex,
    settlementTx: settlementTx ?? market.settlementTx,
    resolutionSource: isTxLineMockMode() ? "MOCK" : "TXLINE_SCORE",
  });

  return NextResponse.json({
    market: updatedMarket,
    resolution,
    score,
    onchainSettlement: {
      required: !settlementTx,
      instruction: "admin_settle_poll",
      winningOptionIndex: resolution.winningOptionIndex,
      settlementTx: settlementTx ?? null,
      note: settlementTx
        ? "On-chain admin settlement signature recorded."
        : "Outcome prepared. Use the admin wallet flow to write this resolved outcome on-chain, then call this route with settlementTx.",
    },
  });
}
