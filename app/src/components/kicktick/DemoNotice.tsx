import { AlertTriangle } from "lucide-react";

export default function DemoNotice({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-400/[0.08] text-amber-100 ${compact ? "p-3 text-xs" : "p-4 text-sm"}`}>
      <AlertTriangle className="mt-0.5 shrink-0 text-amber-300" size={16} />
      <span><strong>Demo mode:</strong> using simulated TxLINE-compatible match data. Markets resolve from score data, not majority vote.</span>
    </div>
  );
}
