"use client";

import { useState } from "react";
import Link from "next/link";
import { BadgeCheck, CircleDot, Clock3 } from "lucide-react";
import type { MarketplaceMarket, MarketOutcome } from "@/lib/marketplaceData";
import MarketShareButton from "./MarketShareButton";

function CountdownBadge({ value }: { value: string }) {
  return <span className="market-countdown"><Clock3 size={12} />{value}</span>;
}

function LiveBadge() { return <span className="market-live-badge"><span />Live</span>; }
function ComboBadge() { return <span className="market-combo"><BadgeCheck size={10} />Combo</span>; }

function OutcomeRows({ outcomes, marketTitle }: { outcomes: MarketOutcome[]; marketTitle: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  return <div className="market-outcomes" aria-label={`Outcomes for ${marketTitle}`}>
    {outcomes.map((outcome) => <button type="button" key={`${outcome.label}-${outcome.probability}`} className={`market-outcome ${selected === outcome.label ? "is-selected" : ""}`} onClick={() => setSelected(current => current === outcome.label ? null : outcome.label)} aria-pressed={selected === outcome.label}>
      <span className="market-outcome-team"><span className="market-team-avatar" aria-hidden="true">{outcome.symbol?.slice(0, 2) ?? outcome.label.slice(0, 2)}</span><span>{outcome.label}</span></span>
      <span className="market-outcome-price"><small>1 SOL →</small> {outcome.price}</span>
      <span className="market-probability">{outcome.probability}%</span>
    </button>)}
  </div>;
}

export function MarketCard({ market }: { market: MarketplaceMarket }) {
  return <article className="market-card">
    <div className="market-card-top">{market.countdown && <CountdownBadge value={market.countdown} />}{market.combo && <ComboBadge />}</div>
    <p className="market-competition"><CircleDot size={13} />{market.competition}</p>
    <h3><Link href={market.href}>{market.title}</Link></h3>
    <OutcomeRows outcomes={market.outcomes} marketTitle={market.title} />
    <footer className="market-card-footer"><div>{market.tags.map(tag => <span key={tag}>{tag}</span>)}</div><MarketShareButton marketId={market.id} title={market.title} /></footer>
  </article>;
}

export function FeaturedMarketCard({ market }: { market: MarketplaceMarket }) {
  return <article className="market-featured">
    <div className="market-featured-art" aria-hidden="true"><span /><span /><span /></div>
    <div className="market-card-top">{market.countdown && <CountdownBadge value={market.countdown} />}{market.combo && <ComboBadge />}</div>
    <div className="market-featured-content"><p className="market-competition"><CircleDot size={13} />{market.competition}</p><h1><Link href={market.href}>{market.title}</Link></h1><OutcomeRows outcomes={market.outcomes} marketTitle={market.title} /></div>
    <footer className="market-card-footer"><div>{market.tags.map(tag => <span key={tag}>{tag}</span>)}</div><MarketShareButton marketId={market.id} title={market.title} /></footer>
  </article>;
}

export function LiveMarketCard({ market }: { market: MarketplaceMarket }) {
  return <article className="market-live-card"><div className="market-live-meta"><LiveBadge /><span>{market.clock}</span><strong>{market.score}</strong>{market.combo && <ComboBadge />}</div><p className="market-competition"><CircleDot size={13} />{market.competition}</p><h3><Link href={market.href}>{market.title}</Link></h3><OutcomeRows outcomes={market.outcomes} marketTitle={market.title} /></article>;
}

