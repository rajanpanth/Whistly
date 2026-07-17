"use client";

import Link from "next/link";
import { formatDollars, PollStatus, type DemoPoll } from "@/components/Providers";
import { useLanguage } from "@/lib/languageContext";

export default function CreatorDashboard({ myPolls }: { myPolls: DemoPoll[] }) {
  const { t } = useLanguage();

  return (
    <div className="bg-surface-100 border border-border rounded-2xl p-4 sm:p-8 mb-4 sm:mb-6">
      <h2 className="font-semibold text-lg mb-4">{t("creatorDashboard")}</h2>

      {/* Creator summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="text-center p-3 bg-surface-50 rounded-xl">
          <div className="text-lg font-bold text-brand-400">{myPolls.length}</div>
          <div className="text-xs text-gray-500 mt-1">{t("pollsCreated")}</div>
        </div>
        <div className="text-center p-3 bg-surface-50 rounded-xl">
          <div className="text-lg font-bold">{myPolls.filter(p => p.status === PollStatus.Active).length}</div>
          <div className="text-xs text-gray-500 mt-1">{t("active")}</div>
        </div>
        <div className="text-center p-3 bg-surface-50 rounded-xl">
          <div className="text-lg font-bold text-green-400">
            {formatDollars(myPolls.reduce((s, p) => s + p.creatorRewardLamports, 0))}
          </div>
          <div className="text-xs text-gray-500 mt-1">{t("creatorRevenue")}</div>
        </div>
        <div className="text-center p-3 bg-surface-50 rounded-xl">
          <div className="text-lg font-bold">
            {formatDollars(myPolls.reduce((s, p) => s + p.totalPoolLamports, 0))}
          </div>
          <div className="text-xs text-gray-500 mt-1">{t("totalVolume")}</div>
        </div>
      </div>

      {/* Per-poll breakdown */}
      <h3 className="text-sm font-medium text-gray-400 mb-2">{t("perPollBreakdown")}</h3>
      <div className="space-y-2">
        {myPolls.map(p => {
          const totalVotes = p.voteCounts.reduce((a, b) => a + b, 0);
          return (
            <div key={p.id} className="flex items-center justify-between p-3 bg-surface-50/30 rounded-xl text-sm">
              <div className="flex-1 min-w-0">
                <Link href={`/polls/${p.id}`} className="font-medium hover:underline truncate block">{p.title}</Link>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                  <span>{totalVotes} votes</span>
                  <span>{p.totalVoters} voters</span>
                  <span>Pool: {formatDollars(p.totalPoolLamports)}</span>
                </div>
              </div>
              <div className="text-right shrink-0 ml-3">
                <div className="text-green-400 font-mono text-xs">{formatDollars(p.creatorRewardLamports)}</div>
                <div className="text-[10px] text-gray-500">reward</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
