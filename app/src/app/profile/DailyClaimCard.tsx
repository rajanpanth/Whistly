"use client";

import { useState } from "react";
import { useDailyCountdown } from "@/lib/useCountdown";
import { useLanguage } from "@/lib/languageContext";

/* ── Daily Claim Card ── */
export default function DailyClaimCard({ lastClaimTs, onClaim }: { lastClaimTs: number; onClaim: () => Promise<boolean> }) {
  const { timeLeft, canClaim, progress } = useDailyCountdown(lastClaimTs);
  const [claimed, setClaimed] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const { t } = useLanguage();

  const handleClaim = async () => {
    if (claiming) return;
    setClaiming(true);
    try {
      const ok = await onClaim();
      if (ok) setClaimed(true);
      setTimeout(() => setClaimed(false), 2000);
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className={`mb-6 rounded-xl border overflow-hidden transition-all ${canClaim
      ? "bg-gradient-to-r from-green-600/10 to-emerald-600/10 border-green-500/30"
      : "bg-surface-50 border-border"
      }`}>
      <div className="p-3 sm:p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-lg shrink-0 ${canClaim ? "bg-green-600/20 animate-pulse" : "bg-surface-100"
              }`}>
              💰
            </div>
            <div>
              <div className="text-sm font-semibold">{t("dailyReward")}</div>
              <div className="text-xs text-gray-500">{t("claimEvery24h")}</div>
            </div>
          </div>
          <button
            onClick={handleClaim}
            disabled={!canClaim}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${claimed
              ? "bg-green-600 text-white scale-95"
              : canClaim
                ? "bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-600/20 hover:scale-105"
                : "bg-gray-700/50 text-gray-500 cursor-not-allowed"
              }`}
          >
            {claimed ? `✓ ${t("claimed")}` : canClaim ? t("claimOneSol") : timeLeft}
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-surface-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${canClaim ? "bg-green-500" : "bg-brand-600/60"
              }`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[10px] text-gray-600">{t("lastClaimed")}</span>
          <span className="text-[10px] text-gray-600">
            {canClaim ? t("readyNow") : `${timeLeft} ${t("remaining")}`}
          </span>
        </div>
      </div>
    </div>
  );
}
