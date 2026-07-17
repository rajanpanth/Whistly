import { NextRequest, NextResponse } from "next/server";
import { getLiveGoalMarket, updateLiveGoalMarket } from "@/lib/liveGoalMarketStore";
import { resolveGoalWindowMarket } from "@/lib/liveGoalMarkets";
import { fetchTxLineScore, isTxLineMockMode, TxLineNotConfiguredError } from "@/lib/txline/client";
import { requireAdminWallet } from "@/lib/adminAuth";

export async function POST(request: NextRequest) {
  // Resolution flips market status and records the settlement tx — admin only
  // (dry runs included: they reveal the pre-settlement outcome). Rate limited.
  const auth = await requireAdminWallet(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const marketId = String(body.marketId || "");
  const dryRun = body.dryRun === true;
  const market = getLiveGoalMarket(marketId);

  if (!market) {
    return NextResponse.json({ error: "market_not_found" }, { status: 404 });
  }
  if (market.status === "RESOLVED" && !dryRun) {
    return NextResponse.json({ error: "already_resolved", market }, { status: 409 });
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const forceDemo = body.forceDemo === true && isTxLineMockMode();
  if (nowSeconds < market.windowEndTs && !forceDemo && !dryRun) {
    return NextResponse.json({
      error: "window_not_ended",
      windowEndTs: market.windowEndTs,
      nowSeconds,
    }, { status: 409 });
  }

  // Fail closed: no score → no settlement. Never settle from mock data unless
  // mock mode was explicitly enabled (in which case the source is labeled MOCK).
  let score;
  let source;
  try {
    ({ score, source } = await fetchTxLineScore(market.txoddsFixtureId));
  } catch (error) {
    if (error instanceof TxLineNotConfiguredError) {
      return NextResponse.json({
        error: "settlement_disabled_txline_not_configured",
        message: "Settlement disabled until TxLINE is configured (or mock mode is explicitly enabled).",
      }, { status: 503 });
    }
    return NextResponse.json({
      error: "txline_error",
      message: "TxLINE Error — score unavailable; settlement blocked.",
    }, { status: 502 });
  }

  const resolution = resolveGoalWindowMarket({
    startHomeScore: market.startHomeScore,
    startAwayScore: market.startAwayScore,
    endHomeScore: score.homeScore,
    endAwayScore: score.awayScore,
  });

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      market,
      resolution,
      score,
      source,
      note: "Dry run — nothing was updated. Sign the settlement with the admin wallet to finalize.",
    });
  }

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
    resolutionSource: source === "mock" ? "MOCK" : "TXLINE_SCORE",
  });

  return NextResponse.json({
    market: updatedMarket,
    resolution,
    score,
    source,
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
