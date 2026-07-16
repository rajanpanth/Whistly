"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMarkets, type MarketSummary } from "@/lib/v2/hooks";
import { bpsToPct, fmtSol } from "@/lib/v2/client";

const CATEGORIES = [
    "Trending",
    "Live",
    "Upcoming",
    "Ending Soon",
    "Most Active",
    "Highest Volume",
    "Recently Settled",
];

const STATUS_LABEL: Record<number, string> = {
    0: "Open",
    1: "Paused",
    2: "Closed",
    3: "Settled",
    4: "Void",
};

export default function MarketsPage() {
    const { markets, loading } = useMarkets();
    const params = useSearchParams();
    const q = (params.get("q") ?? "").toLowerCase();
    const [cat, setCat] = useState("Trending");

    const filtered = useMemo(() => {
        let list = markets.filter((m) => !q || m.title.toLowerCase().includes(q));
        const now = Date.now() / 1000;
        switch (cat) {
            case "Ending Soon":
                list = list
                    .filter((m) => m.status === 0 && m.closeTs > now)
                    .sort((a, b) => a.closeTs - b.closeTs);
                break;
            case "Highest Volume":
                list = [...list].sort((a, b) => b.volumeLamports - a.volumeLamports);
                break;
            case "Most Active":
                list = [...list].sort((a, b) => b.fillCount - a.fillCount);
                break;
            case "Recently Settled":
                list = list.filter((m) => m.status === 3 || m.status === 4);
                break;
            case "Upcoming":
                list = list.filter((m) => m.status === 0 && m.closeTs > now);
                break;
            default:
                list = [...list].sort((a, b) => b.createdAt - a.createdAt);
        }
        return list;
    }, [markets, q, cat]);

    return (
        <div className="wt-page">
            <h1 className="wt-market-title" style={{ marginBottom: 16 }}>
                Markets
            </h1>
            <div className="wt-pills">
                {CATEGORIES.map((c) => (
                    <button
                        key={c}
                        className={`wt-pill ${c === cat ? "active" : ""}`}
                        onClick={() => setCat(c)}
                    >
                        {c}
                    </button>
                ))}
            </div>

            {loading && markets.length === 0 ? (
                <div className="wt-empty">Loading markets…</div>
            ) : filtered.length === 0 ? (
                <div className="wt-empty">
                    No markets yet. Create one from the admin console.
                </div>
            ) : (
                <div className="wt-grid">
                    {filtered.map((m) => (
                        <MarketCard key={m.address} market={m} />
                    ))}
                </div>
            )}
        </div>
    );
}

function MarketCard({ market }: { market: MarketSummary }) {
    const closeIn = market.closeTs * 1000 - Date.now();
    const closeLabel =
        closeIn <= 0
            ? "Closed"
            : closeIn < 3.6e6
              ? `${Math.round(closeIn / 6e4)}m`
              : closeIn < 8.64e7
                ? `${Math.round(closeIn / 3.6e6)}h`
                : `${Math.round(closeIn / 8.64e7)}d`;

    return (
        <Link href={`/market/${market.address}`} className="wt-card">
            <div className="wt-card-head">
                <div className="wt-card-icon">◎</div>
                <div>
                    <div className="wt-card-title">{market.title}</div>
                    <span className={`wt-status-chip wt-status-${statusClass(market.status)}`}>
                        {STATUS_LABEL[market.status]}
                    </span>
                </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {market.book.slice(0, 3).map((b, i) => (
                    <div key={i} className="wt-outcome-row">
                        <span className="wt-outcome-name">{b.outcome}</span>
                        <div className="wt-outcome-btns">
                            <span className="wt-mini-btn wt-mini-yes">
                                {b.bestAsk !== null ? bpsToPct(b.bestAsk) : "—"}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
            <div className="wt-card-meta">
                <span>◎ {fmtSol(market.volumeLamports, 2)} vol</span>
                <span>{market.restingOrders} orders</span>
                <span>{closeLabel}</span>
            </div>
        </Link>
    );
}

function statusClass(status: number): string {
    if (status === 0) return "open";
    if (status === 3) return "settled";
    return "closed";
}
