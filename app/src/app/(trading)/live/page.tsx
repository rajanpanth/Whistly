"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMarkets, type MarketSummary } from "@/lib/v2/hooks";
import { bpsToPct1, fmtSol } from "@/lib/v2/client";

type Fixture = {
    fixtureId: string;
    homeTeam: string;
    awayTeam: string;
    competition: string;
    status: "LIVE" | "SCHEDULED" | "FINISHED";
    clockSeconds: number;
    homeScore: number;
    awayScore: number;
    startTimeMs?: number;
    updatedAt: string;
};

type TxLineStatus = {
    status: "connected" | "not_configured" | "error" | "mock";
    connected: boolean;
    configured: boolean;
    mockModeEnabled: boolean;
    settlementEnabled: boolean;
    note: string;
};

const WINDOWS = [5, 15, 45] as const;

export default function LivePage() {
    const { markets, loading: marketsLoading } = useMarkets(4_000);
    const [fixtures, setFixtures] = useState<Fixture[]>([]);
    const [status, setStatus] = useState<TxLineStatus | null>(null);
    const [fixturesError, setFixturesError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const [statusResponse, fixtureResponse] = await Promise.all([
                    fetch("/api/txline/status", { cache: "no-store" }),
                    fetch("/api/txline/fixtures", { cache: "no-store" }),
                ]);
                const statusJson = (await statusResponse.json()) as TxLineStatus;
                const fixtureJson = await fixtureResponse.json();
                if (cancelled) return;
                setStatus(statusJson);
                if (!fixtureResponse.ok) {
                    setFixtures([]);
                    setFixturesError(fixtureJson.message ?? fixtureJson.error ?? "fixtures_unavailable");
                } else {
                    setFixtures(Array.isArray(fixtureJson.fixtures) ? fixtureJson.fixtures : []);
                    setFixturesError(null);
                }
            } catch (error) {
                if (!cancelled) {
                    setFixturesError(error instanceof Error ? error.message : "fixtures_unavailable");
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        const refresh = window.setInterval(load, 30_000);
        const clock = window.setInterval(() => setNow(Date.now()), 1_000);
        return () => {
            cancelled = true;
            window.clearInterval(refresh);
            window.clearInterval(clock);
        };
    }, []);

    const orderedFixtures = useMemo(
        () =>
            [...fixtures].sort((a, b) => {
                const rank = { LIVE: 0, SCHEDULED: 1, FINISHED: 2 };
                return rank[a.status] - rank[b.status] || (a.startTimeMs ?? 0) - (b.startTimeMs ?? 0);
            }),
        [fixtures]
    );

    return (
        <div className="wt-page">
            <div className="wt-page-heading">
                <div>
                    <p className="wt-eyebrow">World Cup · live score markets</p>
                    <h1 className="wt-market-title">Live trading</h1>
                    <p className="wt-subtitle">
                        Trade V2 outcome shares against signed orders. Goal windows open only while a fixture is live.
                    </p>
                </div>
                <TxLineBadge status={status} />
            </div>

            {status && !status.connected && (
                <div className={`wt-data-notice ${status.mockModeEnabled ? "mock" : "blocked"}`}>
                    <strong>{status.mockModeEnabled ? "Mock Mode Enabled" : status.configured ? "TxLINE Error" : "TxLINE Not Configured"}</strong>
                    <span>{status.note}</span>
                    {!status.mockModeEnabled && (
                        <span>Live-window creation and automated settlement remain blocked (fail closed).</span>
                    )}
                </div>
            )}

            {loading || marketsLoading ? (
                <div className="wt-empty">Loading fixtures and on-chain V2 markets…</div>
            ) : fixturesError ? (
                <div className="wt-panel wt-empty">
                    <strong>Fixture feed unavailable.</strong>
                    <span>{fixturesError}</span>
                    <span>No fallback market data has been substituted.</span>
                </div>
            ) : orderedFixtures.length === 0 ? (
                <div className="wt-panel wt-empty">No TxLINE fixtures are available.</div>
            ) : (
                <div className="wt-live-stack">
                    {orderedFixtures.map((fixture) => (
                        <FixtureCard
                            key={fixture.fixtureId}
                            fixture={fixture}
                            markets={markets}
                            now={now}
                            settlementEnabled={Boolean(status?.settlementEnabled)}
                        />
                    ))}
                </div>
            )}

            <p className="wt-fineprint">
                Markets resolve from TxLINE score data, never majority vote. Devnet SOL has no real-money value.
            </p>
        </div>
    );
}

