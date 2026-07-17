// ─── Whistly V2 browser client ─────────────────────────────────────────────
// Wallet-signed order creation + REST helpers used by the trading UI.
// Uses the raw @solana/wallet-adapter signMessage / signTransaction — the
// operator settles fills, the user only ever signs order intents and their
// own deposit/withdraw/redeem transactions.

import { PublicKey, Transaction } from "@solana/web3.js";
import {
    encodeOrderV2,
    hashOrderV2,
    toHex,
    SIDE_BUY,
    SIDE_SELL,
    TIF_GTC,
    TIF_GTD,
    TIF_FAK,
    TIF_FOK,
    PRICE_SCALE,
    LAMPORTS_PER_BP,
    SET_COST,
    type OrderSide,
    type TimeInForce,
} from "./codec";
import {
    buildDepositV2Ix,
    buildWithdrawV2Ix,
    buildRedeemV2Ix,
    buildCancelOrderV2Ix,
} from "./programV2";
import { connection } from "../program.base";

export const LAMPORTS_PER_SOL = 1_000_000_000;

export type SignMessageFn = (message: Uint8Array) => Promise<Uint8Array>;
export type SignTransactionFn = <T extends Transaction>(tx: T) => Promise<T>;

export interface BuildOrderParams {
    market: string;
    maker: string;
    outcomeIndex: number;
    side: "BUY" | "SELL";
    priceBps: number;
    quantity: number;
    tif?: "GTC" | "GTD" | "FAK" | "FOK";
    expiryUnix?: number;
}

const TIF_MAP: Record<string, TimeInForce> = {
    GTC: TIF_GTC,
    GTD: TIF_GTD,
    FAK: TIF_FAK,
    FOK: TIF_FOK,
};

/** Sign an order intent and POST it. Returns the match/settlement result. */
export async function submitOrder(
    params: BuildOrderParams,
    signMessage: SignMessageFn,
    orderType: "LIMIT" | "MARKET" = "LIMIT"
) {
    const now = Math.floor(Date.now() / 1000);
    const payload = encodeOrderV2({
        market: new PublicKey(params.market),
        maker: new PublicKey(params.maker),
        outcomeIndex: params.outcomeIndex,
        side: (params.side === "BUY" ? SIDE_BUY : SIDE_SELL) as OrderSide,
        priceBps: params.priceBps,
        quantity: BigInt(params.quantity),
        // Unique per-maker nonce (ms × 1000 + random) — replay defense.
        nonce: BigInt(Date.now() * 1000 + Math.floor(Math.random() * 1000)),
        expiry: BigInt(params.expiryUnix ?? now + 7 * 86400),
        tif: TIF_MAP[params.tif ?? "GTC"],
        salt: BigInt(Math.floor(Math.random() * 1e12)),
        // V3: signed creation time — lets the program enforce maker priority.
        createdTs: now,
    });
    const signature = await signMessage(payload);
    const res = await fetch("/api/v2/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
            payloadHex: toHex(payload),
            signatureHex: toHex(signature),
            orderType,
        }),
    });
    const json = await res.json();
    if (!res.ok) throw new OrderError(json.error ?? "order_failed", res.status);
    return json as {
        orderHash: string;
        settled: { txSignature: string; quantity: number; priceBps: number }[];
        remaining: number;
        status: string;
        matchError?: string;
    };
}

export class OrderError extends Error {
    constructor(public code: string, public status: number) {
        super(code);
        this.name = "OrderError";
    }
}

/** Soft-cancel via signed message (engine stops filling immediately). */
export async function cancelOrder(orderHash: string, maker: string, signMessage: SignMessageFn) {
    const msg = new TextEncoder().encode(`WV2-CANCEL:${orderHash}`);
    const signature = await signMessage(msg);
    const res = await fetch("/api/v2/orders/cancel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderHash, signatureHex: toHex(signature) }),
    });
    const json = await res.json();
    if (!res.ok) throw new OrderError(json.error ?? "cancel_failed", res.status);
    return json;
}

async function sendUserTx(
    ix: Awaited<ReturnType<typeof buildDepositV2Ix>>,
    owner: PublicKey,
    signTransaction: SignTransactionFn
): Promise<string> {
    const tx = new Transaction().add(ix);
    tx.feePayer = owner;
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;
    const signed = await signTransaction(tx);
    const sig = await connection.sendRawTransaction(signed.serialize());
    const res = await connection.confirmTransaction(
        { signature: sig, blockhash, lastValidBlockHeight },
        "confirmed"
    );
    if (res.value.err) throw new Error(`tx failed: ${JSON.stringify(res.value.err)}`);
    return sig;
}

export async function depositCollateral(
    owner: string,
    lamports: number,
    signTransaction: SignTransactionFn
) {
    const pk = new PublicKey(owner);
    return sendUserTx(await buildDepositV2Ix(pk, lamports), pk, signTransaction);
}

export async function withdrawCollateral(
    owner: string,
    lamports: number,
    signTransaction: SignTransactionFn
) {
    const pk = new PublicKey(owner);
    return sendUserTx(await buildWithdrawV2Ix(pk, lamports), pk, signTransaction);
}

export async function redeemPosition(
    owner: string,
    market: string,
    outcomeIndex: number,
    signTransaction: SignTransactionFn
) {
    const pk = new PublicKey(owner);
    return sendUserTx(
        await buildRedeemV2Ix(pk, new PublicKey(market), outcomeIndex),
        pk,
        signTransaction
    );
}

// ─── formatting ─────────────────────────────────────────────────────────────

export function fmtSol(lamports: number, dp = 3): string {
    return (lamports / LAMPORTS_PER_SOL).toFixed(dp);
}

export function bpsToPct(bps: number | null | undefined): string {
    if (bps === null || bps === undefined) return "—";
    return `${(bps / 100).toFixed(0)}%`;
}

export function bpsToPct1(bps: number | null | undefined): string {
    if (bps === null || bps === undefined) return "—";
    return `${(bps / 100).toFixed(1)}%`;
}

export { SET_COST, PRICE_SCALE, LAMPORTS_PER_BP };
