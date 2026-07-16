"use client";

import { clearAuthToken, getAuthToken, isAuthTokenValid, setAuthToken } from "@/lib/supabase";

export async function fanFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
    const token = getAuthToken();
    const response = await fetch(url, {
        ...init,
        headers: {
            ...(init.body ? { "content-type": "application/json" } : {}),
            ...(token ? { authorization: `Bearer ${token}` } : {}),
            ...(init.headers ?? {}),
        },
        cache: "no-store",
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(json.error ?? "fan_request_failed");
    return json as T;
}

export async function signInToMatchday(
    wallet: string,
    signMessage: (message: Uint8Array) => Promise<Uint8Array>
) {
    const message = [
        "Sign in to Whistly Matchday",
        `Wallet: ${wallet}`,
        `Domain: ${window.location.host}`,
        `Timestamp: ${Date.now()}`,
    ].join("\n");
    const signature = await signMessage(new TextEncoder().encode(message));
    let binary = "";
    signature.forEach((byte) => { binary += String.fromCharCode(byte); });
    const response = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ walletAddress: wallet, message, signature: btoa(binary) }),
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error ?? "sign_in_failed");
    setAuthToken(json.token);
    return json.token as string;
}

export function fanAuthValid() {
    return isAuthTokenValid();
}

export function clearFanAuth() {
    clearAuthToken();
}

export function formatFanClock(seconds: number) {
    const minutes = Math.max(0, Math.floor(seconds / 60));
    return `${minutes}:${String(Math.max(0, seconds % 60)).padStart(2, "0")}`;
}

export function shortFanWallet(wallet: string) {
    return `${wallet.slice(0, 4)}…${wallet.slice(-4)}`;
}
