"use client";

import { useState } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { usePositions, useMarkets, useOrders } from "@/lib/v2/hooks";
import { fmtSol, bpsToPct1, redeemPosition, SET_COST, LAMPORTS_PER_BP } from "@/lib/v2/client";

const EXPLORER = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;

export default function PositionsPage() {
    const { publicKey, signTransaction } = useWallet();
    const wallet = publicKey?.toBase58() ?? null;
    const { positions, balance, refresh } = usePositions(wallet);
    const { markets } = useMarkets();
    const { orders } = useOrders(wallet);
    const [redeemMsg, setRedeemMsg] = useState<string | null>(null);

    if (!wallet) {
        return <div className="wt-page wt-empty">Connect your wallet to view positions.</div>;
    }

    const marketById = new Map(markets.map((m) => [m.address, m]));
    const openOrderCollateral = orders
        .filter((o) => o.status === "open" || o.status === "partially_filled")
        .reduce((s, o) => s + o.lockedAmount, 0);

    // Executable value = shares × best bid for that outcome.
    let portfolioValue = 0;
    let unrealized = 0;
    let realized = 0;
    const rows = positions
        .filter((p) => p.shares > 0 || p.redeemedShares > 0)
        .map((p) => {
            const m = marketById.get(p.market);
            const bestBid = m?.book[p.outcomeIndex]?.bestBid ?? null;
            const value = bestBid !== null ? p.shares * bestBid * LAMPORTS_PER_BP : 0;
            const avgEntryBps =
                p.shares + p.redeemedShares > 0
                    ? Math.round(
                          (p.costLamports / ((p.shares + p.redeemedShares) * LAMPORTS_PER_BP)) || 0
                      )
                    : 0;
            const pnl = value + p.proceedsLamports + p.redeemedLamports - p.costLamports;
            portfolioValue += value;
            unrealized += value - (p.shares > 0 ? (p.costLamports * p.shares) / (p.shares + p.redeemedShares || 1) : 0);
            realized += p.redeemedLamports + p.proceedsLamports - (p.costLamports - (p.shares > 0 ? p.costLamports : 0));
            const settled = m?.status === 3 || m?.status === 4;
            const isWinner = m?.status === 3 && m?.winningOutcome === p.outcomeIndex;
            return { p, m, bestBid, value, avgEntryBps, pnl, settled, isWinner };
        });

    async function handleRedeem(market: string, outcome: number) {
        if (!wallet || !signTransaction) return;
        setRedeemMsg(null);
        try {
            const sig = await redeemPosition(wallet, market, outcome, signTransaction);
            setRedeemMsg(`Redeemed — ${sig.slice(0, 12)}…`);
            refresh();
        } catch (e) {
            setRedeemMsg(e instanceof Error ? e.message : "redeem_failed");
        }
    }

    return (
        <div className="wt-page">
            <h1 className="wt-market-title" style={{ marginBottom: 18 }}>
                Portfolio
            </h1>

            <div className="wt-stats">
                <Stat label="Available collateral" value={`◎ ${balance ? fmtSol(balance.available) : "0.000"}`} />
                <Stat label="Positions value" value={`◎ ${fmtSol(portfolioValue)}`} />
                <Stat label="Locked in orders" value={`◎ ${fmtSol(openOrderCollateral)}`} />
                <Stat label="Deposited (lifetime)" value={`◎ ${balance ? fmtSol(balance.totalDeposited) : "0.000"}`} />
            </div>

            {redeemMsg && <div className="wt-panel" style={{ color: "var(--wt-accent)" }}>{redeemMsg}</div>}

            <div className="wt-panel">
                <p className="wt-panel-title">Positions</p>
                {rows.length === 0 ? (
                    <div className="wt-empty">No positions yet. Buy shares from a market to get started.</div>
                ) : (
                    <table className="wt-table">
                        <thead>
                            <tr>
                                <th>Market</th>
                                <th>Outcome</th>
                                <th className="wt-num-right">Shares</th>
                                <th className="wt-num-right">Avg entry</th>
                                <th className="wt-num-right">Best bid</th>
                                <th className="wt-num-right">Value</th>
                                <th className="wt-num-right">P&amp;L</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(({ p, m, bestBid, value, avgEntryBps, pnl, settled, isWinner }) => (
                                <tr key={p.address}>
                                    <td>
                                        {m ? (
                                            <Link href={`/market/${p.market}`} style={{ color: "var(--wt-text)" }}>
                                                {m.title.slice(0, 40)}
                                            </Link>
                                        ) : (
                                            p.market.slice(0, 8)
                                        )}
                                    </td>
                                    <td>{m?.outcomes[p.outcomeIndex] ?? `#${p.outcomeIndex}`}</td>
                                    <td className="wt-num-right">{p.shares}</td>
                                    <td className="wt-num-right">{bpsToPct1(avgEntryBps)}</td>
                                    <td className="wt-num-right">{bestBid !== null ? bpsToPct1(bestBid) : "—"}</td>
                                    <td className="wt-num-right">◎ {fmtSol(value)}</td>
                                    <td className={`wt-num-right`} style={{ color: pnl >= 0 ? "var(--wt-yes)" : "var(--wt-no)" }}>
                                        {pnl >= 0 ? "+" : "−"}◎ {fmtSol(Math.abs(pnl))}
                                    </td>
                                    <td className="wt-num-right">
                                        {settled && p.shares > 0 ? (
                                            <button
                                                className="wt-btn"
                                                style={{ padding: "6px 12px" }}
                                                onClick={() => handleRedeem(p.market, p.outcomeIndex)}
                                            >
                                                {isWinner || m?.status === 4 ? "Redeem" : "Redeem (0)"}
                                            </button>
                                        ) : m?.status === 0 && p.shares > 0 ? (
                                            <Link href={`/market/${p.market}`} className="wt-btn" style={{ padding: "6px 12px" }}>
                                                Sell
                                            </Link>
                                        ) : null}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <p className="wt-fineprint">Devnet SOL has no real-money value.</p>
        </div>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="wt-stat">
            <div className="l">{label}</div>
            <div className="v wt-tabular">{value}</div>
        </div>
    );
}
