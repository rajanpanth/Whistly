// ─── Whistly V2 Matching Engine (server-only) ──────────────────────────────
// Validates signed order intents, matches price-time priority, and settles
// every match on Solana devnet via settle_fill_v2 (operator-signed tx with
// both parties' ed25519 order signatures as pre-instructions).
//
// The operator key can ONLY submit fills that satisfy both signed orders —
// the program re-verifies signatures, prices, expiry, cancellation and
// remaining quantity on-chain. A database update alone is never treated as
// settlement: a fill exists only when its devnet transaction confirms.

import {
    Keypair,
    PublicKey,
    Transaction,
    TransactionInstruction,
} from "@solana/web3.js";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { connection } from "../program.base";
import {
    decodeOrderV2,
    hashOrderV2,
    toHex,
    fromHex,
    SIDE_BUY,
    SIDE_SELL,
    PRICE_SCALE,
    LAMPORTS_PER_BP,
    MIN_PRICE_BPS,
    MAX_PRICE_BPS,
    type OrderPayloadV2,
} from "./codec";
import {
    buildInitPositionV2Ix,
    buildOrderSigVerifyIx,
    buildSettleFillV2Ix,
    getBalanceV2PDA,
    getPositionV2PDA,
    parseBalanceV2,
    parseMarketV2,
    parsePositionV2,
    MARKET_V2_STATUS,
    type MarketV2Data,
} from "./programV2";
import {
    getOrderStore,
    type OrderRecord,
    type OrderSideStr,
    type TifStr,
} from "./orderStore";

// ─── Operator key ───────────────────────────────────────────────────────────

export function getOperatorKeypair(): Keypair | null {
    const raw = process.env.V2_OPERATOR_SECRET_KEY;
    if (!raw) return null;
    try {
        if (raw.trim().startsWith("[")) {
            return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
        }
        return Keypair.fromSecretKey(bs58.decode(raw.trim()));
    } catch {
        return null;
    }
}

export function operatorStatus(): { configured: boolean; pubkey?: string } {
    const kp = getOperatorKeypair();
    return kp ? { configured: true, pubkey: kp.publicKey.toBase58() } : { configured: false };
}

// ─── Validation ─────────────────────────────────────────────────────────────

export interface PostOrderInput {
    payloadHex: string;
    signatureHex: string;
    orderType: "LIMIT" | "MARKET";
}

export type ValidationResult =
    | { ok: true; payload: OrderPayloadV2; orderHash: string; market: MarketV2Data }
    | { ok: false; error: string };

