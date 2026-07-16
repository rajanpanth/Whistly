"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { fanFetch, formatFanClock } from "@/lib/fan/client";
import type { TxLineReplayPoint } from "@/lib/txline/client";
import type { TxLineFixture } from "@/lib/txline/mock";

export default function MatchdayReplayPage() {
    const [fixtureId, setFixtureId] = useState("");
    const [loadedId, setLoadedId] = useState("");
    const [points, setPoints] = useState<TxLineReplayPoint[]>([]);
    const [position, setPosition] = useState(0);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [available, setAvailable] = useState<TxLineFixture[]>([]);
    const current = points[position] ?? null;
    const goals = useMemo(() => points.filter((point) => point.isGoal), [points]);

    useEffect(() => {
        fetch("/api/fan/replay/fixtures", { cache: "no-store" })
            .then(async (response) => response.ok ? response.json() : Promise.reject(new Error("replay_catalog_unavailable")))
            .then((result: { fixtures: TxLineFixture[] }) => setAvailable(result.fixtures))
            .catch(() => setAvailable([]));
    }, []);

    async function load(event: FormEvent) {
        event.preventDefault();
        const value = fixtureId.trim();
        if (!value) return;
        setBusy(true); setError(null);
        try {
            const result = await fanFetch<{ fixtureId: string; points: TxLineReplayPoint[]; source: "txline" }>(`/api/fan/replay/${encodeURIComponent(value)}`);
            setLoadedId(result.fixtureId); setPoints(result.points); setPosition(Math.max(0, result.points.length - 1));
            if (!result.points.length) setError("TxLINE has no historical score packets for this fixture yet.");
        } catch (cause) { setError(cause instanceof Error ? cause.message : "replay_failed"); setPoints([]); }
        finally { setBusy(false); }
    }

    return <main className="fan-page fan-replay-page">
        <section className="fan-replay-hero"><div><p className="fan-kicker">Provider-backed demo mode</p><h1>Replay a real match</h1><p>Load the full historical score sequence directly from TxLINE. Scrub through updates, goals and the match clock without substituting generated events.</p></div><div className="fan-replay-badge"><span>DATA SOURCE</span><strong>TxLINE Historical</strong><small>No mock fallback</small></div></section>
        <form className="fan-replay-form" onSubmit={load}><label htmlFor="replay-fixture">TxLINE fixture ID</label><div><input id="replay-fixture" inputMode="numeric" placeholder="Enter a completed fixture ID" value={fixtureId} onChange={(event) => setFixtureId(event.target.value)} /><button className="fan-primary-button" disabled={busy || !fixtureId.trim()} type="submit">{busy ? "Loading history…" : "Load replay"}</button></div>{available.length > 0 && <div className="fan-replay-picks"><span>Recent real fixtures</span>{available.slice(0, 8).map((fixture) => <button type="button" key={fixture.fixtureId} onClick={() => setFixtureId(fixture.fixtureId)}><b>{fixture.homeTeam} vs {fixture.awayTeam}</b><small>{fixture.competition} · {fixture.fixtureId}</small></button>)}</div>}<small>Choose a recent fixture or use an ID supplied by TxLINE.</small></form>
        {error && <div className="fan-message" role="status">{error}</div>}
        {current && <div className="fan-replay-grid"><section className="fan-replay-stage"><header><span><i /> RECORDED FEED</span><b>Fixture {loadedId}</b></header><div className="fan-replay-score"><div><small>HOME</small><strong>{current.homeScore}</strong></div><span>{formatFanClock(current.clockSeconds)}</span><div><small>AWAY</small><strong>{current.awayScore}</strong></div></div><div className="fan-replay-slider"><input aria-label="Replay position" type="range" min={0} max={Math.max(0, points.length - 1)} value={position} onChange={(event) => setPosition(Number(event.target.value))} /><div><span>Packet 1</span><b>{position + 1} / {points.length}</b><span>Latest</span></div></div><footer><span>{current.action}</span><b>{new Date(current.updatedAt).toLocaleString()}</b></footer></section><aside className="fan-panel"><div className="fan-section-title"><div><p>GOAL MOMENTS</p><h2>Recorded timeline</h2></div><span>{goals.length}</span></div>{goals.length ? <div className="fan-timeline">{goals.map((goal) => <button type="button" key={goal.sequence} onClick={() => setPosition(points.findIndex((point) => point.sequence === goal.sequence))}><span>{formatFanClock(goal.clockSeconds)}</span><i>⚽</i><p><strong>Goal update</strong><small>{goal.homeScore}–{goal.awayScore}</small></p></button>)}</div> : <div className="fan-empty-small">No goal transition appears in the returned packets.</div>}</aside></div>}
        <section className="fan-scoring-note fan-replay-note"><strong>Why replay exists</strong><p>Judges and fans can inspect the live-companion experience between matches. Replay is visibly separate from live mode and consumes TxLINE’s documented historical endpoint; it cannot create or settle live predictions.</p></section>
    </main>;
}
