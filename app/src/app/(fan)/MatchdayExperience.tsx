"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { fanFetch, formatFanClock } from "@/lib/fan/client";
import { useFanFixture, useFanPredictions, useFanReactions, useFanRoom, useFanSession } from "@/lib/fan/hooks";
import type { FanChallenge, FanOutcome } from "@/lib/fan/types";

export default function MatchdayExperience({ fixtureId, roomId }: { fixtureId: string; roomId?: string }) {
    const session = useFanSession();
    const { fixture, challenges, loading, error, refresh, storage } = useFanFixture(fixtureId);
    const predictionState = useFanPredictions(session.wallet, fixtureId, session.authenticated);
    const roomState = useFanRoom(roomId ?? null);
    const reactions = useFanReactions(fixtureId);
    const [busyChallenge, setBusyChallenge] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [roomOpen, setRoomOpen] = useState(false);
    const [roomName, setRoomName] = useState("My Matchday Room");
    const [displayName, setDisplayName] = useState("");

    const predictionByChallenge = useMemo(() => new Map(predictionState.predictions.map((item) => [item.challengeId, item])), [predictionState.predictions]);
    const openChallenges = challenges.filter((item) => item.status === "OPEN").sort((a, b) => a.endTs - b.endTs);
    const completed = challenges.filter((item) => ["RESOLVED","VOID","CANCELLED"].includes(item.status)).sort((a, b) => b.endTs - a.endTs);

    async function predict(challenge: FanChallenge, outcome: FanOutcome) {
        setMessage(null);
        if (!session.authenticated) { await session.signIn(); return; }
        setBusyChallenge(challenge.id);
        try {
            await fanFetch("/api/fan/predictions", { method: "POST", body: JSON.stringify({ challengeId: challenge.id, selectedOutcome: outcome }) });
            setMessage("Prediction locked. Follow the match to see your result.");
            await predictionState.refresh();
        } catch (cause) { setMessage(cause instanceof Error ? cause.message : "prediction_failed"); }
        finally { setBusyChallenge(null); }
    }

    async function createRoom() {
        if (!session.authenticated) { await session.signIn(); return; }
        try {
            const result = await fanFetch<{ room: { id: string } }>("/api/fan/rooms", { method: "POST", body: JSON.stringify({ fixtureId, name: roomName, displayName: displayName || `Fan ${session.wallet?.slice(0,4)}` }) });
            window.location.href = `/rooms/${result.room.id}`;
        } catch (cause) { setMessage(cause instanceof Error ? cause.message : "room_create_failed"); }
    }

    async function react(reactionType: string) {
        if (!session.authenticated) { await session.signIn(); return; }
        try { await fanFetch("/api/fan/reactions", { method: "POST", body: JSON.stringify({ fixtureId, reactionType }) }); await reactions.refresh(); }
        catch (cause) { setMessage(cause instanceof Error ? cause.message : "reaction_failed"); }
    }

    if (loading) return <main className="fan-page"><div className="fan-state"><span className="fan-loader" />Opening the match…</div></main>;
    if (error || !fixture) return <main className="fan-page"><div className="fan-state error"><strong>Match unavailable</strong><span>{error ?? "fixture_not_found"}</span></div></main>;

    const board = roomId ? roomState.leaderboard : [];
    const ownScore = board.find((item) => item.wallet === session.wallet);
    return <main className="fan-page fan-match-page">
        <div className="fan-breadcrumb"><Link href="/matchday">Matches</Link><span>›</span>{fixture.competition}</div>
        <section className={`fan-scoreboard ${fixture.status.toLowerCase()}`}>
            <div className="fan-score-status"><span>{fixture.status === "LIVE" ? "LIVE NOW" : fixture.status === "FINISHED" ? "FULL TIME" : fixture.status === "SCHEDULED" ? "UPCOMING" : fixture.status}</span><b>{fixture.status === "LIVE" ? formatFanClock(fixture.clockSeconds) : fixture.startTimeMs ? new Date(fixture.startTimeMs).toLocaleString() : "Kickoff pending"}</b></div>
            <div className="fan-score-main"><div><i>{initials(fixture.homeTeam)}</i><strong>{fixture.homeTeam}</strong></div><span>{["LIVE", "FINISHED"].includes(fixture.status) ? `${fixture.homeScore} – ${fixture.awayScore}` : "VS"}</span><div><i>{initials(fixture.awayTeam)}</i><strong>{fixture.awayTeam}</strong></div></div>
            <div className="fan-feed-state"><i className={fixture.stale ? "stale" : ""} />{fixture.source === "txline" ? "Live via TxLINE" : fixture.source === "mock" ? "Mock Mode Enabled" : fixture.source}{storage === "memory" && <b> · Local room data</b>}<span>Updated {new Date(fixture.updatedAt).toLocaleTimeString()}</span></div>
        </section>

        <div className="fan-match-grid"><div className="fan-match-main">
            {message && <div className="fan-message" role="status">{message}</div>}
            {fixture.status === "SCHEDULED" ? <section className="fan-panel fan-prekick"><span>⏳</span><h2>Predictions open when the match goes live</h2><p>Come back at kickoff. Whistly will create 5, 15 and 45-minute goal challenges from the real score feed.</p></section> : ["POSTPONED", "ABANDONED", "CANCELLED"].includes(fixture.status) ? <section className="fan-panel fan-prekick danger"><span>!</span><h2>Match {fixture.status.toLowerCase()}</h2><p>All open challenges are void. No points or streaks are affected.</p></section> : fixture.stale ? <section className="fan-panel fan-prekick danger"><span>!</span><h2>Live feed is stale</h2><p>New predictions and automated resolution are paused until fresh TxLINE data arrives.</p></section> : fixture.status === "FINISHED" && openChallenges.length === 0 ? <section className="fan-panel fan-prekick"><span>✓</span><h2>That’s full time</h2><p>The live game has ended. Review your resolved picks and Matchday recap.</p><Link className="fan-primary-link" href={`/recap/${fixtureId}${roomId ? `?roomId=${roomId}` : ""}`}>Open my recap</Link></section> : null}

            {openChallenges.length > 0 && <section className="fan-active-section"><div className="fan-section-title"><div><p>YOUR NEXT MOMENT</p><h2>Make your pick</h2></div><span>{openChallenges.length} live challenge{openChallenges.length === 1 ? "" : "s"}</span></div><div className="fan-challenge-stack">{openChallenges.map((challenge, index) => <ChallengeCard key={challenge.id} challenge={challenge} prediction={predictionByChallenge.get(challenge.id)} primary={index === 0} busy={busyChallenge === challenge.id} onPick={predict} />)}</div></section>}

            <section className="fan-panel"><div className="fan-section-title"><div><p>MATCH PULSE</p><h2>Live timeline</h2></div></div>{fixture.events.length ? <div className="fan-timeline">{fixture.events.map((event) => <div key={event.id}><span>{formatFanClock(event.clockSeconds)}</span><i>⚽</i><p><strong>Goal · {event.team}</strong><small>{event.scoreAfter}</small></p></div>)}</div> : <div className="fan-empty-small">No supported match events have been reported yet. The score feed remains active.</div>}</section>

            {completed.length > 0 && <section className="fan-panel"><div className="fan-section-title"><div><p>YOUR PICKS</p><h2>Prediction history</h2></div></div><div className="fan-history">{completed.map((challenge) => { const prediction = predictionByChallenge.get(challenge.id); return <div key={challenge.id}><span>{challenge.durationMinutes}m goal window</span><b>{prediction ? prediction.selectedOutcome ? "YES" : "NO" : "No pick"}</b><em className={prediction?.correct ? "correct" : prediction?.correct === false ? "wrong" : ""}>{prediction?.correct ? `+${prediction.awardedPoints} pts` : prediction?.correct === false ? "Incorrect" : challenge.status}</em></div>; })}</div></section>}
        </div><aside className="fan-match-aside">
            <section className="fan-player-card"><p>YOUR MATCHDAY</p><div><strong>{ownScore?.totalPoints ?? 0}</strong><span>points</span></div><footer><span>🔥 {ownScore?.currentStreak ?? 0} streak</span><span>✓ {ownScore?.correctPredictions ?? 0} correct</span></footer></section>
            <section className="fan-panel fan-room-panel"><div className="fan-section-title"><div><p>FRIEND ROOM</p><h2>{roomState.room?.name ?? "Play together"}</h2></div></div>{roomId ? board.length ? <ol className="fan-leaderboard">{board.slice(0, 8).map((score, index) => <li key={score.wallet} className={score.wallet === session.wallet ? "you" : ""}><b>#{index + 1}</b><span>{score.displayName}<small>{score.correctPredictions}/{score.totalPredictions} correct</small></span><strong>{score.totalPoints}</strong></li>)}</ol> : <div className="fan-empty-small">No scores yet. Invite friends and make the first pick.</div> : <><p className="fan-room-copy">Create a private room for this match and challenge your group chat.</p><button className="fan-secondary-button" type="button" onClick={() => setRoomOpen((open) => !open)}>Create friend room</button>{roomOpen && <div className="fan-room-form"><input aria-label="Room name" value={roomName} onChange={(event) => setRoomName(event.target.value)} /><input aria-label="Your display name" placeholder="Your display name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} /><button type="button" onClick={createRoom}>Create and invite</button></div>}</>}</section>
            <section className="fan-panel"><div className="fan-section-title"><div><p>STADIUM REACTIONS</p><h2>How are you feeling?</h2></div></div><div className="fan-reactions">{[["GOAL","🙌","Celebrate"],["SHOCK","😮","Shocked"],["APPLAUSE","👏","Applaud"],["FRUSTRATION","😤","Frustrated"],["SUPPORT","📣","Support"]].map(([type,emoji,label]) => <button aria-label={label} key={type} type="button" onClick={() => react(type)}><span>{emoji}</span><b>{reactions.counts[type] ?? 0}</b></button>)}</div></section>
            <section className="fan-scoring-note"><strong>How points work</strong><p>Correct picks earn 100 points. Consecutive correct answers increase your multiplier up to 1.5×. Voided challenges never break a streak.</p></section>
        </aside></div>
    </main>;
}

function ChallengeCard({ challenge, prediction, primary, busy, onPick }: { challenge: FanChallenge; prediction?: { selectedOutcome: FanOutcome }; primary: boolean; busy: boolean; onPick: (challenge: FanChallenge, outcome: FanOutcome) => void }) {
    const seconds = Math.max(0, Math.ceil((challenge.endTs - Date.now()) / 1000));
    return <article className={`fan-challenge ${primary ? "primary" : ""}`}><header><span>{challenge.durationMinutes} MINUTE CHALLENGE</span><b>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2,"0")} left</b></header><h3>Will there be a goal in the next {challenge.durationMinutes} minutes?</h3><p>Started at {challenge.startHomeScore}–{challenge.startAwayScore}. Your answer locks immediately.</p>{prediction ? <div className="fan-pick-locked"><span>✓</span><div><small>Your prediction</small><strong>{prediction.selectedOutcome ? "YES — Goal" : "NO — No goal"}</strong></div><b>LOCKED</b></div> : <div className="fan-pick-buttons"><button type="button" disabled={busy} onClick={() => onPick(challenge, 1)}><span>YES</span><small>A goal is scored</small></button><button type="button" disabled={busy} onClick={() => onPick(challenge, 0)}><span>NO</span><small>Score stays the same</small></button></div>}</article>;
}
function initials(name: string) { return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
