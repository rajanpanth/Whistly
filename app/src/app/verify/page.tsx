import Link from "next/link";
import { Search, ShieldCheck } from "lucide-react";
import DataHealthWidget from "@/components/kicktick/DataHealthWidget";
import DemoNotice from "@/components/kicktick/DemoNotice";
import SettlementProof from "@/components/kicktick/SettlementProof";
import { KICKTICK_MARKETS } from "@/lib/kicktickMarkets";

export default function VerifyPage() {
  const resolved = KICKTICK_MARKETS.filter((market) => market.status === "RESOLVED");
  return (
    <div className="space-y-6 pb-10 text-[#f4f4f5]">
      <header className="relative overflow-hidden rounded-2xl border border-[#29292f] bg-[#19191d] p-6 sm:p-8"><div className="absolute inset-0 bg-[radial-gradient(circle_at_13%_5%,rgba(255,255,255,0.07),transparent_33%),linear-gradient(120deg,#1d1d21,#151519_65%)]" /><div className="relative"><div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#a1a1aa]"><ShieldCheck size={15} className="text-[#20d38a]" />Settlement verification</div><h1 className="mt-3 font-heading text-4xl font-bold uppercase tracking-[-0.04em] text-white">Verify a market</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#a1a1aa]">Inspect the fixture, observation window, source data, winning outcome, and any available Solana devnet transaction links.</p><div className="relative mt-6 max-w-2xl"><Search className="absolute left-4 top-3.5 text-[#5d5d65]" size={17} /><input readOnly placeholder="Paste a market ID or settlement transaction" className="h-11 w-full rounded-[0.65rem] border border-[#1c1c20] bg-[#0c0c0f] pl-11 pr-4 text-sm text-white outline-none placeholder:text-[#5d5d65] focus:border-[#3b3b43]" /></div></div></header>
      <DemoNotice />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]"><main className="space-y-4"><SettlementProof />{resolved.map((market) => <Link key={market.id} href={"/verify/" + market.id} className="flex items-center justify-between rounded-xl border border-[#29292f] bg-[#19191d] p-4 transition hover:-translate-y-0.5 hover:border-[#3b3b43] hover:bg-[#1e1e23]"><div><div className="text-[10px] font-bold uppercase tracking-wider text-[#d8ec52]">Demo proof</div><div className="mt-1 font-heading text-lg font-bold text-white">{market.question}</div><div className="mt-1 text-xs text-[#8b8b94]">{market.matchName} · {market.fixtureId}</div></div><span className="text-sm font-bold text-[#d7d7dc]">Inspect →</span></Link>)}</main><aside><DataHealthWidget /></aside></div>
    </div>
  );
}
