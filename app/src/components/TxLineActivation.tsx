"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";
import { CheckCircle2, ExternalLink, Loader2, Satellite, Wallet } from "lucide-react";
import toast from "react-hot-toast";
import { sendTransaction } from "@/lib/program";
import { connection } from "@/lib/program.base";

/**
 * TxLINE free World Cup tier activation (devnet), per
 * https://txline.txodds.com/documentation/worldcup and the txodds/tx-on-chain
 * examples. Free tier = service level 1, 4 weeks, no TxL payment — the wallet
 * only pays devnet transaction fees/rent.
 *
 * Flow (every signature comes from the USER's wallet in the browser):
 *  1. Guest JWT via our server proxy.
 *  2. On-chain `subscribe(1, 4)` to the txoracle program, wallet-signed.
 *  3. Wallet signs the activation message `${txSig}::${jwt}`.
 *  4. Server exchanges it for the API token at TxLINE `/api/token/activate`.
 */

const TXORACLE_PROGRAM_ID = new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");
const TXL_TOKEN_MINT = new PublicKey("4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG"); // devnet TxL mint
const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const SUBSCRIBE_DISCRIMINATOR = Uint8Array.from([254, 28, 191, 138, 156, 179, 183, 53]);
const SERVICE_LEVEL_FREE = 1; // 60s-delay free World Cup tier
const WEEKS = 4;

function ataFor(owner: PublicKey, allowOffCurve = false): PublicKey {
  const [address] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_2022_PROGRAM_ID.toBuffer(), TXL_TOKEN_MINT.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  void allowOffCurve;
  return address;
}

function createAtaInstruction(payer: PublicKey, ata: PublicKey, owner: PublicKey): TransactionInstruction {
  return new TransactionInstruction({
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: ata, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: TXL_TOKEN_MINT, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([1]), // create_idempotent
  });
}

