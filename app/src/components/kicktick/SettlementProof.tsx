import Link from "next/link";
import { ArrowUpRight, CheckCircle2, FileCheck2 } from "lucide-react";

type Props = { market?: string; window?: string; startScore?: string; endScore?: string; outcome?: "YES" | "NO"; settlementTx?: string; claimTx?: string; demo?: boolean };

export default function SettlementProof({ market = "Goal in Next 5m", window = "63:00 → 68:00", startScore = "1-1", endScore = "2-1", outcome = "YES", settlementTx, claimTx, demo = true }: Props) {
  const increased = outcome === "YES";
  return (
    <section className="rounded-2xl border border-violet-400/20 bg-[#0b1228] p-5">
      <div className="flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-heading text-lg font-bold text-white"><FileCheck2 size={18} className="text-violet-300" />Why did this market resolve?</h2><span className={"rounded-full px-2 py-1 text-[10px] font-bold uppercase " + (demo ? "bg-amber-400/10 text-amber-300" : "bg-emerald-400/10 text-emerald-300")}>{demo ? "Demo proof" : "Verified"}</span></div>
      <dl className="mt-4 grid gap-x-5 gap-y-3 text-sm sm:grid-cols-2">
        {[["Market", market], ["Window", window], ["Start score", startScore], ["End score", endScore]].map(([key, value]) => <div key={key}><dt className="text-xs text-slate-500">{key}</dt><dd className="mt-0.5 font-semibold text-slate-100">{value}</dd></div>)}
      </dl>
      <div className={"mt-4 rounded-xl border p-3 text-sm " + (increased ? "border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-100" : "border-rose-400/20 bg-rose-400/[0.07] text-rose-100")}><div className="flex items-center gap-2 font-bold"><CheckCircle2 size={15} />Outcome: {outcome}</div><p className="mt-1 text-xs opacity-80">{increased ? "Total goals increased from 2 to 3." : "Total goals did not increase."}</p></div>
      <p className="mt-3 text-xs leading-5 text-slate-400">Source: {demo ? "TxLINE-compatible demo data. This is simulated proof." : "TxLINE-compatible score data."}</p>
      <div className="mt-3 flex flex-wrap gap-3 text-xs">{settlementTx ? <a href={"https://explorer.solana.com/tx/" + settlementTx + "?cluster=devnet"} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cyan-300">Settlement tx <ArrowUpRight size={12} /></a> : <span className="text-slate-500">Settlement tx: unavailable</span>}{claimTx ? <a href={"https://explorer.solana.com/tx/" + claimTx + "?cluster=devnet"} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cyan-300">Claim tx <ArrowUpRight size={12} /></a> : <span className="text-slate-500">Claim tx: unavailable</span>}<Link href="/verify" className="ml-auto text-violet-300 hover:text-violet-200">Open verifier →</Link></div>
    </section>
  );
}
