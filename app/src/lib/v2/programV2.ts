// ─── Whistly V2 Program Client ─────────────────────────────────────────────
// Hand-rolled instruction builders + account parsers for the V2 CLOB
// instructions (same IDL-free approach as program.onchain.ts for V1).
// Account ordering MUST match the Rust #[derive(Accounts)] structs.

import {
    PublicKey,
    SystemProgram,
    TransactionInstruction,
    Ed25519Program,
    SYSVAR_INSTRUCTIONS_PUBKEY,
} from "@solana/web3.js";
import { PROGRAM_ID, ixDiscriminator } from "../program.base";

// ─── PDAs ───────────────────────────────────────────────────────────────────

export function getConfigV2PDA(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync([Buffer.from("config_v2")], PROGRAM_ID);
}

export function getMarketV2PDA(marketId: bigint | number): [PublicKey, number] {
    const buf = new Uint8Array(8);
    new DataView(buf.buffer).setBigUint64(0, BigInt(marketId), true);
    return PublicKey.findProgramAddressSync(
        [Buffer.from("market_v2"), Buffer.from(buf)],
        PROGRAM_ID
    );
}

export function getVaultV2PDA(market: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("vault_v2"), market.toBuffer()],
        PROGRAM_ID
    );
}

export function getBalanceV2PDA(owner: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("balance_v2"), owner.toBuffer()],
        PROGRAM_ID
    );
}

export function getPositionV2PDA(
    market: PublicKey,
    owner: PublicKey,
    outcomeIndex: number
): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [
            Buffer.from("position_v2"),
            market.toBuffer(),
            owner.toBuffer(),
            Buffer.from([outcomeIndex]),
        ],
        PROGRAM_ID
    );
}

export function getOrderFillStateV2PDA(orderHash: Uint8Array): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("ofill_v2"), Buffer.from(orderHash)],
        PROGRAM_ID
    );
}

// ─── Borsh encode helpers ───────────────────────────────────────────────────

function u16le(n: number): Uint8Array {
    const b = new Uint8Array(2);
    new DataView(b.buffer).setUint16(0, n, true);
    return b;
}
function u64le(n: bigint | number): Uint8Array {
    const b = new Uint8Array(8);
    new DataView(b.buffer).setBigUint64(0, BigInt(n), true);
    return b;
}
function i64le(n: bigint | number): Uint8Array {
    const b = new Uint8Array(8);
    new DataView(b.buffer).setBigInt64(0, BigInt(n), true);
    return b;
}
function borshString(s: string): Uint8Array {
    const bytes = new TextEncoder().encode(s);
    const out = new Uint8Array(4 + bytes.length);
    new DataView(out.buffer).setUint32(0, bytes.length, true);
    out.set(bytes, 4);
    return out;
}
function borshVecString(items: string[]): Uint8Array {
    const encoded = items.map(borshString);
    const total = 4 + encoded.reduce((n, e) => n + e.length, 0);
    const out = new Uint8Array(total);
    new DataView(out.buffer).setUint32(0, items.length, true);
    let off = 4;
    for (const e of encoded) {
        out.set(e, off);
        off += e.length;
    }
    return out;
}
function borshVecU8(bytes: Uint8Array): Uint8Array {
    const out = new Uint8Array(4 + bytes.length);
    new DataView(out.buffer).setUint32(0, bytes.length, true);
    out.set(bytes, 4);
    return out;
}
function option<T>(value: T | null | undefined, enc: (v: T) => Uint8Array): Uint8Array {
    if (value === null || value === undefined) return new Uint8Array([0]);
    const encoded = enc(value);
    const out = new Uint8Array(1 + encoded.length);
    out[0] = 1;
    out.set(encoded, 1);
    return out;
}
function concat(...parts: Uint8Array[]): Buffer {
    const total = parts.reduce((n, p) => n + p.length, 0);
    const out = new Uint8Array(total);
    let off = 0;
    for (const p of parts) {
        out.set(p, off);
        off += p.length;
    }
    return Buffer.from(out);
}

// ─── Instruction builders ───────────────────────────────────────────────────

