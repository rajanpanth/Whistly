"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useActivity, useMarkets, type ActivityData } from "@/lib/v2/hooks";
import { bpsToPct1, fmtSol } from "@/lib/v2/client";

const EXPLORER = (signature: string) =>
    `https://explorer.solana.com/tx/${signature}?cluster=devnet`;

type ActivityFilter = "all" | "orders" | "trades" | "settlement";

const LABELS: Record<string, string> = {
    order_posted: "Order posted",
    order_cancelled: "Order cancelled",
    order_expired: "Order expired",
    fill: "Completed fill",
    partial_fill: "Partial fill",
    market_created: "Market created",
    market_settled: "Market settled",
    market_voided: "Market voided",
    redeemed: "Position redeemed",
};

export default function ActivityPage() {
    const params = useSearchParams();
    const { publicKey } = useWallet();
    const wallet = publicKey?.toBase58() ?? null;
    const [filter, setFilter] = useState<ActivityFilter>("all");
    const [mineOnly, setMineOnly] = useState(params.get("mine") === "1");
    const { activity, loading, error } = useActivity(
        mineOnly && wallet ? { wallet } : {},
        4_000
    );
    const { markets } = useMarkets();

    const marketByAddress = useMemo(
        () => new Map(markets.map((market) => [market.address, market])),
        [markets]
    );
    const visible = activity.filter((item) => matchesFilter(item, filter));

    return (
        <div className="wt-page">
            <div className="wt-page-heading">
                <div>
                    <p className="wt-eyebrow">Verifiable V2 events</p>
                    <h1 className="wt-market-title">Activity</h1>
                    <p className="wt-subtitle">
                        Signed orders, confirmed fills, cancellations, settlements, and redemptions.
                    </p>
                </div>
                <label className="wt-toggle">
                    <input
                        type="checkbox"
                        checked={mineOnly}
                        disabled={!wallet}
                        onChange={(event) => setMineOnly(event.target.checked)}
                    />
                    My wallet
                </label>
            </div>

            <div className="wt-pills" aria-label="Activity filters">
                {(["all", "orders", "trades", "settlement"] as ActivityFilter[]).map(
                    (item) => (
                        <button
                            key={item}
                            type="button"
                            className={`wt-pill ${filter === item ? "active" : ""}`}
                            onClick={() => setFilter(item)}
                        >
                            {item === "all" ? "All activity" : item[0].toUpperCase() + item.slice(1)}
                        </button>
                    )
                )}
            </div>

            <section className="wt-panel wt-activity-panel">
                {loading ? (
                    <div className="wt-empty">Loading real V2 activity…</div>
                ) : error ? (
                    <div className="wt-empty">Activity is unavailable: {error}</div>
                ) : visible.length === 0 ? (
                    <div className="wt-empty">No matching V2 activity yet.</div>
                ) : (
                    <div className="wt-activity-list">
                        {visible.map((item, index) => {
                            const market = item.market
                                ? marketByAddress.get(item.market)
                                : undefined;
                            const outcome =
                                market && item.outcomeIndex !== undefined
                                    ? market.outcomes[item.outcomeIndex]
                                    : item.outcomeIndex !== undefined
                                      ? `Outcome ${item.outcomeIndex}`
                                      : null;
                            return (
                                <article
                                    className="wt-activity-row"
                                    key={`${item.kind}-${item.createdAt}-${item.txSignature ?? index}`}
                                >
                                    <span className={`wt-activity-icon ${activityTone(item.kind)}`}>
                                        {activityGlyph(item.kind)}
                                    </span>
                                    <div className="wt-activity-copy">
                                        <div className="wt-activity-title">
                                            {LABELS[item.kind] ?? item.kind.replaceAll("_", " ")}
                                            {item.side && <span className={`wt-side ${item.side.toLowerCase()}`}>{item.side}</span>}
                                        </div>
                                        <div className="wt-activity-meta">
                                            {item.wallet && <span>{shortAddress(item.wallet)}</span>}
                                            {outcome && <span>{outcome}</span>}
                                            {item.quantity !== undefined && <span>{item.quantity} shares</span>}
                                            {item.priceBps !== undefined && <span>@ {bpsToPct1(item.priceBps)}</span>}
                                            {item.lamports !== undefined && <span>◎ {fmtSol(item.lamports)}</span>}
                                        </div>
                                        {market && item.market && (
                                            <Link className="wt-activity-market" href={`/market/${item.market}`}>
                                                {market.title}
                                            </Link>
                                        )}
                                    </div>
                                    <div className="wt-activity-time">
                                        <time dateTime={new Date(item.createdAt).toISOString()}>
                                            {formatTime(item.createdAt)}
                                        </time>
                                        {item.txSignature && (
                                            <a
                                                href={EXPLORER(item.txSignature)}
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                Explorer ↗
                                            </a>
                                        )}
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </section>

            <p className="wt-fineprint">
                Only confirmed fills include a transaction link. Devnet SOL has no real-money value.
            </p>
        </div>
    );
}

function matchesFilter(item: ActivityData, filter: ActivityFilter) {
    if (filter === "all") return true;
    if (filter === "orders") return item.kind.startsWith("order_");
    if (filter === "trades") return item.kind === "fill" || item.kind === "partial_fill";
    return ["market_created", "market_settled", "market_voided", "redeemed"].includes(
        item.kind
    );
}

function activityGlyph(kind: string) {
    if (kind.includes("cancel") || kind.includes("expired")) return "×";
    if (kind.includes("settled") || kind.includes("redeemed")) return "✓";
    if (kind.includes("fill")) return "↔";
    return "+";
}

function activityTone(kind: string) {
    if (kind.includes("cancel") || kind.includes("expired") || kind.includes("void")) return "no";
    if (kind.includes("fill") || kind.includes("redeemed")) return "yes";
    return "accent";
}

function shortAddress(value: string) {
    return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

function formatTime(timestamp: number) {
    const diff = Math.max(0, Date.now() - timestamp);
    if (diff < 60_000) return "just now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return new Date(timestamp).toLocaleDateString();
}
