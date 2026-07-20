"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, RefreshCw } from "lucide-react";
import type { TxLineFixture } from "@/lib/txline/mock";

type FixturesResponse = {
  source?: "txline" | "mock";
  fixtures?: TxLineFixture[];
  error?: string;
  message?: string;
};

function kickoffLabel(fixture: TxLineFixture): string {
  if (!fixture.startTimeMs) return fixture.status === "LIVE" ? "Live now" : "TBD";
  const diffMs = fixture.startTimeMs - Date.now();
  if (diffMs <= 0) return "Live / started";
  const totalMinutes = Math.floor(diffMs / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function kickoffTime(fixture: TxLineFixture): string {
  if (!fixture.startTimeMs) return "";
  return new Date(fixture.startTimeMs).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const TEAM_CODES: Record<string, string> = { France: "FRA", Spain: "ESP", England: "ENG", Argentina: "ARG" };

function isPlaceholderTeam(name: string): boolean {
  return /^(loser|winner)\b/i.test(name);
}

function teamCode(name: string): string {
  if (isPlaceholderTeam(name)) return "TBD";
  return TEAM_CODES[name] ?? name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
}

function stageLabel(competition: string): string {
  const parts = competition.split("·");
  return (parts[1] ?? parts[0]).trim();
}

function TeamRow({ name }: { name: string }) {
  const placeholder = isPlaceholderTeam(name);
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-6 w-9 shrink-0 place-items-center rounded-md border border-white/10 bg-white/[0.06] font-mono text-[9px] font-extrabold tracking-wider text-[#d3d3d8]">{teamCode(name)}</span>
      <span className={"truncate text-[13px] font-bold " + (placeholder ? "text-[#84848d]" : "text-[#ececef]")}>{name}</span>
    </div>
  );
}

export default function UpcomingFixtures({ limit = 8 }: { limit?: number }) {
  const [fixtures, setFixtures] = useState<TxLineFixture[]>([]);
  const [source, setSource] = useState<"txline" | "mock" | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "not_configured" | "error">("loading");

  const load = () => {
    fetch("/api/txline/fixtures")
      .then(async res => ({ ok: res.ok, data: await res.json() as FixturesResponse }))
      .then(({ ok, data }) => {
        if (ok && data.fixtures) {
          setFixtures(data.fixtures);
          setSource(data.source ?? null);
          setState("ready");
        } else {
          setState(data.error === "txline_not_configured" ? "not_configured" : "error");
        }
      })
      .catch(() => setState("error"));
  };

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const upcoming = fixtures
    .filter(f => f.status === "SCHEDULED")
    .slice(0, limit);

  return (
    <section className="rounded-2xl border border-white/[0.07] bg-gradient-to-b from-[#15151a] to-[#101014] p-4" aria-labelledby="upcoming-fixtures-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="upcoming-fixtures-title" className="flex items-center gap-2.5 font-heading text-sm font-bold text-white">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[#2fe39a] to-[#0d8a58] text-[#04160d] shadow-[0_6px_16px_rgba(32,211,138,0.28)]"><CalendarClock size={14} /></span>
          Upcoming matches
        </h2>
        <div className="flex items-center gap-2">
          {source && (
            <span className="flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#8b8b94]">
              <span className={"h-1.5 w-1.5 animate-pulse rounded-full " + (source === "txline" ? "bg-[color:var(--market-positive)]" : "bg-[color:var(--market-promo)]")} aria-hidden="true" />
              {source === "txline" ? "Live feed" : "Demo feed"}
            </span>
          )}
          <button type="button" onClick={load} aria-label="Refresh fixtures" className="grid h-7 w-7 place-items-center rounded-lg border border-white/[0.07] bg-white/[0.03] text-[color:var(--market-text-2)] transition-colors hover:border-white/20 hover:text-white"><RefreshCw size={13} /></button>
        </div>
      </div>

      {state === "loading" && <p className="mt-3 text-sm text-[color:var(--market-text-3)]">Loading fixture feed…</p>}
      {state === "not_configured" && (
        <p className="mt-3 rounded-lg border border-[#fa4669]/25 bg-[#fa4669]/[0.06] p-3 text-xs leading-5 text-[#f8c0cb]">
          TxLINE Not Configured — no fixture data. TxODDS&apos; free World Cup API tier ended with the
          tournament; see the
          <Link href="/txline-setup" className="ml-1 font-bold underline">TxLINE setup page</Link>, or enable mock mode explicitly.
        </p>
      )}
      {state === "error" && <p className="mt-3 rounded-lg border border-[#fa4669]/25 bg-[#fa4669]/[0.06] p-3 text-xs text-[#f8c0cb]">TxLINE Error — fixture request failed.</p>}
      {state === "ready" && upcoming.length === 0 && <p className="mt-3 text-sm text-[color:var(--market-text-3)]">No upcoming fixtures in the feed right now.</p>}

      {state === "ready" && upcoming.length > 0 && (
        <ul className="mt-4 space-y-2.5">
          {upcoming.map((fixture, index) => {
            const next = index === 0;
            return (
              <li
                key={fixture.fixtureId}
                title={fixture.fixtureId}
                className={"relative rounded-xl border p-3 transition-colors " + (next
                  ? "border-[#20d38a]/25 bg-gradient-to-br from-[#20d38a]/[0.07] via-transparent to-transparent"
                  : "border-white/[0.06] bg-[#101014] hover:border-white/[0.14]")}
              >
                {next && <span className="absolute -top-2 right-3 rounded-full border border-[#20d38a]/30 bg-[#0d1f17] px-2 py-0.5 text-[8.5px] font-extrabold uppercase tracking-[0.16em] text-[color:var(--market-positive-soft)]">Next up</span>}
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <TeamRow name={fixture.homeTeam} />
                    <TeamRow name={fixture.awayTeam} />
                  </div>
                  <span className={"shrink-0 rounded-lg px-2 py-1.5 font-mono text-[11px] font-bold " + (next ? "bg-[#20d38a]/15 text-[color:var(--market-positive-soft)]" : "bg-white/[0.05] text-[#c9c9ce]")}>
                    {kickoffLabel(fixture)}
                  </span>
                </div>
                <div className="mt-2.5 flex items-center justify-between border-t border-white/[0.05] pt-2 text-[10px]">
                  <span className="font-extrabold uppercase tracking-[0.13em] text-[#8b8b94]">{stageLabel(fixture.competition)}</span>
                  <span className="text-[color:var(--market-text-3)]">{kickoffTime(fixture)}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
