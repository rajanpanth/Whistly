"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * Live countdown pill with odometer-style rolling digits.
 * Each digit is a 1em-high window over a vertical column of 0–9; ticking
 * translates the column so the new digit slides into view.
 *
 * Initial value is parsed deterministically from the static countdown string
 * (e.g. "2d : 16h : 4m : 20s"), so server and client render identically;
 * ticking starts after mount.
 */

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

function parseCountdown(value: string): number {
  const get = (unit: string) => {
    const match = value.match(new RegExp(`(\\d+)\\s*${unit}`, "i"));
    return match ? parseInt(match[1], 10) : 0;
  };
  return get("d") * 86400 + get("h") * 3600 + get("m") * 60 + get("s");
}

function RollingDigit({ digit }: { digit: number }) {
  return (
    <span className="digit-roll" aria-hidden="true">
      <span className="digit-roll-col" style={{ transform: `translateY(-${digit}em)` }}>
        {DIGITS.map(d => <span key={d}>{d}</span>)}
      </span>
    </span>
  );
}

function RollingNumber({ text }: { text: string }) {
  return <>{text.split("").map((ch, i) => <RollingDigit key={`${text.length}-${i}`} digit={ch.charCodeAt(0) - 48} />)}</>;
}

export default function CountdownTimer({ value, target }: { value: string; target?: string }) {
  const initial = useMemo(() => parseCountdown(value), [value]);
  const [remaining, setRemaining] = useState(initial);

  useEffect(() => setRemaining(initial), [initial]);

  useEffect(() => {
    // With a kickoff target, recompute from the clock each tick so the timer
    // stays accurate no matter when the page was rendered.
    if (target) {
      const targetMs = Date.parse(target);
      const compute = () => setRemaining(Math.max(0, Math.floor((targetMs - Date.now()) / 1000)));
      compute();
      const timer = window.setInterval(compute, 1000);
      return () => window.clearInterval(timer);
    }
    const timer = window.setInterval(() => setRemaining(r => Math.max(0, r - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [target]);

  const days = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  const segments: Array<[string, string]> = [
    [String(days), "d"],
    [pad(hours), "h"],
    [pad(minutes), "m"],
    [pad(seconds), "s"],
  ];

  return (
    <span
      className="market-countdown"
      role="timer"
      aria-label={`${days} days ${hours} hours ${minutes} minutes ${seconds} seconds remaining`}
    >
      {segments.map(([num, unit]) => (
        <em key={unit}>
          <RollingNumber text={num} />
          <i>{unit}</i>
        </em>
      ))}
    </span>
  );
}