export async function validateOrder(input: PostOrderInput): Promise<ValidationResult> {
    const payloadBytes = fromHex(input.payloadHex);
    const payload = decodeOrderV2(payloadBytes);
    if (!payload) return { ok: false, error: "malformed_payload" };

    // 1. Signature (server-side pre-check; program re-verifies at settlement).
    const signature = fromHex(input.signatureHex);
    if (
        signature.length !== 64 ||
        !nacl.sign.detached.verify(payloadBytes, signature, payload.maker.toBytes())
    ) {
        return { ok: false, error: "bad_signature" };
    }

    // 2. Field sanity.
    if (payload.priceBps < MIN_PRICE_BPS || payload.priceBps > MAX_PRICE_BPS) {
        return { ok: false, error: "invalid_price" };
    }
    if (payload.quantity <= 0n || payload.quantity > 10_000_000n) {
        return { ok: false, error: "invalid_quantity" };
    }
    const now = Math.floor(Date.now() / 1000);
    if (Number(payload.expiry) <= now) return { ok: false, error: "order_expired" };

    // 3. Replay defense (per-maker nonce unique).
    const store = getOrderStore();
    if (await store.hasNonce(payload.maker.toBase58(), Number(payload.nonce))) {
        return { ok: false, error: "duplicate_nonce" };
    }

    // 4. Market state (on-chain read — fail closed).
    const marketInfo = await connection.getAccountInfo(payload.market);
    if (!marketInfo) return { ok: false, error: "market_not_found" };
    const market = parseMarketV2(marketInfo.data);
    if (market.status !== MARKET_V2_STATUS.OPEN) return { ok: false, error: "market_not_open" };
    if (Number(market.closeTs) <= now) return { ok: false, error: "market_closed" };
    if (payload.outcomeIndex >= market.numOutcomes) return { ok: false, error: "invalid_outcome" };

    // 5. Funding / share coverage, including amounts locked by the maker's
    //    other resting orders (prevents double-spending one balance).
    const makerB58 = payload.maker.toBase58();
    const resting = (await store.getOrdersByMaker(makerB58)).filter(
        (o) => o.status === "open" || o.status === "partially_filled"
    );
    if (payload.side === SIDE_BUY) {
        const cost =
            BigInt(payload.priceBps) * BigInt(LAMPORTS_PER_BP) * payload.quantity;
        const [balancePda] = getBalanceV2PDA(payload.maker);
        const balanceInfo = await connection.getAccountInfo(balancePda);
        const available = balanceInfo ? parseBalanceV2(balanceInfo.data).available : 0n;
        const alreadyLocked = resting
            .filter((o) => o.side === "BUY")
            .reduce(
                (sum, o) =>
                    sum +
                    BigInt(o.priceBps) *
                        BigInt(LAMPORTS_PER_BP) *
                        BigInt(o.quantity - o.filledQuantity),
                0n
            );
        // Fee headroom: worst-case taker fee on this order's notional.
        const feeHeadroom = (cost * 500n) / 10_000n;
        if (available < alreadyLocked + cost + feeHeadroom) {
            return { ok: false, error: "insufficient_balance" };
        }
    } else {
        const [positionPda] = getPositionV2PDA(
            payload.market,
            payload.maker,
            payload.outcomeIndex
        );
        const positionInfo = await connection.getAccountInfo(positionPda);
        const shares = positionInfo ? parsePositionV2(positionInfo.data).shares : 0n;
        const alreadyLocked = resting
            .filter(
                (o) =>
                    o.side === "SELL" &&
                    o.market === payload.market.toBase58() &&
                    o.outcomeIndex === payload.outcomeIndex
            )
            .reduce((sum, o) => sum + BigInt(o.quantity - o.filledQuantity), 0n);
        if (shares < alreadyLocked + payload.quantity) {
            return { ok: false, error: "insufficient_shares" };
        }
    }

    const orderHash = toHex(await hashOrderV2(payloadBytes));
    return { ok: true, payload, orderHash, market };
}

// ─── Matching ───────────────────────────────────────────────────────────────
// Pure crossing logic lives in matchLogic.ts (web3-free, unit-tested);
// imported for internal use and re-exported so callers can keep importing
// findMatches from the engine.
import { findMatches } from "./matchLogic";
export { findMatches };

// ─── Settlement ─────────────────────────────────────────────────────────────

async function ensurePositionIxs(
    operator: PublicKey,
    market: PublicKey,
    owner: PublicKey,
    outcomeIndex: number
): Promise<TransactionInstruction[]> {
    const [pda] = getPositionV2PDA(market, owner, outcomeIndex);
    const info = await connection.getAccountInfo(pda);
    if (info) return [];
    return [await buildInitPositionV2Ix(operator, owner, market, outcomeIndex)];
}

export interface SettledFill {
    txSignature: string;
    quantity: number;
    priceBps: number;
    mode: "TRANSFER" | "MINT" | "BURN";
    makerOrderHash: string;
    takerOrderHash: string;
}

/**
 * Settle one match on devnet. Throws on failure; the caller decides how to
 * proceed (skip candidate, mark order rejected, …).
 */
