"use client";

import { useLanguage } from "@/lib/languageContext";

export const MAX_OPTIONS = 6;

interface OptionsEditorProps {
  options: string[];
  optionImagePreviews: (string | null)[];
  optionImageErrors: (string | null)[];
  updateOption: (idx: number, val: string) => void;
  removeOption: (idx: number) => void;
  addOption: () => void;
  handleOptionImageSelect: (index: number) => (file: File) => void;
  handleOptionImageRemove: (index: number) => () => void;
}

export default function OptionsEditor({
  options,
  optionImagePreviews,
  optionImageErrors,
  updateOption,
  removeOption,
  addOption,
  handleOptionImageSelect,
  handleOptionImageRemove,
}: OptionsEditorProps) {
  const { t } = useLanguage();

  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-2">{t("options")} (2-6)</label>
      <div className="space-y-3">
        {options.map((opt, i) => (
          <div key={i} className="space-y-2">
            <div className="flex gap-2 items-center">
              <div className="w-8 h-10 flex items-center justify-center text-gray-500 font-mono text-sm shrink-0">
                {String.fromCharCode(65 + i)}
              </div>
              <input
                type="text"
                value={opt}
                onChange={(e) => updateOption(i, e.target.value)}
                maxLength={32}
                placeholder={`Option ${String.fromCharCode(65 + i)}`}
                className="flex-1 px-4 py-2.5 bg-surface-100 border border-border rounded-xl focus:border-brand-500 outline-none transition-colors"
              />
              {options.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeOption(i)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-600/10 hover:text-red-300 transition-colors shrink-0"
                  aria-label={`Remove option ${String.fromCharCode(65 + i)}`}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 1l12 12M13 1L1 13" />
                  </svg>
                </button>
              )}
            </div>
            {/* Option image upload for each option */}
            {i < options.length && (
              <div className="ml-8">
                <label className="block text-xs text-gray-500 mb-1.5">
                  Option {String.fromCharCode(65 + i)} Avatar <span className="text-gray-600">(optional)</span>
                </label>
                <div className="max-w-[200px]">
                  {optionImagePreviews[i] ? (
                    <div className="relative group w-16 h-16">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={optionImagePreviews[i]!}
                        alt={`Option ${String.fromCharCode(65 + i)}`}
                        className="w-16 h-16 rounded-full object-cover border-2 border-border"
                      />
                      <button
                        type="button"
                        onClick={handleOptionImageRemove(i)}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        &times;
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center gap-2 px-3 py-2 bg-surface-100 border border-border border-dashed rounded-lg cursor-pointer hover:border-gray-500 transition-colors">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-500">
                        <rect x="3" y="3" width="18" height="18" rx="9" />
                        <path d="M12 8v8M8 12h8" />
                      </svg>
                      <span className="text-xs text-gray-500">{t("addAvatar")}</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleOptionImageSelect(i)(file);
                          e.target.value = "";
                        }}
                        className="hidden"
                      />
                    </label>
                  )}
                  {optionImageErrors[i] && (
                    <p className="text-xs text-red-400 mt-1">{optionImageErrors[i]}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      {options.length < MAX_OPTIONS && (
        <button
          type="button"
          onClick={addOption}
          className="mt-3 text-sm text-brand-400 hover:text-brand-300 flex items-center gap-1 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M7 1v12M1 7h12" />
          </svg>
          {t("addOption")}
        </button>
      )}
    </div>
  );
}
