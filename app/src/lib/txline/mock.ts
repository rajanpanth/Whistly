export interface TxLineFixture {
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  status: "LIVE" | "SCHEDULED" | "FINISHED";
  clockSeconds: number;
  homeScore: number;
  awayScore: number;
  /** Kick-off time in epoch ms (real TxLINE fixtures). */
  startTimeMs?: number;
  updatedAt: string;
}

export interface TxLineScore {
  fixtureId: string;
  clockSeconds: number;
  homeScore: number;
  awayScore: number;
  status: TxLineFixture["status"];
  events: Array<{
    id: string;
    type: "GOAL";
    clockSeconds: number;
    team: "HOME" | "AWAY";
    scoreAfter: string;
  }>;
  updatedAt: string;
}

type DemoScenario = "BASE" | "YES_GOAL" | "NO_GOAL";

const baseFixture: TxLineFixture = {
  fixtureId: "mock-argentina-brazil-001",
  homeTeam: "Argentina",
  awayTeam: "Brazil",
  competition: "World Cup Demo",
  status: "LIVE",
  clockSeconds: 63 * 60,
  homeScore: 1,
  awayScore: 1,
  updatedAt: new Date().toISOString(),
};

let scenario: DemoScenario = "BASE";

export function getMockFixtures(): TxLineFixture[] {
  return [{ ...baseFixture, ...scenarioScorePatch(), updatedAt: new Date().toISOString() }];
}

export function getMockScore(fixtureId: string): TxLineScore {
  const fixture = getMockFixtures().find(item => item.fixtureId === fixtureId) ?? getMockFixtures()[0];
  const events = scenario === "YES_GOAL"
    ? [{
        id: "mock-goal-6530",
        type: "GOAL" as const,
        clockSeconds: 65 * 60 + 30,
        team: "AWAY" as const,
        scoreAfter: "1-2",
      }]
    : [];

  return {
    fixtureId: fixture.fixtureId,
    clockSeconds: fixture.clockSeconds,
    homeScore: fixture.homeScore,
    awayScore: fixture.awayScore,
    status: fixture.status,
    events,
    updatedAt: new Date().toISOString(),
  };
}

export function setMockScenario(nextScenario: DemoScenario): TxLineScore {
  scenario = nextScenario;
  return getMockScore(baseFixture.fixtureId);
}

export function getMockScenario(): DemoScenario {
  return scenario;
}

function scenarioScorePatch(): Pick<TxLineFixture, "clockSeconds" | "homeScore" | "awayScore"> {
  if (scenario === "YES_GOAL") {
    return {
      clockSeconds: 68 * 60,
      homeScore: 1,
      awayScore: 2,
    };
  }
  if (scenario === "NO_GOAL") {
    return {
      clockSeconds: 68 * 60,
      homeScore: 1,
      awayScore: 1,
    };
  }
  return {
    clockSeconds: 63 * 60,
    homeScore: 1,
    awayScore: 1,
  };
}
