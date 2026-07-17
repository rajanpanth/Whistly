"use client";

export type TabFilter = "ended" | "active" | "settled" | "all";

interface AdminTabsSearchProps {
  tab: TabFilter;
  onTabChange: (tab: TabFilter) => void;
  search: string;
  onSearchChange: (value: string) => void;
  endedUnsettled: number;
}

export default function AdminTabsSearch({ tab, onTabChange, search, onSearchChange, endedUnsettled }: AdminTabsSearchProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <div className="flex bg-surface-50 border border-border rounded-lg p-0.5">
        {(["ended", "active", "settled", "all"] as TabFilter[]).map(t => (
          <button
            key={t}
            onClick={() => onTabChange(t)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${tab === t
              ? t === "ended" ? "bg-red-600/20 text-red-400" : "bg-brand-600/20 text-brand-400"
              : "text-gray-400 hover:text-white"
              }`}
          >
            {t === "ended" ? `Ended (${endedUnsettled})` : t}
          </button>
        ))}
      </div>
      <input
        type="text"
        placeholder="Search polls..."
        value={search}
        onChange={e => onSearchChange(e.target.value)}
        className="w-full sm:w-64 px-3 py-2 bg-surface-50 border border-border rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500/50"
      />
    </div>
  );
}
