"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { CheckCircle2, ExternalLink, RefreshCw, Satellite, ShieldCheck } from "lucide-react";
import { useApp } from "@/components/Providers";
import DataHealthWidget from "@/components/kicktick/DataHealthWidget";
import type { LiveGoalMarketMetadata } from "@/lib/liveGoalMarkets";

type TxLineStatus = {
  status: string;
  connected: boolean;
  configured: boolean;
  mockModeEnabled: boolean;
  settlementEnabled: boolean;
  lastCheckedAt: string;
};

type Proposal = {
  endHomeScore: number;
  endAwayScore: number;
  resolvedOutcome: "YES" | "NO";
  winningOptionIndex: 0 | 1;
  source: "txline" | "mock";
};

export default function TxLineSettlementPanel() {
  const { settlePoll } = useApp();
  const [status, setStatus] = useState<TxLineStatus | null>(null);
  const [markets, setMarkets] = useState<LiveGoalMarketMetadata[]>([]);
  const [proposals, setProposals] = useState<Record<string, Proposal>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [statusRes, marketsRes] = await Promise.all([
      fetch("/api/txline/status").then(res => res.json()).catch(() => null),
      fetch("/api/markets/create-live-goal").then(res => res.json()).catch(() => ({ markets: [] })),
    ]);
    setStatus(statusRes);
    setMarkets(marketsRes.markets ?? []);
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 20_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const settlementEnabled = Boolean(status?.settlementEnabled);

  const proposeOutcome = async (market: LiveGoalMarketMetadata) => {
    setBusyId(`propose-${market.id}`);
    try {
      const res = await fetch("/api/markets/resolve-live-goal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ marketId: market.id, dryRun: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "proposal_failed");
      setProposals(prev => ({
        ...prev,
        [market.id]: {
          endHomeScore: data.score.homeScore,
          endAwayScore: data.score.awayScore,
          resolvedOutcome: data.resolution.resolvedOutcome,
          winningOptionIndex: data.resolution.winningOptionIndex,
          source: data.source,
        },
      }));
    } catch (error: any) {
      toast.error(String(error?.message || error));
    } finally {
      setBusyId(null);
    }
  };

  const settleOnChain = async (market: LiveGoalMarketMetadata) => {
    const proposal = proposals[market.id];
    if (!proposal || !settlementEnabled) return;
    setBusyId(`settle-${market.id}`);
    try {
      // Wallet-signed on-chain settlement first; only record after it confirms.
      const settlementTx = await settlePoll(market.onchainMarketPubkey, proposal.winningOptionIndex);
      if (!settlementTx) {
        toast.error("Settlement transaction was not confirmed — nothing recorded.");
        return;
      }
      const res = await fetch("/api/markets/resolve-live-goal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          marketId: market.id,
          settlementTx,
          forceDemo: Boolean(status?.mockModeEnabled),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "record_failed");
      toast.success(`Settled ${proposal.resolvedOutcome} — tx ${settlementTx.slice(0, 10)}…`);
      await refresh();
    } catch (error: any) {
      toast.error(String(error?.message || error));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="space-y-4 rounded-xl border border-[#29292f] bg-[#141418] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-white">
          <Satellite size={18} className="text-[#20d38a]" />TxLINE settlement
        </h2>
        <div className="flex items-center gap-2 text-xs">
          <span className={"rounded-full px-2.5 py-1 font-bold uppercase tracking-wider " + (settlementEnabled ? "bg-[#20d38a]/10 text-[#7ce8bb]" : "bg-[#fa4669]/10 text-[#f78ba0]")}>
            Settlement {settlementEnabled ? "enabled" : "disabled"}
          </span>
          <button type="button" onClick={refresh} className="grid h-8 w-8 place-items-center rounded-lg border border-[#29292f] text-[#a1a1aa] hover:text-white" aria-label="Refresh TxLINE markets"><RefreshCw size={14} /></button>
        </div>
      </div>

      {!settlementEnabled && (
        <p className="rounded-lg border border-[#fa4669]/25 bg-[#fa4669]/[0.06] p-3 text-xs leading-5 text-[#f8c0cb]">
          Settlement disabled until TxLINE is configured (or mock mode is explicitly enabled). Markets cannot be resolved from missing data.
        </p>
      )}

      {markets.length === 0 ? (
        <p className="rounded-lg border border-[#232328] bg-white/[0.03] p-4 text-sm text-[#a1a1aa]">No live goal-window markets yet. Create one from /live.</p>
      ) : (
        <div className="space-y-3">
          {markets.map(market => {
            const proposal = proposals[market.id];
            return (
              <article key={market.id} className="rounded-lg border border-[#29292f] bg-[#19191d] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold text-white">{market.homeTeam} vs {market.awayTeam} · Goal in {market.windowMinutes}m</div>
                  <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#c9c9ce]">{market.status}</span>
                </div>
                <dl className="mt-3 grid gap-x-5 gap-y-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
                  <div><dt className="text-[#6f6f78]">Fixture ID</dt><dd className="mt-0.5 font-mono text-[#e6e6e9]">{market.txoddsFixtureId}</dd></div>
                  <div><dt className="text-[#6f6f78]">Start score</dt><dd className="mt-0.5 font-mono text-[#e6e6e9]">{market.startHomeScore}-{market.startAwayScore}</dd></div>
                  <div><dt className="text-[#6f6f78]">Window ends</dt><dd className="mt-0.5 font-mono text-[#e6e6e9]">{new Date(market.windowEndTs * 1000).toLocaleTimeString()}</dd></div>
                  <div><dt className="text-[#6f6f78]">On-chain poll</dt><dd className="mt-0.5 truncate font-mono text-[#e6e6e9]">{market.onchainMarketPubkey.slice(0, 12)}…</dd></div>
                </dl>

                {proposal && (
                  <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-[#20d38a]/25 bg-[#20d38a]/[0.05] p-3 text-xs">
                    <CheckCircle2 size={14} className="text-[#7ce8bb]" />
                    <span className="text-[#e6e6e9]">End score <b className="font-mono">{proposal.endHomeScore}-{proposal.endAwayScore}</b></span>
                    <span className="text-[#e6e6e9]">Proposed winner: <b className={proposal.resolvedOutcome === "YES" ? "text-[#7ce8bb]" : "text-[#f78ba0]"}>{proposal.resolvedOutcome}</b></span>
                    <span className={"rounded-full px-2 py-0.5 font-bold uppercase tracking-wider " + (proposal.source === "txline" ? "bg-[#20d38a]/10 text-[#7ce8bb]" : "bg-[#e6ff3e]/10 text-[#d8ec52]")}>
                      {proposal.source === "txline" ? "TxLINE score" : "Mock score"}
                    </span>
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => proposeOutcome(market)}
                    disabled={busyId !== null || !settlementEnabled || market.status === "RESOLVED"}
                    className="rounded-lg border border-[#3b3b43] px-3 py-2 text-xs font-bold text-[#e6e6e9] transition hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {busyId === `propose-${market.id}` ? "Fetching…" : "Fetch end score & propose"}
                  </button>
                  <button
                    type="button"
                    onClick={() => settleOnChain(market)}
                    disabled={busyId !== null || !proposal || !settlementEnabled || market.status === "RESOLVED"}
                    className="rounded-lg bg-[#f4f4f5] px-3 py-2 text-xs font-bold text-[#0a0a0c] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {busyId === `settle-${market.id}` ? "Waiting for wallet…" : "Sign & settle on-chain"}
                  </button>
                  {market.settlementTx && (
                    <a
                      href={`https://explorer.solana.com/tx/${market.settlementTx}?cluster=devnet`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#7ce8bb] hover:text-white"
                    >
                      Settlement tx <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <DataHealthWidget compact />
        <div className="rounded-xl border border-[#29292f] bg-[#141418] p-4 text-xs leading-5 text-[#a1a1aa]">
          <div className="flex items-center gap-2 font-heading text-sm font-bold text-white"><ShieldCheck size={15} className="text-[#20d38a]" />Settlement rules</div>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>Outcome is proposed from score data (YES if total goals increased in the window).</li>
            <li>Nothing is recorded until the admin wallet signs and the transaction confirms.</li>
            <li>Mock scores are only used when mock mode is explicitly enabled, and are labeled.</li>
            <li>Real TxLINE validation is not claimed unless credentials are configured.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
