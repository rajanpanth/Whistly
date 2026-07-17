"use client";

import { useState } from "react";
import Image from "next/image";
import { useApp, formatDollars } from "@/components/Providers";
import { shortAddr } from "@/lib/utils";
import { useUserProfiles } from "@/lib/userProfiles";
import { uploadPollImage } from "@/lib/uploadImage";
import { sanitizeDisplayName } from "@/lib/sanitize";
import toast from "react-hot-toast";
import { useLanguage } from "@/lib/languageContext";
import DailyClaimCard from "./DailyClaimCard";

export default function WalletCard() {
  const { walletAddress, userAccount, claimDailyReward } = useApp();
  const { getProfile, getDisplayName, getAvatarUrl, updateProfile } = useUserProfiles();
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileAvatarFile, setProfileAvatarFile] = useState<File | null>(null);
  const [profileAvatarPreview, setProfileAvatarPreview] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const { t } = useLanguage();

  const addr = walletAddress || "";
  const u = userAccount;

  const netProfit = u ? u.totalWinningsLamports - u.totalSpentLamports : 0;

  return (
    <div className="bg-surface-100 border border-border rounded-2xl p-4 sm:p-8 mb-4 sm:mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          {/* User Avatar */}
          {getAvatarUrl(addr) ? (
            getAvatarUrl(addr).startsWith("data:") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={getAvatarUrl(addr)} alt="Avatar" className="w-14 h-14 rounded-full object-cover border-2 border-brand-500/25" />
            ) : (
              <Image src={getAvatarUrl(addr)} alt="Avatar" width={56} height={56} className="w-14 h-14 rounded-full object-cover border-2 border-brand-500/25" unoptimized />
            )
          ) : (
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-brand-500 to-brand-500 flex items-center justify-center text-xl font-bold text-white">
              {getDisplayName(addr).charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div className="font-semibold text-lg">{getDisplayName(addr)}</div>
            <div className="font-mono text-xs text-gray-500">{shortAddr(addr)}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setEditingProfile(true);
              setProfileName(getProfile(addr)?.displayName || "");
              setProfileAvatarPreview(getAvatarUrl(addr) || null);
            }}
            className="px-3 py-1.5 text-xs font-medium border border-border text-gray-300 rounded-lg hover:bg-dark-600 transition-colors"
          >
            {t("editProfile")}
          </button>
          <div className="sm:text-right">
            <div className="text-sm text-gray-400">{t("balance")}</div>
            <div className="text-xl font-bold text-brand-400">
              {u ? formatDollars(u.balance) : "0 SOL"}
            </div>
          </div>
        </div>
      </div>

      {/* Profile Editor */}
      {editingProfile && (
        <div className="mb-6 p-4 bg-surface-50 border border-border rounded-xl animate-scaleIn">
          <h3 className="text-sm font-semibold mb-3">{t("editProfile")}</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">{t("displayName")}</label>
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                maxLength={24}
                placeholder={t("enterDisplayName")}
                className="w-full px-3 py-2 bg-surface-0 border border-border rounded-lg text-sm focus:border-brand-500 outline-none"
              />
              <span className="text-[10px] text-gray-600">{profileName.length}/24</span>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">{t("profilePicture")}</label>
              <div className="flex items-center gap-3">
                {profileAvatarPreview ? (
                  <div className="relative group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={profileAvatarPreview} alt="Preview" className="w-12 h-12 rounded-full object-cover border border-border" />
                    <button
                      type="button"
                      onClick={() => { setProfileAvatarFile(null); setProfileAvatarPreview(null); }}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center text-xs"
                    >
                      &times;
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 px-3 py-2 bg-surface-100 border border-border border-dashed rounded-lg cursor-pointer hover:border-gray-500 transition-colors">
                    <span className="text-xs text-gray-500">{t("uploadAvatar")}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setProfileAvatarFile(file);
                          setProfileAvatarPreview(URL.createObjectURL(file));
                        }
                        e.target.value = "";
                      }}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setEditingProfile(false)}
                className="flex-1 px-3 py-2 text-sm border border-border text-gray-400 rounded-lg hover:bg-surface-100"
              >
                {t("cancel")}
              </button>
              <button
                disabled={savingProfile}
                onClick={async () => {
                  setSavingProfile(true);
                  try {
                    let avatarUrl = getAvatarUrl(addr);
                    if (profileAvatarFile) {
                      try {
                        avatarUrl = await uploadPollImage(profileAvatarFile);
                      } catch {
                        toast.error(t("avatarUploadFailed"));
                        setSavingProfile(false);
                        return;
                      }
                    }
                    if (!profileAvatarPreview) avatarUrl = "";
                    const ok = await updateProfile(addr, sanitizeDisplayName(profileName), avatarUrl);
                    if (ok) {
                      toast.success(t("profileUpdated"));
                      setEditingProfile(false);
                    } else {
                      toast.error(t("failedToSaveProfile"));
                    }
                  } finally {
                    setSavingProfile(false);
                  }
                }}
                className="flex-1 px-3 py-2 text-sm bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-semibold"
              >
                {savingProfile ? t("saving") : t("save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Signup Bonus Badge */}
      {u?.signupBonusClaimed && (
        <div className="mb-4 p-3 bg-purple-600/10 border border-purple-500/20 rounded-xl flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-purple-600/20 flex items-center justify-center text-lg shrink-0">🎁</div>
          <div>
            <div className="text-sm font-medium text-purple-300">{t("welcomeBonusClaimed")}</div>
            <div className="text-xs text-gray-500">{t("onChainActive")}</div>
          </div>
        </div>
      )}

      {/* Daily Reward */}
      {u && <DailyClaimCard lastClaimTs={u.lastWeeklyRewardTs} onClaim={claimDailyReward} />}

      {/* Stats grid */}
      {u && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label={t("pollsCreated")} value={u.pollsCreated.toString()} />
          <Stat label={t("pollsVoted")} value={u.totalPollsVoted.toString()} />
          <Stat label={t("totalVotes")} value={u.totalVotesCast.toString()} />
          <Stat label={t("pollsWon")} value={u.pollsWon.toString()} />
          <Stat label={t("totalSpent")} value={formatDollars(u.totalSpentLamports)} />
          <Stat label={t("totalWon")} value={formatDollars(u.totalWinningsLamports)} highlight />
          <Stat
            label={t("netProfit")}
            value={`${netProfit >= 0 ? "+" : ""}${formatDollars(netProfit)}`}
            highlight
          />
          <Stat label={t("creatorEarnings")} value={formatDollars(u.creatorEarningsLamports)} />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="text-center p-3 sm:p-4 bg-surface-50 border border-border rounded-xl">
      <div className={`text-lg font-bold font-mono ${highlight ? "text-green-400" : ""}`}>
        {value}
      </div>
      <div className="text-xs text-gray-500 mt-1.5">{label}</div>
    </div>
  );
}
