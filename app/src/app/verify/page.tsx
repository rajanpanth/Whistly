import Link from "next/link";
import { Search, ShieldCheck } from "lucide-react";
import DataHealthWidget from "@/components/kicktick/DataHealthWidget";
import DemoNotice from "@/components/kicktick/DemoNotice";
import SettlementProof from "@/components/kicktick/SettlementProof";
import { KICKTICK_MARKETS } from "@/lib/kicktickMarkets";

export default function VerifyPage() {
  const resolved = KICKTICK_MARKETS.filter((market) => market.status === "RESOLVED");
  return (
    <div className="space-y-6 pb-10 text-slate-100">
      <header className="rounded-[28px] border border-white/[0.08] bg-[#07112b] p-6 sm:p-8"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-violet-300"><ShieldCheck size={16} />Settlement verification</div><h1 className="mt-3 font-heading text-4xl font-bold text-white">Verify a market</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">Inspect the fixture, observation window, source data, winning outcome, and any available Solana devnet transaction links.</p><div className="relative mt-6 max-w-2xl"><Search className="absolute left-4 top-3.5 text-slate-500" size={17} /><input readOnly placeholder="Paste a market ID or settlement transaction" className="h-11 w-full rounded-xl border border-white/10 bg-[#0d142b] pl-11 pr-4 text-sm text-white outline-none" /></div></header>
      <DemoNotice />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]"><main className="space-y-4"><SettlementProof />{resolved.map((market) => <Link key={market.id} href={"/verify/" + market.id} className="flex items-center justify-between rounded-2xl border border-white/[0.08] bg-[#0d142b] p-4 transition hover:border-violet-300/30"><div><div className="text-xs font-bold uppercase text-amber-300">Demo proof</div><div className="mt-1 font-heading text-lg font-bold text-white">{market.question}</div><div className="mt-1 text-xs text-slate-400">{market.matchName} · {market.fixtureId}</div></div><span className="text-sm font-bold text-violet-300">Inspect →</span></Link>)}</main><aside><DataHealthWidget /></aside></div>
    </div>
  );
}
