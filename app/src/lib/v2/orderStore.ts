// ─── Whistly V2 Order Store ────────────────────────────────────────────────
// Server-side persistence for signed order intents + settled fills.
//
// Two adapters:
//  - Supabase (production; tables from migrations/006_v2_clob.sql)
//  - In-memory (local dev without Supabase env — same pattern as the
//    existing liveGoalMarketStore). The chain remains the source of truth
//    for balances/positions/fills either way; this store is the index.

import { getSupabaseAdmin } from "../supabaseAdmin";

export type OrderSideStr = "BUY" | "SELL";
export type OrderTypeStr = "LIMIT" | "MARKET";
export type TifStr = "GTC" | "GTD" | "FOK" | "FAK";
export type OrderStatus =
    | "open"
    | "partially_filled"
    | "filled"
    | "cancelled"
    | "expired"
    | "rejected";

export interface OrderRecord {
    orderHash: string; // hex
    protocolVersion: number;
    market: string; // base58 PDA
    marketId: number;
    outcomeIndex: number;
    maker: string; // base58 wallet
    side: OrderSideStr;
    orderType: OrderTypeStr;
    priceBps: number;
    quantity: number; // shares
    lockedAmount: number; // BUY: lamports reserved; SELL: shares locked
    nonce: number;
    expiry: number; // unix seconds
    tif: TifStr;
    filledQuantity: number;
    status: OrderStatus;
    rejectReason?: string | null;
    payloadHex: string;
    signatureHex: string;
    createdAt: number; // unix ms
    updatedAt: number;
}

export interface FillRecord {
    market: string;
    fillSeq: number | null;
    mode: "TRANSFER" | "MINT" | "BURN";
    makerOrderHash: string;
    takerOrderHash: string;
    maker: string;
    taker: string;
    outcomeIndex: number;
    priceBps: number;
    quantity: number;
    notionalLamports: number;
    feeLamports: number;
    txSignature: string;
    createdAt: number;
}

export interface ActivityRecord {
    kind:
        | "order_posted"
        | "order_cancelled"
        | "order_expired"
        | "fill"
        | "partial_fill"
        | "market_created"
        | "market_settled"
        | "market_voided"
        | "redeemed";
    market?: string;
    wallet?: string;
    outcomeIndex?: number;
    side?: OrderSideStr;
    priceBps?: number;
    quantity?: number;
    lamports?: number;
    txSignature?: string;
    createdAt: number;
}

export interface OrderStore {
    readonly kind: "supabase" | "memory";
    insertOrder(order: OrderRecord): Promise<{ ok: true } | { ok: false; error: string }>;
    getOrder(orderHash: string): Promise<OrderRecord | null>;
    /** open + partially_filled orders for one market side/outcome. */
    getRestingOrders(market: string): Promise<OrderRecord[]>;
    getOrdersByMaker(maker: string, market?: string): Promise<OrderRecord[]>;
    updateOrder(
        orderHash: string,
        patch: Partial<Pick<OrderRecord, "filledQuantity" | "status" | "rejectReason">>
    ): Promise<void>;
    hasNonce(maker: string, nonce: number): Promise<boolean>;
    insertFill(fill: FillRecord): Promise<void>;
    getFills(market: string, limit?: number): Promise<FillRecord[]>;
    getFillsByWallet(wallet: string, limit?: number): Promise<FillRecord[]>;
    insertActivity(activity: ActivityRecord): Promise<void>;
    getActivity(params: { market?: string; wallet?: string; limit?: number }): Promise<ActivityRecord[]>;
}

const OPEN_STATUSES: OrderStatus[] = ["open", "partially_filled"];

// ─── In-memory adapter ──────────────────────────────────────────────────────

interface MemoryState {
    orders: Map<string, OrderRecord>;
    fills: FillRecord[];
    activity: ActivityRecord[];
}

function memoryState(): MemoryState {
    const g = globalThis as typeof globalThis & { __whistlyV2Store?: MemoryState };
    if (!g.__whistlyV2Store) {
        g.__whistlyV2Store = { orders: new Map(), fills: [], activity: [] };
    }
    return g.__whistlyV2Store;
}

class MemoryOrderStore implements OrderStore {
    readonly kind = "memory" as const;

    async insertOrder(order: OrderRecord) {
        const st = memoryState();
        if (st.orders.has(order.orderHash)) {
            return { ok: false as const, error: "duplicate_order_hash" };
        }
        for (const existing of st.orders.values()) {
            if (existing.maker === order.maker && existing.nonce === order.nonce) {
                return { ok: false as const, error: "duplicate_nonce" };
            }
        }
        st.orders.set(order.orderHash, { ...order });
        return { ok: true as const };
    }

