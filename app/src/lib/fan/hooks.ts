"use client";

import { useCallback, useEffect, useState } from "react";
import useSWR from "swr";
import { useWallet } from "@solana/wallet-adapter-react";
import { clearFanAuth, fanAuthValid, fanFetch, signInToMatchday } from "./client";
import type { FanChallenge, FanPrediction, FanRoom, FanScore } from "./types";
import type { EnrichedFanFixture } from "./service";

// SWR-backed polling: dedup, revalidate-on-focus, and no refresh while the
// tab is hidden. Key includes the authenticated flag so a public and an
// authed read of the same URL never share a cache entry.
function usePolling<T>(url: string | null, intervalMs = 10_000, authenticated = false) {
    const { data, error, isLoading, mutate } = useSWR<T>(
        url ? [url, authenticated] : null,
        async ([u, authed]: [string, boolean]) => {
            if (authed) return fanFetch<T>(u);
            const res = await fetch(u, { cache: "no-store" });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? "fan_request_failed");
            return json as T;
        },
        {
            refreshInterval: intervalMs > 0 ? intervalMs : 0,
            refreshWhenHidden: false,
            revalidateOnFocus: true,
            dedupingInterval: Math.min(2000, intervalMs),
            keepPreviousData: true,
        }
    );
    const refresh = useCallback(async () => { await mutate(); }, [mutate]);
    return {
        data: data ?? null,
        loading: isLoading,
        error: error ? (error instanceof Error ? error.message : "fan_request_failed") : null,
        refresh,
    };
}

export function useFanSession() {
    const walletAdapter = useWallet();
    const wallet = walletAdapter.publicKey?.toBase58() ?? null;
    const [authenticated, setAuthenticated] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => setAuthenticated(Boolean(wallet && fanAuthValid())), [wallet]);

    const signIn = useCallback(async () => {
        setBusy(true);
        setError(null);
        try {
            if (!walletAdapter.connected) {
                const preferred = walletAdapter.wallets.find((entry) => entry.adapter.name === "Phantom") ?? walletAdapter.wallets[0];
                if (preferred) walletAdapter.select(preferred.adapter.name);
                await walletAdapter.connect();
                return;
            }
            if (!wallet || !walletAdapter.signMessage) throw new Error("wallet_message_signing_unavailable");
            await signInToMatchday(wallet, walletAdapter.signMessage);
            setAuthenticated(true);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "sign_in_failed");
        } finally { setBusy(false); }
    }, [wallet, walletAdapter]);

    const signOut = useCallback(async () => {
        clearFanAuth();
        setAuthenticated(false);
        await walletAdapter.disconnect().catch(() => {});
    }, [walletAdapter]);

    return { wallet, connected: walletAdapter.connected, authenticated, busy, error, signIn, signOut };
}

export function useFanFixtures() {
    const result = usePolling<{ fixtures: EnrichedFanFixture[]; source: string }>("/api/fan/fixtures", 30_000);
    return { fixtures: result.data?.fixtures ?? [], source: result.data?.source ?? null, ...result };
}

export function useFanFixture(fixtureId: string) {
    const result = usePolling<{ fixture: EnrichedFanFixture; challenges: FanChallenge[]; storage: string }>(
        `/api/fan/challenges/${encodeURIComponent(fixtureId)}`,
        3_000
    );
    return { fixture: result.data?.fixture ?? null, challenges: result.data?.challenges ?? [], storage: result.data?.storage ?? null, ...result };
}

export function useFanPredictions(wallet: string | null, fixtureId: string, authenticated: boolean) {
    const result = usePolling<{ predictions: FanPrediction[] }>(
        wallet && authenticated ? `/api/fan/predictions?fixtureId=${encodeURIComponent(fixtureId)}` : null,
        8_000,
        true
    );
    return { predictions: result.data?.predictions ?? [], ...result };
}

export function useFanRoom(roomId: string | null) {
    const result = usePolling<{ room: FanRoom; leaderboard: FanScore[]; storage: string }>(
        roomId ? `/api/fan/rooms/${encodeURIComponent(roomId)}` : null,
        5_000
    );
    return { room: result.data?.room ?? null, leaderboard: result.data?.leaderboard ?? [], ...result };
}

export function useFanReactions(fixtureId: string) {
    const result = usePolling<{ counts: Record<string, number> }>(
        `/api/fan/reactions?fixtureId=${encodeURIComponent(fixtureId)}`,
        5_000
    );
    return { counts: result.data?.counts ?? {}, ...result };
}
