import { getMockFixtures, getMockScore, type TxLineFixture, type TxLineScore } from "./mock";
import { getRuntimeApiToken, getRuntimeGuestJwt, setRuntimeGuestJwt } from "./runtimeAuth";

/**
 * Fail-closed TxLINE client against the REAL TxLINE API
 * (https://txline.txodds.com/docs/docs.yaml).
 *
 * Auth model (per TxLINE docs):
 *  - Guest JWT: POST {origin}/auth/guest/start — public, no signup. Auto-fetched
 *    and renewed server-side; TXLINE_GUEST_JWT env var overrides if set.
 *  - API token: required for data endpoints. Comes from TXLINE_API_TOKEN env var
 *    OR the in-app free-tier activation flow (wallet-signed on-chain subscribe).
 *
 * Data source resolution:
 *  - API token available             → real TxLINE requests ("txline")
 *  - NEXT_PUBLIC_ENABLE_MOCK_MODE    → clearly-labeled mock data ("mock")
 *  - otherwise                       → TxLineNotConfiguredError (fail closed).
 */

const DEFAULT_ORIGIN = "https://txline-dev.txodds.com"; // devnet API origin

export type TxLineDataSource = "txline" | "mock";
export type TxLineServiceState = "connected" | "not_configured" | "error" | "mock";

export class TxLineNotConfiguredError extends Error {
  constructor(public missingEnvVars: string[]) {
    super(`TxLINE not configured. Missing: ${missingEnvVars.join(", ")}`);
    this.name = "TxLineNotConfiguredError";
  }
}

export class TxLineRequestError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "TxLineRequestError";
  }
}

export function txLineOrigin(): string {
  return (process.env.TXLINE_BASE_URL || DEFAULT_ORIGIN).replace(/\/(api\/?)?$/, "");
}

export function isTxLineMockMode(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_MOCK_MODE === "true";
}

function apiToken(): string {
  return process.env.TXLINE_API_TOKEN || getRuntimeApiToken();
}

export function txLineMissingEnvVars(): string[] {
  // The guest JWT is auto-issued, so only the API token is strictly required.
  return apiToken() ? [] : ["TXLINE_API_TOKEN (or run the in-app free-tier activation)"];
}

export function isTxLineConfigured(): boolean {
  return Boolean(apiToken());
}

export function txLineDataSource(): TxLineDataSource | "none" {
  if (isTxLineConfigured()) return "txline";
  if (isTxLineMockMode()) return "mock";
  return "none";
}

/** Fetch (or reuse) a guest session JWT. Public endpoint — no credentials needed. */
export async function getGuestJwt(forceRenew = false): Promise<string> {
  const fromEnv = process.env.TXLINE_GUEST_JWT;
  if (fromEnv && !forceRenew) return fromEnv;
  const cached = getRuntimeGuestJwt();
  if (cached && !forceRenew) return cached;

  const response = await fetch(`${txLineOrigin()}/auth/guest/start`, { method: "POST", cache: "no-store" });
  if (!response.ok) {
    throw new TxLineRequestError(`Guest session request failed: ${response.status}`, response.status);
  }
  const data = await response.json() as { token: string };
  setRuntimeGuestJwt(data.token);
  return data.token;
}