function subscribeInstruction(user: PublicKey): TransactionInstruction {
  const [pricingMatrix] = PublicKey.findProgramAddressSync([Buffer.from("pricing_matrix")], TXORACLE_PROGRAM_ID);
  const [treasuryPda] = PublicKey.findProgramAddressSync([Buffer.from("token_treasury_v2")], TXORACLE_PROGRAM_ID);
  const treasuryVault = ataFor(treasuryPda, true);
  const userTokenAccount = ataFor(user);

  // args: service_level_id (u16 LE), weeks (u8)
  const data = Buffer.alloc(8 + 2 + 1);
  data.set(SUBSCRIBE_DISCRIMINATOR, 0);
  data.writeUInt16LE(SERVICE_LEVEL_FREE, 8);
  data.writeUInt8(WEEKS, 10);

  return new TransactionInstruction({
    programId: TXORACLE_PROGRAM_ID,
    keys: [
      { pubkey: user, isSigner: true, isWritable: true },
      { pubkey: pricingMatrix, isSigner: false, isWritable: false },
      { pubkey: TXL_TOKEN_MINT, isSigner: false, isWritable: false },
      { pubkey: userTokenAccount, isSigner: false, isWritable: true },
      { pubkey: treasuryVault, isSigner: false, isWritable: true },
      { pubkey: treasuryPda, isSigner: false, isWritable: false },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data,
  });
}

type Step = "idle" | "jwt" | "subscribe" | "sign" | "activate" | "done";

const STEP_LABELS: Record<Step, string> = {
  idle: "",
  jwt: "Requesting TxLINE guest session…",
  subscribe: "Waiting for wallet — on-chain subscribe (devnet fee only)…",
  sign: "Waiting for wallet — sign activation message…",
  activate: "Exchanging signature for API token…",
  done: "Activated",
};

export default function TxLineActivation() {
  const { publicKey, signTransaction, signMessage, connected } = useWallet();
  const [step, setStep] = useState<Step>("idle");
  const [txSig, setTxSig] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const busy = step !== "idle" && step !== "done";

  const activate = async () => {
    if (!publicKey || !signTransaction || !signMessage) {
      toast.error("Connect a wallet that supports message signing.");
      return;
    }
    setError(null);
    try {
      // 1. Guest JWT
      setStep("jwt");
      const jwtRes = await fetch("/api/txline/guest-jwt", { method: "POST" });
      const jwtData = await jwtRes.json();
      if (!jwtRes.ok || !jwtData.token) throw new Error(jwtData.message || "Guest session failed");
      const jwt: string = jwtData.token;

      // 2. On-chain subscribe (create token account if missing)
      setStep("subscribe");
      const instructions: TransactionInstruction[] = [];
      const userAta = ataFor(publicKey);
      const ataInfo = await connection.getAccountInfo(userAta);
      if (!ataInfo) instructions.push(createAtaInstruction(publicKey, userAta, publicKey));
      instructions.push(subscribeInstruction(publicKey));
      const signature = await sendTransaction(instructions, publicKey, signTransaction);
      setTxSig(signature);

      // 3. Wallet signs `${txSig}:<leagues>:${jwt}` — free tier uses empty leagues.
      setStep("sign");
      const message = new TextEncoder().encode(`${signature}::${jwt}`);
      const signed = await signMessage(message);
      const walletSignature = btoa(String.fromCharCode(...Array.from(signed)));

      // 4. Exchange for the API token (stored server-side only)
      setStep("activate");
      const activateRes = await fetch("/api/txline/activate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ txSig: signature, walletSignature, jwt, leagues: [] }),
      });
      const activateData = await activateRes.json();
      if (!activateRes.ok) throw new Error(activateData.message || "Activation failed");

      setStep("done");
      toast.success("TxLINE free tier activated — real data enabled.");
    } catch (err: any) {
      setStep("idle");
      const message = String(err?.message || err);
      setError(message);
      toast.error(message.slice(0, 120));
    }
  };

  return (
    <section className="rounded-xl border border-[#29292f] bg-[#141418] p-5">
      <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-white">
        <Satellite size={18} className="text-[#20d38a]" />Activate free World Cup data (devnet)
      </h2>
      <p className="mt-2 text-sm leading-6 text-[#a1a1aa]">
        TxLINE offers a free World Cup tier. Your wallet signs a one-time on-chain
        subscribe transaction on Solana devnet (no TxL payment — only devnet fees)
        plus one activation message. The API token stays on the server.
      </p>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs leading-5 text-[#8b8b94]">
        <li>Guest session from TxLINE (public endpoint).</li>
        <li>On-chain <code className="text-[#c9c9ce]">subscribe(level 1, 4 weeks)</code> — you approve in your wallet.</li>
        <li>Sign the activation message — you approve in your wallet.</li>
        <li>Server exchanges it for the data API token.</li>
      </ol>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={activate}
          disabled={busy || !connected || step === "done"}
          className="inline-flex items-center gap-2 rounded-[0.65rem] bg-[#f4f4f5] px-4 py-2.5 text-sm font-bold text-[#0a0a0c] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : step === "done" ? <CheckCircle2 size={15} /> : <Wallet size={15} />}
          {step === "done" ? "Activated" : busy ? STEP_LABELS[step] : connected ? "Activate with wallet" : "Connect wallet first"}
        </button>
        {txSig && (
          <a href={`https://explorer.solana.com/tx/${txSig}?cluster=devnet`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-[#7ce8bb] hover:text-white">
            Subscribe tx <ExternalLink size={12} />
          </a>
        )}
      </div>

      {error && <p className="mt-3 rounded-lg border border-[#fa4669]/25 bg-[#fa4669]/[0.06] p-3 text-xs leading-5 text-[#f8c0cb]">{error}</p>}
      {step === "done" && (
        <p className="mt-3 rounded-lg border border-[#20d38a]/25 bg-[#20d38a]/[0.05] p-3 text-xs leading-5 text-[#b9f0d6]">
          Real TxLINE data is now enabled for this server runtime. Upcoming fixtures appear on
          the World Cup page; scores drive settlement. To persist across restarts, copy the
          token into <code>TXLINE_API_TOKEN</code> in <code>.env.local</code>.
        </p>
      )}
      <p className="mt-3 text-[11px] text-[#6f6f78]">
        Uses TxLINE devnet ({"txline-dev.txodds.com"}) and the txoracle program. Nothing is
        activated or claimed until the API token request succeeds.
      </p>
    </section>
  );
}