    async getOrder(orderHash: string) {
        const o = memoryState().orders.get(orderHash);
        return o ? { ...o } : null;
    }

    async getRestingOrders(market: string) {
        return Array.from(memoryState().orders.values())
            .filter((o) => o.market === market && OPEN_STATUSES.includes(o.status))
            .map((o) => ({ ...o }));
    }

    async getOrdersByMaker(maker: string, market?: string) {
        return Array.from(memoryState().orders.values())
            .filter((o) => o.maker === maker && (!market || o.market === market))
            .sort((a, b) => b.createdAt - a.createdAt)
            .map((o) => ({ ...o }));
    }

    async updateOrder(
        orderHash: string,
        patch: Partial<Pick<OrderRecord, "filledQuantity" | "status" | "rejectReason">>
    ) {
        const st = memoryState();
        const o = st.orders.get(orderHash);
        if (o) {
            Object.assign(o, patch, { updatedAt: Date.now() });
        }
    }

    async hasNonce(maker: string, nonce: number) {
        for (const o of memoryState().orders.values()) {
            if (o.maker === maker && o.nonce === nonce) return true;
        }
        return false;
    }

    async insertFill(fill: FillRecord) {
        memoryState().fills.push({ ...fill });
    }

    async getFills(market: string, limit = 100) {
        return memoryState()
            .fills.filter((f) => f.market === market)
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, limit);
    }

    async getFillsByWallet(wallet: string, limit = 100) {
        return memoryState()
            .fills.filter((f) => f.maker === wallet || f.taker === wallet)
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, limit);
    }

    async insertActivity(activity: ActivityRecord) {
        memoryState().activity.push({ ...activity });
    }

    async getActivity({ market, wallet, limit = 100 }: { market?: string; wallet?: string; limit?: number }) {
        return memoryState()
            .activity.filter(
                (a) => (!market || a.market === market) && (!wallet || a.wallet === wallet)
            )
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, limit);
    }
}

// ─── Supabase adapter ───────────────────────────────────────────────────────

function rowToOrder(row: any): OrderRecord {
    return {
        orderHash: row.order_hash,
        protocolVersion: row.protocol_version,
        market: row.market,
        marketId: Number(row.market_id),
        outcomeIndex: row.outcome_index,
        maker: row.maker,
        side: row.side,
        orderType: row.order_type,
        priceBps: row.price_bps,
        quantity: Number(row.quantity),
        lockedAmount: Number(row.locked_amount),
        nonce: Number(row.nonce),
        expiry: Number(row.expiry),
        tif: row.tif,
        filledQuantity: Number(row.filled_quantity),
        status: row.status,
        rejectReason: row.reject_reason,
        payloadHex: row.payload_hex,
        signatureHex: row.signature_hex,
        createdAt: new Date(row.created_at).getTime(),
        updatedAt: new Date(row.updated_at).getTime(),
    };
}

function orderToRow(o: OrderRecord): any {
    return {
        order_hash: o.orderHash,
        protocol_version: o.protocolVersion,
        market: o.market,
        market_id: o.marketId,
        outcome_index: o.outcomeIndex,
        maker: o.maker,
        side: o.side,
        order_type: o.orderType,
        price_bps: o.priceBps,
        quantity: o.quantity,
        locked_amount: o.lockedAmount,
        nonce: o.nonce,
        expiry: o.expiry,
        tif: o.tif,
        filled_quantity: o.filledQuantity,
        status: o.status,
        reject_reason: o.rejectReason ?? null,
        payload_hex: o.payloadHex,
        signature_hex: o.signatureHex,
    };
}

class SupabaseOrderStore implements OrderStore {
    readonly kind = "supabase" as const;

    private client() {
        return getSupabaseAdmin();
    }

    async insertOrder(order: OrderRecord) {
        const { error } = await this.client().from("v2_orders").insert(orderToRow(order));
        if (error) {
            const dup = error.message?.includes("duplicate") || error.code === "23505";
            return {
                ok: false as const,
                error: dup ? "duplicate_nonce" : error.message,
            };
        }
        return { ok: true as const };
    }

    async getOrder(orderHash: string) {
        const { data } = await this.client()
            .from("v2_orders")
            .select("*")
            .eq("order_hash", orderHash)
            .maybeSingle();
        return data ? rowToOrder(data) : null;
    }

    async getRestingOrders(market: string) {
        const { data } = await this.client()
            .from("v2_orders")
            .select("*")
            .eq("market", market)
            .in("status", OPEN_STATUSES);
        return (data ?? []).map(rowToOrder);
    }

    async getOrdersByMaker(maker: string, market?: string) {
        let q = this.client().from("v2_orders").select("*").eq("maker", maker);
        if (market) q = q.eq("market", market);
        const { data } = await q.order("created_at", { ascending: false });
        return (data ?? []).map(rowToOrder);
    }

