"use client";

import { useEffect, useMemo, useState } from "react";
import type { MarketplaceMarket } from "@/lib/marketplaceData";

const VIEW_W = 620;
const VIEW_H = 260;
const Y_MAX = 80; // top axis label; grid rows at 80/60/40/20/0%
const Y_TOP = 34;
const Y_BOTTOM = 234;
const POINTS = 42;
const PROB_MIN = 3;
const PROB_MAX = 77;
const TICK_MS = 2500;

type Point = { x: number; y: number };

/* Deterministic PRNG so server and client render the same history. */
function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clampProb(value: number): number {
  return Math.min(PROB_MAX, Math.max(PROB_MIN, value));
}

/* Walk backwards from the market's current probability; rare large steps read as goals/cards. */
function buildHistory(seedKey: string, anchor: number): number[] {
  const rng = mulberry32(hashSeed(seedKey));
  const series = new Array<number>(POINTS);
  series[POINTS - 1] = clampProb(anchor);
  for (let i = POINTS - 2; i >= 0; i--) {
    const drift = (rng() - 0.5) * 4.5;
    const shock = rng() < 0.05 ? (rng() - 0.5) * 16 : 0;
    series[i] = clampProb(series[i + 1] + drift + shock);
  }
  return series;
}

function probToY(prob: number): number {
  return Y_BOTTOM - (clampProb(prob) / Y_MAX) * (Y_BOTTOM - Y_TOP);
}

function toPoints(series: number[]): Point[] {
  const step = VIEW_W / (series.length - 1);
  return series.map((prob, index) => ({ x: index * step, y: probToY(prob) }));
}

/* Catmull-Rom → cubic bezier for a smooth line through every real data point. */
function smoothPath(points: Point[]): string {
  if (points.length < 2) return "";
  let d = `M${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

function timeLabels(market: MarketplaceMarket): string[] {
  const match = market.clock?.match(/(\d+):(\d+)/);
  if (market.status === "live" && match) {
    const minute = parseInt(match[1], 10);
    return [Math.max(0, minute - 3), Math.max(0, minute - 2), Math.max(0, minute - 1)]
      .map(m => `${String(m).padStart(2, "0")}:00`)
      .concat("Now");
  }
  return ["45m ago", "30m ago", "15m ago", "Now"];
}

/* Percent → CSS top inside .market-chart (svg spans the area above the 1.5rem time row). */
function labelTop(prob: number): string {
  const fraction = (probToY(prob) / VIEW_H).toFixed(3);
  return `calc((100% - 1.5rem) * ${fraction} - 0.5em)`;
}

export default function MarketProbabilityChart({ market }: { market: MarketplaceMarket }) {
  const anchors = useMemo(
    () => market.outcomes.slice(0, 2).map(outcome => outcome.probability),
    [market]
  );
  const base = useMemo(
    () => anchors.map((anchor, index) => buildHistory(`${market.id}-${index}`, anchor)),
    [market.id, anchors]
  );
  const [series, setSeries] = useState(base);

  useEffect(() => setSeries(base), [base]);

  useEffect(() => {
    if (market.status !== "live") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      setSeries(current => current.map((line, index) => {
        const last = line[line.length - 1];
        const next = clampProb(last + (anchors[index] - last) * 0.12 + (Math.random() - 0.5) * 3.5);
        return [...line.slice(1), next];
      }));
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [market.status, market.id, anchors]);

  const lines = series.map(line => {
    const points = toPoints(line);
    return { points, path: smoothPath(points), latest: line[line.length - 1] };
  });
  // Nudge overlapping end labels apart so both stay readable.
  const labelProbs = lines.map(line => line.latest);
  if (labelProbs.length === 2 && Math.abs(probToY(labelProbs[0]) - probToY(labelProbs[1])) < 18) {
    if (labelProbs[0] >= labelProbs[1]) { labelProbs[0] += 4; labelProbs[1] -= 4; }
    else { labelProbs[0] -= 4; labelProbs[1] += 4; }
  }
  const gridRows = [0, 1, 2, 3, 4].map(row => Y_TOP + ((Y_BOTTOM - Y_TOP) / 4) * row);

  return <div className="market-chart" aria-label={`Probability history for ${market.title}`} role="img">
    <div className="chart-axis" aria-hidden="true"><span>80%</span><span>60%</span><span>40%</span><span>20%</span><span>0%</span></div>
    <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="none" aria-hidden="true">
      <path className="chart-grid" d={gridRows.map(y => `M0 ${y}H${VIEW_W}`).join("")} />
      <path className="chart-red" d={lines[0]?.path} />
      {lines[1] && <path className="chart-blue" d={lines[1].path} />}
      {lines[0] && <circle className="chart-dot-red" cx={lines[0].points[lines[0].points.length - 1].x} cy={lines[0].points[lines[0].points.length - 1].y} r="5" />}
      {lines[1] && <circle className="chart-dot-blue" cx={lines[1].points[lines[1].points.length - 1].x} cy={lines[1].points[lines[1].points.length - 1].y} r="5" />}
    </svg>
    {lines[0] && <div className="chart-label red" style={{ top: labelTop(labelProbs[0]) }}>{market.outcomes[0]?.label} {Math.round(lines[0].latest)}%</div>}
    {lines[1] && <div className="chart-label blue" style={{ top: labelTop(labelProbs[1]) }}>{market.outcomes[1]?.label} {Math.round(lines[1].latest)}%</div>}
    <div className="chart-times" aria-hidden="true">{timeLabels(market).map(label => <span key={label}>{label}</span>)}</div>
  </div>;
}
