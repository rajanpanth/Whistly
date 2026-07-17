"use client";

import Link from "next/link";
import { formatDollars, type DemoPoll, type DemoVote } from "@/components/Providers";
import { useLanguage } from "@/lib/languageContext";

export default function VoteHistoryCard({ myVotes, polls }: { myVotes: DemoVote[]; polls: DemoPoll[] }) {
  const { t } = useLanguage();

  return (
    <div className="bg-surface-100 border border-border rounded-2xl p-4 sm:p-8 mb-20 sm:mb-6">
      <h2 className="font-semibold text-lg mb-4">{t("myVoteHistory")}</h2>
      {myVotes.length === 0 ? (
        <p className="text-gray-500 text-sm">{t("noVotesCastYet")}</p>
      ) : (
        <div className="space-y-3">
          {myVotes.map((v, i) => {
            const p = polls.find((pl) => pl.id === v.pollId);
            if (!p) return null;
            return (
              <Link key={i} href={`/polls/${p.id}`} className="flex justify-between items-center p-3 bg-surface-50 rounded-xl hover:bg-surface-100 transition-colors">
                <div>
                  <div className="font-medium">{p.title}</div>
                  <div className="text-xs text-gray-500">
                    {v.votesPerOption
                      .map((count, idx) => count > 0 ? `${p.options[idx]}: ${count}` : null)
                      .filter(Boolean)
                      .join(", ")}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-mono">{formatDollars(v.totalStakedLamports)}</div>
                  {v.claimed && <span className="text-xs text-green-400">Claimed</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
