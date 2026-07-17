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
import UpcomingFixtures from "@/components/UpcomingFixtures";
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
    <div className="space-y-6 pb-10 text-[color:var(--market-text)]">
      <header className="relative overflow-hidden rounded-2xl border border-[color:var(--market-border)] bg-[color:var(--market-card)] p-6 sm:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_13%_5%,rgba(255,255,255,0.07),transparent_33%),linear-gradient(120deg,#1d1d21,#151519_65%)]" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div><div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[color:var(--market-text-2)]"><Globe2 size={15} className="text-[color:var(--market-positive)]" />World Cup discovery</div><h1 className="mt-3 font-heading text-4xl font-bold uppercase tracking-[-0.04em] text-white sm:text-5xl">World Cup Markets</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--market-text-2)]">Live YES/NO markets for goals, corners, penalties, offsides, totals, and match outcomes.</p></div>
          <div className="flex gap-3"><div className="rounded-xl border border-[color:var(--market-border)] bg-[color:var(--market-elevated)] px-4 py-3"><div className="text-[10px] uppercase tracking-wider text-[color:var(--market-text-3)]">Markets</div><div className="mt-1 font-mono text-xl font-bold text-white">{KICKTICK_MARKETS.length}</div></div><div className="rounded-xl border border-[color:var(--market-border)] bg-[color:var(--market-elevated)] px-4 py-3"><div className="text-[10px] uppercase tracking-wider text-[color:var(--market-text-3)]">Network</div><div className="mt-1 text-xl font-bold text-[color:var(--market-positive-soft)]">Devnet</div></div></div>
        </div>
      </header>

      <div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5d5d65]" size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} type="search" placeholder="Search World Cup markets, teams, or events" className="h-12 w-full rounded-[0.65rem] border border-[#1c1c20] bg-[#0c0c0f] py-4 pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-[#5d5d65] focus:border-[color:var(--market-border-strong)] focus:bg-[color:var(--market-elevated)]" /></div>

      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">{DISCOVERY_TABS.map((tab) => <button key={tab} onClick={() => setDiscovery(tab)} className={"h-9 shrink-0 rounded-[0.65rem] px-4 text-xs font-bold transition " + (discovery === tab ? "bg-[color:var(--market-text)] text-[#0a0a0c]" : "bg-[color:var(--market-elevated)] text-[#898991] hover:bg-[#18181c] hover:text-white")}>{tab === "Trending" && <Flame size={13} className="mr-1 inline text-[color:var(--market-live)]" />}{tab}</button>)}</div>
      <MarketFamilyTabs active={activeFilter} onChange={setActiveFilter} />
      <DemoNotice compact />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <main>
          <div className="mb-4 flex items-center justify-between"><div className="text-sm font-semibold text-white">{filtered.length} markets</div><span className="text-xs text-[color:var(--market-text-3)]">Clearly labeled real + demo coverage</span></div>
          {filtered.length ? <div className="grid gap-4 md:grid-cols-2">{filtered.map((market) => <KickTickMarketCard key={market.id} market={market} />)}</div> : <div className="rounded-xl border border-dashed border-[color:var(--market-border-strong)] bg-[color:var(--market-elevated)] p-10 text-center"><Search className="mx-auto text-[#5d5d65]" /><p className="mt-3 text-sm text-[color:var(--market-text-2)]">No markets match this search.</p><button onClick={() => { setSearch(""); setActiveFilter("All"); setDiscovery("Trending"); }} className="mt-4 rounded-[0.65rem] bg-[color:var(--market-text)] px-4 py-2 text-sm font-bold text-[#0a0a0c]">Clear filters</button></div>}
        </main>
        <aside className="space-y-4">
          <UpcomingFixtures limit={6} />
          <DataHealthWidget compact />
          <Link href="/live" className="block rounded-xl border border-[color:var(--market-border)] bg-[color:var(--market-card)] p-4 transition hover:border-[#fa4669]/40"><div className="flex items-center justify-between text-xs"><span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[color:var(--market-live)]"><span className="h-2 w-2 animate-pulse rounded-full bg-current" />Featured live</span><span className="font-mono text-[color:var(--market-text-3)]">63:20</span></div><div className="mt-4 font-heading text-xl font-bold uppercase tracking-[-0.03em] text-white">Argentina vs Brazil</div><div className="mt-1 font-mono text-sm text-[color:var(--market-text-2)]">ARG 1 – 1 BRA</div><div className="mt-4 rounded-lg bg-white/[0.04] p-3"><div className="text-xs text-[#8b8b94]">Goals · 5m</div><div className="mt-1 font-bold text-white">Goal in Next 5m?</div><div className="mt-3 flex gap-2 text-xs font-bold"><span className="rounded-md border border-[#20d38a]/25 bg-[#20d38a]/[0.08] px-3 py-1.5 text-[color:var(--market-positive-soft)]">YES 58%</span><span className="rounded-md border border-[#fa4669]/25 bg-[#fa4669]/[0.08] px-3 py-1.5 text-[color:var(--market-live-soft)]">NO 42%</span></div></div><div className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#d7d7dc]">Open terminal <ArrowRight size={13} /></div></Link>
          <section className="rounded-xl border border-[color:var(--market-border)] bg-[color:var(--market-panel)] p-4"><h2 className="flex items-center gap-2 font-heading text-sm font-bold text-white"><ShieldCheck size={16} className="text-[color:var(--market-positive)]" />How settlement works</h2><ol className="mt-3 space-y-3 text-xs leading-5 text-[color:var(--market-text-2)]"><li><strong className="text-white">1. Snapshot</strong> score/event data when the window opens.</li><li><strong className="text-white">2. Lock</strong> trading before the observation window ends.</li><li><strong className="text-white">3. Resolve</strong> from the score/event change, never majority vote.</li><li><strong className="text-white">4. Claim</strong> the on-chain payout after settlement.</li></ol><Link href="/verify" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#d7d7dc] hover:text-white">Verify a market <ArrowRight size={13} /></Link></section>
          <ActivityFeed compact />
        </aside>
      </div>

      <div className="grid gap-4 lg:grid-cols-2"><SettlementProof /><section className="rounded-xl border border-[color:var(--market-border)] bg-[color:var(--market-card)] p-5"><Sparkles size={20} className="text-[#d8ec52]" /><h2 className="mt-4 font-heading text-xl font-bold uppercase tracking-[-0.03em] text-white">Replay the match state</h2><p className="mt-2 text-sm leading-6 text-[color:var(--market-text-2)]">No live match? Use labeled simulated TxLINE-compatible events to demonstrate opening, locking, resolving, and proving a market.</p><Link href="/replay" className="mt-5 inline-flex items-center gap-2 rounded-[0.65rem] bg-[color:var(--market-text)] px-5 py-3 text-sm font-bold text-[#0a0a0c] transition hover:bg-white">Open replay <ArrowRight size={15} /></Link></section></div>
    </div>
  );
}
