// ─── Whistly V2 Order Codec ────────────────────────────────────────────────
// Canonical signed-order payload. MUST stay byte-identical to
// `OrderPayloadV2` in programs/instinctfi/src/state_v2.rs:
//
// | offset | len | field        |
// |--------|-----|--------------|
// | 0      | 4   | magic "WV2O" |
// | 4      | 1   | version (2)  |
// | 5      | 32  | market pda   |
// | 37     | 32  | maker pubkey |
// | 69     | 1   | outcome idx  |
// | 70     | 1   | side 0/1     |
// | 71     | 2   | price bps LE |
// | 73     | 8   | quantity LE  |
// | 81     | 8   | nonce LE     |
// | 89     | 8   | expiry LE    |
// | 97     | 1   | tif          |
// | 98     | 8   | salt LE      |
//
// Order hash = SHA-256(payload) — matches solana_program::hash::hash.

import { PublicKey } from "@solana/web3.js";

export const ORDER_MAGIC = new TextEncoder().encode("WV2O");
export const ORDER_VERSION = 2;
export const ORDER_PAYLOAD_LEN = 106;

export const SIDE_BUY = 0;
export const SIDE_SELL = 1;

export const TIF_GTC = 0;
export const TIF_GTD = 1;
export const TIF_FOK = 2;
export const TIF_FAK = 3;

// Mirror of on-chain economics constants.
export const SET_COST = 1_000_000; // lamports per complete set / winning share
export const PRICE_SCALE = 10_000; // bps
export const LAMPORTS_PER_BP = SET_COST / PRICE_SCALE; // 100
export const MIN_PRICE_BPS = 100;
export const MAX_PRICE_BPS = 9_900;

export type OrderSide = typeof SIDE_BUY | typeof SIDE_SELL;
export type TimeInForce = typeof TIF_GTC | typeof TIF_GTD | typeof TIF_FOK | typeof TIF_FAK;

export interface OrderPayloadV2 {
    market: PublicKey;
    maker: PublicKey;
    outcomeIndex: number;
    side: OrderSide;
    priceBps: number;
    /** shares */
    quantity: bigint;
    nonce: bigint;
    /** unix seconds */
    expiry: bigint;
    tif: TimeInForce;
    salt: bigint;
}

export function encodeOrderV2(order: OrderPayloadV2): Uint8Array {
    const buf = new Uint8Array(ORDER_PAYLOAD_LEN);
    const view = new DataView(buf.buffer);
    buf.set(ORDER_MAGIC, 0);
    buf[4] = ORDER_VERSION;
    buf.set(order.market.toBytes(), 5);
    buf.set(order.maker.toBytes(), 37);
    buf[69] = order.outcomeIndex;
    buf[70] = order.side;
    view.setUint16(71, order.priceBps, true);
    view.setBigUint64(73, order.quantity, true);
    view.setBigUint64(81, order.nonce, true);
    view.setBigInt64(89, order.expiry, true);
    buf[97] = order.tif;
    view.setBigUint64(98, order.salt, true);
    return buf;
}

export function decodeOrderV2(data: Uint8Array): OrderPayloadV2 | null {
    if (data.length !== ORDER_PAYLOAD_LEN) return null;
    if (
        data[0] !== ORDER_MAGIC[0] ||
        data[1] !== ORDER_MAGIC[1] ||
        data[2] !== ORDER_MAGIC[2] ||
        data[3] !== ORDER_MAGIC[3] ||
        data[4] !== ORDER_VERSION
    ) {
        return null;
    }
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    return {
        market: new PublicKey(data.slice(5, 37)),
        maker: new PublicKey(data.slice(37, 69)),
        outcomeIndex: data[69],
        side: data[70] as OrderSide,
        priceBps: view.getUint16(71, true),
        quantity: view.getBigUint64(73, true),
        nonce: view.getBigUint64(81, true),
        expiry: view.getBigInt64(89, true),
        tif: data[97] as TimeInForce,
        salt: view.getBigUint64(98, true),
    };
}

/** SHA-256 of the exact signed bytes (matches the on-chain order hash). */
export async function hashOrderV2(payload: Uint8Array): Promise<Uint8Array> {
    if (typeof globalThis.crypto?.subtle !== "undefined") {
        const digest = await globalThis.crypto.subtle.digest("SHA-256", payload as BufferSource);
        return new Uint8Array(digest);
    }
    // Node < 20 fallback
    const { createHash } = await import("crypto");
    return new Uint8Array(createHash("sha256").update(payload).digest());
}

export function toHex(bytes: Uint8Array): string {
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function fromHex(hex: string): Uint8Array {
    const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
    const out = new Uint8Array(clean.length / 2);
    for (let i = 0; i < out.length; i++) {
        out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    }
    return out;
}

/** Lamports a BUY at priceBps × qty shares costs (exact integer). */
export function buyCostLamports(priceBps: number, quantity: bigint): bigint {
    return BigInt(priceBps) * BigInt(LAMPORTS_PER_BP) * quantity;
}

/** Probability (0-100, 2dp) for a bps price. */
export function bpsToProbability(priceBps: number): number {
    return Math.round((priceBps / PRICE_SCALE) * 10000) / 100;
}

export function probabilityToBps(probabilityPct: number): number {
    return Math.round(probabilityPct * 100);
}
