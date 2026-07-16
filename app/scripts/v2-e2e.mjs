// Whistly V2 end-to-end devnet exercise.
//
//   node scripts/v2-e2e.mjs <marketPda> [apiBase]
//
// Uses two throwaway wallets (.keys/v2-wallet-a.json / -b.json at repo root,
// created + funded from the admin wallet if missing):
//   1. deposit into BalanceV2 for both
//   2. A posts limit BUY YES 54% × 100 (GTC)  → rests
//   3. B posts limit BUY NO  47% × 60  (GTC)  → mint-cross fills 60
//   4. verify positions on-chain + book shows A's 40 remaining
//   5. B posts SELL NO 40% × 20 — no matching YES-side sell book → rests;
//      then A posts SELL YES 65% × 20 → burn-cross (65+40 > 100? NO:
//      burn requires sum ≤ 100 → 65+40=105 does not cross; adjusts) …
//      (kept simple: step 5 exercises TRANSFER: B sells 20 NO @ 40%,
//       C… — actually A buys NO? see inline comments)
//   6. cancel remainder of A's YES order, verify book empty of it
// Every fill line prints the devnet tx signature.

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

const MARKET = new PublicKey(process.argv[2] ?? "8wwPeFaLdC9pcPFjETweWf8UTYxh9nCSFd9vvAE6xb4s");
const API = process.argv[3] ?? "http://localhost:3006";

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
const walletA = loadOrCreate("v2-wallet-a.json");
const walletB = loadOrCreate("v2-wallet-b.json");

const disc = (name) => createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
const u64 = (n) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b; };
const balancePda = (owner) =>
  PublicKey.findProgramAddressSync([Buffer.from("balance_v2"), owner.toBuffer()], PROGRAM_ID)[0];
const positionPda = (market, owner, outcome) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("position_v2"), market.toBuffer(), owner.toBuffer(), Buffer.from([outcome])],
    PROGRAM_ID
  )[0];

async function sendTx(ixs, signer) {
  const tx = new Transaction().add(...ixs);
  tx.feePayer = signer.publicKey;
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.sign(signer);
  const sig = await connection.sendRawTransaction(tx.serialize());
  const res = await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
  if (res.value.err) throw new Error(`tx failed: ${JSON.stringify(res.value.err)}`);
  return sig;
}

async function ensureFunded(kp, lamports) {
  const bal = await connection.getBalance(kp.publicKey);
  if (bal >= lamports) return;
  const sig = await sendTx(
    [SystemProgram.transfer({ fromPubkey: admin.publicKey, toPubkey: kp.publicKey, lamports: lamports - bal })],
    admin
  );
  console.log(`funded ${kp.publicKey.toBase58().slice(0, 8)}…: ${sig}`);
}

async function deposit(kp, lamports) {
  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: kp.publicKey, isSigner: true, isWritable: true },
      { pubkey: balancePda(kp.publicKey), isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([disc("deposit_v2"), u64(lamports)]),
  });
  const sig = await sendTx([ix], kp);
  console.log(`deposit_v2 ${kp.publicKey.toBase58().slice(0, 8)}…: ${sig}`);
}

// Canonical order payload (must match codec.ts / state_v2.rs).
function encodeOrder({ maker, outcome, side, priceBps, quantity, nonce, expiry, tif, salt }) {
  const buf = Buffer.alloc(106);
  buf.write("WV2O", 0, "ascii");
  buf[4] = 2;
  MARKET.toBuffer().copy(buf, 5);
  maker.toBuffer().copy(buf, 37);
  buf[69] = outcome;
  buf[70] = side;
  buf.writeUInt16LE(priceBps, 71);
  buf.writeBigUInt64LE(BigInt(quantity), 73);
  buf.writeBigUInt64LE(BigInt(nonce), 81);
  buf.writeBigInt64LE(BigInt(expiry), 89);
  buf[97] = tif;
  buf.writeBigUInt64LE(BigInt(salt), 98);
  return buf;
}