export async function buildInitConfigV2Ix(
    admin: PublicKey,
    operator: PublicKey,
    feeBps: number
): Promise<TransactionInstruction> {
    const [config] = getConfigV2PDA();
    const disc = await ixDiscriminator("init_config_v2");
    return new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
            { pubkey: admin, isSigner: true, isWritable: true },
            { pubkey: config, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: concat(disc, operator.toBytes(), u16le(feeBps)),
    });
}

export async function buildUpdateConfigV2Ix(
    admin: PublicKey,
    updates: {
        newAdmin?: PublicKey | null;
        newOperator?: PublicKey | null;
        newFeeBps?: number | null;
        paused?: boolean | null;
    }
): Promise<TransactionInstruction> {
    const [config] = getConfigV2PDA();
    const disc = await ixDiscriminator("update_config_v2");
    return new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
            { pubkey: admin, isSigner: true, isWritable: false },
            { pubkey: config, isSigner: false, isWritable: true },
        ],
        data: concat(
            disc,
            option(updates.newAdmin, (v) => v.toBytes()),
            option(updates.newOperator, (v) => v.toBytes()),
            option(updates.newFeeBps, (v) => u16le(v)),
            option(updates.paused, (v) => new Uint8Array([v ? 1 : 0]))
        ),
    });
}

export async function buildCreateMarketV2Ix(
    admin: PublicKey,
    nextMarketId: bigint | number,
    params: {
        title: string;
        outcomes: string[];
        marketType: number;
        fixtureId: bigint | number;
        resolutionSource: number;
        closeTs: bigint | number;
    }
): Promise<{ ix: TransactionInstruction; market: PublicKey; vault: PublicKey }> {
    const [config] = getConfigV2PDA();
    const [market] = getMarketV2PDA(nextMarketId);
    const [vault] = getVaultV2PDA(market);
    const disc = await ixDiscriminator("create_market_v2");
    const ix = new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
            { pubkey: admin, isSigner: true, isWritable: true },
            { pubkey: config, isSigner: false, isWritable: true },
            { pubkey: market, isSigner: false, isWritable: true },
            { pubkey: vault, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: concat(
            disc,
            borshString(params.title),
            borshVecString(params.outcomes),
            new Uint8Array([params.marketType]),
            u64le(params.fixtureId),
            new Uint8Array([params.resolutionSource]),
            i64le(params.closeTs)
        ),
    });
    return { ix, market, vault };
}

export async function buildSetMarketStatusV2Ix(
    admin: PublicKey,
    market: PublicKey,
    status: number
): Promise<TransactionInstruction> {
    const [config] = getConfigV2PDA();
    const disc = await ixDiscriminator("set_market_status_v2");
    return new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
            { pubkey: admin, isSigner: true, isWritable: false },
            { pubkey: config, isSigner: false, isWritable: false },
            { pubkey: market, isSigner: false, isWritable: true },
        ],
        data: concat(disc, new Uint8Array([status])),
    });
}

export async function buildDepositV2Ix(
    owner: PublicKey,
    lamports: bigint | number
): Promise<TransactionInstruction> {
    const [balance] = getBalanceV2PDA(owner);
    const disc = await ixDiscriminator("deposit_v2");
    return new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
            { pubkey: owner, isSigner: true, isWritable: true },
            { pubkey: balance, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: concat(disc, u64le(lamports)),
    });
}

export async function buildWithdrawV2Ix(
    owner: PublicKey,
    lamports: bigint | number
): Promise<TransactionInstruction> {
    const [balance] = getBalanceV2PDA(owner);
    const disc = await ixDiscriminator("withdraw_v2");
    return new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
            { pubkey: owner, isSigner: true, isWritable: true },
            { pubkey: balance, isSigner: false, isWritable: true },
        ],
        data: concat(disc, u64le(lamports)),
    });
}

