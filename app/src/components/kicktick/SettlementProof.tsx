import Link from "next/link";
import { ArrowUpRight, CheckCircle2, FileCheck2 } from "lucide-react";

type Props = { market?: string; window?: string; startScore?: string; endScore?: string; outcome?: "YES" | "NO"; settlementTx?: string; claimTx?: string; demo?: boolean };

export default function SettlementProof({ market = "Goal in Next 5m", window = "63:00 → 68:00", startScore = "1-1", endScore = "2-1", outcome = "YES", settlementTx, claimTx, demo = true }: Props) {
  const increased = outcome === "YES";
  return (
    <section className="rounded-xl border border-[#29292f] bg-[#19191d] p-5">
      <div className="flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-heading text-lg font-bold text-[#f4f4f5]"><FileCheck2 size={18} className="text-[#20d38a]" />Why did this market resolve?</h2><span className={"rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider " + (demo ? "bg-[#e6ff3e]/10 text-[#d8ec52]" : "bg-[#20d38a]/10 text-[#7ce8bb]")}>{demo ? "Demo proof" : "Verified"}</span></div>
      <dl className="mt-4 grid gap-x-5 gap-y-3 text-sm sm:grid-cols-2">
        {[["Market", market], ["Window", window], ["Start score", startScore], ["End score", endScore]].map(([key, value]) => <div key={key}><dt className="text-xs text-[#6f6f78]">{key}</dt><dd className="mt-0.5 font-semibold text-[#e6e6e9]">{value}</dd></div>)}
      </dl>
      <div className={"mt-4 rounded-lg border p-3 text-sm " + (increased ? "border-[#20d38a]/25 bg-[#20d38a]/[0.06] text-[#b9f0d6]" : "border-[#fa4669]/25 bg-[#fa4669]/[0.06] text-[#f8c0cb]")}><div className="flex items-center gap-2 font-bold"><CheckCircle2 size={15} />Outcome: {outcome}</div><p className="mt-1 text-xs opacity-80">{increased ? "Total goals increased from 2 to 3." : "Total goals did not increase."}</p></div>
      <p className="mt-3 text-xs leading-5 text-[#a1a1aa]">Source: {demo ? "TxLINE-compatible demo data. This is simulated proof." : "TxLINE-compatible score data."}</p>
      <div className="mt-3 flex flex-wrap gap-3 text-xs">{settlementTx ? <a href={"https://explorer.solana.com/tx/" + settlementTx + "?cluster=devnet"} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#7ce8bb] hover:text-white">Settlement tx <ArrowUpRight size={12} /></a> : <span className="text-[#6f6f78]">Settlement tx: unavailable</span>}{claimTx ? <a href={"https://explorer.solana.com/tx/" + claimTx + "?cluster=devnet"} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#7ce8bb] hover:text-white">Claim tx <ArrowUpRight size={12} /></a> : <span className="text-[#6f6f78]">Claim tx: unavailable</span>}<Link href="/verify" className="ml-auto font-bold text-[#d7d7dc] hover:text-white">Open verifier →</Link></div>
    </section>
  );
}
