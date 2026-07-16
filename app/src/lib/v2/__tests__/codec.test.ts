// Mock @solana/web3.js with a minimal PublicKey so this test exercises the
// byte layout without pulling in web3's ESM runtime (jayson/rpc-websockets).
jest.mock("@solana/web3.js", () => {
    // Minimal 32-byte key double; content need only be stable per input.
    class PublicKey {
        private bytes: Uint8Array;
        constructor(value: string | Uint8Array | number[]) {
            if (typeof value === "string") {
                const b = new Uint8Array(32);
                for (let i = 0; i < value.length && i < 32; i++) b[i] = value.charCodeAt(i) & 0xff;
                this.bytes = b;
            } else {
                const b = new Uint8Array(32);
                b.set(Uint8Array.from(value).slice(0, 32));
                this.bytes = b;
            }
        }
        toBytes() {
            return this.bytes;
        }
        toBase58() {
            return Array.from(this.bytes)
                .map((x) => x.toString(16).padStart(2, "0"))
                .join("");
        }
    }
    return { PublicKey };
});

import { PublicKey } from "@solana/web3.js";
import {
    encodeOrderV2,
    decodeOrderV2,
    hashOrderV2,
    buyCostLamports,
    bpsToProbability,
    probabilityToBps,
    ORDER_PAYLOAD_LEN,
    SIDE_BUY,
    TIF_GTC,
    LAMPORTS_PER_BP,
    SET_COST,
    PRICE_SCALE,
} from "../codec";

describe("V2 order codec", () => {
    const sample = {
        market: new PublicKey("8wwPeFaLdC9pcPFjETweWf8UTYxh9nCSFd9vvAE6xb4s"),
        maker: new PublicKey("5cR5PY9VVtAij6qAaifqRqKcDK2xbzYUiibzDZvgsVQo"),
        outcomeIndex: 1,
        side: SIDE_BUY as 0,
        priceBps: 5400,
        quantity: 100n,
        nonce: 1234567890n,
        expiry: 1800000000n,
        tif: TIF_GTC as 0,
        salt: 42n,
    };

    it("encodes to exactly the on-chain payload length (106)", () => {
        expect(encodeOrderV2(sample).length).toBe(ORDER_PAYLOAD_LEN);
        expect(ORDER_PAYLOAD_LEN).toBe(106);
    });

    it("round-trips encode → decode losslessly", () => {
        const decoded = decodeOrderV2(encodeOrderV2(sample))!;
        expect(decoded.outcomeIndex).toBe(1);
        expect(decoded.side).toBe(SIDE_BUY);
        expect(decoded.priceBps).toBe(5400);
        expect(decoded.quantity).toBe(100n);
        expect(decoded.nonce).toBe(1234567890n);
        expect(decoded.expiry).toBe(1800000000n);
        expect(decoded.salt).toBe(42n);
    });

    it("starts with the WV2O magic + version byte 2", () => {
        const bytes = encodeOrderV2(sample);
        expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("WV2O");
        expect(bytes[4]).toBe(2);
    });

    it("packs price/quantity at the exact byte offsets Rust reads", () => {
        const bytes = encodeOrderV2(sample);
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        expect(bytes[69]).toBe(1); // outcome_index
        expect(bytes[70]).toBe(0); // side BUY
        expect(view.getUint16(71, true)).toBe(5400); // price_bps
        expect(view.getBigUint64(73, true)).toBe(100n); // quantity
    });

    it("rejects payloads of the wrong length or magic", () => {
        expect(decodeOrderV2(new Uint8Array(105))).toBeNull();
        const bad = encodeOrderV2(sample);
        bad[0] = 0;
        expect(decodeOrderV2(bad)).toBeNull();
    });

    it("hash is deterministic, 32 bytes, salt-sensitive", async () => {
        const h1 = await hashOrderV2(encodeOrderV2(sample));
        const h2 = await hashOrderV2(encodeOrderV2(sample));
        expect(h1.length).toBe(32);
        expect(Array.from(h1)).toEqual(Array.from(h2));
        const h3 = await hashOrderV2(encodeOrderV2({ ...sample, salt: 43n }));
        expect(Array.from(h1)).not.toEqual(Array.from(h3));
    });
});

describe("V2 price math (matches state_v2.rs constants)", () => {
    it("SET_COST / PRICE_SCALE = LAMPORTS_PER_BP", () => {
        expect(SET_COST).toBe(1_000_000);
        expect(PRICE_SCALE).toBe(10_000);
        expect(LAMPORTS_PER_BP).toBe(100);
    });

    it("buy cost is integer-exact: price_bps × 100 × qty", () => {
        expect(buyCostLamports(5400, 100n)).toBe(5400n * 100n * 100n);
        expect(buyCostLamports(100, 1n)).toBe(10_000n);
    });

    it("bps ↔ probability conversion", () => {
        expect(bpsToProbability(5400)).toBe(54);
        expect(bpsToProbability(5450)).toBe(54.5);
        expect(probabilityToBps(54)).toBe(5400);
    });

    it("complementary binary prices fund exactly one set", () => {
        const p = 5400;
        expect((p + (PRICE_SCALE - p)) * LAMPORTS_PER_BP).toBe(SET_COST);
    });
});
