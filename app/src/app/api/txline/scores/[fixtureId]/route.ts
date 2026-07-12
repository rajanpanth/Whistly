import { NextRequest, NextResponse } from "next/server";
import { fetchTxLineScore, isTxLineMockMode } from "@/lib/txline/client";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ fixtureId: string }> }
) {
  const { fixtureId } = await params;
  const score = await fetchTxLineScore(fixtureId);
  return NextResponse.json({
    mockMode: isTxLineMockMode(),
    score,
  });
}
