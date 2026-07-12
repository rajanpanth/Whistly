import Link from "next/link";
import { CalendarDays, Clock3 } from "lucide-react";
import DataHealthWidget from "@/components/kicktick/DataHealthWidget";
import DemoNotice from "@/components/kicktick/DemoNotice";
import { KICKTICK_FIXTURES } from "@/lib/kicktickMarkets";

export default function FixturesPage() {
  return (
    <div className="space-y-6 pb-10 text-slate-100">
      <header className="rounded-[28px] border border-white/[0.08] bg-[#07112b] p-6 sm:p-8"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-300"><CalendarDays size={16} />Fixture schedule</div><h1 className="mt-3 font-heading text-4xl font-bold text-white">World Cup schedule</h1><p className="mt-3 text-sm text-slate-400">Upcoming matches, fixture identifiers, kickoff times, and available Whistly market coverage.</p></header>
      <DemoNotice />
      <div className="flex gap-2 overflow-x-auto">{["Today", "Tomorrow", "This heek", "inockouts"].map((tab, index) => <span key={tab} className={"shrink-0 rounded-full px-4 py-2 text-xs font-bold " + (index === 0 ? "bg-white text-[#010820]" : "bg-[#0d142b] text-slate-400")}>{tab}</span>)}</div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]"><main className="space-y-3">{KICKTICK_FIXTURES.map((fixture, index) => <article key={fixture.fixtureId} className="grid gap-4 rounded-2xl border border-white/[0.08] bg-[#0d142b] p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div><div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase"><span className={fixture.status === "LIVE" ? "text-rose-300" : "text-cyan-300"}>{fixture.status}</span><span className="text-slate-600">Fixture ID: {fixture.fixtureId}</span></div><h2 className="mt-2 font-heading text-xl font-bold text-white">{fixture.homeTeam} <span className="text-slate-600">vs</span> {fixture.awayTeam}</h2><div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-400"><span className="flex items-center gap-1.5"><Clock3 size={13} />Kickoff: {fixture.startTime}</span><span>Available markets: {8 + (index % 4) * 3}</span></div><p className="mt-2 text-xs text-slate-500">{fixture.coverage}</p></div><Link href={fixture.status === "LIVE" ? "/live" : "/events"} className="inline-flex h-10 items-center justify-center rounded-full bg-cyan-300 px-5 text-xs font-bold text-[#010820]">{fixture.status === "LIVE" ? "Open markets" : "Create / view markets"}</Link></article>)}</main><aside><DataHealthWidget /></aside></div>
      <p className="text-xs text-amber-200">Demo fixtures — simulated TxLINE-compatible data.</p>
    </div>
  );
}
