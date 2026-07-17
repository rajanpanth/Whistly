"use client";

import Link from "next/link";
import { formatDollars, PollStatus, type DemoPoll } from "@/components/Providers";
import { useLanguage } from "@/lib/languageContext";

export default function MyPollsCard({ myPolls }: { myPolls: DemoPoll[] }) {
  const { t } = useLanguage();

  return (
    <div className="bg-surface-100 border border-border rounded-2xl p-4 sm:p-8 mb-4 sm:mb-6">
      <h2 className="font-semibold text-lg mb-4">{t("myCreatedPolls")}</h2>
      {myPolls.length === 0 ? (
        <p className="text-gray-500 text-sm">{t("noPollsCreatedYet")}</p>
      ) : (
        <div className="space-y-3">
          {myPolls.map((p) => (
            <Link key={p.id} href={`/polls/${p.id}`} className="flex justify-between items-center p-3 bg-surface-50 rounded-xl hover:bg-surface-100 transition-colors">
              <div>
                <div className="font-medium">{p.title}</div>
                <div className="text-xs text-gray-500">
                  {p.options.length} options · {p.voteCounts.reduce((a, b) => a + b, 0)} votes · Pool: {formatDollars(p.totalPoolLamports)}
                </div>
              </div>
              <span className={`text-xs font-semibold px-2 py-1 rounded ${p.status === PollStatus.Settled ? "bg-green-600/20 text-green-400" : "bg-brand-500/20 text-brand-400"
                }`}>
                {p.status === PollStatus.Settled ? t("settled") : t("active")}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
