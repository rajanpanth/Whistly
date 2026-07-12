import {
  getLiveGoalMarketStatus,
  LIVE_GOAL_MARKET_KIND,
  type LiveGoalMarketMetadata,
  type LiveGoalWindowMinutes,
} from "@/lib/liveGoalMarkets";
import type { TxLineFixture } from "@/lib/txline/mock";

type CreateLiveGoalMarketInput = {
  onchainMarketPubkey: string;
  onchainPollId: number;
  fixture: TxLineFixture;
  windowMinutes: LiveGoalWindowMinutes;
};

const globalStore = globalThis as typeof globalThis & {
  __instinctfiLiveGoalMarkets?: LiveGoalMarketMetadata[];
};

function store(): LiveGoalMarketMetadata[] {
  if (!globalStore.__instinctfiLiveGoalMarkets) {
    globalStore.__instinctfiLiveGoalMarkets = [];
  }
  return globalStore.__instinctfiLiveGoalMarkets;
}

export function listLiveGoalMarkets(): LiveGoalMarketMetadata[] {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return store().map(market => ({
    ...market,
    status: getLiveGoalMarketStatus(nowSeconds, market),
  }));
}

export function getLiveGoalMarket(id: string): LiveGoalMarketMetadata | undefined {
  return listLiveGoalMarkets().find(market => market.id === id);
}

export function createLiveGoalMarket(input: CreateLiveGoalMarketInput): LiveGoalMarketMetadata {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const createdAt = new Date().toISOString();
  const windowEndTs = nowSeconds + input.windowMinutes * 60;
  const lockTs = nowSeconds + Math.min(60, input.windowMinutes * 60);
  const id = `${input.fixture.fixtureId}-${input.windowMinutes}-${input.onchainPollId}`;

  const existing = store().find(market => market.id === id);
  if (existing) return existing;

  const market: LiveGoalMarketMetadata = {
    id,
    onchainMarketPubkey: input.onchainMarketPubkey,
    onchainPollId: input.onchainPollId,
    txoddsFixtureId: input.fixture.fixtureId,
    marketKind: LIVE_GOAL_MARKET_KIND,
    homeTeam: input.fixture.homeTeam,
    awayTeam: input.fixture.awayTeam,
    matchClockAtStart: `${Math.floor(input.fixture.clockSeconds / 60)}:${(input.fixture.clockSeconds % 60).toString().padStart(2, "0")}`,
    windowMinutes: input.windowMinutes,
    windowStartTs: nowSeconds,
    lockTs,
    windowEndTs,
    startHomeScore: input.fixture.homeScore,
    startAwayScore: input.fixture.awayScore,
    status: "OPEN",
    resolutionSource: "MOCK",
    createdAt,
    updatedAt: createdAt,
  };

  store().unshift(market);
  return market;
}

export function updateLiveGoalMarket(id: string, patch: Partial<LiveGoalMarketMetadata>): LiveGoalMarketMetadata | undefined {
  const markets = store();
  const index = markets.findIndex(market => market.id === id);
  if (index === -1) return undefined;

  const updated = {
    ...markets[index],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  markets[index] = updated;
  return updated;
}
