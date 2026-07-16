"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { fanFetch } from "@/lib/fan/client";
import { useFanRoom, useFanSession } from "@/lib/fan/hooks";

export default function RoomPage() {
    const params = useParams<{ roomId: string }>();
    const roomId = decodeURIComponent(params.roomId);
    const router = useRouter();
    const session = useFanSession();
    const { room, leaderboard, loading, error, refresh } = useFanRoom(roomId);
    const [displayName, setDisplayName] = useState("");
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    async function joinRoom() {
        if (!session.authenticated) { await session.signIn(); return; }
        if (!room) return;
        setBusy(true);
        setMessage(null);
        try {
            await fanFetch("/api/fan/rooms/join", { method: "POST", body: JSON.stringify({ roomIdOrCode: room.inviteCode, displayName: displayName.trim() || `Fan ${session.wallet?.slice(0, 4)}` }) });
            setMessage("You’re in. Your live picks now count in this room.");
            await refresh();
        } catch (cause) { setMessage(cause instanceof Error ? cause.message : "room_join_failed"); }
        finally { setBusy(false); }
    }

    async function shareRoom() {
        if (!room) return;
        const url = `${window.location.origin}/rooms/${room.inviteCode}`;
        if (navigator.share) await navigator.share({ title: room.name, text: `Join my Whistly Matchday room: ${room.inviteCode}`, url }).catch(() => {});
        else await navigator.clipboard.writeText(url);
        setMessage("Invite link copied.");
    }

    if (loading) return <main className="fan-page"><div className="fan-state"><span className="fan-loader" />Opening friend room…</div></main>;
    if (error || !room) return <main className="fan-page"><div className="fan-state error"><strong>Room not found</strong><span>Check the invite code and try again.</span><Link className="fan-primary-link" href="/fan-leaderboard">Enter another code</Link></div></main>;
    const joined = leaderboard.some((score) => score.wallet === session.wallet);

    return <main className="fan-page fan-room-page">
        <section className="fan-room-hero">
            <div><p className="fan-kicker">Private friend room</p><h1>{room.name}</h1><p>Predict live moments together. Every correct call moves you up this table.</p></div>
            <div className="fan-invite-code"><span>ROOM CODE</span><strong>{room.inviteCode}</strong><button type="button" onClick={shareRoom}>Share invite</button></div>
        </section>
        {message && <div className="fan-message" role="status">{message}</div>}
        <div className="fan-room-layout">
            <section className="fan-panel fan-room-board"><div className="fan-section-title"><div><p>LIVE STANDINGS</p><h2>Friend leaderboard</h2></div><span>{leaderboard.length} player{leaderboard.length === 1 ? "" : "s"}</span></div>
                {leaderboard.length ? <ol className="fan-leaderboard fan-leaderboard-large">{leaderboard.map((score, index) => <li key={score.wallet} className={score.wallet === session.wallet ? "you" : ""}><b>#{index + 1}</b><span>{score.displayName}<small>{score.correctPredictions}/{score.totalPredictions} correct · best streak {score.longestStreak}</small></span><strong>{score.totalPoints}<small>PTS</small></strong></li>)}</ol> : <div className="fan-empty-small">No players yet. Be the first to join.</div>}
            </section>
            <aside>
                <section className="fan-panel"><div className="fan-section-title"><div><p>{joined ? "YOU’RE IN" : "JOIN THE ROOM"}</p><h2>{joined ? "Make your picks" : "Choose your fan name"}</h2></div></div>
                    {joined ? <><p className="fan-room-copy">Your predictions for this fixture count here automatically.</p><button className="fan-primary-button" type="button" onClick={() => router.push(`/matchday/${encodeURIComponent(room.fixtureId)}?roomId=${room.id}`)}>Enter live match</button></> : <div className="fan-room-form"><input aria-label="Your display name" placeholder="e.g. Kathmandu Kopites" maxLength={32} value={displayName} onChange={(event) => setDisplayName(event.target.value)} /><button type="button" disabled={busy} onClick={joinRoom}>{busy ? "Joining…" : session.authenticated ? "Join friend room" : "Connect wallet to join"}</button></div>}
                </section>
                <section className="fan-scoring-note"><strong>Free fan game</strong><p>No entry fee, wagering, deposits or prizes. Wallet signatures only prove your identity and protect your score.</p></section>
            </aside>
        </div>
    </main>;
}
