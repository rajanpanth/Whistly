"use client";

import { useState } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useOrders, useMarkets } from "@/lib/v2/hooks";
import { bpsToPct1, fmtSol, cancelOrder } from "@/lib/v2/client";

const STATUS_COLOR: Record<string, string> = {
    open: "var(--wt-yes)",
    partially_filled: "var(--wt-accent)",
    filled: "var(--wt-text-dim)",
    cancelled: "var(--wt-text-faint)",
    expired: "var(--wt-text-faint)",
    rejected: "var(--wt-no)",
};

export default function OrdersPage() {
    const { publicKey, signMessage } = useWallet();
    const wallet = publicKey?.toBase58() ?? null;
    const { orders, refresh } = useOrders(wallet);
    const { markets } = useMarkets();
    const [busy, setBusy] = useState<string | null>(null);
    const [msg, setMsg] = useState<string | null>(null);

    if (!wallet) return <div className="wt-page wt-empty">Connect your wallet to view orders.</div>;

    const marketById = new Map(markets.map((m) => [m.address, m]));
    const open = orders.filter((o) => o.status === "open" || o.status === "partially_filled");
    const history = orders.filter((o) => o.status !== "open" && o.status !== "partially_filled");

    async function handleCancel(orderHash: string) {
        if (!wallet || !signMessage) return;
        setBusy(orderHash);
        setMsg(null);
        try {
            await cancelOrder(orderHash, wallet, signMessage);
            setMsg("Order cancelled.");
            refresh();
        } catch (e) {
            setMsg(e instanceof Error ? e.message : "cancel_failed");
        } finally {
            setBusy(null);
        }
    }

    const renderTable = (list: typeof orders, cancellable: boolean) => (
        <table className="wt-table">
            <thead>
                <tr>
                    <th>Market</th>
                    <th>Outcome</th>
                    <th>Side</th>
                    <th>Type</th>
                    <th className="wt-num-right">Price</th>
                    <th className="wt-num-right">Filled / Total</th>
                    <th className="wt-num-right">Locked</th>
                    <th>Status</th>
                    {cancellable && <th></th>}
                </tr>
            </thead>
            <tbody>
                {list.map((o) => {
                    const m = marketById.get(o.market);
                    return (
                        <tr key={o.orderHash}>
                            <td>
                                <Link href={`/market/${o.market}`} style={{ color: "var(--wt-text)" }}>
                                    {m ? m.title.slice(0, 34) : o.market.slice(0, 8)}
                                </Link>
                            </td>
                            <td>{m?.outcomes[o.outcomeIndex] ?? `#${o.outcomeIndex}`}</td>
                            <td>
                                <span className={`wt-tag ${o.side === "BUY" ? "wt-tag-buy" : "wt-tag-sell"}`}>
                                    {o.side}
                                </span>
                            </td>
                            <td>{o.orderType} · {o.tif}</td>
                            <td className="wt-num-right">{bpsToPct1(o.priceBps)}</td>
                            <td className="wt-num-right">
                                {o.filledQuantity} / {o.quantity}
                            </td>
                            <td className="wt-num-right">
                                {o.side === "BUY" ? `◎ ${fmtSol(o.lockedAmount)}` : `${o.lockedAmount} sh`}
                            </td>
                            <td style={{ color: STATUS_COLOR[o.status] }}>{o.status.replace("_", " ")}</td>
                            {cancellable && (
                                <td className="wt-num-right">
                                    <button
                                        className="wt-btn"
                                        style={{ padding: "6px 12px" }}
                                        disabled={busy === o.orderHash}
                                        onClick={() => handleCancel(o.orderHash)}
                                    >
                                        {busy === o.orderHash ? "…" : "Cancel"}
                                    </button>
                                </td>
                            )}
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );

    return (
        <div className="wt-page">
            <h1 className="wt-market-title" style={{ marginBottom: 18 }}>
                Open orders
            </h1>
            {msg && <div className="wt-panel" style={{ color: "var(--wt-accent)" }}>{msg}</div>}

            <div className="wt-panel">
                <p className="wt-panel-title">Open</p>
                {open.length === 0 ? (
                    <div className="wt-empty">No open orders.</div>
                ) : (
                    renderTable(open, true)
                )}
            </div>

            <div className="wt-panel">
                <p className="wt-panel-title">History</p>
                {history.length === 0 ? (
                    <div className="wt-empty">No past orders.</div>
                ) : (
                    renderTable(history, false)
                )}
            </div>
        </div>
    );
}
