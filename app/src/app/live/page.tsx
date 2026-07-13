"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  Flame,
  Gauge,
  Lock,
  MessageSquare,
  ShieldCheck,
  Target,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { useApp } from "@/components/Providers";
import DataHealthWidget from "@/components/kicktick/DataHealthWidget";
import SettlementProof from "@/components/kicktick/SettlementProof";
import PollComments from "@/components/PollComments";
import LiveMarketGraph from "@/components/LiveMarketGraph";
import { isAdminWallet } from "@/lib/constants";
import {
  buildLiveGoalMarketTitle,
  formatMatchClock,
  getLiveGoalMarketStatus,
  impliedProbability,
  LIVE_GOAL_WINDOWS,
  type LiveGoalMarketMetadata,
  type LiveGoalOutcome,
  type LiveGoalStatus,
  type LiveGoalWindowMinutes,
} from "@/lib/liveGoalMarkets";
import { formatSOL } from "@/lib/program";
import type { TxLineFixture } from "@/lib/txline/mock";
import { PollStatus, WINNING_OPTION_UNSET, type DemoPoll } from "@/lib/types";

type FixturesResponse = {
  mockMode?: boolean;
  source?: "txline" | "mock";
  fixtures?: TxLineFixture[];
  error?: string;
};

type TxLineUiState = "loading" | "connected" | "mock" | "not_configured" | "error";

type MarketsResponse = {
  markets: LiveGoalMarketMetadata[];
};

type MarketTab = "rules" | "activity" | "positions" | "holders" | "comments";

const UNIT_PRICE_LAMPORTS = 1_000_000;
const YES_INDEX = 1;
const NO_INDEX = 0;

const marketTabs: Array<{ id: MarketTab; label: string; icon: typeof ShieldCheck }> = [
  { id: "rules", label: "Rules", icon: ShieldCheck },
  { id: "activity", label: "Activity", icon: Activity },
  { id: "positions", label: "Positions", icon: Trophy },
  { id: "holders", label: "Top Holders", icon: Users },
  { id: "comments", label: "Comments", icon: MessageSquare },
];

