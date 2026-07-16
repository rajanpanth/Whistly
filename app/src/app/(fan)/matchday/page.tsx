"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useFanFixtures } from "@/lib/fan/hooks";
import { formatFanClock } from "@/lib/fan/client";

export default function MatchdayPage() {
    const { fixtures, source, loading, error } = useFanFixtures();
    const [query, setQuery] = useState("");
    const [filter, setFilter] = useState<"ALL" | "LIVE" | "SCHEDULED" | "FINISHED">("ALL");
    const visible = useMemo(() => fixtures.filter((fixture) => {
        const match = `${fixture.homeTeam} ${fixture.awayTeam} ${fixture.competition} ${fixture.fixtureId}`.toLowerCase();
        return (filter === "ALL" || fixture.status === filter) && match.includes(query.toLowerCase());
    }), [fixtures, filter, query]);

    return <main className="fan-page">
        <section className="fan-hero">
            <div><p className="fan-kicker">The match is better together</p><h1>Predict every <em>moment.</em></h1><p>Make free live picks, build a streak and climb your friends’ leaderboard as the World Cup unfolds.</p></div>
            <div className="fan-hero-score"><span>YOUR MATCHDAY</span><strong>0</strong><small>points waiting</small></div>
        </section>

        <section className="fan-toolbar">
            <label><span className="sr-only">Search matches</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search teams or fixtures" /></label>
            <div className="fan-filter-tabs">{(["ALL","LIVE","SCHEDULED","FINISHED"] as const).map((item) => <button key={item} type="button" className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item === "ALL" ? "All matches" : item[0] + item.slice(1).toLowerCase()}</button>)}</div>
            <span className={`fan-source ${source === "txline" ? "connected" : source === "mock" ? "mock" : ""}`}><i />{source === "txline" ? "TxLINE Connected" : source === "mock" ? "Mock Mode Enabled" : "Checking TxLINE"}</span>
        </section>

        {loading ? <div className="fan-state"><span className="fan-loader" />Loading World Cup fixtures…</div> : error ? <div className="fan-state error"><strong>Live fixtures are unavailable.</strong><span>{error}</span><small>No fallback data has been substituted.</small></div> : visible.length === 0 ? <div className="fan-state">No matches match this view.</div> : <section className="fan-fixture-grid">
            {visible.map((fixture) => <Link href={`/matchday/${encodeURIComponent(fixture.fixtureId)}`} className={`fan-fixture-card ${fixture.status.toLowerCase()}`} key={fixture.fixtureId}>
                <header><span>{fixture.competition}</span><b>{fixture.status === "LIVE" ? <><i /> LIVE</> : fixture.status === "FINISHED" ? "FULL TIME" : fixture.status === "SCHEDULED" ? "UPCOMING" : fixture.status}</b></header>
                <div className="fan-teams"><div><i>{initials(fixture.homeTeam)}</i><strong>{fixture.homeTeam}</strong></div><span>{["LIVE", "FINISHED"].includes(fixture.status) ? `${fixture.homeScore} : ${fixture.awayScore}` : "VS"}</span><div><i>{initials(fixture.awayTeam)}</i><strong>{fixture.awayTeam}</strong></div></div>
                <footer><span>{fixture.status === "LIVE" ? formatFanClock(fixture.clockSeconds) : fixture.startTimeMs ? new Date(fixture.startTimeMs).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Kickoff pending"}</span><b>{fixture.status === "FINISHED" ? "View recap" : fixture.status === "LIVE" ? "Play live →" : "Open match →"}</b></footer>
            </Link>)}
        </section>}
        <section className="fan-how"><div><span>01</span><strong>Pick a moment</strong><p>One tap. No deposits and no trading jargon.</p></div><div><span>02</span><strong>Follow it live</strong><p>TxLINE score data locks and resolves every challenge.</p></div><div><span>03</span><strong>Beat your friends</strong><p>Build streaks and rise through private room leaderboards.</p></div></section>
    </main>;
}

function initials(name: string) { return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
