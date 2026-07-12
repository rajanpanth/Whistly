/**
 * Generic resolver result type for all KickTick market families.
 * Each resolver returns this shape for consistent settlement proof display.
 */
export interface ResolverResult {
  outcome: "YES" | "NO";
  winningOptionIndex: 0 | 1;
  evidence: {
    fixtureId: string;
    marketFamily: string;
    startScore?: string;
    endScore?: string;
    startStat?: number;
    endStat?: number;
    eventId?: string;
    eventType?: string;
    source: "TXLINE" | "MOCK";
    proofStatus?: "verified" | "demo" | "unavailable";
  };
}
