"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { fanFetch } from "@/lib/fan/client";
import { useFanFixture, useFanSession } from "@/lib/fan/hooks";
import type { FanRecap } from "@/lib/fan/types";

export default function RecapPage() {
    const params = useParams<{ fixtureId: string }>();
    const fixtureId = decodeURIComponent(params.fixtureId);
    const roomId = useSearchParams().get("roomId");
    const session = useFanSession();
    const { fixture } = useFanFixture(fixtureId);
    const [recap, setRecap] = useState<FanRecap | null>(null);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        if (!session.authenticated) return;
        fanFetch<{ recap: FanRecap }>(`/api/fan/recap/${encodeURIComponent(fixtureId)}${roomId ? `?roomId=${encodeURIComponent(roomId)}` : ""}`).then((result) => setRecap(result.recap)).catch((cause) => setError(cause instanceof Error ? cause.message : "recap_failed"));
    }, [fixtureId, roomId, session.authenticated]);

    if (!session.authenticated) return <main className="fan-page"><section className="fan-join-card"><span className="fan-big-icon">🏁</span><p className="fan-kicker">Your match story</p><h1>Unlock your recap</h1><p>Connect the wallet you used for predictions to see your score, accuracy, streak and room finish.</p><button className="fan-primary-button" type="button" onClick={session.signIn}>Connect wallet</button></section></main>;
    if (error) return <main className="fan-page"><div className="fan-state error"><strong>Recap unavailable</strong><span>{error}</span></div></main>;
    if (!recap) return <main className="fan-page"><div className="fan-state"><span className="fan-loader" />Building your match story…</div></main>;

    return <main className="fan-page fan-recap-page">
        <section className="fan-recap-hero"><p className="fan-kicker">Full-time fan report</p><h1>{fixture ? `${fixture.homeTeam} ${fixture.homeScore}–${fixture.awayScore} ${fixture.awayTeam}` : "Your Matchday recap"}</h1><p>You called the moments. Here’s how your match unfolded.</p><div className="fan-recap-score"><strong>{recap.totalPoints}</strong><span>POINTS</span></div></section>
        <section className="fan-stat-grid"><div><span>Accuracy</span><strong>{recap.accuracy}%</strong><small>{recap.correctPredictions} of {recap.totalPredictions} correct</small></div><div><span>Best streak</span><strong>{recap.longestStreak}</strong><small>consecutive correct picks</small></div><div><span>Room finish</span><strong>{recap.finalRank ? `#${recap.finalRank}` : "—"}</strong><small>{recap.roomId ? "final leaderboard rank" : "no room selected"}</small></div></section>
        <section className="fan-recap-share"><div><p>THE FINAL WHISTLE</p><h2>{recap.accuracy >= 70 ? "Big-game instincts." : recap.totalPredictions ? "Every call builds your form." : "Your next match starts the story."}</h2><span>Share the room, run it back, and settle the group-chat debate in the next live fixture.</span></div><div><Link className="fan-primary-link" href="/matchday">Choose next match</Link>{roomId && <Link className="fan-secondary-link" href={`/rooms/${roomId}`}>Back to room</Link>}</div></section>
    </main>;
}
