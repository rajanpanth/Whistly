import { NextRequest, NextResponse } from "next/server";
import { getMockScenario, setMockScenario } from "@/lib/txline/mock";
import { isTxLineMockMode } from "@/lib/txline/client";

const scenarios = new Set(["BASE", "YES_GOAL", "NO_GOAL"]);

export async function GET() {
  if (!isTxLineMockMode()) {
    return NextResponse.json({ error: "mock_mode_disabled", message: "Mock scenario controls require NEXT_PUBLIC_ENABLE_MOCK_MODE=true." }, { status: 403 });
  }
  return NextResponse.json({ scenario: getMockScenario() });
}

export async function POST(request: NextRequest) {
  if (!isTxLineMockMode()) {
    return NextResponse.json({ error: "mock_mode_disabled", message: "Mock scenario controls require NEXT_PUBLIC_ENABLE_MOCK_MODE=true." }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const scenario = String(body.scenario || "BASE");
  if (!scenarios.has(scenario)) {
    return NextResponse.json({ error: "invalid_scenario" }, { status: 400 });
  }

  const score = setMockScenario(scenario as "BASE" | "YES_GOAL" | "NO_GOAL");
  return NextResponse.json({ scenario, score });
}
