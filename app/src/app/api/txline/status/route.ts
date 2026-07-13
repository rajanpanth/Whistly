import { NextResponse } from "next/server";
import {
  isTxLineConfigured,
  isTxLineMockMode,
  probeTxLine,
  txLineMissingEnvVars,
  type TxLineServiceState,
} from "@/lib/txline/client";

export const dynamic = "force-dynamic";

type StatusPayload = {
  status: TxLineServiceState;
  connected: boolean;
  configured: boolean;
  mockModeEnabled: boolean;
  missingEnvVars: string[];
  settlementEnabled: boolean;
  network: "devnet";
  lastCheckedAt: string;
  services: {
    fixtures: TxLineServiceState;
    scores: TxLineServiceState;
    odds: TxLineServiceState | "not_implemented";
  };
  note: string;
};

// Cache the live probe briefly so widgets polling the route don't hammer TxLINE.
const cache = globalThis as typeof globalThis & {
  __txlineStatusCache?: { payload: StatusPayload; expiresAt: number };
};
const CACHE_MS = 15_000;

export async function GET() {
  const cached = cache.__txlineStatusCache;
  if (cached && Date.now() < cached.expiresAt) {
    return NextResponse.json(cached.payload);
  }

  const mockModeEnabled = isTxLineMockMode();
  const configured = isTxLineConfigured();
  const status = await probeTxLine();
  const connected = status === "connected";
  // Settlement runs only from real TxLINE data, or from mock data when mock
  // mode is EXPLICITLY enabled (and clearly labeled). Otherwise: fail closed.
  const settlementEnabled = connected || (!configured && mockModeEnabled);

  const payload: StatusPayload = {
    status,
    connected,
    configured,
    mockModeEnabled,
    missingEnvVars: txLineMissingEnvVars(),
    settlementEnabled,
    network: "devnet",
    lastCheckedAt: new Date().toISOString(),
    services: {
      fixtures: status,
      scores: status,
      odds: connected ? "connected" : "not_implemented",
    },
    note: connected
      ? "TxLINE Connected — real score data."
      : mockModeEnabled
        ? "Mock Mode Enabled — not real TxLINE data."
        : configured
          ? "TxLINE Error — request to TxLINE failed."
          : "TxLINE Not Configured — settlement disabled until TxLINE is configured.",
  };

  cache.__txlineStatusCache = { payload, expiresAt: Date.now() + CACHE_MS };
  return NextResponse.json(payload);
}
