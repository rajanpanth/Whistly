"use client";

const DEFAULT_FAMILIES = ["All", "Goals", "Corners", "Penalties", "Offsides", "Cards", "Totals", "Goal Gap", "Match Result", "5m", "15m", "45m", "Resolved"];

export default function MarketFamilyTabs({ active, onChange, families = DEFAULT_FAMILIES }: { active: string; onChange: (family: string) => void; families?: readonly string[] }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
      <div className="flex w-max gap-2">
        {families.map((family) => <button key={family} type="button" onClick={() => onChange(family)} className={"h-10 rounded-full border px-4 text-xs font-bold transition " + (active === family ? "border-cyan-300 bg-cyan-300 text-[#010820]" : "border-white/10 bg-[#0d142b] text-slate-300 hover:border-white/25 hover:text-white")}>{family}</button>)}
      </div>
    </div>
  );
}
