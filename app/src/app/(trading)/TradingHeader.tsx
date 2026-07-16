"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useV2Balance } from "@/lib/v2/hooks";
import { fmtSol } from "@/lib/v2/client";

const NAV = [
    { href: "/markets", label: "Markets" },
    { href: "/live", label: "Live", live: true },
    { href: "/portfolio", label: "Portfolio" },
    { href: "/orders", label: "Orders" },
    { href: "/activity", label: "Activity" },
];

export default function TradingHeader() {
    const pathname = usePathname();
    const router = useRouter();
    const { publicKey, connected, connect, wallets, select, disconnect } = useWallet();
    const wallet = publicKey?.toBase58() ?? null;
    const { balance } = useV2Balance(wallet);
    const [q, setQ] = useState("");

    async function handleConnect() {
        try {
            if (!connected) {
                // Prefer an installed Phantom; else let the adapter modal pick.
                const phantom = wallets.find((w) => w.adapter.name === "Phantom");
                if (phantom) select(phantom.adapter.name);
                await connect().catch(() => {});
            } else {
                await disconnect();
            }
        } catch {
            /* user rejected */
        }
    }

    return (
        <>
            <div className="wt-devnet-banner">
                <span>◎ Solana Devnet</span>
                <span>·</span>
                <strong>Devnet SOL has no real-money value.</strong>
            </div>
            <header className="wt-header">
                <Link href="/markets" className="wt-brand">
                    <span className="wt-brand-dot">W</span>
                    Whistly
                </Link>
                <form
                    className="wt-search"
                    onSubmit={(e) => {
                        e.preventDefault();
                        router.push(`/markets?q=${encodeURIComponent(q)}`);
                    }}
                >
                    <span aria-hidden>⌕</span>
                    <input
                        placeholder="Search markets, teams, events…"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        aria-label="Search markets"
                    />
                </form>
                <nav className="wt-nav">
                    {NAV.map((n) => (
                        <Link
                            key={n.href}
                            href={n.href}
                            className={pathname.startsWith(n.href) ? "active" : ""}
                        >
                            {n.live && <span className="wt-live-dot" />}
                            {n.label}
                        </Link>
                    ))}
                </nav>
                <div className="wt-wallet-chip">
                    {connected && balance !== null && (
                        <div className="wt-collateral">
                            <div className="v wt-tabular">◎ {fmtSol(balance.available)}</div>
                            <div className="l">collateral</div>
                        </div>
                    )}
                    <button className="wt-btn wt-btn-primary" onClick={handleConnect}>
                        {connected && wallet
                            ? `${wallet.slice(0, 4)}…${wallet.slice(-4)}`
                            : "Connect Wallet"}
                    </button>
                </div>
            </header>
        </>
    );
}
