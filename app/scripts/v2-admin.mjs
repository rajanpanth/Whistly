// Whistly V2 admin CLI (devnet).
// Usage:
//   node scripts/v2-admin.mjs init-config <operatorPubkey> <feeBps>
//   node scripts/v2-admin.mjs create-market "<title>" "<outcome0,outcome1,…>" <marketType> <fixtureId> <resolutionSource> <closeUnixTs>
//   node scripts/v2-admin.mjs status
//   node scripts/v2-admin.mjs settle <marketId> <winningOutcome>
//   node scripts/v2-admin.mjs close <marketId>
// Signs with ~/.config/solana/id.json (the V2 admin / upgrade authority).

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { createHash } from "crypto";
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const PROGRAM_ID = new PublicKey("J9AqrLZWDXaQfDwtFpC2GG9hBb7SAPxRwVpGs753EgWV");
const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
const connection = new Connection(RPC, "confirmed");

const admin = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(readFileSync(join(homedir(), ".config/solana/id.json"), "utf8")))
);

const disc = (name) => createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
const accDisc = (name) => createHash("sha256").update(`account:${name}`).digest().subarray(0, 8);
const u16 = (n) => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; };
const u64 = (n) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b; };
const i64 = (n) => { const b = Buffer.alloc(8); b.writeBigInt64LE(BigInt(n)); return b; };
const str = (s) => { const x = Buffer.from(s, "utf8"); return Buffer.concat([u32(x.length), x]); };
const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };
const vecStr = (items) => Buffer.concat([u32(items.length), ...items.map(str)]);

const [configPda] = PublicKey.findProgramAddressSync([Buffer.from("config_v2")], PROGRAM_ID);
const marketPda = (id) =>
  PublicKey.findProgramAddressSync([Buffer.from("market_v2"), u64(id)], PROGRAM_ID)[0];
const vaultPda = (market) =>
  PublicKey.findProgramAddressSync([Buffer.from("vault_v2"), market.toBuffer()], PROGRAM_ID)[0];

async function send(ixs) {
  const tx = new Transaction().add(...ixs);
  tx.feePayer = admin.publicKey;
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.sign(admin);
  const sig = await connection.sendRawTransaction(tx.serialize());
  const res = await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
  if (res.value.err) throw new Error(`tx failed: ${JSON.stringify(res.value.err)}`);
  return sig;
}

function parseConfig(data) {
  let o = 8;
  const adminPk = new PublicKey(data.subarray(o, o + 32)); o += 32;
  const operator = new PublicKey(data.subarray(o, o + 32)); o += 32;
  const feeBps = data.readUInt16LE(o); o += 2;
  const paused = data[o] === 1; o += 1;
  const nextMarketId = data.readBigUInt64LE(o);
  return { adminPk, operator, feeBps, paused, nextMarketId };
}

const cmd = process.argv[2];

