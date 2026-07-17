// Shared helper: route admin instructions through the Squads vault when
// config_v2.admin is the vault PDA, or send directly when the local wallet
// is still the admin. Lets v2-admin.mjs / v2-verify.mjs work unchanged
// before AND after the multisig rotation.

import {
  PublicKey,
  Transaction,
  TransactionMessage,
} from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));
const SQUADS_FILE = join(here, "..", "..", ".keys", "squads-admin.json");

export function loadSquadsConfig() {
  if (!existsSync(SQUADS_FILE)) return null;
  try {
    const raw = JSON.parse(readFileSync(SQUADS_FILE, "utf8"));
    return {
      multisigPda: new PublicKey(raw.multisig),
      vaultPda: new PublicKey(raw.vault),
    };
  } catch {
    return null;
  }
}

/** The pubkey that must appear in admin-gated account slots. */
export function effectiveAdminPubkey(me) {
  const squads = loadSquadsConfig();
  return squads ? squads.vaultPda : me.publicKey;
}

/** Execute an already-approved vault transaction (threshold met). */
export async function executeVaultTransaction(connection, me, transactionIndex) {
  const squads = loadSquadsConfig();
  if (!squads) throw new Error("no squads-admin.json — multisig not configured");
  const sig = await multisig.rpc.vaultTransactionExecute({
    connection,
    feePayer: me,
    multisigPda: squads.multisigPda,
    transactionIndex: BigInt(transactionIndex),
    member: me.publicKey,
    signers: [me],
  });
  await connection.confirmTransaction(sig, "confirmed");
  return sig;
}

/**
 * Send admin instructions. Direct when the local wallet is the admin;
 * through propose→approve→execute when the Squads vault is.
 * Instructions must already reference effectiveAdminPubkey() in their
 * admin account slot.
 *
 * With threshold > 1 the local member's approval is not enough: when
 * `allowPending` is true this creates + approves the proposal and returns
 * "pending:<index>" with instructions printed; otherwise it throws so
 * unattended scripts fail loudly instead of continuing on a half-done op.
 */
export async function adminSend(connection, me, instructions, { allowPending = false } = {}) {
  const squads = loadSquadsConfig();
  if (!squads) {
    const tx = new Transaction().add(...instructions);
    tx.feePayer = me.publicKey;
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.sign(me);
    const sig = await connection.sendRawTransaction(tx.serialize());
    const res = await connection.confirmTransaction(
      { signature: sig, blockhash, lastValidBlockHeight },
      "confirmed"
    );
    if (res.value.err) throw new Error(`tx failed: ${JSON.stringify(res.value.err)}`);
    return sig;
  }

  const { multisigPda, vaultPda } = squads;
  const ms = await multisig.accounts.Multisig.fromAccountAddress(connection, multisigPda);
  const transactionIndex = BigInt(Number(ms.transactionIndex)) + 1n;

  const { blockhash } = await connection.getLatestBlockhash();
  const message = new TransactionMessage({
    payerKey: vaultPda,
    recentBlockhash: blockhash,
    instructions,
  });

  let sig = await multisig.rpc.vaultTransactionCreate({
    connection,
    feePayer: me,
    multisigPda,
    transactionIndex,
    creator: me.publicKey,
    vaultIndex: 0,
    ephemeralSigners: 0,
    transactionMessage: message,
  });
  await connection.confirmTransaction(sig, "confirmed");

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

  if (ms.threshold > 1) {
    const msg =
      `proposal #${transactionIndex} approved by the local member but needs ` +
      `${ms.threshold - 1} more approval(s).\n` +
      `  1. Open https://v4.squads.so (network: devnet) with the other member wallet,\n` +
      `     find multisig ${multisigPda.toBase58()} and approve transaction #${transactionIndex}.\n` +
      `  2. Then run: node scripts/v2-admin.mjs squads-execute ${transactionIndex}`;
    if (!allowPending) {
      throw new Error(`squads_approval_required — ${msg}`);
    }
    console.log(`\n⏸  ${msg}`);
    return `pending:${transactionIndex}`;
  }

  sig = await multisig.rpc.vaultTransactionExecute({
    connection,
    feePayer: me,
    multisigPda,
    transactionIndex,
    member: me.publicKey,
    signers: [me],
  });
  await connection.confirmTransaction(sig, "confirmed");
  return sig;
}
