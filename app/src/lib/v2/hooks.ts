"use client";

import { useCallback } from "react";
import useSWR from "swr";

// ─── generic polling fetch (SWR-backed) ─────────────────────────────────────
// SWR gives request dedup across components, revalidate-on-focus/reconnect,
// and pauses refresh while the tab is hidden (refreshWhenHidden: false).
// The return shape matches the old hand-rolled hook so callers are unchanged.

async function jsonFetcher(url: string) {
    const res = await fetch(url, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "fetch_failed");
    return json;
}

function usePolling<T>(url: string | null, intervalMs = 4000) {
    const { data, error, isLoading, mutate } = useSWR<T>(url, jsonFetcher, {
        refreshInterval: intervalMs > 0 ? intervalMs : 0,
        refreshWhenHidden: false,
        revalidateOnFocus: true,
        dedupingInterval: Math.min(2000, intervalMs),
        keepPreviousData: true,
    });

    const refresh = useCallback(async () => {
        await mutate();
    }, [mutate]);

    return {
        data: data ?? null,
        error: error ? (error instanceof Error ? error.message : "fetch_failed") : null,
        loading: isLoading,
        refresh,
    };
}

// ─── typed hooks ────────────────────────────────────────────────────────────

export interface MarketBookSummary {
    outcome: string;
    bestBid: number | null;
    bestAsk: number | null;
}
export interface MarketSummary {
    address: string;
    marketId: number;
    title: string;
    outcomes: string[];
    numOutcomes: number;
    marketType: number;
    fixtureId: number;
    resolutionSource: number;
    closeTs: number;
    status: number;
    winningOutcome: number;
    feeBps: number;
    openSets: number;
    volumeLamports: number;
    fillCount: number;
    createdAt: number;
    book: MarketBookSummary[];
    lastTradeBps: number | null;
    restingOrders: number;
}

export function useMarkets(intervalMs = 6000) {
    const { data, loading, error, refresh } = usePolling<{ markets: MarketSummary[] }>(
        "/api/v2/markets",
        intervalMs
    );
    return { markets: data?.markets ?? [], loading, error, refresh };
}

export function useMarket(address: string | null, intervalMs = 6000) {
    const { markets, loading, error, refresh } = useMarkets(intervalMs);
    const market = address ? markets.find((m) => m.address === address) ?? null : null;
    return { market, loading, error, refresh };
}

export interface BookLevel {
    priceBps: number;
    quantity: number;
    cumulative: number;
    orders: number;
}
export interface BookData {
    market: string;
    outcome: number;
    bids: BookLevel[];
    asks: BookLevel[];
    bestBid: number | null;
    bestAsk: number | null;
    midBps: number | null;
    spreadBps: number | null;
    lastTradeBps: number | null;
    recentTrades: {
        priceBps: number;
        quantity: number;
        outcomeIndex: number;
        mode: string;
        txSignature: string;
        timestamp: number;
    }[];
}

export function useOrderBook(market: string | null, outcome: number, intervalMs = 3000) {
    const url = market ? `/api/v2/book/${market}?outcome=${outcome}` : null;
    const { data, loading, error, refresh } = usePolling<BookData>(url, intervalMs);
    return { book: data, loading, error, refresh };
}

export interface PriceHistory {
    points: { t: number; priceBps: number; quantity: number; txSignature: string }[];
}
export function usePriceHistory(market: string | null, outcome: number, range: string) {
    const url = market ? `/api/v2/history/${market}?outcome=${outcome}&range=${range}` : null;
    const { data, loading } = usePolling<PriceHistory>(url, 8000);
    return { points: data?.points ?? [], loading };
}

export interface PositionData {
    address: string;
    market: string;
    outcomeIndex: number;
    shares: number;
    costLamports: number;
    proceedsLamports: number;
    redeemedShares: number;
    redeemedLamports: number;
}
export interface BalanceData {
    available: number;
    totalDeposited: number;
    totalWithdrawn: number;
}
export function usePositions(wallet: string | null, intervalMs = 5000) {
    const url = wallet ? `/api/v2/positions/${wallet}` : null;
    const { data, loading, error, refresh } = usePolling<{
        positions: PositionData[];
        balance: BalanceData | null;
    }>(url, intervalMs);
    return {
        positions: data?.positions ?? [],
        balance: data?.balance ?? null,
        loading,
        error,
        refresh,
    };
}

export function useV2Balance(wallet: string | null) {
    const { balance, refresh } = usePositions(wallet, 8000);
    return { balance, refresh };
}

export interface OrderData {
    orderHash: string;
    market: string;
    marketId: number;
    outcomeIndex: number;
    maker: string;
    side: "BUY" | "SELL";
    orderType: "LIMIT" | "MARKET";
    priceBps: number;
    quantity: number;
    lockedAmount: number;
    expiry: number;
    tif: string;
    filledQuantity: number;
    status: string;
    createdAt: number;
}
export function useOrders(wallet: string | null, market?: string, intervalMs = 4000) {
    const url = wallet
        ? `/api/v2/orders?maker=${wallet}${market ? `&market=${market}` : ""}`
        : null;
    const { data, loading, error, refresh } = usePolling<{ orders: OrderData[] }>(url, intervalMs);
    return { orders: data?.orders ?? [], loading, error, refresh };
}

export interface ActivityData {
    kind: string;
    market?: string;
    wallet?: string;
    outcomeIndex?: number;
    side?: string;
    priceBps?: number;
    quantity?: number;
    lamports?: number;
    txSignature?: string;
    createdAt: number;
}
export function useActivity(params: { market?: string; wallet?: string } = {}, intervalMs = 5000) {
    const qs = new URLSearchParams();
    if (params.market) qs.set("market", params.market);
    if (params.wallet) qs.set("wallet", params.wallet);
    const { data, loading, error, refresh } = usePolling<{ activity: ActivityData[] }>(
        `/api/v2/activity?${qs.toString()}`,
        intervalMs
    );
    return { activity: data?.activity ?? [], loading, error, refresh };
}
