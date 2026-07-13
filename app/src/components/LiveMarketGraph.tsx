"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";

type Sample = { t: number; yes: number };

// Keep sample history per market so switching windows/tabs doesn't reset the graph.
const historyStore = new Map<string, Sample[]>();
const MAX_SAMPLES = 120;
const SAMPLE_MS = 3000;

const VIEW_W = 600;
const VIEW_H = 200;
const PAD_TOP = 12;
const PAD_BOTTOM = 18;

function yFor(prob: number): number {
  const clamped = Math.min(100, Math.max(0, prob));
  return PAD_TOP + (1 - clamped / 100) * (VIEW_H - PAD_TOP - PAD_BOTTOM);
}

function pathFor(samples: Sample[], pick: (s: Sample) => number): string {
  if (samples.length === 0) return "";
  const step = samples.length > 1 ? VIEW_W / (samples.length - 1) : VIEW_W;
  return samples
    .map((sample, index) => `${index === 0 ? "M" : "L"}${(index * step).toFixed(1)} ${yFor(pick(sample)).toFixed(1)}`)
    .join(" ");
}

/**
 * Live implied-probability graph for one market, driven by the market's REAL
 * on-chain pool (vote counts) — not simulated values. Each sample is the
 * implied YES probability at that moment; the line moves when people trade.
 */
export default function LiveMarketGraph({
  marketId,
  yesCount,
  noCount,
  title,
}: {
  marketId: string;
  yesCount: number;
  noCount: number;
  title?: string;
}) {
  const total = yesCount + noCount;
  const yesProb = total > 0 ? Math.round((yesCount / total) * 100) : 50;
  const [samples, setSamples] = useState<Sample[]>(() => historyStore.get(marketId) ?? []);

  useEffect(() => {
    setSamples(historyStore.get(marketId) ?? []);
  }, [marketId]);

  useEffect(() => {
    const record = () => {
      const history = historyStore.get(marketId) ?? [];
      const next = [...history, { t: Date.now(), yes: yesProb }].slice(-MAX_SAMPLES);
      historyStore.set(marketId, next);
      setSamples(next);
    };
    record();
    const timer = window.setInterval(record, SAMPLE_MS);
    return () => window.clearInterval(timer);
  }, [marketId, yesProb]);

  const gridLines = useMemo(() => [0, 25, 50, 75, 100].map(p => ({ p, y: yFor(p) })), []);
  const noProb = 100 - yesProb;
  const lastX = samples.length > 1 ? VIEW_W : 0;

  return (
    <section className="rounded-lg border border-[#29292f] bg-[#141418] p-4" aria-label={`Live probability graph${title ? ` for ${title}` : ""}`}>
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white"><BarChart3 size={15} className="text-[#20d38a]" />Market behaviour</h3>
        <div className="flex gap-3 font-mono text-xs">
          <span className="text-[#7ce8bb]">YES {yesProb}%</span>
          <span className="text-[#f78ba0]">NO {noProb}%</span>
        </div>
      </div>
      <div className="relative mt-3">
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="none" className="h-[150px] w-full" aria-hidden="true">
          {gridLines.map(({ p, y }) => (
            <g key={p}>
              <line x1="0" x2={VIEW_W} y1={y} y2={y} stroke="#29292f" strokeDasharray="2 5" />
              <text x={VIEW_W - 4} y={y - 3} textAnchor="end" fill="#6f6f78" fontSize="9">{p}%</text>
            </g>
          ))}
          {samples.length > 1 ? (
            <>
              <path d={pathFor(samples, s => s.yes)} fill="none" stroke="#20d38a" strokeWidth="2" strokeLinejoin="round" />
              <path d={pathFor(samples, s => 100 - s.yes)} fill="none" stroke="#fa4669" strokeWidth="2" strokeLinejoin="round" opacity="0.8" />
              <circle cx={lastX} cy={yFor(yesProb)} r="4" fill="#20d38a" />
              <circle cx={lastX} cy={yFor(noProb)} r="4" fill="#fa4669" opacity="0.8" />
            </>
          ) : (
            <text x={VIEW_W / 2} y={VIEW_H / 2} textAnchor="middle" fill="#6f6f78" fontSize="11">Collecting live samples…</text>
          )}
        </svg>
      </div>
      <p className="mt-2 text-[11px] text-[#6f6f78]">
        Implied probability from the on-chain pool ({yesCount} YES / {noCount} NO positions). Updates as trades land.
      </p>
    </section>
  );
}
