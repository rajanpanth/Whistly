"use client";

const DEFAULT_FAMILIES = ["All", "Goals", "Corners", "Penalties", "Offsides", "Cards", "Totals", "Goal Gap", "Match Result", "5m", "15m", "45m", "Resolved"];

export default function MarketFamilyTabs({ active, onChange, families = DEFAULT_FAMILIES }: { active: string; onChange: (family: string) => void; families?: readonly string[] }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
      <div className="flex w-max gap-2">
        {families.map((family) => <button key={family} type="button" onClick={() => onChange(family)} className={"h-9 rounded-[0.65rem] border px-4 text-xs font-bold transition " + (active === family ? "border-[#3b3b43] bg-[#f4f4f5] text-[#0a0a0c]" : "border-transparent bg-[#111114] text-[#898991] hover:border-[#29292f] hover:bg-[#18181c] hover:text-white")}>{family}</button>)}
      </div>
    </div>
  );
}
