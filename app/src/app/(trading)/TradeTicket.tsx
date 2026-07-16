"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
    submitOrder,
    depositCollateral,
    OrderError,
    fmtSol,
    bpsToPct1,
    LAMPORTS_PER_SOL,
    LAMPORTS_PER_BP,
    SET_COST,
} from "@/lib/v2/client";
import type { MarketSummary, BalanceData, PositionData } from "@/lib/v2/hooks";

type Side = "BUY" | "SELL";
type Mode = "MARKET" | "LIMIT";

interface Quote {
    fillableShares: number;
    lamportsUsed: number;
    feeLamports: number;
    totalLamports: number;
    avgPriceBps: number | null;
    worstPriceBps: number | null;
    priceImpactBps: number;
    potentialPayoutLamports: number;
    insufficientLiquidity: boolean;
    shortfallShares: number;
    feeBps: number;
}

const EXPLORER = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;

export default function TradeTicket({
    market,
    balance,
    positions,
    selectedOutcome,
    onOutcomeChange,
    onDone,
    compact,
}: {
    market: MarketSummary;
    balance: BalanceData | null;
    positions: PositionData[];
    selectedOutcome: number;
    onOutcomeChange: (i: number) => void;
    onDone: () => void;
    compact?: boolean;
}) {
    const { publicKey, connected, signMessage, signTransaction } = useWallet();
    const wallet = publicKey?.toBase58() ?? null;

    const [side, setSide] = useState<Side>("BUY");
    const [mode, setMode] = useState<Mode>("MARKET");
    const [amount, setAmount] = useState(""); // BUY MARKET: SOL; SELL: shares; LIMIT: shares
    const [limitPct, setLimitPct] = useState("50");
    const [tif, setTif] = useState<"GTC" | "GTD" | "FAK" | "FOK">("GTC");
    const [quote, setQuote] = useState<Quote | null>(null);
    const [txState, setTxState] = useState<
        | { kind: "idle" }
        | { kind: "signing" }
        | { kind: "submitting" }
        | { kind: "confirmed"; sigs: string[]; msg: string }
        | { kind: "error"; msg: string }
    >({ kind: "idle" });

    const heldShares =
        positions.find((p) => p.outcomeIndex === selectedOutcome)?.shares ?? 0;
    const tradable = market.status === 0 && market.closeTs * 1000 > Date.now();

    // ── quote for market orders ──
    const fetchQuote = useCallback(async () => {
        if (mode !== "MARKET" || !tradable) {
            setQuote(null);
            return;
        }
        const body: Record<string, unknown> = {
            market: market.address,
            outcome: selectedOutcome,
            side,
            wallet,
        };
        if (side === "BUY") {
            const sol = parseFloat(amount);
            if (!sol || sol <= 0) return setQuote(null);
            body.lamports = Math.floor(sol * LAMPORTS_PER_SOL);
        } else {
            const shares = parseInt(amount, 10);
            if (!shares || shares <= 0) return setQuote(null);
            body.shares = shares;
        }
        try {
            const res = await fetch("/api/v2/quote", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(body),
            });
            const json = await res.json();
            setQuote(res.ok ? json : null);
        } catch {
            setQuote(null);
        }
    }, [mode, side, amount, market.address, selectedOutcome, wallet, tradable]);

    useEffect(() => {
        const t = setTimeout(fetchQuote, 250);
        return () => clearTimeout(t);
    }, [fetchQuote]);

    const limitBps = Math.round(parseFloat(limitPct || "0") * 100);
    const limitShares = parseInt(amount, 10) || 0;
    const limitCostLamports = limitBps * LAMPORTS_PER_BP * limitShares;

    const submit = useCallback(async () => {
        if (!wallet || !signMessage) {
            setTxState({ kind: "error", msg: "Connect your wallet first." });
            return;
        }
        try {
            setTxState({ kind: "signing" });

            if (mode === "MARKET") {
                if (side === "BUY") {
                    if (!quote || quote.fillableShares === 0) {
                        throw new OrderError("no_liquidity", 422);
                    }
                    // Marketable limit at the worst acceptable price (slippage cap).
                    const cap = Math.min(9900, (quote.worstPriceBps ?? 9900) + 100);
                    const res = await submitOrderFlow({
                        outcomeIndex: selectedOutcome,
                        side: "BUY",
                        priceBps: cap,
                        quantity: quote.fillableShares,
                        tif: "FAK",
                    });
                    finish(res);
                } else {
                    if (!quote || quote.fillableShares === 0) {
                        throw new OrderError("no_liquidity", 422);
                    }
                    const floor = Math.max(100, (quote.worstPriceBps ?? 100) - 100);
                    const res = await submitOrderFlow({
                        outcomeIndex: selectedOutcome,
                        side: "SELL",
                        priceBps: floor,
                        quantity: Math.min(limitShares || quote.fillableShares, heldShares),
                        tif: "FAK",
                    });
                    finish(res);
                }
            } else {
                if (limitBps < 100 || limitBps > 9900) throw new OrderError("invalid_price", 400);
                if (limitShares <= 0) throw new OrderError("invalid_quantity", 400);
                if (side === "SELL" && limitShares > heldShares) {
                    throw new OrderError("insufficient_shares", 422);
                }
                const res = await submitOrderFlow({
                    outcomeIndex: selectedOutcome,
                    side,
                    priceBps: limitBps,
                    quantity: limitShares,
                    tif,
                });
                finish(res);
            }
        } catch (e) {
            const msg =
                e instanceof OrderError
                    ? ORDER_ERRORS[e.code] ?? e.code
                    : e instanceof Error
                      ? e.message
                      : "order_failed";
            setTxState({ kind: "error", msg });
        }

        async function submitOrderFlow(o: {
            outcomeIndex: number;
            side: Side;
            priceBps: number;
            quantity: number;
            tif: "GTC" | "GTD" | "FAK" | "FOK";
        }) {
            setTxState({ kind: "submitting" });
            return submitOrder(
                { market: market.address, maker: wallet!, ...o },
                signMessage!,
                mode
            );
        }

        function finish(res: {
            settled: { txSignature: string }[];
            remaining: number;
            status: string;
            matchError?: string;
        }) {
            const sigs = res.settled.map((s) => s.txSignature);
            if (res.status === "filled" || sigs.length > 0) {
                setTxState({
                    kind: "confirmed",
                    sigs,
                    msg:
                        res.remaining > 0
                            ? `Partially filled — ${res.remaining} shares ${
                                  mode === "LIMIT" ? "resting" : "unfilled"
                              }`
                            : "Order filled",
                });
            } else if (res.status === "open" || res.status === "partially_filled") {
                setTxState({
                    kind: "confirmed",
                    sigs,
                    msg: "Order posted to the book",
                });
            } else {
                setTxState({
                    kind: "error",
                    msg: res.matchError ?? `Order ${res.status}`,
                });
            }
            setAmount("");
            onDone();
        }
    }, [
        wallet,
        signMessage,
        mode,
        side,
        quote,
        selectedOutcome,
        limitBps,
        limitShares,
        heldShares,
        tif,
        market.address,
        onDone,
    ]);

    const busy = txState.kind === "signing" || txState.kind === "submitting";
    const outcomeName = market.outcomes[selectedOutcome];

    return (
        <div className={compact ? "" : "wt-ticket wt-ticket-desktop"}>
            {/* Buy / Sell */}
            <div className="wt-seg">
                <button
                    className={side === "BUY" ? "active buy" : ""}
                    onClick={() => setSide("BUY")}
                >
                    Buy
                </button>
                <button
                    className={side === "SELL" ? "active sell" : ""}
                    onClick={() => setSide("SELL")}
                >
                    Sell
                </button>
            </div>

            {/* Market / Limit */}
            <div className="wt-seg">
                <button className={mode === "MARKET" ? "active" : ""} onClick={() => setMode("MARKET")}>
                    Market
                </button>
                <button className={mode === "LIMIT" ? "active" : ""} onClick={() => setMode("LIMIT")}>
                    Limit
                </button>
            </div>

            {/* Outcome */}
            <div className="wt-outcome-pick">
                {market.outcomes.map((o, i) => (
                    <button
                        key={i}
                        className={i === selectedOutcome ? "active" : ""}
                        onClick={() => onOutcomeChange(i)}
                    >
                        {o}
                    </button>
                ))}
            </div>

            {mode === "LIMIT" && (
                <div className="wt-field">
                    <label>Limit probability (%)</label>
                    <input
                        className="wt-input"
                        inputMode="decimal"
                        value={limitPct}
                        onChange={(e) => setLimitPct(e.target.value)}
                        placeholder="50"
                    />
                </div>
            )}

            <div className="wt-field">
                <label>
                    {side === "BUY" && mode === "MARKET"
                        ? "Amount (◎ devnet SOL)"
                        : "Shares"}
                </label>
                <input
                    className="wt-input"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={side === "BUY" && mode === "MARKET" ? "0.010" : "0"}
                />
                <div className="wt-chips">
                    {side === "SELL" ? (
                        [0.25, 0.5, 0.75, 1].map((f) => (
                            <button
                                key={f}
                                onClick={() => setAmount(String(Math.floor(heldShares * f)))}
                            >
                                {f === 1 ? "Max" : `${f * 100}%`}
                            </button>
                        ))
                    ) : mode === "MARKET" ? (
                        [0.01, 0.05, 0.1].map((v) => (
                            <button key={v} onClick={() => setAmount(String(v))}>
                                +{v}
                            </button>
                        ))
                    ) : (
                        [10, 50, 100].map((v) => (
                            <button key={v} onClick={() => setAmount(String(v))}>
                                {v}
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* Readout */}
            <div className="wt-readout">
                {mode === "MARKET" && quote ? (
                    <>
                        <Row k={side === "BUY" ? "Shares received" : "Proceeds"} v={
                            side === "BUY"
                                ? `${quote.fillableShares}`
                                : `◎ ${fmtSol(quote.totalLamports)}`
                        } />
                        <Row k="Avg probability" v={bpsToPct1(quote.avgPriceBps)} />
                        <Row k="Worst probability" v={bpsToPct1(quote.worstPriceBps)} />
                        <Row k="Price impact" v={bpsToPct1(quote.priceImpactBps)} />
                        <Row k={`Fee (${(quote.feeBps / 100).toFixed(2)}%)`} v={`◎ ${fmtSol(quote.feeLamports, 4)}`} />
                        {side === "BUY" && (
                            <Row
                                k="Potential payout"
                                v={`◎ ${fmtSol(quote.potentialPayoutLamports)}`}
                            />
                        )}
                        {quote.insufficientLiquidity && (
                            <div className="wt-error">
                                {side === "BUY"
                                    ? "No matching liquidity at these prices."
                                    : `Only ${quote.fillableShares} shares fillable now.`}
                            </div>
                        )}
                    </>
                ) : mode === "LIMIT" ? (
                    <>
                        <Row k="Shares" v={String(limitShares)} />
                        <Row
                            k={side === "BUY" ? "Max cost" : "Max proceeds"}
                            v={`◎ ${fmtSol(limitCostLamports)}`}
                        />
                        <Row
                            k="If it wins"
                            v={`◎ ${fmtSol(limitShares * SET_COST)}`}
                        />
                        {side === "SELL" && (
                            <Row k="Available shares" v={String(heldShares)} />
                        )}
                    </>
                ) : (
                    <div className="wt-empty">Enter an amount to see a quote.</div>
                )}
            </div>

            <Row
                k={side === "BUY" ? "Available collateral" : "Shares held"}
                v={
                    side === "BUY"
                        ? `◎ ${balance ? fmtSol(balance.available) : "0.000"}`
                        : String(heldShares)
                }
            />

            {mode === "LIMIT" && (
                <details className="wt-advanced">
                    <summary>Advanced · Time in force ({tif})</summary>
                    <div className="wt-chips" style={{ marginTop: 8 }}>
                        {(["GTC", "GTD", "FAK", "FOK"] as const).map((t) => (
                            <button
                                key={t}
                                className={t === tif ? "active" : ""}
                                onClick={() => setTif(t)}
                                style={t === tif ? { color: "var(--wt-text)" } : undefined}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                </details>
            )}

            {!tradable ? (
                <div className="wt-tx-state">
                    {market.status === 3
                        ? "Market settled — redeem winning shares from Portfolio."
                        : "Market closed for trading."}
                </div>
            ) : !connected ? (
                <div className="wt-tx-state">Connect your wallet to trade.</div>
            ) : (
                <button
                    className={`wt-btn wt-btn-block ${side === "BUY" ? "wt-btn-yes" : "wt-btn-no"}`}
                    disabled={busy}
                    onClick={submit}
                    style={{ marginTop: 6 }}
                >
                    {txState.kind === "signing"
                        ? "Sign in wallet…"
                        : txState.kind === "submitting"
                          ? "Submitting…"
                          : `${side === "BUY" ? "Buy" : "Sell"} ${outcomeName}`}
                </button>
            )}

            {(balance === null || (balance?.available ?? 0) === 0) && side === "BUY" && connected && (
                <DepositRow wallet={wallet} signTransaction={signTransaction} onDone={onDone} />
            )}

            {txState.kind === "confirmed" && (
                <div className="wt-tx-state">
                    ✓ {txState.msg}
                    {txState.sigs.map((s, i) => (
                        <div key={s}>
                            <a href={EXPLORER(s)} target="_blank" rel="noreferrer">
                                Fill {i + 1} on Explorer ↗
                            </a>
                        </div>
                    ))}
                </div>
            )}
            {txState.kind === "error" && <div className="wt-error">{txState.msg}</div>}

            <p className="wt-fineprint">Devnet SOL has no real-money value.</p>
        </div>
    );
}

function Row({ k, v }: { k: string; v: string }) {
    return (
        <div className="wt-readout-row">
            <span className="k">{k}</span>
            <span className="v">{v}</span>
        </div>
    );
}

function DepositRow({
    wallet,
    signTransaction,
    onDone,
}: {
    wallet: string | null;
    signTransaction: ReturnType<typeof useWallet>["signTransaction"];
    onDone: () => void;
}) {
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    return (
        <div style={{ marginTop: 10 }}>
            <button
                className="wt-btn wt-btn-block"
                disabled={busy || !wallet || !signTransaction}
                onClick={async () => {
                    if (!wallet || !signTransaction) return;
                    setBusy(true);
                    setErr(null);
                    try {
                        await depositCollateral(wallet, 0.05 * LAMPORTS_PER_SOL, signTransaction);
                        onDone();
                    } catch (e) {
                        setErr(e instanceof Error ? e.message : "deposit_failed");
                    } finally {
                        setBusy(false);
                    }
                }}
            >
                {busy ? "Depositing…" : "Deposit 0.05 ◎ to trade"}
            </button>
            {err && <div className="wt-error">{err}</div>}
        </div>
    );
}

const ORDER_ERRORS: Record<string, string> = {
    no_liquidity: "No matching liquidity available.",
    insufficient_balance: "Not enough collateral. Deposit more devnet SOL.",
    insufficient_shares: "You don't own that many shares.",
    invalid_price: "Price must be between 1% and 99%.",
    invalid_quantity: "Enter a valid share quantity.",
    duplicate_nonce: "Duplicate order — try again.",
    market_closed: "Market is closed.",
    market_not_open: "Market is not open for trading.",
    bad_signature: "Signature rejected.",
    order_expired: "Order expired before posting.",
};
