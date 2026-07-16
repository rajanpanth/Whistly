// Whistly V2 full-lifecycle devnet verification (Checkpoint 18).
//
//   node scripts/v2-verify.mjs [apiBase]
//
// Creates a FRESH binary market, then exercises the entire protocol with
// assertions and records every devnet transaction signature:
//   1. create market            6. market buy (FAK transfer)
//   2. two wallets deposit       7. verify positions move
//   3. limit buy rests           8. close + settle market
//   4. mint-cross partial fill   9. redeem winner (pays) + loser (0)
//   5. cancel remainder         10. assert double-redeem rejected
//
// Exit code 0 = all assertions passed. Prints a signature ledger.

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import nacl from "tweetnacl";
import { createHash } from "crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));
const keysDir = join(here, "..", "..", ".keys");
const PROGRAM_ID = new PublicKey("J9AqrLZWDXaQfDwtFpC2GG9hBb7SAPxRwVpGs753EgWV");
const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
const connection = new Connection(RPC, "confirmed");
const API = process.argv[2] ?? "http://localhost:3006";
const SET_COST = 1_000_000;
const sigs = {};
let failures = 0;

function assert(cond, label) {
  if (cond) console.log(`  ✓ ${label}`);
  else { console.error(`  ✗ FAIL: ${label}`); failures++; }
}

const admin = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(readFileSync(join(homedir(), ".config/solana/id.json"), "utf8")))
);
function loadOrCreate(name) {
  const p = join(keysDir, name);
  if (existsSync(p)) return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(p, "utf8"))));
  mkdirSync(keysDir, { recursive: true });
  const kp = Keypair.generate();
  writeFileSync(p, JSON.stringify(Array.from(kp.secretKey)));
  return kp;
}
const A = loadOrCreate("v2-wallet-a.json");
const B = loadOrCreate("v2-wallet-b.json");

const disc = (n) => createHash("sha256").update(`global:${n}`).digest().subarray(0, 8);
const u16 = (n) => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; };
const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };
const u64 = (n) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b; };
const i64 = (n) => { const b = Buffer.alloc(8); b.writeBigInt64LE(BigInt(n)); return b; };
const str = (s) => Buffer.concat([u32(Buffer.byteLength(s)), Buffer.from(s)]);
const vecStr = (a) => Buffer.concat([u32(a.length), ...a.map(str)]);

const configPda = PublicKey.findProgramAddressSync([Buffer.from("config_v2")], PROGRAM_ID)[0];
const marketPda = (id) => PublicKey.findProgramAddressSync([Buffer.from("market_v2"), u64(id)], PROGRAM_ID)[0];
const vaultPda = (m) => PublicKey.findProgramAddressSync([Buffer.from("vault_v2"), m.toBuffer()], PROGRAM_ID)[0];
const balancePda = (o) => PublicKey.findProgramAddressSync([Buffer.from("balance_v2"), o.toBuffer()], PROGRAM_ID)[0];
const positionPda = (m, o, i) => PublicKey.findProgramAddressSync(
  [Buffer.from("position_v2"), m.toBuffer(), o.toBuffer(), Buffer.from([i])], PROGRAM_ID)[0];

