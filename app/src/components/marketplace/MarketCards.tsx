"use client";

import { useState } from "react";
import Link from "next/link";
import { Activity, ArrowUpRight, BadgeCheck, ChevronRight, CircleDot, Lock } from "lucide-react";
import type { MarketplaceMarket, MarketOutcome } from "@/lib/marketplaceData";
import CountdownTimer from "./CountdownTimer";
import MarketProbabilityChart from "./MarketProbabilityChart";
import MarketShareButton from "./MarketShareButton";

function CountdownBadge({ value, target }: { value: string; target?: string }) {
  return <CountdownTimer value={value} target={target} />;
}

function LiveBadge() { return <span className="market-live-badge"><span />Live</span>; }
function ComboBadge() { return <span className="market-combo"><BadgeCheck size={10} />Combo</span>; }

function EndedBadge({ market }: { market: MarketplaceMarket }) {
  return <span className="market-ended-meta"><span className="market-ft-badge">FT</span><strong>{market.score}</strong>{market.endedAt && <span>{market.endedAt}</span>}</span>;
}

function OutcomeRows({ outcomes, marketTitle, settled }: { outcomes: MarketOutcome[]; marketTitle: string; settled?: boolean }) {
  const [selected, setSelected] = useState<string | null>(null);
  if (settled) {
    return <div className="market-outcomes" aria-label={`Settled outcomes for ${marketTitle}`}>
      {outcomes.map((outcome) => <div key={outcome.label} className={`market-outcome is-settled ${outcome.won ? "" : "is-loser"}`}>
        <span className="market-outcome-team"><span className={`market-team-avatar ${outcome.symbol === "YES" ? "is-yes" : ""} ${outcome.symbol === "NO" ? "is-no" : ""}`} aria-hidden="true">{outcome.symbol?.slice(0, 3) ?? outcome.label.slice(0, 2)}</span><span>{outcome.label}</span></span>
        <span className={`market-outcome-result ${outcome.won ? "won" : "lost"}`}>{outcome.won ? "Won" : "Lost"}</span>
      </div>)}
    </div>;
  }
  return <div className="market-outcomes" aria-label={`Outcomes for ${marketTitle}`}>
    {outcomes.map((outcome) => <button type="button" key={`${outcome.label}-${outcome.probability}`} className={`market-outcome ${selected === outcome.label ? "is-selected" : ""}`} onClick={() => setSelected(current => current === outcome.label ? null : outcome.label)} aria-pressed={selected === outcome.label}>
      <span className="market-outcome-team"><span className={`market-team-avatar ${outcome.symbol === "YES" ? "is-yes" : ""} ${outcome.symbol === "NO" ? "is-no" : ""}`} aria-hidden="true">{outcome.symbol?.slice(0, 3) ?? outcome.label.slice(0, 2)}</span><span>{outcome.label}</span></span>
      <span className="market-outcome-price"><small>$100</small><ChevronRight size={11} aria-hidden="true" /><b>{outcome.price}</b></span>
      <span className="market-probability">{outcome.probability}%</span>
    </button>)}
  </div>;
}

function MarketMetaFooter({ market }: { market: MarketplaceMarket }) {
  if (!market.pool && !market.lock) return null;
  return <div className="market-meta-row">{market.pool && <span>{market.pool}</span>}{market.lock && <span><Lock size={10} aria-hidden="true" />{market.lock}</span>}<span className="market-devnet-tag">Devnet</span></div>;
}

export function MarketCard({ market }: { market: MarketplaceMarket }) {
  return <article className="market-card">
    <div className="market-card-top">{market.status === "live" ? <span className="market-live-meta-inline"><LiveBadge /><span>{market.clock}</span><strong>{market.score}</strong></span> : market.status === "ended" ? <EndedBadge market={market} /> : market.countdown && <CountdownBadge value={market.countdown} target={market.kickoff} />}{market.combo && <ComboBadge />}</div>
    <p className="market-competition"><CircleDot size={13} />{market.competition}</p>
    <h3><Link href={market.href}>{market.title}</Link></h3>
    <OutcomeRows outcomes={market.outcomes} marketTitle={market.title} settled={market.status === "ended"} />
    <MarketMetaFooter market={market} />
    <footer className="market-card-footer"><div>{market.tags.map(tag => <span key={tag}>{tag}</span>)}</div><MarketShareButton marketId={market.id} title={market.title} /></footer>
  </article>;
}

export function FeaturedMarketCard({ market }: { market: MarketplaceMarket }) {
  const isLive = market.status === "live";
  return <article className="market-featured">
    <div className="market-featured-art" aria-hidden="true"><span /><span /><span /></div>
    <div className="market-card-top">
      {isLive ? <span className="market-live-meta-inline"><LiveBadge /><span>{market.clock}</span><strong>{market.score}</strong><em className="market-hero-flag">World Cup · Devnet demo</em></span> : market.countdown && <CountdownBadge value={market.countdown} target={market.kickoff} />}
      <span className="market-top-right">
        {market.combo && <ComboBadge />}
        <span className="market-brand-mark"><Activity size={11} /> Whistly <em>Markets</em></span>
      </span>
    </div>
    <div className="market-featured-layout">
      <div className="market-featured-content">
        <p className="market-competition"><CircleDot size={13} />{market.competition}</p>
        <h1><Link href={market.href}>{market.title}</Link></h1>
        {market.question && <p className="market-hero-question">{market.question}{market.window && <span> · Window {market.window}</span>}</p>}
        <OutcomeRows outcomes={market.outcomes} marketTitle={market.title} />
        <div className="market-hero-notes">
          <span>TxLINE-compatible score data</span>
          <span>Resolves from score data, not majority vote</span>
        </div>
        <Link href={market.href} className="market-hero-cta">View market <ArrowUpRight size={14} /></Link>
      </div>
      <MarketProbabilityChart market={market} />
    </div>
    <footer className="market-card-footer"><div>{market.tags.map(tag => <span key={tag}>{tag}</span>)}</div><MarketShareButton marketId={market.id} title={market.title} /></footer>
  </article>;
}

export function LiveMarketCard({ market }: { market: MarketplaceMarket }) {
  return <article className="market-live-card">
    <div className="market-live-meta"><LiveBadge /><span>{market.clock}</span><strong>{market.score}</strong>{market.combo && <ComboBadge />}</div>
    <p className="market-competition"><CircleDot size={13} />{market.competition}</p>
    <h3><Link href={market.href}>{market.question ?? market.title}</Link></h3>
    <p className="market-live-fixture">{market.title}</p>
    <OutcomeRows outcomes={market.outcomes} marketTitle={market.title} />
    <MarketMetaFooter market={market} />
  </article>;
}

export function SoccerSpotlightCard({ market }: { market: MarketplaceMarket }) {
  return <article className="market-visual-card">
    <div className={`market-pitch ${market.image ? "has-image" : ""}`} aria-hidden="true">
      {market.image ? <><img src={market.image} alt="" /><div className="market-pitch-fade" /></> : <><span /><i /><b /></>}
    </div>
    <div>
      {market.status === "live"
        ? <p><span className="market-live-meta-inline"><LiveBadge /><span>{market.clock}</span></span><strong>{market.score}</strong></p>
        : market.countdown && <p><CountdownBadge value={market.countdown} target={market.kickoff} /></p>}
      <small><CircleDot size={12} aria-hidden="true" /> {market.competition}</small>
      <h3><Link href={market.href}>{market.title}</Link></h3>
      <small>{market.question}</small>
    </div>
  </article>;
}
