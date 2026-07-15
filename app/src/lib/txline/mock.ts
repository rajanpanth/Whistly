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

/* Real 2026 World Cup knockout schedule (kick-offs in UTC). */
const scheduledFixtures: Omit<TxLineFixture, "updatedAt">[] = [
  { fixtureId: "wc2026-sf2-eng-arg", homeTeam: "England", awayTeam: "Argentina", competition: "World Cup · Semi-final", status: "SCHEDULED", clockSeconds: 0, homeScore: 0, awayScore: 0, startTimeMs: Date.UTC(2026, 6, 15, 19, 0) },
  { fixtureId: "wc2026-third-place", homeTeam: "France", awayTeam: "Loser SF2", competition: "World Cup · Third place", status: "SCHEDULED", clockSeconds: 0, homeScore: 0, awayScore: 0, startTimeMs: Date.UTC(2026, 6, 18, 21, 0) },
  { fixtureId: "wc2026-final", homeTeam: "Spain", awayTeam: "Winner SF2", competition: "World Cup · Final", status: "SCHEDULED", clockSeconds: 0, homeScore: 0, awayScore: 0, startTimeMs: Date.UTC(2026, 6, 19, 19, 0) },
];

export function getMockFixtures(): TxLineFixture[] {
  const now = new Date().toISOString();
  return [
    { ...baseFixture, ...scenarioScorePatch(), updatedAt: now },
    ...scheduledFixtures.map(fixture => ({ ...fixture, updatedAt: now })),
  ];
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
