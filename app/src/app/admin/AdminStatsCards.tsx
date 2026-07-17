"use client";

import { formatDollars } from "@/components/Providers";

interface AdminStatsCardsProps {
  totalPolls: number;
  activeCount: number;
  endedUnsettled: number;
  settledCount: number;
  totalPool: number;
}

export default function AdminStatsCards({ totalPolls, activeCount, endedUnsettled, settledCount, totalPool }: AdminStatsCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {[
        { label: "Total Polls", value: totalPolls, color: "text-white" },
        { label: "Active", value: activeCount, color: "text-green-400" },
        { label: "Needs Settlement", value: endedUnsettled, color: "text-red-400" },
        { label: "Settled", value: settledCount, color: "text-blue-400" },
        { label: "Total Pool", value: formatDollars(totalPool), color: "text-brand-400" },
      ].map(stat => (
        <div key={stat.label} className="bg-surface-50 border border-border rounded-xl p-3 text-center">
          <div className={`text-lg font-bold ${stat.color}`}>{stat.value}</div>
          <div className="text-xs text-gray-500">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}
