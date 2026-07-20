"use client";

import { AlertTriangle, CheckCircle2, Database, ShieldCheck, WifiOff } from "lucide-react";
import DataHealthWidget from "@/components/kicktick/DataHealthWidget";
import TxLineActivation from "@/components/TxLineActivation";
import UpcomingFixtures from "@/components/UpcomingFixtures";

const STATUS_ITEMS = [
  { label: "Network", value: "Devnet", ok: true },
  { label: "Guest JWT", value: "Missing", ok: false },
  { label: "API token", value: "Missing", ok: false },
  { label: "Fixtures API", value: "Demo", ok: false },
  { label: "Scores API", value: "Demo", ok: false },
  { label: "Odds API", value: "Demo", ok: false },
  { label: "Service Level", value: "Demo", ok: false },
  { label: "Data delay", value: "Demo", ok: false },
];

export default function TxLineSetupPage() {
  return (
    <div className="space-y-6 pb-8 text-slate-100">
      <header className="rounded-lg border border-slate-800 bg-[#07101b] p-5">
        <div className="flex items-center gap-2">
          <Database className="text-blue-300" size={20} />
          <h1 className="font-heading text-2xl font-bold text-white">
            TxLINE Setup
          </h1>
        </div>
        <p className="mt-2 text-sm text-slate-400">
          View TxLINE data configuration status and test data endpoints.
        </p>
      </header>

      <TxLineActivation />
      <UpcomingFixtures />

      {/* Warning */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
        <AlertTriangle className="mt-0.5 shrink-0" size={18} />
        <div>
          <div className="font-semibold">
            TxLINE real credentials not configured.
          </div>
          <div className="mt-1 text-amber-100/80">
            Without credentials the app fails closed and settlement is disabled.
            To connect to real TxLINE endpoints, configure TXLINE_BASE_URL,
            TXLINE_GUEST_JWT, and TXLINE_API_TOKEN in your environment variables.
            Mock data is only used when NEXT_PUBLIC_ENABLE_MOCK_MODE=true and is
            clearly labeled. Note: TxODDS&apos; free World Cup API tier ended with
            the tournament, so free-tier activation no longer returns live data.
          </div>
        </div>
      </div>

      {/* Status Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STATUS_ITEMS.map((item) => (
          <div
            key={item.label}
            className="rounded-lg border border-slate-800 bg-[#08111f] p-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {item.label}
              </span>
              {item.ok ? (
                <CheckCircle2 size={15} className="text-emerald-400" />
              ) : (
                <WifiOff size={15} className="text-amber-400" />
              )}
            </div>
            <div
              className={`mt-2 text-sm font-semibold ${
                item.ok ? "text-emerald-300" : "text-amber-300"
              }`}
            >
              {item.value}
            </div>
          </div>
        ))}
      </div>

      <DataHealthWidget />

      {/* Documentation link */}
      <div className="rounded-lg border border-slate-800 bg-[#08111f] p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="text-slate-400" size={18} />
          <h2 className="text-lg font-semibold text-white">
            TxLINE Documentation
          </h2>
        </div>
        <p className="mt-2 text-sm text-slate-400">
          The free World Cup tier ran during the tournament and has now ended.
          For API documentation and paid access, visit the TxLINE docs.
        </p>
        <div className="mt-3 flex gap-3 text-sm">
          <a
            href="https://txline-docs.txodds.com/documentation/worldcup"
            target="_blank"
            rel="noreferrer"
            className="text-blue-300 underline decoration-blue-300/30 underline-offset-4 hover:text-blue-200"
          >
            World Cup Free Tier →
          </a>
          <a
            href="https://txline-docs.txodds.com/llms.txt"
            target="_blank"
            rel="noreferrer"
            className="text-blue-300 underline decoration-blue-300/30 underline-offset-4 hover:text-blue-200"
          >
            llms.txt →
          </a>
        </div>
      </div>
    </div>
  );
}

