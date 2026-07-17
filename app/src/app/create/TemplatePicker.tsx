"use client";

import { useLanguage } from "@/lib/languageContext";

export const TEMPLATES = [
  {
    name: "🏆 Tournament Winner",
    title: "Who will win the 2026 FIFA World Cup?",
    category: "World Cup",
    options: ["Brazil", "France", "Argentina", "England", "Other"],
    duration: "720",
    unitPrice: "0.01",
  },
  {
    name: "⚽ Match Winner",
    title: "[TEAM A] vs [TEAM B] — who wins?",
    category: "World Cup",
    options: ["Team A", "Team B", "Draw"],
    duration: "48",
    unitPrice: "0.005",
  },
  {
    name: "🥅 Goal Market",
    title: "Will [TEAM] score 2+ goals against [OPPONENT]?",
    category: "World Cup",
    options: ["Yes", "No"],
    duration: "168",
    unitPrice: "0.01",
  },
  {
    name: "🎯 Knockout Prop",
    title: "Will [TEAM] reach the quarterfinals?",
    category: "World Cup",
    options: ["Yes", "No"],
    duration: "72",
    unitPrice: "0.01",
  },
  {
    name: "👟 Golden Boot",
    title: "Which player wins the Golden Boot?",
    category: "World Cup",
    options: ["Mbappe", "Messi", "Kane", "Vinicius Jr", "Other"],
    duration: "720",
    unitPrice: "0.005",
  },
];

export type Template = (typeof TEMPLATES)[number];

interface TemplatePickerProps {
  onApply: (tpl: Template) => void;
}

export default function TemplatePicker({ onApply }: TemplatePickerProps) {
  const { t } = useLanguage();

  return (
    <div className="mb-6">
      <p className="text-xs text-gray-500 mb-2">{t("quickStart")}</p>
      <div className="flex flex-wrap gap-2">
        {TEMPLATES.map((tpl) => (
          <button
            key={tpl.name}
            type="button"
            onClick={() => onApply(tpl)}
            className="px-3 py-1.5 bg-surface-50 hover:bg-surface-100 border border-border rounded-lg text-xs text-gray-300 transition-colors hover:border-brand-500/25"
          >
            {tpl.name}
          </button>
        ))}
      </div>
    </div>
  );
}