export default function LiveGoalMarketsPage() {
  const {
    walletConnected,
    walletAddress,
    connectWallet,
    polls,
    votes,
    createPoll,
    castVote,
    settlePoll,
    claimReward,
  } = useApp();

  const [fixtures, setFixtures] = useState<TxLineFixture[]>([]);
  const [txlineState, setTxlineState] = useState<TxLineUiState>("loading");
  const mockMode = txlineState === "mock";
  const [markets, setMarkets] = useState<LiveGoalMarketMetadata[]>([]);
  const [selectedWindow, setSelectedWindow] = useState<LiveGoalWindowMinutes>(5);
  const [selectedPosition, setSelectedPosition] = useState<LiveGoalOutcome>("YES");
  const [stakeCoins, setStakeCoins] = useState(10);
  const [busyiey, setBusyiey] = useState<string | null>(null);
  const [nowSeconds, setNowSeconds] = useState(() => Math.floor(Date.now() / 1000));
  const [claimTxByMarket, setClaimTxByMarket] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<MarketTab>("rules");

  const fixture = fixtures[0];
  const admin = isAdminWallet(walletAddress);

  const refresh = useCallback(async () => {
    const [fixturesHttp, marketsRes] = await Promise.all([
      fetch("/api/txline/fixtures"),
      fetch("/api/markets/create-live-goal").then(res => res.json() as Promise<MarketsResponse>),
    ]);
    const fixturesRes = await fixturesHttp.json() as FixturesResponse;
    if (fixturesHttp.ok && fixturesRes.fixtures) {
      setFixtures(fixturesRes.fixtures);
      setTxlineState(fixturesRes.source === "mock" ? "mock" : "connected");
    } else {
      setFixtures([]);
      setTxlineState(fixturesRes.error === "txline_not_configured" ? "not_configured" : "error");
    }
    setMarkets(marketsRes.markets);
  }, []);

  useEffect(() => {
    refresh().catch(err => console.warn("[LiveGoalMarkets] refresh failed:", err));
  }, [refresh]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setNowSeconds(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const marketsByWindow = useMemo(() => {
    const map = new Map<LiveGoalWindowMinutes, LiveGoalMarketMetadata>();
    for (const market of markets) {
      if (!map.has(market.windowMinutes)) map.set(market.windowMinutes, market);
    }
    return map;
  }, [markets]);

  const marketPolls = useMemo(() => {
    return new Map(polls.map(poll => [poll.id, poll]));
  }, [polls]);

  const selectedMarket = marketsByWindow.get(selectedWindow);
  const selectedPoll = selectedMarket ? marketPolls.get(selectedMarket.onchainMarketPubkey) : undefined;
  const selectedStatus = selectedMarket ? getLiveGoalMarketStatus(nowSeconds, selectedMarket) : "OPEN";
  const selectedVote = selectedMarket
    ? votes.find(vote => vote.pollId === selectedMarket.onchainMarketPubkey && vote.voter === walletAddress)
    : undefined;
  const selectedOutcomeIndex = selectedPosition === "YES" ? YES_INDEX : NO_INDEX;
  const selectedUserWon = selectedPoll && selectedVote && selectedPoll.status === PollStatus.Settled && selectedPoll.winningOption !== WINNING_OPTION_UNSET
    ? (selectedVote.votesPerOption[selectedPoll.winningOption] || 0) > 0
    : false;

  const dataAvailable = txlineState === "connected" || txlineState === "mock";

  const createLiveMarket = async (windowMinutes: LiveGoalWindowMinutes) => {
    if (!fixture || !dataAvailable) return;
    if (!walletConnected || !walletAddress) {
      await connectWallet();
      return;
    }

    const lockiey = `create-${windowMinutes}`;
    setBusyiey(lockiey);
    try {
      const pollId = Date.now() + windowMinutes;
      const endTime = Math.floor(Date.now() / 1000) + 60;
      const market = await createPoll({
        pollId,
        creator: walletAddress,
        title: buildLiveGoalMarketTitle(fixture.homeTeam, fixture.awayTeam, windowMinutes).slice(0, 64),
        description: `LIVE_GOAL_WINDOW ${windowMinutes}m. Markets resolve from TxLINE score data, not majority vote.`,
        category: "World Cup",
        imageUrl: "",
        optionImages: [],
        options: ["NO", "YES"],
        voteCounts: [0, 0],
        unitPriceLamports: UNIT_PRICE_LAMPORTS,
        endTime,
        totalPoolLamports: 0,
        creatorInvestmentLamports: 500_000_000,
        platformFeeLamports: 500_000_000,
        creatorRewardLamports: 0,
        status: PollStatus.Active,
        winningOption: WINNING_OPTION_UNSET,
        totalVoters: 0,
        createdAt: Math.floor(Date.now() / 1000),
        marketKind: 1,
      });

      if (!market) return;

      const res = await fetch("/api/markets/create-live-goal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fixtureId: fixture.fixtureId,
          windowMinutes,
          onchainMarketPubkey: market.id,
          onchainPollId: pollId,
        }),
      });
      if (!res.ok) throw new Error("Failed to store live goal metadata");
      await refresh();
    } finally {
      setBusyiey(null);
    }
  };

  const buyPosition = async (market: LiveGoalMarketMetadata, outcomeIndex: 0 | 1) => {
    if (!walletConnected || !walletAddress) {
      await connectWallet();
      return;
    }
    const status = getLiveGoalMarketStatus(nowSeconds, market);
    if (status !== "OPEN") return;

    setBusyiey(`buy-${market.id}-${outcomeIndex}`);
    try {
      await castVote(market.onchainMarketPubkey, outcomeIndex, stakeCoins);
      await refresh();
    } finally {
      setBusyiey(null);
    }
  };

  const simulateScenario = async (scenario: "BASE" | "YES_GOAL" | "NO_GOAL") => {
    setBusyiey(`scenario-${scenario}`);
    try {
      await fetch("/api/txline/demo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenario }),
      });
      await refresh();
    } finally {
      setBusyiey(null);
    }
  };

  const resolveMarket = async (market: LiveGoalMarketMetadata) => {
    if (!dataAvailable) return;
    setBusyiey(`resolve-${market.id}`);
    try {
      const res = await fetch("/api/markets/resolve-live-goal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ marketId: market.id, forceDemo: mockMode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "resolve_failed");

      if (admin && data.resolution?.winningOptionIndex !== undefined) {
        const settlementTx = await settlePoll(market.onchainMarketPubkey, data.resolution.winningOptionIndex);
        if (settlementTx) {
          await fetch("/api/markets/resolve-live-goal", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              marketId: market.id,
              forceDemo: mockMode,
              settlementTx,
            }),
          });
        }
      }
      await refresh();
    } finally {
      setBusyiey(null);
    }
  };

  const claimPayout = async (market: LiveGoalMarketMetadata) => {
    setBusyiey(`claim-${market.id}`);
    try {
      const result = await claimReward(market.onchainMarketPubkey);
      if (result.txSignature) {
        setClaimTxByMarket(prev => ({ ...prev, [market.id]: result.txSignature! }));
      }
    } finally {
      setBusyiey(null);
    }
  };

  return (
    <div className="min-h-screen pb-36 text-neutral-100 lg:pb-8">
      <HeroHeader txlineState={txlineState} />

      <div className="mt-5 grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)_320px]">
        <aside className="hidden space-y-3 lg:block">
          <LiveMatchesPanel
            fixture={fixture}
            selectedWindow={selectedWindow}
            marketsByWindow={marketsByWindow}
            onSelect={setSelectedWindow}
          />
          {mockMode && <DemoControls busyiey={busyiey} onScenario={simulateScenario} />}
        </aside>

        <main className="min-w-0 space-y-4">
          <div className="lg:hidden">
            <MobileTradeDrawer
              market={selectedMarket}
              poll={selectedPoll}
              vote={selectedVote}
              status={selectedStatus}
              stakeCoins={stakeCoins}
              setStakeCoins={setStakeCoins}
              selectedPosition={selectedPosition}
              setSelectedPosition={setSelectedPosition}
              busy={busyiey !== null}
              walletConnected={walletConnected}
              isCreator={selectedPoll?.creator === walletAddress}
              userhon={Boolean(selectedUserWon)}
              claimTx={selectedMarket ? claimTxByMarket[selectedMarket.id] : undefined}
              onCreate={() => createLiveMarket(selectedWindow)}
              onBuy={() => selectedMarket && buyPosition(selectedMarket, selectedOutcomeIndex)}
              onResolve={() => selectedMarket && resolveMarket(selectedMarket)}
              onClaim={() => selectedMarket && claimPayout(selectedMarket)}
              admin={admin}
              windowMinutes={selectedWindow}
            />
            <div className="mt-4"><DataHealthWidget connected={!mockMode} compact /></div>
          </div>
          <ScoreboardCard fixture={fixture} />
          <WindowSelector
            selectedWindow={selectedWindow}
            fixture={fixture}
            market={selectedMarket}
            onSelect={setSelectedWindow}
          />
          <MarketCard
            fixture={fixture}
            market={selectedMarket}
            poll={selectedPoll}
            status={selectedStatus}
            nowSeconds={nowSeconds}
            selectedWindow={selectedWindow}
            claimTx={selectedMarket ? claimTxByMarket[selectedMarket.id] : undefined}
            onCreate={() => createLiveMarket(selectedWindow)}
            busy={busyiey !== null}
          />
          <TimelineCard
            fixture={fixture}
            market={selectedMarket}
            status={selectedStatus}
            nowSeconds={nowSeconds}
          />
          {selectedMarket && selectedPoll && (
            <LiveMarketGraph
              marketId={selectedMarket.id}
              yesCount={selectedPoll.voteCounts[YES_INDEX] ?? 0}
              noCount={selectedPoll.voteCounts[NO_INDEX] ?? 0}
              title={selectedPoll.title}
            />
          )}
          <InfoTabs
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            fixture={fixture}
            market={selectedMarket}
            poll={selectedPoll}
            status={selectedStatus}
            vote={selectedVote}
            claimTx={selectedMarket ? claimTxByMarket[selectedMarket.id] : undefined}
            mockMode={mockMode}
          />
          <SettlementProof
            market={`Goal in Next ${selectedWindow}m`}
            window={formatWindowRange(fixture, selectedMarket, selectedWindow)}
            startScore={selectedMarket ? `${selectedMarket.startHomeScore}-${selectedMarket.startAwayScore}` : "1-1"}
            endScore={fixture ? `${fixture.homeScore}-${fixture.awayScore}` : "2-1"}
            outcome={selectedMarket?.winningOutcome ?? "YES"}
            settlementTx={selectedMarket?.settlementTx}
            claimTx={selectedMarket ? claimTxByMarket[selectedMarket.id] : undefined}
            demo={mockMode}
          />
        </main>

        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <TradePanel
              market={selectedMarket}
              poll={selectedPoll}
              vote={selectedVote}
              status={selectedStatus}
              stakeCoins={stakeCoins}
              setStakeCoins={setStakeCoins}
              selectedPosition={selectedPosition}
              setSelectedPosition={setSelectedPosition}
              busy={busyiey !== null}
              walletConnected={walletConnected}
              isCreator={selectedPoll?.creator === walletAddress}
              userhon={Boolean(selectedUserWon)}
              claimTx={selectedMarket ? claimTxByMarket[selectedMarket.id] : undefined}
              onCreate={() => createLiveMarket(selectedWindow)}
              onBuy={() => selectedMarket && buyPosition(selectedMarket, selectedOutcomeIndex)}
              onResolve={() => selectedMarket && resolveMarket(selectedMarket)}
              onClaim={() => selectedMarket && claimPayout(selectedMarket)}
              admin={admin}
              windowMinutes={selectedWindow}
            />
            <div className="mt-4"><DataHealthWidget connected={!mockMode} compact /></div>
          </div>
        </aside>
      </div>

      <div className="lg:hidden">
        {mockMode && <DemoControlsCompact busyiey={busyiey} onScenario={simulateScenario} />}
      </div>
    </div>
  );
}

