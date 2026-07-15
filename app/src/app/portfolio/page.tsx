"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useApp, formatDollars, formatDollarsShort, DemoPoll, PollStatus, ClaimRewardResult } from "@/components/Providers";
import { useLanguage } from "@/lib/languageContext";
import {
    Wallet,
    TrendingUp,
    TrendingDown,
    Clock,
    CheckCircle,
    Gift,
    BarChart3,
    ArrowRight,
    AlertCircle,
    Coins,
} from "lucide-react";

/** Classification of a user's position in a poll */
type PositionStatus = "active" | "won" | "lost" | "claimable";

interface Position {
    poll: DemoPoll;
    optionIndex: number;
    coins: number;
    staked: number;
    status: PositionStatus;
    pnl: number;
}

export default function PortfolioPage() {
    const { polls, votes, userAccount, walletAddress, walletConnected, connectWallet, claimReward } = useApp();
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<"all" | "active" | "won" | "lost">("all");

    // Build positions from votes + polls
    const positions = useMemo<Position[]>(() => {
        if (!walletAddress) return [];

        return votes
            .filter((v) => v.voter === walletAddress)
            .map((v) => {
                const poll = polls.find((p) => p.id === v.pollId);
                if (!poll) return null;

                // Find main voted option (highest coins)
                let mainOption = 0;
                let mainCoins = 0;
                v.votesPerOption.forEach((coins, i) => {
                    // #46: Compare coins against mainCoins, not mainOption (index)
                    if (coins > mainCoins) {
                        mainOption = i;
                        mainCoins = coins;
                    }
                });

                const totalCoins = v.votesPerOption.reduce((a, b) => a + b, 0);
                const isSettled = poll.status === PollStatus.Settled;
                const isEnded = Math.floor(Date.now() / 1000) >= poll.endTime;
                const isWinner = isSettled && poll.winningOption === mainOption;
                const isLoser = isSettled && poll.winningOption !== mainOption;

                // Calculate P&L
                // #47: Guard against division by zero when totalWinning is 0
                let pnl = 0;
                if (isSettled && isWinner) {
                    const totalWinning = poll.voteCounts[poll.winningOption] || 0;
                    if (totalWinning > 0) {
                        const share = mainCoins / totalWinning;
                        const reward = Math.floor(share * poll.totalPoolLamports);
                        pnl = reward - v.totalStakedLamports;
                    }
                } else if (isSettled && isLoser) {
                    pnl = -v.totalStakedLamports;
                }

                let status: PositionStatus = "active";
                if (isSettled && isWinner && !v.claimed) status = "claimable";
                else if (isSettled && isWinner) status = "won";
                else if (isSettled && isLoser) status = "lost";

                return {
                    poll,
                    optionIndex: mainOption,
                    coins: totalCoins,
                    staked: v.totalStakedLamports,
                    status,
                    pnl,
                } as Position;
            })
            .filter(Boolean) as Position[];
    }, [votes, polls, walletAddress]);

    const filteredPositions = positions.filter((p) => {
        if (activeTab === "all") return true;
        if (activeTab === "active") return p.status === "active";
        if (activeTab === "won") return p.status === "won" || p.status === "claimable";
        if (activeTab === "lost") return p.status === "lost";
        return true;
    });

    // Summary stats
    const totalStaked = positions.reduce((sum, p) => sum + p.staked, 0);
    const totalPnL = positions.reduce((sum, p) => sum + p.pnl, 0);
    const claimableCount = positions.filter((p) => p.status === "claimable").length;
    const activeCount = positions.filter((p) => p.status === "active").length;
    const totalClaimed = positions.filter((p) => p.status === "won").reduce((sum, p) => sum + Math.max(0, p.staked + p.pnl), 0);
    const winRate = positions.filter((p) => p.status === "won" || p.status === "claimable").length;
    const settledCount = positions.filter((p) => p.status !== "active").length;

    if (!walletConnected) {
        return (
            <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 rounded-2xl border border-[#29292f] bg-[#141418] p-8 text-center">
                <Wallet size={44} className="text-[#6f6f78]" />
                <h2 className="font-heading text-xl font-bold uppercase tracking-[-0.02em] text-[#f4f4f5]">Connect your wallet</h2>
                <p className="max-w-sm text-center text-sm leading-6 text-[#a1a1aa]">
                    Connect your wallet to view your portfolio, active positions, and P&L.
                </p>
                <button
                    onClick={connectWallet}
                    className="rounded-[0.65rem] bg-[#f4f4f5] px-6 py-2.5 text-sm font-bold text-[#0a0a0c] transition hover:bg-white"
                >
                    Connect Wallet
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-6 flex items-end justify-between rounded-2xl border border-[#29292f] bg-[#19191d] p-6">
                <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#a1a1aa]">Portfolio</div>
                    <h1 className="mt-2 shrink-0 font-heading text-2xl font-bold uppercase tracking-[-0.03em] text-white sm:text-3xl">
                        My Positions
                    </h1>
                </div>
                {userAccount && (
                    <div className="rounded-xl border border-[#29292f] bg-[#111114] px-4 py-3 text-right">
                        <div className="text-[10px] uppercase tracking-wider text-[#6f6f78]">Balance</div>
                        <div className="font-mono text-lg font-bold text-[#e6e6e9]">{formatDollars(userAccount.balance)}</div>
                    </div>
                )}
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
                <SummaryCard
                    icon={<Coins size={18} />}
                    label="Total Staked"
                    value={formatDollarsShort(totalStaked)}
                    color="brand"
                />
                <SummaryCard
                    icon={totalPnL >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                    label="Total P&L"
                    value={`${totalPnL >= 0 ? "+" : ""}${formatDollarsShort(totalPnL)}`}
                    color={totalPnL >= 0 ? "green" : "red"}
                />
                <SummaryCard
                    icon={<BarChart3 size={18} />}
                    label="Win Rate"
                    value={settledCount > 0 ? `${Math.round((winRate / settledCount) * 100)}%` : "—"}
                    color="blue"
                />
                <SummaryCard
                    icon={<CheckCircle size={18} />}
                    label="Total Claimed"
                    value={formatDollarsShort(totalClaimed)}
                    color="green"
                />
                <SummaryCard
                    icon={<Gift size={18} />}
                    label="Claimable"
                    value={String(claimableCount)}
                    color={claimableCount > 0 ? "yellow" : "gray"}
                />
            </div>

            {/* Filter Tabs */}
            <div className="mb-4 flex w-fit gap-1 rounded-[0.65rem] border border-[#29292f] bg-[#111114] p-1">
                {([
                    { key: "all", label: "All positions", count: positions.length },
                    { key: "active", label: "Open positions", count: activeCount },
                    { key: "won", label: "Resolved / claimable", count: winRate },
                    { key: "lost", label: "Lost positions", count: positions.filter((p) => p.status === "lost").length },
                ] as const).map(({ key, label, count }) => (
                    <button
                        key={key}
                        onClick={() => setActiveTab(key)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${activeTab === key
                            ? "bg-[#f4f4f5] text-[#0a0a0c]"
                            : "text-[#898991] hover:text-white"
                            }`}
                    >
                        {label}
                        <span className="ml-1 opacity-60">({count})</span>
                    </button>
                ))}
            </div>

            {/* Positions List */}
            {filteredPositions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <AlertCircle size={32} className="text-[#6f6f78]" />
                    <p className="text-sm text-[#a1a1aa]">
                        {activeTab === "all"
                            ? "No positions yet. Trade a YES/NO market to get started!"
                            : `No ${activeTab} positions.`}
                    </p>
                    <Link
                        href="/events"
                        className="flex items-center gap-1 rounded-[0.65rem] bg-[#f4f4f5] px-4 py-2 text-xs font-bold text-[#0a0a0c] transition hover:bg-white"
                    >
                        Browse markets <ArrowRight size={12} />
                    </Link>
                </div>
            ) : (
                <div className="space-y-2">
                    {filteredPositions.map((pos) => (
                        <PositionCard key={`${pos.poll.id}-${pos.optionIndex}`} position={pos} onClaim={claimReward} />
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Sub-components ────────────────────────────────────────────────────

function SummaryCard({
    icon,
    label,
    value,
    color,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    color: string;
}) {
    const colorClasses: Record<string, string> = {
        brand: "text-[#e6e6e9]",
        green: "text-[#7ce8bb]",
        red: "text-[#f78ba0]",
        blue: "text-[#e6e6e9]",
        yellow: "text-[#d8ec52]",
        gray: "text-[#a1a1aa]",
    };

    return (
        <div className={`rounded-xl border border-[#29292f] bg-[#141418] p-3 ${colorClasses[color] || colorClasses.gray}`}>
            <div className="mb-1 flex items-center gap-1.5 text-[#8b8b94]">{icon}<span className="text-[10px] font-bold uppercase tracking-wider">{label}</span></div>
            <div className="font-mono text-lg font-bold">{value}</div>
        </div>
    );
}

function PositionCard({ position, onClaim }: { position: Position; onClaim: (pollId: string) => Promise<ClaimRewardResult> }) {
    const { poll, optionIndex, coins, staked, status, pnl } = position;
    const [claiming, setClaiming] = useState(false);

    const statusConfig: Record<PositionStatus, { icon: React.ReactNode; label: string; color: string }> = {
        active: { icon: <Clock size={14} />, label: "Active", color: "text-[#a1a1aa]" },
        won: { icon: <CheckCircle size={14} />, label: "Won", color: "text-[#7ce8bb]" },
        lost: { icon: <TrendingDown size={14} />, label: "Lost", color: "text-[#f78ba0]" },
        claimable: { icon: <Gift size={14} />, label: "Claimable", color: "text-[#d8ec52]" },
    };

    const sc = statusConfig[status];

    const handleClaim = async () => {
        setClaiming(true);
        try {
            await onClaim(poll.id);
        } finally {
            setClaiming(false);
        }
    };

    return (
        <Link
            href={`/polls/${poll.id}`}
            className="group flex items-center gap-3 rounded-xl border border-[#29292f] bg-[#19191d] p-3 transition-all hover:border-[#3b3b43] hover:bg-[#1e1e23] sm:p-4"
        >
            {/* Status icon */}
            <div className={`shrink-0 ${sc.color}`}>{sc.icon}</div>

            {/* Poll info */}
            <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[#e6e6e9] truncate group-hover:text-white transition-colors">
                    {poll.title}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-[#6f6f78] mt-0.5">
                    <span className="truncate">Your side: {poll.options[optionIndex] || `Option ${optionIndex}`}</span>
                    <span>·</span>
                    <span>{coins} coins</span>
                    <span>·</span>
                    <span>{formatDollarsShort(staked)} staked</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-[#6f6f78]"><span>Estimated payout: {status === "active" ? "Pending settlement" : formatDollarsShort(Math.max(0, staked + pnl))}</span>{status === "active" && <span>Exit value unavailable under the current pooled market model</span>}</div>
            </div>

            {/* P&L + action */}
            <div className="flex items-center gap-2 shrink-0">
                {status !== "active" && (
                    <span className={`text-sm font-bold ${pnl >= 0 ? "text-[#7ce8bb]" : "text-[#f78ba0]"}`}>
                        {pnl >= 0 ? "+" : ""}{formatDollarsShort(pnl)}
                    </span>
                )}
                {status === "claimable" && (
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleClaim();
                        }}
                        disabled={claiming}
                        className="px-3 py-1 text-[10px] font-semibold rounded-lg border border-[#d8ec52]/30 bg-[#d8ec52]/15 text-[#d8ec52] hover:bg-[#d8ec52]/25 transition-colors disabled:opacity-50"
                    >
                        {claiming ? "..." : "Claim"}
                    </button>
                )}
                <ArrowRight size={14} className="text-[#6f6f78] group-hover:text-[#a1a1aa] transition-colors" />
            </div>
        </Link>
    );
}
