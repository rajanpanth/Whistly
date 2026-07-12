import { NextResponse } from "next/server";
import { fetchTxLineFixtures, isTxLineMockMode } from "@/lib/txline/client";

export async function GET() {
  const fixtures = await fetchTxLineFixtures();
  return NextResponse.json({
    mockMode: isTxLineMockMode(),
    fixtures,
  });
}