export async function settleMatchOnChain(params: {
    operator: Keypair;
    market: PublicKey;
    makerRecord: OrderRecord;
    takerRecord: OrderRecord;
    fillQty: bigint;
    mode: "TRANSFER" | "MINT" | "BURN";
}): Promise<string> {
    const { operator, market, makerRecord, takerRecord, fillQty } = params;
    const makerPayloadBytes = fromHex(makerRecord.payloadHex);
    const takerPayloadBytes = fromHex(takerRecord.payloadHex);
    const makerPayload = decodeOrderV2(makerPayloadBytes)!;
    const takerPayload = decodeOrderV2(takerPayloadBytes)!;

    // Positions are created in a separate up-front transaction so the
    // settlement transaction stays well under the 1232-byte packet limit.
    const setupIxs: TransactionInstruction[] = [
        ...(await ensurePositionIxs(
            operator.publicKey,
            market,
            makerPayload.maker,
            makerPayload.outcomeIndex
        )),
        ...(await ensurePositionIxs(
            operator.publicKey,
            market,
            takerPayload.maker,
            takerPayload.outcomeIndex
        )),
    ];
    if (setupIxs.length > 0) {
        const setupTx = new Transaction().add(...setupIxs);
        setupTx.feePayer = operator.publicKey;
        const bh = await connection.getLatestBlockhash("confirmed");
        setupTx.recentBlockhash = bh.blockhash;
        setupTx.sign(operator);
        const setupSig = await connection.sendRawTransaction(setupTx.serialize());
        const setupRes = await connection.confirmTransaction(
            { signature: setupSig, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight },
            "confirmed"
        );
        if (setupRes.value.err) {
            throw new Error(`init_position_v2 failed: ${JSON.stringify(setupRes.value.err)}`);
        }
    }

    // maker sig verify (0) → taker sig verify (1) → settle fill (2).
    const makerSigIxIndex = 0;
    const takerSigIxIndex = 1;
    const settleIx = await buildSettleFillV2Ix({
        operator: operator.publicKey,
        market,
        maker: makerPayload.maker,
        taker: takerPayload.maker,
        makerOutcomeIndex: makerPayload.outcomeIndex,
        takerOutcomeIndex: takerPayload.outcomeIndex,
        makerHash: fromHex(makerRecord.orderHash),
        takerHash: fromHex(takerRecord.orderHash),
        fillQty,
        makerSigIxIndex,
        takerSigIxIndex,
    });

    const tx = new Transaction().add(
        buildOrderSigVerifyIx(
            makerPayload.maker,
            makerPayloadBytes,
            fromHex(makerRecord.signatureHex)
        ),
        buildOrderSigVerifyIx(
            takerPayload.maker,
            takerPayloadBytes,
            fromHex(takerRecord.signatureHex)
        ),
        settleIx
    );
    tx.feePayer = operator.publicKey;
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;
    tx.sign(operator);

    const signature = await connection.sendRawTransaction(tx.serialize(), {
        skipPreflight: false,
    });
    const confirmation = await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        "confirmed"
    );
    if (confirmation.value.err) {
        throw new Error(`settle_fill_v2 failed: ${JSON.stringify(confirmation.value.err)}`);
    }
    return signature;
}

// ─── Orchestration: post + match + settle ───────────────────────────────────

// Consecutive on-chain settlement failures per RESTING order. Once an order
// keeps getting rejected by the program (stale funding, on-chain cancel), it
// is phantom liquidity — retire it so it stops blocking the book.
const restingFailCounts = new Map<string, number>();
const MAX_RESTING_FAILURES = 3;

export interface MatchOutcome {
    settled: SettledFill[];
    remaining: number;
    status: OrderRecord["status"];
}

/**
 * Run the matching loop for a stored order. Each successful match settles
 * on-chain BEFORE the database is updated. Called after insertOrder, and
 * re-callable (crank) — it only ever uses current DB remaining quantities.
 */