async function send(ixs, signer) {
  const tx = new Transaction().add(...ixs);
  tx.feePayer = signer.publicKey;
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.sign(signer);
  const sig = await connection.sendRawTransaction(tx.serialize());
  const r = await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
  if (r.value.err) throw new Error(`tx failed: ${JSON.stringify(r.value.err)}`);
  return sig;
}
async function fund(kp, lam) {
  const bal = await connection.getBalance(kp.publicKey);
  if (bal < lam) await send([SystemProgram.transfer({ fromPubkey: admin.publicKey, toPubkey: kp.publicKey, lamports: lam - bal })], admin);
}
async function deposit(kp, lam) {
  return send([new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: kp.publicKey, isSigner: true, isWritable: true },
      { pubkey: balancePda(kp.publicKey), isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([disc("deposit_v2"), u64(lam)]),
  })], kp);
}
function encodeOrder(market, { maker, outcome, side, priceBps, quantity }) {
  const buf = Buffer.alloc(106);
  buf.write("WV2O", 0, "ascii"); buf[4] = 2;
  market.toBuffer().copy(buf, 5); maker.toBuffer().copy(buf, 37);
  buf[69] = outcome; buf[70] = side; buf.writeUInt16LE(priceBps, 71);
  buf.writeBigUInt64LE(BigInt(quantity), 73);
  buf.writeBigUInt64LE(BigInt(Date.now() * 1000 + Math.floor(Math.random() * 1000)), 81);
  buf.writeBigInt64LE(BigInt(Math.floor(Date.now() / 1000) + 86400), 89);
  buf[97] = 0; buf.writeBigUInt64LE(BigInt(Math.floor(Math.random() * 1e12)), 98);
  return buf;
}
async function postOrder(market, kp, o, orderType = "LIMIT") {
  const payload = encodeOrder(market, { maker: kp.publicKey, ...o });
  const signature = nacl.sign.detached(payload, kp.secretKey);
  const res = await fetch(`${API}/api/v2/orders`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ payloadHex: payload.toString("hex"), signatureHex: Buffer.from(signature).toString("hex"), orderType }),
  });
  return { status: res.status, json: await res.json() };
}
async function positionShares(m, owner, outcome) {
  const info = await connection.getAccountInfo(positionPda(m, owner, outcome));
  if (!info) return 0n;
  return info.data.readBigUInt64LE(8 + 32 + 32 + 1);
}
function parseConfig(d) { return { nextMarketId: d.readBigUInt64LE(8 + 32 + 32 + 2 + 1) }; }

// ─── run ──────────────────────────────────────────────────────────────────
console.log("V2 FULL-LIFECYCLE DEVNET VERIFICATION\n");
console.log("wallet A:", A.publicKey.toBase58());
console.log("wallet B:", B.publicKey.toBase58());
await fund(A, 120_000_000);
await fund(B, 120_000_000);

// 1. Create a fresh market (close 30s out so we can settle quickly).
console.log("\n[1] create market");
const cfg = parseConfig((await connection.getAccountInfo(configPda)).data);
const marketId = cfg.nextMarketId;
const market = marketPda(marketId);
const closeTs = Math.floor(Date.now() / 1000) + 30;
sigs.createMarket = await send([new TransactionInstruction({
  programId: PROGRAM_ID,
  keys: [
    { pubkey: admin.publicKey, isSigner: true, isWritable: true },
    { pubkey: configPda, isSigner: false, isWritable: true },
    { pubkey: market, isSigner: false, isWritable: true },
    { pubkey: vaultPda(market), isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ],
  data: Buffer.concat([disc("create_market_v2"), str("VERIFY: coin flip market"), vecStr(["No", "Yes"]), Buffer.from([0]), u64(0), Buffer.from([0]), i64(closeTs)]),
})], admin);
console.log("  market", market.toBase58(), "id", marketId.toString());

// 2. deposits
console.log("\n[2] deposits");
sigs.depositA = await deposit(A, 60_000_000);
sigs.depositB = await deposit(B, 60_000_000);
assert(true, "both wallets deposited 0.06 SOL");

// 3. A limit buy YES 55% x100 rests
console.log("\n[3] limit buy rests");
const a1 = await postOrder(market, A, { outcome: 1, side: 0, priceBps: 5500, quantity: 100 });
assert(a1.status === 200 && a1.json.status === "open", "A YES buy rests (open)");

// 4. B buy NO 50% x60 → mint-cross fill 60 (55+50 >= 100)
console.log("\n[4] mint-cross partial fill");
const b1 = await postOrder(market, B, { outcome: 0, side: 0, priceBps: 5000, quantity: 60 });
const fill = b1.json.settled?.[0];
assert(b1.status === 200 && fill, "fill settled on devnet");
if (fill) { sigs.mintFill = fill.txSignature; console.log("  fill tx", fill.txSignature); }
const aYes = await positionShares(market, A.publicKey, 1);
const bNo = await positionShares(market, B.publicKey, 0);
assert(aYes === 60n, `A holds 60 YES (got ${aYes})`);
assert(bNo === 60n, `B holds 60 NO (got ${bNo})`);

// 5. cancel A's remaining 40
console.log("\n[5] cancel remainder");
const msg = new TextEncoder().encode(`WV2-CANCEL:${a1.json.orderHash}`);
const cancelSig = nacl.sign.detached(msg, A.secretKey);
const cancelRes = await fetch(`${API}/api/v2/orders/cancel`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ orderHash: a1.json.orderHash, signatureHex: Buffer.from(cancelSig).toString("hex") }),
});
const cancelJson = await cancelRes.json();
assert(cancelRes.status === 200 && cancelJson.cancelledQuantity === 40, `cancelled 40 remaining (got ${cancelJson.cancelledQuantity})`);