if (cmd === "init-config") {
  const operator = new PublicKey(process.argv[3]);
  const feeBps = Number(process.argv[4] ?? "100");
  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: admin.publicKey, isSigner: true, isWritable: true },
      { pubkey: configPda, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([disc("init_config_v2"), operator.toBuffer(), u16(feeBps)]),
  });
  const sig = await send([ix]);
  console.log("init_config_v2:", sig);
  console.log("config PDA:", configPda.toBase58());
} else if (cmd === "create-market") {
  const [, , , title, outcomesCsv, marketType, fixtureId, resolutionSource, closeTs] = process.argv;
  const info = await connection.getAccountInfo(configPda);
  if (!info) throw new Error("config_v2 not initialized");
  const { nextMarketId } = parseConfig(info.data);
  const market = marketPda(nextMarketId);
  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: admin.publicKey, isSigner: true, isWritable: true },
      { pubkey: configPda, isSigner: false, isWritable: true },
      { pubkey: market, isSigner: false, isWritable: true },
      { pubkey: vaultPda(market), isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([
      disc("create_market_v2"),
      str(title),
      vecStr(outcomesCsv.split(",")),
      Buffer.from([Number(marketType)]),
      u64(Number(fixtureId)),
      Buffer.from([Number(resolutionSource)]),
      i64(Number(closeTs)),
    ]),
  });
  const sig = await send([ix]);
  console.log("create_market_v2:", sig);
  console.log("marketId:", nextMarketId.toString());
  console.log("market PDA:", market.toBase58());
} else if (cmd === "status") {
  const info = await connection.getAccountInfo(configPda);
  if (!info) { console.log("config_v2: NOT INITIALIZED"); process.exit(0); }
  const c = parseConfig(info.data);
  console.log("config_v2:", configPda.toBase58());
  console.log("admin:", c.adminPk.toBase58());
  console.log("operator:", c.operator.toBase58());
  console.log("feeBps:", c.feeBps, "paused:", c.paused, "nextMarketId:", c.nextMarketId.toString());
  const markets = await connection.getProgramAccounts(PROGRAM_ID, {
    filters: [{ memcmp: { offset: 0, bytes: bs58encode(accDisc("MarketV2")) } }],
  });
  for (const { pubkey, account } of markets) {
    const d = account.data;
    const marketId = d.readBigUInt64LE(8);
    const titleLen = d.readUInt32LE(8 + 8 + 1);
    const title = d.subarray(8 + 8 + 1 + 4, 8 + 8 + 1 + 4 + titleLen).toString();
    console.log(`market #${marketId} ${pubkey.toBase58()} "${title}"`);
  }
} else if (cmd === "settle" || cmd === "close") {
  const marketId = Number(process.argv[3]);
  const market = marketPda(marketId);
  const keys = [
    { pubkey: admin.publicKey, isSigner: true, isWritable: false },
    { pubkey: configPda, isSigner: false, isWritable: false },
    { pubkey: market, isSigner: false, isWritable: true },
  ];
  const data =
    cmd === "settle"
      ? Buffer.concat([disc("settle_market_v2"), Buffer.from([Number(process.argv[4])])])
      : Buffer.concat([disc("set_market_status_v2"), Buffer.from([2])]);
  const sig = await send([new TransactionInstruction({ programId: PROGRAM_ID, keys, data })]);
  console.log(`${cmd}:`, sig, "market:", market.toBase58());
} else if (cmd === "propose") {
  // node scripts/v2-admin.mjs propose <marketId> <winningOutcome>
  // Data-resolved (TxLINE) markets: proposes the outcome; finalizable by
  // anyone after the 1h dispute window.
  const marketId = Number(process.argv[3]);
  const market = marketPda(marketId);
  const [proposal] = PublicKey.findProgramAddressSync(
    [Buffer.from("resolution_v2"), market.toBuffer()], PROGRAM_ID);
  const keys = [
    { pubkey: admin.publicKey, isSigner: true, isWritable: true },
    { pubkey: configPda, isSigner: false, isWritable: false },
    { pubkey: market, isSigner: false, isWritable: false },
    { pubkey: proposal, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];
  const data = Buffer.concat([disc("propose_settle_market_v2"), Buffer.from([Number(process.argv[4])])]);
  const sig = await send([new TransactionInstruction({ programId: PROGRAM_ID, keys, data })]);
  console.log("proposed:", sig, "market:", market.toBase58(), "proposal:", proposal.toBase58());
} else if (cmd === "finalize") {
  // node scripts/v2-admin.mjs finalize <marketId> — permissionless after window.
  const marketId = Number(process.argv[3]);
  const market = marketPda(marketId);
  const [proposal] = PublicKey.findProgramAddressSync(
    [Buffer.from("resolution_v2"), market.toBuffer()], PROGRAM_ID);
  const keys = [
    { pubkey: admin.publicKey, isSigner: true, isWritable: false },
    { pubkey: market, isSigner: false, isWritable: true },
    { pubkey: proposal, isSigner: false, isWritable: false },
  ];
  const data = disc("finalize_settle_market_v2");
  const sig = await send([new TransactionInstruction({ programId: PROGRAM_ID, keys, data })]);
  console.log("finalized:", sig, "market:", market.toBase58());
} else {
  console.log("unknown command");
  process.exit(1);
}

function bs58encode(buf) {
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let x = BigInt("0x" + buf.toString("hex"));
  let out = "";
  while (x > 0n) { out = ALPHABET[Number(x % 58n)] + out; x /= 58n; }
  for (const b of buf) { if (b === 0) out = "1" + out; else break; }
  return out;
}
