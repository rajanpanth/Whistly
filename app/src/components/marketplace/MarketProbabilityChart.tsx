"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
/** Minutes represented by one history step (pre-match markets reprice slowly). */
const STEP_MINUTES = 30;

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

/* Walk backwards from the market's current probability. Markets hold flat
   between trades and reprice in discrete jumps, so favour plateaus with
   occasional steps and rare shocks (goals, team news). */
function buildHistory(seedKey: string, anchor: number): number[] {
  const rng = mulberry32(hashSeed(seedKey));
  const series = new Array<number>(POINTS);
  series[POINTS - 1] = clampProb(anchor);
  for (let i = POINTS - 2; i >= 0; i--) {
    const hold = rng() < 0.48;
    const drift = hold ? 0 : (rng() - 0.5) * 5;
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

/* Step-after path: each price holds until the next reprice — the honest shape
   for an order-driven market (no invented values between trades). */
function stepPath(points: Point[]): string {
  if (points.length < 2) return "";
  let d = `M${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    d += ` H${points[i].x.toFixed(1)} V${points[i].y.toFixed(1)}`;
  }
  return d;
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
  const [now, setNow] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => setSeries(base), [base]);
  useEffect(() => setNow(Date.now()), [market.id]);

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

  /* Real timestamps for each step, set after mount (keeps SSR deterministic). */
  const stepMs = (market.status === "live" ? 1 : STEP_MINUTES) * 60_000;
  const timeAt = (index: number): number | null =>
    now === null ? null : now - (POINTS - 1 - index) * stepMs;

  const axisTimeLabels = useMemo(() => {
    const marks = [0, 14, 28];
    if (now === null) return [...marks.map(() => "—"), "Now"];
    const fmt = (t: number) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return [...marks.map(index => fmt(now - (POINTS - 1 - index) * stepMs)), "Now"];
  }, [now, stepMs]);

  function handleMove(event: React.MouseEvent<HTMLDivElement>) {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const fraction = (event.clientX - rect.left) / rect.width;
    setHover(Math.min(POINTS - 1, Math.max(0, Math.round(fraction * (POINTS - 1)))));
  }

  const lines = series.map(line => {
    const points = toPoints(line);
    return { points, path: stepPath(points), latest: line[line.length - 1] };
  });
  // Nudge overlapping end labels apart so both stay readable.
  const labelProbs = lines.map(line => line.latest);
  if (labelProbs.length === 2 && Math.abs(probToY(labelProbs[0]) - probToY(labelProbs[1])) < 18) {
    if (labelProbs[0] >= labelProbs[1]) { labelProbs[0] += 4; labelProbs[1] -= 4; }
    else { labelProbs[0] -= 4; labelProbs[1] += 4; }
  }
  const gridRows = [0, 1, 2, 3, 4].map(row => Y_TOP + ((Y_BOTTOM - Y_TOP) / 4) * row);

  const hoverX = hover === null ? 0 : (hover / (POINTS - 1)) * VIEW_W;
  const hoverTime = hover === null ? null : timeAt(hover);

  return <div
    ref={wrapRef}
    className="market-chart"
    aria-label={`Probability history for ${market.title}`}
    role="img"
    onMouseMove={handleMove}
    onMouseLeave={() => setHover(null)}
  >
    <div className="chart-axis" aria-hidden="true"><span>80%</span><span>60%</span><span>40%</span><span>20%</span><span>0%</span></div>
    <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="none" aria-hidden="true">
      <path className="chart-grid" d={gridRows.map(y => `M0 ${y}H${VIEW_W}`).join("")} />
      <path className="chart-red" d={lines[0]?.path} />
      {lines[1] && <path className="chart-blue" d={lines[1].path} />}
      {lines[0] && <circle className="chart-dot-red" cx={VIEW_W} cy={probToY(lines[0].latest)} r="5" />}
      {lines[1] && <circle className="chart-dot-blue" cx={VIEW_W} cy={probToY(lines[1].latest)} r="5" />}
      {hover !== null && <g className="chart-hover-layer">
        <line className="chart-crosshair" x1={hoverX} x2={hoverX} y1={Y_TOP - 16} y2={Y_BOTTOM} />
        {lines[0] && <circle className="chart-hover-dot red" cx={hoverX} cy={probToY(series[0][hover])} r="4.5" />}
        {lines[1] && <circle className="chart-hover-dot blue" cx={hoverX} cy={probToY(series[1][hover])} r="4.5" />}
      </g>}
    </svg>
    {lines[0] && <div className="chart-label red" style={{ top: labelTop(labelProbs[0]) }}>{market.outcomes[0]?.label} {Math.round(lines[0].latest)}%</div>}
    {lines[1] && <div className="chart-label blue" style={{ top: labelTop(labelProbs[1]) }}>{market.outcomes[1]?.label} {Math.round(lines[1].latest)}%</div>}
    {hover !== null && <div
      className={`chart-tooltip ${hover > POINTS * 0.55 ? "flip" : ""}`}
      style={{ left: `${(hover / (POINTS - 1)) * 100}%` }}
    >
      <b>{hoverTime === null
        ? "—"
        : hover === POINTS - 1
          ? "Now"
          : new Date(hoverTime).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</b>
      {market.outcomes.slice(0, 2).map((outcome, index) => <div key={outcome.label}>
        <span className={`dot ${index === 0 ? "red" : "blue"}`} aria-hidden="true" />
        <span className="chart-tooltip-name">{outcome.label}</span>
        <em>{Math.round(series[index][hover])}%</em>
      </div>)}
    </div>}
    <div className="chart-times" aria-hidden="true">{axisTimeLabels.map((label, index) => <span key={`${index}-${label}`}>{label}</span>)}</div>
  </div>;
}
