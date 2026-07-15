"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useApp, formatDollars, DemoPoll, WINNING_OPTION_UNSET } from "@/components/Providers";
import Image from "next/image";
import WalletConnectModal from "@/components/WalletConnectModal";
import EditPollModal from "@/components/EditPollModal";
import DeletePollModal from "@/components/DeletePollModal";
import { sanitizeImageUrl } from "@/lib/uploadImage";
import { useCountdown } from "@/lib/useCountdown";
import { useVote } from "@/lib/useVote";
import ShareButton from "@/components/ShareButton";
import PollComments from "@/components/PollComments";
import VoteChart from "@/components/VoteChart";
import { fireConfetti } from "@/lib/confetti";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { isAdminWallet } from "@/lib/constants";
import toast from "react-hot-toast";
import { useLanguage } from "@/lib/languageContext";

export default function PollDetailClient() {
    const params = useParams();
    const router = useRouter();
    const pollId = params.id as string;

    const {
        polls,
        walletAddress,
        userAccount,
        settlePoll,
        claimReward,
        walletConnected,
        isLoading,
    } = useApp();

    const poll = polls.find((p) => p.id === pollId);

    // Grace period: after navigating from create page, React state may not have updated yet.
    // Wait a short time before concluding the poll truly doesn't exist.
    const [graceExpired, setGraceExpired] = useState(false);
    useEffect(() => {
        if (poll) { setGraceExpired(true); return; }
        setGraceExpired(false);
        const t = setTimeout(() => setGraceExpired(true), 500);
        return () => clearTimeout(t);
    }, [pollId, poll]);

    const emptyPoll: DemoPoll = {
        id: "", pollId: 0, title: "", description: "", category: "",
        creator: "", options: [], optionImages: [], voteCounts: [],
        totalPoolLamports: 0, unitPriceLamports: 0, totalVoters: 0,
        endTime: 0, status: 0, winningOption: 255, imageUrl: "",
        createdAt: 0, creatorInvestmentLamports: 0, platformFeeLamports: 0,
        creatorRewardLamports: 0,
    };

    const {
        selectedOption, numCoins, setNumCoins,
        cost, totalVotes, isEnded, isSettled, isCreator, canVote,
        vote, selectOption, submitVote,
    } = useVote(poll ?? emptyPoll);

    const [showWalletModal, setShowWalletModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [settling, setSettling] = useState(false);
    const [claiming, setClaiming] = useState(false);
    const [resolutionProof, setResolutionProof] = useState<string | null>(null);
    const [voting, setVoting] = useState(false);
    const { t } = useLanguage();

    const { text: timeLeft } = useCountdown(poll?.endTime ?? 0);

    // Load resolution proof
    useEffect(() => {
        if (!pollId) return;
        // Try localStorage first
        try {
            const proofs = JSON.parse(localStorage.getItem("instinctfi_resolution_proofs") || "{}");
            if (proofs[pollId]) setResolutionProof(proofs[pollId]);
        } catch { }
        // Then try Supabase
        if (isSupabaseConfigured) {
            supabase.from("resolution_proofs").select("source_url").eq("poll_id", pollId).single().then(({ data }) => {
                if (data?.source_url) setResolutionProof(data.source_url);
            });
        }
    }, [pollId]);

    if (!poll) {
        // Still loading or within grace period — show spinner instead of "not found"
        if (isLoading || !graceExpired) {
            return (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <div className="w-10 h-10 border-3 border-brand-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-gray-500 text-sm">{t("loadingPoll")}</p>
                </div>
            );
        }
        return (
            <div className="text-center py-20">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-surface-100 border border-border flex items-center justify-center">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-600"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                </div>
                <p className="text-gray-400 text-lg font-medium mb-2">{t("pollNotFound")}</p>
                <button onClick={() => router.push("/")} className="text-brand-400 hover:text-brand-300 text-sm font-medium transition-colors">
                    ← {t("backToPolls")}
                </button>
            </div>
        );
    }

    const canManage = isCreator && totalVotes === 0 && !isEnded && !isSettled;

    const handleVote = async () => {
        if (!walletConnected) {
            setShowWalletModal(true);
            return;
        }
        setVoting(true);
        try {
            await submitVote();
        } finally {
            setVoting(false);
        }
    };

    const handleOptionClick = (index: number) => {
        if (!walletConnected) {
            setShowWalletModal(true);
            return;
        }
        if (canVote) selectOption(index);
    };

    const handleSettle = async () => {
        if (settling) return;
        setSettling(true);
        try {
            const success = await settlePoll(pollId);
            if (success) toast.success(t("pollSettled"));
            else toast.error(t("settlementFailed"));
        } finally {
            setSettling(false);
        }
    };

    const handleClaim = async () => {
        if (claiming) return;
        setClaiming(true);
        try {
            const { reward } = await claimReward(pollId);
            if (reward > 0) {
                fireConfetti();
                toast.success(`Claimed ${formatDollars(reward)}!`);
            } else {
                toast.error(t("noRewardToClaim"));
            }
        } finally {
            setClaiming(false);
        }
    };

    const canClaim =
        isSettled &&
        vote &&
        !vote.claimed &&
        poll.winningOption !== WINNING_OPTION_UNSET &&
        (vote.votesPerOption[poll.winningOption] || 0) > 0;

    const potentialReward = (() => {
        if (!canClaim || !vote) return 0;
        const denominator = poll.voteCounts[poll.winningOption] || 0;
        if (denominator === 0) return 0;
        return Math.floor(
            (vote.votesPerOption[poll.winningOption] / denominator) *
            poll.totalPoolLamports
        );
    })();

    // ── Polymarket-style derived figures ──
    const LAMPORTS_PER_SOL = 1_000_000_000;
    const unitLamports = poll.unitPriceLamports || 1;
    const amountSol = cost / LAMPORTS_PER_SOL;
    const setAmountFromSol = (sol: number) => {
        const lamports = Math.max(0, sol) * LAMPORTS_PER_SOL;
        setNumCoins(Math.max(1, Math.floor(lamports / unitLamports)));
    };
    const pctOf = (i: number) => (totalVotes > 0 ? (poll.voteCounts[i] / totalVotes) * 100 : 100 / Math.max(1, poll.options.length));
    const leadingIndex = poll.voteCounts.reduce((best, count, i) => (count > (poll.voteCounts[best] || 0) ? i : best), 0);
    const headlineIndex = isSettled && poll.winningOption !== WINNING_OPTION_UNSET ? poll.winningOption : leadingIndex;
    const headlinePct = Math.round(pctOf(headlineIndex));
    // Pool-share payout estimate if the selected option wins (same math as claim)
    const toWin = (() => {
        if (selectedOption === null) return 0;
        const stakedVotes = poll.voteCounts[selectedOption] + numCoins;
        if (stakedVotes <= 0) return cost;
        return Math.floor((numCoins / stakedVotes) * (poll.totalPoolLamports + cost));
    })();
    const endDate = poll.endTime ? new Date(poll.endTime * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";
    const optionColor = (i: number) => (i === 0 ? "#20d38a" : i === 1 ? "#fa4669" : "#5475ff");

    const optionAvatar = (i: number) => {
        const optImage = poll.optionImages?.[i] ? sanitizeImageUrl(poll.optionImages[i]) : "";
        if (optImage) {
            return optImage.startsWith("data:")
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={optImage} alt="" className="h-9 w-9 rounded-full border border-white/10 object-cover" />
                : <Image src={optImage} alt="" width={36} height={36} unoptimized className="h-9 w-9 rounded-full border border-white/10 object-cover" />;
        }
        return (
            <div className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-xs font-extrabold text-white" style={{ background: optionColor(i) + "33", color: optionColor(i) }}>
                {poll.options[i]?.charAt(0).toUpperCase()}
            </div>
        );
    };

    return (
        <div className="mx-auto max-w-6xl pb-10">
            <WalletConnectModal isOpen={showWalletModal} onClose={() => setShowWalletModal(false)} />
            {poll && (
                <>
                    <EditPollModal isOpen={showEditModal} onClose={() => setShowEditModal(false)} poll={poll} />
                    <DeletePollModal
                        isOpen={showDeleteModal}
                        onClose={() => setShowDeleteModal(false)}
                        poll={poll}
                        onDeleted={() => router.push("/")}
                    />
                </>
            )}

            {/* Back */}
            <button onClick={() => router.push("/")} className="group mb-5 flex items-center gap-1.5 text-sm font-medium text-gray-400 transition-colors hover:text-white">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="transition-transform group-hover:-translate-x-0.5"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                {t("backToPolls")}
            </button>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
                {/* ══ LEFT — market ══ */}
                <div className="min-w-0">
                    {/* Header */}
                    <div className="flex items-start gap-4">
                        {poll.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={sanitizeImageUrl(poll.imageUrl)} alt="" className="h-14 w-14 shrink-0 rounded-xl border border-white/[0.08] object-cover sm:h-16 sm:w-16" />
                        ) : (
                            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-[#15151a] text-xl sm:h-16 sm:w-16">⚽</div>
                        )}
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#8b8b94]">
                                <span className="rounded-md bg-white/[0.06] px-2 py-0.5 font-bold text-[#c9c9ce]">{poll.category}</span>
                                <span className="font-mono">{formatDollars(poll.totalPoolLamports)} Vol.</span>
                                {endDate && <span className="flex items-center gap-1"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>{endDate}</span>}
                                <span className={`rounded-md px-2 py-0.5 font-bold ${isSettled ? "bg-[#20d38a]/15 text-[#7ce8bb]" : isEnded ? "bg-[#fa4669]/15 text-[#f78ba0]" : "bg-white/[0.06] text-[#c9c9ce]"}`}>
                                    {isSettled ? t("settled") : isEnded ? "Awaiting settlement" : timeLeft}
                                </span>
                            </div>
                            <h1 className="mt-1.5 font-heading text-xl font-bold leading-tight tracking-tight text-white sm:text-2xl">{poll.title}</h1>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                            <ShareButton pollId={poll.id} pollTitle={poll.title} />
                            <div className="text-right">
                                <div className="font-mono text-2xl font-extrabold sm:text-3xl" style={{ color: optionColor(headlineIndex) }}>{headlinePct}%</div>
                                <div className="text-[10px] font-bold uppercase tracking-wider text-[#6f6f78]">{isSettled ? "settled" : "chance"} · {poll.options[headlineIndex]}</div>
                            </div>
                        </div>
                    </div>

                    {/* Chart */}
                    <div className="mt-5">
                        <VoteChart poll={poll} />
                    </div>

                    {/* Outcomes — Polymarket rows */}
                    <section className="mt-5 overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-b from-[#15151a] to-[#101014]">
                        <div className="flex items-center justify-between border-b border-white/[0.05] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[#6f6f78]">
                            <span>Outcome</span>
                            <span>% chance · trade</span>
                        </div>
                        {poll.options.map((opt, i) => {
                            const pct = pctOf(i);
                            const isWinner = isSettled && poll.winningOption === i;
                            const isSelected = selectedOption === i;
                            const userVotes = vote ? vote.votesPerOption[i] || 0 : 0;
                            return (
                                <div key={i} className={`relative border-b border-white/[0.04] px-4 py-3.5 transition-colors last:border-b-0 ${isSelected ? "bg-white/[0.03]" : ""}`}>
                                    <div className="absolute inset-y-0 left-0 opacity-[0.07]" style={{ width: `${Math.max(pct, 1)}%`, background: optionColor(i) }} aria-hidden="true" />
                                    <div className="relative flex items-center gap-3">
                                        {optionAvatar(i)}
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 truncate text-sm font-bold text-white">
                                                {isWinner && <span className="text-[#20d38a]">✓</span>}
                                                {opt}
                                            </div>
                                            <div className="text-xs text-[#8b8b94]">
                                                {poll.voteCounts[i]} votes
                                                {userVotes > 0 && <span className="ml-2 text-[#7ce8bb]">· you hold {userVotes} ({formatDollars(userVotes * poll.unitPriceLamports)})</span>}
                                            </div>
                                        </div>
                                        <div className="w-14 text-right font-mono text-lg font-extrabold text-white">{Math.round(pct)}%</div>
                                        {!isEnded && !isSettled ? (
                                            <button
                                                onClick={() => handleOptionClick(i)}
                                                disabled={walletConnected && !canVote}
                                                className="rounded-lg px-3.5 py-2 text-xs font-extrabold transition disabled:cursor-not-allowed disabled:opacity-40"
                                                style={isSelected
                                                    ? { background: optionColor(i), color: "#0a0a0c" }
                                                    : { background: optionColor(i) + "1f", color: optionColor(i), border: `1px solid ${optionColor(i)}40` }}
                                            >
                                                Buy · {Math.round(pct)}%
                                            </button>
                                        ) : (
                                            <span className={`rounded-lg px-3 py-1.5 text-xs font-extrabold ${isWinner ? "bg-[#20d38a]/15 text-[#7ce8bb]" : "bg-white/[0.04] text-[#6f6f78]"}`}>
                                                {isSettled ? (isWinner ? "Won" : "Lost") : "Locked"}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </section>

                    {/* About */}
                    <section className="mt-5 rounded-2xl border border-white/[0.07] bg-gradient-to-b from-[#15151a] to-[#101014] p-5">
                        <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-[#8b8b94]">About this market</h2>
                        {poll.description && <p className="mt-3 text-sm leading-relaxed text-[#c9c9ce]">{poll.description}</p>}
                        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                            {[
                                [formatDollars(poll.totalPoolLamports), "Pool"],
                                [String(totalVotes), t("totalVotes")],
                                [String(poll.totalVoters), "Voters"],
                                [formatDollars(poll.unitPriceLamports), "Price/Coin"],
                            ].map(([value, label]) => (
                                <div key={label} className="rounded-xl border border-white/[0.05] bg-[#0d0d11] px-3 py-2.5 text-center">
                                    <div className="font-mono text-sm font-bold text-white">{value}</div>
                                    <div className="mt-0.5 text-[10px] uppercase tracking-wider text-[#6f6f78]">{label}</div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#6f6f78]">
                            <span>Platform fee: {formatDollars(poll.platformFeeLamports)}</span>
                            <span>Creator reward: {formatDollars(poll.creatorRewardLamports)}</span>
                            <span>Seed investment: {formatDollars(poll.creatorInvestmentLamports)}</span>
                        </div>
                        {isSettled && resolutionProof && (() => {
                            // Sanitize URL: only allow http/https to prevent javascript: XSS
                            const isSafeUrl = /^https?:\/\//i.test(resolutionProof);
                            if (!isSafeUrl) return null;
                            return (
                                <div className="mt-4 flex items-center gap-2 rounded-lg border border-[#20d38a]/20 bg-[#20d38a]/[0.05] p-2.5">
                                    <span className="text-sm text-[#7ce8bb]">🔗</span>
                                    <span className="text-xs text-[#8b8b94]">Resolution source:</span>
                                    <a href={resolutionProof} target="_blank" rel="noopener noreferrer" className="truncate text-xs text-[#7ce8bb] underline underline-offset-2 hover:text-white">
                                        {resolutionProof}
                                    </a>
                                </div>
                            );
                        })()}
                    </section>

                    {/* Comments */}
                    <div className="mt-5">
                        <PollComments pollId={pollId} />
                    </div>
                </div>

                {/* ══ RIGHT — trade panel ══ */}
                <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
                    {!isEnded && !isSettled && (
                        <section className="rounded-2xl border border-white/[0.07] bg-gradient-to-b from-[#15151a] to-[#101014] p-4 shadow-2xl shadow-black/30">
                            {/* Buy / Sell tabs (pool market — no secondary selling) */}
                            <div className="flex border-b border-white/[0.06] text-sm font-extrabold">
                                <span className="border-b-2 border-[#20d38a] px-1 pb-2 text-white">Buy</span>
                                <span className="ml-5 cursor-not-allowed px-1 pb-2 text-[#4a4a52]" title="Pool market — positions settle at resolution, no secondary selling">Sell</span>
                            </div>

                            {/* Outcome selector */}
                            <div className={`mt-4 grid gap-2 ${poll.options.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
                                {poll.options.map((opt, i) => {
                                    const isSelected = selectedOption === i;
                                    return (
                                        <button
                                            key={i}
                                            onClick={() => handleOptionClick(i)}
                                            disabled={walletConnected && !canVote}
                                            className="truncate rounded-xl px-3 py-3 text-sm font-extrabold transition disabled:cursor-not-allowed disabled:opacity-40"
                                            style={isSelected
                                                ? { background: optionColor(i), color: "#0a0a0c" }
                                                : { background: "#0d0d11", color: "#c9c9ce", border: "1px solid rgba(255,255,255,0.08)" }}
                                        >
                                            {opt} {Math.round(pctOf(i))}%
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Amount (devnet SOL) */}
                            <div className="mt-4 flex items-baseline justify-between">
                                <span className="text-xs font-bold uppercase tracking-wider text-[#6f6f78]">Amount</span>
                                <span className="text-[10px] text-[#5d5d65]">devnet SOL</span>
                            </div>
                            <input
                                type="number"
                                value={Number(amountSol.toFixed(4))}
                                onChange={(e) => setAmountFromSol(parseFloat(e.target.value) || 0)}
                                min={unitLamports / LAMPORTS_PER_SOL}
                                step={unitLamports / LAMPORTS_PER_SOL}
                                className="mt-1.5 w-full rounded-xl border border-white/[0.08] bg-[#0d0d11] px-3 py-3 text-right font-mono text-2xl font-extrabold text-white outline-none transition focus:border-[#20d38a]/50"
                            />
                            <div className="mt-2 flex gap-1.5">
                                {([[0.01, "+0.01"], [0.05, "+0.05"], [0.1, "+0.1"]] as const).map(([sol, label]) => (
                                    <button key={label} onClick={() => setAmountFromSol(amountSol + sol)} className="flex-1 rounded-lg border border-white/[0.07] bg-white/[0.03] py-1.5 text-xs font-bold text-[#c9c9ce] transition hover:border-white/20 hover:text-white">
                                        {label}
                                    </button>
                                ))}
                                {userAccount && (
                                    <button onClick={() => setAmountFromSol(userAccount.balance / LAMPORTS_PER_SOL)} className="flex-1 rounded-lg border border-white/[0.07] bg-white/[0.03] py-1.5 text-xs font-bold text-[#c9c9ce] transition hover:border-white/20 hover:text-white">
                                        Max
                                    </button>
                                )}
                            </div>

                            {/* Order summary — Polymarket format */}
                            <div className="mt-4 space-y-1.5 rounded-xl border border-white/[0.05] bg-[#0d0d11] p-3 text-sm">
                                <div className="flex justify-between text-xs"><span className="text-[#6f6f78]">Shares</span><span className="font-mono font-bold text-white">{numCoins}</span></div>
                                <div className="flex justify-between text-xs"><span className="text-[#6f6f78]">Entry probability</span><span className="font-mono text-[#8b8b94]">{selectedOption !== null ? `${Math.round(pctOf(selectedOption))}%` : "—"}</span></div>
                                <div className="flex justify-between text-xs"><span className="text-[#6f6f78]">Cost</span><span className="font-mono text-[#8b8b94]">{formatDollars(cost)}</span></div>
                                <div className="flex justify-between border-t border-white/[0.05] pt-1.5">
                                    <span className="font-bold text-[#8b8b94]">To win 💸</span>
                                    <span className="font-mono text-base font-extrabold text-[#7ce8bb]">{selectedOption !== null ? formatDollars(toWin) : "—"}</span>
                                </div>
                                {userAccount && <div className="flex justify-between text-xs"><span className="text-[#6f6f78]">Balance</span><span className="font-mono text-[#8b8b94]">{formatDollars(userAccount.balance)}</span></div>}
                            </div>

                            {/* Action */}
                            <button
                                onClick={handleVote}
                                disabled={voting || (walletConnected && selectedOption === null)}
                                className={`mt-4 w-full rounded-xl py-3.5 text-sm font-extrabold transition active:scale-[0.98] ${voting
                                    ? "cursor-wait bg-[#20d38a]/60 text-[#0a0a0c]"
                                    : walletConnected && selectedOption !== null
                                        ? "bg-[#20d38a] text-[#0a0a0c] shadow-lg shadow-[#20d38a]/20 hover:bg-[#3ee0a4]"
                                        : !walletConnected
                                            ? "bg-[#20d38a] text-[#0a0a0c] hover:bg-[#3ee0a4]"
                                            : "cursor-not-allowed bg-white/[0.06] text-[#6f6f78]"
                                    }`}
                            >
                                {voting ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#0a0a0c] border-t-transparent" />
                                        Submitting...
                                    </span>
                                ) : !walletConnected
                                    ? t("connectWalletToStart")
                                    : selectedOption !== null
                                        ? `Buy ${poll.options[selectedOption]}`
                                        : "Select an outcome"}
                            </button>
                            <p className="mt-3 text-center text-[10px] leading-4 text-[#5d5d65]">Devnet SOL has no real-money value. Pool-based market — payout is your share of the final pool; positions cannot be sold before resolution.</p>
                        </section>
                    )}

                    {/* Settlement (admin only) */}
                    {isEnded && !isSettled && isAdminWallet(walletAddress) && (
                        <section className="rounded-2xl border border-[#e6ff3e]/20 bg-gradient-to-b from-[#15151a] to-[#101014] p-4">
                            <h2 className="text-sm font-bold text-[#d8ec52]">Market ended — ready to settle</h2>
                            <p className="mt-1.5 text-xs leading-5 text-[#8b8b94]">As admin, you can settle this market. The option with the most votes wins.</p>
                            <button
                                onClick={handleSettle}
                                disabled={settling}
                                className={`mt-3 w-full rounded-xl py-3 text-sm font-extrabold transition ${settling ? "cursor-wait bg-[#20d38a]/60 text-[#0a0a0c]" : "bg-[#20d38a] text-[#0a0a0c] hover:bg-[#3ee0a4]"}`}
                            >
                                {settling ? "Settling..." : t("settlePoll")}
                            </button>
                        </section>
                    )}

                    {/* Claim */}
                    {canClaim && (
                        <section className="rounded-2xl border border-[#20d38a]/25 bg-gradient-to-b from-[#0d1f17] to-[#101014] p-4">
                            <h2 className="text-sm font-bold text-[#7ce8bb]">{t("youWon")}</h2>
                            <p className="mt-1.5 text-xs text-[#8b8b94]">
                                Your reward: <span className="font-mono font-bold text-[#7ce8bb]">{formatDollars(potentialReward)}</span>
                            </p>
                            <button
                                onClick={handleClaim}
                                disabled={claiming}
                                className={`mt-3 w-full rounded-xl py-3 text-sm font-extrabold transition ${claiming ? "cursor-wait bg-[#20d38a]/60 text-[#0a0a0c]" : "bg-[#20d38a] text-[#0a0a0c] hover:bg-[#3ee0a4]"}`}
                            >
                                {claiming ? "Claiming..." : t("claimReward")}
                            </button>
                        </section>
                    )}

                    {/* Already claimed */}
                    {vote?.claimed && (
                        <section className="rounded-2xl border border-white/[0.07] bg-[#101014] p-4 text-center text-xs text-[#8b8b94]">
                            Reward already claimed for this market.
                        </section>
                    )}

                    {/* Creator notice */}
                    {isCreator && !isSettled && (
                        <section className="rounded-2xl border border-white/[0.07] bg-[#101014] p-4 text-center text-xs text-[#6f6f78]">
                            You created this market — you cannot trade on it.
                        </section>
                    )}

                    {/* Manage (edit/delete) — creator only, no votes yet */}
                    {canManage && (
                        <section className="rounded-2xl border border-white/[0.07] bg-[#101014] p-4">
                            <h2 className="text-sm font-bold text-white">Manage market</h2>
                            <p className="mt-1 text-xs text-[#6f6f78]">No positions yet — you can edit or delete.</p>
                            <div className="mt-3 flex gap-2">
                                <button
                                    onClick={() => setShowEditModal(true)}
                                    className="flex-1 rounded-xl border border-white/[0.1] py-2.5 text-xs font-bold text-[#c9c9ce] transition hover:border-white/25 hover:text-white"
                                >
                                    {t("edit")}
                                </button>
                                <button
                                    onClick={() => setShowDeleteModal(true)}
                                    className="flex-1 rounded-xl border border-[#fa4669]/30 py-2.5 text-xs font-bold text-[#f78ba0] transition hover:border-[#fa4669]/60 hover:bg-[#fa4669]/10"
                                >
                                    {t("delete")}
                                </button>
                            </div>
                        </section>
                    )}
                </aside>
            </div>
        </div>
    );
}
