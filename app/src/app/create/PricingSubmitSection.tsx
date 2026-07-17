"use client";

import { useApp, formatDollars } from "@/components/Providers";
import { useLanguage } from "@/lib/languageContext";

interface PricingSubmitSectionProps {
  unitPrice: string;
  setUnitPrice: (v: string) => void;
  durationHours: string;
  setDurationHours: (v: string) => void;
  submitting: boolean;
  imageUploading: boolean;
}

export default function PricingSubmitSection({
  unitPrice,
  setUnitPrice,
  durationHours,
  setDurationHours,
  submitting,
  imageUploading,
}: PricingSubmitSectionProps) {
  const { userAccount } = useApp();
  const { t } = useLanguage();

  // ── Preview math ──
  const CREATION_FEE_PREVIEW = 500_000_000; // 0.5 SOL

  return (
    <>
      {/* Pricing */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">{t("unitPrice")}</label>
          <input
            type="number"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            step="0.001"
            min="0.001"
            className="w-full px-4 py-3 bg-surface-100 border border-border rounded-xl focus:border-brand-500 outline-none transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">{t("duration")}</label>
          <input
            type="number"
            value={durationHours}
            onChange={(e) => setDurationHours(e.target.value)}
            min="1"
            max="720"
            className="w-full px-4 py-3 bg-surface-100 border border-border rounded-xl focus:border-brand-500 outline-none transition-colors"
          />
        </div>
      </div>

      {/* Creation Fee */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Creation Fee</label>
        <div className="w-full px-4 py-3 bg-surface-100 border border-border rounded-xl text-gray-400 text-sm">
          0.5 SOL (flat platform fee — non-refundable once the poll has votes)
        </div>
      </div>

      {/* Preview */}
      <div className="bg-surface-100 border border-border rounded-2xl p-4 sm:p-6">
        <h3 className="font-semibold mb-4 text-gray-300 flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-brand-400"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          {t("tokenomicsPreview")}
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:gap-3 text-sm">
          <div className="text-gray-400">Creation fee (platform)</div>
          <div className="text-right font-mono">{formatDollars(CREATION_FEE_PREVIEW)}</div>
          <div className="text-gray-400">Voter pool seed</div>
          <div className="text-right font-mono text-gray-500">0 SOL (voters fill it)</div>
          <div className="text-gray-400">On settlement: creator gets</div>
          <div className="text-right font-mono text-green-400">2% of voter pool</div>
          <div className="text-gray-400">On settlement: winners share</div>
          <div className="text-right font-mono text-brand-400">95% of voter pool</div>
          <div className="text-gray-400 font-semibold border-t border-border pt-2">Total you pay now</div>
          <div className="text-right font-mono font-semibold border-t border-border pt-2">{formatDollars(CREATION_FEE_PREVIEW)}</div>
        </div>
      </div>

      {/* Balance check */}
      {userAccount && (
        <div className="text-sm text-gray-400">
          {t("yourBalance")} <span className="text-brand-400 font-semibold">{formatDollars(userAccount.balance)}</span>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting || imageUploading}
        className={`w-full py-3.5 sm:py-4 rounded-2xl font-semibold text-base sm:text-lg transition-all transform hover:scale-[1.01] active:scale-[0.99] ${
          submitting || imageUploading
            ? "bg-gray-700 text-gray-500 cursor-not-allowed"
            : "bg-brand-500 hover:bg-brand-600 shadow-lg shadow-brand-500/15"
        }`}
      >
        {submitting
          ? imageUploading
            ? t("uploadingImages")
            : t("creatingPoll")
          : t("createPoll")}
      </button>
    </>
  );
}