export async function buildInitPositionV2Ix(
    payer: PublicKey,
    owner: PublicKey,
    market: PublicKey,
    outcomeIndex: number
): Promise<TransactionInstruction> {
    const [position] = getPositionV2PDA(market, owner, outcomeIndex);
    const disc = await ixDiscriminator("init_position_v2");
    return new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
            { pubkey: payer, isSigner: true, isWritable: true },
            { pubkey: owner, isSigner: false, isWritable: false },
            { pubkey: market, isSigner: false, isWritable: false },
            { pubkey: position, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: concat(disc, new Uint8Array([outcomeIndex])),
    });
}

async function buildMintBurnIx(
    name: "mint_set_v2" | "burn_set_v2",
    owner: PublicKey,
    market: PublicKey,
    numOutcomes: number,
    sets: bigint | number
): Promise<TransactionInstruction> {
    const [config] = getConfigV2PDA();
    const [vault] = getVaultV2PDA(market);
    const [balance] = getBalanceV2PDA(owner);
    const disc = await ixDiscriminator(name);
    const positionKeys = [];
    for (let i = 0; i < numOutcomes; i++) {
        positionKeys.push({
            pubkey: getPositionV2PDA(market, owner, i)[0],
            isSigner: false,
            isWritable: true,
        });
    }
    return new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
            { pubkey: owner, isSigner: true, isWritable: true },
            { pubkey: config, isSigner: false, isWritable: false },
            { pubkey: market, isSigner: false, isWritable: true },
            { pubkey: vault, isSigner: false, isWritable: true },
            { pubkey: balance, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            ...positionKeys,
        ],
        data: concat(disc, u64le(sets)),
    });
}

export function buildMintSetV2Ix(
    owner: PublicKey,
    market: PublicKey,
    numOutcomes: number,
    sets: bigint | number
) {
    return buildMintBurnIx("mint_set_v2", owner, market, numOutcomes, sets);
}
export function buildBurnSetV2Ix(
    owner: PublicKey,
    market: PublicKey,
    numOutcomes: number,
    sets: bigint | number
) {
    return buildMintBurnIx("burn_set_v2", owner, market, numOutcomes, sets);
}

/**
 * Build the ed25519 verification pre-instruction for a signed order.
 * Must be placed in the SAME transaction before settle_fill_v2.
 */
export function buildOrderSigVerifyIx(
    maker: PublicKey,
    orderPayload: Uint8Array,
    signature: Uint8Array
): TransactionInstruction {
    return Ed25519Program.createInstructionWithPublicKey({
        publicKey: maker.toBytes(),
        message: orderPayload,
        signature,
    });
}

export async function buildSettleFillV2Ix(params: {
    operator: PublicKey;
    market: PublicKey;
    maker: PublicKey;
    taker: PublicKey;
    makerOutcomeIndex: number;
    takerOutcomeIndex: number;
    makerHash: Uint8Array;
    takerHash: Uint8Array;
    fillQty: bigint | number;
    /** index of the maker/taker ed25519 ix inside the transaction */
    makerSigIxIndex: number;
    takerSigIxIndex: number;
}): Promise<TransactionInstruction> {
    const [config] = getConfigV2PDA();
    const [vault] = getVaultV2PDA(params.market);
    const [makerFill] = getOrderFillStateV2PDA(params.makerHash);
    const [takerFill] = getOrderFillStateV2PDA(params.takerHash);
    const [makerBalance] = getBalanceV2PDA(params.maker);
    const [takerBalance] = getBalanceV2PDA(params.taker);
    const [makerPosition] = getPositionV2PDA(
        params.market,
        params.maker,
        params.makerOutcomeIndex
    );
    const [takerPosition] = getPositionV2PDA(
        params.market,
        params.taker,
        params.takerOutcomeIndex
    );
    const disc = await ixDiscriminator("settle_fill_v2");
    return new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
            { pubkey: params.operator, isSigner: true, isWritable: true },
            { pubkey: config, isSigner: false, isWritable: false },
            { pubkey: params.market, isSigner: false, isWritable: true },
            { pubkey: vault, isSigner: false, isWritable: true },
            { pubkey: makerFill, isSigner: false, isWritable: true },
            { pubkey: takerFill, isSigner: false, isWritable: true },
            { pubkey: makerBalance, isSigner: false, isWritable: true },
            { pubkey: takerBalance, isSigner: false, isWritable: true },
            { pubkey: makerPosition, isSigner: false, isWritable: true },
            { pubkey: takerPosition, isSigner: false, isWritable: true },
            { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: concat(
            disc,
            Buffer.from(params.makerHash),
            Buffer.from(params.takerHash),
            u64le(params.fillQty),
            new Uint8Array([params.makerSigIxIndex, params.takerSigIxIndex])
        ),
    });
}

