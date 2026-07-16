"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function FanLeaderboardPage() {
    const router = useRouter();
    const [code, setCode] = useState("");
    function openRoom(event: FormEvent) {
        event.preventDefault();
        const value = code.trim();
        if (value) router.push(`/rooms/${encodeURIComponent(value.toUpperCase())}`);
    }
    return <main className="fan-page fan-join-page">
        <section className="fan-join-card">
            <span className="fan-big-icon">♟</span>
            <p className="fan-kicker">Play with your people</p>
            <h1>Join a friend room</h1>
            <p>Enter the eight-character code from your friend. The room’s live match and leaderboard will open instantly.</p>
            <form onSubmit={openRoom}><label htmlFor="room-code">Room code</label><input id="room-code" autoCapitalize="characters" autoComplete="off" maxLength={36} placeholder="AB12CD34" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} /><button className="fan-primary-button" type="submit" disabled={!code.trim()}>Open room</button></form>
            <small>Need a room? Open a live match and choose “Create friend room.”</small>
        </section>
        <section className="fan-how"><div><span>01</span><strong>Get a code</strong><p>A friend shares their private Matchday room.</p></div><div><span>02</span><strong>Connect wallet</strong><p>A free signature gives your score a persistent identity.</p></div><div><span>03</span><strong>Climb the table</strong><p>Correct live picks and streaks earn points.</p></div></section>
    </main>;
}