    async updateOrder(
        orderHash: string,
        patch: Partial<Pick<OrderRecord, "filledQuantity" | "status" | "rejectReason">>
    ) {
        const row: any = { updated_at: new Date().toISOString() };
        if (patch.filledQuantity !== undefined) row.filled_quantity = patch.filledQuantity;
        if (patch.status !== undefined) row.status = patch.status;
        if (patch.rejectReason !== undefined) row.reject_reason = patch.rejectReason;
        await this.client().from("v2_orders").update(row).eq("order_hash", orderHash);
    }

    async hasNonce(maker: string, nonce: number) {
        const { data } = await this.client()
            .from("v2_orders")
            .select("order_hash")
            .eq("maker", maker)
            .eq("nonce", nonce)
            .maybeSingle();
        return !!data;
    }

    async insertFill(fill: FillRecord) {
        await this.client().from("v2_fills").insert({
            market: fill.market,
            fill_seq: fill.fillSeq,
            mode: fill.mode,
            maker_order_hash: fill.makerOrderHash,
            taker_order_hash: fill.takerOrderHash,
            maker: fill.maker,
            taker: fill.taker,
            outcome_index: fill.outcomeIndex,
            price_bps: fill.priceBps,
            quantity: fill.quantity,
            notional_lamports: fill.notionalLamports,
            fee_lamports: fill.feeLamports,
            tx_signature: fill.txSignature,
        });
    }

    async getFills(market: string, limit = 100) {
        const { data } = await this.client()
            .from("v2_fills")
            .select("*")
            .eq("market", market)
            .order("created_at", { ascending: false })
            .limit(limit);
        return (data ?? []).map(rowToFill);
    }

    async getFillsByWallet(wallet: string, limit = 100) {
        const { data } = await this.client()
            .from("v2_fills")
            .select("*")
            .or(`maker.eq.${wallet},taker.eq.${wallet}`)
            .order("created_at", { ascending: false })
            .limit(limit);
        return (data ?? []).map(rowToFill);
    }

    async insertActivity(a: ActivityRecord) {
        await this.client().from("v2_activity").insert({
            kind: a.kind,
            market: a.market ?? null,
            wallet: a.wallet ?? null,
            outcome_index: a.outcomeIndex ?? null,
            side: a.side ?? null,
            price_bps: a.priceBps ?? null,
            quantity: a.quantity ?? null,
            lamports: a.lamports ?? null,
            tx_signature: a.txSignature ?? null,
        });
    }

    async getActivity({ market, wallet, limit = 100 }: { market?: string; wallet?: string; limit?: number }) {
        let q = this.client().from("v2_activity").select("*");
        if (market) q = q.eq("market", market);
        if (wallet) q = q.eq("wallet", wallet);
        const { data } = await q.order("created_at", { ascending: false }).limit(limit);
        return (data ?? []).map((row: any) => ({
            kind: row.kind,
            market: row.market ?? undefined,
            wallet: row.wallet ?? undefined,
            outcomeIndex: row.outcome_index ?? undefined,
            side: row.side ?? undefined,
            priceBps: row.price_bps ?? undefined,
            quantity: row.quantity != null ? Number(row.quantity) : undefined,
            lamports: row.lamports != null ? Number(row.lamports) : undefined,
            txSignature: row.tx_signature ?? undefined,
            createdAt: new Date(row.created_at).getTime(),
        }));
    }
}

function rowToFill(row: any): FillRecord {
    return {
        market: row.market,
        fillSeq: row.fill_seq != null ? Number(row.fill_seq) : null,
        mode: row.mode,
        makerOrderHash: row.maker_order_hash,
        takerOrderHash: row.taker_order_hash,
        maker: row.maker,
        taker: row.taker,
        outcomeIndex: row.outcome_index,
        priceBps: row.price_bps,
        quantity: Number(row.quantity),
        notionalLamports: Number(row.notional_lamports),
        feeLamports: Number(row.fee_lamports),
        txSignature: row.tx_signature,
        createdAt: new Date(row.created_at).getTime(),
    };
}

// ─── Adapter selection ──────────────────────────────────────────────────────

export function isSupabaseConfigured(): boolean {
    return Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
            (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    );
}

let storeInstance: OrderStore | null = null;

export function getOrderStore(): OrderStore {
    if (!storeInstance) {
        if (isSupabaseConfigured()) {
            storeInstance = new SupabaseOrderStore();
        } else {
            if (process.env.NODE_ENV === "production" && process.env.VERCEL) {
                // Stateless serverless production MUST have a database.
                throw new Error(
                    "V2 order book requires Supabase in production (set NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)"
                );
            }
            storeInstance = new MemoryOrderStore();
        }
    }
    return storeInstance;
}
