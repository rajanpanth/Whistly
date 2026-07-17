// Rotate the V2 matching-engine operator key.
//
//   node scripts/rotate-operator.mjs <new-operator-keypair.json>
//
// 1. Sends update_config_v2 { new_operator: Some(pubkey) } signed by the
//    config admin (~/.config/solana/id.json).
// 2. Moves the old operator's SOL (minus fee headroom) to the new operator
//    so it can keep paying fill-state rent.
// Nothing secret is printed.

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
const RPC = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";

const loadKeypair = (p) =>
  Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(p, "utf8"))));

const newOperatorPath = process.argv[2];
if (!newOperatorPath) {
  console.error("usage: node scripts/rotate-operator.mjs <new-operator-keypair.json>");
  process.exit(1);
}

const admin = loadKeypair(join(homedir(), ".config", "solana", "id.json"));
const oldOperator = loadKeypair(join(process.cwd(), "..", ".keys", "v2-operator.json"));
const newOperator = loadKeypair(newOperatorPath);

const connection = new Connection(RPC, "confirmed");
const [configPda] = PublicKey.findProgramAddressSync([Buffer.from("config_v2")], PROGRAM_ID);

// anchor discriminator: sha256("global:update_config_v2")[0..8]
const disc = createHash("sha256").update("global:update_config_v2").digest().subarray(0, 8);

// args: Option<Pubkey> new_admin = None, Option<Pubkey> new_operator = Some,
//       Option<u16> new_fee_bps = None, Option<bool> paused = None
const data = Buffer.concat([
  disc,
  Buffer.from([0]),                       // new_admin: None
  Buffer.from([1]),                       // new_operator: Some
  newOperator.publicKey.toBuffer(),
  Buffer.from([0]),                       // new_fee_bps: None
  Buffer.from([0]),                       // paused: None
]);

const ix = new TransactionInstruction({
  programId: PROGRAM_ID,
  keys: [
    { pubkey: admin.publicKey, isSigner: true, isWritable: false },
    { pubkey: configPda, isSigner: false, isWritable: true },
  ],
  data,
});

const tx = new Transaction().add(ix);
const sig = await connection.sendTransaction(tx, [admin], { skipPreflight: false });
await connection.confirmTransaction(sig, "confirmed");
console.log("update_config_v2 tx:", sig);

// Fund the new operator from the old one (leave 0.01 SOL for any stragglers).
const oldBalance = await connection.getBalance(oldOperator.publicKey);
const keep = 10_000_000;
const move = oldBalance - keep - 5_000;
if (move > 0) {
  const fundTx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: oldOperator.publicKey,
      toPubkey: newOperator.publicKey,
      lamports: move,
    })
  );
  const fundSig = await connection.sendTransaction(fundTx, [oldOperator]);
  await connection.confirmTransaction(fundSig, "confirmed");
  console.log(`funded new operator with ${(move / 1e9).toFixed(4)} SOL:`, fundSig);
} else {
  console.log("old operator balance too low to transfer; fund the new operator manually");
}

// Read back the config to confirm.
const info = await connection.getAccountInfo(configPda);
const operatorOnChain = new PublicKey(info.data.subarray(8 + 32, 8 + 64)).toBase58();
console.log("on-chain operator now:", operatorOnChain);
console.log("expected:            ", newOperator.publicKey.toBase58());
console.log(operatorOnChain === newOperator.publicKey.toBase58() ? "ROTATION CONFIRMED" : "MISMATCH — check ConfigV2 layout");
