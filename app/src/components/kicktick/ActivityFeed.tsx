import { Activity, CircleDot } from "lucide-react";

const EVENTS = [["63:00", "Market opened", "on-chain"], ["63:10", "User bought YES", "demo"], ["64:15", "User bought NO", "demo"], ["65:30", "Goal detected", "demo"], ["68:00", "Window ended", "demo"], ["68:03", "Market resolved YES", "on-chain"]];

export default function ActivityFeed({ compact = false }: { compact?: boolean }) {
  return <section className="rounded-xl border border-[#29292f] bg-[#141418] p-4"><h2 className="flex items-center gap-2 font-heading text-sm font-bold text-[#f4f4f5]"><Activity size={16} className="text-[#20d38a]" />Activity feed <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-[#d8ec52]">Demo activity</span></h2><div className={"mt-3 " + (compact ? "space-y-1.5" : "space-y-2")}>{EVENTS.slice(0, compact ? 4 : 6).map(([time, label, state]) => <div key={time + label} className="flex items-center gap-3 rounded-lg bg-white/[0.04] px-3 py-2 text-xs"><span className="w-10 font-mono text-[#6f6f78]">{time}</span><CircleDot size={11} className={state === "on-chain" ? "text-[#20d38a]" : "text-[#d8ec52]"} /><span className="min-w-0 flex-1 truncate text-[#d4d4d8]">{label}</span><span className="text-[10px] uppercase tracking-wide text-[#6f6f78]">{state}</span></div>)}</div></section>;
}
