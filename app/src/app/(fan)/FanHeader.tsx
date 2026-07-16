"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFanSession } from "@/lib/fan/hooks";
import { shortFanWallet } from "@/lib/fan/client";

const links = [
    { href: "/matchday", label: "Matches", icon: "⚽" },
    { href: "/fan-leaderboard", label: "Rooms", icon: "♟" },
    { href: "/matchday/replay", label: "Replay", icon: "↻" },
    { href: "/fan-profile", label: "Profile", icon: "●" },
];

export default function FanHeader() {
    const pathname = usePathname();
    const session = useFanSession();
    return (
        <>
            <div className="fan-live-strip"><span /> World Cup live companion <b>Powered by TxLINE</b></div>
            <header className="fan-header">
                <Link className="fan-brand" href="/matchday"><i>W</i><span>Whistly <b>Matchday</b></span></Link>
                <nav aria-label="Matchday navigation">
                    {links.map((link) => <Link className={pathname.startsWith(link.href) ? "active" : ""} key={link.href} href={link.href}>{link.label}</Link>)}
                </nav>
                <button className="fan-signin" type="button" onClick={session.authenticated ? session.signOut : session.signIn} disabled={session.busy}>
                    {session.busy ? "Waiting for wallet…" : session.authenticated && session.wallet ? shortFanWallet(session.wallet) : session.connected ? "Sign in with Solana" : "Connect wallet"}
                </button>
            </header>
            {session.error && <div className="fan-auth-error" role="alert">{session.error}</div>}
            <nav className="fan-bottom-nav" aria-label="Mobile Matchday navigation">
                {links.map((link) => <Link className={pathname.startsWith(link.href) ? "active" : ""} key={link.href} href={link.href}><span>{link.icon}</span>{link.label}</Link>)}
            </nav>
        </>
    );
}
