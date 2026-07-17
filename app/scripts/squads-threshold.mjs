// Change the Squads multisig threshold (devnet).
//
//   node scripts/squads-threshold.mjs <newThreshold>
//
// Runs a config transaction: create → propose → approve (local member) →
// execute. Only succeeds while the CURRENT threshold is satisfiable by the
// local member alone (i.e. raising 1→2 works; lowering 2→1 later will
// require the second member's approval via the Squads app first).

import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import { readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));
const SQUADS_FILE = join(here, "..", "..", ".keys", "squads-admin.json");
const RPC = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";

const newThreshold = Number(process.argv[2]);
if (!Number.isInteger(newThreshold) || newThreshold < 1) {
  console.error("usage: node scripts/squads-threshold.mjs <newThreshold>");
  process.exit(1);
}

const squads = JSON.parse(readFileSync(SQUADS_FILE, "utf8"));
const multisigPda = new PublicKey(squads.multisig);
const me = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(readFileSync(join(homedir(), ".config", "solana", "id.json"), "utf8")))
);
const connection = new Connection(RPC, "confirmed");

const ms = await multisig.accounts.Multisig.fromAccountAddress(connection, multisigPda);
console.log("current threshold:", ms.threshold, "→ requested:", newThreshold);
if (ms.threshold === newThreshold) {
  console.log("already at requested threshold — nothing to do");
  process.exit(0);
}
const transactionIndex = BigInt(Number(ms.transactionIndex)) + 1n;

let sig = await multisig.rpc.configTransactionCreate({
  connection,
  feePayer: me,
  multisigPda,
  transactionIndex,
  creator: me.publicKey,
  actions: [{ __kind: "ChangeThreshold", newThreshold }],
});
await connection.confirmTransaction(sig, "confirmed");
console.log("config tx created:", sig);

sig = await multisig.rpc.proposalCreate({
  connection,
  feePayer: me,
  multisigPda,
  transactionIndex,
  creator: me,
});
await connection.confirmTransaction(sig, "confirmed");

sig = await multisig.rpc.proposalApprove({
  connection,
  feePayer: me,
  multisigPda,
  transactionIndex,
  member: me,
});
await connection.confirmTransaction(sig, "confirmed");
console.log("approved by local member");

sig = await multisig.rpc.configTransactionExecute({
  connection,
  feePayer: me,
  multisigPda,
  transactionIndex,
  member: me,
  rentPayer: me,
});
await connection.confirmTransaction(sig, "confirmed");
console.log("executed:", sig);

const after = await multisig.accounts.Multisig.fromAccountAddress(connection, multisigPda);
console.log("on-chain threshold now:", after.threshold);
if (after.threshold === newThreshold) {
  squads.threshold = newThreshold;
  writeFileSync(SQUADS_FILE, JSON.stringify(squads, null, 2));
  console.log("THRESHOLD CHANGE CONFIRMED — squads-admin.json updated");
} else {
  console.log("MISMATCH — inspect the multisig account");
}
