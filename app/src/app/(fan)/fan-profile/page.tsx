"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fanFetch, shortFanWallet } from "@/lib/fan/client";
import { useFanSession } from "@/lib/fan/hooks";
import type { FanProfile } from "@/lib/fan/types";

export default function FanProfilePage() {
    const session = useFanSession();
    const [profile, setProfile] = useState<FanProfile | null>(null);
    const [displayName, setDisplayName] = useState("");
    const [favoriteTeam, setFavoriteTeam] = useState("");
    const [message, setMessage] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!session.authenticated) return;
        fanFetch<{ profile: FanProfile | null }>("/api/fan/profile").then(({ profile: next }) => {
            setProfile(next); setDisplayName(next?.displayName ?? ""); setFavoriteTeam(next?.favoriteTeam ?? "");
        }).catch((cause) => setMessage(cause instanceof Error ? cause.message : "profile_read_failed"));
    }, [session.authenticated]);

    async function save() {
        if (!session.authenticated) { await session.signIn(); return; }
        setBusy(true); setMessage(null);
        try {
            const result = await fanFetch<{ profile: FanProfile }>("/api/fan/profile", { method: "POST", body: JSON.stringify({ displayName, favoriteTeam }) });
            setProfile(result.profile); setMessage("Profile saved. Your fan name will appear in new rooms.");
        } catch (cause) { setMessage(cause instanceof Error ? cause.message : "profile_write_failed"); }
        finally { setBusy(false); }
    }

    return <main className="fan-page fan-profile-page">
        <section className="fan-profile-hero"><div className="fan-avatar">{(displayName || session.wallet || "W").slice(0, 2).toUpperCase()}</div><div><p className="fan-kicker">Your fan identity</p><h1>{profile?.displayName || "Set up your Matchday profile"}</h1><p>{session.wallet ? shortFanWallet(session.wallet) : "Connect a Solana wallet to carry your identity and scores between matchdays."}</p></div></section>
        {message && <div className="fan-message" role="status">{message}</div>}
        <div className="fan-profile-grid"><section className="fan-panel"><div className="fan-section-title"><div><p>PROFILE</p><h2>How friends see you</h2></div></div><div className="fan-profile-form"><label>Display name<input maxLength={32} placeholder="Your fan name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label><label>Favorite team<input maxLength={48} placeholder="Country or club" value={favoriteTeam} onChange={(event) => setFavoriteTeam(event.target.value)} /></label><button className="fan-primary-button" type="button" disabled={busy || (session.authenticated && !displayName.trim())} onClick={save}>{busy ? "Saving…" : session.authenticated ? "Save profile" : "Connect wallet"}</button></div></section><aside><section className="fan-panel fan-safety-card"><span>✓</span><h2>Safe by design</h2><p>Whistly never asks you to deposit funds for Matchday. Signatures authenticate your public wallet only—they do not authorize a transaction.</p><Link href="/matchday">Browse live matches →</Link></section></aside></div>
    </main>;
}
