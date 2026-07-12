import { Activity, Database, ShieldCheck } from "lucide-react";

export default function DataHealthWidget({ connected = false, compact = false }: { connected?: boolean; compact?: boolean }) {
  const state = connected ? "Connected" : "Demo";
  const values = [["Scores", state], ["Odds", state], ["Fixtures", state], ["Last update", "2s ago"], ["Network", "Devnet"], ["Delay", connected ? "Real-time" : "Demo"]];
  return (
    <section className="rounded-2xl border border-cyan-400/20 bg-[#081426] p-4 shadow-xl shadow-cyan-950/10">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-heading text-sm font-bold text-white"><Activity size={16} className="text-cyan-300" />TxLINE Data Health</div>
        <span className={"rounded-full px-2 py-1 text-[10px] font-bold uppercase " + (connected ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/10 text-amber-300")}><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-current" />{state}</span>
      </div>
      <div className={"mt-4 grid gap-2 text-xs " + (compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3")}>
        {values.map(([label, value]) => <div key={label} className="rounded-xl border border-white/[0.07] bg-black/15 p-2.5"><div className="text-slate-500">{label}</div><div className="mt-1 font-semibold text-slate-100">{value}</div></div>)}
      </div>
      {!connected && !compact && <div className="mt-3 flex items-start gap-2 text-xs leading-5 text-slate-400"><Database size={13} className="mt-0.5 shrink-0 text-cyan-300" />TxLINE real credentials not configured. Demo mode is using simulated TxLINE-compatible data.</div>}
      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-cyan-200"><ShieldCheck size={12} />Credentials and tokens are never displayed.</div>
    </section>
  );
}