function HeroHeader({ txlineState }: { txlineState: TxLineUiState }) {
  const stateBadge = txlineState === "connected"
    ? { label: "TXLINE CONNECTED", className: "border-[#20d38a]/40 bg-[#20d38a]/10 text-[#20d38a]" }
    : txlineState === "mock"
      ? { label: "MOCK TxLINE", className: "border-[#e6ff3e]/30 bg-[#e6ff3e]/[0.08] text-[#d8ec52]" }
      : txlineState === "loading"
        ? { label: "CHECKING TxLINE…", className: "border-[#3b3b43] bg-white/[0.04] text-[#a1a1aa]" }
        : txlineState === "error"
          ? { label: "TXLINE ERROR", className: "border-[#fa4669]/40 bg-[#fa4669]/10 text-[#f78ba0]" }
          : { label: "TXLINE NOT CONFIGURED", className: "border-[#fa4669]/40 bg-[#fa4669]/10 text-[#f78ba0]" };
  return (
    <header className="rounded-lg border border-[#29292f] bg-[#19191d] p-4 shadow-2xl shadow-black/20 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <Badge className="border-[#fa4669]/40 bg-[#fa4669]/10 text-[#f78ba0]"><Flame size={13} /> LIVE</Badge>
            <Badge className="border-violet-500/40 bg-violet-500/10 text-violet-300">DEVNET</Badge>
            <Badge className={stateBadge.className}>{stateBadge.label}</Badge>
          </div>
          <h1 className="mt-4 font-heading text-3xl font-bold text-white sm:text-4xl">
            iickTick Live Markets
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-[#c9c9ce]">
            Trade every football moment before the clock runs out. Devnet SOL only. Markets resolve from score data, not majority vote.
          </p>
        </div>
        <div className="rounded-lg border border-[#20d38a]/25 bg-[#20d38a]/10 p-3 text-sm text-[#b9f0d6]">
          <div className="flex items-center gap-2 font-semibold">
            <ShieldCheck size={16} />
            Resolution source
          </div>
          <p className="mt-1 text-xs text-[#7ce8bb]/80">
            {txlineState === "connected" ? "Resolved by TxLINE score data." : txlineState === "mock" ? "Mock Mode — resolved from labeled mock scores." : "Settlement disabled until TxLINE is configured."}
          </p>
        </div>
      </div>
      {txlineState === "mock" && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-[#e6ff3e]/25 bg-[#e6ff3e]/[0.06] p-3 text-sm text-[#e4e8c9]">
          <AlertTriangle className="mt-0.5 shrink-0" size={16} />
          <span>Mock Mode Enabled — not real TxLINE data. Markets resolve from labeled mock scores.</span>
        </div>
      )}
      {(txlineState === "not_configured" || txlineState === "error") && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-[#fa4669]/25 bg-[#fa4669]/[0.06] p-3 text-sm text-[#f8c0cb]">
          <AlertTriangle className="mt-0.5 shrink-0" size={16} />
          <span>
            {txlineState === "not_configured"
              ? "TxLINE Not Configured — market creation and settlement are disabled. Set TXLINE_BASE_URL, TXLINE_GUEST_JWT, and TXLINE_API_TOKEN, or explicitly enable mock mode."
              : "TxLINE Error — live data request failed. Settlement is disabled until TxLINE responds."}
          </span>
        </div>
      )}
    </header>
  );
}

function LiveMatchesPanel({
  fixture,
  selectedWindow,
  marketsByWindow,
  onSelect,
}: {
  fixture?: TxLineFixture;
  selectedWindow: LiveGoalWindowMinutes;
  marketsByWindow: Map<LiveGoalWindowMinutes, LiveGoalMarketMetadata>;
  onSelect: (window: LiveGoalWindowMinutes) => void;
}) {
  return (
    <section className="rounded-lg border border-[#29292f] bg-[#141418] p-3">
      <div className="mb-3 text-sm font-semibold text-[#e6e6e9]">Live matches</div>
      <div className="rounded-lg bg-[#111114]/80 p-3">
        <div className="text-xs text-[#a1a1aa]">{fixture?.competition ?? "World Cup Demo Match"}</div>
        <div className="mt-1 text-sm font-semibold text-white">
          {fixture ? `${fixture.homeTeam} vs ${fixture.awayTeam}` : "Loading match"}
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-[#c9c9ce]">
          <span>{fixture ? formatMatchClock(fixture.clockSeconds) : "--:--"} LIVE</span>
          <span>{fixture ? `${fixture.homeScore} - ${fixture.awayScore}` : "- -"}</span>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {LIVE_GOAL_WINDOWS.map(windowMinutes => {
          const active = selectedWindow === windowMinutes;
          const market = marketsByWindow.get(windowMinutes);
          return (
            <button
              key={windowMinutes}
              onClick={() => onSelect(windowMinutes)}
              className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${
                active
                  ? "border-brand-500/60 bg-brand-500/10 text-brand-100"
                  : "border-[#29292f] bg-[#111114]/40 text-[#c9c9ce] hover:border-[#3b3b43]"
              }`}
            >
              <span>{windowMinutes}m window</span>
              <span className="text-xs">{market ? market.status : "Not open"}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function DemoControls({
  busyiey,
  onScenario,
}: {
  busyiey: string | null;
  onScenario: (scenario: "BASE" | "YES_GOAL" | "NO_GOAL") => void;
}) {
  return (
    <section className="rounded-lg border border-[#29292f] bg-[#141418] p-3">
      <div className="flex items-center justify-between text-sm font-semibold text-[#e6e6e9]">
        Demo controls
        <Gauge size={15} className="text-[#20d38a]" />
      </div>
      <div className="mt-3 space-y-2">
        <ScenarioButton disabled={busyiey !== null} onClick={() => onScenario("BASE")}>Start demo match</ScenarioButton>
        <ScenarioButton disabled={busyiey !== null} tone="yes" onClick={() => onScenario("YES_GOAL")}>Simulate goal: YES wins</ScenarioButton>
        <ScenarioButton disabled={busyiey !== null} tone="no" onClick={() => onScenario("NO_GOAL")}>Simulate no goal: NO wins</ScenarioButton>
      </div>
      <p className="mt-3 text-xs leading-5 text-[#6f6f78]">Demo controls use simulated score data and do not replace on-chain settlement.</p>
    </section>
  );
}

function DemoControlsCompact({
  busyiey,
  onScenario,
}: {
  busyiey: string | null;
  onScenario: (scenario: "BASE" | "YES_GOAL" | "NO_GOAL") => void;
}) {
  return (
    <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
      <ScenarioButton disabled={busyiey !== null} onClick={() => onScenario("BASE")}>Start</ScenarioButton>
      <ScenarioButton disabled={busyiey !== null} tone="yes" onClick={() => onScenario("YES_GOAL")}>YES win</ScenarioButton>
      <ScenarioButton disabled={busyiey !== null} tone="no" onClick={() => onScenario("NO_GOAL")}>NO win</ScenarioButton>
    </div>
  );
}

function ScoreboardCard({ fixture }: { fixture?: TxLineFixture }) {
  const homeCode = fixture?.homeTeam.slice(0, 3).toUpperCase() ?? "ARG";
  const awayCode = fixture?.awayTeam.slice(0, 3).toUpperCase() ?? "BRA";
  return (
    <section className="rounded-lg border border-[#29292f] bg-[#141418] p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-[#f78ba0]">
            <span className="h-2 w-2 rounded-full bg-[#fa4669]" />
            {fixture ? `${formatMatchClock(fixture.clockSeconds)} LIVE` : "63:20 LIVE"}
          </div>
          <h2 className="mt-2 font-heading text-2xl font-bold text-white sm:text-3xl">
            {fixture ? `${fixture.homeTeam} vs ${fixture.awayTeam}` : "Argentina vs Brazil"}
          </h2>
          <p className="mt-1 text-sm text-[#a1a1aa]">{fixture?.competition ?? "World Cup Demo Match"}</p>
        </div>
        <div className="rounded-lg border border-[#3b3b43] bg-[#111114]/70 px-5 py-4 text-center">
          <div className="text-xs text-[#6f6f78]">World Cup Demo Match</div>
          <div className="mt-2 flex items-center justify-center gap-3">
            <span className="text-sm font-semibold text-[#c9c9ce]">{homeCode}</span>
            <span className="font-heading text-4xl font-bold text-white">
              {fixture ? `${fixture.homeScore} - ${fixture.awayScore}` : "1 - 1"}
            </span>
            <span className="text-sm font-semibold text-[#c9c9ce]">{awayCode}</span>
          </div>
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[#20d38a]/30 bg-[#20d38a]/10 px-2 py-1 text-xs text-[#7ce8bb]">
            <BarChart3 size={13} />
            Resolved by TxLINE-compatible score data
          </div>
        </div>
      </div>
    </section>
  );
}

function WindowSelector({
  selectedWindow,
  fixture,
  market,
  onSelect,
}: {
  selectedWindow: LiveGoalWindowMinutes;
  fixture?: TxLineFixture;
  market?: LiveGoalMarketMetadata;
  onSelect: (window: LiveGoalWindowMinutes) => void;
}) {
  return (
    <section className="rounded-lg border border-[#29292f] bg-[#141418] p-3">
      <div className="grid grid-cols-3 gap-2">
        {LIVE_GOAL_WINDOWS.map(windowMinutes => (
          <button
            key={windowMinutes}
            onClick={() => onSelect(windowMinutes)}
            className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
              selectedWindow === windowMinutes
                ? "border-brand-400 bg-brand-500 text-[#0a0a0c]"
                : "border-[#3b3b43] bg-[#111114]/40 text-[#c9c9ce] hover:border-[#55555e]"
            }`}
          >
            {windowMinutes} min
          </button>
        ))}
      </div>
      <div className="mt-3 text-sm text-[#a1a1aa]">
        Window: <span className="text-[#f4f4f5]">{formatWindowRange(fixture, market, selectedWindow)}</span>
      </div>
    </section>
  );
}

function MarketCard({
  fixture,
  market,
  poll,
  status,
  nowSeconds,
  selectedWindow,
  claimTx,
  onCreate,
  busy,
}: {
  fixture?: TxLineFixture;
  market?: LiveGoalMarketMetadata;
  poll?: DemoPoll;
  status: LiveGoalStatus;
  nowSeconds: number;
  selectedWindow: LiveGoalWindowMinutes;
  claimTx?: string;
  onCreate: () => void;
  busy: boolean;
}) {
  const yesPool = getPoolLamports(poll, YES_INDEX);
  const noPool = getPoolLamports(poll, NO_INDEX);
  const yesProb = poll ? impliedProbability(poll.voteCounts) : 50;
  const noProb = 100 - yesProb;
  const lockRemaining = market ? formatDuration(Math.max(0, market.lockTs - nowSeconds)) : "--";
  const isResolved = status === "RESOLVED" || status === "CLAIMABLE";
  const title = selectedWindow === 45 ? "Goal Before Half/Full Time?" : `Goal in Next ${selectedWindow}m?`;
  const prompt = selectedWindow === 45
    ? "hill either team score before the end of this half?"
    : `hill either team score before ${formatWindowEndMinute(fixture, market, selectedWindow)}?`;

  return (
    <section className="rounded-lg border border-[#29292f] bg-[#141418] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-sm text-[#20d38a]">Live football window</div>
          <h2 className="mt-1 font-heading text-3xl font-bold text-white">{title}</h2>
          <p className="mt-1 text-sm text-[#a1a1aa]">{prompt}</p>
        </div>
        <StatusPill status={market ? status : "CANCELLED"} label={market ? status : "Not created"} />
      </div>

      {market ? (
        <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_280px]">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Metric label="Start score" value={`${market.startHomeScore}-${market.startAwayScore}`} />
              <Metric label="Current score" value={fixture ? `${fixture.homeScore}-${fixture.awayScore}` : "--"} />
              <Metric label="Window end" value={formatTimeOfDay(market.windowEndTs)} />
              <Metric label="Market status" value={status} tone={status === "LOCKED" ? "amber" : undefined} />
              <Metric label="Lock countdown" value={status === "OPEN" ? lockRemaining : status === "LOCKED" ? "Locked" : "Closed"} />
            </div>

            <div className="rounded-lg border border-[#29292f] bg-[#111114]/40 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">Pool Book</div>
                  <div className="mt-1 text-xs text-[#6f6f78]">Pool-based liquidity, not an order book.</div>
                </div>
                <div className="text-right text-xs text-[#a1a1aa]">
                  <div>YES {yesProb}%</div>
                  <div>NO {noProb}%</div>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <PoolSide label="YES pool" value={formatSOL(yesPool)} tone="yes" />
                <PoolSide label="NO pool" value={formatSOL(noPool)} tone="no" />
              </div>
              <div className="mt-4">
                <div className="mb-2 flex justify-between text-xs text-[#a1a1aa]">
                  <span>YES</span>
                  <span>Implied probability</span>
                  <span>NO</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-[#fa4669]/50">
                  <div className="h-full bg-[#20d38a]" style={{ width: `${yesProb}%` }} />
                </div>
              </div>
            </div>

            {isResolved && (
              <div className="rounded-lg border border-brand-500/30 bg-brand-500/10 p-3 text-sm text-brand-100">
                <div className="font-semibold">Resolved: {market.winningOutcome} won</div>
                {market.settlementTx && <TxLink label="Settlement tx" signature={market.settlementTx} />}
                {claimTx && <TxLink label="Claim tx" signature={claimTx} />}
              </div>
            )}
          </div>
          <div className="rounded-lg border border-[#29292f] bg-[#111114]/40 p-4">
            <div className="text-sm font-semibold text-white">Resolution source</div>
            <p className="mt-2 text-sm leading-6 text-[#a1a1aa]">
              The start score is recorded when the market opens. The end score is recorded when the window ends.
              Resolution uses TxLINE-compatible score data.
            </p>
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[#20d38a]/30 bg-[#20d38a]/10 px-3 py-1 text-xs text-[#7ce8bb]">
              <BarChart3 size={13} />
              {market.resolutionSource === "MOCK" ? "Demo TxLINE-compatible data" : market.resolutionSource}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-lg border border-[#29292f] bg-[#111114]/40 p-4">
          <p className="text-sm text-[#a1a1aa]">
            Open this short-window market on-chain, then buy YES or NO positions from the trade panel.
          </p>
          <button
            onClick={onCreate}
            disabled={busy || !fixture}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-3 text-sm font-bold text-[#0a0a0c] transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Zap size={16} />
            Create {selectedWindow} min market
          </button>
        </div>
      )}
    </section>
  );
}

function TimelineCard({
  fixture,
  market,
  status,
  nowSeconds,
}: {
  fixture?: TxLineFixture;
  market?: LiveGoalMarketMetadata;
  status: LiveGoalStatus;
  nowSeconds: number;
}) {
  const progress = market
    ? clamp(((Math.min(nowSeconds, market.windowEndTs) - market.windowStartTs) / Math.max(1, market.windowEndTs - market.windowStartTs)) * 100, 0, 100)
    : 0;
  const remaining = market ? formatDuration(Math.max(0, market.windowEndTs - nowSeconds)) : "--";
  const hasGoal = Boolean(market && fixture && fixture.homeScore + fixture.awayScore > market.startHomeScore + market.startAwayScore);

  return (
    <section className="rounded-lg border border-[#29292f] bg-[#141418] p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Goal-window timeline</h3>
        <span className="text-xs text-[#a1a1aa]">Window progress</span>
      </div>
      <div className="mt-4">
        <div className="mb-2 flex justify-between text-sm text-[#a1a1aa]">
          <span>{market ? market.matchClockAtStart : "63:00"}</span>
          <span>{market ? formatWindowClock(market, fixture) : "68:00"}</span>
        </div>
        <div className="relative h-3 rounded-full bg-[#232328]">
          <div className="h-full rounded-full bg-[#20d38a]" style={{ width: `${progress}%` }} />
          {hasGoal && <div className="absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border-2 border-[#0c0c0f] bg-[#20d38a]" style={{ left: "52%" }} />}
        </div>
        <div className="mt-3 grid gap-2 text-sm text-[#a1a1aa] sm:grid-cols-3">
          <span>Start score: {market ? `${market.startHomeScore}-${market.startAwayScore}` : "1-1"}</span>
          <span>Current score: {fixture ? `${fixture.homeScore}-${fixture.awayScore}` : "1-1"}</span>
          <span>{status === "RESOLVING" || status === "RESOLVED" ? "Window ended" : `${remaining} remaining`}</span>
        </div>
        <div className="mt-4 rounded-lg border border-[#29292f] bg-[#111114]/40 p-3 text-sm text-[#c9c9ce]">
          {hasGoal ? "Goal event: 65:30 Brazil goal" : "No goal in this window"}
        </div>
      </div>
    </section>
  );
}

function InfoTabs({
  activeTab,
  setActiveTab,
  fixture,
  market,
  poll,
  status,
  vote,
  claimTx,
  mockMode,
}: {
  activeTab: MarketTab;
  setActiveTab: (tab: MarketTab) => void;
  fixture?: TxLineFixture;
  market?: LiveGoalMarketMetadata;
  poll?: DemoPoll;
  status: LiveGoalStatus;
  vote?: { votesPerOption: number[]; totalStakedLamports: number; claimed: boolean };
  claimTx?: string;
  mockMode: boolean;
}) {
  return (
    <section className="rounded-lg border border-[#29292f] bg-[#141418]">
      <div className="flex overflow-x-auto border-b border-[#29292f] p-2">
        {marketTabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`mr-2 inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${
                activeTab === tab.id ? "bg-[#f4f4f5] text-[#0a0a0c]" : "text-[#a1a1aa] hover:bg-[#19191d] hover:text-[#f4f4f5]"
              }`}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="p-4">
        {activeTab === "rules" && <RulesPanel />}
        {activeTab === "activity" && <ActivityPanel market={market} fixture={fixture} claimTx={claimTx} mockMode={mockMode} />}
        {activeTab === "positions" && <PositionsPanel market={market} poll={poll} vote={vote} status={status} />}
        {activeTab === "holders" && <HoldersPanel poll={poll} mockMode={mockMode} />}
        {activeTab === "comments" && <CommentsPanel market={market} />}
      </div>
    </section>
  );
}

function TradePanel({
  market,
  poll,
  vote,
  status,
  stakeCoins,
  setStakeCoins,
  selectedPosition,
  setSelectedPosition,
  busy,
  walletConnected,
  isCreator,
  userhon,
  claimTx,
  onCreate,
  onBuy,
  onResolve,
  onClaim,
  admin,
  windowMinutes,
}: TradePanelProps) {
  const outcomeIndex = selectedPosition === "YES" ? YES_INDEX : NO_INDEX;
  const estimatedPayout = estimatePayout(poll, outcomeIndex, stakeCoins);
  const hasClaimable = Boolean(userhon && !vote?.claimed);
  const locked = status === "LOCKED" || status === "RESOLVING";
  const resolved = status === "RESOLVED" || status === "CLAIMABLE";

  return (
    <section className="rounded-lg border border-[#29292f] bg-[#141418] p-4 shadow-2xl shadow-black/30">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Buy Position</h3>
        {market && <StatusPill status={status} />}
      </div>

      {market ? (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(["YES", "NO"] as const).map(position => (
              <button
                key={position}
                onClick={() => setSelectedPosition(position)}
                className={`rounded-lg border px-4 py-3 text-sm font-bold ${
                  selectedPosition === position
                    ? position === "YES"
                      ? "border-[#20d38a] bg-[#20d38a] text-[#0a0a0c]"
                      : "border-[#fa4669] bg-[#fa4669] text-[#0a0a0c]"
                    : "border-[#3b3b43] bg-[#111114]/50 text-[#c9c9ce]"
                }`}
              >
                {position}
              </button>
            ))}
          </div>

          <label className="block text-sm text-[#c9c9ce]">
            Stake
            <input
              type="number"
              min={1}
              max={100}
              value={stakeCoins}
              onChange={event => setStakeCoins(Math.max(1, Math.min(100, Number(event.target.value) || 1)))}
              className="mt-2 w-full rounded-lg border border-[#3b3b43] bg-[#111114] px-3 py-3 text-right text-white outline-none focus:border-brand-400"
            />
          </label>

          <div className="rounded-lg border border-[#29292f] bg-[#111114]/50 p-3 text-sm">
            <Row label="Position" value={selectedPosition} />
            <Row label="Stake" value={formatSOL(stakeCoins * UNIT_PRICE_LAMPORTS)} />
            <Row label="Estimated payout" value={formatSOL(estimatedPayout)} strong />
          </div>

          {locked && (
            <div className="rounded-lg border border-[#e6ff3e]/25 bg-[#e6ff3e]/[0.06] p-3 text-sm text-[#e4e8c9]">
              <div className="flex items-center gap-2 font-semibold"><Lock size={15} /> Market locked</div>
              <div className="mt-1 text-xs">haiting for result...</div>
            </div>
          )}

          {resolved && (
            <div className="rounded-lg border border-brand-500/30 bg-brand-500/10 p-3 text-sm text-brand-100">
              Resolved: {market.winningOutcome} won
              {market.settlementTx && <TxLink label="Settlement tx" signature={market.settlementTx} />}
              {claimTx && <TxLink label="Claim tx" signature={claimTx} />}
            </div>
          )}

          <button
            onClick={onBuy}
            disabled={!walletConnected || status !== "OPEN" || busy || isCreator}
            className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-45 ${
              selectedPosition === "YES" ? "bg-[#20d38a] text-[#0a0a0c] hover:bg-[#3ee0a4]" : "bg-[#fa4669] text-[#0a0a0c] hover:bg-[#fb6d88]"
            }`}
          >
            Buy {selectedPosition}
          </button>

          {isCreator && <p className="text-xs text-[#d8ec52]">Creators cannot buy positions in their own market. Use a participant wallet.</p>}
          {!walletConnected && <p className="text-xs text-[#6f6f78]">Connect wallet to buy a position.</p>}

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onResolve}
              disabled={busy || !admin}
              className="rounded-lg border border-[#20d38a]/40 bg-[#20d38a]/10 px-3 py-2 text-sm font-semibold text-[#7ce8bb] disabled:cursor-not-allowed disabled:opacity-45"
            >
              Resolve
            </button>
            <button
              onClick={onClaim}
              disabled={busy || !hasClaimable}
              className="rounded-lg border border-brand-500/40 bg-brand-500/10 px-3 py-2 text-sm font-semibold text-brand-100 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Claim payout
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <p className="text-sm text-[#a1a1aa]">No {windowMinutes}m market is open yet.</p>
          <button
            onClick={onCreate}
            disabled={busy}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-3 text-sm font-bold text-[#0a0a0c] hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Zap size={16} />
            Create market
          </button>
        </div>
      )}
    </section>
  );
}

function MobileTradeDrawer(props: TradePanelProps) {
  const { market, status, selectedPosition, setSelectedPosition, stakeCoins, setStakeCoins, busy, onCreate, onBuy, onClaim, userhon, vote, windowMinutes } = props;
  const resolved = status === "RESOLVED" || status === "CLAIMABLE";
  return (
    <div className="sticky top-20 z-30 rounded-lg border border-[#29292f] bg-[#141418]/95 p-3 shadow-2xl shadow-black/30 backdrop-blur">
      {market ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs text-[#a1a1aa]">Buy Position</div>
              <div className="text-sm font-semibold text-white">{resolved ? `Resolved: ${market.winningOutcome} won` : `${windowMinutes}m goal market`}</div>
            </div>
            <StatusPill status={status} />
          </div>
          <div className="grid grid-cols-[1fr_1fr_86px] gap-2">
            {(["YES", "NO"] as const).map(position => (
              <button
                key={position}
                onClick={() => setSelectedPosition(position)}
                className={`rounded-lg px-3 py-3 text-sm font-bold ${
                  selectedPosition === position
                    ? position === "YES"
                      ? "bg-[#20d38a] text-[#0a0a0c]"
                      : "bg-[#fa4669] text-[#0a0a0c]"
                    : "border border-[#3b3b43] text-[#c9c9ce]"
                }`}
              >
                {position}
              </button>
            ))}
            <input
              aria-label="Stake"
              type="number"
              min={1}
              max={100}
              value={stakeCoins}
              onChange={event => setStakeCoins(Math.max(1, Math.min(100, Number(event.target.value) || 1)))}
              className="rounded-lg border border-[#3b3b43] bg-[#111114] px-2 text-right text-sm text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onBuy}
              disabled={status !== "OPEN" || busy}
              className={`rounded-lg px-4 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-45 ${
                selectedPosition === "YES" ? "bg-[#20d38a] text-[#0a0a0c]" : "bg-[#fa4669] text-[#0a0a0c]"
              }`}
            >
              Buy {selectedPosition}
            </button>
            <button
              onClick={onClaim}
              disabled={busy || !userhon || vote?.claimed}
              className="rounded-lg border border-brand-500/40 bg-brand-500/10 px-4 py-3 text-sm font-bold text-brand-100 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Claim payout
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={onCreate}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-3 text-sm font-bold text-[#0a0a0c] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Zap size={16} />
          Create {windowMinutes}m market
        </button>
      )}
    </div>
  );
}

function RulesPanel() {
  return (
    <div className="space-y-3 text-sm leading-6 text-[#c9c9ce]">
      <p>This market resolves to YES if either team scores at least one goal during the selected time window.</p>
      <p>It resolves to NO if the total score does not increase before the window ends.</p>
      <p>The start score is recorded when the market opens. The end score is recorded when the window ends. Resolution uses TxLINE-compatible score data.</p>
      <p className="font-semibold text-white">Markets resolve from score data, not majority vote.</p>
    </div>
  );
}

function ActivityPanel({
  market,
  fixture,
  claimTx,
  mockMode,
}: {
  market?: LiveGoalMarketMetadata;
  fixture?: TxLineFixture;
  claimTx?: string;
  mockMode: boolean;
}) {
  const hasGoal = Boolean(market && fixture && fixture.homeScore + fixture.awayScore > market.startHomeScore + market.startAwayScore);
  const events = [
    { time: market?.matchClockAtStart ?? "63:00", text: "Market opened", real: Boolean(market) },
    { time: "63:10", text: "User bought YES", demo: true },
    { time: "64:15", text: "User bought NO", demo: true },
    hasGoal ? { time: "65:30", text: "Goal detected", demo: mockMode } : { time: "65:30", text: "No goal detected", demo: mockMode },
    { time: market ? formatWindowClock(market, fixture) : "68:00", text: "Market window ended", demo: !market },
    market?.winningOutcome ? { time: "68:03", text: `Market resolved ${market.winningOutcome}`, real: Boolean(market.settlementTx) } : { time: "68:03", text: "Resolution pending", demo: true },
    claimTx ? { time: "68:12", text: "Payout claimed", real: true } : { time: "68:12", text: "Payout not claimed yet", demo: true },
  ];

  return (
    <div className="space-y-3">
      {events.map(event => (
        <div key={`${event.time}-${event.text}`} className="flex items-center justify-between gap-3 rounded-lg border border-[#29292f] bg-[#111114]/40 px-3 py-2 text-sm">
          <div className="flex min-w-0 items-center gap-3">
            <span className="w-12 shrink-0 text-[#6f6f78]">{event.time}</span>
            <span className="truncate text-[#e6e6e9]">{event.text}</span>
          </div>
          <span className={`shrink-0 text-xs ${event.real ? "text-brand-300" : "text-[#d8ec52]"}`}>{event.real ? "on-chain" : "demo"}</span>
        </div>
      ))}
    </div>
  );
}

function PositionsPanel({
  market,
  poll,
  vote,
  status,
}: {
  market?: LiveGoalMarketMetadata;
  poll?: DemoPoll;
  vote?: { votesPerOption: number[]; totalStakedLamports: number; claimed: boolean };
  status: LiveGoalStatus;
}) {
  const yesStake = (vote?.votesPerOption[YES_INDEX] ?? 0) * (poll?.unitPriceLamports ?? UNIT_PRICE_LAMPORTS);
  const noStake = (vote?.votesPerOption[NO_INDEX] ?? 0) * (poll?.unitPriceLamports ?? UNIT_PRICE_LAMPORTS);
  const position = yesStake >= noStake ? "YES" : "NO";
  const stake = yesStake + noStake;
  const isResolved = status === "RESOLVED" || status === "CLAIMABLE";
  const winning = market?.winningOutcome === position;
  const positionStatus = !vote ? "No position" : isResolved ? winning ? vote.claimed ? "Claimed" : "Claimable" : "Losing" : "Open";

  return (
    <div className="rounded-lg border border-[#29292f] bg-[#111114]/40 p-4">
      <div className="text-sm text-[#a1a1aa]">Your position</div>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <span className={`rounded-lg px-3 py-1 text-sm font-bold ${position === "YES" ? "bg-[#20d38a] text-[#0a0a0c]" : "bg-[#fa4669] text-[#0a0a0c]"}`}>
          {vote ? position : "--"}
        </span>
        <span className="text-sm text-[#c9c9ce]">Stake: {formatSOL(stake)}</span>
        <span className="text-sm text-[#c9c9ce]">Status: {positionStatus}</span>
        <span className="text-sm text-[#c9c9ce]">Estimated payout: {formatSOL(estimatePayout(poll, position === "YES" ? YES_INDEX : NO_INDEX, Math.max(1, (vote?.votesPerOption[position === "YES" ? YES_INDEX : NO_INDEX] ?? 0))))}</span>
      </div>
    </div>
  );
}

function HoldersPanel({ poll, mockMode }: { poll?: DemoPoll; mockMode: boolean }) {
  const yesCount = poll?.voteCounts[YES_INDEX] ?? 0;
  const noCount = poll?.voteCounts[NO_INDEX] ?? 0;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <HolderList title="Top YES holders" count={yesCount} mockMode={mockMode} />
      <HolderList title="Top NO holders" count={noCount} mockMode={mockMode} />
    </div>
  );
}

function CommentsPanel({ market }: { market?: LiveGoalMarketMetadata }) {
  if (!market) {
    return (
      <div className="rounded-lg border border-[#29292f] bg-[#111114]/40 p-4 text-sm text-[#c9c9ce]">
        <div className="font-semibold text-white">Comments</div>
        <p className="mt-2 text-[#a1a1aa]">Create this market first — comments attach to a specific market.</p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-[#29292f] bg-[#111114]/40 p-4">
      <PollComments pollId={market.onchainMarketPubkey} />
    </div>
  );
}

function HolderList({ title, count, mockMode }: { title: string; count: number; mockMode: boolean }) {
  return (
    <div className="rounded-lg border border-[#29292f] bg-[#111114]/40 p-4">
      <div className="font-semibold text-white">{title}</div>
      <div className="mt-3 space-y-2 text-sm text-[#c9c9ce]">
        <div className="flex justify-between"><span>Current pool</span><span>{count} positions</span></div>
        <div className="flex justify-between"><span>{mockMode ? "Demo holder A" : "Holder A"}</span><span>{Math.max(0, count - 1)} positions</span></div>
        <div className="flex justify-between"><span>{mockMode ? "Demo holder B" : "Holder B"}</span><span>{count > 0 ? 1 : 0} positions</span></div>
      </div>
      {mockMode && <p className="mt-3 text-xs text-[#d8ec52]">Demo placeholder: holder ranking is illustrative.</p>}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "amber" }) {
  return (
    <div className="rounded-lg border border-[#29292f] bg-[#111114]/40 p-3">
      <div className="text-xs text-[#6f6f78]">{label}</div>
      <div className={`mt-1 text-sm font-semibold ${tone === "amber" ? "text-[#d8ec52]" : "text-white"}`}>{value}</div>
    </div>
  );
}

function PoolSide({ label, value, tone }: { label: string; value: string; tone: "yes" | "no" }) {
  return (
    <div className={`rounded-lg border p-3 ${tone === "yes" ? "border-[#20d38a]/30 bg-[#20d38a]/10" : "border-[#fa4669]/30 bg-[#fa4669]/10"}`}>
      <div className={`text-xs ${tone === "yes" ? "text-[#7ce8bb]" : "text-[#f78ba0]"}`}>{label}</div>
      <div className="mt-1 text-lg font-bold text-white">{value}</div>
    </div>
  );
}

function StatusPill({ status, label }: { status: LiveGoalStatus; label?: string }) {
  const styles: Record<LiveGoalStatus, string> = {
    OPEN: "border-[#20d38a]/40 bg-[#20d38a]/10 text-[#7ce8bb]",
    LOCKED: "border-[#e6ff3e]/30 bg-[#e6ff3e]/[0.06] text-[#d8ec52]",
    RESOLVING: "border-[#20d38a]/40 bg-[#20d38a]/10 text-[#20d38a]",
    RESOLVED: "border-brand-500/40 bg-brand-500/10 text-brand-200",
    CLAIMABLE: "border-brand-500/40 bg-brand-500/10 text-brand-200",
    CANCELLED: "border-[#3b3b43] bg-[#19191d] text-[#c9c9ce]",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[status]}`}>
      {status === "LOCKED" ? <Lock size={12} /> : status === "RESOLVED" || status === "CLAIMABLE" ? <CheckCircle2 size={12} /> : null}
      {label ?? status}
    </span>
  );
}

function ScenarioButton({
  children,
  onClick,
  disabled,
  tone,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "yes" | "no";
}) {
  const toneClass = tone === "yes"
    ? "border-[#20d38a]/30 bg-[#20d38a]/10 text-[#7ce8bb]"
    : tone === "no"
      ? "border-[#fa4669]/30 bg-[#fa4669]/10 text-[#f78ba0]"
      : "border-[#3b3b43] bg-[#111114]/50 text-[#e6e6e9]";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-lg border px-3 py-2 text-left font-semibold transition hover:border-[#55555e] disabled:cursor-not-allowed disabled:opacity-45 ${toneClass}`}
    >
      {children}
    </button>
  );
}

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 ${className}`}>{children}</span>;
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[#a1a1aa]">{label}</span>
      <span className={strong ? "font-bold text-white" : "text-[#e6e6e9]"}>{value}</span>
    </div>
  );
}

function TxLink({ label, signature }: { label: string; signature: string }) {
  return (
    <a
      href={`https://explorer.solana.com/tx/${signature}?cluster=devnet`}
      target="_blank"
      rel="noreferrer"
      className="mt-2 flex items-center gap-1.5 text-xs text-[#7ce8bb] underline decoration-blue-300/40 underline-offset-4"
    >
      {label}: View on Solana Explorer
      <ExternalLink size={12} />
    </a>
  );
}

type TradePanelProps = {
  market?: LiveGoalMarketMetadata;
  poll?: DemoPoll;
  vote?: { votesPerOption: number[]; totalStakedLamports: number; claimed: boolean };
  status: LiveGoalStatus;
  stakeCoins: number;
  setStakeCoins: (value: number) => void;
  selectedPosition: LiveGoalOutcome;
  setSelectedPosition: (value: LiveGoalOutcome) => void;
  busy: boolean;
  walletConnected: boolean;
  isCreator?: boolean;
  userhon: boolean;
  claimTx?: string;
  onCreate: () => void;
  onBuy: () => void;
  onResolve: () => void;
  onClaim: () => void;
  admin: boolean;
  windowMinutes: LiveGoalWindowMinutes;
};

function getPoolLamports(poll: DemoPoll | undefined, outcomeIndex: 0 | 1): number {
  return poll ? (poll.voteCounts[outcomeIndex] || 0) * poll.unitPriceLamports : 0;
}

function estimatePayout(poll: DemoPoll | undefined, outcomeIndex: 0 | 1, stakeCoins: number): number {
  const unitPrice = poll?.unitPriceLamports ?? UNIT_PRICE_LAMPORTS;
  const yesPool = getPoolLamports(poll, YES_INDEX);
  const noPool = getPoolLamports(poll, NO_INDEX);
  const stake = stakeCoins * unitPrice;
  const selectedPool = outcomeIndex === YES_INDEX ? yesPool : noPool;
  const totalPool = yesPool + noPool + stake;
  const futureSelectedPool = selectedPool + stake;
  if (futureSelectedPool <= 0) return stake;
  return Math.floor((stake / futureSelectedPool) * totalPool);
}

function formatWindowRange(fixture: TxLineFixture | undefined, market: LiveGoalMarketMetadata | undefined, windowMinutes: LiveGoalWindowMinutes): string {
  if (market) {
    return `${market.matchClockAtStart} -> ${formatWindowClock(market, fixture)}`;
  }
  const startSeconds = fixture?.clockSeconds ?? 63 * 60;
  return `${formatMatchClock(startSeconds)} -> ${formatMatchClock(startSeconds + windowMinutes * 60)}`;
}

function formatWindowEndMinute(fixture: TxLineFixture | undefined, market: LiveGoalMarketMetadata | undefined, windowMinutes: LiveGoalWindowMinutes): string {
  if (market) return formatWindowClock(market, fixture);
  return formatMatchClock((fixture?.clockSeconds ?? 63 * 60) + windowMinutes * 60);
}

function formatWindowClock(market: LiveGoalMarketMetadata, fixture?: TxLineFixture): string {
  const startParts = market.matchClockAtStart.split(":").map(Number);
  const startSeconds = Number.isFinite(startParts[0]) ? startParts[0] * 60 + (startParts[1] || 0) : fixture?.clockSeconds ?? 63 * 60;
  return formatMatchClock(startSeconds + market.windowMinutes * 60);
}

function formatTimeOfDay(seconds: number): string {
  return new Date(seconds * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
