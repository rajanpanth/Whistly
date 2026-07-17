import { CheckCircle2, ExternalLink, ShieldCheck } from "lucide-react";
import { getKickTickMarket } from "@/lib/kicktickMarkets";
import { notFound } from "next/navigation";

interface VerifyPageProps {
  params: Promise<{ marketId: string }>;
}

export default async function VerifyPage({ params }: VerifyPageProps) {
  const { marketId } = await params;
  const market = getKickTickMarket(marketId);

  if (!market) {
    notFound();
  }

  const isResolved = market.status === "RESOLVED";
  const isDemoProof = market.proofStatus === "demo";

  return (
    <div className="space-y-6 pb-8 text-[color:var(--market-text)]">
      <header className="rounded-xl border border-[color:var(--market-border)] bg-[color:var(--market-card)] p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="text-[color:var(--market-positive)]" size={20} />
          <h1 className="font-heading text-2xl font-bold text-white">
            Market Verification
          </h1>
        </div>
        <p className="mt-2 text-sm text-[color:var(--market-text-2)]">
          Settlement proof for market:{" "}
          <span className="text-[#e6e6e9]">{market.question}</span>
        </p>
      </header>

      {isDemoProof && (
        <div className="flex items-start gap-2 rounded-xl border border-[#e6ff3e]/20 bg-[#e6ff3e]/[0.05] p-3 text-sm text-[#e4e8c9]">
          <ShieldCheck className="mt-0.5 shrink-0" size={16} />
          <span>
            Demo proof — simulated TxLINE-compatible event data. This market
            was not resolved with real TxLINE data.
          </span>
        </div>
      )}

      {/* Market details */}
      <section className="rounded-xl border border-[color:var(--market-border)] bg-[color:var(--market-panel)] p-5">
        <h2 className="text-lg font-semibold text-white">Market Details</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <ProofRow label="Market Question" value={market.question} />
          <ProofRow label="Fixture ID" value={market.fixtureId} />
          <ProofRow label="Market Family" value={market.family} />
          <ProofRow label="Match" value={market.matchName} />
          <ProofRow label="Score" value={market.score} />
          <ProofRow label="Clock" value={market.clock} />
          {market.window && (
            <ProofRow label="Window" value={market.window} />
          )}
          <ProofRow label="Status" value={market.status} />
        </div>
      </section>

      {/* Resolution proof */}
      <section className="rounded-xl border border-[color:var(--market-border)] bg-[color:var(--market-panel)] p-5">
        <h2 className="text-lg font-semibold text-white">
          Why did this market resolve?
        </h2>
        <div className="mt-4 space-y-3">
          <ProofRow label="YES Probability" value={`${market.yesProbability}%`} />
          <ProofRow label="NO Probability" value={`${market.noProbability}%`} />
          <ProofRow
            label="Winning Outcome"
            value={
              isResolved
                ? market.yesProbability > market.noProbability
                  ? "YES"
                  : "NO"
                : "Pending"
            }
          />
          <ProofRow label="Data Source" value={market.dataSource} />
          <ProofRow
            label="Proof Status"
            value={
              market.proofStatus === "verified-devnet"
                ? "Verified (devnet)"
                : market.proofStatus === "demo"
                  ? "Demo proof"
                  : "Pending"
            }
          />
        </div>

        {/* Explanation */}
        <div className="mt-4 rounded-xl border border-[color:var(--market-border)] bg-white/[0.04] p-4 text-sm text-[#c9c9ce]">
          {market.family === "Live" || market.family === "Goals" ? (
            <p>
              Total goals increased during the window. If total goals at end
              score &gt; total goals at start score, YES wins. Otherwise NO wins.
            </p>
          ) : market.family === "Corners" ? (
            <p>Corner count increased during the window. Therefore YES wins.</p>
          ) : market.family === "Penalties" ? (
            <p>
              Penalty event detected inside the window. Therefore YES wins.
            </p>
          ) : market.family === "Match Result" ? (
            <p>Final score determines the match result outcome.</p>
          ) : (
            <p>
              Resolution logic depends on the specific market family and
              TxLINE-compatible event data.
            </p>
          )}
        </div>
      </section>

      {/* Transaction links */}
      <section className="rounded-xl border border-[color:var(--market-border)] bg-[color:var(--market-panel)] p-5">
        <h2 className="text-lg font-semibold text-white">
          On-chain Transactions
        </h2>
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2 text-sm text-[color:var(--market-text-2)]">
            <CheckCircle2 size={15} className="text-[color:var(--market-positive)]" />
            <span>
              Settlement tx:{" "}
              {isDemoProof ? (
                <span className="text-[#d8ec52]">Demo — no real tx</span>
              ) : (
                <span className="text-[color:var(--market-positive-soft)]">View on Solana Explorer</span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-[color:var(--market-text-2)]">
            <CheckCircle2 size={15} className="text-[color:var(--market-positive)]" />
            <span>
              Claim tx:{" "}
              {isDemoProof ? (
                <span className="text-[#d8ec52]">Demo — no real tx</span>
              ) : (
                <span className="text-[color:var(--market-positive-soft)]">View on Solana Explorer</span>
              )}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

function ProofRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[color:var(--market-border)] bg-white/[0.04] px-4 py-3">
      <div className="text-xs text-[color:var(--market-text-3)]">{label}</div>
      <div className="mt-1 text-sm font-semibold text-white">{value}</div>
    </div>
  );
}
