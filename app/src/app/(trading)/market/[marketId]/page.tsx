"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useMarket, usePositions, useActivity } from "@/lib/v2/hooks";
import { bpsToPct, bpsToPct1, fmtSol } from "@/lib/v2/client";
import TradeTicket from "../../TradeTicket";
import OrderBook from "../../OrderBook";
import PriceChart from "../../PriceChart";

const EXPLORER_ADDR = (a: string) => `https://explorer.solana.com/address/${a}?cluster=devnet`;
const STATUS_LABEL: Record<number, string> = { 0: "Open", 1: "Paused", 2: "Closed", 3: "Settled", 4: "Void" };
const SOURCE_LABEL: Record<number, string> = { 0: "Admin resolution", 1: "TxLINE score data" };

export default function MarketDetailPage({ params }: { params: Promise<{ marketId: string }> }) {
    const { marketId } = use(params);
    const { publicKey } = useWallet();
    const wallet = publicKey?.toBase58() ?? null;
    const { market, loading, refresh } = useMarket(marketId);
    const { positions, balance, refresh: refreshPos } = usePositions(wallet);
    const { activity } = useActivity({ market: marketId });
    const [outcome, setOutcome] = useState(1);
    const [sheetOpen, setSheetOpen] = useState(false);

    if (loading && !market) return <div className="wt-page wt-empty">Loading market…</div>;
    if (!market) return <div className="wt-page wt-empty">Market not found.</div>;

    // Clamp selected outcome to this market.
    const sel = Math.min(outcome, market.numOutcomes - 1);
    const marketPositions = positions.filter((p) => p.market === market.address);
    const bestAsk = market.book[sel]?.bestAsk ?? null;
    const bestBid = market.book[sel]?.bestBid ?? null;
    const tradable = market.status === 0 && market.closeTs * 1000 > Date.now();

    const refreshAll = () => {
        refresh();
        refreshPos();
    };

    return (
        <div className="wt-page">
            <div className="wt-breadcrumb">
                <Link href="/markets">Markets</Link> ›{" "}
                {market.fixtureId ? "Football · " : ""}
                {market.title}
            </div>

            <div className="wt-detail-grid">
                {/* Main column */}
                <div>
                    <div className="wt-panel">
                        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6 }}>
                            <span className={`wt-status-chip wt-status-${sClass(market.status)}`}>
                                {STATUS_LABEL[market.status]}
                            </span>
                            <span style={{ color: "var(--wt-text-faint)", fontSize: 12.5 }}>
                                ◎ {fmtSol(market.volumeLamports, 2)} volume · closes{" "}
                                {new Date(market.closeTs * 1000).toLocaleString()}
                            </span>
                        </div>
                        <h1 className="wt-market-title">{market.title}</h1>
                        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8 }}>
                            {market.outcomes.map((o, i) => (
                                <button
                                    key={i}
                                    onClick={() => setOutcome(i)}
                                    className={`wt-mini-btn ${i === sel ? "wt-mini-yes" : ""}`}
                                    style={{
                                        border: i === sel ? "1px solid var(--wt-yes)" : "1px solid var(--wt-border)",
                                        background: i === sel ? "var(--wt-yes-bg)" : "transparent",
                                        color: i === sel ? "var(--wt-yes)" : "var(--wt-text-dim)",
                                        padding: "8px 14px",
                                    }}
                                >
                                    {o} · {market.book[i]?.bestAsk !== null ? bpsToPct(market.book[i].bestAsk) : "—"}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="wt-panel">
                        <PriceChart market={market.address} outcome={sel} />
                    </div>

                    <div className="wt-panel">
                        <p className="wt-panel-title">Order book · {market.outcomes[sel]}</p>
                        <OrderBook market={market.address} outcome={sel} />
                    </div>

                    <div className="wt-panel">
                        <p className="wt-panel-title">Activity</p>
                        {activity.length === 0 ? (
                            <div className="wt-empty">No activity yet.</div>
                        ) : (
                            <table className="wt-table">
                                <tbody>
                                    {activity.slice(0, 12).map((a, i) => (
                                        <tr key={i}>
                                            <td>
                                                <span
                                                    className={`wt-tag ${
                                                        a.side === "BUY" ? "wt-tag-buy" : a.side === "SELL" ? "wt-tag-sell" : ""
                                                    }`}
                                                >
                                                    {a.kind.replace("_", " ")}
                                                </span>
                                            </td>
                                            <td>{a.quantity ?? ""} {a.priceBps ? `@ ${bpsToPct1(a.priceBps)}` : ""}</td>
                                            <td className="wt-num-right">
                                                {a.txSignature ? (
                                                    <a
                                                        href={`https://explorer.solana.com/tx/${a.txSignature}?cluster=devnet`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        style={{ color: "var(--wt-accent)" }}
                                                    >
                                                        tx ↗
                                                    </a>
                                                ) : (
                                                    <span style={{ color: "var(--wt-text-faint)" }}>
                                                        {new Date(a.createdAt).toLocaleTimeString()}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    <div className="wt-panel">
                        <p className="wt-panel-title">Rules & resolution</p>
                        <p style={{ fontSize: 13.5, color: "var(--wt-text-dim)", lineHeight: 1.6 }}>
                            This market resolves from {SOURCE_LABEL[market.resolutionSource] ?? "the configured source"}.
                            Winning shares redeem for 0.001 ◎ each; losing shares redeem for zero. Resolves from
                            data, not majority vote.
                        </p>
                        <div style={{ fontSize: 12, color: "var(--wt-text-faint)", marginTop: 10, lineHeight: 1.8 }}>
                            <div>
                                Market:{" "}
                                <a href={EXPLORER_ADDR(market.address)} target="_blank" rel="noreferrer" style={{ color: "var(--wt-accent)" }}>
                                    {market.address.slice(0, 8)}…{market.address.slice(-6)} ↗
                                </a>
                            </div>
                            <div>Fee: {(market.feeBps / 100).toFixed(2)}% · Market #{market.marketId}</div>
                            {market.status === 3 && (
                                <div>Winning outcome: {market.outcomes[market.winningOutcome] ?? "—"}</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right sticky ticket (desktop) */}
                <TradeTicket
                    market={market}
                    balance={balance}
                    positions={marketPositions}
                    selectedOutcome={sel}
                    onOutcomeChange={setOutcome}
                    onDone={refreshAll}
                />
            </div>

            {/* Mobile sticky footer + bottom sheet */}
            <div className="wt-mobile-footer">
                <button
                    className="wt-btn wt-btn-yes wt-btn-block"
                    disabled={!tradable}
                    onClick={() => setSheetOpen(true)}
                >
                    Buy {market.outcomes[sel]} {bestAsk !== null ? bpsToPct(bestAsk) : ""}
                </button>
                <button
                    className="wt-btn wt-btn-no wt-btn-block"
                    disabled={!tradable}
                    onClick={() => setSheetOpen(true)}
                >
                    Sell {bestBid !== null ? bpsToPct(bestBid) : ""}
                </button>
            </div>

            {sheetOpen && (
                <div
                    className="wt-sheet-backdrop"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setSheetOpen(false);
                    }}
                >
                    <div className="wt-sheet">
                        <div className="wt-sheet-handle" onClick={() => setSheetOpen(false)} />
                        <TradeTicket
                            market={market}
                            balance={balance}
                            positions={marketPositions}
                            selectedOutcome={sel}
                            onOutcomeChange={setOutcome}
                            onDone={refreshAll}
                            compact
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

function sClass(status: number): string {
    if (status === 0) return "open";
    if (status === 3) return "settled";
    return "closed";
}