export async function buildCancelOrderV2Ix(
    maker: PublicKey,
    orderPayload: Uint8Array,
    orderHash: Uint8Array
): Promise<TransactionInstruction> {
    const [fillState] = getOrderFillStateV2PDA(orderHash);
    const disc = await ixDiscriminator("cancel_order_v2");
    return new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
            { pubkey: maker, isSigner: true, isWritable: true },
            { pubkey: fillState, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: concat(disc, borshVecU8(orderPayload), Buffer.from(orderHash)),
    });
}

export async function buildSettleMarketV2Ix(
    admin: PublicKey,
    market: PublicKey,
    winningOutcome: number
): Promise<TransactionInstruction> {
    const [config] = getConfigV2PDA();
    const disc = await ixDiscriminator("settle_market_v2");
    return new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
            { pubkey: admin, isSigner: true, isWritable: false },
            { pubkey: config, isSigner: false, isWritable: false },
            { pubkey: market, isSigner: false, isWritable: true },
        ],
        data: concat(disc, new Uint8Array([winningOutcome])),
    });
}

export async function buildVoidMarketV2Ix(
    admin: PublicKey,
    market: PublicKey
): Promise<TransactionInstruction> {
    const [config] = getConfigV2PDA();
    const disc = await ixDiscriminator("void_market_v2");
    return new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
            { pubkey: admin, isSigner: true, isWritable: false },
            { pubkey: config, isSigner: false, isWritable: false },
            { pubkey: market, isSigner: false, isWritable: true },
        ],
        data: concat(disc),
    });
}

export async function buildRedeemV2Ix(
    owner: PublicKey,
    market: PublicKey,
    outcomeIndex: number
): Promise<TransactionInstruction> {
    const [vault] = getVaultV2PDA(market);
    const [position] = getPositionV2PDA(market, owner, outcomeIndex);
    const disc = await ixDiscriminator("redeem_v2");
    return new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
            { pubkey: owner, isSigner: true, isWritable: true },
            { pubkey: market, isSigner: false, isWritable: true },
            { pubkey: vault, isSigner: false, isWritable: true },
            { pubkey: position, isSigner: false, isWritable: true },
        ],
        data: concat(disc),
    });
}

export async function buildWithdrawFeesV2Ix(
    admin: PublicKey,
    market: PublicKey
): Promise<TransactionInstruction> {
    const [config] = getConfigV2PDA();
    const [vault] = getVaultV2PDA(market);
    const disc = await ixDiscriminator("withdraw_fees_v2");
    return new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
            { pubkey: admin, isSigner: true, isWritable: true },
            { pubkey: config, isSigner: false, isWritable: false },
            { pubkey: market, isSigner: false, isWritable: true },
            { pubkey: vault, isSigner: false, isWritable: true },
        ],
        data: concat(disc),
    });
}

// ─── Account parsers ────────────────────────────────────────────────────────

class Reader {
    private view: DataView;
    private off: number;
    constructor(private data: Uint8Array, start = 8 /* skip discriminator */) {
        this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        this.off = start;
    }
    pubkey(): PublicKey {
        const pk = new PublicKey(this.data.slice(this.off, this.off + 32));
        this.off += 32;
        return pk;
    }
    u8(): number {
        return this.data[this.off++];
    }
    bool(): boolean {
        return this.data[this.off++] === 1;
    }
    u16(): number {
        const v = this.view.getUint16(this.off, true);
        this.off += 2;
        return v;
    }
    u64(): bigint {
        const v = this.view.getBigUint64(this.off, true);
        this.off += 8;
        return v;
    }
    i64(): bigint {
        const v = this.view.getBigInt64(this.off, true);
        this.off += 8;
        return v;
    }
    bytes32(): Uint8Array {
        const b = this.data.slice(this.off, this.off + 32);
        this.off += 32;
        return b;
    }
    string(): string {
        const len = this.view.getUint32(this.off, true);
        this.off += 4;
        const s = new TextDecoder().decode(this.data.slice(this.off, this.off + len));
        this.off += len;
        return s;
    }
    vecString(): string[] {
        const count = this.view.getUint32(this.off, true);
        this.off += 4;
        const out: string[] = [];
        for (let i = 0; i < count; i++) out.push(this.string());
        return out;
    }
}

