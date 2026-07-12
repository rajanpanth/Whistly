import { NextRequest, NextResponse } from "next/server";
import { getMockScenario, setMockScenario } from "@/lib/txline/mock";

const scenarios = new Set(["BASE", "YES_GOAL", "NO_GOAL"]);

export async function GET() {
  return NextResponse.json({ scenario: getMockScenario() });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const scenario = String(body.scenario || "BASE");
  if (!scenarios.has(scenario)) {
    return NextResponse.json({ error: "invalid_scenario" }, { status: 400 });
  }

  const score = setMockScenario(scenario as "BASE" | "YES_GOAL" | "NO_GOAL");
  return NextResponse.json({ scenario, score });
}