function FixtureCard({
    fixture,
    markets,
    now,
    settlementEnabled,
}: {
    fixture: Fixture;
    markets: MarketSummary[];
    now: number;
    settlementEnabled: boolean;
}) {
    const numericFixtureId = parseFixtureId(fixture.fixtureId);
    const related = numericFixtureId === null
        ? []
        : markets.filter((market) => market.fixtureId === numericFixtureId);
    const windows = related.filter((market) => market.marketType === 1);
    const isLive = fixture.status === "LIVE";
    const eventHref = numericFixtureId === null ? "/markets" : `/event/${numericFixtureId}`;

    return (
        <section className={`wt-live-card ${isLive ? "is-live" : ""}`}>
            <header className="wt-fixture-head">
                <div>
                    <div className="wt-fixture-competition">{fixture.competition}</div>
                    <div className="wt-fixture-teams">
                        <span>{fixture.homeTeam}</span>
                        <strong>{isLive || fixture.status === "FINISHED" ? `${fixture.homeScore} – ${fixture.awayScore}` : "vs"}</strong>
                        <span>{fixture.awayTeam}</span>
                    </div>
                    <div className="wt-fixture-status">
                        {isLive ? (
                            <><span className="wt-live-dot" /> LIVE · {formatClock(fixture.clockSeconds)}</>
                        ) : fixture.status === "SCHEDULED" ? (
                            fixture.startTimeMs
                                ? `${new Date(fixture.startTimeMs).toLocaleString()} · ${formatCountdown(fixture.startTimeMs - now)}`
                                : "Kickoff scheduled"
                        ) : (
                            "Final"
                        )}
                    </div>
                </div>
                {related.length > 0 && (
                    <Link className="wt-btn" href={eventHref}>View event</Link>
                )}
            </header>

            {!isLive ? (
                <div className="wt-goal-window-closed">
                    {fixture.status === "SCHEDULED"
                        ? "Goal windows open when the match goes live. No active live-window trade ticket is shown before kickoff."
                        : "This fixture is final. New live goal windows are closed."}
                </div>
            ) : !settlementEnabled ? (
                <div className="wt-goal-window-closed danger">
                    TxLINE verification is unavailable. Live-window creation and settlement are blocked.
                </div>
            ) : (
                <div className="wt-window-grid">
                    {WINDOWS.map((minutes) => {
                        const market = findWindow(windows, minutes);
                        return (
                            <WindowCard
                                key={minutes}
                                minutes={minutes}
                                market={market}
                            />
                        );
                    })}
                </div>
            )}

            {related.filter((market) => market.marketType !== 1).length > 0 && (
                <div className="wt-related-lines">
                    <div className="wt-panel-title">Related event markets</div>
                    {related
                        .filter((market) => market.marketType !== 1)
                        .slice(0, 4)
                        .map((market) => (
                            <MarketLine key={market.address} market={market} />
                        ))}
                </div>
            )}
        </section>
    );
}

function WindowCard({ minutes, market }: { minutes: number; market?: MarketSummary }) {
    if (!market) {
        return (
            <div className="wt-window-card empty">
                <div className="wt-window-minutes">{minutes}m</div>
                <strong>Awaiting signed V2 window</strong>
                <span>No window has been opened for this duration. No synthetic price is shown.</span>
            </div>
        );
    }
    const yesIndex = Math.max(0, market.outcomes.findIndex((outcome) => outcome.toUpperCase() === "YES"));
    const noIndex = Math.max(0, market.outcomes.findIndex((outcome) => outcome.toUpperCase() === "NO"));
    return (
        <Link className="wt-window-card" href={`/market/${market.address}`}>
            <div className="wt-window-card-top">
                <span className="wt-window-minutes">{minutes}m</span>
                <span className={`wt-status-dot status-${market.status}`}>{marketStatus(market.status)}</span>
            </div>
            <strong>Goal in the next {minutes} minutes?</strong>
            <div className="wt-window-prices">
                <span className="yes">YES {bpsToPct1(market.book[yesIndex]?.bestAsk)}</span>
                <span className="no">NO {bpsToPct1(market.book[noIndex]?.bestAsk)}</span>
            </div>
            <div className="wt-window-meta">
                <span>◎ {fmtSol(market.volumeLamports)} volume</span>
                <span>{market.restingOrders} open orders</span>
            </div>
        </Link>
    );
}

function MarketLine({ market }: { market: MarketSummary }) {
    return (
        <Link className="wt-related-line" href={`/market/${market.address}`}>
            <span>{market.title}</span>
            <div>
                {market.outcomes.slice(0, 3).map((outcome, index) => (
                    <b key={outcome}>{outcome} {bpsToPct1(market.book[index]?.bestAsk)}</b>
                ))}
            </div>
        </Link>
    );
}

function TxLineBadge({ status }: { status: TxLineStatus | null }) {
    const label = !status
        ? "Checking TxLINE…"
        : status.connected
          ? "TxLINE Connected"
          : status.mockModeEnabled
            ? "Mock Mode Enabled"
            : status.configured
              ? "TxLINE Error"
              : "TxLINE Not Configured";
    const tone = !status ? "checking" : status.connected ? "connected" : status.mockModeEnabled ? "mock" : "error";
    return <span className={`wt-source-badge ${tone}`}><i />{label}</span>;
}

function parseFixtureId(value: string) {
    if (!/^\d+$/.test(value)) return null;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
}

function findWindow(markets: MarketSummary[], minutes: number) {
    const pattern = new RegExp(`(?:next\\s+)?${minutes}\\s*(?:m|min|minute)`, "i");
    return markets.find((market) => pattern.test(market.title));
}

function formatClock(seconds: number) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function formatCountdown(milliseconds: number) {
    if (milliseconds <= 0) return "kickoff pending";
    const totalMinutes = Math.floor(milliseconds / 60_000);
    const days = Math.floor(totalMinutes / 1_440);
    const hours = Math.floor((totalMinutes % 1_440) / 60);
    const minutes = totalMinutes % 60;
    return days > 0 ? `in ${days}d ${hours}h` : `in ${hours}h ${minutes}m`;
}

function marketStatus(status: number) {
    return ["Open", "Paused", "Closed", "Settled", "Void"][status] ?? "Unknown";
}
