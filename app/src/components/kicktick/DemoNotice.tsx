import { AlertTriangle } from "lucide-react";

export default function DemoNotice({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex items-start gap-2 rounded-lg border border-[#e6ff3e]/20 bg-[#e6ff3e]/[0.05] text-[#e4e8c9] ${compact ? "p-3 text-xs" : "p-4 text-sm"}`}>
      <AlertTriangle className="mt-0.5 shrink-0 text-[#d8ec52]" size={16} />
      <span><strong className="text-[#f0f5cf]">Demo mode:</strong> using simulated TxLINE-compatible match data. Markets resolve from score data, not majority vote.</span>
    </div>
  );
}
