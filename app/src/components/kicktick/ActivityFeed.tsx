import { Activity, CircleDot } from "lucide-react";

const EVENTS = [["63:00", "Market opened", "on-chain"], ["63:10", "User bought YES", "demo"], ["64:15", "User bought NO", "demo"], ["65:30", "Goal detected", "demo"], ["68:00", "Window ended", "demo"], ["68:03", "Market resolved YES", "on-chain"]];

export default function ActivityFeed({ compact = false }: { compact?: boolean }) {
  return <section className="rounded-2xl border border-white/[0.08] bg-[#0d142b] p-4"><h2 className="flex items-center gap-2 font-heading text-sm font-bold text-white"><Activity size={16} className="text-cyan-300" />Activity feed <span className="ml-auto text-[10px] font-medium uppercase text-amber-300">Demo activity</span></h2><div className={"mt-3 " + (compact ? "space-y-1.5" : "space-y-2")}>{EVENTS.slice(0, compact ? 4 : 6).map(([time, label, state]) => <div key={time + label} className="flex items-center gap-3 rounded-xl bg-black/15 px-3 py-2 text-xs"><span className="w-10 text-slate-500">{time}</span><CircleDot size={11} className={state === "on-chain" ? "text-emerald-300" : "text-amber-300"} /><span className="min-w-0 flex-1 truncate text-slate-200">{label}</span><span className="text-[10px] text-slate-500">{state}</span></div>)}</div></section>;
}
