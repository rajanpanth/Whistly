import { NextRequest, NextResponse } from "next/server";
import { fetchTxLineScore, TxLineNotConfiguredError } from "@/lib/txline/client";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ fixtureId: string }> }
) {
  const { fixtureId } = await params;
  try {
    const { score, source } = await fetchTxLineScore(fixtureId);
    return NextResponse.json({
      source,
      mockMode: source === "mock",
      score,
    });
  } catch (error) {
    if (error instanceof TxLineNotConfiguredError) {
      return NextResponse.json({
        error: "txline_not_configured",
        missingEnvVars: error.missingEnvVars,
        message: "TxLINE Not Configured — score data unavailable; settlement disabled.",
      }, { status: 503 });
    }
    return NextResponse.json({
      error: "txline_error",
      message: "TxLINE Error — score request failed.",
    }, { status: 502 });
  }
}
