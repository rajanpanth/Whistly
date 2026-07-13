import { NextResponse } from "next/server";
import { fetchTxLineFixtures, TxLineNotConfiguredError } from "@/lib/txline/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { fixtures, source } = await fetchTxLineFixtures();
    return NextResponse.json({
      source,
      mockMode: source === "mock",
      fixtures,
    });
  } catch (error) {
    if (error instanceof TxLineNotConfiguredError) {
      return NextResponse.json({
        error: "txline_not_configured",
        missingEnvVars: error.missingEnvVars,
        message: "TxLINE Not Configured — set TXLINE_BASE_URL, TXLINE_GUEST_JWT, TXLINE_API_TOKEN (or enable mock mode explicitly).",
      }, { status: 503 });
    }
    return NextResponse.json({
      error: "txline_error",
      message: "TxLINE Error — fixtures request failed.",
    }, { status: 502 });
  }
}
