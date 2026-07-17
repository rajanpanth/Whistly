// One-time setup: put the V2 admin behind a Squads v4 multisig (devnet).
//
//   node scripts/setup-squads-admin.mjs <second-member-pubkey>
//
// Order of operations is lockout-safe:
//   1. create 2-member multisig (threshold 1) + fund the vault
//   2. PROVE the propose→approve→execute flow with a harmless vault transfer
//   3. only then rotate config_v2.admin to the vault PDA
//   4. PROVE an admin instruction (no-op update_config_v2) executes via the vault
//
// The createKey (multisig derivation seed) and addresses are written to
// ../.keys/squads-admin.json for the ops tooling.

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
} from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import { createHash } from "crypto";
import { readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const PROGRAM_ID = new PublicKey("J9AqrLZWDXaQfDwtFpC2GG9hBb7SAPxRwVpGs753EgWV");
const RPC = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const { Permissions } = multisig.types;

const secondMemberArg = process.argv[2];
if (!secondMemberArg) {
  console.error("usage: node scripts/setup-squads-admin.mjs <second-member-pubkey>");
  process.exit(1);
}
const secondMember = new PublicKey(secondMemberArg);

const me = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(readFileSync(join(homedir(), ".config", "solana", "id.json"), "utf8")))
);
const connection = new Connection(RPC, "confirmed");
const disc = (name) => createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
const [configPda] = PublicKey.findProgramAddressSync([Buffer.from("config_v2")], PROGRAM_ID);

// ── 1. create the multisig ──────────────────────────────────────────────────
const createKey = Keypair.generate();
const [multisigPda] = multisig.getMultisigPda({ createKey: createKey.publicKey });
const [vaultPda] = multisig.getVaultPda({ multisigPda, index: 0 });
console.log("multisig:", multisigPda.toBase58());
console.log("vault (future admin):", vaultPda.toBase58());

const programConfigPda = multisig.getProgramConfigPda({})[0];
const programConfig = await multisig.accounts.ProgramConfig.fromAccountAddress(
  connection,
  programConfigPda
);

let sig = await multisig.rpc.multisigCreateV2({
  connection,
  createKey,
  creator: me,
  multisigPda,
  configAuthority: null,
  timeLock: 0,
  members: [
    { key: me.publicKey, permissions: Permissions.all() },
    { key: secondMember, permissions: Permissions.all() },
  ],
  threshold: 1,
  treasury: programConfig.treasury,
  rentCollector: null,
});
await connection.confirmTransaction(sig, "confirmed");
console.log("created:", sig);

// Fund the vault so it can pay proposal-account rent when it is the payer.
const fundTx = new Transaction().add(
  SystemProgram.transfer({ fromPubkey: me.publicKey, toPubkey: vaultPda, lamports: 100_000_000 })
);
fundTx.feePayer = me.publicKey;
const bh = await connection.getLatestBlockhash();
fundTx.recentBlockhash = bh.blockhash;
fundTx.sign(me);
sig = await connection.sendRawTransaction(fundTx.serialize());
await connection.confirmTransaction(sig, "confirmed");
console.log("vault funded 0.1 SOL:", sig);

// ── helper: run one instruction through the vault ──────────────────────────
async function throughVault(label, innerInstructions) {
  const ms = await multisig.accounts.Multisig.fromAccountAddress(connection, multisigPda);
  const transactionIndex = BigInt(Number(ms.transactionIndex)) + 1n;

  const { blockhash } = await connection.getLatestBlockhash();
  const message = new TransactionMessage({
    payerKey: vaultPda,
    recentBlockhash: blockhash,
    instructions: innerInstructions,
  });

  let s = await multisig.rpc.vaultTransactionCreate({
    connection,
    feePayer: me,
    multisigPda,
    transactionIndex,
    creator: me.publicKey,
    vaultIndex: 0,
    ephemeralSigners: 0,
    transactionMessage: message,
  });
  await connection.confirmTransaction(s, "confirmed");

  s = await multisig.rpc.proposalCreate({
    connection,
    feePayer: me,
    multisigPda,
    transactionIndex,
    creator: me,
  });
  await connection.confirmTransaction(s, "confirmed");

  s = await multisig.rpc.proposalApprove({
    connection,
    feePayer: me,
    multisigPda,
    transactionIndex,
    member: me,
  });
  await connection.confirmTransaction(s, "confirmed");

  s = await multisig.rpc.vaultTransactionExecute({
    connection,
    feePayer: me,
    multisigPda,
    transactionIndex,
    member: me.publicKey,
    signers: [me],
  });
  await connection.confirmTransaction(s, "confirmed");
  console.log(`${label} (executed via vault):`, s);
  return s;
}

// ── 2. prove the flow with a harmless vault transfer ────────────────────────
await throughVault("smoke test: vault self-transfer", [
  SystemProgram.transfer({ fromPubkey: vaultPda, toPubkey: me.publicKey, lamports: 1_000 }),
]);

// ── 3. rotate config_v2.admin → vault (signed by the current admin) ─────────
const rotateData = Buffer.concat([
  disc("update_config_v2"),
  Buffer.from([1]),          // new_admin: Some
  vaultPda.toBuffer(),
  Buffer.from([0]),          // new_operator: None
  Buffer.from([0]),          // new_fee_bps: None
  Buffer.from([0]),          // paused: None
]);
const rotateTx = new Transaction().add(
  new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: me.publicKey, isSigner: true, isWritable: false },
      { pubkey: configPda, isSigner: false, isWritable: true },
    ],
    data: rotateData,
  })
);
rotateTx.feePayer = me.publicKey;
const bh2 = await connection.getLatestBlockhash();
rotateTx.recentBlockhash = bh2.blockhash;
rotateTx.sign(me);
sig = await connection.sendRawTransaction(rotateTx.serialize());
await connection.confirmTransaction(sig, "confirmed");
console.log("config_v2.admin -> vault:", sig);

// ── 4. prove an ADMIN instruction works through the vault ───────────────────
// No-op update_config_v2 (all None) — succeeds only if the vault IS admin.
const noopData = Buffer.concat([
  disc("update_config_v2"),
  Buffer.from([0]), Buffer.from([0]), Buffer.from([0]), Buffer.from([0]),
]);
await throughVault("admin no-op via multisig", [
  new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: vaultPda, isSigner: true, isWritable: false },
      { pubkey: configPda, isSigner: false, isWritable: true },
    ],
    data: noopData,
  }),
]);

// ── readback + persist ──────────────────────────────────────────────────────
const info = await connection.getAccountInfo(configPda);
const adminOnChain = new PublicKey(info.data.subarray(8, 40)).toBase58();
console.log("on-chain admin now:", adminOnChain);
console.log(adminOnChain === vaultPda.toBase58() ? "MULTISIG ADMIN CONFIRMED" : "MISMATCH");

writeFileSync(
  join(process.cwd(), "..", ".keys", "squads-admin.json"),
  JSON.stringify(
    {
      multisig: multisigPda.toBase58(),
      vault: vaultPda.toBase58(),
      createKey: createKey.publicKey.toBase58(),
      members: [me.publicKey.toBase58(), secondMember.toBase58()],
      threshold: 1,
      note: "config_v2.admin = vault. Raise threshold via Squads app or configTransaction.",
    },
    null,
    2
  )
);
console.log("wrote ../.keys/squads-admin.json");
