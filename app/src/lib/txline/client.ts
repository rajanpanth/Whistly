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

async function txLineFetch(path: string): Promise<Response> {
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
  return response;
}

async function txLineRequest<T>(path: string): Promise<T> {
  return (await txLineFetch(path)).json() as Promise<T>;
}

async function txLineSequence(path: string): Promise<Array<Record<string, unknown>>> {
  const response = await txLineFetch(path);
  const body = await response.text();
  if (body.trimStart().startsWith("[")) return JSON.parse(body) as Array<Record<string, unknown>>;
  const entries: Array<Record<string, unknown>> = [];
  for (const line of body.split(/\r?\n/)) {
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    try { entries.push(JSON.parse(payload) as Record<string, unknown>); }
    catch { /* Ignore malformed keepalive/event lines, not valid score packets. */ }
  }
  return entries;
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
    status: normalizeGameState(gameState, startsInFuture),
    clockSeconds: 0,
    homeScore: 0,
    awayScore: 0,
    startTimeMs: real.StartTime,
    updatedAt: new Date(real.Ts || Date.now()).toISOString(),
  };
}

function normalizeGameState(state: string | number, startsInFuture = false): TxLineFixture["status"] {
  if (typeof state === "number") {
    if ([5, 10, 13].includes(state)) return "FINISHED";
    if (state === 15) return "ABANDONED";
    if (state === 16 || state === 17) return "CANCELLED";
    if (state === 19) return "POSTPONED";
    if (state === 1 || startsInFuture) return "SCHEDULED";
    return "LIVE";
  }
  const normalized = state.toUpperCase();
  if (["F", "FET", "FPE", "END", "ENDED", "FINISHED"].includes(normalized)) return "FINISHED";
  if (["A", "ABANDONED"].includes(normalized)) return "ABANDONED";
  if (["C", "TXCC", "TXCS", "CANCELLED", "CANCELED"].includes(normalized)) return "CANCELLED";
  if (["P", "POSTPONED"].includes(normalized)) return "POSTPONED";
  if (["NS", "SCHEDULED", "NOT_STARTED"].includes(normalized) || startsInFuture) return "SCHEDULED";
  return "LIVE";
}

/** Read goals without double-counting cumulative Total/HT/ETTotal buckets. */
function sumGoals(totalScore: unknown): number {
  if (!totalScore || typeof totalScore !== "object") return 0;
  const periods = totalScore as Record<string, unknown>;
  const goals = (key: string) => {
    const period = periods[key];
    return period && typeof period === "object" && typeof (period as { Goals?: unknown }).Goals === "number"
      ? (period as { Goals: number }).Goals
      : null;
  };
  const total = goals("Total");
  if (total !== null) return total;
  const regulationAndExtraTime = ["H1", "H2", "ET1", "ET2"].map(goals).filter((value): value is number => value !== null);
  if (regulationAndExtraTime.length) return regulationAndExtraTime.reduce((sum, value) => sum + value, 0);
  return goals("HT") ?? goals("ETTotal") ?? 0;
}

