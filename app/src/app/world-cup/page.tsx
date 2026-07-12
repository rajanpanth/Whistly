"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Flame, Globe2, Search, ShieldCheck, Sparkles } from "lucide-react";
import KickTickMarketCard from "@/components/KickTickMarketCard";
import ActivityFeed from "@/components/kicktick/ActivityFeed";
import DataHealthWidget from "@/components/kicktick/DataHealthWidget";
import DemoNotice from "@/components/kicktick/DemoNotice";
import MarketFamilyTabs from "@/components/kicktick/MarketFamilyTabs";
import SettlementProof from "@/components/kicktick/SettlementProof";
import { filterKickTickMarkets, KICKTICK_MARKETS } from "@/lib/kicktickMarkets";

const DISCOVERY_TABS = ["Trending", "Live", "Starting Soon", "Ending Soon", "Resolved"];

export default function WorldCupPage() {
  const [activeFilter, setActiveFilter] = useState("All");
  const [discovery, setDiscovery] = useState("Trending");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let markets = filterKickTickMarkets(activeFilter);
    if (discovery === "Live") markets = markets.filter((market) => market.status === "LIVE");
    if (discovery === "Starting Soon") markets = markets.filter((market) => ["TODAY", "UPCOMING"].includes(market.status));
    if (discovery === "Resolved") markets = markets.filter((market) => market.status === "RESOLVED");
    if (discovery === "Ending Soon") markets = [...markets].sort((a, b) => a.timeLeft.localeCompare(b.timeLeft));
    const query = search.trim().toLowerCase();
    return query ? markets.filter((market) => [market.matchName, market.question, market.family, market.homeTeam, market.awayTeam].some((value) => value.toLowerCase().includes(query))) : markets;
  }, [activeFilter, discovery, search]);

  return (
    <div className="space-y-6 pb-10 text-slate-100">
      <header className="relative overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#07112b] p-6 sm:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_0%,rgba(0,212,191,0.18),transparent_35%),radial-gradient(circle_at_0%_110%,rgba(108,76,255,0.28),transparent_38%)]" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-cyan-300"><Globe2 size={16} />World Cup discovery</div><h1 className="mt-3 font-heading text-4xl font-bold tracking-tight text-white sm:text-5xl">World Cup Markets</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Live YES/NO markets for goals, corners, penalties, offsides, totals, and match outcomes.</p></div>
          <div className="flex gap-3"><div className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3"><div className="text-[10px] uppercase text-slate-500">Markets</div><div className="mt-1 text-xl font-bold text-white">{KICKTICK_MARKETS.length}</div></div><div className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3"><div className="text-[10px] uppercase text-slate-500">Network</div><div className="mt-1 text-xl font-bold text-violet-300">Devnet</div></div></div>
        </div>
      </header>

      <div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} type="search" placeholder="Search World Cup markets, teams, or events" className="h-13 w-full rounded-2xl border border-white/10 bg-[#0d142b] py-4 pl-12 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/40" /></div>

      <div className="flex gap-2 overflow-x-auto pb-1">{DISCOVERY_TABS.map((tab) => <button key={tab} onClick={() => setDiscovery(tab)} className={"shrink-0 rounded-full px-4 py-2 text-xs font-bold transition " + (discovery === tab ? "bg-white text-[#010820]" : "bg-[#0d142b] text-slate-400 hover:text-white")}>{tab === "Trending" && <Flame size={13} className="mr-1 inline text-orange-400" />}{tab}</button>)}</div>
      <MarketFamilyTabs active={activeFilter} onChange={setActiveFilter} />
      <DemoNotice compact />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <main>
          <div className="mb-4 flex items-center justify-between"><div className="text-sm font-semibold text-white">{filtered.length} markets</div><span className="text-xs text-slate-500">Clearly labeled real + demo coverage</span></div>
          {filtered.length ? <div className="grid gap-4 md:grid-cols-2">{filtered.map((market) => <KickTickMarketCard key={market.id} market={market} />)}</div> : <div className="rounded-2xl border border-white/[0.08] bg-[#0d142b] p-10 text-center"><Search className="mx-auto text-slate-600" /><p className="mt-3 text-sm text-slate-400">No markets match this search.</p><button onClick={() => { setSearch(""); setActiveFilter("All"); setDiscovery("Trending"); }} className="mt-3 text-sm font-bold text-cyan-300">Clear filters</button></div>}
        </main>
        <aside className="space-y-4">
          <DataHealthWidget compact />
          <Link href="/live" className="block rounded-2xl border border-rose-400/20 bg-[#0d142b] p-4 transition hover:border-rose-400/40"><div className="flex items-center justify-between text-xs"><span className="flex items-center gap-1.5 font-bold text-rose-300"><span className="h-2 w-2 animate-pulse rounded-full bg-rose-400" />FEATURED LIVE</span><span className="text-slate-500">63:20</span></div><div className="mt-4 font-heading text-xl font-bold text-white">Argentina vs Brazil</div><div className="mt-1 text-sm text-slate-400">ARG 1 - 1 BRA</div><div className="mt-4 rounded-xl bg-white/[0.04] p-3"><div className="text-xs text-blue-300">Goals · 5m</div><div className="mt-1 font-bold text-white">Goal in Next 5m?</div><div className="mt-3 flex gap-2 text-xs font-bold"><span className="rounded-full bg-emerald-400/10 px-3 py-1.5 text-emerald-300">YES 58%</span><span className="rounded-full bg-rose-400/10 px-3 py-1.5 text-rose-300">NO 42%</span></div></div><div className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-cyan-300">Open terminal <ArrowRight size={13} /></div></Link>
          <section className="rounded-2xl border border-white/[0.08] bg-[#0d142b] p-4"><h2 className="flex items-center gap-2 font-heading text-sm font-bold text-white"><ShieldCheck size={16} className="text-violet-300" />How settlement works</h2><ol className="mt-3 space-y-3 text-xs leading-5 text-slate-400"><li><strong className="text-white">1. Snapshot</strong> score/event data when the window opens.</li><li><strong className="text-white">2. Lock</strong> trading before the observation window ends.</li><li><strong className="text-white">3. Resolve</strong> from the score/event change, never majority vote.</li><li><strong className="text-white">4. Claim</strong> the on-chain payout after settlement.</li></ol><Link href="/verify" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-violet-300">Verify a market <ArrowRight size={13} /></Link></section>
          <ActivityFeed compact />
        </aside>
      </div>

      <div className="grid gap-4 lg:grid-cols-2"><SettlementProof /><section className="rounded-2xl border border-white/[0.08] bg-[#0d142b] p-5"><Sparkles size={20} className="text-cyan-300" /><h2 className="mt-4 font-heading text-xl font-bold text-white">Replay the match state</h2><p className="mt-2 text-sm leading-6 text-slate-400">No live match? Use labeled simulated TxLINE-compatible events to demonstrate opening, locking, resolving, and proving a market.</p><Link href="/replay" className="mt-5 inline-flex items-center gap-2 rounded-full bg-cyan-300 px-5 py-3 text-sm font-bold text-[#010820]">Open replay <ArrowRight size={15} /></Link></section></div>
    </div>
  );
}
