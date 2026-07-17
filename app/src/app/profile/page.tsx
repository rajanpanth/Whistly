"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/components/Providers";
import { useLanguage } from "@/lib/languageContext";
import WalletCard from "./WalletCard";
import AchievementsCard from "./AchievementsCard";
import ReferralCard from "./ReferralCard";
import WatchlistCard from "./WatchlistCard";
import MyPollsCard from "./MyPollsCard";
import CreatorDashboard from "./CreatorDashboard";
import VoteHistoryCard from "./VoteHistoryCard";

export default function ProfilePage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const {
    walletConnected,
    walletAddress,
    polls,
    votes,
    connectWallet,
  } = useApp();

  const { t } = useLanguage();

  // Prevent hydration mismatch — profile content depends on wallet state,
  // timers, and dynamic data that differ between server and client.
  if (!mounted) {
    return (
      <div className="max-w-3xl mx-auto py-20 text-center">
        <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (!walletConnected) {
    return (
      <div className="text-center py-20">
        <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-surface-100 border border-border flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-500"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
        </div>
        <p className="text-gray-400 text-lg mb-2 font-medium">{t("connectWalletToView")}</p>
        <p className="text-gray-600 text-sm mb-5">View your stats, vote history, earnings & referral rewards</p>
        <button onClick={connectWallet} className="px-7 py-3 bg-brand-500 hover:bg-brand-600 rounded-2xl font-semibold transition-all active:scale-[0.97] shadow-lg shadow-brand-500/15">
          {t("connectPhantom")}
        </button>
      </div>
    );
  }

  const addr = walletAddress || "";
  const myPolls = polls.filter((p) => p.creator === addr);
  const myVotes = votes.filter((v) => v.voter === addr);

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8 tracking-tight flex items-center gap-2.5">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-brand-400"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
        {t("profile")}
      </h1>

      {/* Wallet Card */}
      <WalletCard />

      {/* Achievements & Badges */}
      <AchievementsCard />

      {/* Referral / Invite */}
      <ReferralCard />

      {/* Bookmarked / Watchlist */}
      <WatchlistCard />

      {/* My Polls */}
      <MyPollsCard myPolls={myPolls} />

      {/* ── Creator Dashboard ── */}
      {myPolls.length > 0 && <CreatorDashboard myPolls={myPolls} />}

      {/* My Vote History */}
      <VoteHistoryCard myVotes={myVotes} polls={polls} />
    </div>
  );
}
