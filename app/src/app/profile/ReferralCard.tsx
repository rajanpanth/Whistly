"use client";

import { useApp } from "@/components/Providers";
import { shortAddr } from "@/lib/utils";
import { useReferralData } from "@/lib/referrals";
import toast from "react-hot-toast";
import { useLanguage } from "@/lib/languageContext";

export default function ReferralCard() {
  const { walletAddress } = useApp();
  const { referralCode, referralLink, copyReferralLink, referredBy, referrals, referralCount } = useReferralData(walletAddress);
  const { t } = useLanguage();

  return (
    <div className="bg-surface-100 border border-border rounded-2xl p-4 sm:p-8 mb-4 sm:mb-6">
      <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-brand-400">
          <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" />
        </svg>
        {t("inviteFriends")}
      </h2>

      {/* Referral link */}
      <div className="mb-4 p-3 bg-surface-50/60 border border-border rounded-xl">
        <div className="text-xs text-gray-400 mb-1.5">{t("yourReferralLink")}</div>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-sm font-mono text-brand-300 truncate bg-surface-0/50 px-3 py-2 rounded-lg">
            {referralLink || t("connectWalletGetLink")}
          </code>
          <button
            onClick={() => {
              copyReferralLink();
              toast.success(t("referralCopied"));
            }}
            disabled={!referralLink}
            className="px-3 py-2 text-xs font-semibold bg-brand-600 hover:bg-brand-500 rounded-lg transition-colors disabled:opacity-40"
          >
            {t("copy")}
          </button>
        </div>
        {referralCode && (
          <div className="text-[10px] text-gray-500 mt-1.5">Code: <span className="font-mono text-gray-400">{referralCode}</span></div>
        )}
      </div>

      {/* Referral stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="text-center p-3 bg-surface-50 rounded-xl">
          <div className="text-lg font-bold text-brand-400">{referralCount}</div>
          <div className="text-xs text-gray-500 mt-1">{t("friendsInvited")}</div>
        </div>
        <div className="text-center p-3 bg-surface-50 rounded-xl">
          <div className="text-lg font-bold">{referredBy ? "Yes" : "—"}</div>
          <div className="text-xs text-gray-500 mt-1">{t("referredBy")}</div>
        </div>
      </div>

      {/* Recent referrals */}
      {referrals.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-2">{t("recentReferrals")}</h3>
          <div className="space-y-2">
            {referrals.slice(0, 5).map((r, i) => (
              <div key={i} className="flex items-center justify-between p-2.5 bg-surface-50/30 rounded-lg text-sm">
                <span className="font-mono text-xs text-gray-300">{shortAddr(r.referee)}</span>
                <span className="text-[10px] text-gray-500">
                  {new Date(r.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
            {referrals.length > 5 && (
              <div className="text-xs text-gray-500 text-center">+{referrals.length - 5} more</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