/** Best-effort extraction of participant goal totals from a scores payload entry. */
function extractScores(entry: Record<string, unknown>): { p1Goals: number; p2Goals: number } | null {
  let rawStats = entry.stats ?? entry.Stats;
  if (typeof rawStats === "string" && rawStats.startsWith("{")) {
    try { rawStats = JSON.parse(rawStats); } catch { rawStats = null; }
  }
  if (rawStats && typeof rawStats === "object") {
    const stats = rawStats as Record<string, unknown>;
    if (typeof stats["1"] === "number" && typeof stats["2"] === "number") {
      return { p1Goals: stats["1"], p2Goals: stats["2"] };
    }
  }
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

function entryClockSeconds(entry: Record<string, unknown>): number {
  const rawClock = entry.clock ?? entry.Clock;
  const clock = rawClock && typeof rawClock === "object" ? rawClock as { seconds?: unknown; Seconds?: unknown } : null;
  if (typeof clock?.seconds === "number") return clock.seconds;
  if (typeof clock?.Seconds === "number") return clock.Seconds;
  const rawSoccer = entry.dataSoccer ?? entry.DataSoccer ?? entry.Data;
  const soccer = rawSoccer && typeof rawSoccer === "object" ? rawSoccer as Record<string, unknown> : null;
  const minutes = soccer?.Minutes ?? soccer?.minutes;
  return typeof minutes === "number" ? minutes * 60 : 0;
}

function entryTimestamp(entry: Record<string, unknown>): number {
  const candidate = entry.ts ?? entry.Ts;
  const raw = typeof candidate === "number" ? candidate : Date.now();
  return raw < 1_000_000_000_000 ? raw * 1_000 : raw;
}

function goalEvents(entries: Array<Record<string, unknown>>, participant1IsHome: boolean): TxLineScore["events"] {
  let previous: { home: number; away: number } | null = null;
  const events: TxLineScore["events"] = [];
  for (const [index, entry] of entries.entries()) {
    const scores = extractScores(entry);
    if (!scores) continue;
    const home = participant1IsHome ? scores.p1Goals : scores.p2Goals;
    const away = participant1IsHome ? scores.p2Goals : scores.p1Goals;
    const rawSoccer = entry.dataSoccer ?? entry.DataSoccer ?? entry.Data;
    const soccer = rawSoccer && typeof rawSoccer === "object" ? rawSoccer as Record<string, unknown> : {};
    const homeIncreased = previous ? home > previous.home : false;
    const awayIncreased = previous ? away > previous.away : false;
    // TxLINE can flag possible/disallowed goal actions. A score transition is
    // the authoritative consumer signal, so only emit a goal when totals move.
    if (homeIncreased || awayIncreased) {
      const participant = Number(soccer.Participant ?? entry.Participant ?? 0);
      const team = homeIncreased ? "HOME" : awayIncreased ? "AWAY" :
        participant ? ((participant === 1) === participant1IsHome ? "HOME" : "AWAY") : "HOME";
      events.push({
        id: String(entry.id ?? entry.Id ?? entry.seq ?? entry.Seq ?? `goal-${index}`),
        type: "GOAL",
        clockSeconds: entryClockSeconds(entry),
        team,
        scoreAfter: `${home}-${away}`,
      });
    }
    previous = { home, away };
  }
  return events.filter((event, index, all) => index === 0 || event.id !== all[index - 1].id);
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

/** Completed fixtures from TxLINE's real snapshot window for replay discovery. */
export async function fetchTxLineReplayFixtures(): Promise<{ fixtures: TxLineFixture[]; source: "txline" }> {
  if (!isTxLineConfigured()) throw new TxLineNotConfiguredError(txLineMissingEnvVars());
  const startEpochDay = Math.floor((Date.now() - 30 * 86_400_000) / 86_400_000);
  const real = await txLineRequest<RealFixture[]>(`/api/fixtures/snapshot?startEpochDay=${startEpochDay}`);
  const finishedBefore = Date.now() - 4 * 60 * 60 * 1_000;
  const fixtures = real
    .filter((item) => item.StartTime < finishedBefore)
    .map((item) => ({ ...adaptFixture(item), status: "FINISHED" as const }))
    .sort((a, b) => (b.startTimeMs ?? 0) - (a.startTimeMs ?? 0));
  return { fixtures, source: "txline" };
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
    const participant1IsHome = (latest.participant1IsHome ?? latest.Participant1IsHome) !== false;
    const rawGameState = latest.gameState ?? latest.GameState;
    const gameState = typeof rawGameState === "string" || typeof rawGameState === "number" ? rawGameState : "";
    return {
      score: {
        fixtureId,
        clockSeconds: entryClockSeconds(latest),
        homeScore: participant1IsHome ? participantScores.p1Goals : participantScores.p2Goals,
        awayScore: participant1IsHome ? participantScores.p2Goals : participantScores.p1Goals,
        status: normalizeGameState(gameState),
        events: goalEvents(entries, participant1IsHome),
        updatedAt: new Date(entryTimestamp(latest)).toISOString(),
      },
      source: "txline",
    };
  }
  if (isTxLineMockMode()) {
    return { score: getMockScore(fixtureId), source: "mock" };
  }
  throw new TxLineNotConfiguredError(txLineMissingEnvVars());
}

export type TxLineReplayPoint = {
  sequence: number;
  clockSeconds: number;
  homeScore: number;
  awayScore: number;
  status: TxLineFixture["status"];
  action: string;
  isGoal: boolean;
  updatedAt: string;
};

/** Provider-backed historical replay. This deliberately has no mock fallback. */
export async function fetchTxLineHistoricalScores(fixtureId: string): Promise<{
  fixtureId: string;
  points: TxLineReplayPoint[];
  source: "txline";
}> {
  if (!isTxLineConfigured()) throw new TxLineNotConfiguredError(txLineMissingEnvVars());
  const entries = await txLineSequence(
    `/api/scores/historical/${encodeURIComponent(fixtureId)}`
  );
  let previousTotal = 0;
  let previousClock = 0;
  const points = (Array.isArray(entries) ? entries : [])
    .sort((a, b) => Number(a.seq ?? a.Seq ?? a.ts ?? a.Ts ?? 0) - Number(b.seq ?? b.Seq ?? b.ts ?? b.Ts ?? 0))
    .flatMap((entry, index): TxLineReplayPoint[] => {
      const scores = extractScores(entry);
      if (!scores) return [];
      const participant1IsHome = (entry.participant1IsHome ?? entry.Participant1IsHome) !== false;
      const homeScore = participant1IsHome ? scores.p1Goals : scores.p2Goals;
      const awayScore = participant1IsHome ? scores.p2Goals : scores.p1Goals;
      const total = homeScore + awayScore;
      const rawSoccerData = entry.dataSoccer ?? entry.DataSoccer ?? entry.Data;
      const soccerData = rawSoccerData && typeof rawSoccerData === "object"
        ? rawSoccerData as Record<string, unknown>
        : {};
      const minutes = typeof soccerData.Minutes === "number" ? soccerData.Minutes : 0;
      const gameState = String(entry.gameState ?? entry.GameState ?? "");
      const action = String(entry.action ?? entry.Action ?? soccerData.Action ?? soccerData.Type ?? "Score update");
      const reportedClock = entryClockSeconds(entry) || minutes * 60;
      if (reportedClock > 0) previousClock = reportedClock;
      const point: TxLineReplayPoint = {
        sequence: Number(entry.seq ?? entry.Seq ?? index),
        clockSeconds: reportedClock || previousClock,
        homeScore,
        awayScore,
        status: normalizeGameState(gameState),
        action,
        isGoal: total > previousTotal,
        updatedAt: new Date(entryTimestamp(entry)).toISOString(),
      };
      previousTotal = total;
      return [point];
    })
    .filter((point, index, all) => index === 0 || point.sequence !== all[index - 1].sequence);
  return { fixtureId, points, source: "txline" };
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
