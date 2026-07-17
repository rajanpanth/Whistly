"use client";

import { useApp } from "@/components/Providers";
import { computeBadges } from "@/lib/badges";

export default function AchievementsCard() {
  const { userAccount } = useApp();
  const u = userAccount;
  if (!u) return null;

  const badges = computeBadges({
    totalVotesCast: u.totalVotesCast,
    pollsCreated: u.pollsCreated,
    pollsWon: u.pollsWon,
    totalPollsVoted: u.totalPollsVoted,
    totalWinningsLamports: u.totalWinningsLamports,
    totalSpentLamports: u.totalSpentLamports,
    createdAt: u.createdAt,
    loginStreak: u.loginStreak,
  });
  const earned = badges.filter(b => b.earned);
  const unearned = badges.filter(b => !b.earned);
  const streak = u.loginStreak;
  return (
    <div className="bg-surface-100 border border-border rounded-2xl p-4 sm:p-8 mb-4 sm:mb-6">
      <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
        🏅 Achievements
        <span className="text-xs text-gray-500 font-normal">({earned.length}/{badges.length})</span>
      </h2>

      {/* Streak */}
      {streak > 0 && (
        <div className="mb-4 p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center gap-3">
          <span className="text-2xl">🔥</span>
          <div>
            <div className="text-sm font-semibold text-orange-300">{streak}-Day Login Streak!</div>
            <div className="text-xs text-gray-500">Keep it going for more rewards</div>
          </div>
        </div>
      )}

      {/* Earned */}
      {earned.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-4">
          {earned.map(badge => (
            <div key={badge.id} className="p-3 bg-brand-500/5 border border-brand-500/20 rounded-xl text-center">
              <div className="text-2xl mb-1">{badge.icon}</div>
              <div className="text-xs font-semibold text-white">{badge.name}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">{badge.description}</div>
            </div>
          ))}
        </div>
      )}

      {/* Unearned (locked) */}
      {unearned.length > 0 && (
        <>
          <p className="text-xs text-gray-600 mb-2">Locked</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {unearned.map(badge => (
              <div key={badge.id} className="p-3 bg-surface-50 border border-border rounded-xl text-center opacity-50">
                <div className="text-2xl mb-1 grayscale">🔒</div>
                <div className="text-xs font-semibold text-gray-400">{badge.name}</div>
                <div className="text-[10px] text-gray-600 mt-0.5">{badge.description}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
