"use client";

import { useEffect, useState } from "react";
import { Activity, Database, ShieldCheck } from "lucide-react";

type ServiceState = "connected" | "not_configured" | "error" | "mock" | "not_implemented";

type TxLineStatus = {
  status: ServiceState;
  connected: boolean;
  configured: boolean;
  mockModeEnabled: boolean;
  missingEnvVars: string[];
  settlementEnabled: boolean;
  network: string;
  lastCheckedAt: string;
  services: { fixtures: ServiceState; scores: ServiceState; odds: ServiceState };
  note: string;
};

const STATE_LABEL: Record<ServiceState, string> = {
  connected: "Connected",
  not_configured: "Not configured",
  error: "Error",
  mock: "Mock",
  not_implemented: "—",
};

function badgeClasses(state: ServiceState | "loading"): string {
  if (state === "connected") return "bg-[#20d38a]/10 text-[color:var(--market-positive-soft)]";
  if (state === "mock") return "bg-[#e6ff3e]/10 text-[#d8ec52]";
  if (state === "error") return "bg-[#fa4669]/10 text-[color:var(--market-live-soft)]";
  return "bg-white/[0.06] text-[color:var(--market-text-2)]";
}

export default function DataHealthWidget({ compact = false }: { connected?: boolean; compact?: boolean }) {
  const [status, setStatus] = useState<TxLineStatus | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () => fetch("/api/txline/status")
      .then(res => res.json())
      .then(data => { if (!cancelled) { setStatus(data); setFailed(false); } })
      .catch(() => { if (!cancelled) setFailed(true); });
    load();
    const timer = window.setInterval(load, 30_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);

  const headline: ServiceState | "loading" = failed ? "error" : status?.status ?? "loading";
  const headlineLabel = failed
    ? "Error"
    : !status
      ? "Checking…"
      : status.connected
        ? "TxLINE Connected"
        : status.mockModeEnabled
          ? "Mock Mode"
          : status.configured
            ? "TxLINE Error"
            : "Not Configured";

  const rows: Array<[string, string]> = status ? [
    ["Fixtures", STATE_LABEL[status.services.fixtures]],
    ["Scores", STATE_LABEL[status.services.scores]],
    ["Odds", STATE_LABEL[status.services.odds]],
    ["Network", status.network],
    ["Settlement", status.settlementEnabled ? "Enabled" : "Disabled"],
    ["Last check", new Date(status.lastCheckedAt).toLocaleTimeString()],
  ] : [];

  return (
    <section className="rounded-xl border border-[color:var(--market-border)] bg-[color:var(--market-panel)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-heading text-sm font-bold text-[color:var(--market-text)]"><Activity size={16} className="text-[color:var(--market-positive)]" />TxLINE Data Health</div>
        <span className={"rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider " + badgeClasses(headline)}><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-current" />{headlineLabel}</span>
      </div>
      <div className={"mt-4 grid gap-2 text-xs " + (compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3")}>
        {rows.map(([label, value]) => <div key={label} className="rounded-lg border border-[#232328] bg-white/[0.03] p-2.5"><div className="text-[color:var(--market-text-3)]">{label}</div><div className="mt-1 font-semibold text-[#e6e6e9]">{value}</div></div>)}
        {!status && !failed && <div className="col-span-2 rounded-lg border border-[#232328] bg-white/[0.03] p-2.5 text-[color:var(--market-text-3)]">Checking TxLINE status…</div>}
        {failed && <div className="col-span-2 rounded-lg border border-[#232328] bg-white/[0.03] p-2.5 text-[color:var(--market-live-soft)]">Status endpoint unreachable.</div>}
      </div>
      {status && !status.connected && (
        <div className="mt-3 flex items-start gap-2 text-xs leading-5 text-[color:var(--market-text-2)]">
          <Database size={13} className="mt-0.5 shrink-0 text-[#d8ec52]" />
          {status.mockModeEnabled
            ? "Mock Mode Enabled — not real TxLINE data. Settlement uses labeled mock scores."
            : status.configured
              ? "TxLINE request failed. Settlement disabled until TxLINE responds."
              : "Settlement disabled until TxLINE is configured (TXLINE_BASE_URL, TXLINE_GUEST_JWT, TXLINE_API_TOKEN)."}
        </div>
      )}
      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-[#8b8b94]"><ShieldCheck size={12} />Credentials and tokens are never displayed.</div>
    </section>
  );
}
