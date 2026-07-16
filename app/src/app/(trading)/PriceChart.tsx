"use client";

import { useState } from "react";
import { usePriceHistory } from "@/lib/v2/hooks";
import { bpsToPct1 } from "@/lib/v2/client";

const RANGES = ["1h", "6h", "1d", "1w", "all"];

/**
 * Real price history — plots ONLY executed fills (each a devnet tx). If no
 * fills exist it shows an honest empty state; it never draws a simulated line.
 */
export default function PriceChart({ market, outcome }: { market: string; outcome: number }) {
    const [range, setRange] = useState("all");
    const { points, loading } = usePriceHistory(market, outcome, range);

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <p className="wt-panel-title" style={{ margin: 0 }}>
                    Price history
                </p>
                <div className="wt-range-tabs">
                    {RANGES.map((r) => (
                        <button
                            key={r}
                            className={r === range ? "active" : ""}
                            onClick={() => setRange(r)}
                        >
                            {r.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            {loading && points.length === 0 ? (
                <div className="wt-empty">Loading…</div>
            ) : points.length === 0 ? (
                <div className="wt-empty">No completed trades yet.</div>
            ) : (
                <Sparkline points={points} />
            )}
        </div>
    );
}

function Sparkline({ points }: { points: { t: number; priceBps: number }[] }) {
    const W = 720;
    const H = 200;
    const pad = 8;
    const xs = points.map((p) => p.t);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const spanX = maxX - minX || 1;
    // Probability axis fixed 0-100% for honest scale.
    const x = (t: number) => pad + ((t - minX) / spanX) * (W - 2 * pad);
    const y = (bps: number) => pad + (1 - bps / 10000) * (H - 2 * pad);

    const path = points
        .map((p, i) => `${i === 0 ? "M" : "L"}${x(p.t).toFixed(1)},${y(p.priceBps).toFixed(1)}`)
        .join(" ");
    const last = points[points.length - 1];

    return (
        <div>
            <div className="wt-primary-prob">
                <span className="big wt-tabular">{bpsToPct1(last.priceBps)}</span>
                <span style={{ color: "var(--wt-text-dim)", fontSize: 13 }}>
                    last trade · {points.length} fill{points.length === 1 ? "" : "s"}
                </span>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none">
                {[0, 25, 50, 75, 100].map((pct) => (
                    <line
                        key={pct}
                        x1={pad}
                        x2={W - pad}
                        y1={y(pct * 100)}
                        y2={y(pct * 100)}
                        stroke="var(--wt-border)"
                        strokeWidth="1"
                    />
                ))}
                <path d={path} fill="none" stroke="var(--wt-yes)" strokeWidth="2" />
                {points.map((p) => (
                    <circle key={p.t} cx={x(p.t)} cy={y(p.priceBps)} r="2.5" fill="var(--wt-yes)" />
                ))}
            </svg>
        </div>
    );
}
