"use client";

import { CATEGORIES } from "@/lib/constants";
import { useLanguage } from "@/lib/languageContext";
import { tCat } from "@/lib/translations";

interface BasicDetailsFieldsProps {
  title: string;
  setTitle: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  category: string;
  setCategory: (v: string) => void;
}

export default function BasicDetailsFields({
  title,
  setTitle,
  description,
  setDescription,
  category,
  setCategory,
}: BasicDetailsFieldsProps) {
  const { t, lang } = useLanguage();

  return (
    <>
      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">{t("pollTitle")}</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={64}
          placeholder="Will Brazil score 3+ goals in its opener?"
          className="w-full px-4 py-3 bg-surface-100 border border-border rounded-xl focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-colors"
        />
        <div className="text-xs text-gray-600 mt-1 text-right">{title.length}/64</div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">{t("description")}</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={256}
          rows={3}
          placeholder="Describe the poll conditions and how the winner is determined..."
          className="w-full px-4 py-3 bg-surface-100 border border-border rounded-xl focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-colors resize-none"
        />
        <div className="text-xs text-gray-600 mt-1 text-right">{description.length}/256</div>
      </div>

      {/* Category */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">{t("category")}</label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                category === cat
                  ? "bg-brand-600 text-white shadow-lg shadow-brand-500/15"
                  : "bg-surface-100 text-gray-400 hover:text-white border border-border hover:border-gray-600"
              }`}
            >
              {tCat(cat, lang)}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
