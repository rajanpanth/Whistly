"use client";

import { use } from "react";
import Link from "next/link";
import { useMarkets } from "@/lib/v2/hooks";
import { bpsToPct, fmtSol } from "@/lib/v2/client";

/**
 * Event page — groups every V2 market that shares a fixtureId. The
 * eventId route param is the fixtureId (0 = ungrouped standalone markets).
 */
export default function EventPage({ params }: { params: Promise<{ eventId: string }> }) {
    const { eventId } = use(params);
    const fixtureId = Number(eventId);
    const { markets, loading } = useMarkets();

    const related = markets.filter((m) => m.fixtureId === fixtureId);

    if (loading && markets.length === 0) return <div className="wt-page wt-empty">Loading…</div>;
    if (related.length === 0) return <div className="wt-page wt-empty">No markets for this event.</div>;

    return (
        <div className="wt-page">
            <div className="wt-breadcrumb">
                <Link href="/markets">Markets</Link> › Event #{fixtureId}
            </div>
            <h1 className="wt-market-title" style={{ marginBottom: 18 }}>
                {related[0].title.split("—")[0].split("?")[0].trim()} · related markets
            </h1>

            <div className="wt-panel">
                <table className="wt-table">
                    <thead>
                        <tr>
                            <th>Market</th>
                            {related[0].outcomes.map((o, i) => (
                                <th key={i} className="wt-num-right">
                                    {o}
                                </th>
                            ))}
                            <th className="wt-num-right">Volume</th>
                        </tr>
                    </thead>
                    <tbody>
                        {related.map((m) => (
                            <tr key={m.address}>
                                <td>
                                    <Link href={`/market/${m.address}`} style={{ color: "var(--wt-text)" }}>
                                        {m.title}
                                    </Link>
                                </td>
                                {m.book.map((b, i) => (
                                    <td key={i} className="wt-num-right">
                                        {b.bestAsk !== null ? bpsToPct(b.bestAsk) : "—"}
                                    </td>
                                ))}
                                <td className="wt-num-right">◎ {fmtSol(m.volumeLamports, 2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