async function txLineRequest<T>(path: string): Promise<T> {
  const doFetch = async (jwt: string) => fetch(`${txLineOrigin()}${path}`, {
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${jwt}`,
      "x-api-token": apiToken(),
    },
    cache: "no-store",
  });

  let response = await doFetch(await getGuestJwt());
  if (response.status === 401) {
    // Guest JWT expired — renew once and retry.
    response = await doFetch(await getGuestJwt(true));
  }
  if (!response.ok) {
    throw new TxLineRequestError(`TxLINE ${path} failed: ${response.status}`, response.status);
  }
  return response.json() as Promise<T>;
}

// ── Real API response shapes (docs.yaml) ─────────────────────────────────────

type RealFixture = {
  Ts: number;
  StartTime: number;
  Competition: string;
  CompetitionId: number;
  FixtureGroupId: number;
  Participant1Id: number;
  Participant1: string;
  Participant2Id: number;
  Participant2: string;
  FixtureId: number;
  Participant1IsHome: boolean;
  GameState?: number;
  gameState?: number;
};

function adaptFixture(real: RealFixture): TxLineFixture {
  const home = real.Participant1IsHome ? real.Participant1 : real.Participant2;
  const away = real.Participant1IsHome ? real.Participant2 : real.Participant1;
  const gameState = real.GameState ?? real.gameState ?? 1;
  const startsInFuture = real.StartTime > Date.now();
  return {
    fixtureId: String(real.FixtureId),
    homeTeam: home,
    awayTeam: away,
    competition: real.Competition,
    status: gameState === 6 ? "FINISHED" : startsInFuture ? "SCHEDULED" : "LIVE",
    clockSeconds: 0,
    homeScore: 0,
    awayScore: 0,
    startTimeMs: real.StartTime,
    updatedAt: new Date(real.Ts || Date.now()).toISOString(),
  };
}

/** Sum goals from a SoccerTotalScore object ({H1: {Goals..}, H2: {...}, ...}). */
function sumGoals(totalScore: unknown): number {
  if (!totalScore || typeof totalScore !== "object") return 0;
  let goals = 0;
  for (const period of Object.values(totalScore as Record<string, unknown>)) {
    if (period && typeof period === "object" && typeof (period as { Goals?: unknown }).Goals === "number") {
      goals += (period as { Goals: number }).Goals;
    }
  }
  return goals;
}

/** Best-effort extraction of participant goal totals from a scores payload entry. */
function extractScores(entry: Record<string, unknown>): { p1Goals: number; p2Goals: number } | null {
  const queue: unknown[] = [entry];
  while (queue.length > 0) {
    const node = queue.shift();
    if (!node || typeof node !== "object") continue;
    const record = node as Record<string, unknown>;
    if (record.Participant1 !== undefined && record.Participant2 !== undefined) {
      const p1 = sumGoals(record.Participant1);
      const p2 = sumGoals(record.Participant2);
      return { p1Goals: p1, p2Goals: p2 };
    }
    for (const value of Object.values(record)) {
      if (value && typeof value === "object") queue.push(value);
      if (typeof value === "string" && value.startsWith("{")) {
        try { queue.push(JSON.parse(value)); } catch { /* not JSON */ }
      }
    }
  }
  return null;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function fetchTxLineFixtures(): Promise<{ fixtures: TxLineFixture[]; source: TxLineDataSource }> {
  if (isTxLineConfigured()) {
    const competitionId = process.env.TXLINE_COMPETITION_ID;
    const query = competitionId ? `?competitionId=${encodeURIComponent(competitionId)}` : "";
    const real = await txLineRequest<RealFixture[]>(`/api/fixtures/snapshot${query}`);
    const fixtures = real
      .map(adaptFixture)
      .sort((a, b) => (a.startTimeMs ?? 0) - (b.startTimeMs ?? 0));
    return { fixtures, source: "txline" };
  }
  if (isTxLineMockMode()) {
    return { fixtures: getMockFixtures(), source: "mock" };
  }
  throw new TxLineNotConfiguredError(txLineMissingEnvVars());
}

export async function fetchTxLineScore(fixtureId: string): Promise<{ score: TxLineScore; source: TxLineDataSource }> {
  if (isTxLineConfigured()) {
    const entries = await txLineRequest<Array<Record<string, unknown>>>(`/api/scores/snapshot/${encodeURIComponent(fixtureId)}`);
    if (!Array.isArray(entries) || entries.length === 0) {
      throw new TxLineRequestError(`TxLINE returned no score data for fixture ${fixtureId}`, 404);
    }
    const latest = entries[entries.length - 1];
    const participantScores = extractScores(latest);
    if (!participantScores) {
      throw new TxLineRequestError(`Could not parse TxLINE score payload for fixture ${fixtureId}`);
    }
    const participant1IsHome = latest.participant1IsHome !== false;
    const gameState = typeof latest.gameState === "string" ? latest.gameState : "";
    return {
      score: {
        fixtureId,
        clockSeconds: 0,
        homeScore: participant1IsHome ? participantScores.p1Goals : participantScores.p2Goals,
        awayScore: participant1IsHome ? participantScores.p2Goals : participantScores.p1Goals,
        status: gameState === "END" || gameState.startsWith("F") ? "FINISHED" : "LIVE",
        events: [],
        updatedAt: new Date(typeof latest.ts === "number" ? latest.ts : Date.now()).toISOString(),
      },
      source: "txline",
    };
  }
  if (isTxLineMockMode()) {
    return { score: getMockScore(fixtureId), source: "mock" };
  }
  throw new TxLineNotConfiguredError(txLineMissingEnvVars());
}

/** Live connectivity probe against the real TxLINE API (never mocks). */
export async function probeTxLine(): Promise<TxLineServiceState> {
  if (!isTxLineConfigured()) return isTxLineMockMode() ? "mock" : "not_configured";
  try {
    await txLineRequest<unknown>("/api/fixtures/snapshot");
    return "connected";
  } catch {
    return "error";
  }
}