async function postOrder(kp, { outcome, side, priceBps, quantity, tif = 0, orderType = "LIMIT" }) {
  const payload = encodeOrder({
    maker: kp.publicKey,
    outcome,
    side,
    priceBps,
    quantity,
    nonce: Date.now() * 1000 + Math.floor(Math.random() * 1000),
    expiry: Math.floor(Date.now() / 1000) + 86400,
    tif,
    salt: Math.floor(Math.random() * 1e12),
  });
  const signature = nacl.sign.detached(payload, kp.secretKey);
  const res = await fetch(`${API}/api/v2/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      payloadHex: payload.toString("hex"),
      signatureHex: Buffer.from(signature).toString("hex"),
      orderType,
    }),
  });
  const json = await res.json();
  console.log(
    `order ${side === 0 ? "BUY" : "SELL"} o${outcome} @${priceBps} x${quantity} →`,
    res.status,
    JSON.stringify(json).slice(0, 400)
  );
  return json;
}

async function cancelOrder(kp, orderHash) {
  const msg = new TextEncoder().encode(`WV2-CANCEL:${orderHash}`);
  const signature = nacl.sign.detached(msg, kp.secretKey);
  const res = await fetch(`${API}/api/v2/orders/cancel`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ orderHash, signatureHex: Buffer.from(signature).toString("hex") }),
  });
  console.log("cancel →", res.status, JSON.stringify(await res.json()));
}

async function showPositions(label, kp) {
  for (const outcome of [0, 1]) {
    const info = await connection.getAccountInfo(positionPda(MARKET, kp.publicKey, outcome));
    if (!info) continue;
    const d = info.data;
    const shares = d.readBigUInt64LE(8 + 32 + 32 + 1);
    console.log(`${label} outcome ${outcome}: ${shares} shares`);
  }
  const bal = await connection.getAccountInfo(balancePda(kp.publicKey));
  if (bal) console.log(`${label} balance available: ${bal.data.readBigUInt64LE(8 + 32)} lamports`);
}

async function showBook() {
  const res = await fetch(`${API}/api/v2/book/${MARKET.toBase58()}?outcome=1`);
  const b = await res.json();
  console.log(
    "BOOK(YES): bids",
    b.bids?.map((l) => `${l.priceBps}x${l.quantity}`),
    "asks",
    b.asks?.map((l) => `${l.priceBps}x${l.quantity}`),
    "last",
    b.lastTradeBps
  );
}

// ── run ──
console.log("wallet A:", walletA.publicKey.toBase58());
console.log("wallet B:", walletB.publicKey.toBase58());
await ensureFunded(walletA, 100_000_000);
await ensureFunded(walletB, 100_000_000);

const balA = await connection.getAccountInfo(balancePda(walletA.publicKey));
if (!balA) await deposit(walletA, 80_000_000);
const balB = await connection.getAccountInfo(balancePda(walletB.publicKey));
if (!balB) await deposit(walletB, 80_000_000);

console.log("\n— step 1: A posts LIMIT BUY YES 54% × 100 (rests) —");
const a1 = await postOrder(walletA, { outcome: 1, side: 0, priceBps: 5400, quantity: 100 });
await showBook();

console.log("\n— step 2: B posts LIMIT BUY NO 47% × 60 (mint-cross → fill 60) —");
await postOrder(walletB, { outcome: 0, side: 0, priceBps: 4700, quantity: 60 });
await showBook();
await showPositions("A", walletA);
await showPositions("B", walletB);

console.log("\n— step 3: B SELLs 20 NO @ 40% (rests as YES-ask mirror) —");
await postOrder(walletB, { outcome: 0, side: 1, priceBps: 4000, quantity: 20 });
await showBook();

console.log("\n— step 4: A market-buys… actually A LIMIT BUY NO 45% × 20 → TRANSFER from B's sell —");
await postOrder(walletA, { outcome: 0, side: 0, priceBps: 4500, quantity: 20 });
await showPositions("A", walletA);
await showPositions("B", walletB);

console.log("\n— step 5: cancel A's remaining YES buy —");
if (a1?.orderHash) await cancelOrder(walletA, a1.orderHash);
await showBook();

console.log("\nE2E complete.");