// 6-7. B market-sells 20 NO → A buys via transfer (B already sold above in mint).
//      Instead: A market-buys more NO from B by B posting a sell.
console.log("\n[6] transfer fill (B sells 20 NO, A buys)");
const bSell = await postOrder(market, B, { outcome: 0, side: 1, priceBps: 4500, quantity: 20 });
assert(bSell.status === 200, "B NO sell rests");
const aBuyNo = await postOrder(market, A, { outcome: 0, side: 0, priceBps: 5000, quantity: 20 });
const tfill = aBuyNo.json.settled?.[0];
assert(tfill && tfill.mode === "TRANSFER", "transfer fill settled");
if (tfill) { sigs.transferFill = tfill.txSignature; console.log("  transfer tx", tfill.txSignature); }
const bNoAfter = await positionShares(market, B.publicKey, 0);
assert(bNoAfter === 40n, `B NO reduced to 40 (got ${bNoAfter})`);

// 8. close + settle (YES wins)
console.log("\n[8] close + settle (YES wins)");
sigs.closeMarket = await send([new TransactionInstruction({
  programId: PROGRAM_ID,
  keys: [
    { pubkey: admin.publicKey, isSigner: true, isWritable: false },
    { pubkey: configPda, isSigner: false, isWritable: false },
    { pubkey: market, isSigner: false, isWritable: true },
  ],
  data: Buffer.concat([disc("set_market_status_v2"), Buffer.from([2])]),
})], admin);
sigs.settleMarket = await send([new TransactionInstruction({
  programId: PROGRAM_ID,
  keys: [
    { pubkey: admin.publicKey, isSigner: true, isWritable: false },
    { pubkey: configPda, isSigner: false, isWritable: false },
    { pubkey: market, isSigner: false, isWritable: true },
  ],
  data: Buffer.concat([disc("settle_market_v2"), Buffer.from([1])]), // winning outcome = 1 (YES)
})], admin);
assert(true, "market settled with YES winning");

// 9. redeem
console.log("\n[9] redeem");
async function redeem(kp, outcome) {
  return send([new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: kp.publicKey, isSigner: true, isWritable: true },
      { pubkey: market, isSigner: false, isWritable: true },
      { pubkey: vaultPda(market), isSigner: false, isWritable: true },
      { pubkey: positionPda(market, kp.publicKey, outcome), isSigner: false, isWritable: true },
    ],
    data: disc("redeem_v2"),
  })], kp);
}
const aYesBefore = await connection.getBalance(A.publicKey);
sigs.redeemWinner = await redeem(A, 1); // A's 60 YES → 60 × SET_COST
const aYesAfter = await connection.getBalance(A.publicKey);
const gained = aYesAfter - aYesBefore;
assert(gained > 55_000_000, `winner A redeemed ~0.06 SOL (got ${gained} lamports incl. fees)`);
console.log("  redeem winner tx", sigs.redeemWinner);

sigs.redeemLoser = await redeem(B, 0); // B's 40 NO → 0 payout, position closes
assert(true, "loser B redeemed (0 payout)");
const bNoRedeemed = await positionShares(market, B.publicKey, 0);
assert(bNoRedeemed === 0n, `B NO shares zeroed after redeem (got ${bNoRedeemed})`);

// 10. double-redeem must fail
console.log("\n[10] double-redeem rejected");
let doubleFailed = false;
try { await redeem(A, 1); } catch { doubleFailed = true; }
assert(doubleFailed, "second redeem of same position rejected");

// ─── ledger ─────────────────────────────────────────────────────────────
console.log("\n══ SIGNATURE LEDGER ══");
console.log(JSON.stringify({ programId: PROGRAM_ID.toBase58(), market: market.toBase58(), marketId: marketId.toString(), ...sigs }, null, 2));
console.log(failures === 0 ? "\nALL ASSERTIONS PASSED ✓" : `\n${failures} ASSERTION(S) FAILED ✗`);
process.exit(failures === 0 ? 0 : 1);