export async function matchAndSettle(orderHash: string): Promise<MatchOutcome> {
    const store = getOrderStore();
    const operator = getOperatorKeypair();
    const incoming = await store.getOrder(orderHash);
    if (!incoming) throw new Error("order_not_found");
    if (!operator) {
        // No operator key — orders can rest but nothing can settle.
        return {
            settled: [],
            remaining: incoming.quantity - incoming.filledQuantity,
            status: incoming.status,
        };
    }

    const market = new PublicKey(incoming.market);
    const marketInfo = await connection.getAccountInfo(market);
    if (!marketInfo) throw new Error("market_not_found");
    const marketData = parseMarketV2(marketInfo.data);

    const book = (await store.getRestingOrders(incoming.market)).filter(
        (o) => o.orderHash !== incoming.orderHash
    );
    let remaining = BigInt(incoming.quantity - incoming.filledQuantity);
    const matches = findMatches(
        {
            side: incoming.side,
            outcomeIndex: incoming.outcomeIndex,
            priceBps: incoming.priceBps,
            quantity: remaining,
            maker: incoming.maker,
        },
        book,
        marketData.numOutcomes
    );

    // FOK: reject outright unless full quantity is immediately fillable.
    if (incoming.tif === "FOK") {
        const fillable = matches.reduce((s, m) => s + m.quantity, 0n);
        if (fillable < remaining) {
            await store.updateOrder(orderHash, {
                status: "rejected",
                rejectReason: "fok_insufficient_liquidity",
            });
            return { settled: [], remaining: Number(remaining), status: "rejected" };
        }
    }

    const settled: SettledFill[] = [];
    for (const match of matches) {
        if (remaining === 0n) break;
        const qty = remaining < match.quantity ? remaining : match.quantity;
        try {
            const txSignature = await settleMatchOnChain({
                operator,
                market,
                makerRecord: match.resting,
                takerRecord: incoming,
                fillQty: qty,
                mode: match.mode,
            });
            restingFailCounts.delete(match.resting.orderHash);
            remaining -= qty;

            // Update DB only AFTER on-chain confirmation.
            const makerFilled = match.resting.filledQuantity + Number(qty);
            await store.updateOrder(match.resting.orderHash, {
                filledQuantity: makerFilled,
                status: makerFilled >= match.resting.quantity ? "filled" : "partially_filled",
            });
            const takerFilled = incoming.quantity - Number(remaining);
            await store.updateOrder(orderHash, {
                filledQuantity: takerFilled,
                status: remaining === 0n ? "filled" : "partially_filled",
            });
            const fill: SettledFill = {
                txSignature,
                quantity: Number(qty),
                priceBps: match.resting.priceBps,
                mode: match.mode,
                makerOrderHash: match.resting.orderHash,
                takerOrderHash: incoming.orderHash,
            };
            settled.push(fill);
            await store.insertFill({
                market: incoming.market,
                fillSeq: null,
                mode: match.mode,
                makerOrderHash: match.resting.orderHash,
                takerOrderHash: incoming.orderHash,
                maker: match.resting.maker,
                taker: incoming.maker,
                outcomeIndex: match.resting.outcomeIndex,
                priceBps: match.resting.priceBps,
                quantity: Number(qty),
                notionalLamports: match.resting.priceBps * LAMPORTS_PER_BP * Number(qty),
                feeLamports: 0, // exact fee readable from tx logs; UI shows quote-side estimate
                txSignature,
                createdAt: Date.now(),
            });
            await store.insertActivity({
                kind: "fill",
                market: incoming.market,
                wallet: incoming.maker,
                outcomeIndex: incoming.outcomeIndex,
                side: incoming.side,
                priceBps: match.resting.priceBps,
                quantity: Number(qty),
                lamports: match.resting.priceBps * LAMPORTS_PER_BP * Number(qty),
                txSignature,
                createdAt: Date.now(),
            });
        } catch (err) {
            // On-chain rejection of this pairing (stale funding, cancelled
            // on-chain, expiry race…). Skip the candidate, but track repeat
            // offenders: a resting order that keeps failing on-chain is
            // phantom liquidity, so retire it instead of letting it degrade
            // every future crossing order.
            console.error("settleMatchOnChain failed", {
                maker: match.resting.orderHash.slice(0, 16),
                taker: orderHash.slice(0, 16),
                err: err instanceof Error ? err.message : err,
            });
            const fails = (restingFailCounts.get(match.resting.orderHash) ?? 0) + 1;
            restingFailCounts.set(match.resting.orderHash, fails);
            if (fails >= MAX_RESTING_FAILURES) {
                restingFailCounts.delete(match.resting.orderHash);
                try {
                    await store.updateOrder(match.resting.orderHash, {
                        status: "rejected",
                        rejectReason: "onchain_settlement_failed",
                    });
                    console.error("resting order retired after repeated on-chain failures", {
                        orderHash: match.resting.orderHash.slice(0, 16),
                        failures: fails,
                    });
                } catch {
                    // Store write failed — the counter reset means we retry later.
                }
            }
            continue;
        }
    }

    // Terminal handling.
    let finalStatus: OrderRecord["status"];
    if (remaining === 0n) {
        finalStatus = "filled";
    } else if (incoming.tif === "FAK" || incoming.tif === "FOK" || incoming.orderType === "MARKET") {
        // Immediate-or-cancel: the unfilled remainder never rests.
        finalStatus = "cancelled";
        await store.updateOrder(orderHash, {
            status: "cancelled",
            rejectReason: settled.length > 0 ? "fak_remainder_cancelled" : "no_liquidity",
        });
    } else {
        finalStatus = settled.length > 0 ? "partially_filled" : "open";
    }

    return { settled, remaining: Number(remaining), status: finalStatus };
}