export const MARKET_V2_STATUS = {
    OPEN: 0,
    PAUSED: 1,
    CLOSED: 2,
    SETTLED: 3,
    VOID: 4,
} as const;
export const WINNING_UNSET = 255;

export interface ConfigV2Data {
    admin: PublicKey;
    operator: PublicKey;
    feeBps: number;
    paused: boolean;
    nextMarketId: bigint;
}

export function parseConfigV2(data: Uint8Array): ConfigV2Data {
    const r = new Reader(data);
    return {
        admin: r.pubkey(),
        operator: r.pubkey(),
        feeBps: r.u16(),
        paused: r.bool(),
        nextMarketId: r.u64(),
    };
}

export interface MarketV2Data {
    address?: PublicKey;
    marketId: bigint;
    numOutcomes: number;
    title: string;
    outcomes: string[];
    marketType: number;
    fixtureId: bigint;
    resolutionSource: number;
    closeTs: bigint;
    status: number;
    winningOutcome: number;
    feeBps: number;
    openSets: bigint;
    volumeLamports: bigint;
    fillCount: bigint;
    accruedFees: bigint;
    createdAt: bigint;
}

export function parseMarketV2(data: Uint8Array): MarketV2Data {
    const r = new Reader(data);
    return {
        marketId: r.u64(),
        numOutcomes: r.u8(),
        title: r.string(),
        outcomes: r.vecString(),
        marketType: r.u8(),
        fixtureId: r.u64(),
        resolutionSource: r.u8(),
        closeTs: r.i64(),
        status: r.u8(),
        winningOutcome: r.u8(),
        feeBps: r.u16(),
        openSets: r.u64(),
        volumeLamports: r.u64(),
        fillCount: r.u64(),
        accruedFees: r.u64(),
        createdAt: r.i64(),
    };
}

export interface BalanceV2Data {
    owner: PublicKey;
    available: bigint;
    totalDeposited: bigint;
    totalWithdrawn: bigint;
}

export function parseBalanceV2(data: Uint8Array): BalanceV2Data {
    const r = new Reader(data);
    return {
        owner: r.pubkey(),
        available: r.u64(),
        totalDeposited: r.u64(),
        totalWithdrawn: r.u64(),
    };
}

export interface PositionV2Data {
    market: PublicKey;
    owner: PublicKey;
    outcomeIndex: number;
    shares: bigint;
    costLamports: bigint;
    proceedsLamports: bigint;
    redeemedShares: bigint;
    redeemedLamports: bigint;
}

export function parsePositionV2(data: Uint8Array): PositionV2Data {
    const r = new Reader(data);
    return {
        market: r.pubkey(),
        owner: r.pubkey(),
        outcomeIndex: r.u8(),
        shares: r.u64(),
        costLamports: r.u64(),
        proceedsLamports: r.u64(),
        redeemedShares: r.u64(),
        redeemedLamports: r.u64(),
    };
}

export interface OrderFillStateV2Data {
    orderHash: Uint8Array;
    maker: PublicKey;
    market: PublicKey;
    filled: bigint;
    cancelled: boolean;
}

export function parseOrderFillStateV2(data: Uint8Array): OrderFillStateV2Data {
    const r = new Reader(data);
    return {
        orderHash: r.bytes32(),
        maker: r.pubkey(),
        market: r.pubkey(),
        filled: r.u64(),
        cancelled: r.bool(),
    };
}
