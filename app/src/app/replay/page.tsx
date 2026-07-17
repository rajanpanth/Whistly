"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CornerDownRight, Flag, Play, RotateCcw, ShieldCheck, TimerReset, Zap } from "lucide-react";
import ActivityFeed from "@/components/kicktick/ActivityFeed";
import DemoNotice from "@/components/kicktick/DemoNotice";
import SettlementProof from "@/components/kicktick/SettlementProof";
import { KICKTICK_FIXTURES } from "@/lib/kicktickMarkets";

const FAMILIES = ["Goals", "Corners", "Penalties", "Offsides", "Cards"];
const ACTIONS = [["Goal", "2-1"], ["Corner", "1-1"], ["Penalty", "1-1"], ["Offside", "1-1"], ["Card", "1-1"]];

export default function ReplayPage() {
  const [fixtureId, setFixtureId] = useState(KICKTICK_FIXTURES[0].fixtureId);
  const [family, setFamily] = useState("Goals");
  const [clock, setClock] = useState("63:00");
  const [running, setRunning] = useState(false);
  const [lastEvent, setLastEvent] = useState("No event simulated");
  const [score, setScore] = useState("1-1");
  const fixture = useMemo(() => KICKTICK_FIXTURES.find((item) => item.fixtureId === fixtureId) ?? KICKTICK_FIXTURES[0], [fixtureId]);

  const simulate = (event: string, nextScore: string) => {
    setLastEvent(event + " detected at 65:30");
    setScore(nextScore);
    setRunning(true);
  };

  return (
    <div className="space-y-6 pb-10 text-[color:var(--market-text)]">
      <header className="rounded-2xl border border-[color:var(--market-border)] bg-[color:var(--market-card)] p-6 sm:p-8"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[color:var(--market-positive)]"><RotateCcw size={16} />World Cup demo lab</div><h1 className="mt-3 font-heading text-4xl font-bold text-white">Match replay</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--market-text-2)]">Replay simulated TxLINE-compatible World Cup match events when no live match is available.</p></header>
      <DemoNotice />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <main className="space-y-5">
          <section className="rounded-2xl border border-[color:var(--market-border)] bg-[color:var(--market-panel)] p-5"><h2 className="font-heading text-lg font-bold text-white">Replay controls</h2><div className="mt-5 grid gap-4 md:grid-cols-3"><label className="text-xs text-[color:var(--market-text-2)]">Select fixture<select value={fixtureId} onChange={(event) => setFixtureId(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[color:var(--market-border)] bg-[#0c0c0f] px-3 text-sm text-white">{KICKTICK_FIXTURES.map((item) => <option key={item.fixtureId} value={item.fixtureId}>{item.homeTeam} vs {item.awayTeam}</option>)}</select></label><label className="text-xs text-[color:var(--market-text-2)]">Select replay time<select value={clock} onChange={(event) => setClock(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[color:var(--market-border)] bg-[#0c0c0f] px-3 text-sm text-white"><option>28:00</option><option>51:00</option><option>63:00</option><option>74:00</option></select></label><label className="text-xs text-[color:var(--market-text-2)]">Choose market family<select value={family} onChange={(event) => setFamily(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[color:var(--market-border)] bg-[#0c0c0f] px-3 text-sm text-white">{FAMILIES.map((item) => <option key={item}>{item}</option>)}</select></label></div><button onClick={() => { setRunning(true); setLastEvent("Replay started at " + clock); }} className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-[color:var(--market-text)] px-5 text-sm font-bold text-[#0a0a0c]"><Play size={15} />Start replay</button></section>
          <section className="rounded-2xl border border-[color:var(--market-border)] bg-[color:var(--market-card)] p-5"><div className="flex items-start justify-between gap-4"><div><div className="text-xs font-bold uppercase text-[color:var(--market-live-soft)]">{running ? "Replay running" : "Replay paused"}</div><h2 className="mt-2 font-heading text-2xl font-bold text-white">{fixture.homeTeam} vs {fixture.awayTeam}</h2><div className="mt-1 text-sm text-[color:var(--market-text-2)]">{clock} · {score}</div></div><div className="rounded-xl border border-[color:var(--market-border)] bg-white/[0.04] px-4 py-3 text-center"><div className="text-[10px] text-[color:var(--market-text-3)]">Selected market</div><div className="mt-1 font-bold text-[color:var(--market-positive)]">{family}</div></div></div><div className="mt-5 rounded-xl bg-white/[0.04] p-4"><div className="text-xs text-[color:var(--market-text-3)]">Event stream</div><div className="mt-1 font-semibold text-white">{lastEvent}</div></div><div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">{ACTIONS.map(([event, nextScore]) => <button key={event} onClick={() => simulate(event, nextScore)} className="rounded-xl border border-[color:var(--market-border)] bg-white/[0.04] px-3 py-3 text-xs font-bold text-[#e6e6e9] hover:border-[color:var(--market-border-strong)] hover:text-white">{event === "Goal" ? <Zap size={14} className="mx-auto mb-1 text-[color:var(--market-positive-soft)]" /> : event === "Corner" ? <CornerDownRight size={14} className="mx-auto mb-1 text-[color:var(--market-positive-soft)]" /> : <Flag size={14} className="mx-auto mb-1 text-[#d8ec52]" />}{event}</button>)}</div></section>
          <SettlementProof market={family === "Goals" ? "Goal in Next 5m" : family + " event in window"} window={clock + " → replay end"} startScore="1-1" endScore={score} outcome={score === "2-1" ? "YES" : "NO"} demo />
        </main>
        <aside className="space-y-4"><ActivityFeed /><section className="rounded-2xl border border-[color:var(--market-border)] bg-[color:var(--market-panel)] p-5"><ShieldCheck size={20} className="text-[#d7d7dc]" /><h2 className="mt-3 font-heading text-lg font-bold text-white">Open the real devnet flow</h2><p className="mt-2 text-sm leading-6 text-[color:var(--market-text-2)]">Replay events are simulated. Market creation, YES/NO buying, settlement, and claims remain available in the live terminal.</p><Link href="/live" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#d7d7dc]">Open live terminal <TimerReset size={15} /></Link></section></aside>
      </div>
      <p className="text-xs text-[#a8ab8a]">Replay mode uses simulated TxLINE-compatible event data unless real historical TxLINE data is configured.</p>
    </div>
  );
}
