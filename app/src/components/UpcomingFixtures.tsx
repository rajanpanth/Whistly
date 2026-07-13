"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, CircleDot, RefreshCw } from "lucide-react";
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
    .filter(f => f.status !== "FINISHED")
    .slice(0, limit);

  return (
    <section className="rounded-xl border border-[#29292f] bg-[#141418] p-4" aria-labelledby="upcoming-fixtures-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="upcoming-fixtures-title" className="flex items-center gap-2 font-heading text-sm font-bold text-white">
          <CalendarClock size={16} className="text-[#20d38a]" />Upcoming matches
        </h2>
        <div className="flex items-center gap-2">
          {source && (
            <span className={"rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider " + (source === "txline" ? "bg-[#20d38a]/10 text-[#7ce8bb]" : "bg-[#e6ff3e]/10 text-[#d8ec52]")}>
              {source === "txline" ? "TxLINE live feed" : "Mock data"}
            </span>
          )}
          <button type="button" onClick={load} aria-label="Refresh fixtures" className="grid h-7 w-7 place-items-center rounded-lg border border-[#29292f] text-[#a1a1aa] hover:text-white"><RefreshCw size={13} /></button>
        </div>
      </div>

      {state === "loading" && <p className="mt-3 text-sm text-[#6f6f78]">Loading fixture feed…</p>}
      {state === "not_configured" && (
        <p className="mt-3 rounded-lg border border-[#fa4669]/25 bg-[#fa4669]/[0.06] p-3 text-xs leading-5 text-[#f8c0cb]">
          TxLINE Not Configured — no fixture data. Activate the free World Cup tier on the
          <Link href="/txline-setup" className="ml-1 font-bold underline">TxLINE setup page</Link>, or enable mock mode explicitly.
        </p>
      )}
      {state === "error" && <p className="mt-3 rounded-lg border border-[#fa4669]/25 bg-[#fa4669]/[0.06] p-3 text-xs text-[#f8c0cb]">TxLINE Error — fixture request failed.</p>}
      {state === "ready" && upcoming.length === 0 && <p className="mt-3 text-sm text-[#6f6f78]">No upcoming fixtures in the feed right now.</p>}

      {state === "ready" && upcoming.length > 0 && (
        <ul className="mt-3 divide-y divide-[#232328]">
          {upcoming.map(fixture => (
            <li key={fixture.fixtureId} className="flex items-center gap-3 py-2.5">
              <span className={"h-2 w-2 shrink-0 rounded-full " + (fixture.status === "LIVE" ? "animate-pulse bg-[#fa4669]" : "bg-[#3b3b43]")} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-[#e6e6e9]">{fixture.homeTeam} vs {fixture.awayTeam}</div>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[#8b8b94]">
                  <CircleDot size={10} aria-hidden="true" />{fixture.competition}
                  {kickoffTime(fixture) && <span>· {kickoffTime(fixture)}</span>}
                  <span className="font-mono text-[#6f6f78]">#{fixture.fixtureId}</span>
                </div>
              </div>
              <span className={"shrink-0 rounded-md px-2 py-1 font-mono text-[11px] font-bold " + (fixture.status === "LIVE" ? "bg-[#fa4669]/10 text-[#f78ba0]" : "bg-white/[0.05] text-[#c9c9ce]")}>
                {fixture.status === "LIVE" ? "LIVE" : kickoffLabel(fixture)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
